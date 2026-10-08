<?php
declare(strict_types=1);

ini_set('display_errors', '1');
error_reporting(E_ALL);

date_default_timezone_set('Asia/Manila');

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Credentials: true');

const DB_HOST = 'localhost';
const DB_NAME = 'permittrack';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(mixed $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

/** At least 8 characters, with an uppercase letter, a number, and a special character. */
function is_strong_password(string $password): bool
{
    return strlen($password) >= 8
        && preg_match('/[A-Z]/', $password)
        && preg_match('/[a-z]/', $password)
        && preg_match('/\d/', $password)
        && preg_match('/[^A-Za-z0-9]/', $password);
}

/**
 * Reads a .env file (simple KEY=VALUE lines, '#' comments, optional quotes) into
 * getenv()/$_ENV without requiring a dotenv package. Missing file is not an error.
 */
function load_env_file(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && $value[-1] === $value[0]) {
            $value = substr($value, 1, -1);
        }
        if ($key !== '' && getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

/**
 * Settings that differ per install (SMTP, SMS provider, municipality name).
 * Preferred source is .env (copy .env.example to .env and fill it in); api/config.local.php
 * is still supported for settings .env doesn't cover and overrides defaults, but a value also
 * set in .env is taken from .env.
 */
function app_config(): array
{
    static $config = null;
    if ($config === null) {
        load_env_file(dirname(__DIR__) . '/.env');

        $defaults = [
            'municipality' => 'City of Dasmariñas',
            'mail' => ['driver' => 'log'],
            'sms' => ['driver' => 'log'],
            'google' => ['client_id' => ''], // Sign in with Google stays hidden until this is set
            // Walking a permit through its offices by hand means knowing which account signs
            // off on each step. With this on, the pipeline names that account. It exposes staff
            // email addresses, so any install with real accounts on it sets this false in
            // config.local.php — that one flag takes them out of the API response. It never
            // discloses credentials; the tester signs in with a password they already hold.
            'testing' => ['reviewer_hints' => true],
        ];
        $local = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];
        $config = array_replace_recursive($defaults, is_array($local) ? $local : []);

        $mailDriver = getenv('MAIL_DRIVER');
        if ($mailDriver !== false) {
            $config['mail'] = [
                'driver' => $mailDriver,
                'host' => getenv('SMTP_HOST') ?: null,
                'port' => getenv('SMTP_PORT') ?: null,
                'encryption' => getenv('SMTP_ENCRYPTION') ?: null,
                'username' => getenv('SMTP_USERNAME') ?: null,
                'password' => getenv('SMTP_PASSWORD') ?: null,
                'from_email' => getenv('SMTP_FROM_EMAIL') ?: null,
                'from_name' => getenv('SMTP_FROM_NAME') ?: null,
            ];
        }
        $smsDriver = getenv('SMS_DRIVER');
        if ($smsDriver !== false) {
            $config['sms'] = [
                'driver' => $smsDriver,
                'api_key' => getenv('SEMAPHORE_API_KEY') ?: null,
                'sender_name' => getenv('SEMAPHORE_SENDER_NAME') ?: null,
                'account_sid' => getenv('TWILIO_ACCOUNT_SID') ?: null,
                'auth_token' => getenv('TWILIO_AUTH_TOKEN') ?: null,
                'from' => getenv('TWILIO_FROM') ?: null,
                'api_token' => getenv('PHILSMS_API_TOKEN') ?: null,
                'sender_id' => getenv('PHILSMS_SENDER_ID') ?: null,
            ];
        }
    }
    return $config;
}

const USER_COLUMNS = 'id, role, account_type, email, phone, full_name, first_name, middle_name, last_name, birthdate,
    address_line, barangay, barangay_id, city, city_code, province, province_code, postal_code, email_verified_at, phone_verified_at, resident_status, onboarding_completed,
    (SELECT COUNT(*) FROM businesses b WHERE b.user_id = users.id AND b.status = \'approved\') AS approved_businesses,
    department_id, is_active, must_change_password, (password_hash <> \'\') AS has_password, last_login_at, created_at,
    (SELECT d.name FROM departments d WHERE d.id = users.department_id) AS department_name,
    (SELECT d.code FROM departments d WHERE d.id = users.department_id) AS department_code,
    (SELECT d.permit_types FROM departments d WHERE d.id = users.department_id AND d.is_active = 1) AS department_permit_types';

/**
 * Whether a staff member's department runs the new per-office pipeline (barangay secretariats
 * and the 9 offices added in migration 008) rather than the original CSV-based department model
 * (OBO/BPLO/CHO). See BREAKING_CHANGES.md #1 and #6.
 */
function is_pipeline_staff(array $user): bool
{
    return $user['role'] === 'staff' && ($user['department_permit_types'] ?? '') === '__unassigned__';
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT ' . USER_COLUMNS . ' FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    // A deactivated account is signed out on its next request
    if ($user && !(int)$user['is_active']) {
        $_SESSION = [];
        return null;
    }
    return $user ? with_levels($user) : null;
}

/**
 * Permit types a staff member reviews: their active department's list, or null for "all"
 * (Admins, and staff not assigned to a department).
 */
function reviewable_permit_types(array $user): ?array
{
    if ($user['role'] === 'admin' || empty($user['department_permit_types'])) {
        return null;
    }
    return array_values(array_filter(array_map('trim', explode(',', $user['department_permit_types']))));
}

/** Adds the labels the UI shows, e.g. ['Normal User'] or ['Resident', 'Business Owner']. */
function with_levels(array $user): array
{
    $labels = match ($user['role']) {
        'admin' => ['Admin'],
        'staff' => ['City Staff'],
        default => [],
    };
    if ($user['role'] === 'applicant') {
        if ($user['resident_status'] === 'verified') {
            $labels[] = 'Resident';
        }
        if ((int)($user['approved_businesses'] ?? 0) > 0) {
            $labels[] = 'Business Owner';
        }
        if (!$labels) {
            $labels[] = 'Normal User';
        }
    }
    $user['levels'] = $labels;
    $user['verified_contact'] = !empty($user['email_verified_at']) || !empty($user['phone_verified_at']);
    $user['can_apply'] = can_apply($user);
    return $user;
}

function can_apply(array $user): bool
{
    return $user['role'] === 'applicant'
        && (in_array('Resident', $user['levels'], true) || in_array('Business Owner', $user['levels'], true));
}

function require_auth(): array
{
    $user = current_user();
    if (!$user) {
        fail('Not authenticated', 401);
    }
    return $user;
}

/** Allows any of the given roles. Admin passes every staff check (superadmin). */
function require_role(string ...$roles): array
{
    $user = require_auth();
    $allowed = in_array($user['role'], $roles, true)
        || ($user['role'] === 'admin' && in_array('staff', $roles, true));
    if (!$allowed) {
        fail('Forbidden', 403);
    }
    return $user;
}

/** Philippine mobile numbers: accepts 09171234567, 9171234567, +639171234567, 639171234567. Returns +639XXXXXXXXX or null. */
function normalize_ph_mobile(string $raw): ?string
{
    $digits = preg_replace('/\D+/', '', $raw);
    if (preg_match('/^(?:63|0)?(9\d{9})$/', $digits, $m)) {
        return '+63' . $m[1];
    }
    return null;
}

// What an applicant may attach to a permit. A supporting document is evidence of something
// already issued and signed — an ID, a clearance, a title — so it has to arrive as a scan,
// a photo, or a PDF. Editable office formats (DOC, DOCX, PPT, PPTX, PPTM) are deliberately
// excluded: a file the applicant can retype is not proof of anything.
// Keep in step with ALLOWED_UPLOAD_EXT in assets/js/util.js.
const ALLOWED_UPLOAD_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',          // photos / scans
    'pdf',                                                 // the standard for issued documents
];

/**
 * Rejects anything that is not an allowed document or image. Checks the real contents, not
 * just the name — an .exe renamed to .pdf would otherwise sail through. Office files are a
 * special case: they are zip containers, so most systems report them as application/zip.
 *
 * Returns an error message, or null when the file is acceptable.
 */
function upload_type_error(array $file): ?string
{
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_UPLOAD_EXTENSIONS, true)) {
        $office = ['doc', 'docx', 'ppt', 'pptx', 'pptm', 'xls', 'xlsx', 'odt', 'odp', 'pages', 'key'];
        if (in_array($ext, $office, true)) {
            return 'Office files cannot be used as supporting documents, because they can be edited. '
                 . 'Please upload a scan, a photo, or a PDF of the issued document.';
        }
        return 'Only a scan, photo or PDF can be uploaded (JPG, PNG, WEBP, HEIC or PDF).';
    }

    $mime = null;
    if (function_exists('finfo_open') && is_readable($file['tmp_name'])) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']) ?: null;
        finfo_close($finfo);
    }
    if ($mime === null) {
        return null; // cannot inspect contents here; the extension check above still applies
    }

    $expected = [
        'jpg'  => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'],
        'webp' => ['image/webp'],
        'heic' => ['image/heic', 'image/heif'],
        'heif' => ['image/heic', 'image/heif'],
        'pdf'  => ['application/pdf'],
    ];
    if (isset($expected[$ext]) && !in_array($mime, $expected[$ext], true)) {
        return 'That file does not look like a real ' . strtoupper($ext) . '. Please upload the original document or a photo of it.';
    }
    return null;
}

/**
 * Why a reviewer sent a document back. The applicant has to know what to fix, and "see reviewer
 * note" was not an answer — so the reason comes from this list rather than being typed, which also
 * keeps it consistent between offices and translatable later.
 *
 * The key is what is stored; the text is only what is shown. 'other' is deliberately last and
 * requires notes — picking it without saying anything would put us back where we started.
 * Keep in step with DOCUMENT_REJECT_REASONS in assets/js/util.js.
 */
const DOCUMENT_REJECT_REASONS = [
    'unreadable'     => 'Blurry or hard to read',
    'wont_open'      => "File won't open",
    'wrong_document' => 'Wrong document',
    'incomplete'     => 'Incomplete — pages missing',
    'expired'        => 'Expired or out of date',
    'mismatch'       => "Details don't match the application",
    'other'          => 'Other (please explain)',
];

function required_documents_for(string $permitType): array
{
    $map = [
        'Food Service' => ['Health Permit Application', 'Food Handler Certificate', 'Floor Plan', 'Proof of Insurance'],
        'Building/Renovation' => ['Site Plan', 'Structural Drawings', 'Proof of Insurance', 'Contractor License'],
        'Sign' => ['Sign Drawing / Rendering', 'Property Owner Authorization'],
        'Business License' => ['Business Formation Document', 'BIR Certificate of Registration (Form 2303)', 'Zoning Compliance Letter'],
        'Special Event' => ['Event Layout Map', 'Proof of Insurance', 'Security/Safety Plan'],
    ];
    return $map[$permitType] ?? [];
}

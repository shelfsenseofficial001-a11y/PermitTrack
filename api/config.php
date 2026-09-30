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

/**
 * Settings that differ per install (SMTP, SMS provider, municipality name).
 * Copy config.local.example.php to config.local.php and fill it in.
 */
function app_config(): array
{
    static $config = null;
    if ($config === null) {
        $defaults = [
            'municipality' => 'City of Dasmariñas',
            'mail' => ['driver' => 'log'],
            'sms' => ['driver' => 'log'],
        ];
        $local = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];
        $config = array_replace_recursive($defaults, is_array($local) ? $local : []);
    }
    return $config;
}

const USER_COLUMNS = 'id, role, account_type, email, phone, full_name, first_name, middle_name, last_name, birthdate,
    address_line, barangay, barangay_id, city, postal_code, email_verified_at, phone_verified_at, resident_status, onboarding_completed,
    (SELECT COUNT(*) FROM businesses b WHERE b.user_id = users.id AND b.status = \'approved\') AS approved_businesses,
    department_id, is_active, must_change_password, last_login_at, created_at,
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

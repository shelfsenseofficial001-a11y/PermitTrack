<?php
declare(strict_types=1);

// Shared helpers for verification features: private file storage, audit log, user notifications.

require_once __DIR__ . '/notify.php';

const PRIVATE_UPLOAD_MIME = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];
const PRIVATE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

function storage_path(string $relative = ''): string
{
    return dirname(__DIR__, 2) . '/storage' . ($relative !== '' ? '/' . ltrim($relative, '/') : '');
}

/**
 * Validates one uploaded file (PDF/JPG/PNG/WEBP, max 5 MB, checked by content) and moves it into
 * storage/<$dir>/ under a random name. $label is used in error messages, e.g. "Proof #1".
 */
function store_private_file(array $file, string $dir, string $label): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        fail("Please upload a file for $label.");
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE || $file['size'] > PRIVATE_UPLOAD_MAX_BYTES) {
        fail("$label is too large. The limit is 5 MB.");
    }
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        fail("$label couldn't be uploaded. Please try again.");
    }
    // Trust the file contents, not the name or the browser-reported type
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset(PRIVATE_UPLOAD_MIME[$mime])) {
        fail("$label must be a PDF, JPG, PNG or WEBP file.");
    }

    if (!is_dir(storage_path($dir))) {
        mkdir(storage_path($dir), 0775, true);
    }
    $relativePath = $dir . '/' . bin2hex(random_bytes(16)) . '.' . PRIVATE_UPLOAD_MIME[$mime];
    if (!move_uploaded_file($file['tmp_name'], storage_path($relativePath))) {
        fail("$label couldn't be saved. Please try again.", 500);
    }

    return [
        'file_path' => $relativePath,
        'original_filename' => mb_substr(basename((string)$file['name']), 0, 255),
        'mime_type' => $mime,
        'file_size' => (int)$file['size'],
    ];
}

/** The file types a browser can show on a page; anything else is only ever offered as a download. */
const BROWSER_VIEWABLE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * The page a document opens in when someone clicks "View". A browser shows a bare image or PDF
 * under the name of the script that sent it ("documents.php (745×795)") with the web server's
 * default icon, so the file is wrapped in a page of ours that names it and carries PermitTrack's
 * own icon. $fileUrl is the raw file, relative to the script that is answering. Stops the request.
 */
function send_file_viewer(string $title, string $fileUrl, string $mime): void
{
    $e = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $embed = $mime === 'application/pdf'
        ? '<iframe src="' . $e($fileUrl) . '" title="' . $e($title) . '"></iframe>'
        : '<img src="' . $e($fileUrl) . '" alt="' . $e($title) . '">';
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; frame-src 'self'; style-src 'unsafe-inline'");
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $e($title) . ' · PermitTrack</title>'
        . '<link rel="icon" type="image/png" href="../assets/images/PermitTrackIcon.png">'
        . '<style>html,body{margin:0;height:100%;background:#10301d}'
        . 'body{display:grid;place-items:center}'
        . 'img{display:block;max-width:100%;max-height:100vh;object-fit:contain}'
        . 'iframe{display:block;width:100%;height:100vh;border:0;background:#fff}</style>'
        . '</head><body>' . $embed . '</body></html>';
    exit;
}

/**
 * The URL of the file this request is for, minus the ?view=1 that asked for the viewer page.
 * Relative, so it resolves beside the endpoint that is answering.
 */
function raw_file_url(): string
{
    $query = $_GET;
    unset($query['view']);
    return basename((string)($_SERVER['SCRIPT_NAME'] ?? '')) . '?' . http_build_query($query);
}

/**
 * Streams a stored private file inline (for viewing in the browser) and stops. With ?view=1 it
 * answers with the viewer page instead (send_file_viewer), named $title — the file's own name if
 * none is given. A type a browser can't show is streamed as it always was.
 */
function send_private_file(string $relativePath, string $mime, string $originalName, ?string $title = null): void
{
    $path = storage_path($relativePath);
    if (!is_file($path)) {
        fail('File not found.', 404);
    }
    if (($_GET['view'] ?? '') === '1' && in_array($mime, BROWSER_VIEWABLE_MIME, true)) {
        send_file_viewer($title ?? $originalName, raw_file_url(), $mime);
    }
    $safeName = preg_replace('/[^A-Za-z0-9._ -]/', '_', $originalName);
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline; filename="' . $safeName . '"');
    header('Content-Length: ' . filesize($path));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
}

// Dasmariñas has 75 barangays and the system covers no other city, so every address field
// in the app resolves against this one list rather than accepting free text.
/** All barangays of Dasmariñas, for the searchable select. */
function barangay_options(): array
{
    return db()->query('SELECT id, name FROM barangays ORDER BY name')->fetchAll();
}

/** Looks up a barangay by name (case/whitespace-insensitive); null if it isn't one of Dasmariñas' 75. */
function find_barangay(string $name): ?array
{
    $stmt = db()->prepare('SELECT id, name FROM barangays WHERE LOWER(name) = LOWER(?)');
    $stmt->execute([trim($name)]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * Which barangay's residency and business requests this staff member may see and decide.
 *
 *   null  - unrestricted: Admin, and staff in a city department that is not tied to a barangay.
 *   int   - a barangay secretariat: only requests whose barangay_id is that barangay.
 */
function barangay_scope(array $user): ?int
{
    if ($user['role'] === 'admin' || empty($user['department_id'])) {
        return null;
    }
    $s = db()->prepare('SELECT barangay_id FROM departments WHERE id = ?');
    $s->execute([(int)$user['department_id']]);
    $bid = $s->fetchColumn();
    return ($bid === false || $bid === null) ? null : (int)$bid;
}

/** Whether a request with this barangay_id falls inside the scope. A request with no barangay is
 *  visible only when the scope is unrestricted. */
function in_barangay_scope(?int $scope, $barangayId): bool
{
    if ($scope === null) {
        return true;
    }
    return $barangayId !== null && (int)$barangayId === $scope;
}

function audit(?int $actorId, string $action, string $subjectType, int $subjectId, ?string $details = null): void
{
    db()->prepare('INSERT INTO audit_log (actor_id, action, subject_type, subject_id, details) VALUES (?, ?, ?, ?, ?)')
        ->execute([$actorId, $action, $subjectType, $subjectId, $details !== null ? mb_substr($details, 0, 500) : null]);
}

/** Tells a user about a decision by email if verified, otherwise SMS. Never blocks the decision itself. */
function notify_user(int $userId, string $subject, string $message): void
{
    $stmt = db()->prepare('SELECT email, phone, email_verified_at, phone_verified_at FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) {
        return;
    }
    try {
        if (!empty($user['email']) && !empty($user['email_verified_at'])) {
            send_email($user['email'], $subject, $message . "\n\n— " . app_config()['municipality']);
        } elseif (!empty($user['phone']) && !empty($user['phone_verified_at'])) {
            send_sms($user['phone'], "PermitTrack: $message");
        }
    } catch (Throwable $e) {
        error_log('Notification failed: ' . $e->getMessage());
    }
}

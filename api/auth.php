<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/verification.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/** Adds an account to this browser session's "signed-in accounts" list (for Switch account). */
function remember_account(int $id): void
{
    $_SESSION['accounts'] = ($_SESSION['accounts'] ?? []) + [$id => true];
}

/** The account waiting for its email/phone code (signed up or logged in, not yet verified). */
function pending_user(): array
{
    if (empty($_SESSION['pending_user_id'])) {
        fail('Your verification session expired. Please log in again.', 401);
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['pending_user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        fail('Account not found.', 404);
    }
    return $user;
}

/** Sends a code to whichever contact the account signed up with (email first). */
function start_verification(array $user, bool $isResend = false): array
{
    $_SESSION['pending_user_id'] = (int)$user['id'];
    unset($_SESSION['user_id']);
    return !empty($user['email'])
        ? issue_verification_code((int)$user['id'], 'email', $user['email'], $isResend)
        : issue_verification_code((int)$user['id'], 'sms', $user['phone'], $isResend);
}

// Normal User sign-up. The account is created unverified; the user is signed in after entering the code.
if ($action === 'register' && $method === 'POST') {
    $in = json_input();
    $str = fn(string $key) => trim((string)($in[$key] ?? ''));

    $first = $str('first_name');
    $middle = $str('middle_name');
    $last = $str('last_name');
    $birthdate = $str('birthdate');
    $contactMethod = $str('contact_method') === 'phone' ? 'phone' : 'email';
    $email = strtolower($str('email'));
    $phoneRaw = $str('phone');
    $addressLine = $str('address_line');
    $barangay = $str('barangay');
    $city = $str('city');
    $postal = $str('postal_code');
    $password = (string)($in['password'] ?? '');
    $consent = (bool)($in['privacy_consent'] ?? false);

    if ($first === '' || $last === '') {
        fail('First and last name are required.');
    }
    $dob = DateTime::createFromFormat('Y-m-d', $birthdate);
    if (!$dob || $dob->format('Y-m-d') !== $birthdate) {
        fail('Please enter a valid date of birth.');
    }
    if ($dob->diff(new DateTime('today'))->y < 18) {
        fail('You must be at least 18 years old to create an account.');
    }

    $phone = null;
    if ($contactMethod === 'email') {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Please enter a valid email address.');
        }
    } else {
        $phone = normalize_ph_mobile($phoneRaw);
        if (!$phone) {
            fail('Please enter a valid mobile number, e.g. 0917 123 4567.');
        }
        $email = null;
    }

    if ($addressLine === '' || $barangay === '' || $city === '') {
        fail('House/street, barangay and city are required.');
    }
    if (!preg_match('/^\d{4}$/', $postal)) {
        fail('Postal / ZIP code must be 4 digits.');
    }
    if (strlen($password) < 8 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
        fail('Password must be at least 8 characters and include a letter and a number.');
    }
    if (!$consent) {
        fail('Please agree to the Data Privacy notice to continue.');
    }

    $dupe = db()->prepare('SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)');
    $dupe->execute([$email, $phone]);
    if ($dupe->fetch()) {
        fail($email ? 'An account with that email already exists. Please log in instead.' : 'An account with that mobile number already exists. Please log in instead.');
    }

    $fullName = trim(preg_replace('/\s+/', ' ', "$first $middle $last"));
    db()->prepare(
        'INSERT INTO users (role, account_type, email, phone, password_hash, full_name, first_name, middle_name, last_name, birthdate,
                            address_line, barangay, city, postal_code, privacy_consent_at, onboarding_completed)
         VALUES (\'applicant\', \'unregistered\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)'
    )->execute([
        $email, $phone, password_hash($password, PASSWORD_BCRYPT), $fullName, $first, $middle ?: null, $last, $birthdate,
        $addressLine, $barangay, $city, $postal,
    ]);

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([(int)db()->lastInsertId()]);
    respond(['verification' => start_verification($stmt->fetch())], 201);
}

// Log in with an email address or mobile number
if ($action === 'login' && $method === 'POST') {
    $in = json_input();
    $identifier = trim((string)($in['identifier'] ?? $in['email'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $asStaff = (bool)($in['as_staff'] ?? false);

    $phone = str_contains($identifier, '@') ? null : normalize_ph_mobile($identifier);
    $stmt = $phone
        ? db()->prepare('SELECT * FROM users WHERE phone = ?')
        : db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$phone ?? strtolower($identifier)]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Invalid email/mobile number or password.', 401);
    }
    if (!(int)$user['is_active']) {
        fail('This account has been deactivated. Please contact the city office.', 403);
    }
    $isStaff = in_array($user['role'], ['staff', 'admin'], true);
    if ($asStaff && !$isStaff) {
        fail('This account is not a City Staff account.', 403);
    }
    if (!$asStaff && $isStaff) {
        fail('This is a City Staff account. Please sign in on the Staff Portal page.', 403);
    }

    if (!$isStaff && empty($user['email_verified_at']) && empty($user['phone_verified_at'])) {
        respond(['needs_verification' => true, 'verification' => start_verification($user)], 202);
    }

    unset($_SESSION['pending_user_id']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
    remember_account((int)$user['id']);
    respond(['user' => current_user()]);
}

// Enter the code sent after sign-up / login
if ($action === 'verify' && $method === 'POST') {
    $user = pending_user();
    $channel = !empty($user['email']) ? 'email' : 'sms';
    $code = preg_replace('/\D+/', '', (string)(json_input()['code'] ?? ''));
    if (strlen($code) !== 6) {
        fail('Please enter the 6-digit code.');
    }
    $error = check_verification_code((int)$user['id'], $channel, $code);
    if ($error) {
        fail($error, 422);
    }
    unset($_SESSION['pending_user_id']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
    remember_account((int)$user['id']);
    respond(['user' => current_user()]);
}

if ($action === 'resend' && $method === 'POST') {
    respond(['verification' => start_verification(pending_user(), true)]);
}

// Change your own password (required after an Admin sets a temporary one)
if ($action === 'change_password' && $method === 'POST') {
    $user = require_auth();
    $in = json_input();
    $current = (string)($in['current_password'] ?? '');
    $new = (string)($in['new_password'] ?? '');

    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    if (!password_verify($current, (string)$stmt->fetchColumn())) {
        fail('Your current password is incorrect.', 422);
    }
    if (strlen($new) < 8 || !preg_match('/[A-Za-z]/', $new) || !preg_match('/\d/', $new)) {
        fail('New password must be at least 8 characters and include a letter and a number.');
    }
    if ($new === $current) {
        fail('Please choose a password different from your current one.');
    }
    db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
        ->execute([password_hash($new, PASSWORD_BCRYPT), $user['id']]);
    session_regenerate_id(true);
    respond(['user' => current_user()]);
}

// Accounts signed in on this browser session, for the "Switch account" menu
if ($action === 'accounts' && $method === 'GET') {
    $current = current_user();
    if (!$current) {
        respond(['accounts' => []]);
    }
    remember_account((int)$current['id']); // the current account always counts as signed in
    $ids = array_keys($_SESSION['accounts']);
    $stmt = db()->prepare(
        'SELECT id, role, full_name, email, phone FROM users WHERE is_active = 1 AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')'
    );
    $stmt->execute($ids);
    $accounts = array_map(fn($u) => [
        'id' => (int)$u['id'],
        'full_name' => $u['full_name'],
        'contact' => $u['email'] ?: $u['phone'],
        'role' => $u['role'],
        'current' => (int)$u['id'] === (int)$current['id'],
    ], $stmt->fetchAll());
    respond(['accounts' => $accounts]);
}

// Switch to another account that already signed in with its password in this session
if ($action === 'switch' && $method === 'POST') {
    $id = (int)(json_input()['id'] ?? 0);
    if (!isset($_SESSION['accounts'][$id])) {
        fail('Please sign in to that account first.', 403);
    }
    $stmt = db()->prepare('SELECT id, is_active FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || !(int)$row['is_active']) {
        unset($_SESSION['accounts'][$id]);
        fail('That account is no longer available. Please sign in again.', 403);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    respond(['user' => current_user()]);
}

// Signs out the current account; if other accounts are signed in on this browser, switches to one of them
if ($action === 'logout' && $method === 'POST') {
    $currentId = (int)($_SESSION['user_id'] ?? 0);
    unset($_SESSION['accounts'][$currentId]);
    $all = (bool)(json_input()['all'] ?? false);
    $remaining = $all ? [] : array_keys($_SESSION['accounts'] ?? []);
    foreach ($remaining as $id) {
        $stmt = db()->prepare('SELECT is_active FROM users WHERE id = ?');
        $stmt->execute([$id]);
        if ((int)$stmt->fetchColumn()) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$id;
            respond(['ok' => true, 'user' => current_user()]);
        }
        unset($_SESSION['accounts'][$id]);
    }
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true, 'user' => null]);
}

if ($action === 'me' && $method === 'GET') {
    respond(['user' => current_user()]);
}

fail('Unknown action.', 404);

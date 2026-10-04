<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/psgc.php';
require_once __DIR__ . '/lib/support.php';   // find_barangay()
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

/** The sign-up waiting for its code. Nothing is written to `users` until it's confirmed. */
function pending_registration(): array
{
    if (empty($_SESSION['pending_registration'])) {
        fail('Your registration session expired. Please sign up again.', 401);
    }
    return $_SESSION['pending_registration'];
}

/**
 * Generates a code, holds the not-yet-created account in the session, and sends it.
 * If sending fails, nothing is kept — no row is written, so the user can just try again.
 */
function start_registration_verification(array $data, string $channel, string $destination, bool $isResend = false): array
{
    $existing = $_SESSION['pending_registration'] ?? null;
    if ($isResend) {
        if (!$existing) {
            fail('Your registration session expired. Please sign up again.', 401);
        }
        $age = time() - $existing['sent_at'];
        if ($age < CODE_RESEND_SECONDS) {
            fail('Please wait ' . (CODE_RESEND_SECONDS - $age) . ' seconds before requesting another code.', 429);
        }
    }

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $_SESSION['pending_registration'] = [
        'data' => $data,
        'channel' => $channel,
        'destination' => $destination,
        'code_hash' => password_hash($code, PASSWORD_DEFAULT),
        'expires_at' => time() + CODE_TTL_MINUTES * 60,
        'attempts' => 0,
        'sent_at' => time(),
    ];
    unset($_SESSION['user_id'], $_SESSION['pending_user_id']);

    $municipality = app_config()['municipality'];
    try {
        if ($channel === 'email') {
            send_email(
                $destination,
                'Your PermitTrack verification code',
                "Your PermitTrack verification code is $code.\n\nIt expires in " . CODE_TTL_MINUTES . " minutes. If you didn't request this, you can ignore this email.\n\n— $municipality"
            );
        } else {
            send_sms($destination, "PermitTrack code: $code. Expires in " . CODE_TTL_MINUTES . " min. Do not share this code.");
        }
    } catch (Throwable $e) {
        unset($_SESSION['pending_registration']);
        error_log('Registration verification send failed: ' . $e->getMessage());
        fail($channel === 'email'
            ? "We couldn't send the email right now. Please try again in a moment."
            : "We couldn't send the text message right now. Please try again in a moment.", 502);
    }

    $result = [
        'channel' => $channel,
        'sent_to' => mask_destination($channel, $destination),
        'expires_in_minutes' => CODE_TTL_MINUTES,
        'resend_after_seconds' => CODE_RESEND_SECONDS,
    ];
    $driver = app_config()[$channel === 'email' ? 'mail' : 'sms']['driver'] ?? 'log';
    if ($driver === 'log') {
        $result['dev_code'] = $code;
    }
    return $result;
}

// Normal User sign-up. Nothing is written to the database until the code is confirmed
// (see the 'verify' action below) — a failed or abandoned sign-up leaves no trace.
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
    $provinceCode = $str('province_code');
    $cityCode = $str('city_code');
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
    $age = $dob->diff(new DateTime('today'))->y;
    if ($age < 18) {
        fail('You must be at least 18 years old to create an account.');
    }
    if ($age > 80) {
        fail('Please enter a valid date of birth (age must be 80 or below).');
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

    if ($addressLine === '') {
        fail('House / street is required.');
    }
    // Province and city are picked from the PSGC list, and the pair is re-checked here — a form can
    // be tampered with, and whether an account is in this city decides what it may file.
    if ($provinceCode === '' || $cityCode === '') {
        fail('Please choose your province and city or municipality.');
    }
    if (!psgc_is_valid_pair($provinceCode, $cityCode)) {
        fail('That city or municipality is not in the province you chose.');
    }
    $province = psgc_name(psgc_provinces(), $provinceCode);
    $city = psgc_name(psgc_cities($provinceCode), $cityCode);
    if ($province === null || $city === null) {
        fail('Please choose your province and city or municipality.');
    }

    // Barangay is only collected inside the city this system serves. Elsewhere there is no barangay
    // office to route to, so it is left out rather than stored as unverifiable free text.
    $barangayId = null;
    if (psgc_is_home_city($cityCode)) {
        if ($barangay === '') {
            fail('Please choose your barangay.');
        }
        $matched = find_barangay($barangay);
        if (!$matched) {
            fail('Please choose your barangay from the list.');
        }
        $barangay = $matched['name'];
        $barangayId = (int)$matched['id'];
    } else {
        $barangay = '';
    }
    if (!preg_match('/^\d{4}$/', $postal)) {
        fail('Postal / ZIP code must be 4 digits.');
    }
    if (!is_strong_password($password)) {
        fail('Password must be at least 8 characters and include an uppercase letter, a number, and a special character.');
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
    $data = [
        'email' => $email, 'phone' => $phone, 'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        'full_name' => $fullName, 'first_name' => $first, 'middle_name' => $middle ?: null, 'last_name' => $last,
        'birthdate' => $birthdate, 'address_line' => $addressLine,
        'barangay' => $barangay ?: null, 'barangay_id' => $barangayId,
        'city' => $city, 'city_code' => $cityCode, 'province' => $province, 'province_code' => $provinceCode,
        'postal_code' => $postal,
    ];
    $verifChannel = $contactMethod === 'phone' ? 'sms' : 'email';
    $destination = $contactMethod === 'phone' ? $phone : $email;
    respond(['verification' => start_registration_verification($data, $verifChannel, $destination)]);
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
    $code = preg_replace('/\D+/', '', (string)(json_input()['code'] ?? ''));
    if (strlen($code) !== 6) {
        fail('Please enter the 6-digit code.');
    }

    // Sign-up: the account doesn't exist yet — this is where it finally gets created.
    if (!empty($_SESSION['pending_registration'])) {
        $pending = $_SESSION['pending_registration'];
        if (time() > $pending['expires_at']) {
            unset($_SESSION['pending_registration']);
            fail('This code has expired. Please request a new one.', 422);
        }
        if ($pending['attempts'] >= CODE_MAX_ATTEMPTS) {
            unset($_SESSION['pending_registration']);
            fail('Too many wrong attempts. Please request a new code.', 422);
        }
        if (!password_verify($code, $pending['code_hash'])) {
            $_SESSION['pending_registration']['attempts']++;
            $left = CODE_MAX_ATTEMPTS - $_SESSION['pending_registration']['attempts'];
            fail($left > 0 ? "That code isn't right. $left attempt(s) left." : 'Too many wrong attempts. Please request a new code.', 422);
        }

        $d = $pending['data'];
        $verifiedColumn = $pending['channel'] === 'email' ? 'email_verified_at' : 'phone_verified_at';
        try {
            db()->prepare(
                "INSERT INTO users (role, account_type, email, phone, password_hash, full_name, first_name, middle_name, last_name, birthdate,
                                    address_line, barangay, barangay_id, city, city_code, province, province_code, postal_code,
                                    privacy_consent_at, onboarding_completed, $verifiedColumn)
                 VALUES ('applicant', 'unregistered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, NOW())"
            )->execute([
                $d['email'], $d['phone'], $d['password_hash'], $d['full_name'], $d['first_name'], $d['middle_name'], $d['last_name'], $d['birthdate'],
                $d['address_line'], $d['barangay'] ?? null, $d['barangay_id'] ?? null,
                $d['city'], $d['city_code'] ?? null, $d['province'] ?? null, $d['province_code'] ?? null, $d['postal_code'],
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                unset($_SESSION['pending_registration']);
                fail('That email or mobile number was just used by another account. Please sign up again.', 409);
            }
            throw $e;
        }
        $userId = (int)db()->lastInsertId();

        unset($_SESSION['pending_registration']);
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$userId]);
        remember_account($userId);
        respond(['user' => current_user()], 201);
    }

    // Login: re-verifying an account that already exists.
    $user = pending_user();
    $channel = !empty($user['email']) ? 'email' : 'sms';
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
    if (!empty($_SESSION['pending_registration'])) {
        $pending = $_SESSION['pending_registration'];
        respond(['verification' => start_registration_verification($pending['data'], $pending['channel'], $pending['destination'], true)]);
    }
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
    if (!is_strong_password($new)) {
        fail('New password must be at least 8 characters and include an uppercase letter, a number, and a special character.');
    }
    if ($new === $current) {
        fail('Please choose a password different from your current one.');
    }
    db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
        ->execute([password_hash($new, PASSWORD_BCRYPT), $user['id']]);
    session_regenerate_id(true);
    respond(['user' => current_user()]);
}

/**
 * Accounts signed in on this browser session: the "Switch account" menu while signed in, and
 * the chooser on the Sign in button once you have signed out but others are still in. Signed
 * out with none left, this is empty and the button goes back to being a plain Log in.
 */
if ($action === 'accounts' && $method === 'GET') {
    $current = current_user();
    if ($current) {
        remember_account((int)$current['id']); // the current account always counts as signed in
    }
    $ids = array_values(array_filter(array_map('intval', array_keys($_SESSION['accounts'] ?? []))));
    if (!$ids) {
        respond(['accounts' => []]);
    }
    $stmt = db()->prepare(
        'SELECT id, role, full_name, email, phone FROM users WHERE is_active = 1 AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')'
    );
    $stmt->execute($ids);
    $accounts = array_map(fn($u) => [
        'id' => (int)$u['id'],
        'full_name' => $u['full_name'],
        'contact' => $u['email'] ?: $u['phone'],
        'role' => $u['role'],
        'current' => $current && (int)$u['id'] === (int)$current['id'],
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

// Drops another account from this browser's list. Signing the CURRENT account out is what
// 'logout' does, so this refuses it rather than leaving the session pointing at a forgotten id.
if ($action === 'forget' && $method === 'POST') {
    require_auth();
    $id = (int)(json_input()['id'] ?? 0);
    if ($id === (int)($_SESSION['user_id'] ?? 0)) {
        fail("That's the account you're using. Sign out instead.", 409);
    }
    unset($_SESSION['accounts'][$id]);
    respond(['ok' => true]);
}
/**
 * Signs the current account out and leaves it that way — signing out of one account is not a
 * way of stepping into another, so nobody is signed in when this returns. Any other account
 * that signed in on this browser stays signed in and is offered by the chooser on the Sign in
 * button; once the last one goes, the session goes with it. Pass all = true to sign out every
 * account at once.
 */
if ($action === 'logout' && $method === 'POST') {
    $currentId = (int)($_SESSION['user_id'] ?? 0);
    unset($_SESSION['accounts'][$currentId]);
    if ((bool)(json_input()['all'] ?? false)) {
        $_SESSION['accounts'] = [];
    }
    unset($_SESSION['user_id'], $_SESSION['pending_user_id'], $_SESSION['pending_registration']);

    if (empty($_SESSION['accounts'])) {
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true, 'user' => null]);
    }
    session_regenerate_id(true);
    respond(['ok' => true, 'user' => null]);
}

if ($action === 'me' && $method === 'GET') {
    respond(['user' => current_user()]);
}

fail('Unknown action.', 404);

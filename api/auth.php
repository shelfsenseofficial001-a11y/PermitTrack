<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'register' && $method === 'POST') {
    $in = json_input();
    $email = trim((string)($in['email'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $fullName = trim((string)($in['full_name'] ?? ''));
    $accountType = ($in['account_type'] ?? 'resident') === 'business' ? 'business' : 'resident';
    $role = ($in['role'] ?? 'applicant') === 'staff' ? 'staff' : 'applicant';

    if ($email === '' || $password === '' || $fullName === '') {
        fail('Full name, email and password are required.');
    }
    if (strlen($password) < 6) {
        fail('Password must be at least 6 characters.');
    }

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        fail('An account with that email already exists.');
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = db()->prepare('INSERT INTO users (role, account_type, email, password_hash, full_name) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$role, $accountType, $email, $hash, $fullName]);
    $userId = (int)db()->lastInsertId();

    $_SESSION['user_id'] = $userId;
    respond(['user' => current_user()], 201);
}

if ($action === 'login' && $method === 'POST') {
    $in = json_input();
    $email = trim((string)($in['email'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $asStaff = (bool)($in['as_staff'] ?? false);

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Invalid email or password.', 401);
    }
    if ($asStaff && $user['role'] !== 'staff') {
        fail('This account is not a City Staff account.', 403);
    }
    if (!$asStaff && $user['role'] !== 'applicant') {
        fail('Please use the City Staff login tab for this account.', 403);
    }

    $_SESSION['user_id'] = (int)$user['id'];
    respond(['user' => current_user()]);
}

if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);
}

if ($action === 'me' && $method === 'GET') {
    $user = current_user();
    if (!$user) {
        respond(['user' => null]);
    }
    if ($user['role'] === 'applicant') {
        $stmt = db()->prepare('SELECT business_name, ein, phone, address FROM business_profiles WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $user['business_profile'] = $stmt->fetch() ?: null;
    }
    respond(['user' => $user]);
}

fail('Unknown action.', 404);

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$user = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $in = json_input();
    $skip = (bool)($in['skip'] ?? false);

    if (!$skip) {
        $businessName = trim((string)($in['business_name'] ?? ''));
        $ein = trim((string)($in['ein'] ?? ''));
        $phone = trim((string)($in['phone'] ?? ''));
        $address = trim((string)($in['address'] ?? ''));

        if ($businessName === '' || $ein === '' || $phone === '' || $address === '') {
            fail('All business fields are required, or use "Skip — I\'m applying as an individual".');
        }

        $stmt = db()->prepare(
            'INSERT INTO business_profiles (user_id, business_name, ein, phone, address) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE business_name = VALUES(business_name), ein = VALUES(ein), phone = VALUES(phone), address = VALUES(address)'
        );
        $stmt->execute([$user['id'], $businessName, $ein, $phone, $address]);
    }

    $stmt = db()->prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?');
    $stmt->execute([$user['id']]);

    respond(['user' => current_user()]);
}

fail('Unknown action.', 404);

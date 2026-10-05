<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function assert_can_view_application(int $appId, array $user): array
{
    $stmt = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$appId]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }
    if ($user['role'] === 'applicant' && (int)$app['applicant_id'] !== (int)$user['id']) {
        fail('Forbidden', 403);
    }
    return $app;
}

if ($action === 'list' && $method === 'GET') {
    $user = require_auth();
    $appId = (int)($_GET['application_id'] ?? 0);
    assert_can_view_application($appId, $user);

    $stmt = db()->prepare(
        'SELECT act.*, u.full_name AS sender_name, u.role AS sender_role
         FROM application_activity act LEFT JOIN users u ON u.id = act.sender_id
         WHERE act.application_id = ? ORDER BY act.created_at ASC'
    );
    $stmt->execute([$appId]);
    respond(['activity' => $stmt->fetchAll()]);
}

if ($action === 'send' && $method === 'POST') {
    $user = require_auth();
    $in = json_input();
    $appId = (int)($in['application_id'] ?? 0);
    $body = trim((string)($in['message'] ?? ''));

    assert_can_view_application($appId, $user);
    if ($body === '') {
        fail('Message cannot be empty.');
    }

    $stmt = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'message', 'message', ?)");
    $stmt->execute([$appId, $user['id'], $body]);

    respond(['ok' => true], 201);
}

fail('Unknown action.', 404);

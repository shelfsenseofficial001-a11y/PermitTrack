<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/threads.php';

// An application's timeline. Its messages are also its thread in Messages (api/conversations.php),
// which is where the app reads and writes them now; this stays for anything still calling it.

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
         WHERE act.application_id = ? ORDER BY act.id ASC'
    );
    $stmt->execute([$appId]);
    respond(['activity' => $stmt->fetchAll()]);
}

if ($action === 'send' && $method === 'POST') {
    $user = require_auth();
    $in = json_input();
    $appId = (int)($in['application_id'] ?? 0);
    $body = trim((string)($in['message'] ?? ''));

    if ($body === '') {
        fail('Message cannot be empty.');
    }

    $app = assert_can_view_application($appId, $user);
    post_application_message($appId, (int)$app['applicant_id'], (int)$user['id'], $body);

    respond(['ok' => true], 201);
}

fail('Unknown action.', 404);

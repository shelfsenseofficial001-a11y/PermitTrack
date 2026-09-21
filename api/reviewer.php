<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'queue' && $method === 'GET') {
    require_role('staff');
    $tab = (string)($_GET['tab'] ?? 'new');

    $where = "a.status NOT IN ('Approved','Rejected')";
    if ($tab === 'new') {
        $where .= " AND a.status = 'Submitted'";
    } elseif ($tab === 'awaiting_applicant') {
        $where .= " AND EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')";
    } else { // in_progress
        $where .= " AND a.status IN ('Under Review','Inspection Scheduled','Inspector Notes')
                     AND NOT EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')";
    }

    $sql = "SELECT a.*, u.full_name AS applicant_name, DATEDIFF(NOW(), a.created_at) AS days_in_queue
            FROM applications a JOIN users u ON u.id = a.applicant_id
            WHERE $where ORDER BY a.created_at ASC";
    $rows = db()->query($sql)->fetchAll();

    respond(['applications' => $rows]);
}

if ($action === 'counts' && $method === 'GET') {
    require_role('staff');
    $pdo = db();

    $new = $pdo->query("SELECT COUNT(*) c FROM applications WHERE status = 'Submitted'")->fetch()['c'];
    $awaiting = $pdo->query(
        "SELECT COUNT(*) c FROM applications a WHERE a.status NOT IN ('Approved','Rejected')
         AND EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')"
    )->fetch()['c'];
    $inProgress = $pdo->query(
        "SELECT COUNT(*) c FROM applications a WHERE a.status IN ('Under Review','Inspection Scheduled','Inspector Notes')
         AND NOT EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')"
    )->fetch()['c'];

    respond(['new' => (int)$new, 'in_progress' => (int)$inProgress, 'awaiting_applicant' => (int)$awaiting]);
}

if ($action === 'decision' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $appId = (int)($in['application_id'] ?? 0);
    $status = (string)($in['status'] ?? '');
    $notes = trim((string)($in['notes'] ?? ''));

    $validStatuses = ['Submitted', 'Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved', 'Rejected'];
    if (!in_array($status, $validStatuses, true)) {
        fail('Invalid status.');
    }

    $stmt = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$appId]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }

    $pdo = db();
    $pdo->beginTransaction();

    $update = $pdo->prepare('UPDATE applications SET status = ?, assigned_reviewer_id = COALESCE(assigned_reviewer_id, ?) WHERE id = ?');
    $update->execute([$status, $user['id'], $appId]);

    $activity = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'status_change', ?)");
    $activity->execute([$appId, $user['id'], 'Status updated to "' . $status . '" by ' . $user['full_name'] . '.']);

    if ($notes !== '') {
        $note = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'message', ?)");
        $note->execute([$appId, $user['id'], $notes]);
    }

    $pdo->commit();

    respond(['ok' => true]);
}

fail('Unknown action.', 404);

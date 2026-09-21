<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'reupload' && $method === 'POST') {
    $user = require_role('applicant');
    $docId = (int)($_POST['document_id'] ?? 0);

    $stmt = db()->prepare('SELECT d.*, a.applicant_id, a.id AS app_id FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
    if (!$doc || (int)$doc['applicant_id'] !== (int)$user['id']) {
        fail('Document not found.', 404);
    }
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        fail('Please choose a file to upload.');
    }

    $uploadDir = __DIR__ . '/../uploads/' . $doc['app_id'];
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $originalName = basename($_FILES['file']['name']);
    $safeName = uniqid('doc_', true) . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName);
    $dest = $uploadDir . '/' . $safeName;
    move_uploaded_file($_FILES['file']['tmp_name'], $dest);
    $filePath = 'uploads/' . $doc['app_id'] . '/' . $safeName;

    $update = db()->prepare("UPDATE application_documents SET file_path = ?, original_filename = ?, status = 'Pending Review', uploaded_at = ? WHERE id = ?");
    $update->execute([$filePath, $originalName, date('Y-m-d H:i:s'), $docId]);

    $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'status_change', ?)");
    $activity->execute([$doc['app_id'], $user['id'], 'Re-uploaded document: ' . $doc['doc_name']]);

    respond(['ok' => true]);
}

if ($action === 'review' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $docId = (int)($in['document_id'] ?? 0);
    $status = (string)($in['status'] ?? '');

    if (!in_array($status, ['Verified', 'Needs Re-upload'], true)) {
        fail('Invalid status.');
    }

    $stmt = db()->prepare('SELECT * FROM application_documents WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
    if (!$doc) {
        fail('Document not found.', 404);
    }

    $update = db()->prepare('UPDATE application_documents SET status = ? WHERE id = ?');
    $update->execute([$status, $docId]);

    $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'status_change', ?)");
    $activity->execute([$doc['application_id'], $user['id'], $doc['doc_name'] . ' marked as ' . $status . '.']);

    respond(['ok' => true]);
}

if ($action === 'download' && $method === 'GET') {
    $user = require_auth();
    $docId = (int)($_GET['id'] ?? 0);

    $stmt = db()->prepare('SELECT d.*, a.applicant_id FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
    if (!$doc || !$doc['file_path']) {
        fail('File not found.', 404);
    }
    if ($user['role'] === 'applicant' && (int)$doc['applicant_id'] !== (int)$user['id']) {
        fail('Forbidden', 403);
    }

    $fullPath = __DIR__ . '/../' . $doc['file_path'];
    if (!is_file($fullPath)) {
        fail('File not found.', 404);
    }

    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . basename($doc['original_filename'] ?? $doc['file_path']) . '"');
    header('Content-Length: ' . filesize($fullPath));
    readfile($fullPath);
    exit;
}

fail('Unknown action.', 404);

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

/**
 * Which department holds this office for this application, read from the route the application was
 * given at submission. That snapshot is the only place the applicant's barangay is recorded, and it
 * is what the reviewer queue matches on, so the document check reads the same source.
 * Returns null when the application predates the pipeline.
 */
function document_owner_department(int $applicationId, string $officeCode): ?array
{
    $s = db()->prepare(
        "SELECT d.id, d.name FROM application_pipeline_progress p
           JOIN departments d ON d.id = p.department_id
          WHERE p.application_id = ?
            AND (CASE WHEN d.barangay_id IS NOT NULL THEN 'BARANGAY' ELSE d.code END) = ?
          LIMIT 1"
    );
    $s->execute([$applicationId, $officeCode]);
    $row = $s->fetch();
    return $row ?: null;
}

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
    if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_INI_SIZE) {
        fail('That file is too large to upload.');
    }
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        fail('Please choose a file to upload.');
    }
    // Same ceiling as filing a new application — see MAX_UPLOAD_BYTES in applications.php
    if ((int)$_FILES['file']['size'] > 5 * 1024 * 1024) {
        fail('That file is larger than the 5 MB limit. Please choose a smaller file.');
    }
    if ($typeError = upload_type_error($_FILES['file'])) {
        fail($typeError);
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

    // Only the office that owns this document may pass judgement on it. Before this check any
    // staff account could decide any document, and because the barangay holds the first node of
    // nearly every permit, the Barangay Secretary was in practice ruling on structural drawings
    // and health cards. The barangay confirms the applicant and the details, then forwards; the
    // owning office decides its own paperwork. Admins stay exempt so a stuck permit can be freed.
    if ($user['role'] !== 'admin') {
        $owner = $doc['office_code'] ?: 'BARANGAY';
        $ownerDept = document_owner_department((int)$doc['application_id'], $owner);
        // No route rows means a pre-pipeline application; those keep the old open behaviour.
        if ($ownerDept !== null && (int)$ownerDept['id'] !== (int)($user['department_id'] ?? 0)) {
            fail('This document is reviewed by ' . $ownerDept['name'] . ', not your office.', 403);
        }
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

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/pipeline.php';   // document_owner_department(), document_owner_step()

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
    // A verified document has already been signed off by an office. Swapping the file would
    // silently reset that approval, so only the office that asked for it can reopen it.
    if ($doc['status'] === 'Verified') {
        fail('This document has already been verified. Message your reviewer if it needs to change.', 409);
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

    // A fresh file answers whatever the old one was sent back for, so the reason goes with it.
    $update = db()->prepare("UPDATE application_documents SET file_path = ?, original_filename = ?, status = 'Pending Review', uploaded_at = ?,
                                    reject_reason = NULL, reject_notes = NULL, rejected_by = NULL, rejected_at = NULL WHERE id = ?");
    $update->execute([$filePath, $originalName, date('Y-m-d H:i:s'), $docId]);

    $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'reuploaded', ?)");
    $activity->execute([$doc['app_id'], $user['id'], 'Re-uploaded document: ' . $doc['doc_name']]);

    respond(['ok' => true]);
}

if ($action === 'review' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $docId = (int)($in['document_id'] ?? 0);
    // The caller says what it means, not what to write: the same Approve button is an intake pass
    // for the barangay and a full approval for the office that owns the document, and which one it
    // is depends on where the permit is. That is the server's call, not the browser's.
    $decision = (string)($in['decision'] ?? '');
    if (!in_array($decision, ['approve', 'reject', 'undo'], true)) {
        fail('Invalid decision.');
    }

    $reason = null;
    $notes = null;

    $stmt = db()->prepare('SELECT * FROM application_documents WHERE id = ?');
    $stmt->execute([$docId]);
    $doc = $stmt->fetch();
    if (!$doc) {
        fail('Document not found.', 404);
    }

    // A document is checked twice. The barangay holds step one and opens every file: its pass is an
    // intake check — present, readable, actually the document it claims to be — and only then does
    // the permit, and its paperwork, go on to the city offices. The office that owns a document then
    // makes the real decision on what it says. Neither office can act out of turn: before the permit
    // reaches you there is nothing for you to decide, and once you have signed your step off the
    // permit has moved past it. Admins are exempt throughout so a stuck permit can be freed.
    // No route rows means a pre-pipeline application; those keep the old open behaviour.
    $appId = (int)$doc['application_id'];
    $owner = $doc['office_code'] ?: 'BARANGAY';
    $ownerDept = document_owner_department($appId, $owner);
    $current = current_pipeline_step($appId);
    $deptId = (int)($user['department_id'] ?? 0);

    $isOwner = $ownerDept === null || (int)$ownerDept['id'] === $deptId;
    $holdsStep = $current !== null && (int)$current['department_id'] === $deptId;
    $isIntake = $holdsStep && $current['office_code'] === 'BARANGAY';

    // 'owner' writes the final decision, 'intake' writes the barangay's pass. An office that both
    // holds the step and owns the document — the barangay with its own clearance — decides outright
    // rather than passing paperwork to itself.
    $stage = null;
    if ($user['role'] === 'admin') {
        $stage = 'owner';
    } elseif ($isOwner && $holdsStep) {
        $stage = 'owner';
    } elseif ($isIntake) {
        $stage = 'intake';
    }

    if ($stage === null) {
        if ($ownerDept !== null && !$isOwner) {
            fail('This document is reviewed by ' . $ownerDept['name'] . ', not your office.', 403);
        }
        fail('This application is not currently with your office, so its documents cannot be changed.', 403);
    }

    // Only once we know this reviewer may act at all: a rejection has to say why, because the
    // reason is the only thing the applicant gets to act on. Checked after the permission rules
    // above so someone with no business here is told that, not asked to fill in a form.
    if ($decision === 'reject') {
        $reason = (string)($in['reason'] ?? '');
        $notes = trim((string)($in['notes'] ?? ''));
        if (!isset(DOCUMENT_REJECT_REASONS[$reason])) {
            fail('Please choose a reason for sending this document back.');
        }
        if ($reason === 'other' && $notes === '') {
            fail('Please say what is wrong with the document.');
        }
        if (mb_strlen($notes) > 500) {
            fail('Please keep the note under 500 characters.');
        }
        $notes = $notes === '' ? null : $notes;
    }

    if ($stage === 'intake' && $decision === 'approve' && $doc['status'] === 'Needs Re-upload') {
        fail('This document is waiting for the applicant to upload it again.', 409);
    }
    if ($stage === 'owner' && $decision === 'approve'
        && in_array($doc['status'], ['Missing', 'Needs Re-upload'], true)) {
        fail('This document has not been submitted yet.', 409);
    }

    // Undo steps back one stage rather than all the way: an office taking back its approval leaves
    // the barangay's intake pass standing, because that pass still happened.
    if ($decision === 'approve') {
        $status = $stage === 'intake' ? 'Intake Approved' : 'Verified';
    } elseif ($decision === 'reject') {
        $status = 'Needs Re-upload';
    } else {
        $status = ($stage === 'owner' && !empty($doc['intake_at'])) ? 'Intake Approved' : 'Pending Review';
    }

    // The reason lives only as long as the rejection does: approving it, undoing the rejection or
    // the applicant re-uploading all clear it, so a document never carries a reason it no longer has.
    if ($decision === 'reject') {
        $sql = 'UPDATE application_documents SET status = ?, reject_reason = ?, reject_notes = ?, rejected_by = ?, rejected_at = NOW()';
        $args = [$status, $reason, $notes, $user['id']];
    } else {
        $sql = 'UPDATE application_documents SET status = ?, reject_reason = NULL, reject_notes = NULL, rejected_by = NULL, rejected_at = NULL';
        $args = [$status];
    }
    if ($stage === 'intake') {
        $sql .= $decision === 'undo' ? ', intake_by = NULL, intake_at = NULL' : ', intake_by = ?, intake_at = NOW()';
        if ($decision !== 'undo') {
            $args[] = $user['id'];
        }
    }
    $args[] = $docId;
    db()->prepare($sql . ' WHERE id = ?')->execute($args);

    // The feed still gets a line, now carrying the reason — it is the permit's running record.
    // The event is stored beside it so the bell never has to read the sentence to know what
    // happened; rewording this text is then safe, which it previously was not.
    if ($decision === 'reject') {
        $event = 'doc_rejected';
        $what = 'sent back: ' . DOCUMENT_REJECT_REASONS[$reason] . ($notes !== null ? ' — ' . $notes : '');
    } elseif ($stage === 'intake' && $decision === 'approve') {
        $event = 'doc_intake';
        $what = 'passed intake';
    } elseif ($decision === 'approve') {
        $event = 'doc_verified';
        $what = 'marked as ' . $status;
    } else {
        $event = 'doc_undone';
        $what = 'set back to ' . $status;
    }
    $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', ?, ?)");
    $activity->execute([$doc['application_id'], $user['id'], $event, $doc['doc_name'] . ' ' . $what . '.']);

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
    // The file itself is gated the same way the application is: an office downloads an applicant's
    // documents once the permit reaches it. Otherwise this URL is a way around that rule.
    if ($user['role'] !== 'applicant' && !staff_can_access_application($user, (int)$doc['application_id'])) {
        fail('This application has not reached your office yet.', 403);
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

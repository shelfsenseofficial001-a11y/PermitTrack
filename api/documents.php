<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/pipeline.php';   // document_owner_department(), document_owner_step()
require_once __DIR__ . '/lib/support.php';  // send_file_viewer(), BROWSER_VIEWABLE_MIME

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

    // Keep the superseded file for the record (migration 038) before overwriting it — every prior
    // version stays visible to staff and applicant alike, newest marked current.
    if (!empty($doc['file_path'])) {
        archive_document_version($doc);
    }
    $nextVersion = (int)$doc['version'] + 1;

    // A fresh file answers whatever the old one was sent back for, so the reason goes with it.
    // The view-before-deciding gate (migration 038) re-arms automatically: it is keyed by
    // (document, version), and this is a new version no one has opened yet.
    $update = db()->prepare("UPDATE application_documents SET file_path = ?, original_filename = ?, status = 'Pending Review', uploaded_at = ?, version = ?,
                                    reject_reason = NULL, reject_notes = NULL, decision_type = NULL, rejected_by = NULL, rejected_at = NULL, pre_reject_status = NULL WHERE id = ?");
    $update->execute([$filePath, $originalName, date('Y-m-d H:i:s'), $nextVersion, $docId]);

    $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'reuploaded', ?)");
    $activity->execute([$doc['app_id'], $user['id'], 'Re-uploaded document: ' . $doc['doc_name'] . ' (version ' . $nextVersion . ')']);

    // Every office whose node already passed hears about it — they signed off before this change
    // existed, per BREAKING_CHANGES-style transparency around the pipeline.
    notify_passed_departments_of_revision((int)$doc['app_id'], (string)$doc['doc_name']);

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
    if (!in_array($decision, ['approve', 'reject', 'revise', 'undo'], true)) {
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

    // View-before-deciding (migration 038): Approve, Reject and Revise all require that this
    // staff member has opened AND downloaded this exact file at its current version first. The
    // disabled button on the frontend is only a courtesy — this is what actually stops it.
    if (in_array($decision, ['approve', 'reject', 'revise'], true)
        && !document_access_satisfied($docId, (int)$doc['version'], (int)$user['id'])) {
        fail('Please open and download this file before deciding on it.', 409);
    }

    // Reject and Revise both send the file back and both require a reason — mockup 3's picker
    // serves either. They differ only in decision_type, which the UI uses to say which one it was.
    $sendBack = in_array($decision, ['reject', 'revise'], true);

    // Only once we know this reviewer may act at all: sending a document back has to say why,
    // because the reason is the only thing the applicant gets to act on. Checked after the
    // permission rules above so someone with no business here is told that, not asked to fill a form.
    if ($sendBack) {
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

    // Undo puts a document back exactly where it was before the decision being undone. Undoing an
    // approval steps back one stage, since the barangay's intake pass still happened. Undoing a
    // rejection restores whatever status the document held the moment it was rejected — Verified
    // included — so un-rejecting an approved document approves it again instead of sending it
    // through approval once more.
    if ($decision === 'approve') {
        $status = $stage === 'intake' ? 'Intake Approved' : 'Verified';
    } elseif ($sendBack) {
        $status = 'Needs Re-upload';
    } elseif ($doc['status'] === 'Needs Re-upload' && $doc['pre_reject_status']) {
        $status = $doc['pre_reject_status'];
    } else {
        $status = ($stage === 'owner' && !empty($doc['intake_at'])) ? 'Intake Approved' : 'Pending Review';
    }

    // The reason lives only as long as the rejection/revision does: approving it, undoing it or
    // the applicant re-uploading all clear it, so a document never carries a reason it no longer has.
    if ($sendBack) {
        $sql = 'UPDATE application_documents SET status = ?, reject_reason = ?, reject_notes = ?, decision_type = ?, rejected_by = ?, rejected_at = NOW(), pre_reject_status = ?';
        $args = [$status, $reason, $notes, $decision === 'revise' ? 'revision' : 'rejected', $user['id'], $doc['status']];
    } else {
        $sql = 'UPDATE application_documents SET status = ?, reject_reason = NULL, reject_notes = NULL, decision_type = NULL, rejected_by = NULL, rejected_at = NULL, pre_reject_status = NULL';
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

    // Documents belonging to the office whose turn it currently is: a reject/revise here freezes
    // the whole node — it stays frozen until the applicant uploads a new version and this same
    // office approves it (maybe_unfreeze_after_approval, called below on the matching approve).
    if ($stage === 'owner') {
        if ($sendBack) {
            freeze_current_node(
                $appId, (int)$user['id'], 'revision',
                ($decision === 'revise' ? 'Revision requested' : 'Rejected') . ' on "' . $doc['doc_name'] . '": '
                    . DOCUMENT_REJECT_REASONS[$reason] . ($notes !== null ? ' — ' . $notes : '')
            );
        } elseif ($decision === 'approve') {
            maybe_unfreeze_after_approval($appId, $owner);
        }
    }

    // The feed still gets a line, now carrying the reason — it is the permit's running record.
    // The event is stored beside it so the bell never has to read the sentence to know what
    // happened; rewording this text is then safe, which it previously was not.
    if ($sendBack) {
        $event = $decision === 'revise' ? 'doc_revision' : 'doc_rejected';
        $what = ($decision === 'revise' ? 'sent back for revision: ' : 'sent back: ') . DOCUMENT_REJECT_REASONS[$reason] . ($notes !== null ? ' — ' . $notes : '');
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

    // View-before-deciding (migration 038): staff opening or downloading a document — at its
    // current version — is what the gate in documents.php?action=review and
    // reviewer.php?action=pipeline_decision actually checks. Applicants aren't gated by anything,
    // so there's nothing to log for their own requests.
    $forceDownload = ($_GET['dl'] ?? '') === '1';
    if ($user['role'] !== 'applicant') {
        log_document_access((int)$doc['id'], (int)$doc['version'], (int)$user['id'], !$forceDownload);
    }

    // "View" opens this in a new tab, so a file a browser can show is sent to be shown, not saved.
    // The type comes from the file's own contents rather than anything the uploader named it, and
    // only these four are ever sent inline; anything else (a HEIC photo, say) still downloads.
    $mime = function_exists('mime_content_type') ? (string)mime_content_type($fullPath) : '';
    $name = preg_replace('/[^A-Za-z0-9._ -]/', '_', basename($doc['original_filename'] ?? $doc['file_path']));
    // ?view=1 is the link's "View": the file inside a page that is named for the document and
    // carries PermitTrack's icon, rather than a bare image titled "documents.php (745×795)".
    if (($_GET['view'] ?? '') === '1' && in_array($mime, BROWSER_VIEWABLE_MIME, true)) {
        send_file_viewer((string)($doc['doc_name'] ?: $name), raw_file_url(), $mime);
    }
    // ?dl=1 is the link's "Download": always a real save, regardless of whether the browser could
    // have shown this mime type inline.
    if ($forceDownload || !in_array($mime, BROWSER_VIEWABLE_MIME, true)) {
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $name . '"');
    } else {
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . $name . '"');
    }
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    header('Content-Length: ' . filesize($fullPath));
    readfile($fullPath);
    exit;
}

fail('Unknown action.', 404);

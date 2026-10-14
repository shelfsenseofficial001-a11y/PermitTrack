<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/support.php';
require_once __DIR__ . '/lib/pipeline.php';
require_once __DIR__ . '/lib/threads.php';

/**
 * The office code a department answers to. Every barangay secretariat shares the code BARANGAY,
 * which is how permit_pipeline_steps and permit_type_documents say "whichever barangay this
 * applicant belongs to".
 */
function office_code_for_department(int $departmentId): string
{
    $s = db()->prepare('SELECT code, barangay_id FROM departments WHERE id = ?');
    $s->execute([$departmentId]);
    $row = $s->fetch();
    if (!$row) {
        return '';
    }
    return $row['barangay_id'] !== null ? 'BARANGAY' : (string)$row['code'];
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/** SQL condition limiting applications to the staff member's department (always true for "all"). */
function department_filter(array $user, string $alias = 'a'): string
{
    $types = reviewable_permit_types($user);
    if ($types === null) {
        return '1=1';
    }
    if (!$types) {
        return '1=0';
    }
    return "$alias.permit_type IN (" . implode(',', array_map(fn($t) => db()->quote($t), $types)) . ')';
}

if ($action === 'queue' && $method === 'GET') {
    $user = require_role('staff');
    $tab = (string)($_GET['tab'] ?? 'new');

    $where = department_filter($user) . " AND a.status NOT IN ('Approved','Rejected','Withdrawn')";
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
    $user = require_role('staff');
    $dept = department_filter($user);
    $pdo = db();

    $new = $pdo->query("SELECT COUNT(*) c FROM applications a WHERE $dept AND a.status = 'Submitted'")->fetch()['c'];
    $awaiting = $pdo->query(
        "SELECT COUNT(*) c FROM applications a WHERE $dept AND a.status NOT IN ('Approved','Rejected','Withdrawn')
         AND EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')"
    )->fetch()['c'];
    $inProgress = $pdo->query(
        "SELECT COUNT(*) c FROM applications a WHERE $dept AND a.status IN ('Under Review','Inspection Scheduled','Inspector Notes')
         AND NOT EXISTS (SELECT 1 FROM application_documents d WHERE d.application_id = a.id AND d.status = 'Needs Re-upload')"
    )->fetch()['c'];

    respond(['new' => (int)$new, 'in_progress' => (int)$inProgress, 'awaiting_applicant' => (int)$awaiting]);
}

// Approved permits drop out of 'queue'/'pipeline_queue' entirely (status NOT IN 'Approved'/
// current-step-only) — this is the only place a permit waiting on delivery turns back up, so
// an office actually has a way to find it again once it's left the review queues behind.
if ($action === 'delivery_queue' && $method === 'GET') {
    $user = require_role('staff');
    $rows = db()->query(
        "SELECT a.*, u.full_name AS applicant_name, pt.name AS permit_type_name
         FROM applications a JOIN users u ON u.id = a.applicant_id
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE a.delivery_method = 'delivery' AND a.delivery_status IS NOT NULL AND a.delivery_status <> 'delivered'
         ORDER BY a.delivery_requested_at ASC"
    )->fetchAll();

    if ($user['role'] !== 'admin') {
        $legacyTypes = reviewable_permit_types($user);
        $rows = array_values(array_filter($rows, function (array $app) use ($user, $legacyTypes) {
            $barangayDeptId = $app['barangay_id'] !== null ? resolve_office_department('BARANGAY', (int)$app['barangay_id']) : null;
            if ($barangayDeptId !== null) {
                return $barangayDeptId === (int)($user['department_id'] ?? 0);
            }
            return $legacyTypes === null || in_array($app['permit_type'], $legacyTypes, true);
        }));
    }

    respond(['applications' => $rows]);
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
    $types = reviewable_permit_types($user);
    if ($types !== null && !in_array($app['permit_type'], $types, true)) {
        fail("{$app['permit_type']} permits are handled by another department.", 403);
    }

    $pdo = db();
    $pdo->beginTransaction();

    $update = $pdo->prepare('UPDATE applications SET status = ?, assigned_reviewer_id = COALESCE(assigned_reviewer_id, ?) WHERE id = ?');
    $update->execute([$status, $user['id'], $appId]);

    $statusEvent = $status === 'Approved' ? 'approved' : ($status === 'Rejected' ? 'rejected' : 'status');
    $activity = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', ?, ?)");
    $activity->execute([$appId, $user['id'], $statusEvent, 'Status updated to "' . $status . '" by ' . $user['full_name'] . '.']);

    if ($notes !== '') {
        // A note is a message to the applicant: it lands in the application's thread in Messages.
        post_application_message($appId, (int)$app['applicant_id'], (int)$user['id'], $notes);
    }

    $pdo->commit();

    // Every stage the permit reaches reaches the applicant too: in-app via the activity row
    // above (which the bell reads), and by email or SMS here.
    $messages = [
        'Under Review' => 'is now under review by City Staff.',
        'Inspection Scheduled' => 'has an inspection scheduled. Someone should be on site.',
        'Inspector Notes' => 'has inspector notes waiting for you.',
        'Approved' => 'has been approved. Open it in PermitTrack to choose pickup or delivery.',
        'Rejected' => 'was not approved. Open it in PermitTrack to see why.',
    ];
    $tail = $messages[$status] ?? ('moved to "' . $status . '".');
    notify_user(
        (int)$app['applicant_id'],
        'Your ' . $app['permit_type'] . ' permit: ' . $status,
        'Your ' . $app['permit_type'] . ' permit at ' . $app['property_address'] . ' ' . $tail
            . ($notes !== '' ? "\n\nReviewer note: " . $notes : '')
    );

    respond(['ok' => true]);
}

// Pipeline-driven queue/decision, parallel to 'queue'/'decision' above. Which one a staff
// account uses depends on their department: the original 3 (OBO/BPLO/CHO) still run the old
// permit_type-CSV model untouched; the 75 barangay secretariats + 9 new offices from migration
// 008 only make sense under the pipeline model (their permit_types is the '__unassigned__'
// placeholder, so the old 'queue' action would correctly show them nothing). See
// BREAKING_CHANGES.md #1 and #5 — there is no UI yet to tell a staff member which mode they're
// in; that's frontend follow-up work.
if ($action === 'pipeline_queue' && $method === 'GET') {
    $user = require_role('staff');
    if (empty($user['department_id'])) {
        respond(['applications' => []]);
    }

    $stmt = db()->prepare(
        "SELECT a.*, u.full_name AS applicant_name, pt.name AS permit_type_name,
                p.id AS pipeline_step_id, p.step_label, p.office_code,
                DATEDIFF(NOW(), a.created_at) AS days_in_queue
         FROM application_pipeline_progress p
         JOIN applications a ON a.id = p.application_id
         JOIN users u ON u.id = a.applicant_id
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE p.department_id = ? AND p.status = 'current'
         ORDER BY a.created_at ASC"
    );
    $stmt->execute([(int)$user['department_id']]);
    respond(['applications' => $stmt->fetchAll()]);
}

if ($action === 'pipeline_counts' && $method === 'GET') {
    $user = require_role('staff');
    if (empty($user['department_id'])) {
        respond(['current' => 0]);
    }
    $stmt = db()->prepare(
        "SELECT COUNT(*) c FROM application_pipeline_progress WHERE department_id = ? AND status = 'current'"
    );
    $stmt->execute([(int)$user['department_id']]);
    respond(['current' => (int)$stmt->fetch()['c']]);
}

if ($action === 'pipeline_decision' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $appId = (int)($in['application_id'] ?? 0);
    $decision = (string)($in['decision'] ?? '');
    $notes = trim((string)($in['notes'] ?? ''));

    // The node as a whole offers four actions (approve/reject/freeze/revise) on top of each
    // file's own approve/reject/revise in documents.php. 'resume' lifts a freeze without
    // otherwise deciding anything — the companion to 'freeze'.
    if (!in_array($decision, ['approved', 'rejected', 'freeze', 'revise', 'resume'], true)) {
        fail('Invalid decision.');
    }
    if (empty($user['department_id'])) {
        fail('Your account is not assigned to an office.', 403);
    }

    $appStmt = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $appStmt->execute([$appId]);
    $app = $appStmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }

    $currentStmt = db()->prepare(
        "SELECT * FROM application_pipeline_progress WHERE application_id = ? AND status = 'current' LIMIT 1"
    );
    $currentStmt->execute([$appId]);
    $current = $currentStmt->fetch();
    if (!$current || (int)$current['department_id'] !== (int)$user['department_id']) {
        fail('This application is not currently waiting on your office.', 403);
    }

    $officeCode = office_code_for_department((int)$user['department_id']);

    // View-before-deciding (migration 038): every document this office owns on this application
    // must have been opened AND downloaded, at its current version, by this staff member — for
    // all four node-level actions. 'resume' just lifts a freeze, so it is exempt.
    if ($decision !== 'resume') {
        $missing = unreviewed_documents_for_office($appId, $officeCode, (int)$user['id']);
        if ($missing) {
            fail('Please open and download every document your office handles first — still pending: ' . implode(', ', $missing) . '.', 409);
        }
    }

    if ($decision === 'resume') {
        if (empty($current['frozen_at'])) {
            fail('This application is not frozen.', 409);
        }
        unfreeze_current_node($appId);
        $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'status', ?)");
        $activity->execute([$appId, $user['id'], $current['step_label'] . ' — resumed by ' . $user['full_name'] . '.']);
        respond(['ok' => true, 'status' => $app['status']]);
    }

    if ($decision === 'freeze' || $decision === 'revise') {
        if ($notes === '') {
            fail('Please say what needs to be fixed before freezing this application.');
        }
        freeze_current_node($appId, (int)$user['id'], $decision === 'revise' ? 'revision' : 'freeze', $notes);
        $activity = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'status', ?)");
        $activity->execute([$appId, $user['id'], $current['step_label'] . ' — '
            . ($decision === 'revise' ? 'sent back for revision' : 'frozen') . ' by ' . $user['full_name'] . ': ' . $notes]);
        post_application_message($appId, (int)$app['applicant_id'], (int)$user['id'], $notes);
        notify_user(
            (int)$app['applicant_id'],
            'Your permit application needs your attention',
            'Your application at ' . $app['property_address'] . ' is paused at the ' . $current['step_label']
                . ' stage until you act on this: ' . $notes
        );
        respond(['ok' => true, 'status' => $app['status']]);
    }

    // approved / rejected, same as before — but refused outright while the node is frozen; a
    // freeze (manual, or automatic from a file-level reject/revise) must be cleared first.
    if (!empty($current['frozen_at'])) {
        fail('This application is frozen pending a revision — resolve that before deciding the step.', 409);
    }

    // No skipping: an office signs its node off only once it has actually decided the documents it
    // is responsible for. Otherwise a permit could move past paperwork nobody ever looked at.
    // Rejecting stays available at any point — that is how a bad application gets stopped early.
    if ($decision === 'approved') {
        if ($officeCode === 'BARANGAY') {
            // Intake covers the whole submission, not just the barangay's own paperwork: the city
            // offices do not see any of it until this step is signed off, so anything still
            // unchecked would travel on unseen.
            $pendingStmt = db()->prepare(
                "SELECT COUNT(*) FROM application_documents
                  WHERE application_id = ? AND status NOT IN ('Intake Approved', 'Verified')"
            );
            $pendingStmt->execute([$appId]);
            $pending = (int)$pendingStmt->fetchColumn();
            if ($pending > 0) {
                fail('Check the ' . $pending . ' remaining document(s) at intake before forwarding this application.', 409);
            }
        } else {
            $pendingStmt = db()->prepare(
                "SELECT COUNT(*) FROM application_documents
                  WHERE application_id = ?
                    AND COALESCE(office_code, 'BARANGAY') = ?
                    AND status <> 'Verified'"
            );
            $pendingStmt->execute([$appId, $officeCode]);
            $pending = (int)$pendingStmt->fetchColumn();
            if ($pending > 0) {
                fail('Review the ' . $pending . ' document(s) your office is responsible for before approving this step.', 409);
            }
        }
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $resultStatus = advance_pipeline($appId, (int)$user['id'], $decision, $notes ?: null);

        $update = $pdo->prepare('UPDATE applications SET status = ?, assigned_reviewer_id = COALESCE(assigned_reviewer_id, ?) WHERE id = ?');
        $update->execute([$resultStatus, $user['id'], $appId]);

        // A rejected step rejects the permit; an approved one either moves it on or issues it.
        $stepEvent = $decision === 'rejected' ? 'rejected' : ($resultStatus === 'Approved' ? 'approved' : 'status');
        $activity = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', ?, ?)");
        $activity->execute([$appId, $user['id'], $stepEvent, $current['step_label'] . ' — ' . ucfirst($decision) . ' by ' . $user['full_name'] . '.']);
        if ($notes !== '') {
            post_application_message($appId, (int)$app['applicant_id'], (int)$user['id'], $notes);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not record this decision: ' . $e->getMessage(), 500);
    }

    $tail = match ($resultStatus) {
        'Approved' => 'has been approved. Open it in PermitTrack to choose pickup or delivery.',
        'Rejected' => 'was not approved at the ' . $current['step_label'] . ' stage. Open it in PermitTrack to see why.',
        default => 'has moved to the next stage: ' . 'pending review.',
    };
    notify_user(
        (int)$app['applicant_id'],
        'Your permit application: ' . $resultStatus,
        'Your application at ' . $app['property_address'] . ' ' . $tail
            . ($notes !== '' ? "\n\nReviewer note: " . $notes : '')
    );

    respond(['ok' => true, 'status' => $resultStatus]);
}

// Staff's own tracking of the physical handoff, once the applicant has chosen delivery. Separate
// from applications.status, which stays 'Approved' throughout — this only ever moves forward,
// Preparing -> Out for delivery -> Delivered.
if ($action === 'delivery_status' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $appId = (int)($in['application_id'] ?? 0);
    $status = (string)($in['delivery_status'] ?? '');

    $order = ['preparing', 'out_for_delivery', 'delivered'];
    if (!in_array($status, $order, true)) {
        fail('Invalid delivery status.');
    }

    $stmt = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$appId]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }
    if ($app['delivery_method'] !== 'delivery' || empty($app['delivery_status'])) {
        fail('This permit is not set for delivery.', 409);
    }

    // The barangay secretariat handles delivery — it's the office closest to the applicant and
    // the one every pipeline already routes through, not whichever city office happened to issue
    // the permit. On the old single-stage flow, which never had a barangay step at all, fall back
    // to whichever department's permit_types cover it (the same rule 'decision' authorizes with).
    // Admins are exempt, same as everywhere else.
    if ($user['role'] !== 'admin') {
        $barangayDeptId = $app['barangay_id'] !== null ? resolve_office_department('BARANGAY', (int)$app['barangay_id']) : null;
        if ($barangayDeptId !== null) {
            if ($barangayDeptId !== (int)($user['department_id'] ?? 0)) {
                fail('Delivery for this permit is handled by the applicant\'s barangay secretariat, not your office.', 403);
            }
        } else {
            $legacyTypes = reviewable_permit_types($user);
            if ($legacyTypes !== null && !in_array($app['permit_type'], $legacyTypes, true)) {
                fail($app['permit_type'] . ' permits are handled by another department.', 403);
            }
        }
    }

    // Forward only — Delivered is the end of the line, and a step can't be skipped or reversed
    // by typing a different value into the same request.
    if (array_search($status, $order, true) <= array_search($app['delivery_status'], $order, true)) {
        fail('Delivery status can only move forward, from ' . DELIVERY_STATUS_LABELS[$app['delivery_status']] . '.', 409);
    }

    db()->prepare('UPDATE applications SET delivery_status = ?, delivery_updated_at = NOW() WHERE id = ?')
        ->execute([$status, $appId]);

    db()->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'delivery', ?)"
    )->execute([$appId, $user['id'], 'Delivery status: ' . DELIVERY_STATUS_LABELS[$status] . ' (' . $user['full_name'] . ').']);

    notify_user(
        (int)$app['applicant_id'],
        'Your permit delivery: ' . DELIVERY_STATUS_LABELS[$status],
        'Your permit at ' . $app['property_address'] . ' — delivery status: ' . DELIVERY_STATUS_LABELS[$status] . '.'
            . ($status === 'delivered' ? ' If you did not receive it, message your office.' : '')
    );

    respond(['ok' => true]);
}

fail('Unknown action.', 404);

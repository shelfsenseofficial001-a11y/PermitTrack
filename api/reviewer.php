<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/support.php';
require_once __DIR__ . '/lib/pipeline.php';

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
        $note = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'message', 'message', ?)");
        $note->execute([$appId, $user['id'], $notes]);
    }

    $pdo->commit();

    // Every stage the permit reaches reaches the applicant too: in-app via the activity row
    // above (which the bell reads), and by email or SMS here.
    $messages = [
        'Under Review' => 'is now under review by City Staff.',
        'Inspection Scheduled' => 'has an inspection scheduled. Someone should be on site.',
        'Inspector Notes' => 'has inspector notes waiting for you.',
        'Approved' => 'has been approved. You can view it in PermitTrack.',
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

    if (!in_array($decision, ['approved', 'rejected'], true)) {
        fail('decision must be "approved" or "rejected".');
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

    // No skipping: an office signs its node off only once it has actually decided the documents it
    // is responsible for. Otherwise a permit could move past paperwork nobody ever looked at.
    // Rejecting stays available at any point — that is how a bad application gets stopped early.
    if ($decision === 'approved') {
        $officeCode = office_code_for_department((int)$user['department_id']);
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
            $note = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'message', 'message', ?)");
            $note->execute([$appId, $user['id'], $notes]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not record this decision: ' . $e->getMessage(), 500);
    }

    $tail = match ($resultStatus) {
        'Approved' => 'has been approved. You can view it in PermitTrack.',
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

fail('Unknown action.', 404);

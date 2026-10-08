<?php
declare(strict_types=1);

// The thread every application has in Messages (migration 031). Its messages and status lines are
// the application's own timeline, application_activity; the conversation row beside it holds whose
// turn it is and each side's read mark, so the list, the badges and the inboxes treat it like any
// other conversation (api/conversations.php).

/**
 * Creates the missing thread for each application matching $where (a condition on alias a).
 * One statement, so it is safe to run on every list: an application that already has its thread,
 * or has no pipeline to route it by, is left alone.
 */
function ensure_application_threads(string $where, array $params): void
{
    db()->prepare(
        "INSERT INTO conversations
            (user_id, department_id, permit_type_id, application_id, subject, last_message_at, user_read_at, created_at)
         SELECT a.applicant_id,
                (SELECT p.department_id FROM application_pipeline_progress p
                  WHERE p.application_id = a.id ORDER BY p.step_order DESC, p.id DESC LIMIT 1),
                a.permit_type_id, a.id,
                LEFT(COALESCE(pt.name, a.permit_type, 'Permit application'), 150),
                a.created_at, NOW(3), a.created_at
           FROM applications a
           LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
          WHERE ($where)
            AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.application_id = a.id)
            AND EXISTS (SELECT 1 FROM application_pipeline_progress p WHERE p.application_id = a.id)"
    )->execute($params);
}

/** The application's thread, made if it doesn't exist yet; null for an application with no pipeline. */
function application_thread_id(int $applicationId): ?int
{
    ensure_application_threads('a.id = ?', [$applicationId]);
    $stmt = db()->prepare('SELECT id FROM conversations WHERE application_id = ?');
    $stmt->execute([$applicationId]);
    $id = $stmt->fetchColumn();
    return $id === false ? null : (int)$id;
}

/** Whether a staff member's office has a step on this application's pipeline. */
function staff_on_application(array $user, int $applicationId): bool
{
    if ($user['role'] === 'admin') {
        return true;
    }
    if ($user['role'] !== 'staff' || $user['department_id'] === null) {
        return false;
    }
    $stmt = db()->prepare('SELECT 1 FROM application_pipeline_progress WHERE application_id = ? AND department_id = ? LIMIT 1');
    $stmt->execute([$applicationId, $user['department_id']]);
    return (bool)$stmt->fetchColumn();
}

/**
 * A message on an application: onto its timeline, and its thread moved along — it's now the
 * other side's turn, and the sender has read everything above it. Runs inside the caller's
 * transaction when there is one.
 */
function post_application_message(int $applicationId, int $applicantId, int $senderId, string $body): void
{
    $pdo = db();
    $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'message', 'message', ?)")
        ->execute([$applicationId, $senderId, $body]);
    if (application_thread_id($applicationId) === null) {
        return;
    }
    $readColumn = $senderId === $applicantId ? 'user_read_at' : 'staff_read_at';
    $pdo->prepare(
        "UPDATE conversations SET last_message_at = NOW(3), last_sender_id = ?, status = 'open', $readColumn = NOW(3)
          WHERE application_id = ?"
    )->execute([$senderId, $applicationId]);
}

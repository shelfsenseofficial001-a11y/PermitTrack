<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const NOTIFICATION_LIMIT = 30;      // the bell's dropdown
const NOTIFICATION_LIMIT_MAX = 200; // the Notifications page asks for more with ?limit=

// The feed is derived from application_activity: every stage change and every reviewer
// message on one of the applicant's permits is a notification. Nothing is duplicated into
// a separate table, so the bell can never drift from the permit timeline it reports on.
if ($action === 'list' && $method === 'GET') {
    $user = require_role('applicant');
    $limit = min(max((int)($_GET['limit'] ?? NOTIFICATION_LIMIT), 1), NOTIFICATION_LIMIT_MAX);

    $stmt = db()->prepare(
        "SELECT v.id, v.type, v.body, v.created_at,
                a.id AS application_id, a.property_address, a.status,
                COALESCE(a.permit_type, pt.name) AS permit_type,
                u.full_name AS sender_name, u.role AS sender_role
         FROM application_activity v
         JOIN applications a ON a.id = v.application_id
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         LEFT JOIN users u ON u.id = v.sender_id
         WHERE a.applicant_id = ?
           AND (v.type = 'status_change' OR u.role IN ('staff', 'admin'))
         ORDER BY v.created_at DESC, v.id DESC
         LIMIT " . $limit // an int, clamped above — safe to inline
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    // Read directly — these columns are deliberately not part of USER_COLUMNS
    $marks = db()->prepare('SELECT notifications_seen_at, notifications_read_at FROM users WHERE id = ?');
    $marks->execute([$user['id']]);
    $mark = $marks->fetch();
    $seenAt = $mark['notifications_seen_at'] ?: null;  // bell opened: clears the badge
    $readAt = $mark['notifications_read_at'] ?: null;  // "Mark all as read": clears every dot

    // Notifications opened one at a time since the last "Mark all as read"
    $readIds = [];
    if ($rows) {
        $ids = array_map(fn($r) => (int)$r['id'], $rows);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $readStmt = db()->prepare("SELECT activity_id FROM notification_reads WHERE user_id = ? AND activity_id IN ($in)");
        $readStmt->execute(array_merge([$user['id']], $ids));
        $readIds = array_flip(array_map('intval', $readStmt->fetchAll(PDO::FETCH_COLUMN)));
    }

    $items = [];
    $unread = 0;  // still showing a dot
    $unseen = 0;  // unread AND arrived since the bell was last opened — the badge number
    $seenKeys = [];
    foreach ($rows as $row) {
        // Toggling a document between Verified and Needs Re-upload writes a row every time.
        // Only the latest of each distinct event per permit is worth notifying about, and
        // rows arrive newest-first, so the first one we see is the one we keep.
        $key = $row['application_id'] . '|' . $row['body'];
        if (isset($seenKeys[$key])) {
            continue;
        }
        $seenKeys[$key] = true;

        $isUnread = ($readAt === null || $row['created_at'] > $readAt) && !isset($readIds[(int)$row['id']]);
        if ($isUnread) {
            $unread++;
            if ($seenAt === null || $row['created_at'] > $seenAt) {
                $unseen++;
            }
        }
        $items[] = [
            'id' => (int)$row['id'],
            'application_id' => (int)$row['application_id'],
            'permit_type' => $row['permit_type'],
            'property_address' => $row['property_address'],
            'title' => notification_title($row),
            'body' => $row['body'],
            'kind' => $row['type'] === 'status_change' ? 'stage' : 'message',
            'created_at' => $row['created_at'],
            'unread' => $isUnread,
            // Unread AND newer than the last time the bell was opened — i.e. not yet announced
            'unseen' => $isUnread && ($seenAt === null || $row['created_at'] > $seenAt),
        ];
    }

    respond(['notifications' => $items, 'unread' => $unread, 'unseen' => $unseen]);
}

// Opening the bell: the badge clears, but each notification keeps its unread dot until it is
// opened or "Mark all as read" is pressed — so the Notifications page can still show them.
if ($action === 'seen' && $method === 'POST') {
    $user = require_role('applicant');
    $stmt = db()->prepare('UPDATE users SET notifications_seen_at = NOW() WHERE id = ?');
    $stmt->execute([$user['id']]);
    respond(['ok' => true]);
}

// Opening one notification marks just that one read.
if ($action === 'read' && $method === 'POST') {
    $user = require_role('applicant');
    $id = (int)(json_input()['id'] ?? 0);
    // Only activity on the user's own permits
    $own = db()->prepare(
        'SELECT v.id FROM application_activity v JOIN applications a ON a.id = v.application_id
         WHERE v.id = ? AND a.applicant_id = ?'
    );
    $own->execute([$id, $user['id']]);
    if (!$own->fetch()) {
        fail('Notification not found.', 404);
    }
    db()->prepare('INSERT IGNORE INTO notification_reads (user_id, activity_id) VALUES (?, ?)')
        ->execute([$user['id'], $id]);
    respond(['ok' => true]);
}

// "Mark all as read": moves the read line to now (which also counts as seen), and drops the
// individual reads it now covers.
if ($action === 'read_all' && $method === 'POST') {
    $user = require_role('applicant');
    $pdo = db();
    $pdo->prepare('UPDATE users SET notifications_read_at = NOW(), notifications_seen_at = NOW() WHERE id = ?')
        ->execute([$user['id']]);
    $pdo->prepare('DELETE FROM notification_reads WHERE user_id = ?')->execute([$user['id']]);
    respond(['ok' => true]);
}

// A headline for the event, so the bell reads as news rather than as a log line.
function notification_title(array $row): string
{
    $permit = trim((string)$row['permit_type']) !== '' ? $row['permit_type'] . ' permit' : 'application';

    if ($row['type'] !== 'status_change') {
        $who = $row['sender_name'] ?: 'City Staff';
        return $who . ' replied on your ' . $permit;
    }

    $body = $row['body'];
    if (stripos($body, 'Needs Re-upload') !== false) {
        return 'Document needs re-upload · ' . $permit;
    }
    if (stripos($body, 'marked as Verified') !== false) {
        return 'Document verified · ' . $permit;
    }
    if (stripos($body, 'submitted') !== false) {
        return 'Application submitted · ' . $permit;
    }
    // "Status updated to "Under Review" by ..." / "Status changed to Approved."
    if (preg_match('/Status (?:updated|changed) to "?([^".]+)"?/i', $body, $m)) {
        return trim($m[1]) . ' · ' . $permit;
    }
    return $permit . ' · ' . $row['status'];
}

fail('Unknown action.', 404);

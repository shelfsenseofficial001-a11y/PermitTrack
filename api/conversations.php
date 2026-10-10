<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/support.php';    // notify_user()
require_once __DIR__ . '/lib/pipeline.php';   // resolve_office_department()
require_once __DIR__ . '/lib/threads.php';    // application threads

// Conversations: an applicant and City Hall, in two kinds.
//
//   A question   started from the chat panel about a permit, before or without an application —
//                routed once, at the start, to the office that issues it (conversation_office()).
//   An application's thread   one per filed application (application_id set, migration 031). Its
//                timeline is the application's own: status lines and messages, both read from
//                application_activity. See api/lib/threads.php.
//
// Who sees one: the applicant, admins, and the staff of the office it was routed to — or, for an
// application's thread, of any office on that application's pipeline. An office's inbox lists an
// application's thread once someone has written in it.

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const CONVERSATION_BODY_MAX = 2000;
const CONVERSATIONS_PER_HOUR = 10;

/**
 * The office that answers questions about a permit: whoever issues it, which is the office of the
 * permit's last pipeline step. BARANGAY there means the applicant's own barangay secretariat, so
 * that one depends on who is asking. Returns [department_id|null, office_code|null].
 */
function conversation_office(int $permitTypeId, ?int $barangayId): array
{
    $stmt = db()->prepare(
        'SELECT office_code FROM permit_pipeline_steps WHERE permit_type_id = ? ORDER BY step_order DESC, id DESC LIMIT 1'
    );
    $stmt->execute([$permitTypeId]);
    $code = $stmt->fetchColumn();
    if ($code === false) {
        return [null, null];
    }
    return [resolve_office_department((string)$code, $barangayId), (string)$code];
}

/** The conversation, if this user may see it; 404 otherwise, so ids can't be probed. */
function load_conversation(int $id, array $user): array
{
    $stmt = db()->prepare('SELECT * FROM conversations WHERE id = ?');
    $stmt->execute([$id]);
    $conv = $stmt->fetch();
    $allowed = $conv && (
        $user['role'] === 'admin'
        || ($user['role'] === 'applicant' && (int)$conv['user_id'] === (int)$user['id'])
        || ($user['role'] === 'staff' && $user['department_id'] !== null && ($conv['application_id'] !== null
            ? staff_on_application($user, (int)$conv['application_id'])
            : (int)$conv['department_id'] === (int)$user['department_id']))
    );
    if (!$allowed) {
        fail('Conversation not found.', 404);
    }
    return $conv;
}

/** The applicant is one side; everyone else (staff, admin) answers for the office. */
function is_applicant_side(array $conv, array $user): bool
{
    return (int)$conv['user_id'] === (int)$user['id'];
}

function clean_body(mixed $raw): string
{
    $body = trim((string)$raw);
    if ($body === '') {
        fail('Write a message first.');
    }
    if (mb_strlen($body) > CONVERSATION_BODY_MAX) {
        fail('Messages are limited to ' . CONVERSATION_BODY_MAX . ' characters.');
    }
    return $body;
}

/**
 * Which threads an office's inbox holds: its questions, and the applications on its pipeline that
 * someone has written in. Binds the department id twice.
 */
const STAFF_THREADS = '((c.application_id IS NULL AND c.department_id = ?)
    OR (c.application_id IS NOT NULL AND c.last_sender_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM application_pipeline_progress pp WHERE pp.application_id = c.application_id AND pp.department_id = ?)))';
const ADMIN_THREADS = '(c.application_id IS NULL OR c.last_sender_id IS NOT NULL)';

/**
 * The SELECT for a conversation row as the list shows it, with "unread" worked out for the person
 * looking. It is their turn — the last message isn't theirs — and they haven't opened the thread
 * since it arrived. An application's thread also moves up the list when its status changes, and
 * names the office working on it now rather than the one that issues it.
 */
function conversation_select(bool $asApplicant): string
{
    $unread = $asApplicant
        ? 'c.last_sender_id IS NOT NULL AND c.last_sender_id <> c.user_id AND (c.user_read_at IS NULL OR c.user_read_at < c.last_message_at)'
        : 'c.last_sender_id = c.user_id AND (c.staff_read_at IS NULL OR c.staff_read_at < c.last_message_at)';
    return "SELECT c.id, c.subject, c.status, c.permit_type_id, c.department_id, c.created_at,
                   c.application_id, ap.status AS application_status,
                   GREATEST(c.last_message_at, COALESCE((SELECT MAX(v.created_at) FROM application_activity v
                     WHERE v.application_id = c.application_id), c.last_message_at)) AS sort_at,
                   DATE_FORMAT(GREATEST(c.last_message_at, COALESCE((SELECT MAX(v.created_at) FROM application_activity v
                     WHERE v.application_id = c.application_id), c.last_message_at)), '%Y-%m-%d %H:%i:%s') AS last_message_at,
                   pt.name AS permit_name, d.code AS office_code,
                   COALESCE((SELECT d2.name FROM application_pipeline_progress p JOIN departments d2 ON d2.id = p.department_id
                     WHERE p.application_id = c.application_id AND p.status = 'current' ORDER BY p.step_order LIMIT 1), d.name) AS office_name,
                   u.full_name AS applicant_name,
                   IF(c.application_id IS NULL,
                      (SELECT m.body FROM conversation_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1),
                      (SELECT v.body FROM application_activity v WHERE v.application_id = c.application_id ORDER BY v.id DESC LIMIT 1)
                   ) AS last_message,
                   ($unread) AS unread,
                   (c.last_sender_id = c.user_id AND c.status = 'open') AS awaiting_office
              FROM conversations c
              JOIN departments d ON d.id = c.department_id
              JOIN users u ON u.id = c.user_id
              LEFT JOIN permit_types pt ON pt.id = c.permit_type_id
              LEFT JOIN applications ap ON ap.id = c.application_id";
}

function shape_row(array $row): array
{
    $row['id'] = (int)$row['id'];
    $row['unread'] = (bool)(int)$row['unread'];
    // The applicant spoke last and the thread is still open: the office owes a reply.
    $row['awaiting_office'] = (bool)(int)$row['awaiting_office'];
    $row['permit_type_id'] = $row['permit_type_id'] !== null ? (int)$row['permit_type_id'] : null;
    $row['application_id'] = $row['application_id'] !== null ? (int)$row['application_id'] : null;
    unset($row['sort_at']);
    return $row;
}

// The permits an applicant can ask about, grouped the way the New Application page groups them,
// each with the office it would go to. A barangay-issued permit needs the asker's barangay on
// file; without one it is listed but not offered, with the reason.
if ($action === 'options' && $method === 'GET') {
    $user = require_role('applicant');
    $barangayId = $user['barangay_id'] !== null ? (int)$user['barangay_id'] : null;

    $types = db()->query(
        "SELECT pt.id, pt.name, pt.description, pt.track,
                (SELECT s.office_code FROM permit_pipeline_steps s WHERE s.permit_type_id = pt.id
                  ORDER BY s.step_order DESC, s.id DESC LIMIT 1) AS office_code
           FROM permit_types pt
          WHERE pt.is_active = 1
          ORDER BY FIELD(pt.track, 'construction', 'business', 'personal', 'barangay_standalone'), pt.name"
    )->fetchAll();

    $offices = [];
    foreach (db()->query('SELECT id, code, name FROM departments WHERE is_active = 1')->fetchAll() as $d) {
        $offices[$d['code']] = $d;
    }
    $ownBarangay = null;
    if ($barangayId !== null) {
        $stmt = db()->prepare('SELECT id, name FROM departments WHERE barangay_id = ? LIMIT 1');
        $stmt->execute([$barangayId]);
        $ownBarangay = $stmt->fetch() ?: null;
    }

    $tracks = [
        'construction' => 'Building & construction',
        'business' => 'Business',
        'personal' => 'Personal & barangay certificates',
        'barangay_standalone' => 'Barangay clearances',
    ];
    $groups = [];
    foreach ($types as $t) {
        if ($t['office_code'] === null) {
            continue; // no pipeline, so nobody issues it yet
        }
        if ($t['office_code'] === 'BARANGAY') {
            $office = $ownBarangay ? $ownBarangay['name'] : null;
            $reason = $ownBarangay ? null : 'Add your barangay to your profile to ask about this one.';
        } else {
            $office = $offices[$t['office_code']]['name'] ?? null;
            $reason = $office ? null : 'No office handles this permit yet.';
        }
        $groups[$t['track']]['key'] = $t['track'];
        $groups[$t['track']]['label'] = $tracks[$t['track']] ?? ucfirst($t['track']);
        $groups[$t['track']]['permits'][] = [
            'id' => (int)$t['id'],
            'name' => $t['name'],
            'description' => $t['description'],
            'office' => $office,
            'available' => $reason === null,
            'reason' => $reason,
        ];
    }
    respond(['groups' => array_values($groups)]);
}

if ($action === 'list' && $method === 'GET') {
    $user = require_auth();
    if ($user['role'] === 'applicant') {
        ensure_application_threads('a.applicant_id = ?', [$user['id']]);
        $stmt = db()->prepare(conversation_select(true) . ' WHERE c.user_id = ? ORDER BY sort_at DESC, c.id DESC');
        $stmt->execute([$user['id']]);
    } elseif ($user['role'] === 'admin') {
        $stmt = db()->query(conversation_select(false) . ' WHERE ' . ADMIN_THREADS . ' ORDER BY sort_at DESC, c.id DESC LIMIT 200');
    } else {
        if ($user['department_id'] === null) {
            respond(['conversations' => []]);
        }
        $stmt = db()->prepare(conversation_select(false) . ' WHERE ' . STAFF_THREADS . ' ORDER BY sort_at DESC, c.id DESC');
        $stmt->execute([$user['department_id'], $user['department_id']]);
    }
    respond(['conversations' => array_map('shape_row', $stmt->fetchAll())]);
}

// How many threads are waiting on this person, for the badge on the launcher and the staff sidebar.
if ($action === 'unread' && $method === 'GET') {
    $user = require_auth();
    if ($user['role'] === 'applicant') {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM conversations c WHERE c.user_id = ?
               AND c.last_sender_id IS NOT NULL AND c.last_sender_id <> c.user_id
               AND (c.user_read_at IS NULL OR c.user_read_at < c.last_message_at)'
        );
        $stmt->execute([$user['id']]);
    } elseif ($user['role'] === 'admin') {
        $stmt = db()->query(
            'SELECT COUNT(*) FROM conversations c WHERE c.last_sender_id = c.user_id
               AND (c.staff_read_at IS NULL OR c.staff_read_at < c.last_message_at)'
        );
    } else {
        if ($user['department_id'] === null) {
            respond(['unread' => 0]);
        }
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM conversations c WHERE ' . STAFF_THREADS . ' AND c.last_sender_id = c.user_id
               AND (c.staff_read_at IS NULL OR c.staff_read_at < c.last_message_at)'
        );
        $stmt->execute([$user['department_id'], $user['department_id']]);
    }
    respond(['unread' => (int)$stmt->fetchColumn()]);
}

// One thread with its messages. Opening it is reading it, for whichever side opened it.
if ($action === 'get' && $method === 'GET') {
    $user = require_auth();
    $conv = load_conversation((int)($_GET['id'] ?? 0), $user);
    $applicantSide = is_applicant_side($conv, $user);

    db()->prepare('UPDATE conversations SET ' . ($applicantSide ? 'user_read_at' : 'staff_read_at') . ' = NOW(3) WHERE id = ?')
        ->execute([$conv['id']]);

    $stmt = db()->prepare(conversation_select($applicantSide) . ' WHERE c.id = ?');
    $stmt->execute([$conv['id']]);
    $row = shape_row($stmt->fetch());

    // An application's thread is its timeline: status lines come through as events, between
    // the messages, in the order they happened.
    if ($conv['application_id'] !== null) {
        $stmt = db()->prepare(
            "SELECT v.id, v.body, v.sender_id, v.type, DATE_FORMAT(v.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                    u.full_name AS sender_name, u.role AS sender_role
               FROM application_activity v LEFT JOIN users u ON u.id = v.sender_id
              WHERE v.application_id = ? ORDER BY v.id ASC"
        );
        $stmt->execute([$conv['application_id']]);
    } else {
        $stmt = db()->prepare(
            "SELECT m.id, m.body, m.sender_id, 'message' AS type, DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                    u.full_name AS sender_name, u.role AS sender_role
               FROM conversation_messages m LEFT JOIN users u ON u.id = m.sender_id
              WHERE m.conversation_id = ? ORDER BY m.id ASC"
        );
        $stmt->execute([$conv['id']]);
    }
    $messages = array_map(fn($m) => [
        'id' => (int)$m['id'],
        'kind' => $m['type'] === 'status_change' ? 'event' : 'message',
        'body' => $m['body'],
        'created_at' => $m['created_at'],
        'sender_name' => $m['sender_name'] ?? 'Deleted account',
        // From the viewer's side: which bubbles are theirs, and which are the other party's.
        'mine' => $m['sender_id'] !== null && (int)$m['sender_id'] === (int)$user['id'],
        'from_office' => $m['sender_id'] === null || (int)$m['sender_id'] !== (int)$conv['user_id'],
    ], $stmt->fetchAll());

    respond(['conversation' => $row, 'messages' => $messages]);
}

// An applicant opens a thread about a permit; it goes to the office that issues it.
if ($action === 'start' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $permitTypeId = (int)($in['permit_type_id'] ?? 0);
    $body = clean_body($in['message'] ?? '');

    // A person asks a handful of things; a script asks hundreds. Each new thread lands in an
    // office's inbox, so the cap is on starting threads — replying in one is never limited.
    $recent = db()->prepare(
        'SELECT COUNT(*) FROM conversations WHERE user_id = ? AND application_id IS NULL AND created_at > NOW() - INTERVAL 1 HOUR'
    );
    $recent->execute([$user['id']]);
    if ((int)$recent->fetchColumn() >= CONVERSATIONS_PER_HOUR) {
        fail('You have started a lot of conversations in the last hour. Please continue one of them, or try again later.', 429);
    }

    $stmt = db()->prepare('SELECT id, name FROM permit_types WHERE id = ? AND is_active = 1');
    $stmt->execute([$permitTypeId]);
    $permit = $stmt->fetch();
    if (!$permit) {
        fail('Choose which permit this is about.');
    }
    [$departmentId, $officeCode] = conversation_office(
        $permitTypeId,
        $user['barangay_id'] !== null ? (int)$user['barangay_id'] : null
    );
    if ($departmentId === null) {
        fail($officeCode === 'BARANGAY'
            ? 'Add your barangay to your profile first — this permit is issued by your barangay.'
            : 'No office handles this permit yet.');
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'INSERT INTO conversations (user_id, department_id, permit_type_id, subject, last_message_at, last_sender_id, user_read_at)
             VALUES (?, ?, ?, ?, NOW(3), ?, NOW(3))'
        )->execute([$user['id'], $departmentId, $permitTypeId, mb_substr($permit['name'], 0, 150), $user['id']]);
        $id = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO conversation_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
            ->execute([$id, $user['id'], $body]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    audit((int)$user['id'], 'conversation_started', 'conversation', $id, $permit['name']);
    respond(['id' => $id], 201);
}

if ($action === 'send' && $method === 'POST') {
    $user = require_auth();
    $in = json_input();
    $conv = load_conversation((int)($in['id'] ?? 0), $user);
    $body = clean_body($in['message'] ?? '');
    $applicantSide = is_applicant_side($conv, $user);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($conv['application_id'] !== null) {
            post_application_message((int)$conv['application_id'], (int)$conv['user_id'], (int)$user['id'], $body);
        } else {
            $pdo->prepare('INSERT INTO conversation_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
                ->execute([$conv['id'], $user['id'], $body]);
            // Sending is also reading: whoever writes has seen everything above it. A new message
            // reopens a closed thread — the office closing it shouldn't stop the applicant replying.
            $pdo->prepare(
                "UPDATE conversations SET last_message_at = NOW(3), last_sender_id = ?, status = 'open', "
                . ($applicantSide ? 'user_read_at' : 'staff_read_at') . ' = NOW(3) WHERE id = ?'
            )->execute([$user['id'], $conv['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    if (!$applicantSide) {
        notify_user(
            (int)$conv['user_id'],
            'New reply about ' . $conv['subject'],
            'The office replied to your message about ' . $conv['subject'] . '. Open PermitTrack to read it.'
        );
    }
    respond(['ok' => true], 201);
}

// The thread for one application, for the permit pages and the review screen to open it by.
if ($action === 'for_application' && $method === 'GET') {
    $user = require_auth();
    $appId = (int)($_GET['application_id'] ?? 0);
    $stmt = db()->prepare('SELECT applicant_id FROM applications WHERE id = ?');
    $stmt->execute([$appId]);
    $applicantId = $stmt->fetchColumn();
    $allowed = $applicantId !== false && ($user['role'] === 'applicant'
        ? (int)$applicantId === (int)$user['id']
        : staff_on_application($user, $appId));
    if (!$allowed) {
        fail('Application not found.', 404);
    }
    $id = application_thread_id($appId);
    if ($id === null) {
        fail('This application has no office to write to yet.', 409);
    }
    respond(['id' => $id]);
}

// The office marks a thread done; the applicant writing again reopens it (see send).
if ($action === 'close' && $method === 'POST') {
    $user = require_role('staff');
    $conv = load_conversation((int)(json_input()['id'] ?? 0), $user);
    db()->prepare("UPDATE conversations SET status = 'closed' WHERE id = ?")->execute([$conv['id']]);
    audit((int)$user['id'], 'conversation_closed', 'conversation', (int)$conv['id']);
    respond(['ok' => true]);
}

fail('Unknown action.', 404);

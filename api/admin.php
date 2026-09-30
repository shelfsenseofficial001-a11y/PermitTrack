<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/business.php'; // PERMIT_ELIGIBILITY (permit types) + audit()

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$admin = require_role('admin');

/** Readable temporary password (no 0/O/1/l), always with a letter and a digit. */
function temporary_password(): string
{
    $letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    $digits = '23456789';
    $all = $letters . $digits;
    $chars = [$letters[random_int(0, strlen($letters) - 1)], $digits[random_int(0, strlen($digits) - 1)]];
    while (count($chars) < 12) {
        $chars[] = $all[random_int(0, strlen($all) - 1)];
    }
    shuffle($chars);
    return implode('', $chars);
}

function find_user(int $id): array
{
    $stmt = db()->prepare('SELECT id, role, email, full_name, is_active FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if (!$u) {
        fail('Account not found.', 404);
    }
    return $u;
}

function active_admin_count(): int
{
    return (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1")->fetchColumn();
}

function valid_department_id($value): ?int
{
    if ($value === null || $value === '' || (int)$value === 0) {
        return null;
    }
    $stmt = db()->prepare('SELECT id FROM departments WHERE id = ?');
    $stmt->execute([(int)$value]);
    if (!$stmt->fetch()) {
        fail('Please choose a valid department.');
    }
    return (int)$value;
}

// ---------- Overview ----------

if ($action === 'summary' && $method === 'GET') {
    $one = fn(string $sql) => (int)db()->query($sql)->fetchColumn();
    respond([
        'staff' => $one("SELECT COUNT(*) FROM users WHERE role = 'staff' AND is_active = 1"),
        'admins' => $one("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1"),
        'public_accounts' => $one("SELECT COUNT(*) FROM users WHERE role = 'applicant'"),
        'residents' => $one("SELECT COUNT(*) FROM users WHERE role = 'applicant' AND resident_status = 'verified'"),
        'verified_businesses' => $one("SELECT COUNT(*) FROM businesses WHERE status = 'approved'"),
        'pending_verifications' => $one("SELECT COUNT(*) FROM resident_verifications WHERE status = 'pending'")
            + $one("SELECT COUNT(*) FROM businesses WHERE status = 'pending'"),
        'open_applications' => $one("SELECT COUNT(*) FROM applications WHERE status NOT IN ('Approved','Rejected')"),
        'deactivated' => $one('SELECT COUNT(*) FROM users WHERE is_active = 0'),
    ]);
}

// ---------- Staff accounts ----------

if ($action === 'staff' && $method === 'GET') {
    $rows = db()->query(
        "SELECT u.id, u.role, u.email, u.first_name, u.last_name, u.full_name, u.department_id, d.name AS department_name,
                u.is_active, u.must_change_password, u.last_login_at, u.created_at
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.role IN ('staff','admin') ORDER BY u.is_active DESC, u.role = 'admin' DESC, u.full_name"
    )->fetchAll();
    respond(['staff' => $rows, 'me' => (int)$admin['id']]);
}

if ($action === 'staff_create' && $method === 'POST') {
    $in = json_input();
    $first = trim((string)($in['first_name'] ?? ''));
    $last = trim((string)($in['last_name'] ?? ''));
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $role = ($in['role'] ?? 'staff') === 'admin' ? 'admin' : 'staff';
    $departmentId = valid_department_id($in['department_id'] ?? null);

    if ($first === '' || $last === '') {
        fail('First and last name are required.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Please enter a valid email address.');
    }
    $dupe = db()->prepare('SELECT id FROM users WHERE email = ?');
    $dupe->execute([$email]);
    if ($dupe->fetch()) {
        fail('An account with that email already exists.');
    }

    $password = temporary_password();
    db()->prepare(
        "INSERT INTO users (role, account_type, department_id, email, password_hash, must_change_password, full_name, first_name, last_name, onboarding_completed, email_verified_at)
         VALUES (?, 'staff', ?, ?, ?, 1, ?, ?, ?, 1, NOW())"
    )->execute([$role, $departmentId, $email, password_hash($password, PASSWORD_BCRYPT), "$first $last", $first, $last]);
    $id = (int)db()->lastInsertId();
    audit((int)$admin['id'], 'admin.staff_created', 'user', $id, "$first $last ($role)");

    // Shown once to the Admin to pass on; the user must change it at first sign-in
    respond(['id' => $id, 'temporary_password' => $password], 201);
}

if ($action === 'staff_update' && $method === 'POST') {
    $in = json_input();
    $target = find_user((int)($in['id'] ?? 0));
    if (!in_array($target['role'], ['staff', 'admin'], true)) {
        fail('Only staff accounts can be edited here.');
    }
    $first = trim((string)($in['first_name'] ?? ''));
    $last = trim((string)($in['last_name'] ?? ''));
    $role = ($in['role'] ?? $target['role']) === 'admin' ? 'admin' : 'staff';
    $departmentId = valid_department_id($in['department_id'] ?? null);
    if ($first === '' || $last === '') {
        fail('First and last name are required.');
    }
    if ((int)$target['id'] === (int)$admin['id'] && $role !== 'admin') {
        fail("You can't remove your own Admin role. Ask another Admin to do it.");
    }
    if ($target['role'] === 'admin' && $role !== 'admin' && (int)$target['is_active'] && active_admin_count() <= 1) {
        fail('There must always be at least one active Admin.');
    }

    db()->prepare('UPDATE users SET first_name = ?, last_name = ?, full_name = ?, role = ?, department_id = ? WHERE id = ?')
        ->execute([$first, $last, "$first $last", $role, $departmentId, $target['id']]);
    $changes = [];
    if ($role !== $target['role']) {
        $changes[] = "role {$target['role']} → $role";
    }
    audit((int)$admin['id'], 'admin.staff_updated', 'user', (int)$target['id'], $changes ? implode('; ', $changes) : null);
    respond(['ok' => true]);
}

// Works for any account (staff or public): deactivated accounts can't sign in
if ($action === 'set_active' && $method === 'POST') {
    $in = json_input();
    $target = find_user((int)($in['id'] ?? 0));
    $active = (bool)($in['active'] ?? false);
    $reason = trim((string)($in['reason'] ?? ''));
    if ((int)$target['id'] === (int)$admin['id']) {
        fail("You can't deactivate your own account.");
    }
    if (!$active && $target['role'] === 'admin' && (int)$target['is_active'] && active_admin_count() <= 1) {
        fail('There must always be at least one active Admin.');
    }
    if (!$active && mb_strlen($reason) < 3) {
        fail('Please give a reason for deactivating this account.');
    }
    db()->prepare('UPDATE users SET is_active = ? WHERE id = ?')->execute([$active ? 1 : 0, $target['id']]);
    audit((int)$admin['id'], $active ? 'admin.account_reactivated' : 'admin.account_deactivated', 'user', (int)$target['id'], $active ? null : $reason);
    respond(['ok' => true]);
}

if ($action === 'reset_password' && $method === 'POST') {
    $target = find_user((int)(json_input()['id'] ?? 0));
    if ((int)$target['id'] === (int)$admin['id']) {
        fail('Use "Change password" to change your own password.');
    }
    $password = temporary_password();
    db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_BCRYPT), $target['id']]);
    audit((int)$admin['id'], 'admin.password_reset', 'user', (int)$target['id']);
    respond(['temporary_password' => $password]);
}

// ---------- Departments ----------

if ($action === 'departments' && $method === 'GET') {
    $rows = db()->query(
        "SELECT d.*, (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.is_active = 1) AS staff_count
         FROM departments d ORDER BY d.is_active DESC, d.name"
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['permit_types'] = array_values(array_filter(explode(',', $r['permit_types'])));
    }
    unset($r);
    respond(['departments' => $rows, 'permit_types' => array_keys(PERMIT_ELIGIBILITY)]);
}

if ($action === 'department_save' && $method === 'POST') {
    $in = json_input();
    $id = (int)($in['id'] ?? 0);
    $name = trim((string)($in['name'] ?? ''));
    $code = strtoupper(trim((string)($in['code'] ?? '')));
    $description = trim((string)($in['description'] ?? ''));
    $active = (bool)($in['is_active'] ?? true);
    $types = array_values(array_intersect(array_keys(PERMIT_ELIGIBILITY), (array)($in['permit_types'] ?? [])));

    if ($name === '') {
        fail('Department name is required.');
    }
    if (!preg_match('/^[A-Z0-9-]{2,20}$/', $code)) {
        fail('Code must be 2–20 letters or numbers, e.g. BPLO.');
    }
    $dupe = db()->prepare('SELECT id FROM departments WHERE code = ? AND id <> ?');
    $dupe->execute([$code, $id]);
    if ($dupe->fetch()) {
        fail('Another department already uses that code.');
    }

    if ($id) {
        db()->prepare('UPDATE departments SET name = ?, code = ?, description = ?, permit_types = ?, is_active = ? WHERE id = ?')
            ->execute([$name, $code, $description ?: null, implode(',', $types), $active ? 1 : 0, $id]);
        audit((int)$admin['id'], 'admin.department_updated', 'department', $id, $name);
    } else {
        db()->prepare('INSERT INTO departments (name, code, description, permit_types, is_active) VALUES (?, ?, ?, ?, ?)')
            ->execute([$name, $code, $description ?: null, implode(',', $types), $active ? 1 : 0]);
        $id = (int)db()->lastInsertId();
        audit((int)$admin['id'], 'admin.department_created', 'department', $id, $name);
    }
    respond(['id' => $id]);
}

// ---------- Public accounts ----------

if ($action === 'users' && $method === 'GET') {
    $q = trim((string)($_GET['q'] ?? ''));
    $filter = (string)($_GET['filter'] ?? 'all');
    $where = ["u.role = 'applicant'"];
    $params = [];
    if ($q !== '') {
        $where[] = '(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
        array_push($params, "%$q%", "%$q%", '%' . preg_replace('/\D+/', '', $q) . '%');
    }
    $where[] = match ($filter) {
        'residents' => "u.resident_status = 'verified'",
        'business' => "EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = u.id AND b.status = 'approved')",
        'normal' => "u.resident_status <> 'verified' AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = u.id AND b.status = 'approved')",
        'deactivated' => 'u.is_active = 0',
        default => '1=1',
    };
    $stmt = db()->prepare(
        'SELECT u.id, u.full_name, u.email, u.phone, u.barangay, u.city, u.resident_status, u.is_active, u.created_at, u.last_login_at,
                u.email_verified_at, u.phone_verified_at,
                (SELECT COUNT(*) FROM businesses b WHERE b.user_id = u.id AND b.status = \'approved\') AS approved_businesses,
                (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS applications
         FROM users u WHERE ' . implode(' AND ', $where) . ' ORDER BY u.created_at DESC LIMIT 200'
    );
    $stmt->execute($params);
    $rows = array_map(function (array $u) {
        $labels = [];
        if ($u['resident_status'] === 'verified') {
            $labels[] = 'Resident';
        }
        if ((int)$u['approved_businesses'] > 0) {
            $labels[] = 'Business Owner';
        }
        $u['levels'] = $labels ?: ['Normal User'];
        return $u;
    }, $stmt->fetchAll());
    respond(['users' => $rows]);
}

// ---------- Chat bot (FAQ answers + what people ask) ----------

if ($action === 'faq' && $method === 'GET') {
    $rows = db()->query(
        'SELECT f.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.matched_faq_id = f.id) AS times_used
         FROM faq_entries f ORDER BY f.is_active DESC, f.sort_order, f.id'
    )->fetchAll();
    $stats = db()->query(
        "SELECT COUNT(*) AS total, SUM(intent <> 'fallback') AS answered,
                SUM(created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS last_7_days FROM chat_messages"
    )->fetch();
    // Questions the bot couldn't answer, most asked first
    $unanswered = db()->query(
        "SELECT LOWER(TRIM(message)) AS message, COUNT(*) AS times, MAX(created_at) AS last_asked
         FROM chat_messages WHERE intent = 'fallback' GROUP BY LOWER(TRIM(message)) ORDER BY times DESC, last_asked DESC LIMIT 50"
    )->fetchAll();
    respond(['faqs' => $rows, 'stats' => $stats, 'unanswered' => $unanswered]);
}

if ($action === 'faq_save' && $method === 'POST') {
    $in = json_input();
    $id = (int)($in['id'] ?? 0);
    $question = trim((string)($in['question'] ?? ''));
    $answer = trim((string)($in['answer'] ?? ''));
    $questionTl = trim((string)($in['question_tl'] ?? ''));
    $answerTl = trim((string)($in['answer_tl'] ?? ''));
    $keywords = implode(',', array_filter(array_map('trim', explode(',', mb_strtolower((string)($in['keywords'] ?? ''))))));
    $category = trim((string)($in['category'] ?? '')) ?: 'General';
    $linkPath = trim((string)($in['link_path'] ?? ''));
    $linkLabel = trim((string)($in['link_label'] ?? ''));
    $sortOrder = (int)($in['sort_order'] ?? 100);
    $active = (bool)($in['is_active'] ?? true);

    if ($question === '' || $answer === '') {
        fail('Question and answer are required.');
    }
    if ($keywords === '') {
        fail('Add a few keywords people might type, separated by commas.');
    }
    // Links must stay inside the app
    if ($linkPath !== '' && !preg_match('#^/[a-z0-9/_-]*$#i', $linkPath)) {
        fail('Link must be an app page such as /residency or /businesses/new.');
    }
    $dupe = db()->prepare('SELECT id FROM faq_entries WHERE question = ? AND id <> ?');
    $dupe->execute([$question, $id]);
    if ($dupe->fetch()) {
        fail('Another answer already uses that question.');
    }

    $values = [mb_substr($category, 0, 40), mb_substr($question, 0, 255), $questionTl !== '' ? mb_substr($questionTl, 0, 255) : null,
               $answer, $answerTl !== '' ? $answerTl : null, mb_substr($keywords, 0, 600),
               $linkPath ?: null, $linkPath ? (mb_substr($linkLabel, 0, 60) ?: 'Open') : null, $sortOrder, $active ? 1 : 0];
    if ($id) {
        db()->prepare('UPDATE faq_entries SET category = ?, question = ?, question_tl = ?, answer = ?, answer_tl = ?, keywords = ?, link_path = ?, link_label = ?, sort_order = ?, is_active = ? WHERE id = ?')
            ->execute([...$values, $id]);
        audit((int)$admin['id'], 'admin.faq_updated', 'faq', $id, $question);
    } else {
        db()->prepare('INSERT INTO faq_entries (category, question, question_tl, answer, answer_tl, keywords, link_path, link_label, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute($values);
        $id = (int)db()->lastInsertId();
        audit((int)$admin['id'], 'admin.faq_created', 'faq', $id, $question);
    }
    respond(['id' => $id]);
}

// Try a question against the current answers without logging it
if ($action === 'faq_test' && $method === 'POST') {
    require_once __DIR__ . '/lib/chatbot.php';
    $reply = chatbot_reply(mb_substr(trim((string)(json_input()['message'] ?? '')), 0, 500), null);
    respond(['reply' => $reply]);
}

// ---------- Audit log ----------

if ($action === 'audit' && $method === 'GET') {
    $where = ['1=1'];
    $params = [];
    $category = (string)($_GET['category'] ?? '');
    if (in_array($category, ['residency', 'business', 'admin'], true)) {
        $where[] = 'a.action LIKE ?';
        $params[] = "$category.%";
    }
    if (!empty($_GET['actor'])) {
        $where[] = 'u.full_name LIKE ?';
        $params[] = '%' . trim((string)$_GET['actor']) . '%';
    }
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 50;

    $count = db()->prepare('SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE ' . implode(' AND ', $where));
    $count->execute($params);
    $total = (int)$count->fetchColumn();

    $stmt = db()->prepare(
        "SELECT a.id, a.action, a.subject_type, a.subject_id, a.details, a.created_at, u.full_name AS actor, u.role AS actor_role,
                CASE a.subject_type
                    WHEN 'user' THEN (SELECT full_name FROM users x WHERE x.id = a.subject_id)
                    WHEN 'department' THEN (SELECT name FROM departments x WHERE x.id = a.subject_id)
                    WHEN 'business' THEN (SELECT business_name FROM businesses x WHERE x.id = a.subject_id)
                    WHEN 'faq' THEN (SELECT question FROM faq_entries x WHERE x.id = a.subject_id)
                    WHEN 'resident_verification' THEN (SELECT x2.full_name FROM resident_verifications x JOIN users x2 ON x2.id = x.user_id WHERE x.id = a.subject_id)
                END AS subject_name
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
         WHERE " . implode(' AND ', $where) . ' ORDER BY a.id DESC LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage)
    );
    $stmt->execute($params);
    respond(['entries' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $perPage]);
}

fail('Unknown action.', 404);

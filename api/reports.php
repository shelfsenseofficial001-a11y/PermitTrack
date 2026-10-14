<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/support.php';

// Section 4 (mockup 4): a staff member flags an applicant's behaviour while reviewing their
// application -- separate from rejecting one of their documents (documents.php), which is about
// a single file, not the person. Always tied to the application being reviewed, so the reported
// user is never ambiguous; a specific document is optional.

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'create' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $applicationId = (int)($in['application_id'] ?? 0);
    $category = (string)($in['category'] ?? '');
    $description = trim((string)($in['description'] ?? ''));
    $documentId = (int)($in['document_id'] ?? 0) ?: null;

    if (!isset(USER_REPORT_CATEGORIES[$category])) {
        fail('Please choose a category.');
    }
    if ($description === '') {
        fail('Please describe what happened.');
    }
    if (mb_strlen($description) > 2000) {
        fail('Please keep the description under 2000 characters.');
    }

    $appStmt = db()->prepare('SELECT applicant_id FROM applications WHERE id = ?');
    $appStmt->execute([$applicationId]);
    $app = $appStmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }

    if ($documentId) {
        $docStmt = db()->prepare('SELECT id FROM application_documents WHERE id = ? AND application_id = ?');
        $docStmt->execute([$documentId, $applicationId]);
        if (!$docStmt->fetchColumn()) {
            fail('That document does not belong to this application.');
        }
    }

    $stmt = db()->prepare(
        'INSERT INTO user_reports (reported_user_id, reported_by, category, description, application_id, document_id)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([(int)$app['applicant_id'], $user['id'], $category, $description, $applicationId, $documentId]);

    respond(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
}

if ($action === 'list' && $method === 'GET') {
    require_role('admin');
    $status = (string)($_GET['status'] ?? 'open');
    $where = in_array($status, ['open', 'actioned', 'dismissed'], true) ? 'r.status = ?' : '1=1';
    $params = in_array($status, ['open', 'actioned', 'dismissed'], true) ? [$status] : [];

    $stmt = db()->prepare(
        "SELECT r.*, ru.full_name AS reported_user_name, ru.email AS reported_user_email,
                rb.full_name AS reported_by_name, a.property_address, pt.name AS permit_type_name,
                d.doc_name AS document_name, res.full_name AS resolved_by_name
           FROM user_reports r
           JOIN users ru ON ru.id = r.reported_user_id
           JOIN users rb ON rb.id = r.reported_by
           LEFT JOIN applications a ON a.id = r.application_id
           LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
           LEFT JOIN application_documents d ON d.id = r.document_id
           LEFT JOIN users res ON res.id = r.resolved_by
          WHERE $where
          ORDER BY r.created_at DESC"
    );
    $stmt->execute($params);
    $counts = db()->query(
        "SELECT status, COUNT(*) c FROM user_reports GROUP BY status"
    )->fetchAll();
    $countMap = ['open' => 0, 'actioned' => 0, 'dismissed' => 0];
    foreach ($counts as $c) {
        $countMap[$c['status']] = (int)$c['c'];
    }
    respond(['reports' => $stmt->fetchAll(), 'counts' => $countMap]);
}

if ($action === 'update_status' && $method === 'POST') {
    $user = require_role('admin');
    $in = json_input();
    $id = (int)($in['id'] ?? 0);
    $status = (string)($in['status'] ?? '');
    if (!in_array($status, ['open', 'actioned', 'dismissed'], true)) {
        fail('Invalid status.');
    }
    $stmt = db()->prepare('SELECT id FROM user_reports WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) {
        fail('Report not found.', 404);
    }
    db()->prepare('UPDATE user_reports SET status = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?')
        ->execute([$status, $user['id'], $id]);
    respond(['ok' => true]);
}

// How many open reports exist against a user -- the flag/badge staff see on an account
// (ReviewDetail.js's applicant card, Admin.js's user list).
if ($action === 'count_for_user' && $method === 'GET') {
    require_role('staff');
    $userId = (int)($_GET['user_id'] ?? 0);
    $stmt = db()->prepare("SELECT COUNT(*) FROM user_reports WHERE reported_user_id = ? AND status = 'open'");
    $stmt->execute([$userId]);
    respond(['open_reports' => (int)$stmt->fetchColumn()]);
}

fail('Unknown action.', 404);

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Stages in stepper order, used to derive step index and "needs attention" flags.
const STAGES = ['Submitted', 'Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved'];

function stage_index(string $status): int
{
    $i = array_search($status, STAGES, true);
    return $i === false ? 0 : $i;
}

function application_summary(array $app): array
{
    $app['stage_index'] = stage_index($app['status']);
    $app['stages'] = STAGES;
    return $app;
}

if ($action === 'required_documents' && $method === 'GET') {
    $type = (string)($_GET['type'] ?? '');
    respond(['documents' => required_documents_for($type)]);
}

if ($action === 'list' && $method === 'GET') {
    $user = require_role('applicant');
    $stmt = db()->prepare('SELECT * FROM applications WHERE applicant_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    $apps = array_map('application_summary', $stmt->fetchAll());

    // Any document flagged "Needs Re-upload" blocks progress and surfaces an alert.
    foreach ($apps as &$app) {
        $docStmt = db()->prepare("SELECT COUNT(*) c FROM application_documents WHERE application_id = ? AND status = 'Needs Re-upload'");
        $docStmt->execute([$app['id']]);
        $app['blocked'] = (int)$docStmt->fetch()['c'] > 0;
    }
    unset($app);

    respond(['applications' => $apps]);
}

if ($action === 'stats' && $method === 'GET') {
    $user = require_role('applicant');
    $pdo = db();

    $active = $pdo->prepare("SELECT COUNT(*) c FROM applications WHERE applicant_id = ? AND status NOT IN ('Approved','Rejected')");
    $active->execute([$user['id']]);

    $needsAttention = $pdo->prepare(
        "SELECT COUNT(DISTINCT a.id) c FROM applications a
         JOIN application_documents d ON d.application_id = a.id
         WHERE a.applicant_id = ? AND d.status = 'Needs Re-upload'"
    );
    $needsAttention->execute([$user['id']]);

    $approvedThisYear = $pdo->prepare(
        "SELECT COUNT(*) c FROM applications WHERE applicant_id = ? AND status = 'Approved' AND YEAR(updated_at) = YEAR(CURDATE())"
    );
    $approvedThisYear->execute([$user['id']]);

    respond([
        'active_applications' => (int)$active->fetch()['c'],
        'needs_attention' => (int)$needsAttention->fetch()['c'],
        'approved_this_year' => (int)$approvedThisYear->fetch()['c'],
    ]);
}

if ($action === 'detail' && $method === 'GET') {
    $user = require_auth();
    $id = (int)($_GET['id'] ?? 0);

    $stmt = db()->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$id]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }
    if ($user['role'] === 'applicant' && (int)$app['applicant_id'] !== (int)$user['id']) {
        fail('Forbidden', 403);
    }

    $applicantStmt = db()->prepare(
        'SELECT u.full_name, u.email, u.account_type, bp.business_name, bp.ein, bp.phone, bp.address
         FROM users u LEFT JOIN business_profiles bp ON bp.user_id = u.id WHERE u.id = ?'
    );
    $applicantStmt->execute([$app['applicant_id']]);
    $app['applicant'] = $applicantStmt->fetch();

    $docsStmt = db()->prepare('SELECT * FROM application_documents WHERE application_id = ? ORDER BY id');
    $docsStmt->execute([$id]);
    $app['documents'] = $docsStmt->fetchAll();

    respond(['application' => application_summary($app)]);
}

if ($action === 'create' && $method === 'POST') {
    $user = require_role('applicant');

    $permitType = trim((string)($_POST['permit_type'] ?? ''));
    $propertyAddress = trim((string)($_POST['property_address'] ?? ''));
    $businessName = trim((string)($_POST['business_name'] ?? ''));
    $description = trim((string)($_POST['project_description'] ?? ''));

    $validTypes = ['Food Service', 'Building/Renovation', 'Sign', 'Business License', 'Special Event'];
    if (!in_array($permitType, $validTypes, true)) {
        fail('Please choose a valid permit type.');
    }
    if ($propertyAddress === '') {
        fail('Property address is required.');
    }

    // Food Service and Special Event permits carry higher public-safety risk, so they start High Priority.
    $priority = in_array($permitType, ['Food Service', 'Special Event'], true) ? 'High Priority' : 'Standard';

    $pdo = db();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO applications (applicant_id, permit_type, property_address, business_name, project_description, priority)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$user['id'], $permitType, $propertyAddress, $businessName ?: null, $description ?: null, $priority]);
    $appId = (int)$pdo->lastInsertId();

    $required = required_documents_for($permitType);
    $uploadDir = __DIR__ . '/../uploads/' . $appId;
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $docStmt = $pdo->prepare(
        'INSERT INTO application_documents (application_id, doc_name, file_path, original_filename, status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    foreach ($required as $docName) {
        $fileKey = 'doc_' . preg_replace('/[^a-zA-Z0-9]+/', '_', $docName);
        $filePath = null;
        $originalName = null;
        $status = 'Missing';
        $uploadedAt = null;

        if (isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
            $originalName = basename($_FILES[$fileKey]['name']);
            $safeName = uniqid('doc_', true) . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName);
            $dest = $uploadDir . '/' . $safeName;
            move_uploaded_file($_FILES[$fileKey]['tmp_name'], $dest);
            $filePath = 'uploads/' . $appId . '/' . $safeName;
            $status = 'Pending Review';
            $uploadedAt = date('Y-m-d H:i:s');
        }

        $docStmt->execute([$appId, $docName, $filePath, $originalName, $status, $uploadedAt]);
    }

    $activityStmt = $pdo->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'status_change', ?)"
    );
    $activityStmt->execute([$appId, $user['id'], 'Application submitted.']);

    $pdo->commit();

    respond(['application_id' => $appId], 201);
}

fail('Unknown action.', 404);

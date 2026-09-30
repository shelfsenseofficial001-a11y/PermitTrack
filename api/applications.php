<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/business.php';
require __DIR__ . '/lib/pipeline.php';

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

// Which permit types this user can file, and for which of their businesses
if ($action === 'eligibility' && $method === 'GET') {
    $user = require_role('applicant');
    $isResident = in_array('Resident', $user['levels'], true);
    $businesses = approved_businesses((int)$user['id']);
    $types = [];
    foreach (PERMIT_ELIGIBILITY as $type => $rule) {
        $types[] = [
            'value' => $type,
            'as_resident' => $rule['resident'] && $isResident,
            'as_business' => $rule['business'] && count($businesses) > 0,
            'business_only' => !$rule['resident'],
        ];
    }
    respond(['permit_types' => $types, 'businesses' => $businesses, 'is_resident' => $isResident]);
}

// New pipeline-driven permit type list (27 types, with branch questions). Additive —
// the old 'eligibility' action above is untouched and still what today's NewApplication.js uses.
if ($action === 'permit_types' && $method === 'GET') {
    $user = require_role('applicant');
    $businesses = approved_businesses((int)$user['id']);
    respond(['permit_types' => eligible_permit_types($user, $businesses), 'businesses' => $businesses]);
}

if ($action === 'list' && $method === 'GET') {
    $user = require_role('applicant');
    $stmt = db()->prepare(
        'SELECT a.*, pt.name AS permit_type_name FROM applications a
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE a.applicant_id = ? ORDER BY a.created_at DESC'
    );
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

    $stmt = db()->prepare(
        'SELECT a.*, pt.name AS permit_type_name FROM applications a
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id WHERE a.id = ?'
    );
    $stmt->execute([$id]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }
    if ($user['role'] === 'applicant' && (int)$app['applicant_id'] !== (int)$user['id']) {
        fail('Forbidden', 403);
    }

    $applicantStmt = db()->prepare(
        'SELECT full_name, email, phone, resident_status, address_line, barangay, city, postal_code FROM users WHERE id = ?'
    );
    $applicantStmt->execute([$app['applicant_id']]);
    $app['applicant'] = $applicantStmt->fetch();

    // The verified business this permit was filed for, if any
    $app['business'] = null;
    if ($app['business_id']) {
        $bizStmt = db()->prepare(
            'SELECT id, status, business_name, trade_name, ownership_type, line_of_business, registration_number, tin,
                    address_line, barangay, city, postal_code, business_email, business_phone
             FROM businesses WHERE id = ?'
        );
        $bizStmt->execute([$app['business_id']]);
        $app['business'] = $bizStmt->fetch() ?: null;
        if ($app['business']) {
            $app['business']['ownership_label'] = OWNERSHIP_TYPES[$app['business']['ownership_type']]['label'] ?? null;
        }
    }

    $docsStmt = db()->prepare('SELECT * FROM application_documents WHERE application_id = ? ORDER BY id');
    $docsStmt->execute([$id]);
    $app['documents'] = $docsStmt->fetchAll();

    // Empty array = this application predates the pipeline (filed via the old 'create' action).
    $app['pipeline'] = pipeline_progress_for($id);

    respond(['application' => application_summary($app)]);
}

// New pipeline-driven submission path: a permit_type_id (from the 27-type catalog) instead of
// the old 5-value permit_type string, plus forced branch-question answers. Kept as a separate
// action rather than folded into 'create' below so the existing 5-type flow (and its required-
// documents/priority logic, still keyed by the old enum) is untouched. See BREAKING_CHANGES.md.
if ($action === 'create_v2' && $method === 'POST') {
    $user = require_role('applicant');
    if (!can_apply($user)) {
        fail('Only verified Residents or Business Owners can apply for permits. Verify your account first.', 403);
    }

    $permitTypeId = (int)($_POST['permit_type_id'] ?? 0);
    $propertyAddress = trim((string)($_POST['property_address'] ?? ''));
    $description = trim((string)($_POST['project_description'] ?? ''));
    $businessId = (int)($_POST['business_id'] ?? 0);
    $conditionsRaw = json_decode((string)($_POST['conditions'] ?? '{}'), true);
    $conditions = is_array($conditionsRaw) ? array_map('boolval', $conditionsRaw) : [];

    $typeStmt = db()->prepare('SELECT * FROM permit_types WHERE id = ? AND is_active = 1');
    $typeStmt->execute([$permitTypeId]);
    $permitType = $typeStmt->fetch();
    if (!$permitType) {
        fail('Please choose a valid permit type.');
    }

    $isResident = in_array('Resident', $user['levels'], true);
    $isStandalone = $permitType['track'] === 'barangay_standalone' || $permitType['track'] === 'personal';
    $business = null;
    $businessName = '';
    $barangayId = null;

    if ($businessId) {
        if ($isStandalone) {
            fail('This is a resident-only clearance and cannot be filed under a business.', 403);
        }
        foreach (approved_businesses((int)$user['id']) as $b) {
            if ((int)$b['id'] === $businessId) {
                $business = $b;
            }
        }
        if (!$business) {
            fail('Please choose one of your verified businesses.');
        }
        if (!$permitType['business_eligible']) {
            fail("A {$permitType['name']} permit can't be filed for a business.");
        }
        $businessName = $business['business_name'];
        $barangayId = $business['barangay_id'] !== null ? (int)$business['barangay_id'] : null;
        if ($propertyAddress === '') {
            $propertyAddress = "{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}";
        }
    } else {
        if (!$permitType['resident_eligible'] || ($isStandalone && !$isResident)) {
            fail("A {$permitType['name']} permit must be filed for one of your verified businesses.", 403);
        }
        if (!$isResident) {
            fail("Only verified Residents can file a {$permitType['name']} permit as an individual. Choose one of your businesses, or verify your residency.", 403);
        }
        $barangayId = $user['barangay_id'] !== null ? (int)$user['barangay_id'] : null;
        if ($propertyAddress === '' && !$isStandalone) {
            fail('Property address is required.');
        }
    }
    if ($barangayId === null) {
        fail('No barangay is on file for ' . ($business ? 'this business' : 'your account') . ' yet — this is required to route the application.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO applications (applicant_id, business_id, permit_type_id, property_address, business_name, project_description, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$user['id'], $businessId ?: null, $permitTypeId, $propertyAddress ?: 'N/A', $businessName ?: null, $description ?: null, 'Standard']);
        $appId = (int)$pdo->lastInsertId();

        instantiate_pipeline($appId, $permitTypeId, $conditions, $barangayId);

        $requiredDocs = required_documents_for_type($permitTypeId);
        if ($requiredDocs) {
            $uploadDir = __DIR__ . '/../uploads/' . $appId;
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            $docStmt = $pdo->prepare(
                'INSERT INTO application_documents (application_id, doc_name, file_path, original_filename, status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($requiredDocs as $docName) {
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
        }

        $activityStmt = $pdo->prepare(
            "INSERT INTO application_activity (application_id, sender_id, type, body) VALUES (?, ?, 'status_change', ?)"
        );
        $activityStmt->execute([$appId, $user['id'], 'Application submitted.']);

        $pdo->commit();
    } catch (RuntimeException $e) {
        $pdo->rollBack();
        fail($e->getMessage());
    }

    respond(['application_id' => $appId], 201);
}

if ($action === 'create' && $method === 'POST') {
    $user = require_role('applicant');
    // Normal Users can browse only; applying needs a verified label
    if (!can_apply($user)) {
        fail('Only verified Residents or Business Owners can apply for permits. Verify your account first.', 403);
    }

    $permitType = trim((string)($_POST['permit_type'] ?? ''));
    $propertyAddress = trim((string)($_POST['property_address'] ?? ''));
    $description = trim((string)($_POST['project_description'] ?? ''));
    $businessId = (int)($_POST['business_id'] ?? 0);

    if (!isset(PERMIT_ELIGIBILITY[$permitType])) {
        fail('Please choose a valid permit type.');
    }
    $rule = PERMIT_ELIGIBILITY[$permitType];
    $businessName = '';
    if ($businessId) {
        // Filed for a business: it must be this user's and approved
        $business = null;
        foreach (approved_businesses((int)$user['id']) as $b) {
            if ((int)$b['id'] === $businessId) {
                $business = $b;
            }
        }
        if (!$business) {
            fail('Please choose one of your verified businesses.');
        }
        if (!$rule['business']) {
            fail("A $permitType permit can't be filed for a business.");
        }
        $businessName = $business['business_name'];
        if ($propertyAddress === '') {
            $propertyAddress = "{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}";
        }
    } else {
        if (!$rule['resident']) {
            fail("A $permitType permit must be filed for one of your verified businesses.");
        }
        if (!in_array('Resident', $user['levels'], true)) {
            fail("Only verified Residents can file a $permitType permit as an individual. Choose one of your businesses, or verify your residency.", 403);
        }
    }
    if ($propertyAddress === '') {
        fail('Property address is required.');
    }

    // Food Service and Special Event permits carry higher public-safety risk, so they start High Priority.
    $priority = in_array($permitType, ['Food Service', 'Special Event'], true) ? 'High Priority' : 'Standard';

    $pdo = db();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO applications (applicant_id, business_id, permit_type, property_address, business_name, project_description, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$user['id'], $businessId ?: null, $permitType, $propertyAddress, $businessName ?: null, $description ?: null, $priority]);
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

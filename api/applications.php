<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/business.php';
require __DIR__ . '/lib/pipeline.php';
require_once __DIR__ . '/lib/support.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Stages in stepper order, used to derive step index and "needs attention" flags.
const STAGES = ['Submitted', 'Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved'];

function stage_index(string $status): int
{
    $i = array_search($status, STAGES, true);
    return $i === false ? 0 : $i;
}

/** The ceiling on anything attached to an application. Mirrored in assets/js (MAX_UPLOAD_MB). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * An application can still be corrected by the applicant only while it is sitting in the queue
 * untouched. Once a reviewer has it, changes go through them instead.
 */
function application_is_editable(array $app): bool
{
    return $app['status'] === 'Submitted' && empty($app['assigned_reviewer_id']);
}

function application_summary(array $app): array
{
    $app['stage_index'] = stage_index($app['status']);
    $app['stages'] = STAGES;
    // permit_type is the pre-v2 free-text column and is NULL on anything filed since; the name now
    // lives on permit_types. Fall back so every caller gets a usable label.
    if (empty($app['permit_type']) && !empty($app['permit_type_name'])) {
        $app['permit_type'] = $app['permit_type_name'];
    }
    $app['editable'] = application_is_editable($app);
    return $app;
}

/** One of this applicant's own applications, or a 404. Never leaks someone else's by id. */
function own_application(int $id, array $user): array
{
    $stmt = db()->prepare(
        'SELECT a.*, pt.name AS permit_type_name, pt.track AS track FROM applications a
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE a.id = ? AND a.applicant_id = ?'
    );
    $stmt->execute([$id, $user['id']]);
    $app = $stmt->fetch();
    if (!$app) {
        fail('Application not found.', 404);
    }
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
    respond([
        'permit_types' => eligible_permit_types($user, $businesses),
        'businesses' => $businesses,
        // Every barangay of Dasmariñas, for the address picker. The one the applicant is
        // registered in is the sensible default, but any of them can be chosen.
        'barangays' => barangay_options(),
        'default_barangay_id' => $user['barangay_id'] !== null ? (int)$user['barangay_id'] : null,
    ]);
}

if ($action === 'list' && $method === 'GET') {
    $user = require_role('applicant');
    $stmt = db()->prepare(
        'SELECT a.*, pt.name AS permit_type_name, pt.track AS track FROM applications a
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE a.applicant_id = ? ORDER BY a.created_at DESC'
    );
    $stmt->execute([$user['id']]);
    $apps = array_map('application_summary', $stmt->fetchAll());

    // The real route each application takes, so a card can show its own offices instead of a fixed
    // set of stages. One query for the whole list rather than one per application.
    $routes = [];
    if ($apps) {
        $ids = implode(',', array_map(fn($a) => (int)$a['id'], $apps));
        $routeStmt = db()->query(
            "SELECT p.application_id, p.step_order, p.step_label, p.status, p.decided_at,
                    d.name AS department_name, d.code AS department_code
               FROM application_pipeline_progress p JOIN departments d ON d.id = p.department_id
              WHERE p.application_id IN ($ids) ORDER BY p.application_id, p.step_order"
        );
        foreach ($routeStmt as $row) {
            $routes[(int)$row['application_id']][] = $row;
        }
    }

    // Any document flagged "Needs Re-upload" blocks progress and surfaces an alert.
    foreach ($apps as &$app) {
        $docStmt = db()->prepare("SELECT COUNT(*) c FROM application_documents WHERE application_id = ? AND status = 'Needs Re-upload'");
        $docStmt->execute([$app['id']]);
        $app['blocked'] = (int)$docStmt->fetch()['c'] > 0;
        $app['pipeline'] = $routes[(int)$app['id']] ?? [];
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
    // Staff see a permit once it reaches their office, not before — see staff_can_access_application().
    if ($user['role'] !== 'applicant' && !staff_can_access_application($user, $id)) {
        fail('This application has not reached your office yet.', 403);
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
    $documents = $docsStmt->fetchAll();

    // Say which office rules on each document. documents.php enforces this; the reviewer screen
    // reads it so it can offer Approve/Reject only where they would actually be accepted, rather
    // than showing every reviewer buttons that answer 403. Null for pre-pipeline applications,
    // which stay open to any staff account.
    foreach ($documents as &$doc) {
        $ownerDept = document_owner_department($id, $doc['office_code'] ?: 'BARANGAY');
        $doc['owner_department_id'] = $ownerDept ? (int)$ownerDept['id'] : null;
        $doc['owner_department_name'] = $ownerDept['name'] ?? null;
        $doc['owner_step_status'] = $ownerDept['status'] ?? null;
    }
    unset($doc);

    // Where the permit is sitting, so the reviewer screen can work out which stage a document is at
    // for this viewer: the barangay's intake pass, or the owning office's decision. Mirrors the
    // $stage rule in documents.php.
    $currentStep = current_pipeline_step($id);
    $app['current_department_id'] = $currentStep ? (int)$currentStep['department_id'] : null;
    $app['intake_department_id'] = $currentStep && $currentStep['office_code'] === 'BARANGAY'
        ? (int)$currentStep['department_id']
        : null;
    $app['documents'] = $documents;

    // Empty array = this application predates the pipeline (filed via the old 'create' action).
    $app['pipeline'] = pipeline_progress_for($id);

    respond(['application' => application_summary($app)]);
}

// New pipeline-driven submission path: a permit_type_id (from the 27-type catalog) instead of
// the old 5-value permit_type string, plus forced branch-question answers. Kept as a separate
// action rather than folded into 'create' below so the existing 5-type flow (and its required-
// documents/priority logic, still keyed by the old enum) is untouched. See BREAKING_CHANGES.md.
// Correcting a submission that nobody has picked up yet. The applicant can fix the address and the
// description; documents are replaced one at a time through documents.php?action=reupload.
if ($action === 'update' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $app = own_application((int)($in['id'] ?? 0), $user);

    if (!application_is_editable($app)) {
        fail($app['status'] === 'Withdrawn'
            ? 'This application was withdrawn, so it can no longer be edited.'
            : 'This application is already being reviewed, so it can no longer be edited. Message your reviewer instead.', 409);
    }

    $address = trim((string)($in['property_address'] ?? ''));
    $description = trim((string)($in['project_description'] ?? ''));

    // Only the tracks that collect an address require one; the rest store 'N/A'
    $needsAddress = in_array($app['track'] ?? '', ['construction', 'business'], true)
        || (!empty($app['property_address']) && $app['property_address'] !== 'N/A');
    if ($needsAddress && $address === '') {
        fail('Property address is required.');
    }

    db()->prepare('UPDATE applications SET property_address = ?, project_description = ? WHERE id = ?')
        ->execute([$address !== '' ? $address : 'N/A', $description !== '' ? $description : null, $app['id']]);

    db()->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'edited', ?)"
    )->execute([$app['id'], $user['id'], 'Applicant updated the application details.']);

    respond(['ok' => true]);
}

// Taking an application back out of the queue. The record and its history stay; only the review
// stops. Allowed on the same terms as editing — nobody has started on it yet.
if ($action === 'withdraw' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $app = own_application((int)($in['id'] ?? 0), $user);

    if ($app['status'] === 'Withdrawn') {
        respond(['ok' => true]);
    }
    if (!application_is_editable($app)) {
        fail('This application is already being reviewed and can no longer be withdrawn. Message your reviewer instead.', 409);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE applications SET status = 'Withdrawn', withdrawn_at = NOW() WHERE id = ?")->execute([$app['id']]);
        // Nothing is left waiting on an office once the applicant has pulled it.
        $pdo->prepare("UPDATE application_pipeline_progress SET status = 'skipped' WHERE application_id = ? AND status IN ('current','pending')")
            ->execute([$app['id']]);
        $pdo->prepare(
            "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'withdrawn', ?)"
        )->execute([$app['id'], $user['id'], 'Applicant withdrew this application.']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    respond(['ok' => true]);
}
if ($action === 'create_v2' && $method === 'POST') {
    $user = require_role('applicant');
    if (!can_apply($user)) {
        fail('Only verified Residents or Business Owners can apply for permits. Verify your account first.', 403);
    }

    // One submission can cover several permits. Each becomes its own application — an application
    // carries exactly one permit_type_id and instantiates its own route — but they share the filing
    // details, and where two permits ask for the same document the one upload serves both.
    $idsRaw = json_decode((string)($_POST['permit_type_ids'] ?? '[]'), true);
    $permitTypeIds = is_array($idsRaw)
        ? array_values(array_unique(array_filter(array_map('intval', $idsRaw))))
        : [];
    if (!$permitTypeIds && (int)($_POST['permit_type_id'] ?? 0)) {
        $permitTypeIds = [(int)$_POST['permit_type_id']];
    }
    if (!$permitTypeIds) {
        fail('Please choose at least one permit.');
    }
    if (count($permitTypeIds) > 10) {
        fail('You can file up to 10 permits in one go.');
    }
    $propertyAddress = trim((string)($_POST['property_address'] ?? ''));
    $description = trim((string)($_POST['project_description'] ?? ''));
    $businessId = (int)($_POST['business_id'] ?? 0);
    // The barangay the permit is ABOUT, which is not necessarily where the applicant lives.
    $chosenBarangayId = (int)($_POST['barangay_id'] ?? 0);
    $conditionsRaw = json_decode((string)($_POST['conditions'] ?? '{}'), true);
    $conditions = is_array($conditionsRaw) ? array_map('boolval', $conditionsRaw) : [];

    $typeStmt = db()->prepare('SELECT * FROM permit_types WHERE id = ? AND is_active = 1');
    $permitTypes = [];
    foreach ($permitTypeIds as $id) {
        $typeStmt->execute([$id]);
        $row = $typeStmt->fetch();
        if (!$row) {
            fail('Please choose a valid permit type.');
        }
        $permitTypes[] = $row;
    }
    // Eligibility, the address and the barangay are checked against each permit in turn, because
    // a selection can mix tracks; whichever is strictest wins.
    $permitType = $permitTypes[0];

    $isResident = in_array('Resident', $user['levels'], true);
    $isStandalone = false;
    foreach ($permitTypes as $pt) {
        if ($pt['track'] === 'barangay_standalone' || $pt['track'] === 'personal') {
            $isStandalone = true;
        }
    }
    $business = null;
    $businessName = '';
    $barangayId = null;

    if ($businessId) {
        if ($isStandalone) {
            fail('A resident-only clearance cannot be filed under a business. File it separately, as yourself.', 403);
        }
        foreach (approved_businesses((int)$user['id']) as $b) {
            if ((int)$b['id'] === $businessId) {
                $business = $b;
            }
        }
        if (!$business) {
            fail('Please choose one of your verified businesses.');
        }
        foreach ($permitTypes as $pt) {
            if (!$pt['business_eligible']) {
                fail("A {$pt['name']} permit can't be filed for a business.");
            }
        }
        $businessName = $business['business_name'];
        $barangayId = $business['barangay_id'] !== null ? (int)$business['barangay_id'] : null;
        if ($propertyAddress === '') {
            // Postal code is optional, so trim rather than leave a dangling separator.
            $propertyAddress = rtrim("{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}");
        }
    } else {
        foreach ($permitTypes as $pt) {
            if (!$pt['resident_eligible']) {
                fail("A {$pt['name']} permit must be filed for one of your verified businesses.", 403);
            }
        }
        if (!$isResident) {
            fail('Only verified Residents can file these permits as an individual. Choose one of your businesses, or verify your residency.', 403);
        }
        $barangayId = $user['barangay_id'] !== null ? (int)$user['barangay_id'] : null;
        $needsAddress = false;
        foreach ($permitTypes as $pt) {
            if ($pt['track'] === 'construction' || $pt['track'] === 'business') {
                $needsAddress = true;
            }
        }
        if ($propertyAddress === '' && $needsAddress) {
            fail('Property address is required.');
        }
    }
    // A permit about a place is routed by that place. The applicant's own barangay is only the
    // default the form starts from, and it is overridden the moment the address is somewhere else.
    // Permits with no address stay with the applicant's barangay: those are about the person.
    $needsAddress = false;
    foreach ($permitTypes as $pt) {
        if ($pt['track'] === 'construction' || $pt['track'] === 'business') {
            $needsAddress = true;
        }
    }
    if ($needsAddress && $chosenBarangayId) {
        $brgyStmt = db()->prepare('SELECT id FROM barangays WHERE id = ?');
        $brgyStmt->execute([$chosenBarangayId]);
        if (!$brgyStmt->fetchColumn()) {
            fail('Please choose the barangay from the list.');
        }
        $barangayId = $chosenBarangayId;
    }

    if ($barangayId === null) {
        fail($needsAddress
            ? 'Please choose the barangay the property is in — this is what routes the application.'
            : 'No barangay is on file for ' . ($business ? 'this business' : 'your account') . ' yet — this is required to route the application.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO applications (applicant_id, business_id, permit_type_id, property_address, barangay_id, business_name, project_description, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        // An uploaded file can only be moved out of its temp location once, but the same document
        // can be required by more than one of the permits being filed. The first application to
        // need it moves it; the rest get a copy, so one upload really does serve them all.
        $movedFiles = [];
        $createdIds = [];

        foreach ($permitTypeIds as $permitTypeId) {
        $stmt->execute([$user['id'], $businessId ?: null, $permitTypeId, $propertyAddress ?: 'N/A', $barangayId, $businessName ?: null, $description ?: null, 'Standard']);
        $appId = (int)$pdo->lastInsertId();
        $createdIds[] = $appId;

        instantiate_pipeline($appId, $permitTypeId, $conditions, $barangayId);

        $requiredDocs = required_documents_for_type($permitTypeId);
        if ($requiredDocs) {
            $uploadDir = __DIR__ . '/../uploads/' . $appId;
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            // office_code travels with the document: which office reviews it is decided by the
            // catalogue at submission and then frozen, the same way the route is (migration 021).
            $handlers = [];
            $handlerStmt = db()->prepare('SELECT doc_name, office_code FROM permit_type_documents WHERE permit_type_id = ?');
            $handlerStmt->execute([$permitTypeId]);
            foreach ($handlerStmt as $h) {
                $handlers[$h['doc_name']] = $h['office_code'];
            }

            $docStmt = $pdo->prepare(
                'INSERT INTO application_documents (application_id, doc_name, office_code, file_path, original_filename, status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($requiredDocs as $docName) {
                $fileKey = 'doc_' . preg_replace('/[^a-zA-Z0-9]+/', '_', $docName);
                $filePath = null;
                $originalName = null;
                $status = 'Missing';
                $uploadedAt = null;
                if (isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_INI_SIZE) {
                    $pdo->rollBack();
                    fail('"' . $docName . '" is too large to upload.');
                }
                if (isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
                    if ((int)$_FILES[$fileKey]['size'] > MAX_UPLOAD_BYTES) {
                        $pdo->rollBack();
                        fail('"' . $docName . '" is larger than the 5 MB limit. Please attach a smaller file.');
                    }
                    if ($typeError = upload_type_error($_FILES[$fileKey])) {
                        $pdo->rollBack();
                        fail('"' . $docName . '": ' . $typeError);
                    }
                    $originalName = basename($_FILES[$fileKey]['name']);
                    $safeName = uniqid('doc_', true) . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName);
                    $dest = $uploadDir . '/' . $safeName;
                    if (isset($movedFiles[$fileKey])) {
                        copy($movedFiles[$fileKey], $dest);   // same paper, a second permit
                    } else {
                        move_uploaded_file($_FILES[$fileKey]['tmp_name'], $dest);
                        $movedFiles[$fileKey] = $dest;
                    }
                    $filePath = 'uploads/' . $appId . '/' . $safeName;
                    $status = 'Pending Review';
                    $uploadedAt = date('Y-m-d H:i:s');
                }
                $docStmt->execute([$appId, $docName, $handlers[$docName] ?? null, $filePath, $originalName, $status, $uploadedAt]);
            }
        }

        $activityStmt = $pdo->prepare(
            "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'submitted', ?)"
        );
        $activityStmt->execute([$appId, $user['id'], 'Application submitted.']);

        } // end of the per-permit loop

        $pdo->commit();
    } catch (RuntimeException $e) {
        $pdo->rollBack();
        fail($e->getMessage());
    }

    // application_id is the first one filed, so a caller that only knows about single submissions
    // still lands somewhere sensible.
    respond(['application_id' => $createdIds[0], 'application_ids' => $createdIds], 201);
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
            // Postal code is optional, so trim rather than leave a dangling separator.
            $propertyAddress = rtrim("{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}");
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
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'submitted', ?)"
    );
    $activityStmt->execute([$appId, $user['id'], 'Application submitted.']);

    $pdo->commit();

    respond(['application_id' => $appId], 201);
}

fail('Unknown action.', 404);

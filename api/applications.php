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

// Every permit that can be requested, and who it is for — a registered citizen (resident), a
// business owner, or both. Public on purpose: it is the home page's "all permits" list, and says
// nothing the permits section there doesn't already. Read-only, and only what is shown there.
if ($action === 'catalog' && $method === 'GET') {
    $rows = db()->query(
        "SELECT name, description, track, resident_eligible, business_eligible
           FROM permit_types
          WHERE is_active = 1
          ORDER BY FIELD(track, 'construction', 'business', 'personal', 'barangay_standalone'), name"
    )->fetchAll();
    respond(['permits' => array_map(fn($r) => [
        'name' => $r['name'],
        'description' => $r['description'],
        'track' => $r['track'],
        'citizen' => (bool)(int)$r['resident_eligible'],
        'business' => (bool)(int)$r['business_eligible'],
    ], $rows)]);
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

// What the "Renew" button on an approved permit needs: the renewal permit type to pre-select,
// and whether there's actually a prior approved application to pre-fill from (there always is —
// this is only offered from that permit's own card — but the endpoint re-checks rather than
// trusting the button).
if ($action === 'renewal_info' && $method === 'GET') {
    $user = require_role('applicant');
    $id = (int)($_GET['application_id'] ?? 0);
    $app = own_application($id, $user);
    if ($app['status'] !== 'Approved') {
        fail('Only an approved permit can be renewed.', 409);
    }
    $baseName = $app['permit_type_name'] ?: $app['permit_type'];
    $renewalName = RENEWABLE_PERMITS[$baseName] ?? null;
    if (!$renewalName) {
        fail('This permit type is not renewable.', 409);
    }
    $typeStmt = db()->prepare('SELECT id, name FROM permit_types WHERE name = ? AND is_active = 1');
    $typeStmt->execute([$renewalName]);
    $renewalType = $typeStmt->fetch();
    if (!$renewalType) {
        fail('This permit\'s renewal type is not set up yet.', 500);
    }

    $docsStmt = db()->prepare("SELECT id, doc_name, original_filename, file_path, status FROM application_documents WHERE application_id = ? AND file_path IS NOT NULL ORDER BY id");
    $docsStmt->execute([$app['id']]);
    $priorDocs = $docsStmt->fetchAll();

    $requiredDocs = required_documents_for_type((int)$renewalType['id']);
    $matches = match_renewal_documents($requiredDocs, $priorDocs);

    $prefilledDocs = [];
    foreach ($matches as $docName => $matchedDoc) {
        if ($matchedDoc) {
            $prefilledDocs[$docName] = [
                'id' => (int)$matchedDoc['id'],
                'original_filename' => $matchedDoc['original_filename'],
                'source_doc_name' => $matchedDoc['doc_name'],
                'status' => $matchedDoc['status'],
                'matched' => true,
            ];
        } else {
            $prefilledDocs[$docName] = [
                'matched' => false,
            ];
        }
    }

    respond([
        'renewal_permit_type_id' => (int)$renewalType['id'],
        'renewal_permit_type_name' => $renewalType['name'],
        'property_address' => $app['property_address'],
        'barangay_id' => $app['barangay_id'] !== null ? (int)$app['barangay_id'] : null,
        'business_id' => $app['business_id'] !== null ? (int)$app['business_id'] : null,
        'prefilled_documents' => $prefilledDocs,
        'due_date' => 'January 20',
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

    // The flag staff see on an account (section 4): how many OPEN reports exist against this
    // applicant, visible to staff only -- an applicant reading their own application never sees it.
    if ($user['role'] !== 'applicant') {
        $reportStmt = db()->prepare("SELECT COUNT(*) FROM user_reports WHERE reported_user_id = ? AND status = 'open'");
        $reportStmt->execute([$app['applicant_id']]);
        $app['applicant']['open_reports'] = (int)$reportStmt->fetchColumn();
    }

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

    // The registered address, pre-populated for the batch delivery form.
    // If the application is filed under a business, auto-populate from the registered business account;
    // otherwise auto-populate from the resident account's registered address.
    if (!empty($app['business'])) {
        $b = $app['business'];
        $bParts = array_filter([
            $b['address_line'] ?? '',
            !empty($b['barangay']) ? 'Brgy. ' . $b['barangay'] : '',
            $b['city'] ?? '',
            $b['postal_code'] ?? '',
        ]);
        $app['applicant_address'] = implode(', ', $bParts);
    } else {
        $addr = $app['applicant'];
        $addressParts = array_filter([
            $addr['address_line'] ?? '',
            !empty($addr['barangay']) ? 'Brgy. ' . $addr['barangay'] : '',
            $addr['city'] ?? '',
            $addr['postal_code'] ?? '',
        ]);
        $app['applicant_address'] = implode(', ', $addressParts);
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

        // The view-before-deciding gate (migration 038), from this viewer's own side: whether
        // *they* have opened and downloaded this document's current version. Staff only — an
        // applicant is never gated on their own files.
        if ($user['role'] !== 'applicant') {
            $doc['viewed_current_version'] = document_access_satisfied((int)$doc['id'], (int)$doc['version'], (int)$user['id']);
        }

        // Every prior upload, newest first, for the record (item 5/6 — revision history on both
        // the applicant's and the reviewer's screens).
        $verStmt = db()->prepare('SELECT * FROM application_document_versions WHERE document_id = ? ORDER BY version DESC');
        $verStmt->execute([$doc['id']]);
        $doc['previous_versions'] = $verStmt->fetchAll();
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

    // Section 5: a finished node that actually produced output (it owns at least one Verified
    // document) offers the applicant a delivery choice for just that node's files, the same three
    // ways as the whole-application choice below — soft copy (download in the portal, always
    // available, nothing to choose), or pickup/delivery/barangay pickup if they want a hard copy.
    foreach ($app['pipeline'] as &$step) {
        if ($step['step_label'] === 'Issued directly by the barangay') {
            $step['has_output'] = false;
            $step['delivery_method'] = null;
            $step['delivery_address'] = null;
            $step['delivery_status'] = null;
            $step['delivery_requested_at'] = null;
            continue;
        }
        $outStmt = db()->prepare(
            "SELECT id, doc_name, original_filename, file_path FROM application_documents
              WHERE application_id = ? AND COALESCE(office_code, 'BARANGAY') = ? AND status = 'Verified'"
        );
        $outStmt->execute([$id, $step['office_code']]);
        $outputDocs = $outStmt->fetchAll();
        $step['has_output'] = $step['status'] === 'approved' && count($outputDocs) > 0;
        $step['output_documents'] = $outputDocs;
    }
    unset($step);

    // Payment (section 3): present whenever this application has a fee, regardless of status, so
    // the detail page can show what was paid (or still owed) after the fact too.
    $payStmt = db()->prepare(
        'SELECT p.*, d.name AS recipient_department_name FROM payments p
          JOIN departments d ON d.id = p.recipient_department_id
         WHERE p.application_id = ? ORDER BY p.id DESC LIMIT 1'
    );
    $payStmt->execute([$id]);
    $app['payment'] = $payStmt->fetch() ?: null;

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
// The one-time pickup-vs-delivery choice, offered once a permit is Approved. Pickup needs
// nothing further; delivery snapshots an address and the current flat fee onto the application
// and starts staff's own delivery_status tracking at 'preparing'.
if ($action === 'set_delivery' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $app = own_application((int)($in['id'] ?? 0), $user);

    if ($app['status'] !== 'Approved') {
        fail('This permit is not approved yet.', 409);
    }
    if (!empty($app['delivery_method'])) {
        fail('Pickup or delivery has already been chosen for this permit.', 409);
    }

    $method2 = (string)($in['delivery_method'] ?? '');
    if (!in_array($method2, ['pickup', 'delivery', 'barangay_pickup'], true)) {
        fail('Choose pickup, delivery, or barangay pickup.');
    }

    // Delivery is free (section 5) — DELIVERY_FEE is 0.00; the column itself stays so permits
    // approved before that change still show what was actually charged on them.
    $address = null;
    $status = null;
    if ($method2 === 'delivery') {
        $address = trim((string)($in['delivery_address'] ?? ''));
        if ($address === '') {
            fail('Please give an address to deliver to.');
        }
        $status = 'preparing';
    } elseif ($method2 === 'barangay_pickup') {
        $status = 'preparing'; // still tracked — the barangay hall has to receive it before you can
    }

    db()->prepare(
        'UPDATE applications SET delivery_method = ?, delivery_address = ?, delivery_fee = ?, delivery_status = ?, delivery_requested_at = NOW() WHERE id = ?'
    )->execute([$method2, $address, DELIVERY_FEE, $status, $app['id']]);

    $body = match ($method2) {
        'pickup' => 'Applicant chose to pick up this permit at the office.',
        'barangay_pickup' => 'Applicant chose to pick up this permit at their barangay hall.',
        default => 'Applicant asked for this permit to be delivered to: ' . $address . ' (free).',
    };
    db()->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'delivery', ?)"
    )->execute([$app['id'], $user['id'], $body]);

    respond(['ok' => true]);
}

// Section 5: the per-node counterpart to 'set_delivery' below — a finished node's own files,
// rather than waiting for the whole application to reach Approved. Soft copy needs no action here
// at all (viewing/downloading already works via documents.php for anything Verified); this only
// ever records a hard-copy choice.
if ($action === 'set_node_delivery' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $stepId = (int)($in['step_id'] ?? 0);

    $stmt = db()->prepare(
        'SELECT p.*, a.applicant_id FROM application_pipeline_progress p
           JOIN applications a ON a.id = p.application_id
          WHERE p.id = ?'
    );
    $stmt->execute([$stepId]);
    $step = $stmt->fetch();
    if (!$step || (int)$step['applicant_id'] !== (int)$user['id']) {
        fail('Step not found.', 404);
    }
    if ($step['status'] !== 'approved') {
        fail('This step has not finished yet.', 409);
    }
    if ($step['step_label'] === 'Issued directly by the barangay') {
        fail('Delivery for this permit is handled through the main permit delivery.', 409);
    }
    if (!empty($step['delivery_method'])) {
        fail('A delivery choice has already been made for this step.', 409);
    }

    $method2 = (string)($in['delivery_method'] ?? '');
    if (!in_array($method2, ['pickup', 'delivery', 'barangay_pickup'], true)) {
        fail('Choose pickup, delivery, or barangay pickup.');
    }
    $address = null;
    $status = 'preparing';
    if ($method2 === 'delivery') {
        $address = trim((string)($in['delivery_address'] ?? ''));
        if ($address === '') {
            fail('Please give an address to deliver to.');
        }
    }

    db()->prepare(
        'UPDATE application_pipeline_progress SET delivery_method = ?, delivery_address = ?, delivery_status = ?, delivery_requested_at = NOW() WHERE id = ?'
    )->execute([$method2, $address, $status, $stepId]);

    db()->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'delivery', ?)"
    )->execute([(int)$step['application_id'], $user['id'], 'Applicant chose how to receive ' . $step['step_label'] . '\'s files: ' . DELIVERY_METHOD_LABELS[$method2] . '.']);

    respond(['ok' => true]);
}

// Batch delivery: the applicant sets delivery method + address for ALL pipeline output
// steps that have not yet been assigned a choice, in a single action. This replaces
// the per-step 'set_node_delivery' flow on the applicant's side; staff tracking still
// uses node_delivery_status per-step as before.
if ($action === 'set_batch_delivery' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $app = own_application((int)($in['id'] ?? 0), $user);

    $method2 = (string)($in['delivery_method'] ?? '');
    if (!in_array($method2, ['delivery', 'barangay_pickup'], true)) {
        fail('Choose barangay pickup or delivery to your address.');
    }

    $address = null;
    $landmarks = trim((string)($in['delivery_landmarks'] ?? ''));
    if ($method2 === 'delivery') {
        $address = trim((string)($in['delivery_address'] ?? ''));
        if ($address === '') {
            fail('Please provide a delivery address.');
        }
    } elseif ($method2 === 'barangay_pickup') {
        $address = trim((string)($in['delivery_address'] ?? ''));
    }

    $pdo = db();

    // Find all pipeline output steps that do not yet have a delivery choice: approved
    // steps that own at least one Verified document, excluding barangay-issued ones.
    $stepStmt = $pdo->prepare(
        "SELECT p.id, p.step_label, p.office_code FROM application_pipeline_progress p
          WHERE p.application_id = ?
            AND p.status = 'approved'
            AND p.step_label <> 'Issued directly by the barangay'
            AND (p.delivery_method IS NULL OR p.delivery_method = '')
            AND EXISTS (
              SELECT 1 FROM application_documents d
               WHERE d.application_id = p.application_id
                 AND COALESCE(d.office_code, 'BARANGAY') = p.office_code
                 AND d.status = 'Verified'
            )"
    );
    $stepStmt->execute([$app['id']]);
    $steps = $stepStmt->fetchAll();

    if (!$steps) {
        fail('No output steps are waiting for a delivery choice.', 409);
    }

    // Check if the delivery_landmarks column exists (added by a migration); if not, skip it.
    $hasLandmarks = false;
    try {
        $pdo->query("SELECT delivery_landmarks FROM application_pipeline_progress LIMIT 0");
        $hasLandmarks = true;
    } catch (Exception $e) {}

    $updateSql = $hasLandmarks
        ? 'UPDATE application_pipeline_progress SET delivery_method = ?, delivery_address = ?, delivery_landmarks = ?, delivery_status = ?, delivery_requested_at = NOW() WHERE id = ?'
        : 'UPDATE application_pipeline_progress SET delivery_method = ?, delivery_address = ?, delivery_status = ?, delivery_requested_at = NOW() WHERE id = ?';

    $updateStmt = $pdo->prepare($updateSql);
    foreach ($steps as $step) {
        if ($hasLandmarks) {
            $updateStmt->execute([$method2, $address, $landmarks ?: null, 'preparing', $step['id']]);
        } else {
            $updateStmt->execute([$method2, $address, 'preparing', $step['id']]);
        }
    }

    $stepLabels = implode(', ', array_column($steps, 'step_label'));
    $body = $method2 === 'barangay_pickup'
        ? 'Applicant chose to pick up all documents at their barangay hall (' . $stepLabels . ').'
        : 'Applicant requested delivery to: ' . $address . ' for all ready documents (' . $stepLabels . ').'
          . ($landmarks ? ' Landmarks: ' . $landmarks : '');
    $pdo->prepare(
        "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'delivery', ?)"
    )->execute([$app['id'], $user['id'], $body]);

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

    // Renewing an approved permit (section 2): the prior application's own outputs pre-fill this
    // one's required documents instead of asking the applicant to upload from scratch.
    $renewApplicationId = (int)($_POST['renew_application_id'] ?? 0);
    $renewalPriorApp = null;
    if ($renewApplicationId) {
        $renewalPriorApp = latest_approved_application_for_renewal_by_id($renewApplicationId, (int)$user['id']);
        if (!$renewalPriorApp) {
            fail('That permit could not be found to renew.', 404);
        }
    }

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
        if (!$barangayId && !empty($business['barangay'])) {
            $matched = find_barangay($business['barangay']);
            if ($matched) {
                $barangayId = (int)$matched['id'];
            }
        }
        // When a business is selected, lock the location to what is registered in Business Location.
        $propertyAddress = rtrim("{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}");
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
    if ($needsAddress && !$businessId && $chosenBarangayId) {
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

    // Fee (section 3): first-time job seeker makes it free outright (wins over any other
    // discount); otherwise a senior citizen gets 20% off. Computed per permit type below, since a
    // single submission can cover several permits at once with different fees.
    $permitTypesById = array_column($permitTypes, null, 'id');
    $isJobseeker = !empty($conditions['first_time_jobseeker']);
    $isSenior = !empty($conditions['senior_citizen']);
    $feeFor = function (array $pt) use ($isJobseeker, $isSenior): float {
        $fee = (float)$pt['fee'];
        if ($isJobseeker) {
            return 0.0;
        }
        if ($isSenior) {
            return round($fee * 0.8, 2);
        }
        return $fee;
    };

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO applications (applicant_id, business_id, permit_type_id, property_address, barangay_id, business_name, project_description, priority, fee_charged, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        // An uploaded file can only be moved out of its temp location once, but the same document
        // can be required by more than one of the permits being filed. The first application to
        // need it moves it; the rest get a copy, so one upload really does serve them all.
        $movedFiles = [];
        $createdIds = [];
        $paymentsNeeded = []; // appId => ['amount' => float, 'recipient_department_id' => int]

        foreach ($permitTypeIds as $permitTypeId) {
        $pt = $permitTypesById[$permitTypeId];
        $fee = $feeFor($pt);
        $status = $fee > 0 ? 'Payment Pending' : 'Submitted';
        $stmt->execute([$user['id'], $businessId ?: null, $permitTypeId, $propertyAddress ?: 'N/A', $barangayId, $businessName ?: null, $description ?: null, 'Standard', $fee, $status]);
        $appId = (int)$pdo->lastInsertId();
        $createdIds[] = $appId;

        if ($fee > 0) {
            // Payment gates the pipeline itself (section 3): conditions are recorded now (nothing
            // about them depends on payment), but the route is only built once payment is
            // confirmed — see api/payments.php action=confirm, which calls activate_paid_application().
            record_application_conditions($appId, $conditions);
            $recipientId = payment_recipient_department_id($pt, $barangayId);
            if ($recipientId === null) {
                $pdo->rollBack();
                fail('Could not find who to route this permit\'s payment to.', 500);
            }
            $paymentsNeeded[$appId] = ['amount' => $fee, 'recipient_department_id' => $recipientId, 'permit_type_name' => $pt['name']];
        } else {
            instantiate_pipeline($appId, $permitTypeId, $conditions, $barangayId);
        }

        $requiredDocs = required_documents_for_type($permitTypeId, $conditions);
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

        // Renewal (section 2): pre-fill from the prior approved application's own outputs rather
        // than asking the applicant to upload everything again from scratch.
        if ($renewalPriorApp) {
            prefill_renewal_documents($appId, $renewalPriorApp, $requiredDocs, $handlers, $_FILES);
        } else {
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
        }

        $activityStmt = $pdo->prepare(
            "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', ?, ?)"
        );
        $activityStmt->execute([
            $appId, $user['id'], 'submitted',
            isset($paymentsNeeded[$appId])
                ? 'Application created — waiting on payment of ' . number_format($paymentsNeeded[$appId]['amount'], 2) . '.'
                : 'Application submitted.',
        ]);

        } // end of the per-permit loop

        // One payment row per fee-bearing application, all tagged with the same batch_token so
        // the payment step can settle them together in one simulated checkout.
        $paymentIds = [];
        if ($paymentsNeeded) {
            $batchToken = bin2hex(random_bytes(10));
            $payInsert = $pdo->prepare(
                'INSERT INTO payments (application_id, amount, method, status, recipient_department_id, batch_token) VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($paymentsNeeded as $appId => $p) {
                // method is filled in at checkout; a placeholder keeps the NOT NULL column happy
                // until then and is overwritten the moment the applicant picks one.
                $payInsert->execute([$appId, $p['amount'], 'gcash', 'pending', $p['recipient_department_id'], $batchToken]);
                $paymentIds[] = (int)$pdo->lastInsertId();
            }
        }

        $pdo->commit();
    } catch (RuntimeException $e) {
        $pdo->rollBack();
        fail($e->getMessage());
    }

    // application_id is the first one filed, so a caller that only knows about single submissions
    // still lands somewhere sensible. payment_required tells the frontend whether step 5 is a real
    // checkout or an automatic pass-through (fee is 0 — e.g. a first-time job seeker).
    respond([
        'application_id' => $createdIds[0],
        'application_ids' => $createdIds,
        'payment_required' => count($paymentsNeeded) > 0,
        'payment_batch_token' => $paymentsNeeded ? $batchToken : null,
        'payment_total' => $paymentsNeeded ? array_sum(array_column($paymentsNeeded, 'amount')) : 0,
    ], 201);
}

if ($action === 'create' && $method === 'POST') {
    $user = require_role('applicant');
    // Unregistered Users can browse only; applying needs a verified label
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
        // Locked to registered business location
        $propertyAddress = rtrim("{$business['address_line']}, Brgy. {$business['barangay']}, {$business['city']} {$business['postal_code']}");
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

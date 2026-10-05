<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/business.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function options_list(array $map, ?string $field = null): array
{
    $out = [];
    foreach ($map as $value => $item) {
        $out[] = ['value' => $value, 'label' => $field ? $item[$field] : $item];
    }
    return $out;
}

// ---------- Business owner ----------

if ($action === 'options' && $method === 'GET') {
    require_auth();
    respond([
        'ownership_types' => array_map(fn($value) => [
            'value' => $value,
            'label' => OWNERSHIP_TYPES[$value]['label'],
            'registration' => OWNERSHIP_TYPES[$value]['registration'],
            'agency' => OWNERSHIP_TYPES[$value]['agency'],
        ], array_keys(OWNERSHIP_TYPES)),
        'lines_of_business' => LINES_OF_BUSINESS,
        'barangays' => barangay_options(),
        'id_types' => options_list(REPRESENTATIVE_ID_TYPES),
        'max_file_mb' => PRIVATE_UPLOAD_MAX_BYTES / 1024 / 1024,
    ]);
}

if ($action === 'list' && $method === 'GET') {
    $user = require_role('applicant');
    $stmt = db()->prepare('SELECT id FROM businesses WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    respond(['businesses' => array_map(fn($id) => business_record((int)$id), $stmt->fetchAll(PDO::FETCH_COLUMN))]);
}

if ($action === 'get' && $method === 'GET') {
    $user = require_role('applicant');
    $b = business_record((int)($_GET['id'] ?? 0));
    if (!$b || (int)$b['user_id'] !== (int)$user['id']) {
        fail('Business not found.', 404);
    }
    respond(['business' => $b]);
}

// Register a new business, or finish a draft / fix a rejected one and resubmit
if ($action === 'save' && $method === 'POST') {
    $user = require_role('applicant');
    $str = fn(string $key) => trim((string)($_POST[$key] ?? ''));

    $existing = null;
    if ($str('id') !== '') {
        $existing = business_record((int)$str('id'));
        if (!$existing || (int)$existing['user_id'] !== (int)$user['id']) {
            fail('Business not found.', 404);
        }
        if (!in_array($existing['status'], ['draft', 'rejected'], true)) {
            fail('This business is ' . $existing['status'] . ' and can no longer be edited.', 409);
        }
    }

    $f = [
        'business_name' => $str('business_name'),
        'trade_name' => $str('trade_name'),
        'ownership_type' => $str('ownership_type'),
        'line_of_business' => $str('line_of_business'),
        'registration_number' => strtoupper($str('registration_number')),
        'tin' => preg_replace('/\D+/', '', $str('tin')),
        'address_line' => $str('address_line'),
        'barangay' => $str('barangay'),
        // City and postal code are not asked for: the whole system covers Dasmariñas only,
        // so they are filled in below from the barangay rather than typed.
        'city' => 'Dasmariñas',
        'postal_code' => '',
        'business_email' => strtolower($str('business_email')),
        'business_phone' => $str('business_phone'),
        'floor_area_sqm' => $str('floor_area_sqm'),
        'employee_count' => $str('employee_count'),
        'is_registered_owner' => $str('is_registered_owner') !== '0',
        'representative_role' => $str('representative_role'),
    ];

    if ($f['business_name'] === '') {
        fail('Please enter the registered business name.');
    }
    if (!isset(OWNERSHIP_TYPES[$f['ownership_type']])) {
        fail('Please choose the type of business ownership.');
    }
    if (!in_array($f['line_of_business'], LINES_OF_BUSINESS, true)) {
        fail('Please choose a line of business.');
    }
    if ($f['registration_number'] === '') {
        fail('Please enter the ' . OWNERSHIP_TYPES[$f['ownership_type']]['agency'] . ' registration number.');
    }
    if (!preg_match('/^\d{9,14}$/', $f['tin'])) {
        fail('Please enter a valid TIN (9 to 14 digits, e.g. 123-456-789-000).');
    }
    if ($f['address_line'] === '') {
        fail('Please enter the building number and street of the business.');
    }
    // The barangay has to be one of the 75, not whatever was typed — it decides which barangay
    // secretariat reviews every permit this business later files.
    $barangay = find_barangay($f['barangay']);
    if (!$barangay) {
        fail('Please choose the business barangay from the list.');
    }
    $f['barangay'] = $barangay['name'];   // store it spelled the way the barangays table spells it
    $f['barangay_id'] = (int)$barangay['id'];
    if ($f['business_email'] !== '' && !filter_var($f['business_email'], FILTER_VALIDATE_EMAIL)) {
        fail('Please enter a valid business email, or leave it blank.');
    }
    if ($f['business_phone'] !== '' && !preg_match('/^\+?[\d\s()-]{7,20}$/', $f['business_phone'])) {
        fail('Please enter a valid business phone number, or leave it blank.');
    }
    if ($f['floor_area_sqm'] !== '' && (!is_numeric($f['floor_area_sqm']) || (float)$f['floor_area_sqm'] <= 0)) {
        fail('Floor area must be a positive number of square meters.');
    }
    if ($f['employee_count'] !== '' && !ctype_digit($f['employee_count'])) {
        fail('Number of employees must be a whole number.');
    }
    $needsRole = $f['ownership_type'] !== 'sole_proprietorship' || !$f['is_registered_owner'];
    if ($needsRole && $f['representative_role'] === '') {
        fail('Please enter your role in the business (e.g. President, Managing Partner, Authorized representative).');
    }
    if (($_POST['declaration'] ?? '') !== '1') {
        fail('Please confirm that the information and documents are true and correct.');
    }

    // Every required document needs a new upload, or an existing one kept from before
    $required = business_required_docs($f['ownership_type'], $f['is_registered_owner']);
    $existingDocs = [];
    foreach ($existing['documents'] ?? [] as $d) {
        $existingDocs[$d['doc_key']] = $d;
    }
    $repIdType = $str('representative_id_type');
    if (!isset(REPRESENTATIVE_ID_TYPES[$repIdType])) {
        fail('Please choose the type of government ID you are uploading.');
    }
    foreach ($required as $key => $label) {
        $hasUpload = isset($_FILES["doc_$key"]) && ($_FILES["doc_$key"]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        if (!$hasUpload && !isset($existingDocs[$key])) {
            fail("Please upload: $label.");
        }
    }

    $stored = [];
    $replacedFiles = [];
    $pdo = db();
    try {
        foreach ($required as $key => $label) {
            if (isset($_FILES["doc_$key"]) && ($_FILES["doc_$key"]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $stored[$key] = store_private_file($_FILES["doc_$key"], 'business/' . (int)$user['id'], $label);
            }
        }

        $pdo->beginTransaction();
        $values = [
            $f['business_name'], $f['trade_name'] ?: null, $f['ownership_type'], $f['line_of_business'], $f['registration_number'], $f['tin'],
            $f['address_line'], $f['barangay'], $f['barangay_id'], $f['city'], $f['postal_code'] ?: null, $f['business_email'] ?: null, $f['business_phone'] ?: null,
            $f['floor_area_sqm'] !== '' ? (float)$f['floor_area_sqm'] : null, $f['employee_count'] !== '' ? (int)$f['employee_count'] : null,
            $f['is_registered_owner'] ? 1 : 0, $needsRole ? $f['representative_role'] : null,
        ];
        $columns = 'business_name = ?, trade_name = ?, ownership_type = ?, line_of_business = ?, registration_number = ?, tin = ?,
                    address_line = ?, barangay = ?, barangay_id = ?, city = ?, postal_code = ?, business_email = ?, business_phone = ?,
                    floor_area_sqm = ?, employee_count = ?, is_registered_owner = ?, representative_role = ?,
                    status = \'pending\', declared_at = NOW(), submitted_at = NOW(), reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL';
        if ($existing) {
            $businessId = (int)$existing['id'];
            $pdo->prepare("UPDATE businesses SET $columns WHERE id = ?")->execute([...$values, $businessId]);
        } else {
            $pdo->prepare("INSERT INTO businesses SET user_id = ?, $columns")->execute([$user['id'], ...$values]);
            $businessId = (int)$pdo->lastInsertId();
        }

        $upsert = $pdo->prepare(
            'INSERT INTO business_documents (business_id, doc_key, id_type, file_path, original_filename, mime_type, file_size, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE id_type = VALUES(id_type), file_path = VALUES(file_path), original_filename = VALUES(original_filename),
                                     mime_type = VALUES(mime_type), file_size = VALUES(file_size), uploaded_at = NOW()'
        );
        foreach ($stored as $key => $s) {
            if (isset($existingDocs[$key])) {
                $old = $pdo->prepare('SELECT file_path FROM business_documents WHERE id = ?');
                $old->execute([$existingDocs[$key]['id']]);
                $replacedFiles[] = $old->fetchColumn();
            }
            $upsert->execute([$businessId, $key, $key === 'representative_id' ? $repIdType : null, $s['file_path'], $s['original_filename'], $s['mime_type'], $s['file_size']]);
        }
        // The ID type can change without re-uploading the file
        $pdo->prepare("UPDATE business_documents SET id_type = ? WHERE business_id = ? AND doc_key = 'representative_id'")->execute([$repIdType, $businessId]);

        // Drop documents that are no longer required (e.g. switched to sole proprietor, own business)
        $stale = $pdo->prepare('SELECT id, file_path FROM business_documents WHERE business_id = ? AND doc_key NOT IN (' . implode(',', array_fill(0, count($required), '?')) . ')');
        $stale->execute([$businessId, ...array_keys($required)]);
        foreach ($stale->fetchAll() as $row) {
            $replacedFiles[] = $row['file_path'];
            $pdo->prepare('DELETE FROM business_documents WHERE id = ?')->execute([$row['id']]);
        }

        audit((int)$user['id'], $existing ? 'business.resubmitted' : 'business.submitted', 'business', $businessId);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        foreach ($stored as $s) {
            @unlink(storage_path($s['file_path']));
        }
        throw $e;
    }

    foreach ($replacedFiles as $path) {
        if ($path) {
            @unlink(storage_path($path));
        }
    }

    respond(['business' => business_record($businessId)], $existing ? 200 : 201);
}

// View a business document inline — its owner or staff only
if ($action === 'file' && $method === 'GET') {
    $user = require_auth();
    $stmt = db()->prepare('SELECT d.*, b.user_id, b.barangay_id FROM business_documents d JOIN businesses b ON b.id = d.business_id WHERE d.id = ?');
    $stmt->execute([(int)($_GET['id'] ?? 0)]);
    $doc = $stmt->fetch();
    $isStaff = in_array($user['role'], ['staff', 'admin'], true);
    if (!$doc || (!$isStaff && (int)$doc['user_id'] !== (int)$user['id'])) {
        fail('File not found.', 404);
    }
    if ($isStaff && !in_barangay_scope(barangay_scope($user), $doc['barangay_id'])) {
        fail('File not found.', 404);
    }
    send_private_file($doc['file_path'], $doc['mime_type'], $doc['original_filename']);
}

// ---------- City Staff / Admin ----------

if ($action === 'counts' && $method === 'GET') {
    $scope = barangay_scope(require_role('staff'));
    $cs = db()->prepare("SELECT status, COUNT(*) c FROM businesses WHERE status <> 'draft' AND (? IS NULL OR barangay_id = ?) GROUP BY status");
    $cs->execute([$scope, $scope]);
    $rows = $cs->fetchAll();
    $counts = ['pending' => 0, 'approved' => 0, 'rejected' => 0];
    foreach ($rows as $r) {
        $counts[$r['status']] = (int)$r['c'];
    }
    respond($counts);
}

if ($action === 'queue' && $method === 'GET') {
    require_role('staff');
    $status = in_array($_GET['status'] ?? '', ['pending', 'approved', 'rejected'], true) ? $_GET['status'] : 'pending';
    $order = $status === 'pending' ? 'b.submitted_at ASC' : 'b.reviewed_at DESC';
    $stmt = db()->prepare(
        "SELECT b.id, b.status, b.business_name, b.trade_name, b.ownership_type, b.line_of_business, b.barangay, b.city,
                b.submitted_at, b.reviewed_at, u.full_name AS owner_name, r.full_name AS reviewer_name,
                DATEDIFF(NOW(), b.submitted_at) AS days_waiting
         FROM businesses b JOIN users u ON u.id = b.user_id LEFT JOIN users r ON r.id = b.reviewed_by
         WHERE b.status = ? AND (? IS NULL OR b.barangay_id = ?) ORDER BY $order"
    );
    $scope = barangay_scope(require_role('staff'));
    $stmt->execute([$status, $scope, $scope]);
    $rows = array_map(function (array $r) {
        $r['ownership_label'] = OWNERSHIP_TYPES[$r['ownership_type']]['label'] ?? null;
        return $r;
    }, $stmt->fetchAll());
    respond(['businesses' => $rows]);
}

if ($action === 'detail' && $method === 'GET') {
    $scope = barangay_scope(require_role('staff'));
    $b = business_record((int)($_GET['id'] ?? 0));
    if (!$b || $b['status'] === 'draft') {
        fail('Business not found.', 404);
    }
    if (!in_barangay_scope($scope, $b['barangay_id'])) {
        fail('This business is in another barangay.', 403);
    }
    $u = db()->prepare('SELECT id, full_name, birthdate, email, phone, email_verified_at, phone_verified_at, resident_status, created_at FROM users WHERE id = ?');
    $u->execute([$b['user_id']]);
    $history = db()->prepare(
        "SELECT a.action, a.details, a.created_at, u.full_name AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.subject_type = 'business' AND a.subject_id = ? ORDER BY a.id DESC"
    );
    $history->execute([$b['id']]);
    respond(['business' => $b, 'owner' => $u->fetch(), 'history' => $history->fetchAll()]);
}

if ($action === 'decide' && $method === 'POST') {
    $staff = require_role('staff');
    $in = json_input();
    $decision = $in['decision'] ?? '';
    $reason = trim((string)($in['reason'] ?? ''));
    if (!in_array($decision, ['approve', 'reject'], true)) {
        fail('Invalid decision.');
    }
    if ($decision === 'reject' && mb_strlen($reason) < 5) {
        fail('Please give the applicant a reason for the rejection.');
    }
    $b = business_record((int)($in['id'] ?? 0));
    if (!$b || $b['status'] === 'draft') {
        fail('Business not found.', 404);
    }
    if (!in_barangay_scope(barangay_scope($staff), $b['barangay_id'])) {
        fail('This business is in another barangay, so you cannot decide it.', 403);
    }
    if ($b['status'] !== 'pending') {
        fail('This business has already been ' . $b['status'] . '.', 409);
    }

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE businesses SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ? AND status = 'pending'")
        ->execute([$decision === 'approve' ? 'approved' : 'rejected', $staff['id'], $decision === 'reject' ? mb_substr($reason, 0, 500) : null, $b['id']]);
    audit((int)$staff['id'], 'business.' . ($decision === 'approve' ? 'approved' : 'rejected'), 'business', (int)$b['id'], $decision === 'reject' ? $reason : null);
    $pdo->commit();

    if ($decision === 'approve') {
        // account_type is informational (nothing gates access on it — that's resident_status +
        // approved-business-count, via with_levels()), but it defaulted to 'resident' for every
        // signup and was never updated, so a business-only account stayed mislabeled forever.
        $pdo->prepare("UPDATE users SET account_type = 'business' WHERE id = ?")->execute([$b['user_id']]);
        notify_user((int)$b['user_id'], 'Your business is verified', 'Good news! "' . $b['business_name'] . '" has been verified. You can now apply for business permits for it in PermitTrack.');
    } else {
        notify_user((int)$b['user_id'], 'Your business registration needs attention', '"' . $b['business_name'] . '" was not approved: ' . $reason . ' Please log in to PermitTrack to fix it and resubmit.');
    }

    respond(['business' => business_record((int)$b['id'])]);
}

fail('Unknown action.', 404);

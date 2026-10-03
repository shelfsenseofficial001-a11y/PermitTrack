<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/residency.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function latest_request_id(int $userId): ?int
{
    $stmt = db()->prepare('SELECT id FROM resident_verifications WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    $stmt->execute([$userId]);
    $id = $stmt->fetchColumn();
    return $id === false ? null : (int)$id;
}

function doc_type_options(): array
{
    $out = [];
    foreach (RESIDENCY_DOC_TYPES as $key => $t) {
        $out[] = ['value' => $key, 'label' => $t['label'], 'max_age_days' => $t['max_age_days']];
    }
    return $out;
}


// ---------- Applicant ----------

if ($action === 'status' && $method === 'GET') {
    $user = require_role('applicant');
    $latest = latest_request_id((int)$user['id']);
    respond([
        'resident_status' => $user['resident_status'],
        'request' => $latest ? residency_request($latest) : null,
        'doc_types' => doc_type_options(),
        'barangays' => barangay_options(),
        'max_file_mb' => PRIVATE_UPLOAD_MAX_BYTES / 1024 / 1024,
    ]);
}

if ($action === 'submit' && $method === 'POST') {
    $user = require_role('applicant');

    if ($user['resident_status'] === 'pending') {
        fail('Your residency verification is already being reviewed.');
    }
    if ($user['resident_status'] === 'verified') {
        fail('Your account is already a verified Resident.');
    }
    if (empty($user['email_verified_at']) || empty($user['phone_verified_at'])) {
        fail('Please verify both your email and your mobile number first.');
    }

    $str = fn(string $key) => trim((string)($_POST[$key] ?? ''));
    $addressLine = $str('address_line');
    if ($addressLine === '') {
        fail('Please complete your address.');
    }
    $barangay = find_barangay($str('barangay'));
    if (!$barangay) {
        fail('Please choose your barangay from the list.');
    }
    // Residency verification only confirms an address within Dasmariñas; city/postal code
    // were already collected at account creation and aren't re-asked here.
    $city = 'Dasmariñas';
    $postal = (string)($user['postal_code'] ?? '');
    $address = ['address_line' => $addressLine, 'barangay' => $barangay['name'], 'city' => $city, 'postal_code' => $postal];
    if (($_POST['declaration'] ?? '') !== '1') {
        fail('Please confirm that you currently live at this address.');
    }

    // Check both proofs before saving anything
    $proofs = [];
    foreach ([1, 2] as $n) {
        $type = $str("doc_type_$n");
        if (!isset(RESIDENCY_DOC_TYPES[$type])) {
            fail("Please choose the document type for proof #$n.");
        }
        $maxAge = RESIDENCY_DOC_TYPES[$type]['max_age_days'];
        $issued = $str("issued_on_$n");
        if ($maxAge !== null) {
            $date = DateTime::createFromFormat('!Y-m-d', $issued);
            if (!$date || $date->format('Y-m-d') !== $issued) {
                fail("Please enter the date issued for proof #$n.");
            }
            $today = new DateTime('today');
            if ($date > $today) {
                fail("The date issued for proof #$n can't be in the future.");
            }
            if ($date->diff($today)->days > $maxAge) {
                fail(RESIDENCY_DOC_TYPES[$type]['label'] . " (proof #$n) must be dated within the last $maxAge days.");
            }
        }
        $proofs[$n] = ['type' => $type, 'issued_on' => $maxAge !== null ? $issued : null];
    }
    if ($proofs[1]['type'] === $proofs[2]['type']) {
        fail('Your two proofs must be different types of documents (for example, a utility bill and a Barangay Certificate).');
    }

    $stored = [];
    $pdo = db();
    try {
        foreach ([1, 2] as $n) {
            $stored[$n] = store_private_file($_FILES["file_$n"] ?? [], "residency/" . (int)$user['id'], "Proof #$n");
        }

        $pdo->beginTransaction();
        $pdo->prepare('UPDATE users SET address_line = ?, barangay = ?, barangay_id = ?, city = ?, postal_code = ?, resident_status = \'pending\' WHERE id = ?')
            ->execute([$address['address_line'], $address['barangay'], $barangay['id'], $address['city'], $address['postal_code'], $user['id']]);
        $pdo->prepare(
            'INSERT INTO resident_verifications (user_id, address_line, barangay, city, postal_code, declared_at) VALUES (?, ?, ?, ?, ?, NOW())'
        )->execute([$user['id'], $address['address_line'], $address['barangay'], $address['city'], $address['postal_code']]);
        $requestId = (int)$pdo->lastInsertId();

        $insertProof = $pdo->prepare(
            'INSERT INTO resident_proofs (verification_id, doc_type, issued_on, file_path, original_filename, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ([1, 2] as $n) {
            $insertProof->execute([$requestId, $proofs[$n]['type'], $proofs[$n]['issued_on'], $stored[$n]['file_path'], $stored[$n]['original_filename'], $stored[$n]['mime_type'], $stored[$n]['file_size']]);
        }
        audit((int)$user['id'], 'residency.submitted', 'resident_verification', $requestId);
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

    respond(['request' => residency_request($requestId), 'user' => current_user()], 201);
}

// View a proof file inline — its owner or staff only
if ($action === 'file' && $method === 'GET') {
    $user = require_auth();
    $stmt = db()->prepare('SELECT p.*, rv.user_id FROM resident_proofs p JOIN resident_verifications rv ON rv.id = p.verification_id WHERE p.id = ?');
    $stmt->execute([(int)($_GET['id'] ?? 0)]);
    $proof = $stmt->fetch();
    $isStaff = in_array($user['role'], ['staff', 'admin'], true);
    if (!$proof || (!$isStaff && (int)$proof['user_id'] !== (int)$user['id'])) {
        fail('File not found.', 404);
    }
    send_private_file($proof['file_path'], $proof['mime_type'], $proof['original_filename']);
}

// ---------- City Staff / Admin ----------

if ($action === 'counts' && $method === 'GET') {
    require_role('staff');
    $rows = db()->query('SELECT status, COUNT(*) c FROM resident_verifications GROUP BY status')->fetchAll();
    $counts = ['pending' => 0, 'approved' => 0, 'rejected' => 0];
    foreach ($rows as $r) {
        $counts[$r['status']] = (int)$r['c'];
    }
    respond($counts);
}

if ($action === 'queue' && $method === 'GET') {
    require_role('staff');
    $status = in_array($_GET['status'] ?? '', ['pending', 'approved', 'rejected'], true) ? $_GET['status'] : 'pending';
    // Oldest first while waiting; most recent first for the history tabs
    $order = $status === 'pending' ? 'rv.created_at ASC' : 'rv.reviewed_at DESC';
    $stmt = db()->prepare(
        "SELECT rv.id, rv.status, rv.barangay, rv.city, rv.created_at, rv.reviewed_at, rv.rejection_reason,
                u.full_name, DATEDIFF(NOW(), rv.created_at) AS days_waiting, r.full_name AS reviewer_name
         FROM resident_verifications rv
         JOIN users u ON u.id = rv.user_id
         LEFT JOIN users r ON r.id = rv.reviewed_by
         WHERE rv.status = ? ORDER BY $order"
    );
    $stmt->execute([$status]);
    respond(['requests' => $stmt->fetchAll()]);
}

if ($action === 'detail' && $method === 'GET') {
    require_role('staff');
    $request = residency_request((int)($_GET['id'] ?? 0));
    if (!$request) {
        fail('Request not found.', 404);
    }
    $u = db()->prepare('SELECT id, full_name, first_name, middle_name, last_name, birthdate, email, phone, email_verified_at, phone_verified_at, created_at FROM users WHERE id = ?');
    $u->execute([$request['user_id']]);
    $history = db()->prepare(
        'SELECT id, status, rejection_reason, created_at, reviewed_at FROM resident_verifications WHERE user_id = ? AND id <> ? ORDER BY id DESC'
    );
    $history->execute([$request['user_id'], $request['id']]);
    respond(['request' => $request, 'applicant' => $u->fetch(), 'history' => $history->fetchAll()]);
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

    $request = residency_request((int)($in['id'] ?? 0));
    if (!$request) {
        fail('Request not found.', 404);
    }
    if ($request['status'] !== 'pending') {
        fail('This request has already been ' . $request['status'] . '.', 409);
    }

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE resident_verifications SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ? AND status = \'pending\'')
        ->execute([$decision === 'approve' ? 'approved' : 'rejected', $staff['id'], $decision === 'reject' ? mb_substr($reason, 0, 500) : null, $request['id']]);
    $pdo->prepare('UPDATE users SET resident_status = ? WHERE id = ?')
        ->execute([$decision === 'approve' ? 'verified' : 'rejected', $request['user_id']]);
    if ($decision === 'approve') {
        // account_type is informational only (see api/config.php::with_levels()) — this just
        // keeps it from staying 'unregistered' forever. Same pattern as business.php's approval.
        $pdo->prepare("UPDATE users SET account_type = 'resident' WHERE id = ?")->execute([$request['user_id']]);
    }
    audit((int)$staff['id'], 'residency.' . ($decision === 'approve' ? 'approved' : 'rejected'), 'resident_verification', (int)$request['id'], $decision === 'reject' ? $reason : null);
    $pdo->commit();

    if ($decision === 'approve') {
        notify_user((int)$request['user_id'], 'You are now a verified Resident', 'Good news! Your residency has been verified. You can now apply for resident permits in PermitTrack.');
    } else {
        notify_user((int)$request['user_id'], 'Your residency verification needs attention', 'Your residency verification was not approved: ' . $reason . ' Please log in to PermitTrack to upload new proofs.');
    }

    respond(['request' => residency_request((int)$request['id'])]);
}

fail('Unknown action.', 404);

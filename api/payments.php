<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/pipeline.php';
require_once __DIR__ . '/lib/support.php';

/*
 * Section 3 — payment. A fee-bearing application is created already (applications.php
 * create_v2), sitting at status='Payment Pending' with one 'payments' row per application
 * (amount + recipient already decided; method/reference still empty). This file handles:
 *
 *   1. 'checkout'  (applicant) — Creates a real PayMongo Checkout Session (sandbox) and returns
 *      the session checkout_url. The applicant is redirected there for GCash / Maya / Card
 *      authorisation. After authorisation PayMongo redirects back to payments_callback.php
 *      (success_url) or payments_callback.php?failed=1 (cancel_url).
 *      Falls back to the built-in simulator when no PayMongo key is configured, keeping the
 *      demo fully functional without credentials.
 *
 *   2. 'authorize_return'  (POST, called internally by payments_callback.php) — Retrieves the
 *      Checkout Session from PayMongo, determines success or failure, and marks the payment
 *      row accordingly. Staff still confirm receipt after this step.
 *
 *   3. 'confirm'   (staff, payment-bridge departments only, migration 040) — The authoritative
 *      step: staff confirms the money arrived, which activates the application's pipeline.
 *
 *   4. 'queue'     (staff) — pending-confirmation payments in that staff member's own scope.
 *
 *   5. 'status'    (applicant) — poll a payment's state.
 *
 *   6. 'webhook'   (POST, PayMongo webhook, no session) — handles checkout_session.payment.paid
 *      events as a backup to the return URL.
 */

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const PAYMENT_METHODS = ['gcash', 'maya', 'bank_transfer'];
const PAYMENT_METHOD_LABELS = ['gcash' => 'GCash', 'maya' => 'Maya', 'bank_transfer' => 'Bank Transfer'];

// PayMongo payment_method_types values for the Checkout Session API
const PAYMONGO_METHOD_MAP = [
    'gcash'         => 'gcash',
    'maya'          => 'paymaya',
    'bank_transfer' => 'dob_ubp', // Direct Online Banking (UnionBank)
];

/** Whether this staff account is a payment-handling account: Municipal Treasury, or a Barangay Secretary for their barangay. */
function payment_department_for(array $user): ?int
{
    if (empty($user['department_id'])) {
        return null;
    }
    $stmt = db()->prepare("SELECT id, code, purpose, barangay_id FROM departments WHERE id = ?");
    $stmt->execute([$user['department_id']]);
    $dept = $stmt->fetch();
    if (!$dept) {
        return null;
    }
    // Municipal Treasury (Payments)
    if ($dept['code'] === 'TREASURY_PAY' || ($dept['purpose'] === 'payment' && empty($dept['barangay_id']))) {
        return (int)$dept['id'];
    }
    // City Treasurer review department can also confirm municipal treasury payments
    if ($dept['code'] === 'TREASURER') {
        $tDept = db()->query("SELECT id FROM departments WHERE code = 'TREASURY_PAY' LIMIT 1")->fetch();
        return $tDept ? (int)$tDept['id'] : (int)$dept['id'];
    }
    // Barangay Secretary (review department covers the barangay)
    if (!empty($dept['barangay_id'])) {
        // Return the Barangay Secretary's review department id
        if ($dept['purpose'] === 'review' || (str_starts_with((string)$dept['code'], 'BRGY-') && !str_starts_with((string)$dept['code'], 'BRGY-PAY-'))) {
            return (int)$dept['id'];
        }
        // If logged in via legacy payment department, map to the Barangay Secretary department
        $sStmt = db()->prepare("SELECT id FROM departments WHERE barangay_id = ? AND code LIKE 'BRGY-%' AND code NOT LIKE 'BRGY-PAY-%' LIMIT 1");
        $sStmt->execute([$dept['barangay_id']]);
        $sDept = $sStmt->fetch();
        return $sDept ? (int)$sDept['id'] : (int)$dept['id'];
    }
    return null;
}

/**
 * Calls the PayMongo API with Basic-auth (secret_key as user, no password).
 * Returns the decoded JSON body or throws RuntimeException on failure.
 */
function paymongo_request(string $method, string $path, array $payload = []): array
{
    $secretKey = app_config()['paymongo']['secret_key'] ?? '';
    $base      = 'https://api.paymongo.com/v1';

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $base . $path,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD        => $secretKey . ':',
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_CUSTOMREQUEST  => strtoupper($method),
    ]);
    if ($payload) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['data' => ['attributes' => $payload]]));
    }
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('PayMongo request failed (network error).');
    }
    $body = json_decode($raw, true);
    if ($code >= 400) {
        $msg = $body['errors'][0]['detail'] ?? ('PayMongo error ' . $code);
        throw new RuntimeException($msg);
    }
    return $body;
}

/**
 * Build the absolute URL back to this server.
 */
function site_url(string $path): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host . $path;
}

// ---------------------------------------------------------------------------
// 1. checkout — applicant initiates payment
// ---------------------------------------------------------------------------
if ($action === 'checkout' && $method === 'POST') {
    $user    = require_role('applicant');
    $in      = json_input();
    $idsRaw  = $in['application_ids'] ?? [];
    $applicationIds = is_array($idsRaw)
        ? array_values(array_unique(array_filter(array_map('intval', $idsRaw))))
        : [];
    $payMethod = (string)($in['method'] ?? '');
    $simulate  = (string)($in['simulate'] ?? 'success'); // only used when no key is configured

    if (!$applicationIds) {
        fail('Nothing to pay for.');
    }
    if (!in_array($payMethod, PAYMENT_METHODS, true)) {
        fail('Please choose a payment method.');
    }

    $placeholders = implode(',', array_fill(0, count($applicationIds), '?'));
    $stmt = db()->prepare(
        "SELECT p.*, a.applicant_id FROM payments p JOIN applications a ON a.id = p.application_id
          WHERE p.application_id IN ($placeholders)"
    );
    $stmt->execute($applicationIds);
    $payments = $stmt->fetchAll();
    if (count($payments) !== count($applicationIds)) {
        fail('Payment record not found for one or more applications.', 404);
    }
    foreach ($payments as $p) {
        if ((int)$p['applicant_id'] !== (int)$user['id']) {
            fail('Forbidden', 403);
        }
        if ($p['status'] === 'succeeded') {
            fail('This has already been paid.', 409);
        }
    }

    $secretKey = app_config()['paymongo']['secret_key'] ?? '';
    $useRealApi = !empty($secretKey);

    if ($useRealApi) {
        // --- Real PayMongo Checkout Session flow ---
        $totalAmount = array_sum(array_column($payments, 'amount'));
        $totalCents  = (int)round($totalAmount * 100); // PayMongo expects centavos (integers)

        // Shared batch token so the callback can locate all payment rows
        $batchToken = bin2hex(random_bytes(20));

        // Store batch token + method before redirecting
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $upd = $pdo->prepare(
                "UPDATE payments SET method = ?, batch_token = ?, updated_at = NOW() WHERE id = ?"
            );
            foreach ($payments as $p) {
                $upd->execute([$payMethod, $batchToken, $p['id']]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            fail('Could not initialise payment.', 500);
        }

        try {
            $permitNames = [];
            foreach ($payments as $p) {
                // Fetch application info for line item name
                $a = db()->prepare('SELECT a.permit_type, pt.name FROM applications a LEFT JOIN permit_types pt ON pt.id = a.permit_type_id WHERE a.id = ?');
                $a->execute([$p['application_id']]);
                $app = $a->fetch();
                $permitNames[] = $app['name'] ?? $app['permit_type'] ?? 'Permit';
            }
            $description = 'PermitTrack – ' . implode(', ', array_unique($permitNames));

            $successUrl = app_base_url() . '/api/payments_callback.php?batch=' . urlencode($batchToken);
            $cancelUrl  = app_base_url() . '/api/payments_callback.php?batch=' . urlencode($batchToken) . '&failed=1';

            $sessionRes = paymongo_request('POST', '/checkout_sessions', [
                'billing' => [
                    'name'  => $user['full_name'] ?? 'Applicant',
                    'email' => $user['email'] ?? '',
                    'phone' => $user['phone'] ?? '',
                ],
                'line_items' => [[
                    'currency' => 'PHP',
                    'amount'   => $totalCents,
                    'name'     => $description,
                    'quantity' => 1,
                ]],
                'payment_method_types' => [PAYMONGO_METHOD_MAP[$payMethod]],
                'success_url' => $successUrl,
                'cancel_url'  => $cancelUrl,
                'description' => $description,
            ]);

            $sessionId   = $sessionRes['data']['id'] ?? '';
            $checkoutUrl = $sessionRes['data']['attributes']['checkout_url'] ?? '';

            if (!$checkoutUrl) {
                fail('PayMongo did not return a checkout URL. Please try a different payment method.');
            }

            // Persist the checkout session id so the callback can retrieve it
            $pdo->beginTransaction();
            try {
                $upd2 = $pdo->prepare(
                    "UPDATE payments SET paymongo_payment_intent_id = ?, paymongo_checkout_url = ?, updated_at = NOW() WHERE batch_token = ?"
                );
                $upd2->execute([$sessionId, $checkoutUrl, $batchToken]);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                // Non-fatal — checkout URL still returned
            }

            respond([
                'ok'                => true,
                'requires_redirect' => true,
                'checkout_url'      => $checkoutUrl,
                'batch_token'       => $batchToken,
                'status'            => 'awaiting_authorization',
                'message'           => 'Redirecting you to ' . PAYMENT_METHOD_LABELS[$payMethod] . ' to authorise your payment…',
            ]);
        } catch (RuntimeException $e) {
            fail('Payment gateway error: ' . $e->getMessage(), 502);
        }
    }

    // --- Simulation fallback (no PayMongo key configured) ---
    $succeeded = $simulate !== 'fail';

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($succeeded) {
            $reference = 'SIM-' . strtoupper(bin2hex(random_bytes(5)));
            $upd = $pdo->prepare("UPDATE payments SET method = ?, reference = ?, status = 'pending', updated_at = NOW() WHERE id = ?");
            $actStmt = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'payment', ?)");
            foreach ($payments as $p) {
                $upd->execute([$payMethod, $reference, $p['id']]);
                $mLabel = PAYMENT_METHOD_LABELS[$payMethod] ?? $payMethod;
                $actStmt->execute([
                    $p['application_id'],
                    $user['id'],
                    'Payment of ₱' . number_format((float)$p['amount'], 2) . ' received via ' . $mLabel . ' (ref ' . $reference . '). Waiting for office confirmation.'
                ]);
            }
        } else {
            $upd = $pdo->prepare("UPDATE payments SET method = ?, reference = NULL, status = 'failed', updated_at = NOW() WHERE id = ?");
            foreach ($payments as $p) {
                $upd->execute([$payMethod, $p['id']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not record the payment attempt.', 500);
    }

    respond([
        'ok'        => true,
        'succeeded' => $succeeded,
        'status'    => $succeeded ? 'pending_confirmation' : 'failed',
        'message'   => $succeeded
            ? 'Payment received via ' . PAYMENT_METHOD_LABELS[$payMethod] . '. It is now waiting on the recipient office to confirm.'
            : 'That payment did not go through. You can try again.',
    ]);
}

// ---------------------------------------------------------------------------
// 2. authorize_return — called internally by payments_callback.php
// ---------------------------------------------------------------------------
if ($action === 'authorize_return' && $method === 'POST') {
    // Internal call from payments_callback.php — authenticated by batch_token.
    $in         = json_input();
    $batchToken = (string)($in['batch_token'] ?? '');
    $sessionId  = (string)($in['checkout_session_id'] ?? '');

    if (!$batchToken || !$sessionId) {
        fail('Missing parameters.', 400);
    }

    // Retrieve the Checkout Session from PayMongo to get the authoritative status
    $paymentSucceeded = false;
    $ref = null;
    try {
        $sessionRes = paymongo_request('GET', '/checkout_sessions/' . $sessionId);
        $attrs      = $sessionRes['data']['attributes'] ?? [];
        $status     = $attrs['status'] ?? '';
        $paymentSucceeded = ($status === 'active' && !empty($attrs['payment_intent']['attributes']['status'])
            && in_array($attrs['payment_intent']['attributes']['status'], ['succeeded', 'paid', 'awaiting_capture'], true))
            || $status === 'paid';

        // Fallback: check payment_intent directly
        $piAttrs = $attrs['payment_intent']['attributes'] ?? [];
        if (!$paymentSucceeded && in_array($piAttrs['status'] ?? '', ['succeeded', 'paid'], true)) {
            $paymentSucceeded = true;
        }

        if ($paymentSucceeded) {
            $ref = ($attrs['payment_intent']['attributes']['payments'][0]['id'] ?? null)
                ?: ('CS-' . $sessionId);
        }
    } catch (RuntimeException $e) {
        respond(['ok' => false, 'message' => 'Could not verify payment: ' . $e->getMessage()]);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($paymentSucceeded) {
            $pdo->prepare(
                "UPDATE payments SET reference = ?, paymongo_payment_intent_id = ?, status = 'pending', updated_at = NOW()
                  WHERE batch_token = ? AND status != 'succeeded'"
            )->execute([$ref, $sessionId, $batchToken]);

            $payItems = $pdo->prepare("SELECT p.application_id, p.amount, p.method, a.applicant_id FROM payments p JOIN applications a ON a.id = p.application_id WHERE p.batch_token = ?");
            $payItems->execute([$batchToken]);
            $actStmt = $pdo->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'payment', ?)");
            foreach ($payItems->fetchAll() as $item) {
                $mLabel = PAYMENT_METHOD_LABELS[$item['method']] ?? strtoupper((string)$item['method']);
                $actStmt->execute([
                    $item['application_id'],
                    $item['applicant_id'],
                    'Payment of ₱' . number_format((float)$item['amount'], 2) . ' received via ' . $mLabel . ' (ref ' . $ref . '). Waiting for office confirmation.'
                ]);
            }
        } else {
            $pdo->prepare(
                "UPDATE payments SET paymongo_payment_intent_id = ?, status = 'failed', updated_at = NOW()
                  WHERE batch_token = ? AND (status = 'pending' OR reference IS NULL)"
            )->execute([$sessionId, $batchToken]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['ok' => false, 'message' => 'DB update failed: ' . $e->getMessage()]);
    }

    $stmt = db()->prepare("SELECT application_id FROM payments WHERE batch_token = ? LIMIT 20");
    $stmt->execute([$batchToken]);
    $appIds = array_column($stmt->fetchAll(), 'application_id');

    respond([
        'ok'              => true,
        'succeeded'       => $paymentSucceeded,
        'application_ids' => $appIds,
        'status'          => $paymentSucceeded ? 'pending_confirmation' : 'failed',
    ]);
}

// ---------------------------------------------------------------------------
// 3. confirm — staff confirms payment arrived (activates the pipeline)
// ---------------------------------------------------------------------------
if ($action === 'confirm' && $method === 'POST') {
    $user = require_role('staff');
    $in = json_input();
    $paymentId = (int)($in['payment_id'] ?? 0);

    $deptId = payment_department_for($user);
    if ($deptId === null && $user['role'] !== 'admin') {
        fail('Your account is not a payment-confirmation account.', 403);
    }

    $stmt = db()->prepare('SELECT * FROM payments WHERE id = ?');
    $stmt->execute([$paymentId]);
    $payment = $stmt->fetch();
    if (!$payment) {
        fail('Payment not found.', 404);
    }
    $isAuthorized = false;
    if ($user['role'] === 'admin') {
        $isAuthorized = true;
    } elseif ((int)$payment['recipient_department_id'] === $deptId) {
        $isAuthorized = true;
    } else {
        $pDeptStmt = db()->prepare("SELECT barangay_id FROM departments WHERE id = ?");
        $pDeptStmt->execute([(int)$payment['recipient_department_id']]);
        $pBrgyId = $pDeptStmt->fetchColumn();

        $uDeptStmt = db()->prepare("SELECT barangay_id FROM departments WHERE id = ?");
        $uDeptStmt->execute([$deptId]);
        $uBrgyId = $uDeptStmt->fetchColumn();

        if ($pBrgyId && $uBrgyId && (int)$pBrgyId === (int)$uBrgyId) {
            $isAuthorized = true;
        }
    }
    if (!$isAuthorized) {
        fail('This payment is not routed to your office.', 403);
    }
    if ($payment['status'] === 'succeeded') {
        fail('Already confirmed.', 409);
    }
    if ($payment['status'] !== 'pending' || empty($payment['reference'])) {
        fail('This payment has not gone through checkout yet.', 409);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE payments SET status = 'succeeded', confirmed_by = ?, confirmed_at = NOW() WHERE id = ?")
            ->execute([$user['id'], $paymentId]);
        activate_paid_application((int)$payment['application_id']);

        $actStmt = $pdo->prepare(
            "INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'payment', ?)"
        );
        $actStmt->execute([
            (int)$payment['application_id'],
            $user['id'],
            'Payment of ₱' . number_format((float)$payment['amount'], 2) . ' confirmed received. Application is now in the review pipeline.'
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not confirm this payment: ' . $e->getMessage(), 500);
    }

    $appStmt = db()->prepare('SELECT applicant_id, property_address FROM applications WHERE id = ?');
    $appStmt->execute([(int)$payment['application_id']]);
    $app = $appStmt->fetch();
    if ($app) {
        notify_user(
            (int)$app['applicant_id'],
            'Payment confirmed',
            'Your payment of ₱' . number_format((float)$payment['amount'], 2) . ' for the application at '
                . $app['property_address'] . ' has been confirmed. It is now in the review pipeline.'
        );
    }

    respond(['ok' => true]);
}

// ---------------------------------------------------------------------------
// 4. queue — payments waiting for staff confirmation
// ---------------------------------------------------------------------------
if ($action === 'queue' && $method === 'GET') {
    $user = require_role('staff');
    $deptId = payment_department_for($user);
    if ($deptId === null && $user['role'] !== 'admin') {
        respond(['payments' => [], 'has_payment_scope' => false]);
    }
    $scopedDeptIds = [];
    if ($deptId !== null) {
        $scopedDeptIds[] = $deptId;
        $bStmt = db()->prepare("SELECT barangay_id FROM departments WHERE id = ?");
        $bStmt->execute([$deptId]);
        $bId = $bStmt->fetchColumn();
        if ($bId) {
            $allBDepts = db()->prepare("SELECT id FROM departments WHERE barangay_id = ?");
            $allBDepts->execute([$bId]);
            foreach ($allBDepts->fetchAll() as $row) {
                $scopedDeptIds[] = (int)$row['id'];
            }
            $scopedDeptIds = array_values(array_unique($scopedDeptIds));
        }
    }

    if ($user['role'] === 'admin') {
        $where = "WHERE p.status = 'pending' AND p.reference IS NOT NULL";
        $params = [];
    } else {
        $inClause = implode(',', array_fill(0, count($scopedDeptIds), '?'));
        $where = "WHERE p.recipient_department_id IN ($inClause) AND p.status = 'pending' AND p.reference IS NOT NULL";
        $params = $scopedDeptIds;
    }

    $stmt = db()->prepare(
        "SELECT p.*, a.property_address, a.permit_type, pt.name AS permit_type_name, u.full_name AS applicant_name
           FROM payments p
           JOIN applications a ON a.id = p.application_id
           JOIN users u ON u.id = a.applicant_id
           LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
          $where
          ORDER BY p.updated_at ASC"
    );
    $stmt->execute($params);
    respond(['payments' => $stmt->fetchAll(), 'has_payment_scope' => true]);
}

// ---------------------------------------------------------------------------
// 5. status — applicant polls their payment(s)
// ---------------------------------------------------------------------------
if ($action === 'status' && $method === 'GET') {
    $user = require_auth();
    $idsRaw = $_GET['application_ids'] ?? '';
    $applicationIds = array_values(array_unique(array_filter(array_map('intval', explode(',', (string)$idsRaw)))));
    if (!$applicationIds) {
        respond(['payments' => []]);
    }
    $placeholders = implode(',', array_fill(0, count($applicationIds), '?'));
    $stmt = db()->prepare(
        "SELECT p.* FROM payments p JOIN applications a ON a.id = p.application_id
          WHERE p.application_id IN ($placeholders) AND a.applicant_id = ?"
    );
    $stmt->execute([...$applicationIds, $user['id']]);
    respond(['payments' => $stmt->fetchAll()]);
}

// ---------------------------------------------------------------------------
// 6. webhook — PayMongo checkout_session.payment.paid events
// ---------------------------------------------------------------------------
if ($action === 'webhook' && $method === 'POST') {
    $webhookSecret = app_config()['paymongo']['webhook_secret'] ?? '';
    $rawBody   = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';

    if ($webhookSecret && $sigHeader) {
        $parts = [];
        foreach (explode(',', $sigHeader) as $part) {
            [$k, $v] = explode('=', $part, 2);
            $parts[$k] = $v;
        }
        $ts           = $parts['t'] ?? '';
        $signedPayload = $ts . '.' . $rawBody;
        $expected     = hash_hmac('sha256', $signedPayload, $webhookSecret);
        $received     = $parts['te'] ?? $parts['li'] ?? '';
        if (!hash_equals($expected, $received)) {
            http_response_code(400);
            exit;
        }
    }

    $event = json_decode($rawBody, true);
    $type  = $event['data']['attributes']['type'] ?? '';

    if (in_array($type, ['checkout_session.payment.paid', 'payment.paid'], true)) {
        $sessionId = $event['data']['attributes']['data']['attributes']['checkout_session_id']
            ?? $event['data']['attributes']['data']['id']
            ?? '';
        $ref = $event['data']['attributes']['data']['id'] ?? '';

        if ($sessionId) {
            $upd = db()->prepare(
                "UPDATE payments SET reference = ?, status = 'pending', updated_at = NOW()
                  WHERE paymongo_payment_intent_id = ? AND status != 'succeeded' AND reference IS NULL"
            );
            $upd->execute([$ref, $sessionId]);
            if ($upd->rowCount() > 0) {
                $payItems = db()->prepare("SELECT p.application_id, p.amount, p.method, a.applicant_id FROM payments p JOIN applications a ON a.id = p.application_id WHERE p.paymongo_payment_intent_id = ?");
                $payItems->execute([$sessionId]);
                $actStmt = db()->prepare("INSERT INTO application_activity (application_id, sender_id, type, event, body) VALUES (?, ?, 'status_change', 'payment', ?)");
                foreach ($payItems->fetchAll() as $item) {
                    $mLabel = PAYMENT_METHOD_LABELS[$item['method']] ?? strtoupper((string)$item['method']);
                    $actStmt->execute([
                        $item['application_id'],
                        $item['applicant_id'],
                        'Payment of ₱' . number_format((float)$item['amount'], 2) . ' received via ' . $mLabel . ' (ref ' . $ref . '). Waiting for office confirmation.'
                    ]);
                }
            }
        }
    }

    http_response_code(200);
    echo '{"received":true}';
    exit;
}

fail('Unknown action.', 404);

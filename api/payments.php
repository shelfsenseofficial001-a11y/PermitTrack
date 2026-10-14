<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/pipeline.php';
require_once __DIR__ . '/lib/support.php';

/*
 * Section 3 — payment. A fee-bearing application is created already (applications.php
 * create_v2), sitting at status='Payment Pending' with one 'payments' row per application
 * (amount + recipient already decided; method/reference still empty). This file is the rest of
 * the trip:
 *
 *   1. 'checkout'  (applicant) — GCash / Maya / Bank Transfer, through a simulated PayMongo
 *      checkout in test mode. A real PayMongo secret key in app_config() would call the real
 *      test-mode API here; none is configured for this install, so it always takes the
 *      simulated path (deterministic on the 'simulate' field the frontend sends, so a demo can
 *      show both outcomes on purpose). A reference is only ever set once checkout succeeds —
 *      that is what distinguishes "not paid yet" from "paid online, waiting on staff to confirm".
 *   2. 'confirm'   (staff, payment-bridge departments only, migration 040) — the actual
 *      authoritative step: staff confirms the money arrived, which is what activates the
 *      application's pipeline (api/lib/pipeline.php activate_paid_application()). Payment
 *      bridges never decide a permit — this is the only action they can take here.
 *   3. 'queue'     (staff) — pending-confirmation payments in that staff member's own scope.
 *   4. 'status'    (applicant) — poll a payment's state (for the "waiting on confirmation" screen).
 */

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const PAYMENT_METHODS = ['gcash', 'maya', 'bank_transfer'];
const PAYMENT_METHOD_LABELS = ['gcash' => 'GCash', 'maya' => 'Maya', 'bank_transfer' => 'Bank Transfer'];

/** Whether this staff account is one of the payment-bridge accounts (migration 040), and if so, its department id. */
function payment_department_for(array $user): ?int
{
    if (empty($user['department_id'])) {
        return null;
    }
    $stmt = db()->prepare("SELECT id FROM departments WHERE id = ? AND purpose = 'payment'");
    $stmt->execute([$user['department_id']]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

if ($action === 'checkout' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $idsRaw = $in['application_ids'] ?? [];
    $applicationIds = is_array($idsRaw) ? array_values(array_unique(array_filter(array_map('intval', $idsRaw)))) : [];
    $payMethod = (string)($in['method'] ?? '');
    $simulate = (string)($in['simulate'] ?? 'success');

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

    // Real PayMongo test-mode call would go here when app_config()['paymongo']['secret_key'] is
    // set (see .env.example / api/config.local.example.php) — not implemented in this install;
    // every install falls back to the simulation below, which is deterministic on purpose so a
    // demo can show either outcome on request rather than leaving it to chance.
    $gatewayConfigured = !empty(app_config()['paymongo']['secret_key'] ?? '');
    $succeeded = $simulate !== 'fail'; // 'fail' is the only way to see a declined simulated payment

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($succeeded) {
            $reference = 'SIM-' . strtoupper(bin2hex(random_bytes(5)));
            $upd = $pdo->prepare("UPDATE payments SET method = ?, reference = ?, status = 'pending', updated_at = NOW() WHERE id = ?");
            foreach ($payments as $p) {
                $upd->execute([$payMethod, $reference, $p['id']]);
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
        'ok' => true,
        'succeeded' => $succeeded,
        'status' => $succeeded ? 'pending_confirmation' : 'failed',
        'message' => $succeeded
            ? 'Payment received via ' . PAYMENT_METHOD_LABELS[$payMethod] . '. It is now waiting on the recipient office to confirm.'
            : 'That payment did not go through. You can try again.',
    ]);
}

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
    if ($user['role'] !== 'admin' && (int)$payment['recipient_department_id'] !== $deptId) {
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
            'Your payment of ' . number_format((float)$payment['amount'], 2) . ' for the application at '
                . $app['property_address'] . ' has been confirmed. It is now in the review pipeline.'
        );
    }

    respond(['ok' => true]);
}

if ($action === 'queue' && $method === 'GET') {
    $user = require_role('staff');
    $deptId = payment_department_for($user);
    if ($deptId === null && $user['role'] !== 'admin') {
        respond(['payments' => [], 'has_payment_scope' => false]);
    }
    // Admins see every pending payment, same "nothing is ever out of reach" rule as everywhere
    // else in the app — a payment-bridge account only sees its own.
    $where = $deptId !== null ? 'WHERE p.recipient_department_id = ? AND p.status = \'pending\' AND p.reference IS NOT NULL'
                               : 'WHERE p.status = \'pending\' AND p.reference IS NOT NULL';
    $stmt = db()->prepare(
        "SELECT p.*, a.property_address, a.permit_type, pt.name AS permit_type_name, u.full_name AS applicant_name
           FROM payments p
           JOIN applications a ON a.id = p.application_id
           JOIN users u ON u.id = a.applicant_id
           LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
          $where
          ORDER BY p.updated_at ASC"
    );
    $stmt->execute($deptId !== null ? [$deptId] : []);
    respond(['payments' => $stmt->fetchAll(), 'has_payment_scope' => true]);
}

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

fail('Unknown action.', 404);

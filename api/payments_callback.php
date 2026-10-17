<?php
declare(strict_types=1);
/**
 * PayMongo return-URL handler (Checkout Session flow).
 *
 * PayMongo redirects the applicant here after GCash / Maya / Card
 * authorisation. Our success_url and cancel_url are:
 *
 *   /api/payments_callback.php?batch=<batch_token>           (success)
 *   /api/payments_callback.php?batch=<batch_token>&failed=1  (cancelled/failed)
 *
 * This script:
 *   1. If ?failed=1 is present, redirects to the SPA with payment_failed.
 *   2. Directly retrieves the Checkout Session from PayMongo sandbox API.
 *   3. If paid/authorized: records the payment reference and marks status='pending'
 *      (waiting for Barangay Secretary / payment office confirmation).
 *   4. Redirects the applicant's browser to the permit page in the SPA.
 */

require_once __DIR__ . '/config.php';

$batchToken = $_GET['batch'] ?? '';
$failed     = !empty($_GET['failed']);
$sessionId  = $_GET['session_id'] ?? '';

$base = app_base_url();

if ($failed || !$batchToken) {
    header('Location: ' . $base . '/#/applications/new?payment_failed=1');
    exit;
}

// 1. Find payments by batch_token
$stmt = db()->prepare("SELECT id, application_id, paymongo_payment_intent_id, status FROM payments WHERE batch_token = ?");
$stmt->execute([$batchToken]);
$payments = $stmt->fetchAll();

if (!$payments) {
    header('Location: ' . $base . '/#/applications/new?payment_failed=1');
    exit;
}

if (!$sessionId) {
    $sessionId = $payments[0]['paymongo_payment_intent_id'] ?? '';
}

$paymentSucceeded = false;
$ref = null;

if ($sessionId) {
    $secretKey = app_config()['paymongo']['secret_key'] ?? '';
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => 'https://api.paymongo.com/v1/checkout_sessions/' . $sessionId,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD        => $secretKey . ':',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw && $code === 200) {
        $csData = json_decode($raw, true);
        $attrs = $csData['data']['attributes'] ?? [];
        $status = $attrs['status'] ?? '';
        
        $paymentsList = $attrs['payments'] ?? [];
        foreach ($paymentsList as $pItem) {
            $pStatus = $pItem['attributes']['status'] ?? '';
            if (in_array($pStatus, ['paid', 'succeeded'], true)) {
                $paymentSucceeded = true;
                $ref = $pItem['id'] ?? null;
            }
        }
        
        $piStatus = $attrs['payment_intent']['attributes']['status'] ?? '';
        if (!$paymentSucceeded && in_array($piStatus, ['succeeded', 'paid', 'awaiting_capture'], true)) {
            $paymentSucceeded = true;
            $ref = $attrs['payment_intent']['attributes']['payments'][0]['id'] ?? null;
        }

        if ($status === 'paid') {
            $paymentSucceeded = true;
        }
    }
}

if (!$ref && $paymentSucceeded) {
    $ref = 'PM-' . strtoupper(substr(hash('sha256', $sessionId), 0, 10));
}

$pdo = db();
$pdo->beginTransaction();
try {
    if ($paymentSucceeded) {
        $pdo->prepare(
            "UPDATE payments SET reference = ?, paymongo_payment_intent_id = ?, status = 'pending', updated_at = NOW()
              WHERE batch_token = ? AND status != 'succeeded'"
        )->execute([$ref, $sessionId, $batchToken]);
    } else {
        $pdo->prepare(
            "UPDATE payments SET paymongo_payment_intent_id = ?, status = 'failed', updated_at = NOW()
              WHERE batch_token = ? AND (status = 'pending' OR reference IS NULL)"
        )->execute([$sessionId, $batchToken]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
}

if ($paymentSucceeded) {
    $appIds = array_values(array_unique(array_filter(array_column($payments, 'application_id'))));
    if (count($appIds) === 1) {
        header('Location: ' . $base . '/#/applications/' . intval($appIds[0]));
    } else {
        header('Location: ' . $base . '/#/permits');
    }
} else {
    header('Location: ' . $base . '/#/applications/new?payment_failed=1');
}
exit;

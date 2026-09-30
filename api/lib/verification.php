<?php
declare(strict_types=1);

require_once __DIR__ . '/notify.php';

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const CODE_RESEND_SECONDS = 60;
const CODE_MAX_PER_HOUR = 8;

function mask_destination(string $channel, string $destination): string
{
    if ($channel === 'sms') {
        return substr($destination, 0, 4) . str_repeat('•', max(0, strlen($destination) - 7)) . substr($destination, -3);
    }
    [$local, $domain] = array_pad(explode('@', $destination, 2), 2, '');
    return substr($local, 0, 2) . str_repeat('•', max(1, strlen($local) - 2)) . '@' . $domain;
}

/**
 * Sends a fresh 6-digit code and returns what the UI needs to show.
 * With the 'log' driver the code is also returned as dev_code so it can be tested locally.
 */
function issue_verification_code(int $userId, string $channel, string $destination, bool $isResend = false): array
{
    $recent = db()->prepare(
        'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age, consumed_at FROM verification_codes
         WHERE user_id = ? AND channel = ? AND destination = ? ORDER BY id DESC LIMIT 1'
    );
    $recent->execute([$userId, $channel, $destination]);
    $last = $recent->fetch();
    // Throttle only repeat sends to the same address (a corrected typo gets a code straight away)
    if ($last && (int)$last['age'] < CODE_RESEND_SECONDS) {
        $wait = CODE_RESEND_SECONDS - (int)$last['age'];
        if ($isResend || $last['consumed_at'] !== null) {
            fail("Please wait $wait seconds before requesting another code.", 429);
        }
        // A code was just sent (e.g. logging in twice quickly) — keep using it
        return [
            'channel' => $channel,
            'sent_to' => mask_destination($channel, $destination),
            'expires_in_minutes' => CODE_TTL_MINUTES,
            'resend_after_seconds' => $wait,
            'already_sent' => true,
        ];
    }

    // Overall cap so one account can't flood inboxes or burn SMS credits
    $hourly = db()->prepare('SELECT COUNT(*) FROM verification_codes WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    $hourly->execute([$userId]);
    if ((int)$hourly->fetchColumn() >= CODE_MAX_PER_HOUR) {
        fail('Too many codes requested. Please try again in an hour.', 429);
    }

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    db()->prepare('UPDATE verification_codes SET consumed_at = NOW() WHERE user_id = ? AND channel = ? AND consumed_at IS NULL')
        ->execute([$userId, $channel]);
    db()->prepare(
        'INSERT INTO verification_codes (user_id, channel, destination, code_hash, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ' . CODE_TTL_MINUTES . ' MINUTE))'
    )->execute([$userId, $channel, $destination, password_hash($code, PASSWORD_DEFAULT)]);

    $municipality = app_config()['municipality'];
    try {
        if ($channel === 'email') {
            send_email(
                $destination,
                'Your PermitTrack verification code',
                "Your PermitTrack verification code is $code.\n\nIt expires in " . CODE_TTL_MINUTES . " minutes. If you didn't request this, you can ignore this email.\n\n— $municipality"
            );
        } else {
            send_sms($destination, "PermitTrack code: $code. Expires in " . CODE_TTL_MINUTES . " min. Do not share this code.");
        }
    } catch (Throwable $e) {
        error_log('Verification send failed: ' . $e->getMessage());
        fail($channel === 'email'
            ? "We couldn't send the email right now. Please try again in a moment."
            : "We couldn't send the text message right now. Please try again in a moment.", 502);
    }

    $result = [
        'channel' => $channel,
        'sent_to' => mask_destination($channel, $destination),
        'expires_in_minutes' => CODE_TTL_MINUTES,
        'resend_after_seconds' => CODE_RESEND_SECONDS,
    ];
    $driver = app_config()[$channel === 'email' ? 'mail' : 'sms']['driver'] ?? 'log';
    if ($driver === 'log') {
        $result['dev_code'] = $code;
    }
    return $result;
}

/** Checks a code; on success marks the email/phone as verified. Returns an error message or null. */
function check_verification_code(int $userId, string $channel, string $code): ?string
{
    $stmt = db()->prepare(
        'SELECT *, expires_at < NOW() AS expired FROM verification_codes
         WHERE user_id = ? AND channel = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$userId, $channel]);
    $row = $stmt->fetch();

    if (!$row || (int)$row['expired'] === 1) {
        return 'This code has expired. Please request a new one.';
    }
    if ((int)$row['attempts'] >= CODE_MAX_ATTEMPTS) {
        return 'Too many wrong attempts. Please request a new code.';
    }
    if (!password_verify($code, $row['code_hash'])) {
        db()->prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]);
        $left = CODE_MAX_ATTEMPTS - (int)$row['attempts'] - 1;
        return $left > 0 ? "That code isn't right. $left attempt(s) left." : 'Too many wrong attempts. Please request a new code.';
    }

    // Save the address the code was sent to (same as before for sign-up; new for "add a contact") and mark it verified
    [$contactColumn, $verifiedColumn] = $channel === 'email' ? ['email', 'email_verified_at'] : ['phone', 'phone_verified_at'];
    try {
        db()->prepare("UPDATE users SET $contactColumn = ?, $verifiedColumn = NOW() WHERE id = ?")->execute([$row['destination'], $userId]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return $channel === 'email' ? 'That email is already used by another account.' : 'That mobile number is already used by another account.';
        }
        throw $e;
    }
    db()->prepare('UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?')->execute([$row['id']]);
    return null;
}

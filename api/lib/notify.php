<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

/*
 * Outgoing email (SMTP) and SMS. Drivers are picked in config.local.php:
 *   mail: 'log' | 'smtp'
 *   sms:  'log' | 'semaphore' | 'twilio'
 * The 'log' driver writes messages to storage/outbox.log instead of sending them,
 * so the app works locally before real credentials are set up.
 */

function notify_log(string $channel, string $to, string $subject, string $body): void
{
    $dir = dirname(__DIR__, 2) . '/storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $entry = sprintf("[%s] %s to %s\n%s%s\n\n", date('Y-m-d H:i:s'), strtoupper($channel), $to, $subject !== '' ? "Subject: $subject\n" : '', $body);
    file_put_contents($dir . '/outbox.log', $entry, FILE_APPEND | LOCK_EX);
}

function send_email(string $to, string $subject, string $body): void
{
    $cfg = app_config()['mail'];
    if (($cfg['driver'] ?? 'log') === 'smtp') {
        smtp_send($cfg, $to, $subject, $body);
        return;
    }
    notify_log('email', $to, $subject, $body);
}

function send_sms(string $to, string $message): void
{
    $cfg = app_config()['sms'];
    switch ($cfg['driver'] ?? 'log') {
        case 'semaphore':
            // https://semaphore.co/docs — Philippine SMS gateway; expects 09XXXXXXXXX or 639XXXXXXXXX
            http_post_form('https://api.semaphore.co/api/v4/messages', [
                'apikey' => $cfg['api_key'] ?? '',
                'number' => ltrim($to, '+'),
                'message' => $message,
                'sendername' => $cfg['sender_name'] ?? '',
            ]);
            return;
        case 'twilio':
            $sid = $cfg['account_sid'] ?? '';
            http_post_form("https://api.twilio.com/2010-04-01/Accounts/$sid/Messages.json", [
                'To' => $to,
                'From' => $cfg['from'] ?? '',
                'Body' => $message,
            ], $sid . ':' . ($cfg['auth_token'] ?? ''));
            return;
        default:
            notify_log('sms', $to, '', $message);
    }
}

function http_post_form(string $url, array $fields, ?string $basicAuth = null): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($basicAuth !== null) {
        curl_setopt($ch, CURLOPT_USERPWD, $basicAuth);
    }
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($response === false || $status >= 400) {
        throw new RuntimeException("SMS provider request failed ($status) $error");
    }
    return (string)$response;
}

/**
 * Sends through SMTP with PHPMailer (the same library and version ShelfSense uses).
 *
 * Config keys: host, port, encryption ('ssl' | 'tls' | 'none'), username, password, from_email, from_name.
 *
 * Encryption is verified, not assumed: PHPMailer checks the server certificate and host name on both
 * implicit TLS (465) and STARTTLS (587). Credentials are refused over an unencrypted connection, so a
 * plaintext downgrade cannot happen silently.
 */
function smtp_send(array $cfg, string $to, string $subject, string $body): void
{
    $host = (string)($cfg['host'] ?? '');
    $port = (int)($cfg['port'] ?? 587);
    $encryption = (string)($cfg['encryption'] ?? 'tls');
    $username = (string)($cfg['username'] ?? '');
    $password = (string)($cfg['password'] ?? '');
    $fromEmail = (string)($cfg['from_email'] ?? $username);
    $fromName = (string)($cfg['from_name'] ?? app_config()['municipality']);

    if ($host === '' || $fromEmail === '') {
        throw new RuntimeException('Mail is set to SMTP but host or from_email is missing in config.local.php.');
    }
    if (!in_array($encryption, ['ssl', 'tls', 'none'], true)) {
        throw new RuntimeException("Unknown mail encryption '$encryption' (use ssl, tls or none).");
    }
    if ($username !== '' && $encryption === 'none') {
        throw new RuntimeException('Refusing to send SMTP credentials without encryption. Set encryption to ssl or tls.');
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->Port = $port;
        $mail->Timeout = 20;
        $mail->SMTPDebug = 0;                 // never echo the conversation, which includes credentials
        $mail->SMTPAutoTLS = $encryption !== 'none';
        $mail->SMTPSecure = match ($encryption) {
            'ssl' => PHPMailer::ENCRYPTION_SMTPS,
            'tls' => PHPMailer::ENCRYPTION_STARTTLS,
            default => '',
        };
        $mail->SMTPAuth = $username !== '';
        if ($mail->SMTPAuth) {
            $mail->Username = $username;
            $mail->Password = $password;
        }
        // Verify the certificate chain and the host name. Stated explicitly so a future change to the
        // library's defaults cannot quietly weaken it.
        $mail->SMTPOptions = ['ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ]];

        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->isHTML(false);
        $mail->Body = $body;
        $mail->send();
    } catch (MailException $e) {
        // PHPMailer's message describes the failure; it does not contain the password.
        throw new RuntimeException('Could not send mail: ' . $e->getMessage(), 0, $e);
    }
}

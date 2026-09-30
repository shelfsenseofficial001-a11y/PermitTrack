<?php
declare(strict_types=1);

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
 * Minimal SMTP client (AUTH LOGIN over SSL on 465 or STARTTLS on 587).
 * Config keys: host, port, encryption ('ssl'|'tls'|'none'), username, password, from_email, from_name.
 */
function smtp_send(array $cfg, string $to, string $subject, string $body): void
{
    $host = $cfg['host'] ?? '';
    $port = (int)($cfg['port'] ?? 587);
    $encryption = $cfg['encryption'] ?? 'tls';
    $fromEmail = $cfg['from_email'] ?? ($cfg['username'] ?? '');
    $fromName = $cfg['from_name'] ?? app_config()['municipality'];

    $remote = ($encryption === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 15);
    if (!$socket) {
        throw new RuntimeException("Could not connect to mail server: $errstr");
    }
    stream_set_timeout($socket, 15);

    $expect = function (array $codes) use ($socket): string {
        $reply = '';
        while (($line = fgets($socket, 515)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        if (!in_array((int)substr($reply, 0, 3), $codes, true)) {
            throw new RuntimeException('Mail server error: ' . trim($reply));
        }
        return $reply;
    };
    $send = function (string $command, array $codes) use ($socket, $expect): string {
        fwrite($socket, $command . "\r\n");
        return $expect($codes);
    };

    try {
        $expect([220]);
        $send('EHLO permittrack.local', [250]);
        if ($encryption === 'tls') {
            $send('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Could not start TLS with the mail server.');
            }
            $send('EHLO permittrack.local', [250]);
        }
        if (!empty($cfg['username'])) {
            $send('AUTH LOGIN', [334]);
            $send(base64_encode($cfg['username']), [334]);
            $send(base64_encode($cfg['password'] ?? ''), [235]);
        }
        $send("MAIL FROM:<$fromEmail>", [250]);
        $send("RCPT TO:<$to>", [250, 251]);
        $send('DATA', [354]);

        $encode = fn(string $s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
        $headers = [
            'Date: ' . date('r'),
            'From: ' . $encode($fromName) . " <$fromEmail>",
            "To: <$to>",
            'Subject: ' . $encode($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . ($host ?: 'permittrack.local') . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        // Base64 lines never start with ".", so no dot-stuffing is needed
        fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body)) . "\r\n.\r\n");
        $expect([250]);
        $send('QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

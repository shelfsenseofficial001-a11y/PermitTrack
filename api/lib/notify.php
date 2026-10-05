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
 * SMTP client: implicit TLS (ssl, port 465) or STARTTLS (tls, port 587), with the server
 * certificate verified against the host name. Credentials are only ever sent over an encrypted
 * channel; a plaintext connection with a username is refused rather than downgraded.
 *
 * Config keys: host, port, encryption ('ssl'|'tls'|'none'), username, password, from_email, from_name.
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
    // Never send a password in clear text.
    if ($username !== '' && $encryption === 'none') {
        throw new RuntimeException('Refusing to send SMTP credentials without encryption. Set encryption to ssl or tls.');
    }

    // Certificate checks: the peer must present a certificate for $host that a trusted CA signed.
    // The CA bundle is the one PHP already uses for HTTPS (openssl.cafile / curl-ca-bundle).
    $tls = [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'peer_name' => $host,
        'SNI_enabled' => true,
        'allow_self_signed' => false,
        'disable_compression' => true,
        'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0),
    ];
    $cafile = ini_get('openssl.cafile') ?: '';
    if ($cafile !== '') {
        $tls['cafile'] = $cafile;
    }

    $remote = ($encryption === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => $tls]));
    if (!$socket) {
        throw new RuntimeException("Could not connect to mail server $host:$port: $errstr");
    }
    stream_set_timeout($socket, 20);

    // Reads one complete reply, including multi-line ones ("250-..." continues until "250 ...").
    $read = function () use ($socket): array {
        $lines = [];
        while (($line = fgets($socket, 1024)) !== false) {
            $lines[] = rtrim($line, "\r\n");
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        if (!$lines) {
            throw new RuntimeException('The mail server closed the connection unexpectedly.');
        }
        return [(int)substr($lines[0], 0, 3), $lines];
    };
    $expect = function (array $codes) use ($read): array {
        [$code, $lines] = $read();
        if (!in_array($code, $codes, true)) {
            throw new RuntimeException('Mail server error ' . $code . ': ' . $lines[count($lines) - 1]);
        }
        return $lines;
    };
    $send = function (string $command, array $codes) use ($socket, $expect): array {
        // Credentials and message bodies are never echoed into an exception or a log.
        fwrite($socket, $command . "\r\n");
        return $expect($codes);
    };
    $ehlo = 'EHLO ' . (gethostname() ?: 'permittrack.local');

    try {
        $expect([220]);
        $caps = $send($ehlo, [250]);

        if ($encryption === 'tls') {
            if (!in_array('STARTTLS', array_map(fn($l) => strtoupper(substr($l, 4)), $caps), true)) {
                throw new RuntimeException('The mail server does not offer STARTTLS, so the connection cannot be encrypted.');
            }
            $send('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, $tls['crypto_method'])) {
                throw new RuntimeException('Could not start TLS with the mail server, or its certificate did not verify for ' . $host . '.');
            }
            $caps = $send($ehlo, [250]);   // capabilities are re-announced after TLS
        }

        if ($username !== '') {
            $advertised = strtoupper(implode(' ', array_map(fn($l) => substr($l, 4), $caps)));
            if (str_contains($advertised, 'AUTH') && str_contains($advertised, 'PLAIN')) {
                $send('AUTH PLAIN ' . base64_encode("\0" . $username . "\0" . $password), [235]);
            } else {
                $send('AUTH LOGIN', [334]);
                $send(base64_encode($username), [334]);
                $send(base64_encode($password), [235]);
            }
        }

        $send("MAIL FROM:<$fromEmail>", [250]);
        $send("RCPT TO:<$to>", [250, 251]);
        $send('DATA', [354]);

        $encodeHeader = fn(string $s) => preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
        $headers = [
            'Date: ' . date('r'),
            'From: ' . $encodeHeader($fromName) . " <$fromEmail>",
            "To: <$to>",
            'Subject: ' . $encodeHeader($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . ($host ?: 'permittrack.local') . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        // Base64 lines never start with ".", so no dot-stuffing is needed.
        fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body)) . "\r\n.\r\n");
        $expect([250]);
        $send('QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

<?php
declare(strict_types=1);

/**
 * Sign in with Google: checks the ID token that Google Identity Services hands the browser.
 *
 * The token is a JWT signed by Google. It is verified here, on the server, against Google's
 * published signing certificates — the browser's word that someone "signed in with Google" is
 * worth nothing on its own. The certificates are cached for as long as Google says they are valid.
 */

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_CLOCK_SKEW_SECONDS = 300;

/** The OAuth client id from config.local.php, or '' when Google sign-in is not set up. */
function google_client_id(): string
{
    return trim((string)(app_config()['google']['client_id'] ?? ''));
}

function base64url_decode(string $data): string|false
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4), true);
}

/** Google's current signing certificates, keyed by key id (PEM strings). */
function google_certs(bool $refresh = false): array
{
    $cacheFile = dirname(__DIR__, 2) . '/storage/cache/google-certs.json';
    if (!$refresh && is_file($cacheFile)) {
        $cached = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($cached) && ($cached['expires_at'] ?? 0) > time() && is_array($cached['certs'] ?? null)) {
            return $cached['certs'];
        }
    }

    $maxAge = 3600;
    $ch = curl_init(GOOGLE_CERTS_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HEADERFUNCTION => function ($ch, string $header) use (&$maxAge) {
            if (preg_match('/^cache-control:.*max-age=(\d+)/i', $header, $m)) {
                $maxAge = (int)$m[1];
            }
            return strlen($header);
        },
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $certs = $body !== false && $status === 200 ? json_decode((string)$body, true) : null;
    if (!is_array($certs) || !$certs) {
        throw new RuntimeException("Could not fetch Google signing certificates ($status) $error");
    }

    @mkdir(dirname($cacheFile), 0775, true);
    @file_put_contents($cacheFile, json_encode(['expires_at' => time() + $maxAge, 'certs' => $certs]), LOCK_EX);
    return $certs;
}

/**
 * Verifies a Google ID token and returns its claims, or null when it is not a valid, current
 * token issued by Google for this app's client id with a verified email address.
 */
function google_verify_id_token(string $jwt): ?array
{
    $clientId = google_client_id();
    $parts = explode('.', $jwt);
    if ($clientId === '' || count($parts) !== 3) {
        return null;
    }
    [$h64, $p64, $s64] = $parts;
    $header = json_decode((string)base64url_decode($h64), true);
    $claims = json_decode((string)base64url_decode($p64), true);
    $signature = base64url_decode($s64);
    if (!is_array($header) || !is_array($claims) || $signature === false) {
        return null;
    }
    if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        return null;
    }

    // Google rotates its keys; a key id we have not seen yet means our cached set is stale.
    $certs = google_certs();
    if (!isset($certs[$header['kid']])) {
        $certs = google_certs(true);
    }
    $cert = $certs[$header['kid']] ?? null;
    if (!is_string($cert) || openssl_verify("$h64.$p64", $signature, $cert, OPENSSL_ALGO_SHA256) !== 1) {
        return null;
    }

    $now = time();
    $emailVerified = ($claims['email_verified'] ?? false) === true || ($claims['email_verified'] ?? '') === 'true';
    $valid = in_array($claims['iss'] ?? '', GOOGLE_ISSUERS, true)
        && ($claims['aud'] ?? '') === $clientId
        && (int)($claims['exp'] ?? 0) > $now - GOOGLE_CLOCK_SKEW_SECONDS
        && (int)($claims['iat'] ?? 0) < $now + GOOGLE_CLOCK_SKEW_SECONDS
        && !empty($claims['sub'])
        && filter_var($claims['email'] ?? '', FILTER_VALIDATE_EMAIL)
        && $emailVerified;
    return $valid ? $claims : null;
}

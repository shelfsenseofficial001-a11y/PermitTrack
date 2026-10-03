<?php
declare(strict_types=1);

/**
 * Philippine Standard Geographic Code (PSGC) lookup — provinces and the cities/municipalities
 * under them, for the address on an account.
 *
 * PermitTrack only issues permits for Dasmariñas, so the address field has one job beyond being
 * on record: to say whether someone lives in this city or not. Province -> City/Municipality
 * answers that. Barangay precision is only needed *inside* Dasmariñas, and those 75 live in the
 * `barangays` table with real foreign keys doing the permit routing — so the national barangay
 * list (~11 MB) is deliberately not carried here.
 *
 * Source is psgc.gitlab.io/api, which has no per-request filtering: each endpoint returns the
 * whole national list. Responses are cached to disk and filtered locally, refreshed weekly. A
 * stale cache is served when a refresh fails rather than failing the request, because this data
 * changes on the order of years. The cache ships seeded, so a fresh install works offline.
 *
 * No postal-code data: there is no reliable, complete Philippines-wide dataset tying postal codes
 * to city or barangay, so postal code stays a plain format-validated field.
 *
 * Mirrors ShelfSense's App\Core\PsgcClient so the two agree on codes and naming.
 */

const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';
const PSGC_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // a week

/** Dasmariñas, Cavite. The one city this system issues permits for. */
const PSGC_HOME_CITY_CODE = '042106000';
const PSGC_HOME_PROVINCE_CODE = '042100000';

function psgc_cache_dir(): string
{
    return dirname(__DIR__, 2) . '/storage/cache/psgc';
}

/** All provinces, by name. */
function psgc_provinces(): array
{
    $list = array_map(
        fn($p) => ['code' => $p['code'], 'name' => $p['name']],
        psgc_load('provinces')
    );
    usort($list, fn($a, $b) => strcmp($a['name'], $b['name']));
    return $list;
}

/** The cities and municipalities of one province, by name. */
function psgc_cities(string $provinceCode): array
{
    $list = array_values(array_filter(
        psgc_load('cities-municipalities'),
        fn($c) => ($c['provinceCode'] ?? null) === $provinceCode
    ));
    $list = array_map(fn($c) => ['code' => $c['code'], 'name' => $c['name']], $list);
    usort($list, fn($a, $b) => strcmp($a['name'], $b['name']));
    return $list;
}

/**
 * True only when the city really does sit under that province in the current PSGC. A form can be
 * tampered with, so the pair is re-checked here before anything is stored.
 */
function psgc_is_valid_pair(string $provinceCode, string $cityCode): bool
{
    foreach (psgc_cities($provinceCode) as $city) {
        if ($city['code'] === $cityCode) {
            return true;
        }
    }
    return false;
}

/** The display name for a code, or null if it is not one we know. */
function psgc_name(array $list, string $code): ?string
{
    foreach ($list as $item) {
        if ($item['code'] === $code) {
            return $item['name'];
        }
    }
    return null;
}

/** Whether this city is the one PermitTrack serves. Compared by code, never by spelling. */
function psgc_is_home_city(?string $cityCode): bool
{
    return $cityCode === PSGC_HOME_CITY_CODE;
}

function psgc_load(string $endpoint): array
{
    $dir = psgc_cache_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $cacheFile = $dir . '/' . $endpoint . '.json';
    $isFresh = is_file($cacheFile) && (time() - filemtime($cacheFile)) < PSGC_CACHE_TTL_SECONDS;

    if (!$isFresh) {
        $fetched = psgc_fetch($endpoint);
        if ($fetched !== null) {
            file_put_contents($cacheFile, $fetched);
        } elseif (is_file($cacheFile)) {
            // Upstream is unreachable and what we have is old. Old is fine — touch it so the next
            // request does not retry the fetch on every page load.
            touch($cacheFile);
        }
    }

    if (!is_file($cacheFile)) {
        throw new RuntimeException("PSGC data for '$endpoint' is unavailable (no cache, and the fetch failed).");
    }
    $decoded = json_decode((string)file_get_contents($cacheFile), true);
    return is_array($decoded) ? $decoded : [];
}

function psgc_fetch(string $endpoint): ?string
{
    $context = stream_context_create(['http' => [
        'timeout' => 8,
        'header' => "Accept: application/json\r\n",
    ]]);
    $body = @file_get_contents(PSGC_BASE_URL . '/' . $endpoint . '/', false, $context);
    if ($body === false || trim($body) === '') {
        return null;
    }
    // Only accept something that actually parses as a non-empty list, so a captive portal or an
    // error page never overwrites a good cache.
    $decoded = json_decode($body, true);
    return (is_array($decoded) && $decoded) ? $body : null;
}

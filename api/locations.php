<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/psgc.php';

/**
 * The address pickers: provinces, and the cities/municipalities under one of them.
 *
 * Reference data, the same for everyone, so it only needs a signed-in account rather than any
 * particular role. Barangays are not served here — inside Dasmariñas they come from the
 * `barangays` table (residency.php / applications.php), and outside it they are not collected.
 */

$action = $_GET['action'] ?? '';

if ($action === 'provinces' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_auth();
    respond([
        'provinces' => psgc_provinces(),
        // So the form can offer "I live in Dasmariñas" without hunting for it in the list.
        'home' => [
            'province_code' => PSGC_HOME_PROVINCE_CODE,
            'city_code' => PSGC_HOME_CITY_CODE,
        ],
    ]);
}

if ($action === 'cities' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_auth();
    $provinceCode = trim((string)($_GET['province_code'] ?? ''));
    if ($provinceCode === '') {
        fail('province_code is required.');
    }
    respond(['cities' => psgc_cities($provinceCode)]);
}

fail('Unknown action.', 404);

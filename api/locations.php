<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/psgc.php';

/**
 * The address pickers: provinces, and the cities/municipalities under one of them.
 *
 * Public reference data, identical for everyone and needed on the registration form before an
 * account exists, so it is not gated. Barangays are not served here — inside Dasmariñas they come from the
 * `barangays` table (residency.php / applications.php), and outside it they are not collected.
 */

$action = $_GET['action'] ?? '';

if ($action === 'provinces' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'provinces' => psgc_provinces(),
        // So the form can offer "I live in Dasmariñas" without hunting for it in the list.
        'home' => [
            'province_code' => PSGC_HOME_PROVINCE_CODE,
            'city_code' => PSGC_HOME_CITY_CODE,
        ],
    ]);
}

// The 75 barangays of Dasmariñas, for when the chosen city is this one. Needed on the
// registration form too, which runs before there is an account to authenticate.
if ($action === 'barangays' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once __DIR__ . '/lib/support.php';
    respond(['barangays' => barangay_options()]);
}

if ($action === 'cities' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $provinceCode = trim((string)($_GET['province_code'] ?? ''));
    if ($provinceCode === '') {
        fail('province_code is required.');
    }
    respond(['cities' => psgc_cities($provinceCode)]);
}

fail('Unknown action.', 404);

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/verification.php';
require_once __DIR__ . '/lib/support.php';   // find_barangay()
require_once __DIR__ . '/lib/psgc.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/** Validates an email or PH mobile number for the given channel; returns the normalized value. */
function clean_contact(string $channel, string $value): string
{
    if ($channel === 'email') {
        $value = strtolower(trim($value));
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            fail('Please enter a valid email address.');
        }
        return $value;
    }
    $phone = normalize_ph_mobile($value);
    if (!$phone) {
        fail('Please enter a valid mobile number, e.g. 0917 123 4567.');
    }
    return $phone;
}

// Personal details from the profile page. Contact details are deliberately not editable
// here: changing an email or mobile goes through add_contact/verify_contact so the new
// value is always proven before it replaces the old one.
if ($action === 'update_profile' && $method === 'POST') {
    $user = require_auth();
    $in = json_input();
    $str = fn(string $key) => trim((string)($in[$key] ?? ''));

    $first = $str('first_name');
    $middle = $str('middle_name');
    $last = $str('last_name');
    $birthdate = $str('birthdate');
    $addressLine = $str('address_line');
    $barangay = $str('barangay');
    $provinceCode = $str('province_code');
    $cityCode = $str('city_code');
    $postal = $str('postal_code');

    if ($first === '' || $last === '') {
        fail('First and last name are required.');
    }
    $dob = DateTime::createFromFormat('Y-m-d', $birthdate);
    if (!$dob || $dob->format('Y-m-d') !== $birthdate) {
        fail('Please enter a valid date of birth.');
    }
    $age = $dob->diff(new DateTime('today'))->y;
    if ($age < 18) {
        fail('You must be at least 18 years old to use this service.');
    }
    if ($age > 80) {
        fail('Please enter a valid date of birth (age must be 80 or below).');
    }
    if ($addressLine === '') {
        fail('House / street is required.');
    }
    // The city is picked from the PSGC list, not typed, and the pair is re-checked here: a form can
    // be tampered with, and whether an account is in this city decides what it may file.
    if ($provinceCode === '' || $cityCode === '') {
        fail('Please choose your province and city or municipality.');
    }
    if (!psgc_is_valid_pair($provinceCode, $cityCode)) {
        fail('That city or municipality is not in the province you chose.');
    }
    $province = psgc_name(psgc_provinces(), $provinceCode);
    $city = psgc_name(psgc_cities($provinceCode), $cityCode);
    if ($province === null || $city === null) {
        fail('Please choose your province and city or municipality.');
    }

    // Barangay is only asked for, and only means anything, inside the city this system serves.
    $inHomeCity = psgc_is_home_city($cityCode);
    if ($inHomeCity) {
        if ($barangay === '') {
            fail('Please choose your barangay.');
        }
        if (!find_barangay($barangay)) {
            fail('Please choose your barangay from the list.');
        }
    } else {
        $barangay = '';
    }
    if (!preg_match('/^\d{4}$/', $postal)) {
        fail('Postal / ZIP code must be 4 digits.');
    }

    $fullName = trim($first . ' ' . ($middle !== '' ? $middle . ' ' : '') . $last);

    // Residency is a statement about living at one particular address in this city, checked by
    // City Staff against two proofs. Move, and that statement no longer holds — so changing the
    // address gives the residency up, and it has to be applied for again from the new one.
    $addressChanged = $addressLine !== (string)($user['address_line'] ?? '')
        || $barangay !== (string)($user['barangay'] ?? '')
        || $cityCode !== (string)($user['city_code'] ?? '');
    $holdsResidency = in_array($user['resident_status'], ['verified', 'pending'], true);
    $losesResidency = $addressChanged && $holdsResidency;

    // The warning is enforced here, not only in the form: a client that skips it still has to come
    // back with the confirmation before anything is written.
    if ($losesResidency && empty($in['confirm_residency_reset'])) {
        respond([
            'requires_confirmation' => 'residency_reset',
            'current_status' => $user['resident_status'],
            'message' => $user['resident_status'] === 'verified'
                ? 'Changing your address gives up your verified residency. You will not be able to file resident permits until you apply again from your new address.'
                : 'Changing your address cancels the residency application you have under review. You will need to apply again from your new address.',
        ], 409);
    }

    // The barangay only means something inside this city. Outside it there is no barangay office to
    // route to, so the link is dropped rather than left pointing at the old secretariat.
    $matchedBarangay = $inHomeCity ? find_barangay($barangay) : null;
    $barangayId = $matchedBarangay ? (int)$matchedBarangay['id'] : null;

    $sql = 'UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, full_name = ?, birthdate = ?,
                             address_line = ?, barangay = ?, barangay_id = ?,
                             city = ?, city_code = ?, province = ?, province_code = ?, postal_code = ?';
    $params = [
        $first, $middle ?: null, $last, $fullName, $birthdate,
        $addressLine, $barangay ?: null, $barangayId,
        $city, $cityCode, $province, $provinceCode, $postal,
    ];
    if ($losesResidency) {
        $sql .= ", resident_status = 'none'";
    }
    $sql .= ' WHERE id = ?';
    $params[] = $user['id'];

    db()->prepare($sql)->execute($params);

    if ($losesResidency) {
        audit((int)$user['id'], 'account.residency_reset', 'user', (int)$user['id'],
            'Address changed, so residency went back to none');
    }

    respond(['user' => current_user(), 'residency_reset' => $losesResidency]);
}

// Add the contact the user didn't sign up with (email or mobile) — sends a code to it first
if ($action === 'add_contact' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $channel = ($in['channel'] ?? '') === 'sms' ? 'sms' : 'email';
    $value = clean_contact($channel, (string)($in['value'] ?? ''));

    $column = $channel === 'email' ? 'email' : 'phone';
    if (!empty($user[$column . '_verified_at']) && $user[$column] === $value) {
        fail('That ' . ($channel === 'email' ? 'email' : 'number') . ' is already verified on your account.');
    }
    $taken = db()->prepare("SELECT id FROM users WHERE $column = ? AND id <> ?");
    $taken->execute([$value, $user['id']]);
    if ($taken->fetch()) {
        fail($channel === 'email' ? 'That email is already used by another account.' : 'That mobile number is already used by another account.');
    }

    respond(['verification' => issue_verification_code((int)$user['id'], $channel, $value, (bool)($in['resend'] ?? false))]);
}

if ($action === 'verify_contact' && $method === 'POST') {
    $user = require_role('applicant');
    $in = json_input();
    $channel = ($in['channel'] ?? '') === 'sms' ? 'sms' : 'email';
    $code = preg_replace('/\D+/', '', (string)($in['code'] ?? ''));
    if (strlen($code) !== 6) {
        fail('Please enter the 6-digit code.');
    }
    $error = check_verification_code((int)$user['id'], $channel, $code);
    if ($error) {
        fail($error, 422);
    }
    respond(['user' => current_user()]);
}

fail('Unknown action.', 404);

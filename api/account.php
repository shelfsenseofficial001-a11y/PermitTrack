<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/verification.php';

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
    $city = $str('city');
    $postal = $str('postal_code');

    if ($first === '' || $last === '') {
        fail('First and last name are required.');
    }
    $dob = DateTime::createFromFormat('Y-m-d', $birthdate);
    if (!$dob || $dob->format('Y-m-d') !== $birthdate) {
        fail('Please enter a valid date of birth.');
    }
    if ($dob->diff(new DateTime('today'))->y < 18) {
        fail('You must be at least 18 years old to use this service.');
    }
    if ($addressLine === '' || $barangay === '' || $city === '') {
        fail('House/street, barangay and city are required.');
    }
    if (!preg_match('/^\d{4}$/', $postal)) {
        fail('Postal / ZIP code must be 4 digits.');
    }

    $fullName = trim($first . ' ' . ($middle !== '' ? $middle . ' ' : '') . $last);

    $stmt = db()->prepare(
        'UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, full_name = ?, birthdate = ?,
                          address_line = ?, barangay = ?, city = ?, postal_code = ?
         WHERE id = ?'
    );
    $stmt->execute([
        $first, $middle ?: null, $last, $fullName, $birthdate,
        $addressLine, $barangay, $city, $postal, $user['id'],
    ]);

    respond(['user' => current_user()]);
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

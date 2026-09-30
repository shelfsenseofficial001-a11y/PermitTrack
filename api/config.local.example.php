<?php
// Copy this file to config.local.php and fill in real values.
// config.local.php is git-ignored so credentials never get committed.

return [
    'municipality' => 'City of Dasmariñas',

    // Email verification codes
    'mail' => [
        'driver' => 'log', // 'log' (write to storage/outbox.log) or 'smtp'
        // Example for Gmail (needs an App Password, not your normal password):
        // 'driver' => 'smtp',
        // 'host' => 'smtp.gmail.com',
        // 'port' => 587,
        // 'encryption' => 'tls',     // 'tls' (port 587), 'ssl' (port 465) or 'none'
        // 'username' => 'you@gmail.com',
        // 'password' => 'your-app-password',
        // 'from_email' => 'you@gmail.com',
        // 'from_name' => 'PermitTrack',
    ],

    // SMS verification codes
    'sms' => [
        'driver' => 'log', // 'log', 'semaphore' or 'twilio'
        // Semaphore (Philippines) — https://semaphore.co
        // 'driver' => 'semaphore',
        // 'api_key' => 'your-semaphore-api-key',
        // 'sender_name' => 'PERMITTRACK', // must be approved by Semaphore; leave empty for the default
        //
        // Twilio
        // 'driver' => 'twilio',
        // 'account_sid' => 'ACxxxxxxxx',
        // 'auth_token' => 'your-auth-token',
        // 'from' => '+15005550006',
    ],
];

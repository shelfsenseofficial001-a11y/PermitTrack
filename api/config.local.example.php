<?php
// Copy this file to config.local.php and fill in real values.
// config.local.php is git-ignored so credentials never get committed.

return [
    'municipality' => 'City of Dasmariñas',

    // Email verification codes
    'mail' => [
        'driver' => 'log', // 'log' (write to storage/outbox.log) or 'smtp'
        // Real SMTP, with the server certificate verified. Use a provider app password, not your login.
        // Gmail: host smtp.gmail.com, port 587, encryption tls (needs 2-Step Verification + an App Password).
        // 'driver' => 'smtp',
        // 'host' => 'smtp.gmail.com',
        // 'port' => 587,
        // 'encryption' => 'tls',     // 'tls' (port 587), 'ssl' (port 465). 'none' is refused whenever a username is set
        // 'username' => 'you@gmail.com',
        // 'password' => 'your-app-password',
        // 'from_email' => 'you@gmail.com',
        // 'from_name' => 'PermitTrack',
    ],

    // SMS verification codes
    'sms' => [
        'driver' => 'log', // 'log', 'semaphore', 'twilio' or 'philsms'
        // Semaphore (Philippines) — https://semaphore.co
        // 'driver' => 'semaphore',
        // 'api_key' => 'your-semaphore-api-key',
        // 'sender_name' => 'PERMITTRACK', // must be approved by Semaphore; leave empty for the default
        //
        // PhilSMS (Philippines) — https://dashboard.philsms.com
        // 'driver' => 'philsms',
        // 'api_token' => 'your-philsms-api-token',
        // 'sender_id' => 'PhilSMS', // must be approved by PhilSMS; defaults to 'PhilSMS'
        //
        // Twilio
        // 'driver' => 'twilio',
        // 'account_sid' => 'ACxxxxxxxx',
        // 'auth_token' => 'your-auth-token',
        // 'from' => '+15005550006',
    ],

    // Sign in with Google. Create an OAuth client ID (type "Web application") at
    // https://console.cloud.google.com/apis/credentials and add the site's origin under
    // "Authorized JavaScript origins", e.g. http://localhost. Leave empty to hide the button.
    'google' => [
        'client_id' => '', // e.g. 1234567890-abc123.apps.googleusercontent.com
    ],
];

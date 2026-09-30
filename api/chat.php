<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/chatbot.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Opening message + starter chips
if ($action === 'start' && $method === 'GET') {
    $user = current_user();
    $name = $user['first_name'] ?? '';
    respond([
        'text' => 'Hi' . ($name ? " $name" : '') . "! I'm the PermitTrack assistant. I can answer common questions about permits, verification and your account.",
        'suggestions' => chat_starter_suggestions($user),
    ]);
}

if ($action === 'ask' && $method === 'POST') {
    $user = current_user();
    $message = trim((string)(json_input()['message'] ?? ''));
    if ($message === '') {
        fail('Please type a question.');
    }
    $message = mb_substr($message, 0, 500);

    // Simple per-session flood guard
    $now = time();
    $_SESSION['chat_times'] = array_values(array_filter($_SESSION['chat_times'] ?? [], fn($t) => $t > $now - 60));
    if (count($_SESSION['chat_times']) >= 20) {
        fail("You're sending messages quickly — please wait a moment.", 429);
    }
    $_SESSION['chat_times'][] = $now;

    $reply = chatbot_reply($message, $user);

    // Log questions (not answers) so Admins can see what people ask and what the bot missed
    db()->prepare('INSERT INTO chat_messages (user_id, message, matched_faq_id, intent, score) VALUES (?, ?, ?, ?, ?)')
        ->execute([$user['id'] ?? null, $message, $reply['faq_id'], $reply['intent'], $reply['score']]);

    respond([
        'text' => $reply['text'],
        'link' => $reply['link'],
        'suggestions' => $reply['suggestions'],
        'answered' => $reply['intent'] !== 'fallback',
    ]);
}

fail('Unknown action.', 404);

<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/chatbot.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Opening message + starter chips. The very first thing any visitor sees is a language choice
// (English/Tagalog) — nothing else is answered until $_SESSION['chat_lang'] is set, so every
// later reply in this session is in the language they picked.
if ($action === 'start' && $method === 'GET') {
    $user = current_user();
    if (empty($_SESSION['chat_lang'])) {
        respond([
            'text' => chat_t('ask_language', CHAT_DEFAULT_LANG),
            'suggestions' => ['English', 'Tagalog'],
        ]);
    }
    $lang = $_SESSION['chat_lang'];
    $name = $user['first_name'] ?? '';
    respond([
        'text' => chat_t('greeting', $lang, $name ? " $name" : ''),
        'suggestions' => chat_starter_suggestions($user, $lang),
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

    // Still choosing a language: try to read it from this message rather than answer it.
    if (empty($_SESSION['chat_lang'])) {
        $picked = chat_detect_language(chat_normalize($message));
        if ($picked === null) {
            respond([
                'text' => chat_t('language_not_understood', CHAT_DEFAULT_LANG),
                'link' => null,
                'suggestions' => ['English', 'Tagalog'],
                'answered' => false,
            ]);
        }
        $_SESSION['chat_lang'] = $picked;
        $name = $user['first_name'] ?? '';
        respond([
            'text' => chat_t($picked === 'tl' ? 'language_confirmed_tl' : 'language_confirmed_en', $picked)
                . ' ' . chat_t('greeting', $picked, $name ? " $name" : ''),
            'link' => null,
            'suggestions' => chat_starter_suggestions($user, $picked),
            'answered' => true,
        ]);
    }

    $lang = $_SESSION['chat_lang'];
    $reply = chatbot_reply($message, $user, $lang);

    // Log questions (not answers) so Admins can see what people ask and what the bot missed
    db()->prepare('INSERT INTO chat_messages (user_id, message, matched_faq_id, intent, score) VALUES (?, ?, ?, ?, ?)')
        ->execute([$user['id'] ?? null, $message, $reply['faq_id'], $reply['intent'], $reply['score']]);

    respond([
        'text' => $reply['text'],
        'link' => $reply['link'],
        'suggestions' => $reply['suggestions'],
        'answered' => !in_array($reply['intent'], ['fallback', 'off_topic'], true),
    ]);
}

fail('Unknown action.', 404);

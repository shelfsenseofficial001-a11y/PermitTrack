<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/chatbot.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Starts a conversation (first open on a page, or "New chat"): forgets the last one, and the very
// first thing Gibs does is ask English or Tagalog — nothing else is answered until
// $_SESSION['chat_lang'] is set.
if ($action === 'start' && $method === 'GET') {
    unset($_SESSION['chat_lang'], $_SESSION['chat_off_topic_n'], $_SESSION['chat_last_opener']);
    respond([
        'text' => chat_t('ask_language', CHAT_DEFAULT_LANG),
        'suggestions' => ['English', 'Tagalog'],
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

    $normalized = chat_normalize($message);
    $written = chat_guess_language($normalized); // null when it's too short/mixed to tell
    $prefix = '';

    // Still choosing a language. A short reply naming one ("English", "Tagalog po") picks it and gets
    // the greeting. If they skipped the question and just asked something, the language they wrote
    // it in becomes the main language and the question gets answered right away.
    if (empty($_SESSION['chat_lang'])) {
        $named = count(explode(' ', $normalized)) <= 4 ? chat_detect_language($normalized) : null;
        $picked = $named ?? $written;
        if ($picked === null) {
            respond([
                'text' => chat_t('language_not_understood', CHAT_DEFAULT_LANG),
                'link' => null,
                'suggestions' => ['English', 'Tagalog'],
                'answered' => false,
            ]);
        }
        $_SESSION['chat_lang'] = $picked;
        $confirmed = chat_t($picked === 'tl' ? 'language_confirmed_tl' : 'language_confirmed_en', $picked);
        if ($named !== null) {
            $name = $user['first_name'] ?? '';
            respond([
                'text' => $confirmed . ' ' . chat_t('greeting', $picked, $name ? " $name" : ''),
                'link' => null,
                'suggestions' => chat_starter_suggestions($user, $picked),
                'answered' => true,
            ]);
        }
        $prefix = $confirmed . ' ';
    } elseif ($written !== null) {
        // Mid-chat: answer in whatever language they just wrote in, and keep using it from here.
        $_SESSION['chat_lang'] = $written;
    }

    $lang = $_SESSION['chat_lang'];
    $reply = chatbot_reply($message, $user, $lang);
    $reply['text'] = $prefix . $reply['text'];

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

// The same answers Gibs gives, as a list you can search and read without a conversation — the
// "Search for help" box in the chat launcher. Public, like the FAQ on the landing page; editing
// an entry on the Admin page changes it here and in Gibs at once.
if ($action === 'faqs' && $method === 'GET') {
    respond(['faqs' => array_map(fn($f) => [
        'id' => (int)$f['id'],
        'category' => $f['category'],
        'question' => $f['question'],
        'answer' => $f['answer'],
        'link' => $f['link_path'] ? ['path' => $f['link_path'], 'label' => $f['link_label'] ?: 'Open'] : null,
    ], chat_active_faqs())]);
}

fail('Unknown action.', 404);

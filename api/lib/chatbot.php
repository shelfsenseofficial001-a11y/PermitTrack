<?php
declare(strict_types=1);

require_once __DIR__ . '/business.php'; // PERMIT_ELIGIBILITY, approved_businesses()

/*
 * Built-in FAQ chat bot (prototype).
 *
 * chatbot_reply() is the single entry point used by api/chat.php. It returns
 *   ['text' => string, 'link' => ?['path','label'], 'suggestions' => string[], 'intent' => string,
 *    'faq_id' => ?int, 'score' => float]
 * To move to an AI assistant later, keep this signature and swap the body (the FAQ entries can
 * be passed to the model as context), so the chat widget and logging don't need to change.
 */

const CHAT_MIN_SCORE = 2.0; // below this the bot admits it doesn't know

const CHAT_STOPWORDS = [
    'a', 'an', 'the', 'i', 'me', 'my', 'is', 'are', 'am', 'to', 'of', 'for', 'in', 'on', 'and', 'or', 'do', 'does',
    'can', 'how', 'what', 'where', 'when', 'please', 'pls', 'po', 'ba', 'ang', 'ng', 'sa', 'na', 'ko', 'yung', 'it',
    'be', 'with', 'about', 'you', 'your', 'this', 'that', 'there', 'want', 'need', 'get', 'have', 'has', 'hi',
];

/** Words people use for each permit type (for "what does X need?" questions). */
const CHAT_PERMIT_WORDS = [
    'Food Service' => ['food', 'restaurant', 'carinderia', 'eatery', 'cafe', 'kainan', 'food service'],
    'Building/Renovation' => ['building', 'renovation', 'renovate', 'construction', 'construct', 'repair house', 'extension', 'bahay'],
    'Sign' => ['sign', 'signage', 'billboard', 'tarpaulin'],
    'Business License' => ['business license', 'business permit', "mayor's permit", 'mayors permit', 'license'],
    'Special Event' => ['event', 'special event', 'party', 'concert', 'fiesta', 'gathering'],
];

function chat_normalize(string $text): string
{
    $text = mb_strtolower($text);
    $text = str_replace(['’', '‘'], "'", $text);
    $text = preg_replace("/[^a-z0-9' ]+/u", ' ', $text);
    return trim(preg_replace('/\s+/', ' ', $text));
}

/** Lower-cased content words with a light plural/tense trim, so "documents" matches "document". */
function chat_tokens(string $text): array
{
    $out = [];
    foreach (explode(' ', chat_normalize($text)) as $w) {
        if ($w === '' || in_array($w, CHAT_STOPWORDS, true)) {
            continue;
        }
        $w = preg_replace('/(ing|ed|es|s)$/', '', $w) ?: $w;
        if (strlen($w) >= 2) {
            $out[$w] = true;
        }
    }
    return array_keys($out);
}

/** Scores one FAQ entry: keyword phrases found in the message count most, shared words add a little. */
function chat_score(string $normalized, array $messageTokens, array $faq): float
{
    $score = 0.0;
    $padded = " $normalized ";
    foreach (explode(',', $faq['keywords']) as $kw) {
        $kw = chat_normalize($kw);
        if ($kw !== '' && str_contains($padded, " $kw ")) {
            $score += 1.5 + substr_count($kw, ' ') * 1.5; // multi-word phrases are stronger evidence
        }
    }
    $shared = array_intersect($messageTokens, chat_tokens($faq['question'] . ' ' . str_replace(',', ' ', $faq['keywords'])));
    return $score + count($shared) * 0.5;
}

function chat_active_faqs(): array
{
    return db()->query('SELECT * FROM faq_entries WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
}

/** Starter chips shown when the chat opens. */
function chat_starter_suggestions(?array $user): array
{
    $picks = ['What can I do as a Normal User?', 'Which permits can I apply for?', 'How do I become a verified Resident?', 'How do I register a business?'];
    if ($user && $user['role'] === 'applicant' && $user['levels'] !== ['Normal User']) {
        $picks = ["What's my status?", 'How do I track my application?', 'Which permits can I apply for?', 'How do I register a business?'];
    }
    return $picks;
}

function chat_permit_requirements(string $normalized): ?array
{
    $asksRequirements = preg_match('/\b(need|needs|requirement|requirements|require|required|documents?|papers?|kailangan)\b/', $normalized);
    if (!$asksRequirements) {
        return null;
    }
    foreach (CHAT_PERMIT_WORDS as $type => $words) {
        foreach ($words as $w) {
            if (str_contains(" $normalized ", ' ' . $w . ' ')) {
                $docs = required_documents_for($type);
                $rule = PERMIT_ELIGIBILITY[$type];
                $who = $rule['resident'] ? 'verified Residents, or Business Owners for a verified business' : 'Business Owners, for a verified business';
                return [
                    'text' => "A $type permit needs these documents:\n- " . implode("\n- ", $docs) . "\nIt can be filed by $who.",
                    'link' => ['path' => '/applications/new', 'label' => 'See this permit'],
                    'intent' => 'permit_requirements',
                ];
            }
        }
    }
    return null;
}

/** "What's my status?" — a summary of the signed-in user's own account. */
function chat_my_status(string $normalized, ?array $user): ?array
{
    // Only clear "where do I stand" questions — not e.g. "my verification got rejected" (that's an FAQ)
    $isStatusQuestion = preg_match("/\bmy\b.*\b(status|progress)\b/", $normalized)
        || preg_match("/\b(status ko|am i verified|am i a resident|am i a business owner|where is my (application|permit)|where are my (applications|permits))\b/", $normalized);
    if (!$isStatusQuestion) {
        return null;
    }
    if (!$user || $user['role'] !== 'applicant') {
        return ['text' => 'Sign in to your resident or business account and I can tell you where things stand.', 'link' => null, 'intent' => 'my_status'];
    }
    $lines = ['Your account: ' . implode(' + ', $user['levels']) . '.'];
    $lines[] = match ($user['resident_status']) {
        'verified' => '- Residency: verified ✓',
        'pending' => '- Residency: under review',
        'rejected' => '- Residency: not approved — see your dashboard for the reason',
        default => '- Residency: not started',
    };
    $biz = db()->prepare('SELECT business_name, status FROM businesses WHERE user_id = ? ORDER BY created_at');
    $biz->execute([$user['id']]);
    foreach ($biz->fetchAll() as $b) {
        $state = ['draft' => 'draft, not submitted', 'pending' => 'under review', 'approved' => 'verified ✓', 'rejected' => 'needs changes'][$b['status']];
        $lines[] = "- Business \"{$b['business_name']}\": $state";
    }
    $apps = db()->prepare("SELECT permit_type, status FROM applications WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 5");
    $apps->execute([$user['id']]);
    foreach ($apps->fetchAll() as $a) {
        $lines[] = "- {$a['permit_type']} permit: {$a['status']}";
    }
    return ['text' => implode("\n", $lines), 'link' => ['path' => '/dashboard', 'label' => 'Open my dashboard'], 'intent' => 'my_status'];
}

function chatbot_reply(string $message, ?array $user): array
{
    $normalized = chat_normalize($message);
    $base = ['link' => null, 'suggestions' => [], 'faq_id' => null, 'score' => 0.0];

    if (preg_match('/^(hi|hello|hey|good (morning|afternoon|evening)|kumusta|kamusta|magandang (umaga|hapon|gabi))\b/', $normalized) && str_word_count($normalized) <= 4) {
        $name = $user['first_name'] ?? '';
        return $base + ['text' => 'Hi' . ($name ? " $name" : '') . "! I'm the PermitTrack assistant. Ask me about permits, verification or your account.", 'intent' => 'greeting', 'suggestions' => chat_starter_suggestions($user), 'score' => 10];
    }
    if (preg_match('/^(thanks|thank you|ty|salamat|ok thanks|okay thanks)\b/', $normalized)) {
        return $base + ['text' => "You're welcome! Anything else I can help with?", 'intent' => 'greeting', 'score' => 10];
    }

    foreach (['chat_my_status', 'chat_permit_requirements'] as $special) {
        $hit = $special === 'chat_my_status' ? chat_my_status($normalized, $user) : chat_permit_requirements($normalized);
        if ($hit) {
            return array_merge($base, $hit, ['score' => 10]);
        }
    }

    $tokens = chat_tokens($message);
    $scored = [];
    foreach (chat_active_faqs() as $faq) {
        $s = chat_score($normalized, $tokens, $faq);
        if ($s > 0) {
            $scored[] = ['faq' => $faq, 'score' => $s];
        }
    }
    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

    if (!$scored || $scored[0]['score'] < CHAT_MIN_SCORE) {
        return $base + [
            'text' => "Sorry, I don't have an answer for that yet. I've noted your question so the city team can add one.\nHere are some things I can help with:",
            'intent' => 'fallback',
            'suggestions' => array_slice(array_merge(array_map(fn($s) => $s['faq']['question'], array_slice($scored, 0, 2)), chat_starter_suggestions($user)), 0, 4),
            'score' => $scored[0]['score'] ?? 0.0,
        ];
    }

    $best = $scored[0]['faq'];
    return [
        'text' => $best['answer'],
        'link' => $best['link_path'] ? ['path' => $best['link_path'], 'label' => $best['link_label'] ?: 'Open'] : null,
        'suggestions' => array_values(array_unique(array_map(fn($s) => $s['faq']['question'], array_slice($scored, 1, 3)))),
        'intent' => 'faq',
        'faq_id' => (int)$best['id'],
        'score' => round($scored[0]['score'], 2),
    ];
}

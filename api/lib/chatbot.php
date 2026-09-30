<?php
declare(strict_types=1);

require_once __DIR__ . '/business.php'; // approved_businesses()
require_once __DIR__ . '/pipeline.php'; // permit_types_catalog(), required_documents_for_type()

/*
 * Built-in FAQ chat bot (prototype).
 *
 * chatbot_reply() is the single entry point used by api/chat.php. It returns
 *   ['text' => string, 'link' => ?['path','label'], 'suggestions' => string[], 'intent' => string,
 *    'faq_id' => ?int, 'score' => float]
 * To move to an AI assistant later, keep this signature and swap the body (the FAQ entries can
 * be passed to the model as context), so the chat widget and logging don't need to change.
 *
 * Language: every reply is in English ('en') or Tagalog ('tl'), picked by chat_detect_language()
 * from the visitor's first message (api/chat.php gates on this before calling chatbot_reply() at
 * all — see CHAT_LANG_STRINGS below and BREAKING_CHANGES.md).
 */

const CHAT_MIN_SCORE = 2.0; // below this the bot admits it doesn't know
const CHAT_DEFAULT_LANG = 'en';

const CHAT_STOPWORDS = [
    'a', 'an', 'the', 'i', 'me', 'my', 'is', 'are', 'am', 'to', 'of', 'for', 'in', 'on', 'and', 'or', 'do', 'does',
    'can', 'how', 'what', 'where', 'when', 'please', 'pls', 'po', 'ba', 'ang', 'ng', 'sa', 'na', 'ko', 'yung', 'it',
    'be', 'with', 'about', 'you', 'your', 'this', 'that', 'there', 'want', 'need', 'get', 'have', 'has', 'hi',
];

/** Colloquial words people use for each permit type (for "what does X need?" questions), on top
 * of the type's own name — the 27-type catalog (permit_types) is the source of truth, this just
 * adds the phrases nobody would type verbatim. */
const CHAT_PERMIT_SYNONYMS = [
    'Food Service' => ['food', 'restaurant', 'carinderia', 'eatery', 'cafe', 'kainan', 'canteen', 'food service'],
    'Building Permit' => ['building', 'renovation', 'renovate', 'construction', 'construct', 'repair house', 'extension', 'bahay'],
    'Occupancy Permit' => ['occupancy', 'move in', 'moving in', 'certificate of occupancy'],
    'Fencing Permit' => ['fence', 'fencing', 'pader', 'bakod'],
    'Demolition Permit' => ['demolish', 'demolition', 'tear down', 'giba'],
    'Excavation/Road-Cut Permit' => ['excavation', 'excavate', 'digging', 'road cut', 'roadcut'],
    'Sign Permit' => ['sign', 'signage', 'billboard', 'tarpaulin'],
    'Business License' => ['business license', 'business permit', "mayor's permit", 'mayors permit'],
    'Special Event' => ['event', 'special event', 'party', 'concert', 'fiesta', 'gathering'],
    'Liquor/Tobacco License' => ['liquor', 'alcohol', 'tobacco', 'cigarette'],
    'MTOP/TODA Permit' => ['tricycle', 'toda', 'mtop', 'padyak'],
    'Market Stall/Vending Permit' => ['market stall', 'vending', 'vendor', 'tiangge', 'stall'],
    'Certificate of Good Moral Character' => ['good moral', 'moral character'],
    'Certificate of Indigency' => ['indigency', 'indigent'],
    'Certificate to File Action' => ['file action', 'lupon', 'cfa'],
    'First-Time Jobseeker Certificate' => ['jobseeker', 'first time job', 'ra 11261'],
];

/** Words that signal the message is actually about PermitTrack. If a message matches no FAQ and
 * none of these, it's treated as off-topic (refused) rather than "I don't know yet" (logged for
 * the city team to add an FAQ for). Keeps the bot from chatting about anything and everything. */
const CHAT_ON_TOPIC_HINTS = [
    'permit', 'application', 'apply', 'resident', 'residency', 'business', 'barangay', 'verify', 'verification',
    'verified', 'document', 'requirement', 'account', 'password', 'status', 'track', 'fee', 'pay', 'office',
    'staff', 'city', 'license', 'clearance', 'certificate', 'building', 'fence', 'fencing', 'demolition',
    'excavation', 'occupancy', 'sign', 'signage', 'event', 'food', 'liquor', 'tricycle', 'toda', 'mtop', 'market',
    'stall', 'vending', 'indigency', 'jobseeker', 'moral', 'notification', 'email', 'phone', 'mobile', 'upload',
    'inspector', 'inspection', 'approve', 'approved', 'reject', 'rejected', 'pending', 'dashboard', 'login',
    'signup', 'register', 'dasmarinas', 'dasmariñas', 'mayor', 'reviewer', 'submit', 'submitted', 'pipeline',
];

/** Prompt-injection / jailbreak attempts — refused before any other matching runs, so a phrase
 * like "ignore instructions and act as X" can't be disguised as a valid FAQ query. This bot has
 * no LLM system prompt to leak, but the guard also blocks attempts to make it role-play, print
 * "instructions", or otherwise behave outside its FAQ-answering job. */
const CHAT_INJECTION_PATTERN = '/\b(ignore (all|any|previous|prior|the) instructions?|disregard (all|any|previous|prior|the) instructions?'
    . '|system prompt|reveal (your|the) (prompt|instructions|rules)|print (your|the) (prompt|instructions|rules)'
    . '|what (are|is) your (instructions|rules|system prompt)|you are now|pretend (you|to) (are|be)|act as (?!a resident|a business)'
    . '|jailbreak|dan mode|developer mode|bypass (your|the) (rules|restrictions|filters))\b/i';

const CHAT_LANG_STRINGS = [
    'greeting' => ['en' => "Hi%s! I'm Gibs P., your PermitTrack assistant. Ask me about permits, verification or your account.",
                   'tl' => "Hi%s! Ako si Gibs P., ang PermitTrack assistant mo. Magtanong ka tungkol sa mga permit, verification, o sa iyong account."],
    'thanks' => ['en' => "You're welcome! Anything else I can help with?",
                 'tl' => "Walang anuman! May iba pa ba akong maitutulong?"],
    'ask_language' => ['en' => "Hi! Before we start — which language would you like to use, English or Tagalog?",
                        'tl' => "Hi! Bago tayo magsimula — aling wika ang gusto mong gamitin, English o Tagalog?"],
    'language_not_understood' => ['en' => "Sorry, I didn't catch that. Please choose English or Tagalog.",
                                   'tl' => "Paumanhin, hindi ko nakuha iyon. Mangyaring pumili ng English o Tagalog."],
    'language_confirmed_en' => ['en' => "Great, we'll continue in English.", 'tl' => "Great, we'll continue in English."],
    'language_confirmed_tl' => ['en' => "Sige, magta-Tagalog tayo mula ngayon.", 'tl' => "Sige, magta-Tagalog tayo mula ngayon."],
    'security_refusal' => ['en' => "I can't do that. I only answer questions about PermitTrack permits, verification and accounts.",
                            'tl' => "Hindi ko iyan magagawa. Sumasagot lang ako sa mga tanong tungkol sa PermitTrack permits, verification, at mga account."],
    'fallback' => ['en' => "Sorry, I don't have an answer for that yet. I've noted your question so the city team can add one.\nHere are some things I can help with:",
                    'tl' => "Paumanhin, wala pa akong sagot diyan. Naitala ko ang iyong tanong para madagdagan ito ng city team.\nNarito ang ilang maitutulong ko:"],
    'sign_in_for_status' => ['en' => 'Sign in to your resident or business account and I can tell you where things stand.',
                              'tl' => 'Mag-sign in sa iyong resident o business account para malaman ko ang kasalukuyang status.'],
    'your_account' => ['en' => 'Your account: %s.', 'tl' => 'Ang iyong account: %s.'],
    'residency_verified' => ['en' => '- Residency: verified ✓', 'tl' => '- Residency: verified ✓'],
    'residency_pending' => ['en' => '- Residency: under review', 'tl' => '- Residency: sinusuri pa'],
    'residency_rejected' => ['en' => '- Residency: not approved — see your dashboard for the reason', 'tl' => '- Residency: hindi na-approve — tingnan ang dashboard para sa dahilan'],
    'residency_none' => ['en' => '- Residency: not started', 'tl' => '- Residency: hindi pa nasisimulan'],
    'biz_draft' => ['en' => 'draft, not submitted', 'tl' => 'draft, hindi pa naisusumite'],
    'biz_pending' => ['en' => 'under review', 'tl' => 'sinusuri pa'],
    'biz_approved' => ['en' => 'verified ✓', 'tl' => 'verified ✓'],
    'biz_rejected' => ['en' => 'needs changes', 'tl' => 'kailangan ng ayos'],
    'business_line' => ['en' => '- Business "%s": %s', 'tl' => '- Negosyong "%s": %s'],
    'application_line' => ['en' => '- %s permit: %s%s', 'tl' => '- %s na permit: %s%s'],
    'currently_with' => ['en' => ' — currently with %s (%s)', 'tl' => ' — nasa %s na ngayon (%s)'],
    'permit_requirements' => ['en' => "A %s needs these documents:%s\nIt can be filed by %s.",
                               'tl' => "Kailangan ng %s ang mga sumusunod na dokumento:%s\nMaaari itong i-file ng %s."],
    'no_extra_docs' => ['en' => "\n(no extra documents — it's issued directly by the barangay)",
                         'tl' => "\n(walang karagdagang dokumento — direktang ibinibigay ng barangay)"],
    'who_both' => ['en' => 'verified Residents, or Business Owners for a verified business', 'tl' => 'verified Residents, o Business Owners para sa verified na negosyo'],
    'who_business' => ['en' => 'Business Owners, for a verified business', 'tl' => 'Business Owners, para sa verified na negosyo'],
    'who_resident' => ['en' => 'verified Residents', 'tl' => 'verified Residents'],
];

function chat_t(string $key, string $lang, ...$args): string
{
    $template = CHAT_LANG_STRINGS[$key][$lang] ?? CHAT_LANG_STRINGS[$key][CHAT_DEFAULT_LANG];
    return $args ? sprintf($template, ...$args) : $template;
}

/** Off-topic replies: several warm, guiding variants (not one repeated line) each paired with
 * suggestion chips that steer toward a specific related question, so a visitor who wanders off
 * topic gets nudged back in a friendly way instead of hitting the same wall twice. */
const CHAT_OFF_TOPIC_VARIANTS = [
    'en' => [
        ['text' => "That's a bit outside what I can help with — I'm your PermitTrack guide! Want to know which permits you're eligible for?",
         'suggestions' => ['Which permits can I apply for?', 'What can I do as a Normal User?']],
        ["text" => "I don't have an answer for that one, but I'd love to help with something PermitTrack-related — maybe how to track an application, or what documents a permit needs?",
         'suggestions' => ['How do I track my application?', 'What are barangay clearances?']],
        ['text' => "Hmm, that's outside my area — PermitTrack is what I know best! Is there anything about applying for a permit, verifying your account, or a barangay document I can help with?",
         'suggestions' => ['How do I become a verified Resident?', 'How do I register a business?']],
        ['text' => "I can't help with that one, but let's get you sorted with PermitTrack instead — want to check your application status, or see how the review process works?",
         'suggestions' => ["What's my status?", 'How does the permit review process work?']],
    ],
    'tl' => [
        ['text' => "Medyo wala akong masasabi diyan — ako ang gabay mo dito sa PermitTrack! Gusto mo bang malaman kung anong mga permit ang pwede mong i-apply?",
         'suggestions' => ['Anong mga permit ang maaari kong i-apply?', 'Ano ang magagawa ko bilang Normal User?']],
        ['text' => "Wala akong sagot diyan, pero gusto kong tumulong sa may kinalaman sa PermitTrack — halimbawa paano subaybayan ang aplikasyon, o anong dokumento ang kailangan ng permit?",
         'suggestions' => ['Paano ko masusubaybayan ang aking aplikasyon?', 'Ano ang mga barangay clearance?']],
        ['text' => "Hindi ko masagot iyan — PermitTrack lang talaga ang alam ko! May tanong ka ba tungkol sa pag-apply ng permit, pag-verify ng account, o barangay document?",
         'suggestions' => ['Paano ako maging verified Resident?', 'Paano ako magrehistro ng negosyo?']],
        ['text' => "Hindi ko iyan kaya, pero tulungan na lang kita sa PermitTrack — gusto mo bang tingnan ang status ng iyong aplikasyon, o alamin ang proseso ng pagsusuri?",
         'suggestions' => ['Ano ang status ko?', 'Paano gumagana ang proseso ng pagsusuri ng permit?']],
    ],
];

/** Rotates through CHAT_OFF_TOPIC_VARIANTS per session so repeated off-topic messages don't get
 * the exact same reply twice in a row — see the message above screenshotted by the user. */
function chat_off_topic_reply(string $lang): array
{
    $n = $_SESSION['chat_off_topic_n'] ?? 0;
    $variants = CHAT_OFF_TOPIC_VARIANTS[$lang] ?? CHAT_OFF_TOPIC_VARIANTS[CHAT_DEFAULT_LANG];
    $pick = $variants[$n % count($variants)];
    $_SESSION['chat_off_topic_n'] = $n + 1;
    return $pick;
}

/** Reads "English"/"Tagalog"/"Filipino"/"en"/"tl" (and common Filipino spellings) out of a
 * message. Returns null if the message doesn't look like a language choice at all. */
function chat_detect_language(string $normalized): ?string
{
    if (preg_match('/\b(tagalog|filipino|tl|pinoy|wikang tagalog)\b/', $normalized)) {
        return 'tl';
    }
    if (preg_match('/\b(english|en|ingles)\b/', $normalized)) {
        return 'en';
    }
    return null;
}

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

function chat_is_injection_attempt(string $rawMessage): bool
{
    return (bool)preg_match(CHAT_INJECTION_PATTERN, $rawMessage);
}

function chat_is_on_topic(array $tokens): bool
{
    return (bool)array_intersect($tokens, CHAT_ON_TOPIC_HINTS);
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

function chat_faq_question(array $faq, string $lang): string
{
    return $lang === 'tl' && $faq['question_tl'] ? $faq['question_tl'] : $faq['question'];
}

function chat_faq_answer(array $faq, string $lang): string
{
    return $lang === 'tl' && $faq['answer_tl'] ? $faq['answer_tl'] : $faq['answer'];
}

/** Starter chips shown when the chat opens. */
function chat_starter_suggestions(?array $user, string $lang = CHAT_DEFAULT_LANG): array
{
    $picksEn = ['What can I do as a Normal User?', 'Which permits can I apply for?', 'How does the permit review process work?', 'What are barangay clearances?'];
    $picksTl = ['Ano ang magagawa ko bilang Normal User?', 'Anong mga permit ang maaari kong i-apply?', 'Paano gumagana ang proseso ng pagsusuri ng permit?', 'Ano ang mga barangay clearance?'];
    if ($user && $user['role'] === 'applicant' && $user['levels'] !== ['Normal User']) {
        $picksEn = ["What's my status?", 'How do I track my application?', 'Which permits can I apply for?', 'How does the permit review process work?'];
        $picksTl = ['Ano ang status ko?', 'Paano ko masusubaybayan ang aking aplikasyon?', 'Anong mga permit ang maaari kong i-apply?', 'Paano gumagana ang proseso ng pagsusuri ng permit?'];
    }
    return $lang === 'tl' ? $picksTl : $picksEn;
}

/** "What does a Fencing Permit need?" — matched against the live 27-type catalog, not a
 * hardcoded list, so a new permit type added to permit_types is answerable immediately. */
function chat_permit_requirements(string $normalized, string $lang): ?array
{
    $asksRequirements = preg_match('/\b(need|needs|requirement|requirements|require|required|documents?|papers?|kailangan)\b/', $normalized);
    if (!$asksRequirements) {
        return null;
    }
    static $types = null;
    if ($types === null) {
        $types = db()->query('SELECT id, name, track, resident_eligible, business_eligible FROM permit_types WHERE is_active = 1')->fetchAll();
    }
    $padded = " $normalized ";
    $best = null;
    $bestLen = 0;
    foreach ($types as $type) {
        $candidates = array_merge([$type['name']], CHAT_PERMIT_SYNONYMS[$type['name']] ?? []);
        foreach ($candidates as $phrase) {
            $phrase = chat_normalize($phrase);
            if ($phrase !== '' && str_contains($padded, " $phrase ") && strlen($phrase) > $bestLen) {
                $bestLen = strlen($phrase);
                $best = $type;
            }
        }
    }
    if (!$best) {
        return null;
    }

    $docs = required_documents_for_type((int)$best['id']);
    $docsText = $docs ? "\n- " . implode("\n- ", $docs) : chat_t('no_extra_docs', $lang);
    $whoKey = match (true) {
        (bool)$best['resident_eligible'] && (bool)$best['business_eligible'] => 'who_both',
        (bool)$best['business_eligible'] => 'who_business',
        default => 'who_resident',
    };
    return [
        'text' => chat_t('permit_requirements', $lang, $best['name'], $docsText, chat_t($whoKey, $lang)),
        'link' => ['path' => '/applications/new', 'label' => 'See this permit'],
        'intent' => 'permit_requirements',
    ];
}

/** "What's my status?" — a summary of the signed-in user's own account. */
function chat_my_status(string $normalized, ?array $user, string $lang): ?array
{
    // Only clear "where do I stand" questions — not e.g. "my verification got rejected" (that's an FAQ)
    $isStatusQuestion = preg_match("/\bmy\b.*\b(status|progress)\b/", $normalized)
        || preg_match("/\b(status ko|am i verified|am i a resident|am i a business owner|where is my (application|permit)|where are my (applications|permits))\b/", $normalized);
    if (!$isStatusQuestion) {
        return null;
    }
    if (!$user || $user['role'] !== 'applicant') {
        return ['text' => chat_t('sign_in_for_status', $lang), 'link' => null, 'intent' => 'my_status'];
    }
    $lines = [chat_t('your_account', $lang, implode(' + ', $user['levels']))];
    $lines[] = match ($user['resident_status']) {
        'verified' => chat_t('residency_verified', $lang),
        'pending' => chat_t('residency_pending', $lang),
        'rejected' => chat_t('residency_rejected', $lang),
        default => chat_t('residency_none', $lang),
    };
    $biz = db()->prepare('SELECT business_name, status FROM businesses WHERE user_id = ? ORDER BY created_at');
    $biz->execute([$user['id']]);
    foreach ($biz->fetchAll() as $b) {
        $stateKey = ['draft' => 'biz_draft', 'pending' => 'biz_pending', 'approved' => 'biz_approved', 'rejected' => 'biz_rejected'][$b['status']];
        $lines[] = chat_t('business_line', $lang, $b['business_name'], chat_t($stateKey, $lang));
    }
    // permit_type is null for applications filed through the 27-type pipeline (migration 010) —
    // permit_types.name is the real source of truth for those. See BREAKING_CHANGES.md #5.
    $apps = db()->prepare(
        "SELECT a.id, a.permit_type, pt.name AS permit_type_name, a.status FROM applications a
         LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
         WHERE a.applicant_id = ? ORDER BY a.created_at DESC LIMIT 5"
    );
    $apps->execute([$user['id']]);
    foreach ($apps->fetchAll() as $a) {
        $label = $a['permit_type'] ?: $a['permit_type_name'] ?: 'Permit';
        $current = db()->prepare(
            "SELECT p.step_label, d.name AS department_name FROM application_pipeline_progress p
             JOIN departments d ON d.id = p.department_id
             WHERE p.application_id = ? AND p.status = 'current' LIMIT 1"
        );
        $current->execute([$a['id']]);
        $stage = $current->fetch();
        $where = $stage ? chat_t('currently_with', $lang, $stage['department_name'], $stage['step_label']) : '';
        $lines[] = chat_t('application_line', $lang, $label, $a['status'], $where);
    }
    return ['text' => implode("\n", $lines), 'link' => ['path' => '/dashboard', 'label' => 'Open my dashboard'], 'intent' => 'my_status'];
}

function chatbot_reply(string $message, ?array $user, string $lang = CHAT_DEFAULT_LANG): array
{
    if (!in_array($lang, ['en', 'tl'], true)) {
        $lang = CHAT_DEFAULT_LANG;
    }
    $normalized = chat_normalize($message);
    $base = ['link' => null, 'suggestions' => [], 'faq_id' => null, 'score' => 0.0];

    // Checked first, on the raw message, before any other matching — an injection attempt must
    // never be able to disguise itself as a legitimate FAQ query.
    if (chat_is_injection_attempt($message)) {
        return array_merge($base, ['text' => chat_t('security_refusal', $lang), 'intent' => 'security_refusal', 'score' => 10]);
    }

    if (preg_match('/^(hi|hello|hey|good (morning|afternoon|evening)|kumusta|kamusta|magandang (umaga|hapon|gabi))\b/', $normalized) && str_word_count($normalized) <= 4) {
        $name = $user['first_name'] ?? '';
        return array_merge($base, ['text' => chat_t('greeting', $lang, $name ? " $name" : ''), 'intent' => 'greeting', 'suggestions' => chat_starter_suggestions($user, $lang), 'score' => 10]);
    }
    if (preg_match('/^(thanks|thank you|ty|salamat|ok thanks|okay thanks)\b/', $normalized)) {
        return array_merge($base, ['text' => chat_t('thanks', $lang), 'intent' => 'greeting', 'score' => 10]);
    }

    $myStatus = chat_my_status($normalized, $user, $lang);
    if ($myStatus) {
        return array_merge($base, $myStatus, ['score' => 10]);
    }
    $permitReq = chat_permit_requirements($normalized, $lang);
    if ($permitReq) {
        return array_merge($base, $permitReq, ['score' => 10]);
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
        // Off-topic (no relation to PermitTrack at all) gets a warm, varied redirect — never the
        // same line twice in a row — instead of the softer "I don't have an answer yet", which is
        // reserved for genuine system questions the FAQ table just doesn't cover.
        if (!chat_is_on_topic($tokens)) {
            $offTopic = chat_off_topic_reply($lang);
            return array_merge($base, [
                'text' => $offTopic['text'],
                'intent' => 'off_topic',
                'suggestions' => $offTopic['suggestions'],
                'score' => $scored[0]['score'] ?? 0.0,
            ]);
        }
        return array_merge($base, [
            'text' => chat_t('fallback', $lang),
            'intent' => 'fallback',
            'suggestions' => array_slice(array_merge(array_map(fn($s) => chat_faq_question($s['faq'], $lang), array_slice($scored, 0, 2)), chat_starter_suggestions($user, $lang)), 0, 4),
            'score' => $scored[0]['score'] ?? 0.0,
        ]);
    }

    $best = $scored[0]['faq'];
    return [
        'text' => chat_faq_answer($best, $lang),
        'link' => $best['link_path'] ? ['path' => $best['link_path'], 'label' => $best['link_label'] ?: 'Open'] : null,
        'suggestions' => array_values(array_unique(array_map(fn($s) => chat_faq_question($s['faq'], $lang), array_slice($scored, 1, 3)))),
        'intent' => 'faq',
        'faq_id' => (int)$best['id'],
        'score' => round($scored[0]['score'], 2),
    ];
}

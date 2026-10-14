import { i18n } from '../store/i18n.js?v=168';
import { TL_IDS } from '../i18n/idGuide.js?v=168';

// "Get an ID": how a visitor without a government photo ID can get one. PermitTrack asks for a Valid
// Government ID when someone verifies as a resident or adds a business (see docInstructions.js), and
// the IDs here are four of the ones it accepts. Each has a tab, an illustrated card, and its steps,
// every step with a small drawn scene so the process can be followed at a glance.
//
// What each agency asks for — fees, requirements, how long it takes — is theirs to set and does
// change, so the text stays general ("usually", "may") and the section ends by telling people to
// confirm with the agency. If an agency changes a process, edit the entry below.

const IDS = [
  {
    key: 'philsys',
    name: 'PhilSys / National ID',
    short: 'PhilID',
    card: 'philsys',
    agency: 'Philippine Statistics Authority (PSA)',
    cost: 'Free',
    where: 'A PSA registration center near you',
    summary: 'The national ID for every Filipino citizen and resident alien. One registration gives you a PhilSys Number and a card that works as proof of identity across the country.',
    steps: [
      { art: 'laptop', title: 'Start your registration', text: 'Fill in your details — name, birth date, address — online, or at the registration center. This is “Step 1” of PhilSys registration.', tip: 'Spell your name exactly as it appears on your PSA birth certificate.' },
      { art: 'calendar', title: 'Pick a center and a date', text: 'Choose the registration center closest to you and book a schedule for the next step. Some centers take walk-ins, but a booking saves a long wait.' },
      { art: 'documents', title: 'Bring your papers', text: 'Take your registration confirmation and an original ID or your PSA birth certificate as proof of who you are.', tip: 'Bring originals, plus a photocopy in case the center asks for one.' },
      { art: 'biometrics', title: 'Get your biometrics taken', text: 'The center scans your fingerprints and irises and takes a front-facing photo. This is “Step 2”.', tip: 'Take off glasses and caps, and tie back hair that covers your face.' },
      { art: 'mail', title: 'Receive your card', text: 'You are given your PhilSys Number right away. The printed card is delivered to your address by PHLPost, and a digital ePhilID may be available sooner.' },
    ],
    bring: ['Registration confirmation or slip', 'PSA birth certificate, or another original ID', 'Your current address'],
  },
  {
    key: 'umid',
    name: 'UMID',
    short: 'UMID',
    card: 'umid',
    agency: 'SSS, GSIS or Pag-IBIG',
    cost: 'Usually free — confirm with your agency',
    where: 'A branch of the agency you are a member of',
    summary: 'The Unified Multi-Purpose ID, issued to members of SSS, GSIS and Pag-IBIG. One card carries your membership number and works as a government photo ID.',
    steps: [
      { art: 'form', title: 'Be a member', text: 'A UMID is for members, so you need an existing SSS, GSIS or Pag-IBIG membership and your member number first. If you do not have one, register with the agency.' },
      { art: 'calendar', title: 'Check that it is open, then book', text: 'Since the National ID rolled out, new UMID card applications have been limited. Ask your agency — on its website or at a branch — whether it still accepts them, then book an appointment.', tip: 'If it is not available, a PhilID is the quickest route to a government photo ID today.' },
      { art: 'documents', title: 'Prepare your documents', text: 'Bring your member number and at least one valid ID or supporting document, and the UMID application form if your branch asks for one.' },
      { art: 'biometrics', title: 'Have your photo and prints taken', text: 'At the branch, your photo, signature and fingerprints are captured for the card.' },
      { art: 'done', title: 'Claim your card', text: 'Once processed, the card is released at the branch or delivered to you. Keep your claim stub or receipt until you have it.' },
    ],
    bring: ['SSS, GSIS or Pag-IBIG member number', 'At least one valid ID or supporting document', 'Your application form, if the branch requires one'],
  },
  {
    key: 'postal',
    name: 'Postal ID',
    short: 'Postal ID',
    card: 'postal',
    agency: 'Philippine Postal Corporation (PHLPost)',
    cost: 'A fee applies — ask for the current amount',
    where: 'The post office that serves your address',
    summary: 'A photo ID issued by PHLPost. It is one of the easier IDs to get if you do not yet have another, because you apply in person at a post office.',
    steps: [
      { art: 'form', title: 'Get the application form', text: 'Ask for the Postal ID application form at your post office and fill it in with print letters.' },
      { art: 'documents', title: 'Prepare the requirements', text: 'You will usually need your PSA birth certificate or another valid ID, proof of address such as a barangay certificate or a utility bill, and passport-size photos.', tip: 'Requirements vary a little by branch — ask what yours wants before you go.' },
      { art: 'building', title: 'Go to your post office', text: 'Apply at the post office for your area, with your originals and photocopies.' },
      { art: 'biometrics', title: 'Photo and fingerprints', text: 'The post office takes your photo, signature and fingerprints for the card.' },
      { art: 'payment', title: 'Pay the fee', text: 'Pay the fee at the counter and keep the official receipt. It is also your claim stub.' },
      { art: 'hourglass', title: 'Wait, then claim it', text: 'Processing takes some days to a few weeks. Come back with your receipt when you are told it is ready.' },
    ],
    bring: ['PSA birth certificate, or another valid ID', 'Proof of address (barangay certificate or utility bill)', 'Passport-size photos', 'Money for the fee'],
  },
  {
    key: 'voters',
    name: 'Voter’s ID',
    short: 'Voter’s ID',
    card: 'voters',
    agency: 'Commission on Elections (COMELEC)',
    cost: 'Registration is free — a certification may carry a small fee',
    where: 'Your city or municipal COMELEC office (Office of the Election Officer)',
    summary: 'COMELEC no longer prints the old Voter’s ID card. Once you are a registered voter you can ask for a Voter’s Certification instead, which is accepted as proof of identity and registration.',
    steps: [
      { art: 'laptop', title: 'Fill in your details first', text: 'COMELEC’s online pre-registration lets you enter your details and book a visit before you go. Applying in person at your local office works too.' },
      { art: 'calendar', title: 'Register while registration is open', text: 'Voter registration only runs during set periods before elections, at your city or municipal COMELEC office. Ask which dates are open.', tip: 'You must have lived in the city or municipality for the required time to register there.' },
      { art: 'biometrics', title: 'Biometrics capture', text: 'Your photo, signature and fingerprints are captured at the office.' },
      { art: 'approve', title: 'Wait for approval', text: 'Applications are approved at a hearing of the Election Registration Board. Ask your Election Officer when yours will be heard.' },
      { art: 'done', title: 'Ask for a Voter’s Certification', text: 'Once you are registered, request a Voter’s Certification at the same office. Bring a valid ID; a small fee may apply.' },
    ],
    bring: ['A valid ID, or documents proving who you are', 'Proof that you live in the city or municipality', 'Your online pre-registration slip, if you made one'],
  },
  // These three are not on PermitTrack's own list of accepted IDs (REPRESENTATIVE_ID_TYPES in
  // api/lib/business.php), so accepted: false — the tab says so instead of claiming otherwise.
  {
    key: 'senior',
    name: 'Senior Citizen ID',
    short: 'Senior ID',
    card: 'senior',
    accepted: false,
    agency: 'Office of Senior Citizens Affairs (OSCA) of your city or municipality',
    cost: 'Free',
    where: 'The OSCA at your city or municipal hall',
    summary: 'A photo ID for Filipino citizens aged 60 and above, issued by your city or municipality. It is also what you show to claim senior citizen discounts and privileges.',
    steps: [
      { art: 'form', title: 'Check that you qualify', text: 'You must be a Filipino citizen aged 60 or older and live in the city or municipality where you apply.' },
      { art: 'documents', title: 'Prepare your papers', text: 'Usually a PSA birth certificate or another valid ID that shows your age, proof of residence such as a barangay certificate, and passport-size photos.', tip: 'Ask your OSCA for its exact list — it can differ a little between cities.' },
      { art: 'building', title: 'Go to your OSCA', text: 'Visit the Office of Senior Citizens Affairs at your city or municipal hall, or the office your barangay points you to.' },
      { art: 'biometrics', title: 'Photo and application form', text: 'Fill in the application form. The office takes your photo and signature, and may record your thumbmark.' },
      { art: 'done', title: 'Claim your ID', text: 'The ID is released at the OSCA, sometimes the same day and sometimes after a short wait. Keep your claim slip until you have it.' },
    ],
    bring: ['PSA birth certificate, or another valid ID showing your age', 'Proof of residence (barangay certificate)', 'Passport-size photos', 'The application form from your OSCA'],
  },
  {
    key: 'pagibig',
    name: 'Pag-IBIG ID',
    short: 'Pag-IBIG ID',
    card: 'pagibig',
    accepted: false,
    agency: 'Pag-IBIG Fund (Home Development Mutual Fund)',
    cost: 'A fee may apply — ask Pag-IBIG',
    where: 'A Pag-IBIG Fund branch, or the online service or partner bank it directs you to',
    summary: 'A photo ID card for Pag-IBIG Fund members that carries your membership number. How it is offered has changed over time, so confirm with Pag-IBIG what is available to you.',
    steps: [
      { art: 'form', title: 'Be a Pag-IBIG member', text: 'The card is for members, so you need a Pag-IBIG membership and your Pag-IBIG MID number first. If you do not have one, register with Pag-IBIG.' },
      { art: 'laptop', title: 'Find out how to apply', text: 'Ask a Pag-IBIG branch, or check its official channels, whether the card is issued at branches, through its online service or through a partner bank, and whether you qualify.', tip: 'Do not pay anyone who offers to “process” it for you — apply only through Pag-IBIG itself.' },
      { art: 'documents', title: 'Prepare your documents', text: 'Bring your MID number and a valid government ID, and any other papers the branch or partner asks for.' },
      { art: 'biometrics', title: 'Photo and signature', text: 'Your photo and signature are captured for the card.' },
      { art: 'done', title: 'Claim your card', text: 'The card is released at the branch or delivered to you. Keep your receipt or claim slip until you have it.' },
    ],
    bring: ['Pag-IBIG MID number', 'A valid government ID', 'Any other papers the branch asks for'],
  },
  {
    key: 'philhealth',
    name: 'PhilHealth ID',
    short: 'PhilHealth ID',
    card: 'philhealth',
    accepted: false,
    agency: 'Philippine Health Insurance Corporation (PhilHealth)',
    cost: 'Registering is free — contributions depend on your membership type',
    where: 'A PhilHealth Local Health Insurance Office (LHIO)',
    summary: 'The ID of a PhilHealth member, carrying your PhilHealth Identification Number (PIN). Whether you are given a printed card or a member data record first depends on what your office is issuing.',
    steps: [
      { art: 'form', title: 'Register as a member', text: 'Fill in the PhilHealth Member Registration Form (PMRF) at a PhilHealth office, or through PhilHealth’s official online services if you can register that way.' },
      { art: 'documents', title: 'Bring your documents', text: 'Usually a PSA birth certificate or another valid ID, and passport-size photos. Ask the office what your membership type needs.' },
      { art: 'building', title: 'Go to your PhilHealth office', text: 'Submit the form at the Local Health Insurance Office that covers your address.' },
      { art: 'biometrics', title: 'Photo and signature', text: 'The office takes your photo and signature, and gives you your PhilHealth Identification Number (PIN).' },
      { art: 'done', title: 'Ask for your ID', text: 'Once you are registered, ask whether a printed PhilHealth ID is available. If it is not, you will be given a Member Data Record to keep.', tip: 'Keep your PIN somewhere safe — you will need it for claims.' },
    ],
    bring: ['PSA birth certificate, or another valid ID', 'Passport-size photos', 'Your completed PMRF (the office has it)'],
  },
];

export default {
  name: 'IdGuide',
  data() {
    return { ids: IDS, current: IDS[0].key };
  },
  computed: {
    // The chosen ID, in the visitor's language: Tagalog fields (i18n/idGuide.js) laid over the
    // English ones, steps matched by position, so anything not translated stays English.
    id() {
      const base = this.ids.find((i) => i.key === this.current) || this.ids[0];
      const tl = i18n.lang === 'tl' ? TL_IDS[base.key] : null;
      if (!tl) return base;
      return {
        ...base,
        ...Object.fromEntries(['agency', 'cost', 'where', 'summary'].filter((k) => tl[k]).map((k) => [k, tl[k]])),
        steps: base.steps.map((s, n) => ({ ...s, ...((tl.steps && tl.steps[n]) || {}) })),
        bring: tl.bring || base.bring,
      };
    },
  },
  methods: {
    // Left/Right move between the tabs, as for any tab list
    onKey(e, index) {
      const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!move) return;
      e.preventDefault();
      const next = this.ids[(index + move + this.ids.length) % this.ids.length];
      this.current = next.key;
      this.$nextTick(() => {
        const el = this.$refs['tab-' + next.key];
        if (el && el[0]) el[0].focus();
      });
    },
  },
  template: `
  <div>
    <!-- one tab per ID -->
    <div role="tablist" :aria-label="$tx('ids.choose', 'Choose an ID')" class="flex flex-wrap justify-center gap-2.5">
      <button v-for="(i, n) in ids" :key="i.key" :ref="'tab-' + i.key" type="button" role="tab"
        :aria-selected="current === i.key ? 'true' : 'false'" :tabindex="current === i.key ? 0 : -1"
        @click="current = i.key" @keydown="onKey($event, n)"
        class="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl text-sm font-semibold ring-1 transition"
        :class="current === i.key ? 'bg-brand-600 text-white ring-brand-600 shadow-[0_14px_28px_-14px_rgba(31,122,58,0.8)]' : 'bg-white text-ink-700 ring-brand-100 hover:ring-brand-300 hover:text-brand-700'">
        <span class="w-9 h-6 rounded-md grid place-items-center shrink-0" :class="current === i.key ? 'bg-white/20' : 'bg-brand-50'">
          <svg class="w-5 h-4" viewBox="0 0 20 14" fill="none" aria-hidden="true">
            <rect x=".75" y=".75" width="18.5" height="12.5" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="6" cy="5.5" r="1.8" fill="currentColor"/><path d="M3.2 11c.5-1.9 1.7-2.6 2.8-2.6s2.3.7 2.8 2.6" fill="currentColor"/>
            <path d="M11.5 4.5h5M11.5 7.2h5M11.5 9.9h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </span>
        {{ i.short }}
      </button>
    </div>

    <div :key="id.key" role="tabpanel" class="pt-tab-in mt-8 grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] gap-6 items-start">

      <!-- the ID itself: a drawn card, who issues it, and what to bring -->
      <aside class="lg:sticky lg:top-24 rounded-3xl bg-white ring-1 ring-brand-100 p-6 shadow-[0_18px_40px_-32px_rgba(16,48,29,0.5)]">
        <div class="rounded-2xl bg-meadow ring-1 ring-brand-100 p-5 grid place-items-center">
          <svg viewBox="0 0 220 140" class="w-full max-w-[17rem] drop-shadow-[0_14px_16px_rgba(16,48,29,0.22)]" role="img" :aria-label="'Illustration of a ' + id.name + ' card'">
            <!-- PhilSys: blue, red and a gold sun -->
            <g v-if="id.card === 'philsys'">
              <rect x="4" y="6" width="212" height="128" rx="12" fill="#fff"/>
              <path d="M4 18a12 12 0 0 1 12-12h188a12 12 0 0 1 12 12v20H4z" fill="#0038a8"/>
              <rect x="4" y="38" width="212" height="7" fill="#ce1126"/>
              <circle cx="188" cy="22" r="8" fill="#fcd116"/>
              <g stroke="#fcd116" stroke-width="2" stroke-linecap="round"><path d="M188 8v-3M188 39v-3M174 22h-3M205 22h-3M178 12l-2-2M200 34l-2-2M198 12l2-2M176 34l2-2"/></g>
              <rect x="22" y="12" width="70" height="7" rx="3.5" fill="#fff"/><rect x="22" y="24" width="48" height="5" rx="2.5" fill="#fff" opacity=".7"/>
              <rect x="20" y="58" width="56" height="64" rx="6" fill="#dcefd3"/>
              <circle cx="48" cy="82" r="11" fill="#8fcb7b"/><path d="M26 118c2-14 12-20 22-20s20 6 22 20z" fill="#8fcb7b"/>
              <g fill="#cbd5e1"><rect x="90" y="60" width="62" height="7" rx="3.5"/><rect x="90" y="75" width="96" height="7" rx="3.5"/><rect x="90" y="90" width="80" height="7" rx="3.5"/><rect x="90" y="105" width="52" height="7" rx="3.5"/></g>
              <rect x="170" y="98" width="34" height="22" rx="4" fill="#1f7a3a"/><path d="M178 109l6 5 12-10" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </g>
            <!-- UMID: blue and green with a chip -->
            <g v-else-if="id.card === 'umid'">
              <defs><linearGradient id="umidg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b5fb3"/><stop offset="1" stop-color="#1f7a3a"/></linearGradient></defs>
              <rect x="4" y="6" width="212" height="128" rx="12" fill="url(#umidg)"/>
              <circle cx="178" cy="-4" r="60" fill="#fff" opacity=".1"/><circle cx="40" cy="150" r="70" fill="#fff" opacity=".08"/>
              <rect x="22" y="18" width="78" height="8" rx="4" fill="#fff"/><rect x="22" y="31" width="52" height="5" rx="2.5" fill="#fff" opacity=".7"/>
              <rect x="22" y="52" width="38" height="28" rx="5" fill="#f7cf1b"/><path d="M22 66h38M41 52v28" stroke="#b38f00" stroke-width="1.5"/>
              <rect x="150" y="48" width="52" height="64" rx="6" fill="#fff" opacity=".92"/><circle cx="176" cy="70" r="10" fill="#8fcb7b"/><path d="M155 108c2-13 11-18 21-18s19 5 21 18z" fill="#8fcb7b"/>
              <g fill="#fff"><rect x="22" y="94" width="96" height="7" rx="3.5" opacity=".9"/><rect x="22" y="108" width="68" height="7" rx="3.5" opacity=".6"/></g>
            </g>
            <!-- Postal: an airmail border -->
            <g v-else-if="id.card === 'postal'">
              <rect x="4" y="6" width="212" height="128" rx="12" fill="#fff"/>
              <defs><pattern id="airmail" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#ce1126"/><rect x="8" width="8" height="16" fill="#0038a8"/></pattern></defs>
              <rect x="4" y="6" width="212" height="128" rx="12" fill="url(#airmail)"/>
              <rect x="12" y="14" width="196" height="112" rx="7" fill="#fff"/>
              <rect x="24" y="26" width="60" height="7" rx="3.5" fill="#0038a8"/><rect x="24" y="38" width="40" height="5" rx="2.5" fill="#ce1126" opacity=".7"/>
              <rect x="24" y="56" width="52" height="58" rx="5" fill="#dcefd3"/><circle cx="50" cy="76" r="10" fill="#8fcb7b"/><path d="M29 110c2-13 11-18 21-18s19 5 21 18z" fill="#8fcb7b"/>
              <g fill="#cbd5e1"><rect x="90" y="58" width="100" height="7" rx="3.5"/><rect x="90" y="72" width="80" height="7" rx="3.5"/><rect x="90" y="86" width="92" height="7" rx="3.5"/></g>
              <rect x="164" y="24" width="32" height="24" rx="2" fill="#fff" stroke="#ce1126" stroke-width="2" stroke-dasharray="3 2"/><path d="M170 42l7-9 5 6 4-4 6 7z" fill="#ce1126" opacity=".8"/>
            </g>
            <!-- Senior Citizen: teal, with a 60+ badge and a heart -->
            <g v-else-if="id.card === 'senior'">
              <rect x="4" y="6" width="212" height="128" rx="12" fill="#fff"/>
              <path d="M4 18a12 12 0 0 1 12-12h188a12 12 0 0 1 12 12v26H4z" fill="#0f766e"/>
              <rect x="22" y="14" width="84" height="8" rx="4" fill="#fff"/><rect x="22" y="28" width="56" height="6" rx="3" fill="#fff" opacity=".7"/>
              <circle cx="186" cy="25" r="15" fill="#f7cf1b"/>
              <text x="186" y="30" text-anchor="middle" font-size="13" font-weight="800" fill="#10301d" font-family="Inter, sans-serif">60+</text>
              <rect x="20" y="58" width="56" height="64" rx="6" fill="#dcefd3"/>
              <circle cx="48" cy="82" r="11" fill="#8fcb7b"/><path d="M26 118c2-14 12-20 22-20s20 6 22 20z" fill="#8fcb7b"/>
              <path d="M37 80a11 11 0 0 1 22 0c-4-5-18-5-22 0z" fill="#e2e8f0"/>
              <g fill="#cbd5e1"><rect x="90" y="60" width="100" height="7" rx="3.5"/><rect x="90" y="75" width="80" height="7" rx="3.5"/><rect x="90" y="90" width="92" height="7" rx="3.5"/></g>
              <rect x="170" y="100" width="34" height="22" rx="4" fill="#f97316"/>
              <path d="M187 117c-6-4-9-7-9-11a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 4-3 7-9 11z" fill="#fff"/>
            </g>
            <!-- Pag-IBIG: blue, with a house -->
            <g v-else-if="id.card === 'pagibig'">
              <defs><linearGradient id="pibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
              <rect x="4" y="6" width="212" height="128" rx="12" fill="url(#pibg)"/>
              <circle cx="190" cy="8" r="56" fill="#fff" opacity=".08"/><circle cx="30" cy="150" r="60" fill="#fff" opacity=".06"/>
              <path d="M24 56 52 30l28 26v22H24z" fill="#f97316"/><rect x="45" y="60" width="14" height="18" rx="2" fill="#fff"/>
              <rect x="96" y="34" width="96" height="8" rx="4" fill="#fff"/><rect x="96" y="49" width="62" height="6" rx="3" fill="#fff" opacity=".7"/>
              <rect x="22" y="98" width="110" height="7" rx="3.5" fill="#fff" opacity=".9"/><rect x="22" y="112" width="76" height="7" rx="3.5" fill="#fff" opacity=".6"/>
              <rect x="160" y="92" width="36" height="28" rx="5" fill="#f7cf1b"/><path d="M160 106h36M178 92v28" stroke="#b38f00" stroke-width="1.5"/>
            </g>
            <!-- PhilHealth: green, with a cross -->
            <g v-else-if="id.card === 'philhealth'">
              <rect x="4" y="6" width="212" height="128" rx="12" fill="#fff"/>
              <path d="M4 18a12 12 0 0 1 12-12h188a12 12 0 0 1 12 12v32H4z" fill="#2f8f46"/>
              <rect x="20" y="12" width="40" height="32" rx="7" fill="#fff"/><path d="M40 18v20M30 28h20" stroke="#ce1126" stroke-width="5.5" stroke-linecap="round"/>
              <rect x="72" y="16" width="90" height="8" rx="4" fill="#fff"/><rect x="72" y="30" width="60" height="6" rx="3" fill="#fff" opacity=".7"/>
              <rect x="20" y="62" width="56" height="60" rx="6" fill="#dcefd3"/><circle cx="48" cy="84" r="11" fill="#8fcb7b"/><path d="M26 118c2-14 12-20 22-20s20 6 22 20z" fill="#8fcb7b"/>
              <g fill="#cbd5e1"><rect x="90" y="62" width="100" height="7" rx="3.5"/><rect x="90" y="77" width="78" height="7" rx="3.5"/></g>
              <rect x="90" y="98" width="106" height="16" rx="8" fill="#dcefd3"/>
              <g fill="#2f8f46"><circle cx="106" cy="106" r="2.5"/><circle cx="118" cy="106" r="2.5"/><circle cx="130" cy="106" r="2.5"/><circle cx="142" cy="106" r="2.5"/><circle cx="154" cy="106" r="2.5"/><circle cx="166" cy="106" r="2.5"/></g>
            </g>
            <!-- Voter: green with a ballot tick -->
            <g v-else>
              <rect x="4" y="6" width="212" height="128" rx="12" fill="#fff"/>
              <path d="M4 18a12 12 0 0 1 12-12h188a12 12 0 0 1 12 12v26H4z" fill="#196330"/>
              <rect x="22" y="14" width="86" height="8" rx="4" fill="#fff"/><rect x="22" y="28" width="58" height="6" rx="3" fill="#fff" opacity=".7"/>
              <rect x="170" y="12" width="32" height="26" rx="4" fill="#fff"/><path d="M177 25l6 6 13-13" stroke="#1f7a3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <rect x="20" y="58" width="56" height="64" rx="6" fill="#dcefd3"/><circle cx="48" cy="82" r="11" fill="#8fcb7b"/><path d="M26 118c2-14 12-20 22-20s20 6 22 20z" fill="#8fcb7b"/>
              <g fill="#cbd5e1"><rect x="90" y="60" width="100" height="7" rx="3.5"/><rect x="90" y="75" width="82" height="7" rx="3.5"/><rect x="90" y="90" width="94" height="7" rx="3.5"/></g>
              <rect x="90" y="106" width="46" height="14" rx="7" fill="#f7cf1b"/>
            </g>
          </svg>
          <p class="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{{ $tx('ids.illustration', 'Illustration, not an actual ID') }}</p>
        </div>

        <h3 class="mt-5 text-2xl font-extrabold tracking-tight text-ink-700">{{ id.name }}</h3>
        <p class="mt-2 text-sm text-slate-600 leading-relaxed">{{ id.summary }}</p>

        <dl class="mt-5 space-y-3 text-sm">
          <div class="flex gap-3">
            <dt class="shrink-0 w-8 h-8 rounded-xl bg-brand-50 text-brand-700 grid place-items-center" :aria-label="$tx('ids.issuedBy', 'Issued by')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>
            </dt>
            <dd><span class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ $tx('ids.issuedBy', 'Issued by') }}</span><span class="text-ink-700 font-semibold">{{ id.agency }}</span></dd>
          </div>
          <div class="flex gap-3">
            <dt class="shrink-0 w-8 h-8 rounded-xl bg-sun-100 text-sun-700 grid place-items-center" :aria-label="$tx('ids.cost', 'Cost')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 8h4a2 2 0 0 1 0 4h-4m0-4v8m0-4h4"/></svg>
            </dt>
            <dd><span class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ $tx('ids.cost', 'Cost') }}</span><span class="text-ink-700 font-semibold">{{ id.cost }}</span></dd>
          </div>
          <div class="flex gap-3">
            <dt class="shrink-0 w-8 h-8 rounded-xl bg-brand-50 text-brand-700 grid place-items-center" :aria-label="$tx('ids.where', 'Where')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0"/><circle cx="12" cy="10" r="2.5"/></svg>
            </dt>
            <dd><span class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ $tx('ids.where', 'Where') }}</span><span class="text-ink-700 font-semibold">{{ id.where }}</span></dd>
          </div>
        </dl>

        <div class="mt-5 pt-5 border-t border-slate-100">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{{ $tx('ids.bring', 'Bring with you') }}</div>
          <ul class="space-y-2">
            <li v-for="b in id.bring" :key="b" class="flex items-start gap-2.5 text-sm text-slate-700">
              <svg class="w-4 h-4 text-brand-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              {{ b }}
            </li>
          </ul>
        </div>

        <p v-if="id.accepted !== false" class="mt-5 inline-flex items-start gap-2 rounded-xl bg-brand-50 ring-1 ring-brand-100 px-3 py-2 text-xs font-semibold text-brand-700 leading-snug">
          <svg class="w-4 h-4 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          {{ $tx('ids.accepted', 'Accepted on PermitTrack as a Valid Government ID.') }}
        </p>
        <!-- An ID outside PermitTrack's own list: say so rather than imply it counts -->
        <p v-else class="mt-5 inline-flex items-start gap-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 leading-snug">
          <svg class="w-4 h-4 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>
          {{ $tx('ids.notMain', 'Not on PermitTrack’s main list of accepted IDs. Check the document requirements of the permit you are applying for.') }}
        </p>
      </aside>

      <!-- the steps, each with a drawn scene -->
      <ol class="space-y-4">
        <li v-for="(s, n) in id.steps" :key="s.title" class="relative flex gap-4">
          <div class="flex flex-col items-center shrink-0">
            <span class="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center text-sm font-bold shadow-[0_8px_18px_-8px_rgba(31,122,58,0.7)]">{{ n + 1 }}</span>
            <span v-if="n < id.steps.length - 1" class="flex-1 w-0.5 mt-1.5 rounded bg-brand-200" aria-hidden="true"></span>
          </div>

          <div class="flex-1 min-w-0 rounded-3xl bg-white ring-1 ring-brand-100 overflow-hidden sm:flex shadow-[0_18px_40px_-32px_rgba(16,48,29,0.5)]">
            <div class="sm:w-48 shrink-0 bg-meadow border-b sm:border-b-0 sm:border-r border-brand-100 grid place-items-center p-3">
              <svg viewBox="0 0 160 110" class="w-full max-w-[11rem]" aria-hidden="true">
                <rect width="160" height="110" rx="14" fill="#f0f8ec"/>
                <!-- laptop showing a form -->
                <g v-if="s.art === 'laptop'">
                  <rect x="36" y="76" width="88" height="7" rx="3.5" fill="#10301d"/>
                  <rect x="46" y="24" width="68" height="54" rx="6" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <rect x="54" y="34" width="34" height="5" rx="2.5" fill="#b9dfa9"/><rect x="54" y="45" width="52" height="5" rx="2.5" fill="#dcefd3"/><rect x="54" y="56" width="28" height="5" rx="2.5" fill="#dcefd3"/>
                  <circle cx="100" cy="64" r="8" fill="#1f7a3a"/><path d="m96 64 3 3 5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <!-- a calendar and a clock -->
                <g v-else-if="s.art === 'calendar'">
                  <rect x="34" y="22" width="62" height="64" rx="7" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <path d="M34 29a7 7 0 0 1 7-7h48a7 7 0 0 1 7 7v10H34z" fill="#1f7a3a"/>
                  <rect x="46" y="16" width="5" height="12" rx="2.5" fill="#10301d"/><rect x="79" y="16" width="5" height="12" rx="2.5" fill="#10301d"/>
                  <g fill="#b9dfa9"><circle cx="48" cy="52" r="3.5"/><circle cx="65" cy="52" r="3.5"/><circle cx="82" cy="52" r="3.5"/><circle cx="48" cy="67" r="3.5"/><circle cx="82" cy="67" r="3.5"/></g>
                  <circle cx="65" cy="67" r="6.5" fill="#f7cf1b"/>
                  <circle cx="112" cy="74" r="19" fill="#fff" stroke="#10301d" stroke-width="3"/><path d="M112 62v12l8 5" stroke="#10301d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <!-- papers and an ID -->
                <g v-else-if="s.art === 'documents'">
                  <rect x="44" y="18" width="58" height="74" rx="6" fill="#dcefd3" transform="rotate(-6 73 55)"/>
                  <rect x="50" y="16" width="58" height="76" rx="6" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <rect x="58" y="26" width="30" height="5" rx="2.5" fill="#b9dfa9"/><rect x="58" y="37" width="40" height="5" rx="2.5" fill="#dcefd3"/>
                  <rect x="66" y="52" width="62" height="38" rx="6" fill="#fff" stroke="#1f7a3a" stroke-width="3"/>
                  <circle cx="82" cy="66" r="6" fill="#8fcb7b"/><path d="M72 84c1-7 5-10 10-10s9 3 10 10z" fill="#8fcb7b"/><rect x="98" y="62" width="22" height="4" rx="2" fill="#b9dfa9"/><rect x="98" y="71" width="16" height="4" rx="2" fill="#dcefd3"/>
                  <circle cx="122" cy="26" r="11" fill="#1f7a3a"/><path d="m116.5 26 4 4 7-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <!-- a face in a scan frame, and a fingerprint -->
                <g v-else-if="s.art === 'biometrics'">
                  <g stroke="#10301d" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M30 38V28a6 6 0 0 1 6-6h10"/><path d="M86 22h10a6 6 0 0 1 6 6v10"/><path d="M30 72v10a6 6 0 0 0 6 6h10"/><path d="M102 72v10a6 6 0 0 1-6 6H86"/></g>
                  <circle cx="66" cy="46" r="13" fill="#8fcb7b"/><path d="M42 82c2-15 12-21 24-21s22 6 24 21z" fill="#8fcb7b"/>
                  <rect x="26" y="52" width="80" height="4" rx="2" fill="#f7cf1b" opacity=".9"/>
                  <circle cx="128" cy="62" r="20" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <g stroke="#1f7a3a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M116 62a12 12 0 0 1 24 0"/><path d="M120 66a8 8 0 0 1 16 0v4"/><path d="M124 70v-4a4 4 0 0 1 8 0v8"/><path d="M128 66v10"/></g>
                </g>
                <!-- an envelope on its way -->
                <g v-else-if="s.art === 'mail'">
                  <rect x="34" y="38" width="76" height="50" rx="7" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <path d="m36 42 36 26 36-26" stroke="#10301d" stroke-width="3" stroke-linejoin="round" fill="none"/>
                  <rect x="54" y="24" width="36" height="22" rx="4" fill="#1f7a3a"/><circle cx="64" cy="33" r="3.5" fill="#fff"/><rect x="71" y="30" width="14" height="3.5" rx="1.75" fill="#fff" opacity=".8"/><rect x="71" y="36" width="9" height="3.5" rx="1.75" fill="#fff" opacity=".6"/>
                  <path d="M116 80c8 0 14-5 18-14" stroke="#f7cf1b" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 7" fill="none"/>
                  <path d="M136 36c-7 0-12 5-12 11 0 8 12 17 12 17s12-9 12-17c0-6-5-11-12-11z" fill="#f7cf1b" stroke="#10301d" stroke-width="2.5"/><circle cx="136" cy="47" r="4" fill="#10301d"/>
                </g>
                <!-- a clipboard form -->
                <g v-else-if="s.art === 'form'">
                  <rect x="46" y="20" width="64" height="78" rx="7" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <rect x="64" y="14" width="28" height="14" rx="5" fill="#1f7a3a"/>
                  <rect x="56" y="38" width="30" height="5" rx="2.5" fill="#b9dfa9"/><rect x="56" y="50" width="44" height="5" rx="2.5" fill="#dcefd3"/><rect x="56" y="62" width="44" height="5" rx="2.5" fill="#dcefd3"/><rect x="56" y="74" width="26" height="5" rx="2.5" fill="#dcefd3"/>
                  <path d="M104 78l22-22 7 7-22 22-10 3z" fill="#f7cf1b" stroke="#10301d" stroke-width="2.5" stroke-linejoin="round"/>
                </g>
                <!-- a government office -->
                <g v-else-if="s.art === 'building'">
                  <path d="M34 40 70 22l36 18z" fill="#1f7a3a"/>
                  <rect x="40" y="40" width="60" height="48" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <g fill="#dcefd3" stroke="#10301d" stroke-width="2"><rect x="48" y="48" width="12" height="14" rx="1.5"/><rect x="80" y="48" width="12" height="14" rx="1.5"/></g>
                  <rect x="62" y="64" width="16" height="24" rx="2" fill="#10301d"/>
                  <path d="M70 22V10" stroke="#10301d" stroke-width="3" stroke-linecap="round"/><path d="M70 10h12l-3 4 3 4H70z" fill="#f7cf1b"/>
                  <path d="M128 52c-6 0-10 4-10 9 0 7 10 15 10 15s10-8 10-15c0-5-4-9-10-9z" fill="#f7cf1b" stroke="#10301d" stroke-width="2.5"/><circle cx="128" cy="61" r="3.5" fill="#10301d"/>
                </g>
                <!-- a coin and a receipt -->
                <g v-else-if="s.art === 'payment'">
                  <rect x="86" y="22" width="44" height="68" rx="5" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <rect x="94" y="32" width="22" height="4.5" rx="2.25" fill="#b9dfa9"/><rect x="94" y="42" width="28" height="4.5" rx="2.25" fill="#dcefd3"/><rect x="94" y="52" width="24" height="4.5" rx="2.25" fill="#dcefd3"/><rect x="94" y="62" width="28" height="4.5" rx="2.25" fill="#dcefd3"/>
                  <path d="M92 80l6 4 6-4 6 4 6-4" stroke="#1f7a3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <circle cx="58" cy="60" r="26" fill="#f7cf1b" stroke="#10301d" stroke-width="3"/><circle cx="58" cy="60" r="19" fill="none" stroke="#b38f00" stroke-width="2" stroke-dasharray="3 3"/>
                  <path d="M51 52h10a5 5 0 0 1 0 10H51m0-10v18m-3-12h13m-13 5h13" stroke="#10301d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <!-- waiting -->
                <g v-else-if="s.art === 'hourglass'">
                  <path d="M52 20h56M52 92h56" stroke="#10301d" stroke-width="4" stroke-linecap="round"/>
                  <path d="M58 20c0 22 14 26 14 35S58 70 58 92h44c0-22-14-26-14-37s14-13 14-35z" fill="#fff" stroke="#10301d" stroke-width="3" stroke-linejoin="round"/>
                  <path d="M64 26h32c-1 10-8 15-16 15s-15-5-16-15z" fill="#f7cf1b"/><path d="M80 52v22" stroke="#f7cf1b" stroke-width="3" stroke-linecap="round"/><path d="M66 90c2-8 8-12 14-12s12 4 14 12z" fill="#f7cf1b"/>
                  <g fill="#8fcb7b"><circle cx="124" cy="56" r="4"/><circle cx="136" cy="56" r="4" opacity=".7"/><circle cx="148" cy="56" r="4" opacity=".4"/></g>
                </g>
                <!-- an approved application -->
                <g v-else-if="s.art === 'approve'">
                  <rect x="40" y="18" width="62" height="76" rx="7" fill="#fff" stroke="#10301d" stroke-width="3"/>
                  <rect x="50" y="30" width="30" height="5" rx="2.5" fill="#b9dfa9"/><rect x="50" y="42" width="42" height="5" rx="2.5" fill="#dcefd3"/><rect x="50" y="54" width="36" height="5" rx="2.5" fill="#dcefd3"/>
                  <circle cx="106" cy="68" r="22" fill="#1f7a3a"/><path d="m95 68 8 8 14-16" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <g stroke="#f7cf1b" stroke-width="3" stroke-linecap="round"><path d="M134 40v8M130 44h8"/><path d="M30 78v6M27 81h6"/></g>
                </g>
                <!-- the finished card -->
                <g v-else>
                  <rect x="30" y="30" width="86" height="56" rx="8" fill="#fff" stroke="#10301d" stroke-width="3" transform="rotate(-5 73 58)"/>
                  <g transform="rotate(-5 73 58)"><rect x="30" y="30" width="86" height="14" rx="8" fill="#1f7a3a"/><rect x="30" y="38" width="86" height="6" fill="#1f7a3a"/>
                  <circle cx="52" cy="62" r="7" fill="#8fcb7b"/><path d="M40 82c1-9 6-12 12-12s11 3 12 12z" fill="#8fcb7b"/><rect x="72" y="56" width="34" height="5" rx="2.5" fill="#b9dfa9"/><rect x="72" y="66" width="26" height="5" rx="2.5" fill="#dcefd3"/></g>
                  <circle cx="122" cy="34" r="14" fill="#f7cf1b" stroke="#10301d" stroke-width="3"/><path d="m116 34 4 4 8-9" stroke="#10301d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <g stroke="#1f7a3a" stroke-width="3" stroke-linecap="round"><path d="M140 70v8M136 74h8"/><path d="M22 22v6M19 25h6"/></g>
                </g>
              </svg>
            </div>

            <div class="p-5 sm:p-6 min-w-0">
              <h4 class="text-lg font-bold text-ink-700 leading-snug">{{ s.title }}</h4>
              <p class="mt-1.5 text-sm text-slate-600 leading-relaxed">{{ s.text }}</p>
              <p v-if="s.tip" class="mt-3 flex items-start gap-2 rounded-xl bg-sun-50 ring-1 ring-sun-200 px-3 py-2 text-xs text-ink-700 leading-snug">
                <svg class="w-4 h-4 shrink-0 text-sun-700 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/></svg>
                <span><span class="font-bold">{{ $tx('ids.tip', 'Tip:') }}</span> {{ s.tip }}</span>
              </p>
            </div>
          </div>
        </li>
      </ol>
    </div>

    <p class="mt-8 mx-auto max-w-3xl text-center text-xs text-slate-500 leading-relaxed">
      {{ $tx('ids.disclaimer', 'Requirements, fees and schedules are set by each agency and change from time to time. Confirm with the {agency} before you go, so you make one trip instead of two.', { agency: id.agency.split(' (')[0] }) }}
    </p>
  </div>
  `,
};

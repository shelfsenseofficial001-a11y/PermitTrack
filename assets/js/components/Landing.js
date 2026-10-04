import { permitIconClass } from '../util.js?v=115';
import ChatWidget from './ChatWidget.js?v=115';
import { authState, logout, listAccounts, switchAccount, reloadAs } from '../store/auth.js?v=115';

// The public front door. Everything on it describes what PermitTrack really does — the offices a
// permit actually passes through, the real permit catalogue and its real requirements — so nothing
// here over-promises. A permit is not a fixed set of stages: it is a chain of offices, and how many
// links it has depends on the permit. Keep this page in step with permit_pipeline_steps.

// The hero tracker walks through these, like a courier app following a parcel. This is a real
// Building Permit route, office by office — see permit_pipeline_steps for the Building Permit.
// Note the Building Official appears twice: offices can recur in a route, which is why these are
// keyed by position and not by name.
const HERO_STAGES = [
  { name: 'Barangay Burol I', time: 'Sep 2 · 9:14 AM', note: 'Barangay Construction Clearance signed' },
  { name: 'City Planning (CPDO)', time: 'Sep 4 · 2:30 PM', note: 'Zoning Clearance issued' },
  { name: 'Building Official', time: 'Sep 9 · 10:00 AM', note: 'Technical plan review passed' },
  { name: 'CENRO', time: 'Sep 12 · 1:05 PM', note: 'Environmental clearance granted' },
  { name: 'City Assessor', time: 'Sep 16 · 3:45 PM', note: 'Real property tax clearance confirmed' },
  { name: 'Building Official', time: 'Sep 18 · 11:20 AM', note: 'Building Permit issued' },
];

// One real route, as an example: the Building Permit. Other permits are shorter — a Certificate
// of Residency is a single stop at your barangay — and a few are longer. The page says so rather
// than implying every permit looks like this one.
const JOURNEY = [
  { office: 'Your Barangay', step: 'Construction Clearance', art: 'barangay' },
  { office: 'City Planning', step: 'Zoning Clearance', art: 'zoning' },
  { office: 'Building Official', step: 'Plan review', art: 'plans' },
  { office: 'CENRO', step: 'Environmental clearance', art: 'environment' },
  { office: 'City Assessor', step: 'RPT clearance', art: 'tax' },
  { office: 'Building Official', step: 'Permit issued', art: 'permit' },
];

// Mirrors required_documents_for() and PERMIT_RULES in the API
const PERMITS = [
  { type: 'Building/Renovation', blurb: 'Additions, repairs and remodels to homes and commercial buildings.', residents: true,
    docs: ['Site Plan', 'Structural Drawings', 'Proof of Insurance', 'Contractor License'] },
  { type: 'Special Event', blurb: 'Fiestas, markets, concerts and gatherings on public or private grounds.', residents: true,
    docs: ['Event Layout Map', 'Proof of Insurance', 'Security/Safety Plan'] },
  { type: 'Food Service', blurb: 'Restaurants, cafés, food stalls and commissaries.', residents: false,
    docs: ['Health Permit Application', 'Food Handler Certificate', 'Floor Plan', 'Proof of Insurance'] },
  { type: 'Business License', blurb: 'New businesses and annual renewals.', residents: false,
    docs: ['Business Formation Document', 'BIR Certificate of Registration (Form 2303)', 'Zoning Compliance Letter'] },
  { type: 'Sign', blurb: 'Storefront, pylon and illuminated signage.', residents: false,
    docs: ['Sign Drawing / Rendering', 'Property Owner Authorization'] },
];

function initialsOf(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ---- The looping demos (Features and Get started) ------------------------------------------
// Every mockup loops a short story of what it shows. Each section has one tick driving all
// its cards; each card turns it into its own frame at its own pace, so they never move in
// lockstep. With a section's Animations switch off, each card holds a single still frame —
// the one the page always had.
const DEMO_TICK_MS = 400;
const MOTION_KEYS = { feat: 'permittrack.featureMotion', steps: 'permittrack.stepsMotion' };

const FEAT_TIMELINE = [
  { name: 'Barangay Burol I', note: 'Construction Clearance signed', date: 'Sep 2' },
  { name: 'City Planning (CPDO)', note: 'Zoning Clearance issued', date: 'Sep 4' },
  { name: 'Building Official', note: 'Technical plan review passed', date: 'Sep 9' },
  { name: 'CENRO', note: 'Environmental clearance granted', date: 'Sep 12' },
];
const FEAT_ALERTS = [
  { channel: 'Email', date: 'Sep 4', text: 'Zoning Clearance issued', icon: 'mail' },
  { channel: 'SMS', date: 'Sep 9', text: 'Moved to Building Official', icon: 'phone' },
  { channel: 'In-app', date: 'Sep 10', text: 'A document needs changes', icon: 'bell' },
];
const FEAT_CHAT = [
  { id: 'm1', from: 'them', text: 'The floor plan scan is too low-res to read the dimensions.' },
  { id: 'm2', from: 'me', text: 'Re-uploaded a 300dpi scan just now.' },
  { id: 'm3', from: 'them', text: 'Got it — approved. Moving this on to CENRO.' },
];
const FEAT_PERMITS = [
  { name: 'Food Service', address: '24 Rizal Ave.', status: 'In progress' },
  { name: 'Sign Permit', address: '12 Mabini St.', status: 'Approved' },
  { name: 'Building/Renovation', address: '12 Mabini St.', status: 'In progress' },
  { name: 'Special Event', address: 'Plaza Rizal', status: 'Draft' },
];
const FEAT_SEARCH = 'Mabini';

// The Get started story: the real register screen's contact, a 6-digit code, the proofs
const STEPS_CONTACT = { email: 'juan.delacruz@email.com', phone: '0917 123 4567' };
const STEPS_CODE = '482791';
const STEPS_FILES = ['brgy-certificate.pdf', 'electric-bill-sep.pdf'];

// On unless this visitor has switched it off before. which: 'feat' | 'steps'
function readMotion(which) {
  try {
    return localStorage.getItem(MOTION_KEYS[which]) !== '0';
  } catch (e) {
    return true;
  }
}

// A short slice of RESIDENCY_DOC_TYPES (api/lib/residency.php) for the mockup's dropdown
const PROOF_OPTIONS = [
  'Barangay Certificate of Residency',
  'Utility bill (electricity, water…)',
  'National ID (PhilSys) with address',
  'Lease or rental contract',
];

const FEATURES = [
  { title: 'Live status timeline', text: 'See exactly which stage your permit is in, and when it got there.', icon: 'timeline' },
  { title: 'Alerts the moment it moves', text: 'Email, SMS and in-app notifications at every stage. No refreshing, no calling.', icon: 'bell' },
  { title: 'Fix it in one upload', text: 'If a document needs changes, replace just that one. Everything else keeps moving.', icon: 'upload' },
  { title: 'Talk to your reviewer', text: 'Message City Staff directly on your permit. Every reply stays in its history.', icon: 'chat' },
  { title: 'All your permits, one list', text: 'Filter by status, search by address, and open any permit for the full story.', icon: 'list' },
  { title: 'Answers on demand', text: 'The built-in Ask assistant knows every permit’s requirements, and your own status.', icon: 'spark' },
];

const FAQS = [
  { q: 'Who can apply for a permit?',
    a: 'Anyone can create an account and browse every permit and its requirements. To apply, verify as a Resident (two proofs of residence, reviewed by City Staff) or add a business you already run, which City Staff approves against its DTI, SEC or CDA certificate.' },
  { q: 'How will I know when my permit moves?',
    a: 'Every stage change is posted to your permit and sent to you by email or SMS. It also shows up under the bell in your account.' },
  { q: 'What happens if one of my documents is rejected?',
    a: 'The reviewer marks it for re-upload and tells you why. You replace just that document from your phone or computer, and the review picks up where it left off.' },
  { q: 'Can I talk to the person reviewing my application?',
    a: 'Yes. Every permit has its own message thread with City Staff, so questions and answers stay attached to the application they are about.' },
  { q: 'I have a home and a business. Do I need two accounts?',
    a: 'No. Resident and Business Owner are labels on the same account, so one person can be both and file for either.' },
  { q: 'I work for the City. Where do I sign in?',
    a: 'City Staff and Admins sign in through the Staff Portal, linked at the bottom of this page.' },
];

export default {
  name: 'Landing',
  components: { ChatWidget },
  data() {
    return {
      stage: 0,
      looping: false, // fading the tracker out before it starts over
      instant: false, // one frame with transitions off, so the reset doesn't replay in reverse
      openFaqs: [0], // any number can be open at once; the first starts open
      // The figures in the tagline band. 'to' is where each counts up to: every permit type in
      // permit_types, every department that can hold a permit, and email + SMS + in-app.
      stats: [
        { to: 28, l: 'permit types, one account' },
        { to: 88, l: 'offices and barangay halls' },
        { to: 3, l: 'ways to hear it moved' },
      ],
      statCounts: [0, 0, 0],
      scrolled: false,
      showFloatingTop: false,
      menuOpen: false,
      // One list for the desktop nav, the mobile menu and the footer
      navLinks: [
        { id: 'how-it-works', label: 'How it works' },
        { id: 'features', label: 'Features' },
        { id: 'permits', label: 'Permits' },
        { id: 'faq', label: 'FAQ' },
      ],
      heroStages: HERO_STAGES,
      journey: JOURNEY,
      permits: PERMITS,
      features: FEATURES,
      faqs: FAQS,
      featMotion: readMotion('feat'),
      featTick: 0,
      featVisible: true,
      stepsMotion: readMotion('steps'),
      stepsTick: 0,
      stepsVisible: true,
      stepsCode: STEPS_CODE,
      stepsFiles: STEPS_FILES,
      featTimeline: FEAT_TIMELINE,
      authState,
      accountOpen: false,
      signInOpen: false,
      // Accounts still signed in on this browser. Empty once the last one signs out, and the
      // Sign in button goes back to being a plain Log in.
      otherAccounts: [],
      resuming: false,
      proofOptions: PROOF_OPTIONS,
      // The mockups are inert, but these let them be poked at: a dropdown opens, a segmented
      // control switches, a button pretends to upload. Nothing here reaches the API.
      demo: {
        open: null,
        contact: 'email',
        proofs: [PROOF_OPTIONS[0], PROOF_OPTIONS[1]],
        permit: 0,
        uploading: false,
      },
      year: new Date().getFullYear(),
    };
  },
  computed: {
    // Signed-in applicants get their account menu here instead of Log in / Get started. Staff
    // keep the plain buttons: their work lives in the Staff Portal, not on this page.
    accountUser() {
      const u = authState.user;
      return u && u.role === 'applicant' ? u : null;
    },
    initials() {
      return initialsOf((this.accountUser && this.accountUser.full_name) || '');
    },

    // ---- Features demos: each returns the still frame when the switch is off ----
    // Index of the office holding the permit; past the last one, it has been approved
    timelineActive() {
      return this.featMotion ? [0, 1, 2, 3, 4, 4][this.featFrame(4, 6)] : 2;
    },
    timelineApproved() {
      return this.timelineActive >= FEAT_TIMELINE.length;
    },
    // Toasts arrive one at a time, newest at the bottom, then clear and start again
    visibleAlerts() {
      const n = this.featMotion ? [1, 2, 3, 3, 3][this.featFrame(4, 5)] : 3;
      return FEAT_ALERTS.slice(0, n);
    },
    // A rejected document gets replaced: pressed, uploading, accepted
    uploadPhase() {
      if (this.demo.uploading) return 'click';
      return this.featMotion ? ['needs', 'press', 'up1', 'up2', 'done', 'done'][this.featFrame(3, 6)] : 'needs';
    },
    uploadBusy() {
      return ['click', 'up1', 'up2'].includes(this.uploadPhase);
    },
    uploadFixed() {
      return !['needs', 'press'].includes(this.uploadPhase);
    },
    // The reviewer types, you answer, they type again and sign it off
    chatItems() {
      const [m1, m2, m3] = FEAT_CHAT;
      const typing = { id: 'typing', from: 'them' };
      const f = this.featMotion ? this.featFrame(4, 6) : 3;
      return [[typing], [m1], [m1, m2], [m1, m2, typing], [m1, m2, m3], [m1, m2, m3]][f];
    },
    // The address is typed a letter at a time and the list narrows to match as it goes
    listQuery() {
      if (!this.featMotion) return FEAT_SEARCH;
      return FEAT_SEARCH.slice(0, Math.min(this.featFrame(1, 16), FEAT_SEARCH.length));
    },
    listRows() {
      const q = this.listQuery.toLowerCase();
      if (!this.featMotion || !q) return FEAT_PERMITS;
      return FEAT_PERMITS.filter((p) => p.address.toLowerCase().includes(q));
    },
    // A question, a moment's thought, then the answer one line at a time
    askFrame() {
      return this.featMotion ? this.featFrame(3, 9) : 8;
    },
    // Changes once per loop, remounting the conversation so its entrances replay
    askLoop() {
      return this.featMotion ? Math.floor(this.featTick / 27) : 0;
    },

    // ---- Get started demos: null frame = the switch is off, show the still ----
    // Step 1 — the contact is typed, a code arrives, its digits go in, and you are verified
    acctFrame() {
      return this.stepsMotion ? this.stepsFrame(1, 19) : null;
    },
    acctContact() {
      return STEPS_CONTACT[this.demo.contact];
    },
    acctTyped() {
      const v = this.acctContact, f = this.acctFrame;
      if (f === null || f >= 6) return v;
      return v.slice(0, Math.round((v.length * (f + 1)) / 6));
    },
    acctTyping() {
      return this.acctFrame !== null && this.acctFrame < 6;
    },
    acctCodeSent() {
      return this.acctFrame === null || this.acctFrame >= 6;
    },
    acctDigits() {
      const f = this.acctFrame;
      if (f === null) return 4;
      return f < 8 ? 0 : Math.min(f - 7, STEPS_CODE.length);
    },
    acctVerified() {
      return this.acctFrame !== null && this.acctFrame >= 14;
    },
    // Step 2 — each proof: pick its type from the list, upload the file, then staff approve
    proofFrame() {
      return this.stepsMotion ? this.stepsFrame(3, 8) : null;
    },
    proofStatus() {
      const f = this.proofFrame;
      if (f === null) return 'waiting';
      return f >= 6 ? 'approved' : f === 5 ? 'waiting' : null;
    },
    // Step 3 — pick the permit, its documents tick off, and it sets out on its route
    applyFrame() {
      return this.stepsMotion ? this.stepsFrame(3, 9) : null;
    },
    applyMenuOpen() {
      if (this.demo.open) return this.demo.open === 'permit';
      return this.applyFrame === 0;
    },
    applyPicked() {
      return this.applyFrame === null || this.applyFrame >= 1;
    },
    applyChecked() {
      const f = this.applyFrame;
      if (f === null) return 2;
      return Math.min(Math.max(f - 1, 0), this.permits[this.demo.permit].docs.length);
    },
    // Which of its first offices the permit has reached (0 = not filed yet)
    applyStop() {
      const f = this.applyFrame;
      if (f === null) return 2;
      return f < 5 ? 0 : f - 4;
    },
    progress() {
      return (this.stage / (HERO_STAGES.length - 1)) * 100;
    },
    approved() {
      return this.stage === HERO_STAGES.length - 1;
    },
  },
  mounted() {
    this.previousTitle = document.title;
    document.title = 'PermitTrack · Track your permit like a package';

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scrollBehavior = reduced ? 'auto' : 'smooth';
    if (reduced) {
      this.stage = 2; // a meaningful mid-journey still, instead of motion
    } else {
      this.tick = () => {
        const last = HERO_STAGES.length - 1;
        if (this.stage >= last) return this.restart();
        this.stage += 1;
        // Linger on "Approved" so the payoff lands before it starts over
        this.timer = setTimeout(this.tick, this.stage === last ? 3200 : 1900);
      };
      this.timer = setTimeout(this.tick, 1600);
    }

    this.onScroll = () => {
      this.scrolled = window.scrollY > 8;
      // The floating "Back to top" appears once the hero is behind you and stays, footer included
      this.showFloatingTop = window.scrollY > window.innerHeight * 0.9;
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();

    // Mobile menu: Escape closes it (and hands focus back to the toggle); so does widening
    // to desktop, where the menu has no place and would otherwise linger open underneath
    this.onKey = (e) => {
      if (e.key === 'Escape' && this.demo.open) this.demo.open = null;
      if (e.key === 'Escape' && this.accountOpen) this.accountOpen = false;
      if (e.key === 'Escape' && this.signInOpen) this.signInOpen = false;
      if (e.key === 'Escape' && this.menuOpen) {
        this.closeMenu();
        const toggle = this.$refs.header && this.$refs.header.querySelector('[aria-controls="mobile-menu"]');
        if (toggle) toggle.focus();
      }
    };
    this.onResize = () => { if (window.innerWidth >= 768) this.closeMenu(); };
    this.onDocClick = (e) => {
      if (this.accountOpen && this.$refs.account && !this.$refs.account.contains(e.target)) this.accountOpen = false;
      if (this.signInOpen && this.$refs.signIn && !this.$refs.signIn.contains(e.target)) this.signInOpen = false;
    };
    if (!this.accountUser) {
      listAccounts().then((a) => { this.otherAccounts = a; }).catch(() => { /* chooser just stays a plain Log in */ });
    }
    this.runLoop('feat');
    this.runLoop('steps');
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('click', this.onDocClick);
    window.addEventListener('resize', this.onResize);

    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            this.observer.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      this.$el.querySelectorAll('.reveal').forEach((el) => this.observer.observe(el));

      // The figures run up from zero as the band arrives, rather than being there already
      this.statsObserver = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.statsObserver.disconnect();
          this.countStatsUp();
        }
      }, { threshold: 0.4 });
      if (this.$refs.statsBand) this.statsObserver.observe(this.$refs.statsBand);

      // The looping demos only advance while you can see them
      this.loopObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.target === this.$refs.features) this.featVisible = e.isIntersecting;
          if (e.target === this.$refs.steps) this.stepsVisible = e.isIntersecting;
        });
      }, { threshold: 0.05 });
      if (this.$refs.features) this.loopObserver.observe(this.$refs.features);
      if (this.$refs.steps) this.loopObserver.observe(this.$refs.steps);
      // Counting up is the nice version, not the only version: if the band is never observed
      // (a tab opened in the background, an engine that does not run the observer), the figures
      // simply appear rather than sitting at zero.
      this.statsFallback = setTimeout(() => {
        if (this.statCounts.every((n) => n === 0)) this.statCounts = this.stats.map((f) => f.to);
      }, 4000);
    } else {
      this.$el.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      this.statCounts = this.stats.map((f) => f.to);
    }
  },
  beforeUnmount() {
    document.title = this.previousTitle;
    clearTimeout(this.timer);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('click', this.onDocClick);
    window.removeEventListener('resize', this.onResize);
    if (this.observer) this.observer.disconnect();
    if (this.statsObserver) this.statsObserver.disconnect();
    if (this.loopObserver) this.loopObserver.disconnect();
    if (this.statsFrame) cancelAnimationFrame(this.statsFrame);
    clearTimeout(this.statsBackstop);
    clearTimeout(this.statsFallback);
    clearTimeout(this.uploadTimer);
    clearInterval(this.featTimer);
    clearInterval(this.stepsTimer);
  },
  watch: {
    featMotion(on) { this.motionChanged('feat', on); },
    stepsMotion(on) { this.motionChanged('steps', on); },
  },
  methods: {
    permitIconClass,
    initialsOf,
    // Which frame of a card's loop its section's tick lands on. speed = ticks per frame.
    featFrame(speed, count) {
      return Math.floor(this.featTick / speed) % count;
    },
    stepsFrame(speed, count) {
      return Math.floor(this.stepsTick / speed) % count;
    },
    motionChanged(which, on) {
      try { localStorage.setItem(MOTION_KEYS[which], on ? '1' : '0'); } catch (e) { /* just not remembered */ }
      this.runLoop(which);
    },
    // which: 'feat' | 'steps' — drives <which>Tick while <which>Motion is on
    runLoop(which) {
      clearInterval(this[which + 'Timer']);
      this[which + 'Tick'] = 0;
      if (!this[which + 'Motion']) return;
      // Only counts while the section is on screen in a visible tab: a background tab doesn't
      // paint, so frames advanced there would only queue up half-finished transitions
      this[which + 'Timer'] = setInterval(() => {
        if (this[which + 'Visible'] && document.visibilityState === 'visible') this[which + 'Tick']++;
      }, DEMO_TICK_MS);
    },
    // Step 2's per-proof state, for slot 0 or 1
    proofPicked(slot) {
      const f = this.proofFrame;
      return f === null || f >= (slot === 0 ? 2 : 4);
    },
    proofFile(slot) {
      const f = this.proofFrame;
      if (f === null) return 'done';
      const at = slot === 0 ? 2 : 4;
      return f < at ? null : f === at ? 'up' : 'done';
    },
    proofMenuOpen(slot) {
      if (this.demo.open) return this.demo.open === 'proof' + slot;
      return this.proofFrame === (slot === 0 ? 1 : 3);
    },
    // Step 3's route dots: done, the current office, or still ahead
    stopState(i) {
      const at = this.applyStop - 1;
      return i < at ? 'done' : i === at ? 'active' : 'pending';
    },
    tlState(k) {
      const a = this.timelineActive;
      return k < a ? 'done' : k === a ? 'active' : 'pending';
    },
    statusPill(status) {
      if (status === 'Approved') return 'bg-brand-100 text-brand-700';
      if (status === 'Draft') return 'bg-slate-100 text-slate-500';
      return 'bg-sun-100 text-sun-700';
    },
    // Splits an address around the search so the matching letters can be marked
    searchParts(text) {
      const q = this.listQuery.toLowerCase();
      const at = this.featMotion && q ? text.toLowerCase().indexOf(q) : -1;
      if (at < 0) return [{ text, hit: false }];
      return [
        { text: text.slice(0, at), hit: false },
        { text: text.slice(at, at + q.length), hit: true },
        { text: text.slice(at + q.length), hit: false },
      ].filter((p) => p.text);
    },
    // Signing out leaves nobody signed in and lands here, on the landing page. Whoever else is
    // still signed in on this browser moves into the Sign in chooser.
    async doLogout() {
      this.accountOpen = false;
      await logout();
      this.otherAccounts = await listAccounts().catch(() => []);
      if (this.$route.path !== '/') this.$router.push('/');
    },
    // Those accounts never signed out, so stepping back into one needs no password
    async resumeAccount(id) {
      if (this.resuming) return;
      this.resuming = true;
      try {
        reloadAs(await switchAccount(id));
      } catch (e) {
        this.signInOpen = false;
        this.otherAccounts = await listAccounts().catch(() => []);
      } finally {
        this.resuming = false;
      }
    },
    toggleDemo(key) {
      this.demo.open = this.demo.open === key ? null : key;
    },
    pickProof(slot, label) {
      this.demo.proofs[slot] = label;
      this.demo.open = null;
    },
    pickPermit(i) {
      this.demo.permit = i;
      this.demo.open = null;
    },
    // Goes through the motions of replacing a document and lands back where it started
    fakeUpload() {
      if (this.demo.uploading) return;
      this.demo.uploading = true;
      this.uploadTimer = setTimeout(() => { this.demo.uploading = false; }, 1400);
    },
    // Counts every figure up together over ~1.1s, easing out so they slow into their final value.
    // Nothing moves for someone who asked for less motion — the numbers are simply there.
    countStatsUp() {
      const targets = this.stats.map((f) => f.to);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.statCounts = targets;
        return;
      }
      clearTimeout(this.statsFallback);
      const DURATION = 1100;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        this.statCounts = targets.map((to) => Math.round(to * eased));
        if (t < 1) this.statsFrame = requestAnimationFrame(step);
        else this.statCounts = targets;   // never leave it a rounding short of the real figure
      };
      this.statsFrame = requestAnimationFrame(step);
      // If frames never come (a backgrounded tab, a browser that throttles hard), the figures still
      // end up at their real values rather than sitting at zero.
      clearTimeout(this.statsBackstop);
    clearTimeout(this.statsFallback);
      this.statsBackstop = setTimeout(() => { this.statCounts = targets; }, DURATION + 300);
    },
    closeMenu() {
      this.menuOpen = false;
    },
    isFaqOpen(i) {
      return this.openFaqs.includes(i);
    },
    // Opening one answer leaves the others as they are, so several can be read side by side
    toggleFaq(i) {
      this.openFaqs = this.isFaqOpen(i) ? this.openFaqs.filter((n) => n !== i) : [...this.openFaqs, i];
    },
    // Height is animated in JS rather than CSS: the answer's open height isn't known up front,
    // and `grid-template-rows: 1fr` collapses to 0 inside an auto-height container.
    faqEnter(el, done) {
      const to = el.scrollHeight;
      this.animateHeight(el, 0, to, 300, 'cubic-bezier(.2,.7,.2,1)', done);
    },
    faqLeave(el, done) {
      this.animateHeight(el, el.getBoundingClientRect().height, 0, 220, 'cubic-bezier(.4,0,1,1)', done);
    },
    animateHeight(el, from, to, duration, easing, done) {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Clicking faster than the animation would otherwise stack them on one element
      el.getAnimations().forEach((a) => a.cancel());
      el.style.overflow = 'hidden';
      const ms = reduced ? 0 : duration;
      const anim = el.animate(
        [{ height: from + 'px', opacity: from ? 1 : 0 }, { height: to + 'px', opacity: to ? 1 : 0 }],
        { duration: ms, easing },
      );
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Cancelling drops the animation's hold on height, so the element falls back to its
        // natural size. Without this, an animation still "running" pins the answer at 0.
        if (anim.playState === 'running') {
          try { anim.cancel(); } catch (e) { /* already gone */ }
        }
        el.style.overflow = '';
        done();
      };
      // A backstop: if the animation never reports finishing (a background tab, for instance),
      // the answer must still end up at its natural height rather than stuck at zero.
      const timer = setTimeout(finish, ms + 80);
      anim.onfinish = finish;
      anim.oncancel = finish;
    },
    // The app uses hash routing, so "#section" links would be read as routes. Scroll instead.
    // The menu closes first, so the scroll target is measured without the overlay in the way.
    go(id) {
      this.menuOpen = false;
      this.$nextTick(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: this.scrollBehavior, block: 'start' });
      });
    },
    // Back to the hero, with keyboard focus on the logo so tabbing resumes from the top
    // rather than from the footer the user just left
    toTop() {
      window.scrollTo({ top: 0, behavior: this.scrollBehavior });
      const logo = this.$refs.header && this.$refs.header.querySelector('button');
      if (logo) logo.focus({ preventScroll: true });
    },
    stageState(i) {
      return i < this.stage ? 'done' : i === this.stage ? 'active' : 'todo';
    },
    // Fade out, snap back to the first stage with transitions off, fade back in. Letting the
    // colour transitions run would show every dot un-filling in reverse for half a second.
    restart() {
      this.looping = true;
      this.timer = setTimeout(() => {
        this.instant = true;
        this.stage = 0;
        this.timer = setTimeout(() => {
          this.instant = false;
          this.looping = false;
          this.timer = setTimeout(this.tick, 1900);
        }, 60);
      }, 350);
    },
  },
  template: `
  <div class="page-body font-inter bg-meadow text-slate-900 overflow-x-clip">
    <!-- overflow-x-clip, not -hidden: "hidden" makes this a scroll container, which traps the sticky nav -->

    <!-- ============ NAV ============ -->
    <!-- Tapping outside the open mobile menu closes it -->
    <transition enter-from-class="opacity-0" enter-active-class="transition-opacity duration-200" leave-to-class="opacity-0" leave-active-class="transition-opacity duration-150">
      <div v-if="menuOpen" class="md:hidden fixed inset-0 z-30 bg-ink-900/25 backdrop-blur-[2px]" @click="closeMenu" aria-hidden="true"></div>
    </transition>

    <header ref="header" class="sticky top-0 z-40 transition-all duration-300"
      :class="scrolled || menuOpen ? 'bg-white/90 backdrop-blur-md shadow-[0_8px_30px_-18px_rgba(16,48,29,0.35)]' : 'bg-transparent'">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button type="button" @click="go('top')" class="flex items-center gap-2.5 shrink-0" aria-label="PermitTrack, back to top">
          <img src="assets/images/PermitTrackIcon.png?v=115" alt="" class="w-9 h-9 object-contain" />
          <span class="leading-tight text-left">
            <span class="block text-[15px] font-bold text-ink-700">PermitTrack</span>
            <span class="block text-[11px] text-slate-500">City of Dasmariñas</span>
          </span>
        </button>
        <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Page sections">
          <button v-for="l in navLinks" :key="l.id" type="button" @click="go(l.id)" class="hover:text-ink-700 transition">{{ l.label }}</button>
        </nav>
        <div class="flex items-center gap-2 shrink-0">
          <!-- Signed in, the two sign-up buttons give way to the account menu. The app's own pages
               are in here because this page has no nav of its own to put them in. -->
          <div v-if="accountUser" ref="account" class="relative">
            <button type="button" @click="accountOpen = !accountOpen" :aria-expanded="accountOpen" aria-haspopup="menu"
              class="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-ink-700/5 transition">
              <span class="w-8 h-8 rounded-full bg-brand-600 text-white ring-2 ring-sun-300/70 flex items-center justify-center text-xs font-bold">{{ initials }}</span>
              <span class="hidden sm:inline text-sm font-semibold text-ink-700 max-w-[9rem] truncate">{{ accountUser.full_name }}</span>
              <svg class="w-4 h-4 text-slate-400 transition-transform" :class="accountOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>

            <transition name="pop">
            <div v-if="accountOpen" role="menu"
              class="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-ink-700 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] p-2 text-sm">
              <div class="px-3 py-2.5 border-b border-white/10 mb-1">
                <div class="font-semibold text-white truncate">{{ accountUser.full_name }}</div>
                <div class="text-xs text-ink-300 truncate">{{ accountUser.email || accountUser.phone }}</div>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span v-for="level in accountUser.levels" :key="level"
                    class="text-[11px] font-bold px-2 py-0.5 rounded-full" :class="level === 'Normal User' ? 'bg-white/10 text-ink-200' : 'bg-sun-300 text-ink-700'">{{ level }}</span>
                </div>
              </div>
              <router-link to="/dashboard" role="menuitem" @click="accountOpen = false" class="flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                Dashboard
              </router-link>
              <router-link to="/permits" role="menuitem" @click="accountOpen = false" class="flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
                My Permits
              </router-link>
              <router-link to="/applications/new" role="menuitem" @click="accountOpen = false" class="flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                {{ accountUser.can_apply ? 'New Application' : 'Browse Permits' }}
              </router-link>
              <div class="h-px bg-white/10 my-1"></div>
              <router-link to="/account" role="menuitem" @click="accountOpen = false" class="flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My account
              </router-link>
              <button type="button" role="menuitem" @click="doLogout" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-300 hover:bg-red-500/15">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
                Sign out
              </button>
            </div>
            </transition>
          </div>

          <!-- On phones, Log in moves into the menu so the main action and the toggle fit -->
          <template v-else>
            <!-- Someone else is still signed in on this browser: stepping back into them needs no
                 password, because they never signed out. With nobody left this is a plain Log in. -->
            <div v-if="otherAccounts.length" ref="signIn" class="relative hidden md:block">
              <button type="button" @click="signInOpen = !signInOpen" :aria-expanded="signInOpen" aria-haspopup="menu"
                class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 px-4 py-2 rounded-xl hover:bg-ink-700/5 transition">
                Sign in
                <svg class="w-4 h-4 text-slate-400 transition-transform" :class="signInOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <transition name="pop">
              <div v-if="signInOpen" role="menu"
                class="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-ink-700 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] p-2 text-sm">
                <button v-for="a in otherAccounts" :key="a.id" type="button" role="menuitem"
                  @click="resumeAccount(a.id)" :disabled="resuming"
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-white/10 disabled:opacity-60">
                  <span class="w-3.5 h-3.5 rounded-full ring-1 ring-white/25 shrink-0"></span>
                  <span class="w-7 h-7 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{{ initialsOf(a.full_name) }}</span>
                  <span class="min-w-0">
                    <span class="block font-semibold text-white truncate">{{ a.full_name }}</span>
                    <span class="block text-[11px] text-ink-300 truncate">{{ a.contact }}</span>
                  </span>
                </button>
                <div class="h-px bg-white/10 my-1"></div>
                <router-link to="/login" role="menuitem" @click="signInOpen = false"
                  class="flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-white hover:bg-white/10">
                  <span class="w-3.5 text-center text-lg leading-none text-ink-300">+</span>
                  Add account
                </router-link>
              </div>
              </transition>
            </div>

            <router-link v-else to="/login" class="hidden md:inline-flex text-sm font-semibold text-ink-700 px-4 py-2 rounded-xl hover:bg-ink-700/5 transition">Log in</router-link>
            <router-link to="/register" class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">Get started</router-link>
          </template>
          <button type="button" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-controls="mobile-menu"
            :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
            class="md:hidden relative w-10 h-10 -mr-1 rounded-xl flex items-center justify-center text-ink-700 hover:bg-ink-700/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 transition">
            <!-- three bars that fold into an X -->
            <span class="absolute h-0.5 w-5 rounded-full bg-current transition-transform duration-300" :class="menuOpen ? 'rotate-45' : '-translate-y-[6px]'"></span>
            <span class="absolute h-0.5 w-5 rounded-full bg-current transition-opacity duration-200" :class="menuOpen ? 'opacity-0' : 'opacity-100'"></span>
            <span class="absolute h-0.5 w-5 rounded-full bg-current transition-transform duration-300" :class="menuOpen ? '-rotate-45' : 'translate-y-[6px]'"></span>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <transition enter-from-class="opacity-0 -translate-y-2" enter-active-class="transition duration-200 ease-out"
        leave-to-class="opacity-0 -translate-y-2" leave-active-class="transition duration-150 ease-in">
        <!-- Full-width sheet hanging from the header: square top, rounded bottom -->
        <div v-if="menuOpen" id="mobile-menu" class="md:hidden absolute inset-x-0 top-full">
          <div class="rounded-b-3xl bg-white border-t border-brand-100 shadow-[0_24px_50px_-20px_rgba(7,24,14,0.45)] overflow-hidden">
            <nav class="p-2" aria-label="Page sections">
              <button v-for="l in navLinks" :key="l.id" type="button" @click="go(l.id)"
                class="w-full flex items-center justify-between px-2 py-3.5 rounded-xl text-[15px] font-semibold text-ink-700 hover:bg-meadow active:bg-meadow transition">
                {{ l.label }}
                <svg class="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </nav>
            <div v-if="accountUser" class="border-t border-brand-100 bg-slate-50/70 p-4 grid gap-2.5">
              <router-link to="/dashboard" @click="closeMenu" class="text-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 py-3 rounded-xl transition">Dashboard</router-link>
              <router-link to="/permits" @click="closeMenu" class="text-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 py-3 rounded-xl transition">My Permits</router-link>
              <router-link to="/applications/new" @click="closeMenu" class="text-center text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 py-3 rounded-xl transition">{{ accountUser.can_apply ? 'New Application' : 'Browse Permits' }}</router-link>
              <router-link to="/account" @click="closeMenu" class="text-center text-xs font-semibold text-slate-500 hover:text-brand-700 pt-1 transition">My account →</router-link>
            </div>
            <div v-else class="border-t border-brand-100 bg-slate-50/70 p-4 grid grid-cols-2 gap-2.5">
              <div v-if="otherAccounts.length" class="col-span-2 grid gap-1.5 mb-1">
                <button v-for="a in otherAccounts" :key="a.id" type="button" @click="resumeAccount(a.id)" :disabled="resuming"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 transition">
                  <span class="w-7 h-7 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{{ initialsOf(a.full_name) }}</span>
                  <span class="min-w-0 text-left">
                    <span class="block text-sm font-semibold text-ink-700 truncate">{{ a.full_name }}</span>
                    <span class="block text-[11px] text-slate-400 truncate">{{ a.contact }}</span>
                  </span>
                </button>
              </div>
              <router-link to="/login" class="text-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 py-3 rounded-xl transition">{{ otherAccounts.length ? 'Add account' : 'Log in' }}</router-link>
              <router-link to="/register" class="text-center text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 py-3 rounded-xl transition">Get started</router-link>
              <router-link to="/staff/login" class="col-span-2 text-center text-xs font-semibold text-slate-500 hover:text-brand-700 pt-1 transition">City staff? Sign in to the Staff Portal →</router-link>
            </div>
          </div>
        </div>
      </transition>
    </header>

    <!-- ============ HERO ============ -->
    <section id="top" class="relative -mt-16 pt-24 sm:pt-28 pb-14 sm:pb-20">
      <!-- soft brand glow behind the tracker -->
      <div class="pt-gradient absolute -right-40 top-10 w-[42rem] h-[42rem] rounded-full blur-3xl opacity-30 pointer-events-none" aria-hidden="true"></div>
      <div class="absolute -left-32 bottom-0 w-96 h-96 rounded-full bg-sun-200/40 blur-3xl pointer-events-none" aria-hidden="true"></div>

      <!-- grid-cols-1 = minmax(0,1fr): without it the single column grows to fit the tracker card's
           widest line and pushes the text past the edge of narrow phones -->
      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center">
        <div>
          <h1 class="text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.1rem] font-extrabold tracking-[-0.035em] text-ink-700">
            Track your permit
            <span class="block">like a <span class="bg-[linear-gradient(transparent_60%,#fde97a_60%,#fde97a_92%,transparent_92%)] px-1 -mx-1">package.</span></span>
          </h1>

          <p class="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
            Apply for city permits and licenses online, then follow every step &mdash; from submitted to approved &mdash; with an alert the moment anything moves.
          </p>

          <!-- Two equal buttons in one row. Phones use the nav's short labels so equal halves fit even
               at 320px; from sm up the grid shrinks to its content, so both match the wider label -->
          <div class="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3 sm:w-fit">
            <router-link to="/register"
              class="group inline-flex items-center justify-center gap-2 text-sm sm:text-[15px] font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 sm:px-6 py-3.5 rounded-2xl transition shadow-[0_16px_32px_-12px_rgba(31,122,58,0.7)] whitespace-nowrap">
              <span class="sm:hidden">Get started</span>
              <span class="hidden sm:inline">Start your application</span>
              <svg class="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </router-link>
            <router-link to="/login"
              class="inline-flex items-center justify-center text-sm sm:text-[15px] font-semibold text-ink-700 bg-white hover:bg-slate-50 ring-1 ring-slate-200 px-4 sm:px-6 py-3.5 rounded-2xl transition whitespace-nowrap">
              <span class="sm:hidden">Log in</span>
              <span class="hidden sm:inline">I already have an account</span>
            </router-link>
          </div>

          <ul class="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-slate-600">
            <li v-for="p in ['Real-time status', 'Email, SMS & in-app alerts', 'No trips to City Hall']" :key="p" class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
              {{ p }}
            </li>
          </ul>
        </div>

        <!-- Live tracker: the product, shown rather than described -->
        <div class="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Example of a permit being tracked" role="img">
          <!-- notification that pops on every stage change -->
          <transition mode="out-in"
            enter-from-class="opacity-0 -translate-y-2 scale-95" enter-active-class="transition duration-300 ease-out"
            leave-to-class="opacity-0 translate-y-1" leave-active-class="transition duration-200 ease-in">
            <div :key="stage" class="absolute -top-6 right-2 sm:-right-4 z-20 flex items-center gap-3 bg-white rounded-2xl pl-3 pr-4 py-2.5 shadow-[0_18px_40px_-14px_rgba(7,24,14,0.45)] ring-1 ring-black/5 max-w-[17rem]">
              <span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" :class="approved ? 'bg-brand-600 text-white' : 'bg-ink-700 text-sun-300'">
                <svg v-if="approved" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </span>
              <span class="min-w-0">
                <span class="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">PermitTrack · now</span>
                <span class="block text-sm font-semibold text-ink-700 truncate">{{ approved ? 'Approved! Your permit is ready' : 'Moved to ' + heroStages[stage].name }}</span>
              </span>
            </div>
          </transition>

          <div class="relative bg-white rounded-[28px] shadow-[0_40px_80px_-30px_rgba(16,48,29,0.45)] ring-1 ring-black/5 overflow-hidden">
            <div class="h-1.5 bg-brand-100" aria-hidden="true">
              <div class="h-full bg-brand-600 duration-700 ease-out" :class="instant ? 'transition-none' : 'transition-all'" :style="{ width: progress + '%' }"></div>
            </div>

            <div class="p-6 sm:p-7">
              <div class="flex items-start gap-3.5">
                <span class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="permitIconClass('Building/Renovation')">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-ink-700">Building/<wbr>Renovation Permit</div>
                  <div class="text-sm text-slate-500">12 Mabini St. · #BR-2026-0142</div>
                </div>
                <span class="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full duration-500"
                  :class="[approved ? 'bg-brand-100 text-brand-700' : 'bg-sun-100 text-sun-700', instant ? 'transition-none' : 'transition-colors']">{{ approved ? 'Approved' : 'In progress' }}</span>
              </div>

              <ol class="mt-7 relative transition-opacity duration-300" :class="[looping ? 'opacity-0' : 'opacity-100', instant ? '[&_*]:!transition-none' : '']">
                <li v-for="(s, i) in heroStages" :key="i" class="relative flex gap-4 pb-5 last:pb-0">
                  <!-- connector to the next stop -->
                  <span v-if="i < heroStages.length - 1" class="absolute left-[13px] top-7 bottom-0 w-0.5 rounded-full transition-colors duration-500"
                    :class="i < stage ? 'bg-brand-500' : 'bg-slate-200'" aria-hidden="true"></span>

                  <span class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500"
                    :class="{
                      'bg-brand-600 text-white': stageState(i) === 'done' || (stageState(i) === 'active' && approved),
                      'bg-sun-400 text-ink-700 ring-4 ring-sun-100': stageState(i) === 'active' && !approved,
                      'bg-white ring-2 ring-slate-200': stageState(i) === 'todo',
                    }">
                    <span v-if="stageState(i) === 'active' && !approved" class="absolute inset-0 rounded-full bg-sun-400 animate-ping opacity-40"></span>
                    <svg v-if="stageState(i) === 'done' || (stageState(i) === 'active' && approved)" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                    <span v-else-if="stageState(i) === 'active'" class="relative w-2 h-2 rounded-full bg-ink-700"></span>
                  </span>

                  <div class="min-w-0 flex-1 -mt-0.5">
                    <div class="flex items-baseline justify-between gap-3">
                      <span class="text-sm font-semibold transition-colors duration-500" :class="stageState(i) === 'todo' ? 'text-slate-400' : 'text-ink-700'">{{ s.name }}</span>
                      <span class="text-[11px] shrink-0 transition-colors duration-500" :class="stageState(i) === 'todo' ? 'text-slate-300' : 'text-slate-400'">
                        {{ stageState(i) === 'todo' ? 'Pending' : s.time }}
                      </span>
                    </div>
                    <p v-if="stageState(i) !== 'todo'" class="text-xs text-slate-500 mt-0.5">{{ s.note }}</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <!-- how you hear about it -->
          <div class="absolute -bottom-5 -left-3 sm:-left-6 z-20 hidden sm:flex items-center gap-2 bg-ink-700 text-white rounded-2xl px-4 py-2.5 shadow-[0_18px_40px_-14px_rgba(7,24,14,0.6)]">
            <span class="text-[11px] font-semibold text-ink-200">Alerts by</span>
            <span v-for="c in ['Email', 'SMS', 'In-app']" :key="c" class="text-[11px] font-bold text-ink-700 bg-sun-300 rounded-full px-2 py-0.5">{{ c }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ TAGLINE BAND ============ -->
    <section class="relative bg-ink-700 text-white overflow-hidden">
      <div class="pt-gradient-wide absolute inset-0 opacity-25" aria-hidden="true"></div>
      <div ref="statsBand" class="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center reveal">
        <h2 class="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05]">
          Stop calling City Hall.<br><span class="text-sun-300">Start tracking.</span>
        </h2>
        <dl class="grid grid-cols-3 gap-4 sm:gap-6">
          <div v-for="(f, i) in stats" :key="f.l" class="border-l border-white/15 pl-4">
            <dt class="text-4xl sm:text-5xl font-extrabold text-sun-300 tracking-tight tabular-nums">{{ statCounts[i] }}</dt>
            <dd class="text-xs sm:text-sm text-ink-200 mt-1 leading-snug">{{ f.l }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ============ HOW IT WORKS: THE ROUTE THROUGH THE OFFICES ============ -->
    <section id="how-it-works" class="scroll-mt-16 py-14 sm:py-20">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="max-w-2xl reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">How it works</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Every office.<br>Named as you pass it.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">
            A Building Permit, all six stops of it. Other permits are shorter — a Certificate of
            Residency is a single stop at your barangay.
          </p>
        </div>

        <ol class="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <li v-for="(s, i) in journey" :key="i" class="reveal" :style="{ transitionDelay: (i * 90) + 'ms' }">
            <div class="rounded-3xl bg-white ring-1 ring-brand-100 p-3 shadow-[0_18px_40px_-32px_rgba(16,48,29,0.5)] text-center">

              <!-- The office itself, drawn — the stop is recognised before a word is read -->
              <div class="relative">
                <div class="relative aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
                  :class="i === journey.length - 1 ? 'bg-sun-400 text-ink-700' : 'bg-ink-700 text-sun-300'" aria-hidden="true">
                  <span class="pt-gradient absolute -right-8 -bottom-8 w-28 h-28 rounded-full blur-2xl opacity-30"></span>

                  <svg class="relative w-3/5 h-3/5" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <template v-if="s.art === 'barangay'">
                      <path d="M7 21 24 10l17 11"/>
                      <path d="M11 21v19h26V21"/>
                      <path d="M5 40h38"/>
                      <path d="M20 40v-9a4 4 0 0 1 8 0v9"/>
                      <path d="M15 26h4M29 26h4"/>
                      <path d="M24 10V4"/>
                      <path d="M24 4h7l-1.8 2.4L31 9h-7z" fill="currentColor" stroke="none"/>
                    </template>
                    <template v-else-if="s.art === 'zoning'">
                      <rect x="6" y="10" width="36" height="28" rx="3"/>
                      <path d="M18 10v28M30 10v28M6 24h36"/>
                      <rect x="18" y="10" width="12" height="14" fill="currentColor" stroke="none" opacity=".25"/>
                      <path d="M24 22s3.2-3.4 3.2-5.6a3.2 3.2 0 0 0-6.4 0C20.8 18.6 24 22 24 22z"/>
                      <circle cx="24" cy="16.4" r="1.1" fill="currentColor" stroke="none"/>
                    </template>
                    <template v-else-if="s.art === 'plans'">
                      <rect x="6" y="7" width="27" height="33" rx="2.5"/>
                      <path d="M11 14h17M11 20h17M11 26h11"/>
                      <path d="M27 42 42 24v18z"/>
                    </template>
                    <template v-else-if="s.art === 'environment'">
                      <path d="M8 41h32"/>
                      <path d="M24 41v-9"/>
                      <path d="M24 32c-6 0-10-4-10-9s4-9 10-9 10 4 10 9-4 9-10 9z"/>
                      <path d="M24 32V18M24 25l-4-3M24 27l4-3"/>
                    </template>
                    <template v-else-if="s.art === 'tax'">
                      <path d="M11 6h26v36l-4.3-3-4.3 3-4.4-3-4.3 3-4.4-3L11 42z"/>
                      <path d="M17 14h14M17 20h14"/>
                      <text x="24" y="35" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" stroke="none">₱</text>
                    </template>
                    <template v-else>
                      <rect x="7" y="8" width="34" height="24" rx="2.5"/>
                      <path d="M13 16h14M13 22h10"/>
                      <circle cx="33" cy="31" r="6.5"/>
                      <path d="M30 36.5 29 45l4-2.6 4 2.6-1-8.5"/>
                      <path d="m30.6 31 1.9 1.9 3.4-3.4"/>
                    </template>
                  </svg>

                  <span class="absolute top-2 left-2 w-6 h-6 rounded-lg bg-white/15 text-[11px] font-extrabold flex items-center justify-center">{{ i + 1 }}</span>
                </div>

                <!-- the route carrying on to the next office -->
                <span v-if="i < journey.length - 1" class="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-[1.35rem] w-5 h-5 items-center justify-center text-brand-300" aria-hidden="true">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>
                </span>
              </div>

              <h3 class="mt-3 text-sm font-bold text-ink-700 leading-tight">{{ s.office }}</h3>
              <p class="mt-1 text-[11px] font-semibold text-brand-600 leading-tight">{{ s.step }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============ FEATURES ============ -->
    <section id="features" ref="features" class="scroll-mt-16 py-14 sm:py-20 bg-white border-y border-brand-100"
      :class="featMotion ? 'demo-live' : 'demo-still'">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="max-w-2xl reveal">
            <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Features</span>
            <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Everything about your permit.<br>One place.</h2>
            <p class="mt-4 text-lg text-slate-600 leading-relaxed">No more lost forms, missed calls, or “come back next week.” Here is what changes when your permit lives online.</p>
          </div>
          <!-- Off, every card holds a single still frame -->
          <button type="button" role="switch" :aria-checked="featMotion" @click="featMotion = !featMotion"
            class="inline-flex items-center gap-3 text-sm font-semibold text-ink-700 rounded-full bg-meadow/70 ring-1 ring-brand-100 pl-4 pr-1.5 py-1.5 hover:ring-brand-300 transition">
            Animations
            <span class="relative w-10 h-6 rounded-full transition-colors duration-200" :class="featMotion ? 'bg-brand-600' : 'bg-slate-300'" aria-hidden="true">
              <span class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200" :class="featMotion ? 'translate-x-4' : ''"></span>
            </span>
          </button>
        </div>

        <div class="mt-10 grid md:grid-cols-2 gap-5">
          <article v-for="(f, i) in features" :key="f.title"
            class="reveal group rounded-3xl bg-meadow/60 ring-1 ring-brand-100 overflow-hidden hover:bg-white hover:ring-brand-200 hover:shadow-[0_24px_50px_-28px_rgba(16,48,29,0.45)] hover:-translate-y-0.5 transition duration-300"
            :style="{ transitionDelay: (i % 2) * 80 + 'ms' }">

            <!-- A cropped glimpse of the real screen, deliberately clipped by the fixed height -->
            <div class="h-60 px-6 pt-6 overflow-hidden" aria-hidden="true">
              <div class="rounded-2xl bg-white ring-1 ring-brand-100 shadow-[0_18px_40px_-30px_rgba(16,48,29,0.6)] p-4">

                <template v-if="f.icon === 'timeline'">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-ink-700 truncate">Building/Renovation Permit</p>
                      <p class="text-[11px] text-slate-400 mt-0.5 truncate">12 Mabini St. · #BR-2026-0142</p>
                    </div>
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 transition-colors duration-500"
                      :class="timelineApproved ? 'bg-brand-100 text-brand-700' : 'bg-sun-100 text-sun-700'">{{ timelineApproved ? 'Approved' : 'In progress' }}</span>
                  </div>
                  <ol class="mt-4">
                    <li v-for="(s, k) in featTimeline" :key="s.name" class="relative flex gap-3" :class="k < featTimeline.length - 1 ? 'pb-4' : ''">
                      <span v-if="k < featTimeline.length - 1" class="absolute left-[5px] top-4 bottom-0 w-0.5 rounded-full transition-colors duration-500"
                        :class="k < timelineActive ? 'bg-brand-200' : 'bg-slate-200'"></span>
                      <span class="relative mt-1 w-3 h-3 rounded-full shrink-0 transition-colors duration-500"
                        :class="{ 'bg-brand-600': tlState(k) === 'done', 'bg-sun-400 ring-4 ring-sun-100': tlState(k) === 'active', 'bg-slate-200': tlState(k) === 'pending' }">
                        <span v-if="tlState(k) === 'active'" class="demo-ring absolute inset-0 rounded-full bg-sun-400"></span>
                      </span>
                      <div class="min-w-0 flex-1 flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="text-xs font-semibold truncate transition-colors duration-500" :class="tlState(k) === 'pending' ? 'text-slate-400' : 'text-ink-700'">{{ s.name }}</p>
                          <p v-if="tlState(k) !== 'pending'" class="text-[11px] text-slate-400 mt-0.5 truncate" :class="{ 'demo-in': featMotion }">{{ s.note }}</p>
                        </div>
                        <span class="text-[10px] shrink-0" :class="tlState(k) === 'pending' ? 'text-slate-300' : 'text-slate-400'">{{ tlState(k) === 'pending' ? 'Pending' : s.date }}</span>
                      </div>
                    </li>
                  </ol>
                </template>

                <template v-else-if="f.icon === 'bell'">
                  <transition-group tag="div" class="space-y-2.5" :css="featMotion"
                    enter-from-class="opacity-0 translate-x-10" enter-active-class="transition duration-500 ease-out"
                    leave-to-class="opacity-0" leave-active-class="transition duration-200">
                    <div v-for="(a, k) in visibleAlerts" :key="a.text"
                      class="flex items-center gap-3 rounded-xl bg-meadow/60 ring-1 p-2.5 transition-shadow duration-500"
                      :class="featMotion && k === visibleAlerts.length - 1 ? 'ring-brand-300 shadow-[0_10px_24px_-14px_rgba(16,48,29,0.55)]' : 'ring-brand-100'">
                      <span class="w-8 h-8 rounded-full bg-ink-700 text-sun-300 flex items-center justify-center shrink-0"
                        :class="{ 'demo-wiggle': featMotion && k === visibleAlerts.length - 1 }">
                        <svg v-if="a.icon === 'mail'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg>
                        <svg v-else-if="a.icon === 'phone'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>
                        <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      </span>
                      <div class="min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-brand-600">{{ a.channel }} · {{ a.date }}</p>
                        <p class="text-xs font-semibold text-ink-700 truncate">{{ a.text }}</p>
                      </div>
                    </div>
                  </transition-group>
                </template>

                <template v-else-if="f.icon === 'upload'">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Documents</p>
                  <div class="mt-3 space-y-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        </span>
                        <div class="min-w-0">
                          <p class="text-xs font-semibold text-ink-700 truncate">Site Plan.pdf</p>
                          <p class="text-[10px] text-brand-600 mt-0.5">Approved</p>
                        </div>
                      </div>
                      <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div>
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500"
                            :class="uploadFixed ? 'bg-brand-50 text-brand-600' : 'bg-rose-50 text-rose-500'">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                          </span>
                          <div class="min-w-0">
                            <p class="text-xs font-semibold text-ink-700 truncate">Floor Plan.pdf</p>
                            <p class="text-[10px] mt-0.5 transition-colors duration-500" :class="uploadFixed ? 'text-brand-600' : 'text-rose-500'">
                              {{ uploadPhase === 'done' ? 'Uploaded · in review' : uploadBusy ? 'Uploading…' : 'Needs changes' }}
                            </p>
                          </div>
                        </div>
                        <svg v-if="uploadPhase === 'done'" class="demo-in w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        <button v-else type="button" tabindex="-1" @click="fakeUpload"
                          class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-600 text-white shrink-0 transition duration-200 hover:bg-brand-700 active:scale-95 disabled:opacity-60"
                          :class="uploadPhase === 'press' ? 'scale-90 ring-4 ring-brand-200' : ''"
                          :disabled="uploadBusy">Replace</button>
                      </div>
                      <div v-if="uploadBusy" class="mt-2 h-1 rounded-full bg-brand-100 overflow-hidden">
                        <div v-if="uploadPhase === 'click'" class="demo-bar h-full w-1/3 rounded-full bg-brand-600"></div>
                        <div v-else class="h-full rounded-full bg-brand-600 transition-[width] duration-1000 ease-out"
                          :style="{ width: uploadPhase === 'up2' ? '100%' : '40%' }"></div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        </span>
                        <div class="min-w-0">
                          <p class="text-xs font-semibold text-ink-700 truncate">Proof of Insurance.pdf</p>
                          <p class="text-[10px] text-slate-400 mt-0.5">In review</p>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        </span>
                        <div class="min-w-0">
                          <p class="text-xs font-semibold text-ink-700 truncate">Contractor License.pdf</p>
                          <p class="text-[10px] text-brand-600 mt-0.5">Approved</p>
                        </div>
                      </div>
                      <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                  </div>
                </template>

                <template v-else-if="f.icon === 'chat'">
                  <p class="text-[11px] font-bold text-slate-400">Engr. Cruz · Building Official</p>
                  <transition-group tag="div" class="mt-3 space-y-2" :css="featMotion"
                    enter-from-class="opacity-0 translate-y-2" enter-active-class="transition duration-300 ease-out"
                    leave-to-class="opacity-0" leave-active-class="transition duration-150">
                    <div v-for="m in chatItems" :key="m.id" :class="m.from === 'me' ? 'flex justify-end' : ''">
                      <div v-if="m.id === 'typing'" class="flex items-center gap-1 bg-meadow rounded-2xl rounded-bl-sm px-3 py-3 w-fit">
                        <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700"></span>
                        <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700" style="animation-delay:.15s"></span>
                        <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700" style="animation-delay:.3s"></span>
                      </div>
                      <p v-else class="text-xs rounded-2xl px-3 py-2 w-fit max-w-[88%]"
                        :class="m.from === 'me' ? 'bg-ink-700 text-white rounded-br-sm' : 'bg-meadow text-ink-700 rounded-bl-sm'">{{ m.text }}</p>
                    </div>
                  </transition-group>
                </template>

                <template v-else-if="f.icon === 'list'">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 flex items-center gap-2 rounded-lg bg-white ring-2 ring-brand-500 px-2.5 py-1.5 min-w-0">
                      <svg class="w-3.5 h-3.5 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                      <template v-if="listQuery">
                        <span class="text-[11px] text-ink-700 truncate">{{ listQuery }}</span>
                        <span class="demo-caret w-px h-3 bg-brand-600 shrink-0 -ml-1"></span>
                      </template>
                      <template v-else>
                        <span class="demo-caret w-px h-3 bg-brand-600 shrink-0"></span>
                        <span class="text-[11px] text-slate-400 truncate -ml-1">Search by address</span>
                      </template>
                    </div>
                    <span class="text-[11px] font-semibold text-ink-700 ring-1 ring-brand-100 rounded-lg px-2.5 py-1.5 shrink-0">All</span>
                  </div>
                  <transition-group tag="div" class="mt-3 space-y-3" :css="featMotion"
                    enter-from-class="opacity-0 -translate-y-1" enter-active-class="transition duration-300 ease-out"
                    leave-to-class="opacity-0" leave-active-class="transition duration-200">
                    <div v-for="r in listRows" :key="r.name" class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold truncate" :class="r.status === 'Draft' ? 'text-slate-400' : 'text-ink-700'">{{ r.name }}</p>
                        <p class="text-[10px] mt-0.5 truncate" :class="r.status === 'Draft' ? 'text-slate-300' : 'text-slate-400'"><template
                          v-for="(part, pi) in searchParts(r.address)" :key="pi"><mark v-if="part.hit"
                          class="bg-sun-200 text-ink-700 rounded-sm">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></p>
                      </div>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="statusPill(r.status)">{{ r.status }}</span>
                    </div>
                  </transition-group>
                </template>

                <div v-else :key="askLoop">
                  <p class="text-xs bg-ink-700 text-white rounded-2xl rounded-br-sm px-3 py-2 w-fit max-w-[85%] ml-auto" :class="{ 'demo-in': featMotion }">What do I need for a Sign Permit?</p>
                  <div v-if="askFrame >= 1" class="mt-3 flex items-start gap-2.5" :class="{ 'demo-in': featMotion }">
                    <span class="w-7 h-7 rounded-full bg-sun-300 text-ink-700 flex items-center justify-center shrink-0">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                    </span>
                    <div v-if="askFrame === 1" class="flex items-center gap-1 bg-meadow rounded-2xl rounded-bl-sm px-3 py-3 w-fit">
                      <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700"></span>
                      <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700" style="animation-delay:.15s"></span>
                      <span class="demo-dot w-1.5 h-1.5 rounded-full bg-ink-700" style="animation-delay:.3s"></span>
                    </div>
                    <div v-else class="min-w-0">
                      <p class="text-xs text-slate-600 leading-relaxed" :class="{ 'demo-in': featMotion }">Two documents, and you already have one on file:</p>
                      <ul class="mt-2 space-y-1.5">
                        <li v-if="askFrame >= 3" class="flex items-start gap-2 text-xs text-ink-700" :class="{ 'demo-in': featMotion }">
                          <svg class="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Sign Drawing / Rendering
                        </li>
                        <li v-if="askFrame >= 4" class="flex items-start gap-2 text-xs text-ink-700" :class="{ 'demo-in': featMotion }">
                          <svg class="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Property Owner Authorization
                        </li>
                      </ul>
                      <p v-if="askFrame >= 5" class="mt-2 text-[11px] text-slate-400 leading-relaxed" :class="{ 'demo-in': featMotion }">Both can be uploaded from your permit page.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div class="px-7 pb-7 pt-5 text-center">
              <h3 class="text-lg font-bold text-ink-700">{{ f.title }}</h3>
              <p class="mt-2 text-[15px] text-slate-600 leading-relaxed">{{ f.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ============ PERMITS ============ -->
    <section id="permits" class="scroll-mt-16 py-14 sm:py-20">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="flex flex-wrap items-end justify-between gap-6 reveal">
          <div class="max-w-2xl">
            <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Permits</span>
            <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Know what to bring.<br>Before you go anywhere.</h2>
            <p class="mt-4 text-lg text-slate-600 leading-relaxed">Every permit lists its requirements up front, so there are no surprises and no second trips.</p>
          </div>
          <div class="flex items-center gap-4 text-sm text-slate-600">
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-brand-500"></span>Residents</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sun-400"></span>Businesses</span>
          </div>
        </div>

        <div class="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <article v-for="(p, i) in permits" :key="p.type"
            class="reveal flex flex-col rounded-3xl bg-white ring-1 ring-brand-100 p-7 shadow-[0_18px_40px_-32px_rgba(16,48,29,0.5)]"
            :style="{ transitionDelay: (i % 3) * 80 + 'ms' }">
            <div class="flex items-start justify-between gap-3">
              <span class="w-12 h-12 rounded-2xl flex items-center justify-center" :class="permitIconClass(p.type)">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </span>
              <div class="flex gap-1.5">
                <span v-if="p.residents" class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">Residents</span>
                <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sun-50 text-sun-700 ring-1 ring-inset ring-sun-200">Businesses</span>
              </div>
            </div>
            <h3 class="mt-5 text-xl font-bold text-ink-700">{{ p.type }}</h3>
            <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">{{ p.blurb }}</p>
            <div class="mt-5 pt-5 border-t border-slate-100">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">You'll need</div>
              <ul class="space-y-2">
                <li v-for="d in p.docs" :key="d" class="flex items-start gap-2.5 text-sm text-slate-700">
                  <svg class="w-4 h-4 text-brand-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  {{ d }}
                </li>
              </ul>
            </div>
          </article>

          <!-- sixth tile keeps the grid whole and points to the next step -->
          <div class="reveal flex flex-col justify-between rounded-3xl bg-ink-700 text-white p-7 relative overflow-hidden" style="transition-delay: 160ms">
            <div class="pt-gradient absolute -right-24 -bottom-24 w-72 h-72 rounded-full blur-2xl opacity-40" aria-hidden="true"></div>
            <div class="relative">
              <h3 class="text-2xl font-extrabold tracking-tight leading-tight">Not sure which one you need?</h3>
              <p class="mt-3 text-sm text-ink-200 leading-relaxed">Create a free account to browse every permit in detail, or ask the built-in assistant.</p>
            </div>
            <router-link to="/register" class="relative mt-8 self-start inline-flex items-center gap-2 text-sm font-semibold text-ink-700 bg-sun-300 hover:bg-sun-200 px-5 py-2.5 rounded-xl transition">
              Browse all permits
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ GET STARTED ============ -->
    <section ref="steps" class="py-14 sm:py-20 bg-white border-y border-brand-100"
      :class="stepsMotion ? 'demo-live' : 'demo-still'">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="text-center max-w-2xl mx-auto reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Get started</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Verify once.<br>Apply anytime.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">Three steps stand between you and your first tracked permit.</p>
        </div>
        <!-- Off, every step holds a single still frame -->
        <div class="mt-6 flex justify-center">
          <button type="button" role="switch" :aria-checked="stepsMotion" @click="stepsMotion = !stepsMotion"
            class="inline-flex items-center gap-3 text-sm font-semibold text-ink-700 rounded-full bg-meadow/70 ring-1 ring-brand-100 pl-4 pr-1.5 py-1.5 hover:ring-brand-300 transition">
            Animations
            <span class="relative w-10 h-6 rounded-full transition-colors duration-200" :class="stepsMotion ? 'bg-brand-600' : 'bg-slate-300'" aria-hidden="true">
              <span class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200" :class="stepsMotion ? 'translate-x-4' : ''"></span>
            </span>
          </button>
        </div>

        <div class="mt-10 grid md:grid-cols-3 gap-5">
          <div v-for="(s, i) in [
              { t: 'Create your account', d: 'Sign up with your email or mobile number and confirm it with a 6-digit code.' },
              { t: 'Verify who you are', d: 'Residents upload two proofs of residence. Business owners register their business. City Staff approve it once.' },
              { t: 'Apply and track', d: 'Pick a permit, upload the listed documents, and follow it from one office to the next.' },
            ]" :key="s.t" class="reveal relative rounded-3xl ring-1 ring-brand-100 bg-meadow/60 p-7" :style="{ transitionDelay: (i * 90) + 'ms' }">
            <span class="text-6xl font-extrabold tracking-tighter text-brand-200 leading-none">0{{ i + 1 }}</span>
            <h3 class="mt-4 text-lg font-bold text-ink-700">{{ s.t }}</h3>
            <p class="mt-2 text-[15px] text-slate-600 leading-relaxed">{{ s.d }}</p>

            <!-- The actual screen this step lands on: same fields, same wording as the real form -->
            <div class="mt-5 rounded-2xl bg-white ring-1 ring-brand-100 p-4" aria-hidden="true">

              <template v-if="i === 0">
                <div class="flex gap-1 p-1 rounded-xl bg-meadow/70 ring-1 ring-brand-100">
                  <button type="button" tabindex="-1" @click="demo.contact = 'email'"
                    class="flex-1 text-center text-[11px] py-1.5 rounded-lg transition"
                    :class="demo.contact === 'email' ? 'font-bold bg-white text-ink-700 shadow-sm' : 'font-semibold text-slate-400 hover:text-slate-600'">Email</button>
                  <button type="button" tabindex="-1" @click="demo.contact = 'phone'"
                    class="flex-1 text-center text-[11px] py-1.5 rounded-lg transition"
                    :class="demo.contact === 'phone' ? 'font-bold bg-white text-ink-700 shadow-sm' : 'font-semibold text-slate-400 hover:text-slate-600'">Mobile number</button>
                </div>
                <p class="mt-3 text-[11px] font-semibold text-slate-500">{{ demo.contact === 'email' ? 'Email address' : 'Mobile number' }}</p>
                <div class="mt-1 flex items-center rounded-lg px-2.5 py-2 text-xs text-ink-700 transition"
                  :class="acctTyping ? 'ring-2 ring-brand-500' : 'ring-1 ring-brand-100'">
                  <span class="truncate">{{ acctTyped }}</span>
                  <span v-if="acctFrame === null || acctTyping" class="demo-caret w-px h-3.5 bg-brand-600 shrink-0 ml-0.5"></span>
                </div>
                <p class="mt-3 text-[11px] font-semibold text-slate-500">Verification code</p>
                <div class="mt-1.5 flex gap-1.5">
                  <span v-for="(digit, j) in stepsCode" :key="j"
                    class="flex-1 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors duration-300"
                    :class="acctVerified ? 'ring-1 ring-brand-500 bg-brand-50 text-brand-700'
                      : j < acctDigits ? 'ring-1 ring-brand-200 bg-meadow/50 text-ink-700'
                      : j === acctDigits && acctCodeSent ? 'ring-2 ring-brand-500'
                      : 'ring-1 ring-brand-100'">
                    <span v-if="j < acctDigits || acctVerified" :class="{ 'demo-in': stepsMotion }">{{ digit }}</span>
                    <span v-else-if="j === acctDigits && acctCodeSent" class="demo-caret w-px h-4 bg-brand-500"></span>
                  </span>
                </div>
                <p v-if="acctVerified" class="mt-2 text-[10px] font-semibold text-brand-600 truncate demo-in">Verified — welcome to PermitTrack</p>
                <p v-else-if="acctCodeSent" class="mt-2 text-[10px] text-slate-400 truncate" :class="{ 'demo-in': stepsMotion }">Code sent to {{ acctContact }}</p>
                <p v-else class="mt-2 text-[10px] text-slate-400 truncate">We'll send you a 6-digit code</p>
              </template>

              <template v-else-if="i === 1">
                <template v-for="slot in [0, 1]" :key="slot">
                  <p class="text-[11px] font-semibold text-slate-500" :class="slot === 1 ? 'mt-3' : ''">Proof {{ slot + 1 }} of 2</p>
                  <div class="relative mt-1">
                    <button type="button" tabindex="-1" @click="toggleDemo('proof' + slot)"
                      class="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition"
                      :class="proofMenuOpen(slot) ? 'ring-2 ring-brand-500' : 'ring-1 ring-brand-100 hover:ring-brand-300'">
                      <span class="text-xs truncate" :class="proofPicked(slot) ? 'text-ink-700' : 'text-slate-400'">{{ proofPicked(slot) ? demo.proofs[slot] : 'Choose a document…' }}</span>
                      <svg class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform" :class="proofMenuOpen(slot) ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div v-if="proofMenuOpen(slot)" class="absolute z-20 inset-x-0 mt-1 rounded-xl bg-white ring-1 ring-brand-200 shadow-[0_18px_40px_-20px_rgba(16,48,29,0.45)] py-1"
                      :class="{ 'demo-in': stepsMotion }">
                      <button v-for="o in proofOptions" :key="o" type="button" tabindex="-1" @click="pickProof(slot, o)"
                        class="w-full text-left text-[11px] px-2.5 py-1.5 truncate transition hover:bg-meadow/70"
                        :class="o === demo.proofs[slot] ? 'font-semibold text-brand-700 bg-meadow/60' : 'text-slate-600'">{{ o }}</button>
                    </div>
                  </div>
                  <div class="mt-1.5 min-h-4 flex items-center gap-2">
                    <template v-if="proofFile(slot)">
                      <svg class="w-3.5 h-3.5 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      <span class="text-[11px] text-slate-500 truncate" :class="{ 'demo-in': stepsMotion }">{{ stepsFiles[slot] }}</span>
                      <span v-if="proofFile(slot) === 'up'" class="ml-auto w-12 h-1 rounded-full bg-brand-100 overflow-hidden shrink-0">
                        <span class="demo-bar block h-full w-1/2 rounded-full bg-brand-600"></span>
                      </span>
                      <svg v-else class="w-3.5 h-3.5 text-brand-600 shrink-0 ml-auto" :class="{ 'demo-in': stepsMotion }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </template>
                  </div>
                </template>

                <div class="mt-3 pt-3 border-t border-slate-100 min-h-[2.1rem]">
                  <span v-if="proofStatus === 'approved'" class="demo-in inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-brand-100 text-brand-700">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    Approved — you're a Resident
                  </span>
                  <span v-else-if="proofStatus === 'waiting'" class="text-[10px] font-bold px-2 py-1 rounded-full bg-sun-100 text-sun-700" :class="{ 'demo-in': stepsMotion }">Waiting for City Staff review</span>
                </div>
              </template>

              <template v-else>
                <p class="text-[11px] font-semibold text-slate-500">Permit type</p>
                <div class="relative mt-1">
                  <button type="button" tabindex="-1" @click="toggleDemo('permit')"
                    class="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition"
                    :class="applyMenuOpen ? 'ring-2 ring-brand-500' : 'ring-1 ring-brand-100 hover:ring-brand-300'">
                    <span class="text-xs font-semibold truncate" :class="applyPicked ? 'text-ink-700' : 'text-slate-400'">{{ applyPicked ? permits[demo.permit].type : 'Choose a permit…' }}</span>
                    <svg class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform" :class="applyMenuOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div v-if="applyMenuOpen" class="absolute z-20 inset-x-0 mt-1 rounded-xl bg-white ring-1 ring-brand-200 shadow-[0_18px_40px_-20px_rgba(16,48,29,0.45)] py-1"
                    :class="{ 'demo-in': stepsMotion }">
                    <button v-for="(p, k) in permits" :key="p.type" type="button" tabindex="-1" @click="pickPermit(k)"
                      class="w-full text-left text-[11px] px-2.5 py-1.5 truncate transition hover:bg-meadow/70"
                      :class="k === demo.permit ? 'font-semibold text-brand-700 bg-meadow/60' : 'text-slate-600'">{{ p.type }}</button>
                  </div>
                </div>
                <p class="mt-3 text-[11px] font-semibold text-slate-500">Required documents</p>
                <ul class="mt-1.5 space-y-1.5">
                  <li v-for="(d, k) in permits[demo.permit].docs" :key="d"
                    class="flex items-center gap-2 text-[11px] transition-colors duration-300"
                    :class="[k < applyChecked ? 'text-ink-700' : 'text-slate-400', applyPicked ? '' : 'invisible']">
                    <svg v-if="k < applyChecked" class="w-3.5 h-3.5 text-brand-600 shrink-0" :class="{ 'demo-in': stepsMotion }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <span v-else class="w-3.5 h-3.5 rounded-full ring-1 ring-slate-300 shrink-0"></span>
                    {{ d }}
                  </li>
                </ul>
                <div class="mt-3 pt-3 border-t border-slate-100 min-h-7 flex items-center gap-1.5">
                  <template v-if="applyStop">
                    <template v-for="i in 4" :key="i">
                      <span class="rounded-full shrink-0 transition-colors duration-500"
                        :class="{ 'w-2 h-2 bg-brand-600': stopState(i - 1) === 'done', 'w-2.5 h-2.5 bg-sun-400 ring-2 ring-sun-100': stopState(i - 1) === 'active', 'w-2 h-2 bg-slate-200': stopState(i - 1) === 'pending' }"></span>
                      <span v-if="i < 4" class="flex-1 h-0.5 rounded transition-colors duration-500" :class="i - 1 < applyStop - 1 ? 'bg-brand-200' : 'bg-slate-200'"></span>
                    </template>
                    <span class="ml-1.5 text-[10px] font-bold text-sun-700 shrink-0">Stop {{ applyStop }} of 6</span>
                  </template>
                  <span v-else class="text-[10px] font-semibold text-slate-400">Not filed yet</span>
                </div>
              </template>

            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FAQ ============ -->
    <section id="faq" class="scroll-mt-16 py-14 sm:py-20">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-16">
        <div class="reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">FAQ</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Questions, answered.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">Still wondering? Once you're signed in, the <span class="font-semibold text-ink-700">Ask</span> button answers questions about any permit, any time.</p>
        </div>
        <div class="divide-y divide-brand-100 border-y border-brand-100 reveal">
          <div v-for="(f, i) in faqs" :key="f.q">
            <h3>
              <button type="button" @click="toggleFaq(i)" :aria-expanded="isFaqOpen(i)" :aria-controls="'faq-' + i"
                class="w-full flex items-center justify-between gap-4 py-5 text-left group">
                <span class="text-base sm:text-lg font-semibold text-ink-700 group-hover:text-brand-700 transition">{{ f.q }}</span>
                <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition"
                  :class="isFaqOpen(i) ? 'bg-ink-700 text-sun-300 rotate-45' : 'bg-white ring-1 ring-brand-200 text-ink-700'">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </button>
            </h3>
            <!-- The answer animates its own height, so everything below it — the closing banner
                 especially — glides to its new place instead of jumping. -->
            <transition :css="false" @enter="faqEnter" @leave="faqLeave">
              <div v-show="isFaqOpen(i)" :id="'faq-' + i">
                <p class="pb-5 pr-12 text-[15px] text-slate-600 leading-relaxed">
                  {{ f.a }}
                  <router-link v-if="i === faqs.length - 1" to="/staff/login" class="font-semibold text-brand-700 hover:underline ml-1">Go to the Staff Portal →</router-link>
                </p>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FINAL CTA ============ -->
    <section class="px-4 sm:px-6 pb-14 sm:pb-20">
      <div class="reveal relative max-w-6xl mx-auto overflow-hidden rounded-[32px] pt-gradient-wide px-7 sm:px-14 py-12 sm:py-16 shadow-[0_40px_90px_-40px_rgba(31,122,58,0.8)]">
        <div class="relative max-w-2xl">
          <p class="text-sm font-semibold text-white/85">Your permit, always in sight.</p>
          <h2 class="mt-3 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] text-white leading-[0.98]">
            Online,<br><span class="text-sun-300">not in line.</span>
          </h2>
          <p class="mt-6 text-lg text-white/85 leading-relaxed max-w-lg">Apply from home, track every step, and hear the moment your permit moves.</p>
          <div class="mt-9 flex flex-wrap gap-3">
            <router-link to="/register"
              class="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-700 bg-sun-300 hover:bg-sun-200 px-6 py-3.5 rounded-2xl transition shadow-[0_16px_32px_-12px_rgba(0,0,0,0.45)]">
              Create your account
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </router-link>
            <router-link to="/login" class="inline-flex items-center text-[15px] font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 px-6 py-3.5 rounded-2xl transition">Log in</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FOOTER ============ -->
    <footer class="bg-ink-700 text-ink-200">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr] gap-10">
        <div>
          <div class="flex items-center gap-2.5">
            <img src="assets/images/PermitTrackIcon.png?v=115" alt="" class="w-9 h-9 object-contain" />
            <span class="leading-tight">
              <span class="block text-[15px] font-bold text-white">PermitTrack</span>
              <span class="block text-[11px] text-ink-300">City of Dasmariñas</span>
            </span>
          </div>
          <p class="mt-5 text-lg font-semibold text-white max-w-xs leading-snug">Track your permit like a package.</p>
        </div>
        <div>
          <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-ink-300">Explore</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li v-for="l in navLinks" :key="l.id"><button type="button" @click="go(l.id)" class="hover:text-white transition">{{ l.label }}</button></li>
          </ul>
        </div>
        <div>
          <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-ink-300">Account</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><router-link to="/register" class="hover:text-white transition">Create an account</router-link></li>
            <li><router-link to="/login" class="hover:text-white transition">Log in</router-link></li>
            <li><router-link to="/staff/login" class="hover:text-white transition">Staff Portal</router-link></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <!-- Text stays left, and phones get extra room below it: at the very bottom of the page the
             floating "Back to top" rests in the bottom-right corner, and nothing should hide behind it -->
        <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 sm:pb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-300">
          <span>© {{ year }} City of Dasmariñas · PermitTrack</span>
          <span class="text-sun-300 font-semibold">Online, not in line.</span>
        </div>
      </div>
    </footer>

    <!-- Floating "Back to top": rises into view past the hero, hidden while the mobile menu is open -->
    <transition
      enter-from-class="opacity-0 translate-y-6" enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-y-6" leave-active-class="transition duration-200 ease-in motion-reduce:transition-none">
      <button v-if="showFloatingTop && !menuOpen" type="button" @click="toTop" aria-label="Back to top"
        class="group fixed right-4 sm:right-6 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 z-30 inline-flex items-center gap-2.5 bg-ink-700 text-white text-sm font-semibold pl-2 pr-4 sm:pr-5 py-2 rounded-full ring-1 ring-white/10 shadow-[0_18px_40px_-14px_rgba(7,24,14,0.7)] hover:bg-ink-600 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-sun-300/50 transition">
        <span class="w-8 h-8 rounded-full bg-sun-300 text-ink-700 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
        </span>
        Back to top
      </button>
    </transition>

    <ChatWidget :lift-for-fab="showFloatingTop && !menuOpen" />
  </div>
  `,
};

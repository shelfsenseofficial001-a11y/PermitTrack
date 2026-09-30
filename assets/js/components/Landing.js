import { permitIconClass } from '../util.js?v=67';
import ChatWidget from './ChatWidget.js?v=67';

// The public front door. Everything on it describes what PermitTrack really does — the five
// stages, the five permit types and their actual requirements — so nothing here over-promises.

// The hero tracker walks through these, like a courier app following a parcel
const HERO_STAGES = [
  { name: 'Submitted', time: 'Sep 2 · 9:14 AM', note: 'Application and 4 documents received' },
  { name: 'Under Review', time: 'Sep 4 · 2:30 PM', note: 'City Staff verified your documents' },
  { name: 'Inspection Scheduled', time: 'Sep 9 · 10:00 AM', note: 'Site visit set for Sep 16, 10:00 AM' },
  { name: 'Inspector Notes', time: 'Sep 16 · 3:45 PM', note: 'Passed, with minor notes attached' },
  { name: 'Approved', time: 'Sep 18 · 11:20 AM', note: 'Your permit is ready' },
];

const STAGES = [
  { name: 'Submitted', text: 'Your application and documents land with the right city department.' },
  { name: 'Under Review', text: 'City Staff check every document. Anything off gets flagged, with a note.' },
  { name: 'Inspection Scheduled', text: 'Your inspection date is set, and you know exactly when.' },
  { name: 'Inspector Notes', text: 'The inspector’s findings, in writing, right on your permit.' },
  { name: 'Approved', text: 'Done. Approved, without a single trip to the counter.' },
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
    a: 'Anyone can create an account and browse every permit and its requirements. To apply, verify as a Resident (two proofs of residence, reviewed by City Staff) or register your business, which City Staff approves.' },
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
      stages: STAGES,
      permits: PERMITS,
      features: FEATURES,
      faqs: FAQS,
      year: new Date().getFullYear(),
    };
  },
  computed: {
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
      if (e.key === 'Escape' && this.menuOpen) {
        this.closeMenu();
        const toggle = this.$refs.header && this.$refs.header.querySelector('[aria-controls="mobile-menu"]');
        if (toggle) toggle.focus();
      }
    };
    this.onResize = () => { if (window.innerWidth >= 768) this.closeMenu(); };
    document.addEventListener('keydown', this.onKey);
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
    } else {
      this.$el.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    }
  },
  beforeUnmount() {
    document.title = this.previousTitle;
    clearTimeout(this.timer);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    if (this.observer) this.observer.disconnect();
  },
  methods: {
    permitIconClass,
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
          <img src="assets/images/PermitTrackIcon.png?v=67" alt="" class="w-9 h-9 object-contain" />
          <span class="leading-tight text-left">
            <span class="block text-[15px] font-bold text-ink-700">PermitTrack</span>
            <span class="block text-[11px] text-slate-500">City of Dasmariñas</span>
          </span>
        </button>
        <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Page sections">
          <button v-for="l in navLinks" :key="l.id" type="button" @click="go(l.id)" class="hover:text-ink-700 transition">{{ l.label }}</button>
        </nav>
        <div class="flex items-center gap-2 shrink-0">
          <!-- On phones, Log in moves into the menu so the main action and the toggle fit -->
          <router-link to="/login" class="hidden md:inline-flex text-sm font-semibold text-ink-700 px-4 py-2 rounded-xl hover:bg-ink-700/5 transition">Log in</router-link>
          <router-link to="/register" class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">Get started</router-link>
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
            <div class="border-t border-brand-100 bg-slate-50/70 p-4 grid grid-cols-2 gap-2.5">
              <router-link to="/login" class="text-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 py-3 rounded-xl transition">Log in</router-link>
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
                <li v-for="(s, i) in heroStages" :key="s.name" class="relative flex gap-4 pb-5 last:pb-0">
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
      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center reveal">
        <h2 class="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05]">
          Stop calling City Hall.<br><span class="text-sun-300">Start tracking.</span>
        </h2>
        <dl class="grid grid-cols-3 gap-4 sm:gap-6">
          <div v-for="f in [{ n: '5', l: 'permit types, one account' }, { n: '5', l: 'clear stages, always visible' }, { n: '3', l: 'ways to hear it moved' }]" :key="f.l"
            class="border-l border-white/15 pl-4">
            <dt class="text-4xl sm:text-5xl font-extrabold text-sun-300 tracking-tight">{{ f.n }}</dt>
            <dd class="text-xs sm:text-sm text-ink-200 mt-1 leading-snug">{{ f.l }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ============ HOW IT WORKS: THE FIVE STAGES ============ -->
    <section id="how-it-works" class="scroll-mt-16 py-14 sm:py-20">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="max-w-2xl reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">How it works</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Five stages.<br>Zero guesswork.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">Every permit travels the same five stops. You see each one the moment it happens, just like a parcel on its way to your door.</p>
        </div>

        <ol class="mt-10 grid md:grid-cols-5 gap-4 md:gap-3 relative">
          <!-- the route line behind the stops -->
          <span class="hidden md:block absolute top-7 left-[10%] right-[10%] h-0.5 bg-[linear-gradient(90deg,#1f7a3a,#8fcb7b,#f7cf1b)] rounded-full" aria-hidden="true"></span>
          <li v-for="(s, i) in stages" :key="s.name" class="relative reveal" :style="{ transitionDelay: (i * 90) + 'ms' }">
            <div class="flex md:flex-col items-start md:items-center gap-4 md:gap-0 md:text-center">
              <span class="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_10px_24px_-10px_rgba(16,48,29,0.5)] ring-4 ring-meadow"
                :class="i === stages.length - 1 ? 'bg-sun-400 text-ink-700' : 'bg-ink-700 text-sun-300'">
                <svg v-if="i === 0" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                <svg v-else-if="i === 1" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="m8.5 11 1.8 1.8 3.2-3.3"/></svg>
                <svg v-else-if="i === 2" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>
                <svg v-else-if="i === 3" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 15 5h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z"/><path d="m9 12 2 2 4-4"/></svg>
              </span>
              <div class="md:mt-5">
                <div class="text-xs font-bold text-brand-600">Stage {{ i + 1 }}</div>
                <h3 class="mt-0.5 font-bold text-ink-700">{{ s.name }}</h3>
                <p class="mt-1.5 text-sm text-slate-500 leading-relaxed md:px-1">{{ s.text }}</p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============ FEATURES ============ -->
    <section id="features" class="scroll-mt-16 py-14 sm:py-20 bg-white border-y border-brand-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="max-w-2xl reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Features</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Everything about your permit.<br>One place.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">No more lost forms, missed calls, or “come back next week.” Here is what changes when your permit lives online.</p>
        </div>

        <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="(f, i) in features" :key="f.title"
            class="reveal group rounded-3xl bg-meadow/60 ring-1 ring-brand-100 p-7 hover:bg-white hover:ring-brand-200 hover:shadow-[0_24px_50px_-28px_rgba(16,48,29,0.45)] hover:-translate-y-0.5 transition duration-300"
            :style="{ transitionDelay: (i % 3) * 80 + 'ms' }">
            <span class="w-12 h-12 rounded-2xl bg-ink-700 text-sun-300 flex items-center justify-center shadow-sm">
              <svg v-if="f.icon === 'timeline'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M5 8v8"/><path d="M11 6h9M11 18h9M11 12h6"/></svg>
              <svg v-else-if="f.icon === 'bell'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <svg v-else-if="f.icon === 'upload'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              <svg v-else-if="f.icon === 'chat'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>
              <svg v-else-if="f.icon === 'list'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/></svg>
            </span>
            <h3 class="mt-5 text-lg font-bold text-ink-700">{{ f.title }}</h3>
            <p class="mt-2 text-[15px] text-slate-600 leading-relaxed">{{ f.text }}</p>
          </div>
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
    <section class="py-14 sm:py-20 bg-white border-y border-brand-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="text-center max-w-2xl mx-auto reveal">
          <span class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Get started</span>
          <h2 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">Verify once.<br>Apply anytime.</h2>
          <p class="mt-4 text-lg text-slate-600 leading-relaxed">Three steps stand between you and your first tracked permit.</p>
        </div>

        <div class="mt-10 grid md:grid-cols-3 gap-5">
          <div v-for="(s, i) in [
              { t: 'Create your account', d: 'Sign up with your email or mobile number and confirm it with a 6-digit code.' },
              { t: 'Verify who you are', d: 'Residents upload two proofs of residence. Business owners register their business. City Staff approve it once.' },
              { t: 'Apply and track', d: 'Pick a permit, upload the listed documents, and follow it through all five stages.' },
            ]" :key="s.t" class="reveal relative rounded-3xl ring-1 ring-brand-100 bg-meadow/60 p-7" :style="{ transitionDelay: (i * 90) + 'ms' }">
            <span class="text-6xl font-extrabold tracking-tighter text-brand-200 leading-none">0{{ i + 1 }}</span>
            <h3 class="mt-4 text-lg font-bold text-ink-700">{{ s.t }}</h3>
            <p class="mt-2 text-[15px] text-slate-600 leading-relaxed">{{ s.d }}</p>
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
            <img src="assets/images/PermitTrackIcon.png?v=67" alt="" class="w-9 h-9 object-contain" />
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

    <ChatWidget />
  </div>
  `,
};

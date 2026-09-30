const KEY = 'permittrack.cookieNotice';

// PermitTrack sets exactly one cookie: PHP's own session cookie, which is what keeps you
// signed in. There is no analytics, no advertising and no third-party tracking in the app —
// so this is a plain notice with one acknowledge button, not a consent chooser. Offering an
// "reject" toggle here would be theatre: refusing the session cookie would just mean you
// could not stay signed in. If tracking is ever added, this needs to become a real chooser.
export default {
  name: 'CookieBanner',
  data() {
    return { open: false, details: false };
  },
  mounted() {
    let seen = null;
    try { seen = localStorage.getItem(KEY); } catch (e) { seen = 'skip'; } // private mode
    if (seen) return;
    // A beat before it slides up, so it doesn't fight with the page appearing
    this.timer = setTimeout(() => { this.open = true; }, 900);
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    accept() {
      this.open = false;
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch (e) { /* nothing to do */ }
    },
  },
  template: `
  <transition
    enter-from-class="opacity-0 translate-y-4" enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
    leave-to-class="opacity-0 translate-y-4" leave-active-class="transition duration-200 ease-in motion-reduce:transition-none">
    <div v-if="open" role="region" aria-label="Cookie notice"
      class="font-inter fixed z-[55] left-4 right-4 sm:right-auto sm:max-w-sm bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6">
      <div class="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_28px_60px_-20px_rgba(7,24,14,0.45)] overflow-hidden">
        <div class="pt-gradient-wide h-1.5" aria-hidden="true"></div>
        <div class="p-5">
          <div class="flex items-start gap-3.5">
            <span class="w-11 h-11 rounded-2xl bg-sun-100 text-sun-700 flex items-center justify-center shrink-0 text-xl" aria-hidden="true">🍪</span>
            <div class="min-w-0">
              <h2 class="font-bold text-ink-700 leading-snug">We use exactly one cookie.</h2>
              <p class="text-sm text-slate-600 leading-relaxed mt-1">
                It remembers that you're signed in. That's the whole batch — no trackers, no ads, nothing shared with anyone.
              </p>
            </div>
          </div>

          <transition name="expand">
            <dl v-if="details" class="mt-3 rounded-xl bg-meadow/70 border border-brand-100 px-3.5 py-3 text-xs space-y-1.5">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Name</dt><dd class="font-semibold text-ink-700 font-mono">PHPSESSID</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Purpose</dt><dd class="font-semibold text-ink-700 text-right">Keeps you signed in</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Expires</dt><dd class="font-semibold text-ink-700 text-right">When you close the browser</dd>
              </div>
              <p class="text-slate-500 pt-1.5 leading-relaxed">
                Strictly necessary, so there's nothing to switch off — without it you couldn't stay logged in.
              </p>
            </dl>
          </transition>

          <div class="flex items-center gap-2 mt-4">
            <button type="button" @click="accept"
              class="flex-1 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
              Got it
            </button>
            <button type="button" @click="details = !details" :aria-expanded="details"
              class="text-sm font-semibold text-slate-600 hover:text-brand-700 px-3 py-2.5 rounded-xl hover:bg-slate-100 transition">
              {{ details ? 'Hide' : "What's in it?" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
  `,
};

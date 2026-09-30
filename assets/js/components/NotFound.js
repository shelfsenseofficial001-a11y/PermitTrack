import { authState, homePathFor } from '../store/auth.js?v=70';

// Shown for any address the router doesn't recognise. Where "home" points depends on who is
// signed in, so a lost resident isn't sent to the staff portal and vice versa.
export default {
  name: 'NotFound',
  data() {
    return { authState };
  },
  computed: {
    homePath() {
      return homePathFor(this.authState.user);
    },
    homeLabel() {
      const u = this.authState.user;
      if (!u) return 'Back to home';
      return u.role === 'staff' || u.role === 'admin' ? 'Back to the review queue' : 'Back to your dashboard';
    },
    isApplicant() {
      return !!(this.authState.user && this.authState.user.role === 'applicant');
    },
    attempted() {
      return this.$route.fullPath;
    },
  },
  mounted() {
    this.previousTitle = document.title;
    document.title = 'Page not found · PermitTrack';
  },
  beforeUnmount() {
    document.title = this.previousTitle;
  },
  template: `
  <div class="font-inter min-h-screen bg-meadow flex items-center justify-center p-4 sm:p-6">
    <div class="page-body w-full max-w-lg text-center">

      <!-- A permit that never arrived: the tracker stops short -->
      <div class="relative mx-auto w-full max-w-sm bg-white rounded-3xl ring-1 ring-black/5 shadow-[0_30px_70px_-30px_rgba(16,48,29,0.45)] p-7 mb-8">
        <div class="flex items-center justify-between">
          <span v-for="(s, i) in ['Submitted','In transit','?']" :key="s" class="flex flex-col items-center gap-2 flex-1">
            <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              :class="i < 2 ? 'bg-brand-600 text-white' : 'bg-sun-300 text-ink-700 ring-4 ring-sun-100'">
              <svg v-if="i < 2" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              <template v-else>?</template>
            </span>
            <span class="text-[11px] font-semibold" :class="i < 2 ? 'text-slate-500' : 'text-ink-700'">{{ s }}</span>
          </span>
        </div>
        <div class="mt-5 pt-5 border-t border-brand-100 text-left">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tracking number</div>
          <div class="font-mono text-sm text-ink-700 mt-0.5 break-all">{{ attempted }}</div>
          <div class="text-xs text-red-600 font-semibold mt-2">No page at this address.</div>
        </div>
      </div>

      <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Error 404</p>
      <h1 class="mt-3 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink-700 leading-[1.05]">
        This one got lost<br>in the mail.
      </h1>
      <p class="mt-4 text-slate-600 leading-relaxed">
        We track permits, not missing pages — and this address isn't one we deliver to. It may have moved, or the link may have a typo.
      </p>

      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <router-link :to="homePath"
          class="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-3 rounded-2xl transition shadow-[0_14px_28px_-12px_rgba(31,122,58,0.7)]">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          {{ homeLabel }}
        </router-link>
        <router-link v-if="isApplicant" to="/permits"
          class="inline-flex items-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:ring-brand-300 px-5 py-3 rounded-2xl transition">
          My Permits
        </router-link>
        <router-link v-else-if="!authState.user" to="/login"
          class="inline-flex items-center text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:ring-brand-300 px-5 py-3 rounded-2xl transition">
          Log in
        </router-link>
      </div>
    </div>
  </div>
  `,
};

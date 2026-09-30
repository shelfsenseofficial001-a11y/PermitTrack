import { authState } from '../store/auth.js?v=60';
import { backButtonClass, backIconClass } from '../util.js?v=60';

// Shared card for the sign-in pages: gradient panel on the left, form on the right.
export default {
  name: 'AuthLayout',
  setup: () => ({ backButtonClass, backIconClass }),
  props: {
    eyebrow: { type: String, default: 'You can easily' },
    headline: { type: String, default: 'Track your permit like a package — see exactly where it stands.' },
    portal: { type: String, default: '' }, // small label under the logo, e.g. "Staff Portal"
  },
  methods: {
    // Back to the previous page — unless there isn't one in this app (opened from a link or
    // bookmark), or it's a signed-in page right after signing out, which would only bounce
    // straight back here. In those cases, the landing page.
    goBack() {
      const back = window.history.state && window.history.state.back;
      if (back) {
        const target = this.$router.resolve(back);
        if (target.meta.public || authState.user) return this.$router.back();
      }
      this.$router.push('/');
    },
  },
  template: `
  <div class="font-inter min-h-screen lg:h-screen lg:overflow-hidden bg-[#f3f9e3] flex items-center justify-center p-4 sm:p-6">
    <div class="page-body w-full max-w-6xl bg-white rounded-[28px] p-3 sm:p-4 shadow-[0_30px_80px_-20px_rgba(95,140,40,0.30)] grid lg:grid-cols-2 gap-4 lg:h-[min(700px,calc(100vh-3rem))]">

      <div class="pt-gradient hidden lg:flex relative overflow-hidden rounded-[22px] flex-col justify-between p-10 text-white">
        <router-link to="/" class="flex items-center gap-3 text-[#0b3d20] self-start rounded-xl hover:opacity-90 transition" aria-label="PermitTrack home">
          <img src="assets/images/PermitTrackIcon.png?v=60" alt="" class="w-14 h-14 object-contain shrink-0 drop-shadow" />
          <div class="leading-tight">
            <div class="text-lg font-semibold tracking-tight">PermitTrack</div>
            <div v-if="portal" class="text-xs font-bold uppercase tracking-widest">{{ portal }}</div>
          </div>
        </router-link>
        <div class="max-w-md">
          <p class="text-base font-medium text-white/90 mb-3">{{ eyebrow }}</p>
          <p class="text-4xl font-bold leading-[1.15] tracking-tight">{{ headline }}</p>
        </div>
      </div>

      <div class="flex justify-center items-start lg:items-center px-4 py-8 sm:px-10 lg:py-8 lg:overflow-y-auto no-scrollbar">
        <div class="w-full max-w-sm">
          <!-- The button is inline-flex, so it needs a block wrapper of its own; otherwise a page
               starting with an inline chip (Log in, Staff login) renders it on the same line. -->
          <div class="mb-6">
            <button type="button" @click="goBack" :class="backButtonClass">
              <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
              Back
            </button>
          </div>
          <router-link to="/" class="flex lg:hidden items-center gap-2 mb-5 self-start" aria-label="PermitTrack home">
            <img src="assets/images/PermitTrackIcon.png?v=60" alt="" class="w-9 h-9 object-contain shrink-0" />
            <span class="text-lg font-bold text-slate-900">PermitTrack</span>
          </router-link>
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
  `,
};

// Shared input styling for the auth forms
export const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-[#1f7a3a]/15 focus:border-[#1f7a3a] outline-none transition';
export const labelClass = 'block text-[15px] font-medium text-slate-900 mb-1.5';
export const primaryButtonClass = 'w-full py-3 rounded-xl bg-[#1f7a3a] text-white text-sm font-semibold hover:bg-[#186332] disabled:opacity-60 transition shadow-[0_12px_24px_-8px_rgba(31,122,58,0.55)]';

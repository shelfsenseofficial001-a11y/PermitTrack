import { createApp } from 'vue';
import { router } from './router/router.js?v=119';
import { authState, logout, signOutPathFor } from './store/auth.js?v=119';
import { uiState, beginTransition, endTransition } from './store/ui.js?v=119';
import ChangePasswordModal from './components/ChangePasswordModal.js?v=119';
import CookieBanner from './components/CookieBanner.js?v=119';
import BaseModal from './components/BaseModal.js?v=119';
import LogoMark from './components/LogoMark.js?v=119';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Explicit durations make the page swap finish on a timer instead of waiting for
// transitionend. A hidden tab never paints, so transitionend would never fire there and the
// next page would never be shown (mode="out-in" waits for the leave to finish).
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// enter covers the whole staggered arrival in index.html — the last section starts .3s in and
// takes .55s — or Vue would strip the classes mid-animation and the late sections would snap.
const PAGE_MS = reduced ? { enter: 1, leave: 1 } : { enter: 850, leave: 160 };

const App = {
  components: { ChangePasswordModal, CookieBanner, BaseModal, LogoMark },
  data() {
    return { authState, uiState, pageMs: PAGE_MS, signOutError: '' };
  },
  methods: {
    // Every Sign out in the app ends here, after its confirmation. The veil stays up for a
    // beat even when the server answers instantly, so it reads as a transition, not a flicker.
    async signOut() {
      this.uiState.confirmSignOut = false;
      this.signOutError = '';
      beginTransition('signout');
      const beat = wait(700);
      try {
        await logout();
      } catch (e) {
        await beat;
        endTransition();
        this.signOutError = e.message || 'Could not sign out. Please try again.';
        this.uiState.confirmSignOut = true;
        return;
      }
      await beat;
      await this.$router.push(signOutPathFor());
      // Let the landing page draw under the blur before it clears
      setTimeout(endTransition, 300);
    },
    cancelSignOut() {
      this.uiState.confirmSignOut = false;
      this.signOutError = '';
    },
  },
  computed: {
    // Where the sign-in reveal opens from: the pressed button, or the middle of the screen
    irisOrigin() {
      const o = this.uiState.transitionOrigin;
      return o ? { '--x': o.x + 'px', '--y': o.y + 'px' } : { '--x': '50%', '--y': '50%' };
    },
    // A temporary password from an Admin must be replaced before anything else. Hosting
    // the dialog here, above every route and both shells, means no page can slip past it.
    forcedPasswordChange() {
      const u = this.authState.user;
      return !!(u && Number(u.must_change_password) && !this.$route.meta.public);
    },
    // Only for a signed-in user on an app page — never over the login screens
    showPasswordDialog() {
      if (this.forcedPasswordChange) return true;
      return this.uiState.changePasswordOpen && !!this.authState.user && !this.$route.meta.public;
    },
  },
  watch: {
    // A request made while signed out (e.g. an old /account/password link that bounced to
    // /login) must not survive into the session and pop up right after signing in
    '$route.meta.public'(isPublic) {
      if (isPublic) this.uiState.changePasswordOpen = false;
    },
  },
  // Keyed by path, not full URL, so ?open=… on My Permits doesn't replay the page transition
  template: `
    <router-view v-slot="{ Component, route }">
      <transition name="page" mode="out-in" :duration="pageMs">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
    <transition name="modal">
      <ChangePasswordModal v-if="showPasswordDialog"
        :forced="forcedPasswordChange" @close="uiState.changePasswordOpen = false" />
    </transition>

    <transition name="modal">
      <BaseModal v-if="uiState.confirmSignOut && authState.user" title="Sign out?" eyebrow="Leaving PermitTrack"
        :subtitle="authState.user.full_name" @close="cancelSignOut">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        </template>
        <p class="text-sm text-slate-600 leading-relaxed">
          You'll go back to the PermitTrack home page. Any other accounts signed in on this browser stay signed in.
        </p>
        <p v-if="signOutError" class="text-sm text-red-600 mt-3">{{ signOutError }}</p>
        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="cancelSignOut"
              class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition">Cancel</button>
            <button type="button" @click="signOut"
              class="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition">Sign out</button>
          </div>
        </template>
      </BaseModal>
    </transition>

    <!-- Signing in: the whole screen opens out from the button that was pressed, the mark flies
         with a welcome, then it lifts away to show the first page arriving (ui.js enterSignedIn) -->
    <transition name="iris">
      <div v-if="uiState.transition === 'signin'" role="status" aria-live="polite" :style="irisOrigin"
        class="pt-iris fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-center text-white">
        <LogoMark animated class="pt-iris-mark w-24 h-24 sm:w-28 sm:h-28 drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]" />
        <p class="pt-iris-line mt-7 text-3xl sm:text-4xl font-extrabold tracking-tight">{{ uiState.transitionGreeting }}</p>
        <p v-if="uiState.transitionLine" class="pt-iris-line2 mt-2 text-sm sm:text-base text-white/70">{{ uiState.transitionLine }}</p>
      </div>
    </transition>

    <!-- The veil over a sign-out or an account switch: the page blurs behind it -->
    <transition name="veil">
      <div v-if="uiState.transition && uiState.transition !== 'signin'" role="status" aria-live="polite"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 backdrop-blur-md">
        <div class="flex items-center gap-3 text-white">
          <LogoMark animated color="currentColor" class="w-9 h-9 shrink-0" />
          <span class="text-xl font-bold tracking-tight">{{ uiState.transition === 'signout' ? 'Signing out…' : 'Switching accounts…' }}</span>
        </div>
      </div>
    </transition>
    <CookieBanner />
  `,
};

createApp(App).use(router).mount('#app');

// Arriving from an account switch, the veil came up already (see ui.js). Lift it once the new
// account's first page is in place underneath.
if (uiState.transition === 'switch') {
  router.isReady().then(() => setTimeout(endTransition, 500));
}

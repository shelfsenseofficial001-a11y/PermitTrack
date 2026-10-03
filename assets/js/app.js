import { createApp } from 'vue';
import { router } from './router/router.js?v=114';
import { authState } from './store/auth.js?v=114';
import { uiState } from './store/ui.js?v=114';
import ChangePasswordModal from './components/ChangePasswordModal.js?v=114';
import CookieBanner from './components/CookieBanner.js?v=114';

// Explicit durations make the page swap finish on a timer instead of waiting for
// transitionend. A hidden tab never paints, so transitionend would never fire there and the
// next page would never be shown (mode="out-in" waits for the leave to finish).
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAGE_MS = reduced ? { enter: 1, leave: 1 } : { enter: 240, leave: 120 };

const App = {
  components: { ChangePasswordModal, CookieBanner },
  data() {
    return { authState, uiState, pageMs: PAGE_MS };
  },
  computed: {
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
    <CookieBanner />
  `,
};

createApp(App).use(router).mount('#app');

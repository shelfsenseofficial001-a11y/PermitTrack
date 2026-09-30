import { createApp } from 'vue';
import { router } from './router/router.js?v=60';
import { authState } from './store/auth.js?v=60';
import { uiState } from './store/ui.js?v=60';
import ChangePasswordModal from './components/ChangePasswordModal.js?v=60';

// Page transitions run on explicit timings: the moving part is each page's .page-body, not
// the route root, so Vue can't read the duration from CSS. Near-instant for reduced motion.
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE_DURATION = reducedMotion ? { enter: 10, leave: 10 } : { enter: 240, leave: 120 };

const App = {
  components: { ChangePasswordModal },
  data() {
    return { authState, uiState, pageDuration: PAGE_DURATION };
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
      <transition name="page" mode="out-in" :duration="pageDuration">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
    <transition name="modal">
      <ChangePasswordModal v-if="showPasswordDialog"
        :forced="forcedPasswordChange" @close="uiState.changePasswordOpen = false" />
    </transition>
  `,
};

createApp(App).use(router).mount('#app');

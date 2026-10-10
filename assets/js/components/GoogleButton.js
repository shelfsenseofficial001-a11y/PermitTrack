import { apiGet } from '../api/client.js?v=129';
import { googleSignIn, homePathFor } from '../store/auth.js?v=129';

// Sign in with Google, using Google's own button (Google Identity Services). The button hands
// back an ID token, which the server verifies before it signs anyone in — see api/lib/google.php.
// Without a client ID in api/config.local.php, nothing is shown at all.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let clientIdPromise = null;
let scriptPromise = null;
let initializedFor = null;
let activeHandler = null; // the mounted button that should receive the next credential

function loadClientId() {
  clientIdPromise ||= apiGet('auth.php?action=google_config').then((r) => r.client_id).catch(() => {
    clientIdPromise = null;
    return null;
  });
  return clientIdPromise;
}

function loadScript() {
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      scriptPromise = null;
      s.remove();
      reject(new Error('Google sign-in could not load. Check your connection and reload the page.'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default {
  name: 'GoogleButton',
  props: {
    // Google's wording on the button: 'continue_with' or 'signup_with'
    text: { type: String, default: 'continue_with' },
    divider: { type: String, default: 'or continue with' },
  },
  emits: ['busy'],
  data() {
    return { state: 'loading', error: '' };
  },
  async mounted() {
    const clientId = await loadClientId();
    if (!clientId) {
      this.state = 'off';
      return;
    }
    try {
      const google = await loadScript();
      if (initializedFor !== clientId) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => activeHandler && activeHandler(response),
          ux_mode: 'popup',
          itp_support: true,
        });
        initializedFor = clientId;
      }
      activeHandler = this.onCredential;
      this.state = 'ready';
      await this.$nextTick();
      if (!this.$refs.slot) return; // left the page while the script loaded
      google.accounts.id.renderButton(this.$refs.slot, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: this.text,
        logo_alignment: 'center',
        locale: 'en', // match the rest of the UI rather than the browser's language
        width: Math.min(400, Math.max(200, this.$refs.slot.offsetWidth)),
      });
    } catch (e) {
      this.state = 'ready';
      this.error = e.message;
    }
  },
  beforeUnmount() {
    if (activeHandler === this.onCredential) activeHandler = null;
  },
  methods: {
    async onCredential({ credential }) {
      this.error = '';
      this.$emit('busy', true);
      try {
        const user = await googleSignIn(credential);
        // No account yet: finish signing up, with what Google told us already filled in
        this.$router.push(user ? homePathFor(user) : { path: '/register', query: { google: '1' } });
      } catch (e) {
        this.error = e.message;
      } finally {
        this.$emit('busy', false);
      }
    },
  },
  template: `
  <div v-if="state === 'ready'">
    <div class="flex items-center gap-3 my-4">
      <div class="flex-1 h-px bg-slate-200"></div>
      <span class="text-xs text-slate-400">{{ divider }}</span>
      <div class="flex-1 h-px bg-slate-200"></div>
    </div>
    <div ref="slot" class="flex justify-center min-h-[44px]"></div>
    <p v-if="error" class="text-sm text-red-600 mt-2 text-center" role="alert">{{ error }}</p>
  </div>
  `,
};

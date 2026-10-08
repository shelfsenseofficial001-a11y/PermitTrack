import { authState, verifyCode, resendCode, homePathFor } from '../store/auth.js?v=129';
import AuthLayout, { inputClass, labelClass, primaryButtonClass } from './AuthLayout.js?v=129';

export default {
  name: 'Verify',
  components: { AuthLayout },
  data() {
    return {
      authState,
      code: '',
      error: '',
      notice: '',
      loading: false,
      resending: false,
      cooldown: 0,
      timer: null,
      inputClass, labelClass, primaryButtonClass,
    };
  },
  computed: {
    v() {
      return this.authState.verification;
    },
    isEmail() {
      return this.v && this.v.channel === 'email';
    },
  },
  mounted() {
    if (!this.v) {
      // Nothing to verify (e.g. page refreshed) — start over from the login page
      this.$router.replace('/login');
      return;
    }
    this.startCooldown(this.v.resend_after_seconds || 60);
    this.$nextTick(() => this.$refs.codeInput && this.$refs.codeInput.focus());
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
  methods: {
    startCooldown(seconds) {
      clearInterval(this.timer);
      this.cooldown = seconds;
      this.timer = setInterval(() => {
        this.cooldown--;
        if (this.cooldown <= 0) clearInterval(this.timer);
      }, 1000);
    },
    onInput(e) {
      this.code = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = this.code;
      if (this.code.length === 6) this.submit();
    },
    async submit() {
      if (this.loading) return;
      this.error = '';
      this.notice = '';
      if (this.code.length !== 6) {
        this.error = 'Please enter the 6-digit code.';
        return;
      }
      this.loading = true;
      try {
        const user = await verifyCode(this.code);
        this.$router.push(homePathFor(user));
      } catch (e) {
        this.error = e.message;
        this.code = '';
        this.$refs.codeInput && this.$refs.codeInput.focus();
      } finally {
        this.loading = false;
      }
    },
    async resend() {
      this.error = '';
      this.notice = '';
      this.resending = true;
      try {
        const v = await resendCode();
        this.notice = 'A new code is on its way.';
        this.startCooldown(v.resend_after_seconds || 60);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.resending = false;
      }
    },
  },
  template: `
  <AuthLayout :loading="loading" loading-kind="verify" eyebrow="Almost there" headline="Confirm it's really you — then start tracking your permits.">
    <template v-if="v">
      <div class="w-12 h-12 rounded-2xl bg-[#f3f9e3] text-[#1f7a3a] flex items-center justify-center mb-4">
        <svg v-if="isEmail" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
        <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>
      </div>

      <h1 class="text-3xl font-bold tracking-tight text-slate-900 mb-2">{{ isEmail ? 'Check your email' : 'Check your phone' }}</h1>
      <p class="text-slate-500 text-sm leading-relaxed mb-6">
        We sent a 6-digit code to <strong class="text-slate-700">{{ v.sent_to }}</strong>. It expires in {{ v.expires_in_minutes }} minutes.
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label :class="labelClass" for="v-code">Verification code</label>
          <input id="v-code" ref="codeInput" :value="code" @input="onInput" type="text" inputmode="numeric" autocomplete="one-time-code"
            maxlength="6" placeholder="••••••"
            :class="inputClass + ' text-center text-2xl font-semibold tracking-[0.6em] py-3'" />
        </div>

        <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>
        <p v-if="notice" class="text-sm text-[#1f7a3a]" aria-live="polite">{{ notice }}</p>

        <button type="submit" :disabled="loading" :class="primaryButtonClass">{{ loading ? 'Checking…' : 'Verify' }}</button>
      </form>

      <p class="text-sm text-slate-500 mt-5 text-center">
        Didn't get it?
        <button type="button" @click="resend" :disabled="cooldown > 0 || resending"
          class="font-semibold text-[#1f7a3a] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed">
          {{ cooldown > 0 ? 'Resend in ' + cooldown + 's' : resending ? 'Sending…' : 'Resend code' }}
        </button>
      </p>
      <p class="text-sm text-slate-500 mt-2 text-center">
        <router-link to="/login" class="hover:text-[#1f7a3a] hover:underline">Back to log in</router-link>
      </p>

      <!-- Only shown while email/SMS use the local 'log' driver (no real sending configured) -->
      <div v-if="v.dev_code" class="mt-6 rounded-xl border border-dashed border-sun-400 bg-sun-50 p-3 text-xs text-sun-700">
        <strong>Test mode:</strong> email/SMS sending isn't set up yet, so the code is shown here:
        <button type="button" class="font-mono font-bold underline ml-1" @click="code = v.dev_code; submit()">{{ v.dev_code }}</button>
      </div>
    </template>
  </AuthLayout>
  `,
};

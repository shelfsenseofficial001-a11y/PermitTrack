import { login, homePathFor } from '../store/auth.js?v=117';
import AuthLayout, { inputClass, labelClass, primaryButtonClass } from './AuthLayout.js?v=117';

export default {
  name: 'Login',
  components: { AuthLayout },
  data() {
    return {
      form: { identifier: '', password: '' },
      showPassword: false,
      error: '',
      loading: false,
      inputClass, labelClass, primaryButtonClass,
    };
  },
  methods: {
    async submit() {
      this.error = '';
      this.loading = true;
      try {
        const user = await login(this.form.identifier, this.form.password, false);
        this.$router.push(user ? homePathFor(user) : '/verify');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
  <AuthLayout :loading="loading" loading-kind="login">
    <span class="inline-flex items-center text-xs font-semibold uppercase tracking-wider leading-none text-[#1f7a3a] bg-[#f3f9e3] rounded-full px-3 py-1.5 mb-3">Residents &amp; Businesses</span>

    <h1 class="text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome back</h1>
    <p class="text-slate-500 text-sm leading-relaxed mb-6">Log in to track your permits and licenses — every step, in one place.</p>

    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label :class="labelClass" for="login-id">Email or mobile number</label>
        <input id="login-id" v-model="form.identifier" type="text" required autocomplete="username"
          placeholder="you@email.com or 0917 123 4567" :class="inputClass" />
      </div>
      <div>
        <label :class="labelClass" for="login-pw">Password</label>
        <div class="relative">
          <input id="login-pw" v-model="form.password" :type="showPassword ? 'text' : 'password'" required autocomplete="current-password"
            placeholder="••••••••••" :class="inputClass + ' pr-11'" />
          <button type="button" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'"
            class="absolute inset-y-0 right-0 flex items-center px-4 rounded-r-xl text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a3a]/40">
            <svg v-if="!showPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>
          </button>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="pt-1">
        <button type="submit" :disabled="loading" :class="primaryButtonClass">{{ loading ? 'Please wait…' : 'Log In' }}</button>
      </div>
    </form>

    <div class="flex items-center gap-3 my-4">
      <div class="flex-1 h-px bg-slate-200"></div>
      <span class="text-xs text-slate-400">or continue with</span>
      <div class="flex-1 h-px bg-slate-200"></div>
    </div>
    <button type="button" disabled title="Not available in this demo"
      class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 cursor-not-allowed">
      <svg class="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      Google
    </button>

    <p class="text-sm text-slate-500 mt-5 text-center">
      Don't have an account?
      <router-link to="/register" class="text-[#1f7a3a] font-semibold hover:underline">Sign up</router-link>
    </p>
    <p class="text-xs text-slate-400 mt-3 text-center">
      City staff?
      <router-link to="/staff/login" class="font-semibold text-slate-500 hover:text-[#1f7a3a] hover:underline">Sign in to the Staff Portal →</router-link>
    </p>
  </AuthLayout>
  `,
};

import { login, homePathFor } from '../store/auth.js?v=129';
import AuthLayout, { inputClass, labelClass, primaryButtonClass } from './AuthLayout.js?v=129';
import GoogleButton from './GoogleButton.js?v=129';

export default {
  name: 'Login',
  components: { AuthLayout, GoogleButton },
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

    <GoogleButton @busy="loading = $event" />

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

import { login, reloadAs } from '../store/auth.js?v=71';
import { inputClass } from './AuthLayout.js?v=71';
import BaseModal from './BaseModal.js?v=71';

// "Add account": sign in to another account on top of the current page. The current account
// stays signed in on this browser (see auth.php "accounts"), so the user can switch back.
export default {
  name: 'AddAccountModal',
  components: { BaseModal },
  emits: ['close'],
  data() {
    return {
      form: { identifier: '', password: '' },
      showPassword: false,
      error: '',
      loading: false,
      inputClass,
    };
  },
  mounted() {
    this.$nextTick(() => this.$refs.first && this.$refs.first.focus());
  },
  methods: {
    close() {
      if (!this.loading) this.$emit('close');
    },
    async submit() {
      this.error = '';
      this.loading = true;
      try {
        const user = await login(this.form.identifier, this.form.password, false);
        if (user) {
          reloadAs(user);
        } else {
          // The new account still needs its email/SMS code
          this.$emit('close');
          this.$router.push('/verify');
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    signUp() {
      this.$emit('close');
      this.$router.push('/register');
    },
  },
  template: `
  <BaseModal title="Add another account" eyebrow="Switch accounts"
    subtitle="Sign in to another account. You'll stay signed in to this one too, and can switch back any time."
    @close="close">

    <template #icon>
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
    </template>

    <form id="add-account-form" @submit.prevent="submit" class="space-y-4" novalidate>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="add-account-id">Email or mobile number</label>
        <div class="relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input id="add-account-id" ref="first" v-model="form.identifier" type="text" required autocomplete="username"
            placeholder="you@email.com or 0917 123 4567" :class="inputClass + ' pl-10'" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-slate-600" for="add-account-pw">Password</label>
          <button type="button" @click="showPassword = !showPassword" class="text-xs font-semibold text-slate-500 hover:text-brand-700 transition">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </div>
        <div class="relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input id="add-account-pw" v-model="form.password" :type="showPassword ? 'text' : 'password'" required autocomplete="current-password"
            placeholder="••••••••••" :class="inputClass + ' pl-10'" />
        </div>
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5" role="alert">
        <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        {{ error }}
      </div>

      <p class="text-sm text-slate-500">
        Don't have another account?
        <button type="button" @click="signUp" class="font-semibold text-brand-700 hover:underline">Create one</button>
      </p>
    </form>

    <template #footer>
      <div class="ml-auto flex items-center gap-2">
        <button type="button" @click="close" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Cancel</button>
        <button type="submit" form="add-account-form" :disabled="loading"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
          {{ loading ? 'Signing in…' : 'Sign in' }}
          <svg v-if="!loading" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
    </template>
  </BaseModal>
  `,
};

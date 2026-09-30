import { authState, changePassword, logout, reloadAs, signOutPathFor } from '../store/auth.js?v=66';
import { inputClass } from './AuthLayout.js?v=66';
import BaseModal from './BaseModal.js?v=66';

// Change password as a dialog over the current page. With `forced` (a temporary password
// set by an Admin), it cannot be dismissed — the only ways out are a new password or signing out.
export default {
  name: 'ChangePasswordModal',
  components: { BaseModal },
  props: {
    forced: { type: Boolean, default: false },
  },
  emits: ['close'],
  data() {
    return {
      form: { current: '', next: '', confirm: '' },
      showCurrent: false,
      show: false, // new + confirm share one toggle so they can be compared
      error: '',
      done: false,
      loading: false,
      inputClass,
    };
  },
  computed: {
    // Live checklist, so the rules are visible before the user hits Save
    rules() {
      const p = this.form.next;
      return [
        { label: '8+ characters', ok: p.length >= 8 },
        { label: 'A letter', ok: /[A-Za-z]/.test(p) },
        { label: 'A number', ok: /\d/.test(p) },
        { label: 'Passwords match', ok: p !== '' && p === this.form.confirm },
      ];
    },
    strength() {
      return this.rules.slice(0, 3).filter((r) => r.ok).length;
    },
    valid() {
      return this.form.current !== '' && this.rules.every((r) => r.ok);
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.first && this.$refs.first.focus());
  },
  beforeUnmount() {
    clearTimeout(this.closeTimer);
  },
  methods: {
    close() {
      if (!this.forced && !this.loading) this.$emit('close');
    },
    async submit() {
      this.error = '';
      if (!this.valid) {
        this.error = this.form.current === '' ? 'Enter your current password.' : 'Your new password does not meet the requirements yet.';
        return;
      }
      this.loading = true;
      try {
        await changePassword(this.form.current, this.form.next);
        this.done = true;
        this.closeTimer = setTimeout(() => this.$emit('close'), 1600);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async signOut() {
      // Admins can reset anyone's password, so this dialog is shown to staff and residents alike
      const leaving = authState.user;
      const next = await logout();
      if (next) reloadAs(next);
      else this.$router.push(signOutPathFor(leaving));
    },
  },
  template: `
  <BaseModal
    :title="done ? 'Password updated' : (forced ? 'Set your password' : 'Change password')"
    :subtitle="done ? '' : (forced ? 'You signed in with a temporary password from an Admin. Choose your own to continue.' : 'Enter your current password, then choose a new one.')"
    :eyebrow="done ? '' : (forced ? 'Action required' : 'Account security')"
    :tone="forced && !done ? 'sun' : 'brand'"
    :dismissible="!forced && !done"
    @close="close">

    <template #icon>
      <svg v-if="done" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </template>

    <p v-if="done" class="text-sm text-slate-500 leading-relaxed" role="status">Use your new password the next time you sign in.</p>

    <form v-else id="cp-form" @submit.prevent="submit" class="space-y-4" novalidate>
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-slate-600" for="cp-current">{{ forced ? 'Temporary password' : 'Current password' }}</label>
          <button type="button" @click="showCurrent = !showCurrent" :aria-pressed="showCurrent" aria-controls="cp-current"
            class="text-xs font-semibold text-slate-500 hover:text-brand-700 transition">{{ showCurrent ? 'Hide' : 'Show' }}</button>
        </div>
        <input id="cp-current" ref="first" v-model="form.current" :type="showCurrent ? 'text' : 'password'" required autocomplete="current-password" :class="inputClass" />
      </div>

      <div class="h-px bg-slate-100" aria-hidden="true"></div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-slate-600" for="cp-new">New password</label>
          <button type="button" @click="show = !show" :aria-pressed="show" aria-controls="cp-new cp-confirm" class="text-xs font-semibold text-slate-500 hover:text-brand-700 transition">{{ show ? 'Hide' : 'Show' }}</button>
        </div>
        <input id="cp-new" v-model="form.next" :type="show ? 'text' : 'password'" required autocomplete="new-password" :class="inputClass" />
        <!-- Strength meter: one segment per rule met -->
        <div class="flex gap-1 mt-2" aria-hidden="true">
          <span v-for="i in 3" :key="i" class="h-1 flex-1 rounded-full transition-colors duration-300"
            :class="i <= strength ? (strength === 3 ? 'bg-brand-600' : strength === 2 ? 'bg-sun-400' : 'bg-red-400') : 'bg-slate-200'"></span>
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="cp-confirm">Confirm new password</label>
        <input id="cp-confirm" v-model="form.confirm" :type="show ? 'text' : 'password'" required autocomplete="new-password" :class="inputClass" />
      </div>

      <ul class="flex flex-wrap gap-1.5" aria-label="Password requirements">
        <li v-for="r in rules" :key="r.label"
          class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors"
          :class="r.ok ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-400 ring-slate-200'">
          <svg v-if="r.ok" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          <span v-else class="w-1.5 h-1.5 rounded-full bg-slate-300" aria-hidden="true"></span>
          {{ r.label }}
        </li>
      </ul>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5" role="alert">
        <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        {{ error }}
      </div>
    </form>

    <template v-if="!done" #footer>
      <button v-if="forced" type="button" @click="signOut" class="text-sm font-semibold text-slate-500 hover:text-red-600 transition">Sign out instead</button>
      <div class="ml-auto flex items-center gap-2">
        <button v-if="!forced" type="button" @click="close" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Cancel</button>
        <button type="submit" form="cp-form" :disabled="loading"
          class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
          {{ loading ? 'Saving…' : (forced ? 'Set password' : 'Update password') }}
        </button>
      </div>
    </template>
  </BaseModal>
  `,
};

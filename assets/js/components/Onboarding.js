import { apiPost } from '../api/client.js';
import { loadCurrentUser } from '../store/auth.js';

export default {
  name: 'Onboarding',
  data() {
    return {
      form: { business_name: '', ein: '', phone: '', address: '' },
      error: '',
      loading: false,
    };
  },
  methods: {
    async submit(skip) {
      this.error = '';
      this.loading = true;
      try {
        await apiPost('onboarding.php', { ...this.form, skip });
        await loadCurrentUser();
        this.$router.push('/dashboard');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
  <div class="min-h-screen flex flex-col items-center bg-slate-50 p-6">
    <div class="flex items-center gap-2 mt-6 mb-8">
      <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xs">PT</div>
      <span class="text-lg font-bold text-ink-700">PermitTrack</span>
    </div>

    <div class="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div class="flex items-center gap-2 mb-6 text-sm">
        <div class="flex items-center gap-1.5 text-emerald-600 font-semibold">
          <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>
          Identity Verified
        </div>
        <div class="flex-1 h-px bg-slate-200"></div>
        <div class="flex items-center gap-1.5 text-brand-700 font-semibold">
          <span class="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">2</span>
          Business Information
        </div>
      </div>

      <h1 class="text-2xl font-bold mb-1 text-ink-700">Tell us about your business</h1>
      <p class="text-slate-500 text-sm mb-6">This information is used to pre-fill your future permit applications, so you won't have to re-enter it every time.</p>

      <form @submit.prevent="submit(false)" class="space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
          <input v-model="form.business_name" type="text" placeholder="Downtown Café"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">EIN / Tax ID</label>
            <input v-model="form.ein" type="text" placeholder="84-1234567"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Primary Contact Phone</label>
            <input v-model="form.phone" type="tel" placeholder="(512) 555-0148"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Business Address</label>
          <input v-model="form.address" type="text" placeholder="214 Maple Ct, Springfield"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button type="submit" :disabled="loading" class="w-full py-2.5 rounded-md bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-sm">
          {{ loading ? 'Saving…' : 'Save & Continue' }}
        </button>
      </form>

      <button @click="submit(true)" :disabled="loading" class="w-full text-center text-sm text-slate-500 hover:text-brand-600 mt-4">
        I'm applying as an individual, not a business
      </button>
    </div>
  </div>
  `,
};

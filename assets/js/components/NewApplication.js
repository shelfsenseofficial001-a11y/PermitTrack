import { apiGet, apiPostForm } from '../api/client.js?v=60';
import AppShell from './AppShell.js?v=60';
import { authState } from '../store/auth.js?v=60';

const PERMIT_TYPES = [
  { value: 'Food Service', label: 'Food Service' },
  { value: 'Building/Renovation', label: 'Building / Renovation' },
  { value: 'Sign', label: 'Sign Permit' },
  { value: 'Business License', label: 'Business License' },
  { value: 'Special Event', label: 'Special Event' },
];

export default {
  name: 'NewApplication',
  components: { AppShell },
  data() {
    return {
      permitTypes: PERMIT_TYPES,
      form: {
        permit_type: '',
        property_address: '',
        business_id: '',
        project_description: '',
      },
      requiredDocs: [],
      files: {},
      error: '',
      submitting: false,
      authState,
      eligibility: null, // { permit_types, businesses, is_resident }
    };
  },
  computed: {
    canApply() {
      return !!(this.authState.user && this.authState.user.can_apply);
    },
    rule() {
      return this.eligibility ? this.eligibility.permit_types.find((t) => t.value === this.form.permit_type) : null;
    },
    // Who this permit can be filed as: '' = the user as a Resident, or a business id
    filingOptions() {
      if (!this.rule) return [];
      const opts = [];
      if (this.rule.as_resident) opts.push({ value: '', label: 'Myself (verified Resident)' });
      if (this.rule.as_business) this.eligibility.businesses.forEach((b) => opts.push({ value: String(b.id), label: b.business_name + (b.trade_name ? ' (' + b.trade_name + ')' : '') }));
      return opts;
    },
  },
  async mounted() {
    if (this.canApply) {
      this.eligibility = await apiGet('applications.php?action=eligibility');
    }
  },
  watch: {
    'form.business_id'(id) {
      // Business permits default to the business's own address
      const b = this.eligibility && this.eligibility.businesses.find((x) => String(x.id) === id);
      if (b) this.form.property_address = `${b.address_line}, Brgy. ${b.barangay}, ${b.city} ${b.postal_code}`;
    },
    async 'form.permit_type'(type) {
      this.form.business_id = this.filingOptions.length ? this.filingOptions[0].value : '';
      this.files = {};
      if (!type) {
        this.requiredDocs = [];
        return;
      }
      const res = await apiGet(`applications.php?action=required_documents&type=${encodeURIComponent(type)}`);
      this.requiredDocs = res.documents;
    },
  },
  methods: {
    fieldKey(docName) {
      return 'doc_' + docName.replace(/[^a-zA-Z0-9]+/g, '_');
    },
    onFile(docName, event) {
      this.files[this.fieldKey(docName)] = event.target.files[0] || null;
    },
    async submit() {
      this.error = '';
      if (!this.form.permit_type) {
        this.error = 'Please choose a permit type.';
        return;
      }
      if (!this.form.property_address.trim()) {
        this.error = 'Property address is required.';
        return;
      }
      this.submitting = true;
      try {
        const fd = new FormData();
        Object.entries(this.form).forEach(([k, v]) => fd.append(k, v));
        Object.entries(this.files).forEach(([key, file]) => {
          if (file) fd.append(key, file);
        });
        const res = await apiPostForm('applications.php?action=create', fd);
        this.$router.push('/applications/' + res.application_id);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.submitting = false;
      }
    },
  },
  template: `
  <AppShell>
    <div class="max-w-2xl">
      <h1 class="text-2xl font-bold text-ink-700">{{ canApply ? 'Start a New Application' : 'Browse Permits' }}</h1>
      <p class="text-slate-500 text-sm mt-1 mb-6">
        {{ canApply ? "Tell us what you're applying for — we'll only ask for what's actually required." : 'Pick a permit type to see what documents it requires.' }}
      </p>

      <div v-if="!canApply" class="flex items-start gap-3 bg-sun-50 border border-sun-200 rounded-2xl px-4 py-3 mb-6">
        <svg class="w-5 h-5 text-sun-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p class="text-sm text-sun-700">You're browsing as a <strong>Normal User</strong>. To apply for a permit, verify your account as a Resident or Business Owner from your dashboard.</p>
      </div>

      <form @submit.prevent="submit" class="bg-white rounded-2xl border border-brand-100 p-6 space-y-6">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Permit Type</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in permitTypes" :key="t.value" type="button"
              @click="form.permit_type = t.value"
              class="px-4 py-2 rounded-full text-sm font-semibold border transition"
              :class="form.permit_type === t.value ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-brand-300'"
            >{{ t.label }}</button>
          </div>
        </div>
        <!-- Browse mode: just list what the permit needs -->
        <div v-if="!canApply && requiredDocs.length">
          <label class="block text-sm font-semibold text-slate-700 mb-2">Required Documents</label>
          <ul class="space-y-2">
            <li v-for="doc in requiredDocs" :key="doc" class="flex items-center gap-3 rounded-xl bg-meadow px-4 py-3 text-sm font-medium text-slate-700">
              <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              {{ doc }}
            </li>
          </ul>
        </div>
        <p v-if="!canApply && !requiredDocs.length" class="text-sm text-slate-400">Choose a permit type above.</p>

        <template v-if="canApply">
        <div v-if="form.permit_type && !filingOptions.length" class="rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
          <template v-if="rule && rule.business_only">A {{ form.permit_type }} permit is filed for a business. Register a business from your dashboard and wait for it to be verified.</template>
          <template v-else>To file this permit as yourself you need to be a verified Resident, or file it for one of your verified businesses.</template>
        </div>
        <template v-else-if="form.permit_type">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1" for="filing-as">Filing as</label>
          <select id="filing-as" v-model="form.business_id"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
            <option v-for="o in filingOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Property Address</label>
          <input v-model="form.property_address" type="text" placeholder="123 Aguinaldo Hwy, Dasmariñas"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Project Description</label>
          <textarea v-model="form.project_description" rows="3" placeholder="Adding a second seating area and updating the kitchen layout…"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"></textarea>
        </div>

        <div v-if="requiredDocs.length">
          <label class="block text-sm font-semibold text-slate-700 mb-2">Required Documents</label>
          <div class="space-y-2">
            <label
              v-for="doc in requiredDocs" :key="doc"
              class="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition"
              :class="files[fieldKey(doc)] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50'"
            >
              <svg v-if="files[fieldKey(doc)]" class="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              <svg v-else class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              <span class="text-sm font-semibold" :class="files[fieldKey(doc)] ? 'text-emerald-700' : 'text-slate-600'">
                {{ files[fieldKey(doc)] ? doc + ' — ' + files[fieldKey(doc)].name : 'Upload ' + doc }}
              </span>
              <input type="file" class="hidden" @change="onFile(doc, $event)" />
            </label>
          </div>
          <p class="text-xs text-slate-400 mt-2">You can upload any missing documents later from the permit's detail page.</p>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button type="submit" :disabled="submitting" class="w-full py-2.5 rounded-md bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-sm">
          {{ submitting ? 'Submitting…' : 'Submit Application' }}
        </button>
        </template>
        </template>
      </form>
    </div>
  </AppShell>
  `,
};

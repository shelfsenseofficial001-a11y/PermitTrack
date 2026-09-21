import { apiGet, apiPostForm } from '../api/client.js';
import AppShell from './AppShell.js';

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
        business_name: '',
        project_description: '',
      },
      requiredDocs: [],
      files: {},
      error: '',
      submitting: false,
    };
  },
  watch: {
    async 'form.permit_type'(type) {
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
      <h1 class="text-2xl font-bold text-ink-700">Start a New Application</h1>
      <p class="text-slate-500 text-sm mt-1 mb-6">Tell us what you're applying for — we'll only ask for what's actually required.</p>

      <form @submit.prevent="submit" class="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
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
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Property Address</label>
          <input v-model="form.property_address" type="text" placeholder="214 Maple Ct, Springfield"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Business Name <span class="text-slate-400 font-normal">(optional)</span></label>
          <input v-model="form.business_name" type="text" placeholder="Downtown Café"
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
      </form>
    </div>
  </AppShell>
  `,
};

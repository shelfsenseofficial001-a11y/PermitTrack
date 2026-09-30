import { apiGet, apiPostForm } from '../api/client.js?v=69';
import AppShell from './AppShell.js?v=69';
import { authState } from '../store/auth.js?v=69';

const TRACK_LABELS = {
  construction: 'Construction & Property',
  business: 'Business & Commercial',
  personal: 'Personal / Barangay Documents',
  barangay_standalone: 'Barangay Clearances (standalone)',
};

export default {
  name: 'NewApplication',
  components: { AppShell },
  data() {
    return {
      form: {
        permit_type_id: '',
        property_address: '',
        business_id: '',
        project_description: '',
        conditions: {}, // condition_key -> 'yes' | 'no', forced before submit
      },
      files: {},
      error: '',
      submitting: false,
      authState,
      catalog: null, // { permit_types, businesses }
    };
  },
  computed: {
    canApply() {
      return !!(this.authState.user && this.authState.user.can_apply);
    },
    groupedTypes() {
      if (!this.catalog) return [];
      const byTrack = {};
      for (const t of this.catalog.permit_types) {
        (byTrack[t.track] = byTrack[t.track] || []).push(t);
      }
      return Object.keys(byTrack).map((track) => ({
        track,
        label: TRACK_LABELS[track] || track,
        types: byTrack[track],
      }));
    },
    selectedType() {
      if (!this.catalog || !this.form.permit_type_id) return null;
      return this.catalog.permit_types.find((t) => String(t.id) === String(this.form.permit_type_id));
    },
    // Who this permit can be filed as: '' = the user as a Resident, or a business id
    filingOptions() {
      if (!this.selectedType) return [];
      const opts = [];
      if (this.selectedType.as_resident) opts.push({ value: '', label: 'Myself (verified Resident)' });
      if (this.selectedType.as_business) {
        this.catalog.businesses.forEach((b) => opts.push({
          value: String(b.id),
          label: b.business_name + (b.trade_name ? ' (' + b.trade_name + ')' : ''),
        }));
      }
      return opts;
    },
    // Every branch question for the selected type must be answered before submitting — forced,
    // no default. See BREAKING_CHANGES.md #4.
    allConditionsAnswered() {
      if (!this.selectedType) return true;
      return this.selectedType.questions.every((q) => this.form.conditions[q.condition_key] !== undefined);
    },
  },
  async mounted() {
    if (this.canApply) {
      this.catalog = await apiGet('applications.php?action=permit_types');
    }
  },
  watch: {
    'form.business_id'(id) {
      const b = this.catalog && this.catalog.businesses.find((x) => String(x.id) === id);
      if (b) this.form.property_address = `${b.address_line}, Brgy. ${b.barangay}, ${b.city} ${b.postal_code}`;
    },
    'form.permit_type_id'() {
      this.form.business_id = this.filingOptions.length ? this.filingOptions[0].value : '';
      this.form.conditions = {};
      this.files = {};
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
      if (!this.form.permit_type_id) {
        this.error = 'Please choose a permit type.';
        return;
      }
      if (this.selectedType && !this.selectedType.track.startsWith('barangay') && this.selectedType.track !== 'personal' && !this.form.property_address.trim()) {
        this.error = 'Property address is required.';
        return;
      }
      if (!this.allConditionsAnswered) {
        this.error = 'Please answer every question below before submitting.';
        return;
      }
      this.submitting = true;
      try {
        const fd = new FormData();
        fd.append('permit_type_id', this.form.permit_type_id);
        fd.append('property_address', this.form.property_address);
        fd.append('business_id', this.form.business_id);
        fd.append('project_description', this.form.project_description);
        const conditions = {};
        Object.entries(this.form.conditions).forEach(([k, v]) => { conditions[k] = v === 'yes'; });
        fd.append('conditions', JSON.stringify(conditions));
        Object.entries(this.files).forEach(([key, file]) => {
          if (file) fd.append(key, file);
        });
        const res = await apiPostForm('applications.php?action=create_v2', fd);
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
        {{ canApply ? "Tell us what you're applying for — we'll only ask for what's actually required." : 'Sign in and verify your account to apply.' }}
      </p>

      <div v-if="!canApply" class="flex items-start gap-3 bg-sun-50 border border-sun-200 rounded-2xl px-4 py-3 mb-6">
        <svg class="w-5 h-5 text-sun-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p class="text-sm text-sun-700">You're browsing as a <strong>Normal User</strong>. To apply for a permit, verify your account as a Resident or Business Owner from your dashboard.</p>
      </div>

      <form v-if="canApply" @submit.prevent="submit" class="bg-white rounded-2xl border border-brand-100 p-6 space-y-6">
        <div v-for="group in groupedTypes" :key="group.track">
          <label class="block text-sm font-semibold text-slate-700 mb-2">{{ group.label }}</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in group.types" :key="t.id" type="button"
              @click="form.permit_type_id = String(t.id)"
              class="px-4 py-2 rounded-full text-sm font-semibold border transition"
              :class="String(form.permit_type_id) === String(t.id) ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-brand-300'"
            >{{ t.name }}</button>
          </div>
        </div>

        <template v-if="selectedType">
        <div v-if="!filingOptions.length" class="rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
          <template v-if="!selectedType.resident_eligible">A {{ selectedType.name }} permit is filed for a business. Register a business from your dashboard and wait for it to be verified.</template>
          <template v-else>To file this permit as yourself you need to be a verified Resident, or file it for one of your verified businesses.</template>
        </div>
        <template v-else>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1" for="filing-as">Filing as</label>
          <select id="filing-as" v-model="form.business_id"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
            <option v-for="o in filingOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div v-if="selectedType.track === 'construction' || selectedType.track === 'business'">
          <label class="block text-sm font-semibold text-slate-700 mb-1">Property Address</label>
          <input v-model="form.property_address" type="text" placeholder="123 Aguinaldo Hwy, Dasmariñas"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div v-if="selectedType.track === 'construction'">
          <label class="block text-sm font-semibold text-slate-700 mb-1">Project Description</label>
          <textarea v-model="form.project_description" rows="3" placeholder="Adding a second seating area and updating the kitchen layout…"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"></textarea>
        </div>

        <div v-if="selectedType.required_documents.length">
          <label class="block text-sm font-semibold text-slate-700 mb-2">Required Documents</label>
          <div class="space-y-2">
            <label
              v-for="doc in selectedType.required_documents" :key="doc"
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

        <!-- Forced branch questions: every one must be answered before submitting. An unanswered
             or falsely-declared condition risks the permit being voided later — see spec. -->
        <div v-if="selectedType.questions.length" class="space-y-3 rounded-xl bg-meadow border border-brand-100 px-4 py-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Before you submit</p>
          <div v-for="q in selectedType.questions" :key="q.condition_key">
            <p class="text-sm font-medium text-slate-700 mb-1.5">{{ q.label }}</p>
            <div class="flex gap-2">
              <button type="button" @click="form.conditions[q.condition_key] = 'yes'"
                class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                :class="form.conditions[q.condition_key] === 'yes' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600'"
              >Yes</button>
              <button type="button" @click="form.conditions[q.condition_key] = 'no'"
                class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                :class="form.conditions[q.condition_key] === 'no' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600'"
              >No</button>
            </div>
          </div>
          <p class="text-xs text-slate-400">Answer honestly — an undeclared condition discovered later voids the permit.</p>
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

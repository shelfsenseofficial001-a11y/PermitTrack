import { apiGet, apiPostForm } from '../api/client.js?v=108';
import AppShell from './AppShell.js?v=108';
import { loadCurrentUser } from '../store/auth.js?v=108';
import { formatDate, backButtonClass, backIconClass } from '../util.js?v=108';
import Loader from './Loader.js?v=108';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';

function emptyForm() {
  return {
    business_name: '', trade_name: '', ownership_type: '', line_of_business: '', registration_number: '', tin: '',
    address_line: '', barangay: '', business_email: '', business_phone: '',
    floor_area_sqm: '', employee_count: '', is_registered_owner: true, representative_role: '', representative_id_type: '',
  };
}

export default {
  name: 'BusinessForm',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { AppShell, Loader },
  data() {
    return {
      loading: true,
      options: { ownership_types: [], lines_of_business: [], id_types: [], barangays: [], max_file_mb: 5 },
      business: null, // existing record when editing / viewing
      form: emptyForm(),
      files: {}, // doc_key -> File
      declaration: false,
      submitting: false,
      error: '',
      inputClass, labelClass,
    };
  },
  computed: {
    isNew() {
      return !this.$route.params.id;
    },
    editable() {
      return this.isNew || (this.business && ['draft', 'rejected'].includes(this.business.status));
    },
    ownership() {
      return this.options.ownership_types.find((o) => o.value === this.form.ownership_type) || null;
    },
    needsRole() {
      return this.form.ownership_type && (this.form.ownership_type !== 'sole_proprietorship' || !this.form.is_registered_owner);
    },
    // Mirrors business_required_docs() on the server
    requiredDocs() {
      const docs = [
        { key: 'registration', label: this.ownership ? this.ownership.registration : 'Business registration certificate (DTI / SEC / CDA)' },
        { key: 'representative_id', label: "Your primary government ID (name must match the registration)" },
        { key: 'barangay_clearance', label: 'Barangay Business Clearance' },
        { key: 'location_proof', label: 'Proof of business location (lease contract, land title or tax declaration)' },
      ];
      if (this.form.ownership_type && this.form.ownership_type !== 'sole_proprietorship') {
        docs.push({ key: 'authority', label: "Secretary's Certificate or Board/Partners' Resolution naming you as representative" });
      } else if (this.form.ownership_type && !this.form.is_registered_owner) {
        docs.push({ key: 'authority', label: 'Special Power of Attorney (SPA) or authorization letter from the owner' });
      }
      return docs;
    },
    existingDocs() {
      const map = {};
      (this.business ? this.business.documents : []).forEach((d) => { map[d.doc_key] = d; });
      return map;
    },
  },
  async mounted() {
    const [opts, res] = await Promise.all([
      apiGet('business.php?action=options'),
      this.isNew ? Promise.resolve(null) : apiGet('business.php?action=get&id=' + this.$route.params.id),
    ]);
    this.options = opts;
    if (res) {
      this.business = res.business;
      const b = res.business;
      Object.keys(this.form).forEach((k) => {
        if (b[k] !== undefined && b[k] !== null) this.form[k] = b[k];
      });
      this.form.is_registered_owner = !!b.is_registered_owner;
      const rep = b.documents.find((d) => d.doc_key === 'representative_id');
      if (rep) this.form.representative_id_type = rep.id_type || '';
    }
    this.loading = false;
  },
  methods: {
    formatDate,
    fileUrl(id) {
      return 'api/business.php?action=file&id=' + id;
    },
    onFile(key, event) {
      const file = event.target.files[0] || null;
      this.error = '';
      if (file && file.size > this.options.max_file_mb * 1048576) {
        this.error = `That file is too large. The limit is ${this.options.max_file_mb} MB.`;
        event.target.value = '';
        return;
      }
      this.files[key] = file;
    },
    async submit() {
      this.error = '';
      const missing = this.requiredDocs.find((d) => !this.files[d.key] && !this.existingDocs[d.key]);
      if (missing) {
        this.error = 'Please upload: ' + missing.label + '.';
        return;
      }
      if (!this.declaration) {
        this.error = 'Please confirm that the information and documents are true and correct.';
        return;
      }
      this.submitting = true;
      try {
        const fd = new FormData();
        if (this.business) fd.append('id', this.business.id);
        Object.entries(this.form).forEach(([k, v]) => fd.append(k, k === 'is_registered_owner' ? (v ? '1' : '0') : String(v ?? '').trim()));
        Object.entries(this.files).forEach(([key, file]) => { if (file) fd.append('doc_' + key, file); });
        fd.append('declaration', '1');
        const res = await apiPostForm('business.php?action=save', fd);
        await loadCurrentUser();
        this.business = res.business;
        this.files = {};
        if (this.isNew) this.$router.replace('/businesses/' + res.business.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        this.error = e.message;
      } finally {
        this.submitting = false;
      }
    },
  },
  template: `
  <AppShell>
    <router-link to="/dashboard" :class="[backButtonClass, 'mb-3']">
      <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
      Back to Dashboard
    </router-link>

    <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mb-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Business Owner</p>
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{{ isNew ? 'Add your business' : (business ? business.business_name : 'Business') }}</h1>
      <p class="text-sm text-white/85 mt-1 max-w-xl">
        This records a business that already exists and already trades in Dasmariñas — PermitTrack
        does not form businesses, so bring the DTI, SEC or CDA certificate you already hold. City
        Staff check the details against it, and once they match you can file and renew permits here.
      </p>
    </div>

    <Loader v-if="loading" kind="business" />

    <template v-else>
      <!-- Status banners -->
      <div v-if="business && business.status === 'approved'" class="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-2xl px-5 py-4 mb-6">
        <span class="text-brand-700 font-bold">✓</span>
        <div class="text-sm text-brand-700"><strong>Verified</strong> on {{ formatDate(business.reviewed_at) }}. You can apply for business permits for this business.
          <router-link to="/applications/new" class="font-semibold underline ml-1">Start a New Application</router-link></div>
      </div>
      <div v-else-if="business && business.status === 'pending'" class="flex items-start gap-3 bg-sun-50 border border-sun-300 rounded-2xl px-5 py-4 mb-6">
        <span class="text-sun-700 font-bold">⏳</span>
        <div class="text-sm text-sun-700"><strong>Under review</strong> — submitted {{ formatDate(business.submitted_at) }}. We'll notify you when City Staff has checked it.</div>
      </div>
      <div v-else-if="business && business.status === 'rejected'" class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6" role="alert">
        <span class="text-red-600 font-bold">!</span>
        <div class="text-sm text-red-700"><strong>Not approved:</strong> {{ business.rejection_reason }}<br><span class="text-xs">Fix the issue below and resubmit. You only need to re-upload documents that changed.</span></div>
      </div>
      <div v-else-if="business && business.status === 'draft'" class="flex items-start gap-3 bg-sun-50 border border-sun-300 rounded-2xl px-5 py-4 mb-6">
        <span class="text-sun-700 font-bold">✎</span>
        <div class="text-sm text-sun-700"><strong>Draft</strong> — we carried this over from your earlier business details. Complete the missing fields, upload the documents and submit.</div>
      </div>

      <form @submit.prevent="submit" class="grid lg:grid-cols-3 gap-6" novalidate>
        <fieldset :disabled="!editable" class="lg:col-span-2 space-y-6 min-w-0">
          <section class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">1. Business details</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label :class="labelClass" for="b-name">Registered business name</label>
                <input id="b-name" v-model="form.business_name" type="text" placeholder="As shown on your DTI / SEC / CDA certificate" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-trade">Trade name <span class="text-slate-400 font-normal">(optional)</span></label>
                <input id="b-trade" v-model="form.trade_name" type="text" placeholder="Name on your signage" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-own">Type of ownership</label>
                <select id="b-own" v-model="form.ownership_type" :class="inputClass">
                  <option value="" disabled>Choose…</option>
                  <option v-for="o in options.ownership_types" :key="o.value" :value="o.value">{{ o.label }} ({{ o.agency }})</option>
                </select>
              </div>
              <div>
                <label :class="labelClass" for="b-line">Line of business</label>
                <select id="b-line" v-model="form.line_of_business" :class="inputClass">
                  <option value="" disabled>Choose…</option>
                  <option v-for="l in options.lines_of_business" :key="l" :value="l">{{ l }}</option>
                </select>
              </div>
              <div>
                <label :class="labelClass" for="b-reg">{{ ownership ? ownership.agency : 'DTI / SEC / CDA' }} registration no.</label>
                <input id="b-reg" v-model="form.registration_number" type="text" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-tin">TIN</label>
                <input id="b-tin" v-model="form.tin" type="text" inputmode="numeric" placeholder="123-456-789-000" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-area">Floor area (sq m) <span class="text-slate-400 font-normal">(optional)</span></label>
                <input id="b-area" v-model="form.floor_area_sqm" type="number" min="0" step="0.01" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-emp">No. of employees <span class="text-slate-400 font-normal">(optional)</span></label>
                <input id="b-emp" v-model="form.employee_count" type="number" min="0" step="1" :class="inputClass" />
              </div>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">2. Business location &amp; contact</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label :class="labelClass" for="b-street">House / unit no. and street</label>
                <input id="b-street" v-model="form.address_line" type="text" :class="inputClass" />
              </div>
              <!-- Typed against the barangays table, not free text: this is what decides which
                   barangay secretariat reviews every permit the business later files. -->
              <div class="sm:col-span-2">
                <label :class="labelClass" for="b-brgy">Barangay</label>
                <input id="b-brgy" v-model="form.barangay" list="b-barangay-list" type="text"
                  placeholder="Start typing to search…" autocomplete="off" :class="inputClass" />
                <datalist id="b-barangay-list">
                  <option v-for="b in options.barangays" :key="b.id" :value="b.name" />
                </datalist>
                <p class="text-xs text-slate-400 mt-1">
                  All {{ options.barangays.length }} barangays of Dasmariñas. The city is assumed —
                  PermitTrack does not cover anywhere else.
                </p>
              </div>
              <div>
                <label :class="labelClass" for="b-email">Business email <span class="text-slate-400 font-normal">(optional)</span></label>
                <input id="b-email" v-model="form.business_email" type="email" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-phone">Business phone <span class="text-slate-400 font-normal">(optional)</span></label>
                <input id="b-phone" v-model="form.business_phone" type="tel" :class="inputClass" />
              </div>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-1">3. Business representative (you)</h2>
            <p class="text-sm text-slate-500 mb-4">Your government ID must match the name on the registration certificate, or you must upload a document authorizing you.</p>
            <label v-if="form.ownership_type === 'sole_proprietorship'" class="flex items-center gap-3 rounded-xl bg-meadow p-3 mb-4 cursor-pointer">
              <input v-model="form.is_registered_owner" type="checkbox" class="w-4 h-4 accent-[#1f7a3a]" />
              <span class="text-sm text-slate-700">I am the owner named on the DTI certificate</span>
            </label>
            <div class="grid sm:grid-cols-2 gap-4">
              <div v-if="needsRole">
                <label :class="labelClass" for="b-role">Your role</label>
                <input id="b-role" v-model="form.representative_role" type="text" placeholder="e.g. President, Authorized representative" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass" for="b-idtype">Government ID you're uploading</label>
                <select id="b-idtype" v-model="form.representative_id_type" :class="inputClass">
                  <option value="" disabled>Choose…</option>
                  <option v-for="t in options.id_types" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-1">4. Documents</h2>
            <p class="text-sm text-slate-500 mb-4">PDF, JPG, PNG or WEBP, up to {{ options.max_file_mb }} MB each.
              <span v-if="!form.ownership_type" class="text-sun-700">Choose the type of ownership first — it decides which documents are needed.</span></p>
            <ul class="space-y-3">
              <li v-for="d in requiredDocs" :key="d.key" class="rounded-xl border border-slate-200 p-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                  <div class="text-sm font-semibold text-slate-800">{{ d.label }}</div>
                  <a v-if="existingDocs[d.key]" :href="fileUrl(existingDocs[d.key].id)" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">
                    View current: {{ existingDocs[d.key].original_filename }}
                  </a>
                </div>
                <label v-if="editable" class="mt-2 flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition"
                  :class="files[d.key] ? 'border-brand-300 bg-brand-50' : 'border-slate-300 hover:border-brand-300'">
                  <span class="text-sm font-semibold" :class="files[d.key] ? 'text-brand-700' : 'text-slate-500'">
                    {{ files[d.key] ? '✓ ' + files[d.key].name : existingDocs[d.key] ? 'Replace file (optional)' : 'Choose a file' }}
                  </span>
                  <input type="file" class="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" @change="onFile(d.key, $event)" />
                </label>
              </li>
            </ul>
          </section>
        </fieldset>

        <aside v-if="editable" class="bg-white rounded-2xl border border-brand-100 p-6 h-fit lg:sticky lg:top-24">
          <h2 class="font-bold text-ink-700 mb-3">5. Declaration</h2>
          <label class="flex items-start gap-3 rounded-xl bg-meadow p-3 cursor-pointer">
            <input v-model="declaration" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#1f7a3a] shrink-0" />
            <span class="text-sm text-slate-600 leading-relaxed">I certify that the information above is true and correct, and that the documents are genuine.</span>
          </label>
          <p v-if="error" class="text-sm text-red-600 mt-4" role="alert">{{ error }}</p>
          <button type="submit" :disabled="submitting"
            class="w-full mt-4 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition">
            {{ submitting ? 'Uploading…' : (business && business.status === 'rejected' ? 'Resubmit for verification' : 'Submit for verification') }}
          </button>
          <p class="text-xs text-slate-400 mt-3">Your documents are stored privately and only City Staff can view them.</p>
        </aside>
      </form>
    </template>
  </AppShell>
  `,
};

import { apiGet, apiPost, downloadUrl } from '../api/client.js?v=60';
import StaffShell from './StaffShell.js?v=60';
import { permitNumber, formatDate, backButtonClass, backIconClass } from '../util.js?v=60';

const STATUS_OPTIONS = ['Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved', 'Rejected'];

export default {
  name: 'ReviewDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { StaffShell },
  data() {
    return {
      app: null,
      loading: true,
      statusOptions: STATUS_OPTIONS,
      decision: { status: '', notes: '' },
      saving: false,
      docActionId: null,
      error: '',
      saved: false,
    };
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    permitNumber,
    formatDate,
    downloadUrl,
    async refresh() {
      this.loading = true;
      const id = this.$route.params.id;
      const res = await apiGet(`applications.php?action=detail&id=${id}`);
      this.app = res.application;
      this.decision.status = this.app.status;
      this.loading = false;
    },
    async reviewDocument(doc, status) {
      this.docActionId = doc.id;
      try {
        await apiPost('documents.php?action=review', { document_id: doc.id, status });
        await this.refresh();
      } finally {
        this.docActionId = null;
      }
    },
    async saveDecision() {
      this.error = '';
      this.saved = false;
      this.saving = true;
      try {
        await apiPost('reviewer.php?action=decision', {
          application_id: this.app.id,
          status: this.decision.status,
          notes: this.decision.notes,
        });
        this.decision.notes = '';
        this.saved = true;
        await this.refresh();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
  <StaffShell>
    <div v-if="loading" class="text-slate-400 text-sm">Loading…</div>
    <template v-else-if="app">
      <router-link to="/reviewer" :class="backButtonClass">
        <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
        Back to Queue
      </router-link>

      <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mt-3 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
        <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Permit #{{ permitNumber(app) }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{{ app.applicant.full_name }} &mdash; {{ app.permit_type }} Permit</h1>
        <div class="text-sm text-white/85 mt-1">Submitted {{ formatDate(app.created_at) }}</div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Applicant Information</h2>
            <dl class="grid sm:grid-cols-2 gap-4 text-sm">
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Contact</dt><dd class="font-semibold text-slate-800">{{ app.applicant.full_name }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Email</dt><dd class="font-semibold text-slate-800">{{ app.applicant.email }}</dd></div>
              <div v-if="app.applicant.phone"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Mobile</dt><dd class="font-semibold text-slate-800">{{ app.applicant.phone }}</dd></div>
              <div v-if="app.applicant.address_line"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Home address</dt><dd class="font-semibold text-slate-800">{{ app.applicant.address_line }}, Brgy. {{ app.applicant.barangay }}, {{ app.applicant.city }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Resident status</dt><dd class="font-semibold text-slate-800">{{ app.applicant.resident_status === 'verified' ? 'Verified Resident' : 'Not a verified Resident' }}</dd></div>
              <template v-if="app.business">
                <div class="sm:col-span-2 pt-2 border-t border-slate-100"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Filed for business</dt><dd class="font-semibold text-slate-800">{{ app.business.business_name }}<span v-if="app.business.trade_name" class="font-normal text-slate-500"> ({{ app.business.trade_name }})</span> <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="app.business.status === 'approved' ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'">{{ app.business.status === 'approved' ? 'Verified' : app.business.status }}</span></dd></div>
                <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">{{ app.business.ownership_label }} reg. no.</dt><dd class="font-semibold text-slate-800">{{ app.business.registration_number }}</dd></div>
                <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">TIN</dt><dd class="font-semibold text-slate-800">{{ app.business.tin }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Business location</dt><dd class="font-semibold text-slate-800">{{ app.business.address_line }}, Brgy. {{ app.business.barangay }}, {{ app.business.city }} {{ app.business.postal_code }}</dd></div>
              </template>
              <div v-else-if="app.business_name"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Business (entered before verification existed)</dt><dd class="font-semibold text-slate-800">{{ app.business_name }}</dd></div>
              <div class="sm:col-span-2" v-if="app.project_description"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Project description</dt><dd class="text-slate-800">{{ app.project_description }}</dd></div>
            </dl>
          </div>

          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Submitted Documents</h2>
            <ul class="divide-y divide-slate-100">
              <li v-for="doc in app.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-slate-800 truncate">{{ doc.doc_name }}</div>
                  <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-xs font-semibold text-brand-600 hover:underline">View file</a>
                  <span v-else class="text-xs text-slate-400">Not uploaded</span>
                </div>
                <div v-if="doc.file_path" class="flex items-center gap-2 shrink-0">
                  <button
                    :disabled="docActionId === doc.id" @click="reviewDocument(doc, 'Verified')"
                    class="text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    :class="doc.status === 'Verified' ? 'bg-brand-100 text-brand-700' : 'border border-slate-300 text-slate-600 hover:bg-meadow'"
                  >Approve</button>
                  <button
                    :disabled="docActionId === doc.id" @click="reviewDocument(doc, 'Needs Re-upload')"
                    class="text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    :class="doc.status === 'Needs Re-upload' ? 'bg-red-100 text-red-700' : 'border border-slate-300 text-slate-600 hover:bg-meadow'"
                  >Reject</button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-brand-100 p-6 h-fit">
          <h2 class="font-bold text-ink-700 mb-4">Update Status</h2>
          <div class="space-y-2">
            <button
              v-for="s in statusOptions" :key="s"
              type="button" @click="decision.status = s"
              class="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold border transition"
              :class="decision.status === s
                ? (s === 'Rejected' ? 'bg-red-600 border-red-600 text-white' : s === 'Approved' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-sun-400 border-sun-400 text-ink-700')
                : (s === 'Rejected' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-300 text-slate-700 hover:bg-meadow hover:border-brand-300')"
            >{{ s === 'Approved' ? 'Approved / Issue Permit' : s === 'Rejected' ? 'Denied' : s }}</button>
          </div>

          <label class="block text-sm font-semibold text-slate-700 mt-5 mb-1">Inspector Notes <span class="text-slate-400 font-normal">(visible to applicant)</span></label>
          <textarea v-model="decision.notes" rows="4" placeholder="Please upload an updated floor plan…" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>

          <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
          <p v-if="saved" class="text-sm text-brand-700 mt-3">Saved and applicant notified.</p>

          <button @click="saveDecision" :disabled="saving" class="w-full mt-4 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-[0_12px_24px_-8px_rgba(31,122,58,0.55)]">
            {{ saving ? 'Saving…' : 'Save & Notify Applicant' }}
          </button>
        </div>
      </div>
    </template>
  </StaffShell>
  `,
};

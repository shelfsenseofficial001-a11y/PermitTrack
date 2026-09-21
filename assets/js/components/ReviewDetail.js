import { apiGet, apiPost, downloadUrl } from '../api/client.js';
import StaffShell from './StaffShell.js';
import { permitNumber, formatDate } from '../util.js';

const STATUS_OPTIONS = ['Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved', 'Rejected'];

export default {
  name: 'ReviewDetail',
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
      <router-link to="/reviewer" class="text-sm text-slate-500 hover:text-brand-600 inline-flex items-center gap-1">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        Back to Queue
      </router-link>

      <h1 class="text-xl font-bold text-ink-700 mt-3">{{ app.applicant.full_name }} &mdash; {{ app.permit_type }} Permit</h1>
      <div class="text-sm text-slate-500 mt-1">Permit #{{ permitNumber(app) }} &middot; Submitted {{ formatDate(app.created_at) }}</div>

      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-xl border border-slate-200 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Applicant Information</h2>
            <dl class="grid sm:grid-cols-2 gap-4 text-sm">
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Contact</dt><dd class="font-semibold text-slate-800">{{ app.applicant.full_name }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Email</dt><dd class="font-semibold text-slate-800">{{ app.applicant.email }}</dd></div>
              <div v-if="app.applicant.business_name"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Business</dt><dd class="font-semibold text-slate-800">{{ app.applicant.business_name }}</dd></div>
              <div v-if="app.applicant.ein"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">EIN</dt><dd class="font-semibold text-slate-800">{{ app.applicant.ein }}</dd></div>
              <div v-if="app.applicant.phone"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Phone</dt><dd class="font-semibold text-slate-800">{{ app.applicant.phone }}</dd></div>
              <div v-if="app.applicant.address"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Address</dt><dd class="font-semibold text-slate-800">{{ app.applicant.address }}</dd></div>
              <div class="sm:col-span-2" v-if="app.project_description"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Project description</dt><dd class="text-slate-800">{{ app.project_description }}</dd></div>
            </dl>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-6">
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
                    class="text-xs font-bold px-3 py-1.5 rounded-md transition"
                    :class="doc.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'"
                  >Approve</button>
                  <button
                    :disabled="docActionId === doc.id" @click="reviewDocument(doc, 'Needs Re-upload')"
                    class="text-xs font-bold px-3 py-1.5 rounded-md transition"
                    :class="doc.status === 'Needs Re-upload' ? 'bg-red-100 text-red-700' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'"
                  >Reject</button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 h-fit">
          <h2 class="font-bold text-ink-700 mb-4">Update Status</h2>
          <div class="space-y-2">
            <button
              v-for="s in statusOptions" :key="s"
              type="button" @click="decision.status = s"
              class="w-full text-left px-4 py-2.5 rounded-md text-sm font-semibold border transition"
              :class="decision.status === s
                ? (s === 'Rejected' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-white')
                : (s === 'Rejected' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50')"
            >{{ s === 'Approved' ? 'Approved / Issue Permit' : s === 'Rejected' ? 'Denied' : s }}</button>
          </div>

          <label class="block text-sm font-semibold text-slate-700 mt-5 mb-1">Inspector Notes <span class="text-slate-400 font-normal">(visible to applicant)</span></label>
          <textarea v-model="decision.notes" rows="4" placeholder="Please upload an updated floor plan…" class="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"></textarea>

          <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
          <p v-if="saved" class="text-sm text-emerald-600 mt-3">Saved and applicant notified.</p>

          <button @click="saveDecision" :disabled="saving" class="w-full mt-4 py-2.5 rounded-md bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-sm">
            {{ saving ? 'Saving…' : 'Save & Notify Applicant' }}
          </button>
        </div>
      </div>
    </template>
  </StaffShell>
  `,
};

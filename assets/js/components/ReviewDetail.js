import { apiGet, apiPost, downloadUrl } from '../api/client.js?v=119';
import StaffShell from './StaffShell.js?v=119';
import { permitNumber, formatDate, formatDateTime, backButtonClass, backIconClass , permitLabel} from '../util.js?v=119';
import Loader from './Loader.js?v=119';
import { authState } from '../store/auth.js?v=119';

const STATUS_OPTIONS = ['Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved', 'Rejected'];

export default {
  name: 'ReviewDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { StaffShell, Loader },
  data() {
    return {
      app: null,
      loading: true,
      statusOptions: STATUS_OPTIONS,
      decision: { status: '', notes: '' },
      pipelineNotes: '',
      saving: false,
      docActionId: null,
      error: '',
      saved: false,
    };
  },
  computed: {
    // Pipeline-mode applications (filed through the new 27-type flow) carry pipeline rows;
    // legacy applications (the original 5-type flow) have none. See BREAKING_CHANGES.md #3.
    isPipelineApp() {
      return !!(this.app && this.app.pipeline && this.app.pipeline.length);
    },
    currentStep() {
      return this.isPipelineApp ? this.app.pipeline.find((s) => s.status === 'current') : null;
    },
    // Only the office currently holding the application may act on it — enforced again
    // server-side in pipeline_decision, this is just so the buttons aren't shown misleadingly.
    canActOnCurrentStep() {
      const u = authState.user;
      return !!(u && this.currentStep && Number(u.department_id) === Number(this.currentStep.department_id));
    },
    permitTypeLabel() {
      // Pipeline apps carry no legacy permit_type (nullable since migration 010) — permit_type_name
      // comes from the permit_types join instead. See BREAKING_CHANGES.md #5.
      return (this.app && (this.app.permit_type || this.app.permit_type_name)) || 'Permit';
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    // The application's thread in Messages: where the applicant's messages about it arrive.
    async openThread() {
      this.error = '';
      try {
        const res = await apiGet('conversations.php?action=for_application&application_id=' + this.app.id);
        this.$router.push('/staff/messages/' + res.id);
      } catch (e) {
        this.error = e.message;
      }
    },
    permitLabel,
    permitNumber,
    formatDate,
    formatDateTime,
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
    async savePipelineDecision(decision) {
      this.error = '';
      this.saved = false;
      this.saving = true;
      try {
        const res = await apiPost('reviewer.php?action=pipeline_decision', {
          application_id: this.app.id,
          decision,
          notes: this.pipelineNotes,
        });
        this.pipelineNotes = '';
        this.saved = true;
        this.lastResultStatus = res.status;
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
    <Loader v-if="loading" kind="review" />
    <template v-else-if="app">
      <router-link to="/reviewer" :class="backButtonClass">
        <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
        Back to Queue
      </router-link>

      <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mt-3 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
        <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Permit #{{ permitNumber(app) }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{{ app.applicant.full_name }} &mdash; {{ permitLabel(permitTypeLabel) }}</h1>
        <div class="text-sm text-white/85 mt-1">Submitted {{ formatDateTime(app.created_at) }}</div>
        <button v-if="isPipelineApp" type="button" @click="openThread"
          class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-700 bg-white/95 hover:bg-white px-4 py-2 rounded-xl shadow-sm transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
          Message the applicant
        </button>
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
                  <div v-if="doc.uploaded_at" class="text-xs text-slate-400 mt-0.5">Uploaded {{ formatDateTime(doc.uploaded_at) }}</div>
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

        <!-- Pipeline apps (27-type flow): one office at a time, sequential. See BREAKING_CHANGES.md #6. -->
        <div v-if="isPipelineApp" class="bg-white rounded-2xl border border-brand-100 p-6 h-fit">
          <h2 class="font-bold text-ink-700 mb-4">Pipeline</h2>
          <ol class="space-y-3 mb-5">
            <li v-for="step in app.pipeline" :key="step.id" class="flex items-center gap-3 text-sm">
              <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                :class="step.status === 'approved' ? 'bg-brand-100 text-brand-700' : step.status === 'rejected' ? 'bg-red-100 text-red-700' : step.status === 'current' ? 'bg-sun-400 text-ink-700' : 'bg-slate-100 text-slate-400'">
                <svg v-if="step.status === 'approved'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                <svg v-else-if="step.status === 'rejected'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                <template v-else>&middot;</template>
              </span>
              <div class="min-w-0">
                <div class="font-semibold text-slate-700 truncate">{{ step.department_name }}</div>
                <div class="text-xs text-slate-400">{{ step.step_label }}</div>
              </div>
            </li>
          </ol>

          <template v-if="currentStep">
            <div v-if="!canActOnCurrentStep" class="rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
              This application is currently waiting on <strong>{{ currentStep.department_name }}</strong> — not your office.
            </div>
            <template v-else>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Notes <span class="text-slate-400 font-normal">(visible to applicant)</span></label>
              <textarea v-model="pipelineNotes" rows="4" placeholder="Looks good — proceeding to the next office…" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>

              <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
              <p v-if="saved" class="text-sm text-brand-700 mt-3">Saved and applicant notified.</p>

              <div class="grid grid-cols-2 gap-3 mt-4">
                <button @click="savePipelineDecision('rejected')" :disabled="saving" class="py-3 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 transition">Reject</button>
                <button @click="savePipelineDecision('approved')" :disabled="saving" class="py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-[0_12px_24px_-8px_rgba(31,122,58,0.55)]">
                  {{ saving ? 'Saving…' : 'Approve' }}
                </button>
              </div>
            </template>
          </template>
          <p v-else class="text-sm text-slate-400">This pipeline has finished — {{ app.status }}.</p>
        </div>

        <!-- Legacy apps (original 5-type flow): single-stage status picker, untouched. -->
        <div v-else class="bg-white rounded-2xl border border-brand-100 p-6 h-fit">
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

import { apiGet, apiPost, downloadUrl } from '../api/client.js?v=129';
import StaffShell from './StaffShell.js?v=129';
import { permitNumber, formatDate, formatDateTime, backButtonClass, backIconClass, permitLabel, DOCUMENT_REJECT_REASONS, rejectReasonLabel } from '../util.js?v=129';
import { inputClass } from './AuthLayout.js?v=129';
import Loader from './Loader.js?v=129';
import BaseModal from './BaseModal.js?v=129';
import MaskedValue from './MaskedValue.js?v=129';
import SelectMenu from './SelectMenu.js?v=129';
import { authState } from '../store/auth.js?v=129';

const STATUS_OPTIONS = ['Under Review', 'Inspection Scheduled', 'Inspector Notes', 'Approved', 'Rejected'];

export default {
  name: 'ReviewDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { StaffShell, Loader, BaseModal, MaskedValue, SelectMenu },
  data() {
    return {
      app: null,
      loading: true,
      statusOptions: STATUS_OPTIONS,
      decision: { status: '', notes: '' },
      pipelineNotes: '',
      saving: false,
      docActionId: null,
      docError: '',
      docPrompt: null,   // { doc, status } while the confirmation dialog is open
      docPromptError: '',
      rejectReason: '',
      rejectNotes: '',
      rejectReasons: DOCUMENT_REJECT_REASONS,
      inputClass,
      loadError: '',     // the application could not be opened at all (wrong office, or gone)
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
    // The barangay holding step one. It may send any document back, but approving stays with the
    // office that owns it — mirrors the $isIntake rule in documents.php.
    isIntakeReviewer() {
      const u = authState.user;
      return !!(u && this.app && this.app.intake_department_id
        && Number(u.department_id) === Number(this.app.intake_department_id));
    },
    // The office still waiting its turn after the one holding the permit now.
    nextOfficeName() {
      if (!this.isPipelineApp) return null;
      const pending = this.app.pipeline.filter((s) => s.status === 'pending');
      return pending.length ? pending[0].department_name : null;
    },
    // Who the document lands with next — the line the reviewer actually needs before clicking.
    docPromptHandoff() {
      if (!this.docPrompt) return null;
      const { doc, status: decision } = this.docPrompt;
      if (decision === 'undo') return null;
      if (decision === 'reject') {
        const who = (this.app.applicant && this.app.applicant.full_name) || 'the applicant';
        return { lead: 'Goes back to', who: who + ', to upload again' };
      }
      if (this.docStage(doc) === 'intake') {
        return { lead: 'Next it goes to', who: doc.owner_department_name || 'the office that handles it' };
      }
      return this.nextOfficeName
        ? { lead: 'After your office signs off, the permit goes to', who: this.nextOfficeName }
        : { lead: 'This is the last office', who: 'the permit is issued once your step is signed off' };
    },
    docPromptTitle() {
      if (!this.docPrompt) return '';
      const { doc, status: decision } = this.docPrompt;
      if (decision === 'approve') {
        return this.docStage(doc) === 'intake' ? 'Pass this document through intake?' : 'Approve this document?';
      }
      return decision === 'reject' ? 'Reject this document?' : 'Undo this decision?';
    },
    holdsCurrentStep() {
      const u = authState.user;
      return !!(u && this.app && this.app.current_department_id
        && Number(u.department_id) === Number(this.app.current_department_id));
    },
    permitTypeLabel() {
      // Pipeline apps carry no legacy permit_type (nullable since migration 010) — permit_type_name
      // comes from the permit_types join instead. See BREAKING_CHANGES.md #5.
      return (this.app && (this.app.permit_type || this.app.permit_type_name)) || 'Permit';
    },
  },
  watch: {
    // An error that stays up after the thing it complained about is fixed reads as broken.
    rejectReason() { this.docPromptError = ''; },
    rejectNotes() { this.docPromptError = ''; },
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
    rejectReasonLabel,
    async refresh() {
      this.loading = true;
      const id = this.$route.params.id;
      try {
        const res = await apiGet(`applications.php?action=detail&id=${id}`);
        this.app = res.application;
        this.decision.status = this.app.status;
      } catch (e) {
        // A permit reaches an office in its turn, so a staff member following an old link or a
        // bookmark can land on one that is not theirs. Say so plainly instead of spinning forever.
        this.loadError = e.message;
      } finally {
        this.loading = false;
      }
    },
    // Which of the two checks this viewer is here to make on a document, or null for none.
    // Mirrors the $stage rule in documents.php, which is what actually enforces it.
    docStage(doc) {
      const u = authState.user;
      if (!u) return null;
      if (u.role === 'admin') return 'owner';              // Admins can free a stuck permit
      const dept = Number(u.department_id);
      const isOwner = !doc.owner_department_id || dept === Number(doc.owner_department_id);
      if (isOwner && this.holdsCurrentStep) return 'owner';
      if (this.isIntakeReviewer) return 'intake';
      return null;
    },
    // Approve is offered once per stage: intake passes it on, the owning office signs it off.
    canApproveDocument(doc) {
      const stage = this.docStage(doc);
      if (stage === 'intake') return doc.status === 'Pending Review';
      if (stage === 'owner') return doc.status !== 'Verified' && doc.status !== 'Missing' && doc.status !== 'Needs Re-upload';
      return false;
    },
    canRejectDocument(doc) {
      return this.docStage(doc) !== null && doc.status !== 'Needs Re-upload' && doc.status !== 'Missing';
    },
    // Undo takes back this office's own decision, so it is offered only on a decision it made.
    canUndoDocument(doc) {
      const stage = this.docStage(doc);
      if (stage === 'intake') return doc.status === 'Intake Approved' || doc.status === 'Needs Re-upload';
      if (stage === 'owner') return doc.status === 'Verified' || doc.status === 'Needs Re-upload';
      return false;
    },
    // The button repeats the title's verb: "Pass intake" is not the same act as "Approve".
    docConfirmLabel(decision) {
      if (decision === 'reject') return 'Reject';
      if (decision === 'undo') return 'Undo';
      return this.docPrompt && this.docStage(this.docPrompt.doc) === 'intake' ? 'Pass intake' : 'Approve';
    },
    // Approving, rejecting and undoing all land here, so each one is confirmed the same way.
    askDocument(doc, status) {
      this.docError = '';
      this.rejectReason = '';
      this.rejectNotes = '';
      this.docPrompt = { doc, status };
    },
    async confirmDocument() {
      const { doc, status: decision } = this.docPrompt;
      const payload = { document_id: doc.id, decision };
      if (decision === 'reject') {
        // The server checks this too; catching it here keeps the dialog open with what was typed.
        if (!this.rejectReason) {
          this.docPromptError = 'Please choose a reason.';
          return;
        }
        if (this.rejectReason === 'other' && !this.rejectNotes.trim()) {
          this.docPromptError = 'Please say what is wrong with the document.';
          return;
        }
        payload.reason = this.rejectReason;
        payload.notes = this.rejectNotes.trim();
      }
      this.docPrompt = null;
      this.docPromptError = '';
      this.docError = '';
      this.docActionId = doc.id;
      try {
        await apiPost('documents.php?action=review', payload);
        await this.refresh();
      } catch (e) {
        // Without this the refusal vanished and the buttons looked broken.
        this.docError = e.message;
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
    <div v-else-if="loadError" class="max-w-xl mx-auto mt-10 bg-white rounded-2xl border border-brand-100 p-8 text-center">
      <div class="w-12 h-12 mx-auto rounded-2xl bg-sun-100 text-sun-700 flex items-center justify-center mb-4" aria-hidden="true">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h1 class="text-xl font-bold text-ink-700 mb-2">You can't open this application</h1>
      <p class="text-sm text-slate-500 leading-relaxed mb-5">{{ loadError }}</p>
      <router-link to="/reviewer" class="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 transition">Back to my queue</router-link>
    </div>
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
                <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">{{ app.business.ownership_label }} reg. no.</dt><dd><MaskedValue :value="app.business.registration_number" :label="app.business.ownership_label + ' registration number'" /></dd></div>
                <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">TIN</dt><dd><MaskedValue :value="app.business.tin" label="TIN" /></dd></div>
                <div class="sm:col-span-2"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Business location</dt><dd class="font-semibold text-slate-800">{{ app.business.address_line }}, Brgy. {{ app.business.barangay }}, {{ app.business.city }} {{ app.business.postal_code }}</dd></div>
              </template>
              <div v-else-if="app.business_name"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Business (entered before verification existed)</dt><dd class="font-semibold text-slate-800">{{ app.business_name }}</dd></div>
              <div class="sm:col-span-2" v-if="app.project_description"><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Project description</dt><dd class="text-slate-800">{{ app.project_description }}</dd></div>
            </dl>
          </div>

          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Submitted Documents</h2>

            <div v-if="docError" class="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4" role="alert">
              <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              {{ docError }}
            </div>

            <ul class="divide-y divide-slate-100">
              <li v-for="doc in app.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-slate-800 truncate">{{ doc.doc_name }}</span>
                    <!-- The decision itself, which the buttons alone never actually stated -->
                    <span v-if="doc.status === 'Verified'" class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">Approved</span>
                    <span v-else-if="doc.status === 'Intake Approved'" class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sun-100 text-sun-700">Passed intake</span>
                    <span v-else-if="doc.status === 'Needs Re-upload'" class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>
                  </div>
                  <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-xs font-semibold text-brand-600 hover:underline">View file</a>
                  <span v-else class="text-xs text-slate-400">Not uploaded</span>
                  <div v-if="doc.uploaded_at" class="text-xs text-slate-400 mt-0.5">Uploaded {{ formatDateTime(doc.uploaded_at) }}</div>
                  <!-- Why it went back, so the next office is not left guessing either -->
                  <div v-if="doc.status === 'Needs Re-upload' && doc.reject_reason" class="text-xs text-red-600 mt-1 leading-snug">
                    {{ rejectReasonLabel(doc.reject_reason) }}<span v-if="doc.reject_notes" class="text-slate-500"> — {{ doc.reject_notes }}</span>
                  </div>
                </div>

                <div v-if="doc.file_path" class="flex items-center gap-2 shrink-0">
                  <!-- Someone else's paperwork: say whose, rather than only offering a button that
                       would be refused. At intake the barangay still gets Reject beside this. -->
                  <!-- Whose decision this is waiting on, when it is not this viewer's to make. -->
                  <span v-if="docStage(doc) === null && doc.owner_department_name"
                        class="text-[11px] text-slate-400 text-right max-w-[9rem] leading-snug">
                    Reviewed by {{ doc.owner_department_name }}
                  </span>
                  <span v-else-if="docStage(doc) === 'intake' && doc.owner_department_name && doc.status === 'Intake Approved'"
                        class="text-[11px] text-slate-400 text-right max-w-[9rem] leading-snug">
                    With {{ doc.owner_department_name }}
                  </span>
                  <button
                    v-if="canApproveDocument(doc)"
                    :disabled="docActionId === doc.id" @click="askDocument(doc, 'approve')"
                    class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-meadow disabled:opacity-60 transition"
                  >{{ docStage(doc) === 'intake' ? 'Pass intake' : 'Approve' }}</button>
                  <button
                    v-if="canRejectDocument(doc)"
                    :disabled="docActionId === doc.id" @click="askDocument(doc, 'reject')"
                    class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-meadow disabled:opacity-60 transition"
                  >Reject</button>
                  <!-- Misclicked? Take back this office's own decision. -->
                  <button
                    v-if="canUndoDocument(doc)"
                    :disabled="docActionId === doc.id" @click="askDocument(doc, 'undo')"
                    class="text-xs font-bold px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-60 transition"
                  >Undo</button>
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

    <!-- Confirms Approve, Reject and Undo alike: a document decision is visible to the applicant
         and gates the office's sign-off, so it should not turn on a single stray click. -->
    <BaseModal v-if="docPrompt"
      :title="docPromptTitle"
      :subtitle="docPrompt.doc.doc_name"
      eyebrow="Document review"
      :tone="docPrompt.status === 'reject' ? 'sun' : 'brand'"
      @close="docPrompt = null">

      <template #icon>
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      </template>

      <!-- Where this document goes next, said once and said plainly. It is the thing a reviewer
           most needs to know before clicking, so it gets its own line rather than being buried
           in a sentence. -->
      <div v-if="docPromptHandoff" class="flex items-center gap-3 rounded-xl p-3.5 mb-4"
           :class="docPrompt.status === 'reject' ? 'bg-sun-50' : 'bg-[#f3f9e3]'">
        <span class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              :class="docPrompt.status === 'reject' ? 'bg-sun-200 text-sun-700' : 'bg-brand-100 text-brand-700'" aria-hidden="true">
          <svg v-if="docPrompt.status === 'reject'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </span>
        <span class="text-sm text-slate-600 leading-snug">
          {{ docPromptHandoff.lead }}<br />
          <strong class="text-ink-700">{{ docPromptHandoff.who }}</strong>
        </span>
      </div>

      <!-- Why it is going back. Required, because this is the only thing the applicant can act on. -->
      <div v-if="docPrompt.status === 'reject'" class="space-y-3 mb-4">
        <div>
          <span id="doc-reject-reason-label" class="block text-xs font-semibold text-slate-600 mb-1.5">What's wrong with it?</span>
          <SelectMenu id="doc-reject-reason" v-model="rejectReason" :options="rejectReasons"
            placeholder="Choose a reason…" labelledby="doc-reject-reason-label" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="doc-reject-notes">
            Anything else to tell them?
            <span class="font-normal text-slate-400">{{ rejectReason === 'other' ? '(required)' : '(optional)' }}</span>
          </label>
          <textarea id="doc-reject-notes" v-model="rejectNotes" rows="2" maxlength="500"
            placeholder="e.g. page 2 is cut off — please scan the whole page"
            :class="inputClass + ' resize-none'"></textarea>
          <p class="text-[11px] text-slate-400 mt-1">The applicant sees this with the document.</p>
        </div>
      </div>

      <p class="text-sm text-slate-600 leading-relaxed">
        <template v-if="docPrompt.status === 'approve' && docStage(docPrompt.doc) === 'intake'">
          You're confirming the file opens, can be read, and is the document it's meant to be. You're not
          judging what it says — that's their job. Every document needs to pass intake before you can
          forward this application.
        </template>
        <template v-else-if="docPrompt.status === 'approve'">
          The applicant will see this document marked approved. Once every document your office handles is
          approved, you can sign off your step.
        </template>
        <template v-else-if="docPrompt.status === 'reject'">
          Use this when the file won't open, can't be read, or isn't the right document. They'll be asked to
          upload it again, and the permit stays put until they do.
        </template>
        <template v-else>
          This takes back your own decision and leaves the document as it was before. Nothing is sent to the applicant.
        </template>
      </p>

      <p v-if="docPromptError" class="text-sm text-red-600 mt-3" role="alert">{{ docPromptError }}</p>

      <template #footer>
        <button type="button" @click="docPrompt = null" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Cancel</button>
        <button type="button" @click="confirmDocument"
          class="ml-auto text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition"
          :class="docPrompt.status === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'">
          {{ docConfirmLabel(docPrompt.status) }}
        </button>
      </template>
    </BaseModal>
  </StaffShell>
  `,
};

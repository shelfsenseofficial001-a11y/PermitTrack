import { apiGet, apiPost, apiPostForm, downloadUrl } from '../api/client.js?v=118';
import AppShell from './AppShell.js?v=118';
import StatusStepper from './StatusStepper.js?v=118';
import { permitNumber, permitIconClass, formatDate, formatDateTime, backButtonClass, backIconClass, UPLOAD_ACCEPT, uploadTypeError , permitLabel} from '../util.js?v=118';
import { uiState, toggleReviewerHints } from '../store/ui.js?v=118';
import Loader from './Loader.js?v=118';
import BaseModal from './BaseModal.js?v=118';

export default {
  name: 'PermitDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { AppShell, StatusStepper, Loader, BaseModal },
  data() {
    return {
      uiState,
      app: null,
      activity: [],
      loading: true,
      newMessage: '',
      sending: false,
      reuploadingId: null,
      uploadAccept: UPLOAD_ACCEPT,
      docError: '',   // why the last file was refused, shown under the documents list
      // Editing the details in place, and taking the application back out of the queue. Both are
      // only offered while nobody has started reviewing it (the API's `editable`).
      editing: false,
      editForm: { property_address: '', project_description: '' },
      saving: false,
      editError: '',
      confirmDiscard: false,
      discarding: false,
      discardError: '',
    };
  },
  async mounted() {
    await this.refresh();
  },
  computed: {
    // The step the permit is sitting on right now — the one a reviewer has to act on next.
    currentStep() {
      return (this.app && this.app.pipeline || []).find((s) => s.status === 'current') || null;
    },
    // The API only sends reviewer accounts on installs that allow it, so the switch appears
    // only where there is something to show.
    canShowHints() {
      return (this.app && this.app.pipeline || []).some((s) => s.reviewer_login);
    },
    // Until a reviewer picks it up, the applicant can still change it or pull it back
    canEdit() {
      return !!(this.app && this.app.editable);
    },
    // Only the tracks that collect one; the rest store 'N/A'
    editNeedsAddress() {
      return !!(this.app && this.app.property_address && this.app.property_address !== 'N/A');
    },
  },
  methods: {
    permitLabel,
    toggleReviewerHints,
    permitNumber,
    permitIconClass,
    formatDate,
    formatDateTime,
    downloadUrl,
    async refresh() {
      this.loading = true;
      const id = this.$route.params.id;
      const [detailRes, activityRes] = await Promise.all([
        apiGet(`applications.php?action=detail&id=${id}`),
        apiGet(`messages.php?action=list&application_id=${id}`),
      ]);
      this.app = detailRes.application;
      this.activity = activityRes.activity;
      this.loading = false;
    },
    // Pipeline apps (27-type flow) carry pipeline rows; legacy apps (5-type flow) have none.
    // See BREAKING_CHANGES.md #3.
    stepClass(status) {
      return {
        approved: 'bg-brand-100 text-brand-700',
        rejected: 'bg-red-100 text-red-700',
        current: 'bg-sun-400 text-ink-700',
        pending: 'bg-slate-100 text-slate-400',
        skipped: 'bg-slate-50 text-slate-300',
      }[status] || 'bg-slate-100 text-slate-400';
    },
    startEdit() {
      this.editForm.property_address = this.app.property_address === 'N/A' ? '' : (this.app.property_address || '');
      this.editForm.project_description = this.app.project_description || '';
      this.editError = '';
      this.editing = true;
    },
    async saveEdit() {
      if (this.saving) return;
      this.editError = '';
      if (this.editNeedsAddress && !this.editForm.property_address.trim()) {
        this.editError = 'Property address is required.';
        return;
      }
      this.saving = true;
      try {
        await apiPost('applications.php?action=update', {
          id: this.app.id,
          property_address: this.editForm.property_address,
          project_description: this.editForm.project_description,
        });
        this.editing = false;
        await this.refresh();
      } catch (e) {
        this.editError = e.message;
      } finally {
        this.saving = false;
      }
    },
    async discard() {
      if (this.discarding) return;
      this.discardError = '';
      this.discarding = true;
      try {
        await apiPost('applications.php?action=withdraw', { id: this.app.id });
        this.confirmDiscard = false;
        await this.refresh();
      } catch (e) {
        this.discardError = e.message;
      } finally {
        this.discarding = false;
      }
    },
    async reupload(doc, event) {
      const file = event.target.files[0];
      if (!file) return;
      this.docError = '';
      // Caught here as well as on the server, so an obviously wrong file fails before the upload
      const typeError = uploadTypeError(file);
      if (typeError) {
        this.docError = typeError;
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.docError = file.name + ' is larger than the 5 MB limit.';
        event.target.value = '';
        return;
      }
      const fd = new FormData();
      fd.append('document_id', doc.id);
      fd.append('file', file);
      this.reuploadingId = doc.id;
      try {
        await apiPostForm('documents.php?action=reupload', fd);
        await this.refresh();
      } catch (e) {
        this.docError = e.message;
      } finally {
        this.reuploadingId = null;
        event.target.value = '';
      }
    },
    async sendMessage() {
      if (!this.newMessage.trim()) return;
      this.sending = true;
      try {
        await apiPost('messages.php?action=send', {
          application_id: this.app.id,
          message: this.newMessage,
        });
        this.newMessage = '';
        const activityRes = await apiGet(`messages.php?action=list&application_id=${this.app.id}`);
        this.activity = activityRes.activity;
      } finally {
        this.sending = false;
      }
    },
  },
  template: `
  <AppShell>
    <Loader v-if="loading" kind="detail" />
    <template v-else-if="app">
      <router-link to="/dashboard" :class="backButtonClass">
        <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
        Back to Dashboard
      </router-link>

      <div class="mt-4 flex items-start justify-between flex-wrap gap-3">
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" :class="permitIconClass(app.permit_type || app.permit_type_name)">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-ink-700">{{ permitLabel(app.permit_type || app.permit_type_name) }}</h1>
            <div class="text-sm text-slate-500">{{ app.property_address }} &middot; Permit #{{ permitNumber(app) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 h-fit">
          <!-- Only while nobody has started on it: once a reviewer has, the way to change
               anything is to message them. -->
          <template v-if="canEdit">
            <button type="button" @click="startEdit"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-white ring-1 ring-slate-300 hover:ring-brand-400 hover:text-brand-700 px-3 py-1.5 rounded-full transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              Edit
            </button>
            <button type="button" @click="confirmDiscard = true"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-white ring-1 ring-red-200 hover:ring-red-400 hover:bg-red-50 px-3 py-1.5 rounded-full transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Discard
            </button>
          </template>
          <span class="text-xs font-bold px-3 py-1.5 rounded-full"
            :class="app.status === 'Approved' ? 'bg-brand-100 text-brand-700'
              : app.status === 'Rejected' || app.status === 'Withdrawn' ? 'bg-slate-200 text-slate-600'
              : 'bg-amber-100 text-amber-800'">{{ app.status }}</span>
        </div>
      </div>

      <p v-if="canEdit" class="mt-2 text-xs text-slate-400">
        You can still change or discard this until a reviewer picks it up.
      </p>

      <!-- Pipeline apps (27-type flow): show each office in order. Legacy apps (5-type flow,
           empty app.pipeline) keep the original single-stage stepper. -->
      <div v-if="app.pipeline && app.pipeline.length" class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <h2 class="font-bold text-ink-700">Where your application is</h2>
          <!-- Testing aid: name the account each office reviews with, so a permit can be walked
               through its pipeline by hand. Hidden entirely on installs that switch it off. -->
          <button v-if="canShowHints" type="button" role="switch" :aria-checked="uiState.reviewerHints"
            @click="toggleReviewerHints()"
            class="shrink-0 inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition"
            :class="uiState.reviewerHints ? 'bg-sun-100 text-ink-700 ring-1 ring-sun-300' : 'text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'">
            <span class="w-7 h-4 rounded-full relative transition-colors" :class="uiState.reviewerHints ? 'bg-sun-400' : 'bg-slate-300'">
              <span class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" :class="uiState.reviewerHints ? 'left-3.5' : 'left-0.5'"></span>
            </span>
            Reviewer accounts
          </button>
        </div>

        <div v-if="uiState.reviewerHints && currentStep && currentStep.reviewer_login"
          class="mb-4 rounded-xl bg-sun-50 ring-1 ring-sun-300 px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-[0.12em] text-sun-700">Next approval</p>
          <p class="text-sm text-ink-700 mt-1 leading-relaxed">
            Sign in as <span class="font-mono font-semibold break-all">{{ currentStep.reviewer_login }}</span>
            to approve <span class="font-semibold">{{ currentStep.step_label }}</span>
            at {{ currentStep.department_name }}.
          </p>
        </div>

        <ol class="space-y-3">
          <li v-for="step in app.pipeline" :key="step.id" class="flex items-start gap-3 text-sm">
            <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" :class="stepClass(step.status)">
              <svg v-if="step.status === 'approved'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              <svg v-else-if="step.status === 'rejected'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              <template v-else>&middot;</template>
            </span>
            <div class="min-w-0">
              <div class="font-semibold text-slate-700">{{ step.department_name }}</div>
              <div class="text-xs text-slate-400">{{ step.step_label }}</div>
              <div v-if="uiState.reviewerHints && step.reviewer_login"
                class="text-[11px] font-mono text-slate-500 mt-0.5 break-all"
                :class="step.status === 'current' ? 'text-sun-700 font-semibold' : ''">
                {{ step.reviewer_login }}
              </div>
            </div>
          </li>
        </ol>
      </div>
      <div v-else class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <StatusStepper :stages="app.stages" :active-index="app.stage_index" :rejected="app.status === 'Rejected'" />
      </div>

      <div class="grid lg:grid-cols-2 gap-6 mt-6">
        <div class="bg-white rounded-xl border border-slate-200 p-6">
          <h2 class="font-bold text-ink-700 mb-4">Submitted Documents</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="doc in app.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div class="flex items-start gap-2.5 min-w-0">
                <svg v-if="doc.status === 'Verified'" class="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <svg v-else-if="doc.status === 'Needs Re-upload'" class="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                <svg v-else class="w-4 h-4 text-slate-300 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-slate-800 truncate">{{ doc.doc_name }}</div>
                  <div class="text-xs" :class="doc.status === 'Verified' ? 'text-emerald-600' : doc.status === 'Needs Re-upload' ? 'text-red-500' : 'text-slate-400'">
                    {{ doc.status === 'Verified' ? 'Verified' : doc.status === 'Needs Re-upload' ? 'Needs Update — see reviewer note' : doc.status === 'Pending Review' ? 'Uploaded, pending review' : 'Not uploaded yet' }}
                  </div>
                  <div v-if="doc.uploaded_at" class="text-xs text-slate-400 mt-0.5">Uploaded {{ formatDateTime(doc.uploaded_at) }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-sm font-semibold text-brand-600 hover:underline">View</a>
                <!-- Anything an office hasn't verified yet can still be swapped: the one a
                     reviewer sent back, one never uploaded, and one simply waiting its turn. -->
                <label v-if="doc.status === 'Needs Re-upload' || doc.status === 'Missing'"
                  class="shrink-0 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md cursor-pointer transition">
                  {{ reuploadingId === doc.id ? 'Uploading…' : 'Re-upload' }}
                  <input type="file" class="hidden" :accept="uploadAccept" @change="reupload(doc, $event)" />
                </label>
                <label v-else-if="doc.status !== 'Verified'"
                  class="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-white ring-1 ring-slate-300 hover:ring-brand-400 hover:text-brand-700 px-3 py-1.5 rounded-full cursor-pointer transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                  {{ reuploadingId === doc.id ? 'Uploading…' : 'Replace' }}
                  <input type="file" class="hidden" :accept="uploadAccept" @change="reupload(doc, $event)" />
                </label>
              </div>
            </li>
          </ul>
          <p v-if="docError" class="mt-3 text-xs text-red-600">{{ docError }}</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 flex flex-col">
          <h2 class="font-bold text-ink-700 mb-4">Activity &amp; Messages</h2>
          <div class="flex-1 space-y-3 max-h-80 overflow-y-auto scroll-soft pr-1">
            <div v-for="item in activity" :key="item.id" class="text-sm">
              <template v-if="item.type === 'status_change'">
                <div class="text-xs text-slate-400">{{ formatDateTime(item.created_at) }} — {{ item.body }}</div>
              </template>
              <template v-else>
                <div class="bg-slate-50 rounded-lg px-3 py-2">
                  <div class="text-xs font-bold text-slate-600 mb-0.5">{{ item.sender_name }} <span v-if="item.sender_role === 'staff'" class="text-brand-600 font-medium">&middot; Reviewer</span></div>
                  <div class="text-slate-800">{{ item.body }}</div>
                </div>
              </template>
            </div>
            <p v-if="!activity.length" class="text-sm text-slate-400">No activity yet.</p>
          </div>
          <form @submit.prevent="sendMessage" class="mt-4 flex gap-2">
            <input v-model="newMessage" type="text" placeholder="Write a reply…" class="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
            <button :disabled="sending" class="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-brand-700 disabled:opacity-60">Send</button>
          </form>
        </div>
      </div>

      <!-- Editing what the applicant can still change: the address and the description. The
           permit type, documents and declarations are what the route was built from, so those
           are not editable — a different permit is a different application. -->
      <BaseModal v-if="editing" title="Edit application" eyebrow="Before a reviewer picks it up"
        :subtitle="app.permit_type || app.permit_type_name" @close="editing = false">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </template>

        <div v-if="editNeedsAddress">
          <label class="block text-xs font-semibold text-slate-600 mb-1" for="edit-address">Property address</label>
          <input id="edit-address" v-model="editForm.property_address" type="text"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
        </div>
        <div :class="editNeedsAddress ? 'mt-3' : ''">
          <label class="block text-xs font-semibold text-slate-600 mb-1" for="edit-desc">Project description <span class="font-normal text-slate-400">(optional)</span></label>
          <textarea id="edit-desc" v-model="editForm.project_description" rows="3"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>
        </div>
        <p class="text-xs text-slate-400 mt-2">To change the permit type or its documents, discard this and file again.</p>
        <p v-if="editError" class="text-sm text-red-600 mt-3">{{ editError }}</p>

        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="editing = false" :disabled="saving" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 disabled:opacity-60 transition">Cancel</button>
            <button type="button" @click="saveEdit" :disabled="saving"
              class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </template>
      </BaseModal>

      <BaseModal v-if="confirmDiscard" title="Discard this application?" eyebrow="It leaves the queue" tone="sun"
        :subtitle="app.permit_type || app.permit_type_name" @close="confirmDiscard = false">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </template>
        <p class="text-sm text-slate-600 leading-relaxed">
          No office will review it any further. The record and its history stay in
          <span class="font-semibold text-ink-700">My Permits</span>, but it can't be put back —
          you'd need to file it again.
        </p>
        <p v-if="discardError" class="text-sm text-red-600 mt-3">{{ discardError }}</p>
        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="confirmDiscard = false" :disabled="discarding" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 disabled:opacity-60 transition">Keep it</button>
            <button type="button" @click="discard" :disabled="discarding"
              class="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition">
              {{ discarding ? 'Discarding…' : 'Yes, discard it' }}
            </button>
          </div>
        </template>
      </BaseModal>
    </template>
  </AppShell>
  `,
};

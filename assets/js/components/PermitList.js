import { apiGet, apiPost, apiPostForm, downloadUrl } from '../api/client.js?v=129';
import StatusStepper from './StatusStepper.js?v=129';
import PipelineStepper from './PipelineStepper.js?v=129';
import { permitNumber, permitIconClass, formatDate, formatDateTime, UPLOAD_ACCEPT, uploadTypeError , permitLabel} from '../util.js?v=129';
import Loader from './Loader.js?v=129';
import BaseModal from './BaseModal.js?v=129';

// Mirrors MAX_UPLOAD_BYTES in api/applications.php and the new-application form.
const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Collapsible list of permits, shared by the dashboard preview and the My Permits page.
// Collapsed rows show a mini timeline; opening one loads and shows the whole permit —
// documents, activity and replies — so there is nothing else to click through to.
export default {
  name: 'PermitList',
  components: { StatusStepper, PipelineStepper, Loader, BaseModal },
  props: {
    apps: { type: Array, required: true },
    // Which permit starts open. Defaults to the first one needing action.
    autoOpen: { type: Boolean, default: true },
    // Adds a link out to the permit's own page. Used on the dashboard, where this
    // list is only a preview; My Permits already shows everything inline.
    showDetailsLink: { type: Boolean, default: false },
    // Documents and activity inside the open row. Off on the dashboard, which stays
    // a summary — no detail is fetched there at all.
    showDetail: { type: Boolean, default: true },
    // Open this permit and scroll to it — set when arriving from a notification.
    openId: { type: [Number, String], default: null },
  },
  emits: ['changed'],
  data() {
    return {
      expandedIds: [],  // several permits can be open at once
      editingId: null,                                      // which permit is being corrected
      editForm: { property_address: '', project_description: '' },
      editNeedsAddress: false,
      editError: '',
      savingEdit: false,
      discarding: null,  // the permit awaiting discard confirmation
      discardBusy: false,
      uploadErrors: {},   // document id -> message when a replacement was refused
      maxUploadMb: MAX_UPLOAD_MB,
      uploadAccept: UPLOAD_ACCEPT,
      details: {},        // id -> { app, activity }, fetched the first time a row opens
      detailLoading: {},  // id -> bool
      detailError: {},    // id -> message
      drafts: {},         // id -> reply text
      sendingId: null,
      reuploadingId: null,
    };
  },
  computed: {
    // Anything needing action floats to the top of the list
    sortedApps() {
      return [...this.apps].sort((a, b) => (b.blocked ? 1 : 0) - (a.blocked ? 1 : 0));
    },
  },
  watch: {
    apps: {
      immediate: true,
      handler() {
        if (this.openId) return this.revealRequested();
        if (!this.autoOpen) return;
        // Keep whatever the user had open; otherwise start with the one that needs attention
        if (!this.apps.some((a) => this.isOpen(a.id))) {
          const first = this.apps.find((a) => a.blocked) || this.apps[0];
          this.expandedIds = first ? [first.id] : [];
          if (first) this.loadDetail(first.id);
        }
      },
    },
    // Clicking a second notification for the same page has to re-scroll
    openId: {
      immediate: true,
      handler() {
        this.revealRequested();
      },
    },
  },
  methods: {
    permitLabel,
    permitNumber,
    permitIconClass,
    formatDate,
    formatDateTime,
    downloadUrl,
    // Only construction and business permits carry an address; the rest store 'N/A', so the
    // address field is left out of the edit form for them. Matches $needsAddress in applications.php.
    hasEditableAddress(app) {
      return app.track === 'construction' || app.track === 'business'
        || (!!app.property_address && app.property_address !== 'N/A');
    },
    formatSize(bytes) {

      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    },
    isOpen(id) {
      return this.expandedIds.includes(id);
    },
    startEdit(app) {
      this.editingId = app.id;
      this.editError = '';
      this.editNeedsAddress = this.hasEditableAddress(app);
      this.editForm = {
        property_address: app.property_address === 'N/A' ? '' : (app.property_address || ''),
        project_description: app.project_description || '',
      };
    },
    cancelEdit() {
      this.editingId = null;
      this.editError = '';
    },
    async saveEdit(app) {
      this.editError = '';
      if (this.editNeedsAddress && !this.editForm.property_address.trim()) {
        this.editError = 'Property address is required.';
        return;
      }
      this.savingEdit = true;
      try {
        await apiPost('applications.php?action=update', { id: app.id, ...this.editForm });
        this.editingId = null;
        this.$emit('changed');   // the parent refetches, so the row shows the new values
      } catch (e) {
        this.editError = e.message;
      } finally {
        this.savingEdit = false;
      }
    },
    askDiscard(app) {
      this.discarding = app;
      this.editingId = null;
    },
    async confirmDiscard() {
      if (!this.discarding) return;
      this.discardBusy = true;
      try {
        await apiPost('applications.php?action=withdraw', { id: this.discarding.id });
        this.discarding = null;
        this.$emit('changed');
      } catch (e) {
        this.editError = e.message;
        this.discarding = null;
      } finally {
        this.discardBusy = false;
      }
    },
    // Opening one permit leaves the others as they are, so several can be compared side by side
    toggle(id) {
      if (this.isOpen(id)) {
        this.expandedIds = this.expandedIds.filter((n) => n !== id);
        return;
      }
      this.expandedIds = [...this.expandedIds, id];
      this.loadDetail(id);
    },
    // Open the permit a notification pointed at and bring it into view
    revealRequested() {
      const id = Number(this.openId);
      if (!id || !this.apps.some((a) => a.id === id)) return;
      if (!this.isOpen(id)) this.expandedIds = [...this.expandedIds, id];
      this.loadDetail(id);
      this.$nextTick(() => {
        const row = this.$refs['row-' + id];
        const el = Array.isArray(row) ? row[0] : row;
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    // Fetched lazily so a long list doesn't hit the API for every row up front
    async loadDetail(id, force = false) {
      if (!this.showDetail) return;
      if (this.detailLoading[id] || (this.details[id] && !force)) return;
      this.detailLoading[id] = true;
      this.detailError[id] = '';
      try {
        const [detailRes, activityRes] = await Promise.all([
          apiGet(`applications.php?action=detail&id=${id}`),
          apiGet(`messages.php?action=list&application_id=${id}`),
        ]);
        this.details[id] = { app: detailRes.application, activity: activityRes.activity };
      } catch (e) {
        this.detailError[id] = e.message || 'Could not load this permit.';
      } finally {
        this.detailLoading[id] = false;
      }
    },
    async reupload(id, doc, event) {
      const file = event.target.files[0];
      if (!file) return;
      // Same ceiling the new-application form and the server enforce
      this.uploadErrors[doc.id] = '';
      const typeError = uploadTypeError(file);
      if (typeError) {
        this.uploadErrors[doc.id] = typeError;
        event.target.value = '';
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        this.uploadErrors[doc.id] = file.name + ' is ' + this.formatSize(file.size) + ' — over the ' + MAX_UPLOAD_MB + ' MB limit.';
        event.target.value = '';
        return;
      }
      const fd = new FormData();
      fd.append('document_id', doc.id);
      fd.append('file', file);
      this.reuploadingId = doc.id;
      try {
        await apiPostForm('documents.php?action=reupload', fd);
        await this.loadDetail(id, true);
        this.$emit('changed');
      } finally {
        this.reuploadingId = null;
        event.target.value = '';
      }
    },
    async sendMessage(id) {
      const body = (this.drafts[id] || '').trim();
      if (!body) return;
      this.sendingId = id;
      try {
        await apiPost('messages.php?action=send', { application_id: id, message: body });
        this.drafts[id] = '';
        const activityRes = await apiGet(`messages.php?action=list&application_id=${id}`);
        this.details[id] = { ...this.details[id], activity: activityRes.activity };
      } finally {
        this.sendingId = null;
      }
    },
    docStatusText(status) {
      return status === 'Verified' ? 'Verified'
        : status === 'Needs Re-upload' ? 'Needs Update — see reviewer note'
        : status === 'Pending Review' ? 'Uploaded, pending review'
        : 'Not uploaded yet';
    },
  },
  // The root is a transition group: rows slide into place when a filter adds or removes permits
  template: `
  <div>
  <transition-group name="list" tag="div" class="relative space-y-3">
    <!-- A withdrawn permit is kept for the record but is no longer live, so it sits back: no
         white card, muted text, and it lifts back to full strength on hover or once opened. -->
    <div v-for="app in sortedApps" :key="app.id" :ref="'row-' + app.id"
      class="rounded-2xl border transition"
      :class="[isOpen(app.id) ? 'border-brand-300 shadow-sm' : 'border-brand-100 hover:border-brand-300',
        app.status === 'Withdrawn' ? (isOpen(app.id) ? 'bg-white' : 'bg-slate-50/70 opacity-60 hover:opacity-100 hover:bg-white') : 'bg-white']">

      <!-- Row header — click anywhere on it to open the permit -->
      <button type="button" @click="toggle(app.id)" :aria-expanded="isOpen(app.id)" :aria-controls="'permit-panel-' + app.id"
        class="w-full flex items-center gap-3 sm:gap-4 p-4 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40">
        <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          :class="app.status === 'Withdrawn' ? 'bg-slate-100 text-slate-400' : permitIconClass(app.permit_type)">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold truncate" :class="app.status === 'Withdrawn' ? 'text-slate-500' : 'text-ink-700'">{{ permitLabel(app.permit_type) }}</div>
          <!-- personal and barangay permits have no address; they store 'N/A', which is noise here -->
          <div class="text-sm text-slate-500 truncate">
            <template v-if="app.property_address && app.property_address !== 'N/A'">{{ app.property_address }} &middot; </template>Permit #{{ permitNumber(app) }}
          </div>
        </div>

        <!-- Mini timeline: shown only while the permit is collapsed -->
        <transition name="fade">
        <div v-if="!isOpen(app.id)" class="hidden md:block w-52 shrink-0">
          <PipelineStepper v-if="app.pipeline && app.pipeline.length" :pipeline="app.pipeline" compact :blocked="app.blocked" :status="app.status" />
          <!-- Pre-pipeline applications have no route rows; they keep the old fixed bar. -->
          <StatusStepper v-else :stages="app.stages" :active-index="app.stage_index" compact :rejected="app.status === 'Rejected'" :blocked="app.blocked" />
        </div>
        </transition>

        <span class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
          :class="app.blocked ? 'bg-red-100 text-red-700'
            : app.status === 'Approved' ? 'bg-brand-100 text-brand-700'
            : app.status === 'Rejected' || app.status === 'Withdrawn' ? 'bg-slate-200 text-slate-500'
            : 'bg-sun-100 text-sun-700'"
        >{{ app.blocked ? 'Action needed' : app.status }}</span>

        <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform" :class="isOpen(app.id) ? 'rotate-180' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      <!-- Everything about the permit, revealed on open -->
      <transition name="expand">
      <div v-if="isOpen(app.id)" :id="'permit-panel-' + app.id" class="border-t border-brand-100 px-4 sm:px-6 pt-5 pb-5 sm:pb-6">
        <div class="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-6">
          <div><span class="text-slate-400">Submitted</span> <span class="font-semibold text-slate-700">{{ formatDateTime(app.created_at) }}</span></div>
          <div><span class="text-slate-400">Last updated</span> <span class="font-semibold text-slate-700">{{ formatDateTime(app.updated_at) }}</span></div>
        </div>

        <div v-if="app.pipeline && app.pipeline.length">
          <h3 class="font-bold text-ink-700 mb-3">Where this application is</h3>
          <PipelineStepper :pipeline="app.pipeline" :blocked="app.blocked" :status="app.status" />
        </div>
        <StatusStepper v-else :stages="app.stages" :active-index="app.stage_index" :rejected="app.status === 'Rejected'" :blocked="app.blocked" />

        <!-- Only while it is still waiting to be picked up. Once a reviewer has it, these
             controls disappear and the server refuses the change too. -->
        <div v-if="app.editable" class="mt-6 rounded-xl bg-meadow border border-brand-100 px-4 py-3">
          <div v-if="editingId !== app.id" class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-start gap-2.5 min-w-0">
              <svg class="w-4 h-4 text-brand-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <p class="text-sm text-slate-600 leading-relaxed">
                <span class="font-semibold text-ink-700">This can still be edited — it won't affect the queue.</span>
                No one has started reviewing it yet, so you can change the details and replace any document below.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" @click="startEdit(app)"
                class="text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:ring-brand-300 px-3.5 py-2 rounded-xl transition">Edit</button>
              <button type="button" @click="askDiscard(app)"
                class="text-sm font-semibold text-red-700 bg-white ring-1 ring-red-200 hover:bg-red-50 px-3.5 py-2 rounded-xl transition">Discard</button>
            </div>
          </div>

          <!-- Inline edit -->
          <form v-else @submit.prevent="saveEdit(app)" class="space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Editing the application details</p>
            <div v-if="editNeedsAddress">
              <label class="block text-xs font-semibold text-slate-600 mb-1" :for="'edit-addr-' + app.id">Property address</label>
              <input :id="'edit-addr-' + app.id" v-model="editForm.property_address" type="text"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1" :for="'edit-desc-' + app.id">Description</label>
              <textarea :id="'edit-desc-' + app.id" v-model="editForm.project_description" rows="3"
                placeholder="What is this application for?"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed resize-y focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>
            </div>
            <p v-if="editError" class="text-sm text-red-600">{{ editError }}</p>
            <div class="flex items-center gap-2">
              <button type="submit" :disabled="savingEdit"
                class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-4 py-2 rounded-xl transition">
                {{ savingEdit ? 'Saving…' : 'Save changes' }}
              </button>
              <button type="button" @click="cancelEdit" class="text-sm font-semibold text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition">Cancel</button>
            </div>
          </form>
        </div>

        <div v-if="app.blocked" class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-6">
          <svg class="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          <div>
            <div class="text-sm font-bold text-red-700">Action needed</div>
            <div class="text-sm text-red-600">Re-upload the document marked below and your application moves on.</div>
          </div>
        </div>

        <template v-if="showDetail">
        <Loader v-if="detailLoading[app.id]" variant="inline" kind="documents" class="mt-6 text-slate-500" />
        <p v-else-if="detailError[app.id]" class="text-sm text-red-600 mt-6">
          {{ detailError[app.id] }}
          <button type="button" @click="loadDetail(app.id, true)" class="font-semibold underline ml-1">Try again</button>
        </p>

        <div v-else-if="details[app.id]" class="grid lg:grid-cols-2 gap-4 mt-6">
          <!-- Documents -->
          <div class="rounded-xl border border-brand-100 bg-white p-5">
            <h3 class="font-bold text-ink-700 mb-3">Submitted Documents</h3>
            <ul class="divide-y divide-slate-100">
              <li v-for="doc in details[app.id].app.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div class="flex items-start gap-2.5 min-w-0">
                  <svg v-if="doc.status === 'Verified'" class="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  <svg v-else-if="doc.status === 'Needs Re-upload'" class="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                  <svg v-else class="w-4 h-4 text-slate-300 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-slate-800 truncate">{{ doc.doc_name }}</div>
                    <div class="text-xs" :class="doc.status === 'Verified' ? 'text-emerald-600' : doc.status === 'Needs Re-upload' ? 'text-red-500' : 'text-slate-400'">
                      {{ docStatusText(doc.status) }}<template v-if="doc.original_filename"> · {{ doc.original_filename }}</template>
                    </div>
                    <div v-if="doc.uploaded_at" class="text-xs text-slate-400 mt-0.5">Uploaded {{ formatDateTime(doc.uploaded_at) }}</div>
                    <p v-if="uploadErrors[doc.id]" class="text-xs text-red-600 mt-0.5">{{ uploadErrors[doc.id] }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-sm font-semibold text-brand-600 hover:underline">View</a>
                  <!-- A flagged or missing document can always be supplied. While the application
                       is still editable, an already-uploaded one can be swapped out too. -->
                  <label v-if="doc.status === 'Needs Re-upload' || doc.status === 'Missing' || app.editable"
                    class="text-sm font-semibold px-3 py-1.5 rounded-md cursor-pointer transition"
                    :class="doc.file_path && doc.status !== 'Needs Re-upload'
                      ? 'text-ink-700 bg-white ring-1 ring-slate-200 hover:ring-brand-300'
                      : 'text-white bg-brand-600 hover:bg-brand-700'">
                    {{ reuploadingId === doc.id ? 'Uploading…' : (doc.file_path ? 'Replace' : 'Upload') }}
                    <input type="file" class="hidden" :accept="uploadAccept" :disabled="reuploadingId === doc.id" @change="reupload(app.id, doc, $event)" />
                  </label>
                </div>
              </li>
              <li v-if="!details[app.id].app.documents.length" class="text-sm text-slate-400 py-3">No documents on this permit.</li>
            </ul>
          </div>

          <!-- Activity and replies -->
          <div class="rounded-xl border border-brand-100 bg-white p-5 flex flex-col">
            <h3 class="font-bold text-ink-700 mb-3">Activity &amp; Messages</h3>
            <div class="flex-1 space-y-3 max-h-72 overflow-y-auto scroll-soft pr-1">
              <div v-for="item in details[app.id].activity" :key="item.id" class="text-sm">
                <div v-if="item.type === 'status_change'" class="text-xs text-slate-400">{{ formatDateTime(item.created_at) }} — {{ item.body }}</div>
                <div v-else class="bg-slate-50 rounded-lg px-3 py-2">
                  <div class="text-xs font-bold text-slate-600 mb-0.5">
                    {{ item.sender_name }}
                    <span v-if="item.sender_role === 'staff'" class="text-brand-600 font-medium">&middot; Reviewer</span>
                  </div>
                  <div class="text-slate-800">{{ item.body }}</div>
                </div>
              </div>
              <p v-if="!details[app.id].activity.length" class="text-sm text-slate-400">No activity yet.</p>
            </div>
            <form @submit.prevent="sendMessage(app.id)" class="mt-4 flex gap-2">
              <input v-model="drafts[app.id]" type="text" placeholder="Write a reply…" :aria-label="'Reply about ' + app.permit_type + ' permit'"
                class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
              <button type="submit" :disabled="sendingId === app.id"
                class="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-60">
                {{ sendingId === app.id ? 'Sending…' : 'Send' }}
              </button>
            </form>
          </div>
        </div>
        </template>

        <div v-if="showDetailsLink" class="flex justify-end mt-6">
          <router-link :to="'/applications/' + app.id"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 border border-brand-200 bg-white hover:bg-brand-50 hover:border-brand-300 px-4 py-2 rounded-xl transition">
            View Details
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
          </router-link>
        </div>
      </div>
      </transition>
    </div>
  </transition-group>

  <!-- Discarding is reversible only by filing again, so it always asks first -->
  <BaseModal v-if="discarding" title="Discard this application?" eyebrow="This cannot be undone" tone="sun"
    :subtitle="discarding.permit_type + ' · Permit #' + permitNumber(discarding)"
    @close="discarding = null">
    <template #icon>
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
    </template>
    <p class="text-sm text-slate-600 leading-relaxed">
      It will be taken out of the review queue and marked as withdrawn. Your documents and the
      history stay on record, but City Staff will not review it. To go ahead with this permit
      later you would need to file a new application.
    </p>
    <template #footer>
      <div class="ml-auto flex items-center gap-2">
        <button type="button" @click="discarding = null" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Keep it</button>
        <button type="button" @click="confirmDiscard" :disabled="discardBusy"
          class="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition">
          {{ discardBusy ? 'Discarding…' : 'Discard application' }}
        </button>
      </div>
    </template>
  </BaseModal>
  </div>
  `,

};

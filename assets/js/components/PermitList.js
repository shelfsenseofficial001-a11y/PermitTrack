import { apiGet, apiPost, apiPostForm, downloadUrl } from '../api/client.js?v=80';
import StatusStepper from './StatusStepper.js?v=80';
import { permitNumber, permitIconClass, formatDate } from '../util.js?v=80';
import Loader from './Loader.js?v=80';

// Collapsible list of permits, shared by the dashboard preview and the My Permits page.
// Collapsed rows show a mini timeline; opening one loads and shows the whole permit —
// documents, activity and replies — so there is nothing else to click through to.
export default {
  name: 'PermitList',
  components: { StatusStepper, Loader },
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
      expandedId: null,
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
        if (!this.apps.some((a) => a.id === this.expandedId)) {
          const first = this.apps.find((a) => a.blocked) || this.apps[0];
          this.expandedId = first ? first.id : null;
          if (this.expandedId) this.loadDetail(this.expandedId);
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
    permitNumber,
    permitIconClass,
    formatDate,
    downloadUrl,
    toggle(id) {
      this.expandedId = this.expandedId === id ? null : id;
      if (this.expandedId) this.loadDetail(this.expandedId);
    },
    // Open the permit a notification pointed at and bring it into view
    revealRequested() {
      const id = Number(this.openId);
      if (!id || !this.apps.some((a) => a.id === id)) return;
      this.expandedId = id;
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
  <transition-group name="list" tag="div" class="relative space-y-3">
    <div v-for="app in sortedApps" :key="app.id" :ref="'row-' + app.id"
      class="bg-white rounded-2xl border transition"
      :class="expandedId === app.id ? 'border-brand-300 shadow-sm' : 'border-brand-100 hover:border-brand-300'">

      <!-- Row header — click anywhere on it to open the permit -->
      <button type="button" @click="toggle(app.id)" :aria-expanded="expandedId === app.id" :aria-controls="'permit-panel-' + app.id"
        class="w-full flex items-center gap-3 sm:gap-4 p-4 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40">
        <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" :class="permitIconClass(app.permit_type)">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-ink-700 truncate">{{ app.permit_type }} Permit</div>
          <div class="text-sm text-slate-500 truncate">{{ app.property_address }} &middot; Permit #{{ permitNumber(app) }}</div>
        </div>

        <!-- Mini timeline: shown only while the permit is collapsed -->
        <transition name="fade">
        <div v-if="expandedId !== app.id" class="hidden md:block w-40 shrink-0">
          <StatusStepper :stages="app.stages" :active-index="app.stage_index" compact :rejected="app.status === 'Rejected'" :blocked="app.blocked" />
        </div>
        </transition>

        <span class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
          :class="app.blocked ? 'bg-red-100 text-red-700' : app.status === 'Approved' ? 'bg-brand-100 text-brand-700' : app.status === 'Rejected' ? 'bg-slate-200 text-slate-600' : 'bg-sun-100 text-sun-700'"
        >{{ app.blocked ? 'Action needed' : app.status }}</span>

        <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform" :class="expandedId === app.id ? 'rotate-180' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      <!-- Everything about the permit, revealed on open -->
      <transition name="expand">
      <div v-if="expandedId === app.id" :id="'permit-panel-' + app.id" class="border-t border-brand-100 px-4 sm:px-6 pt-5 pb-5 sm:pb-6">
        <div class="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-6">
          <div><span class="text-slate-400">Submitted</span> <span class="font-semibold text-slate-700">{{ formatDate(app.created_at) }}</span></div>
          <div><span class="text-slate-400">Last updated</span> <span class="font-semibold text-slate-700">{{ formatDate(app.updated_at) }}</span></div>
        </div>

        <StatusStepper :stages="app.stages" :active-index="app.stage_index" :rejected="app.status === 'Rejected'" :blocked="app.blocked" />

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
                      {{ docStatusText(doc.status) }}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-sm font-semibold text-brand-600 hover:underline">View</a>
                  <label v-if="doc.status === 'Needs Re-upload' || doc.status === 'Missing'"
                    class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md cursor-pointer">
                    {{ reuploadingId === doc.id ? 'Uploading…' : 'Re-upload' }}
                    <input type="file" class="hidden" :disabled="reuploadingId === doc.id" @change="reupload(app.id, doc, $event)" />
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
                <div v-if="item.type === 'status_change'" class="text-xs text-slate-400">{{ formatDate(item.created_at) }} — {{ item.body }}</div>
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
  `,
};

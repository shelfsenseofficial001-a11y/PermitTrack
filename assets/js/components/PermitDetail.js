import { apiGet, apiPost, apiPostForm, downloadUrl } from '../api/client.js?v=79';
import AppShell from './AppShell.js?v=79';
import StatusStepper from './StatusStepper.js?v=79';
import { permitNumber, permitIconClass, formatDate, backButtonClass, backIconClass } from '../util.js?v=79';
import Loader from './Loader.js?v=79';

export default {
  name: 'PermitDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { AppShell, StatusStepper, Loader },
  data() {
    return {
      app: null,
      activity: [],
      loading: true,
      newMessage: '',
      sending: false,
      reuploadingId: null,
    };
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    permitNumber,
    permitIconClass,
    formatDate,
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
    async reupload(doc, event) {
      const file = event.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('document_id', doc.id);
      fd.append('file', file);
      this.reuploadingId = doc.id;
      try {
        await apiPostForm('documents.php?action=reupload', fd);
        await this.refresh();
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
            <h1 class="text-xl font-bold text-ink-700">{{ app.permit_type || app.permit_type_name }} Permit</h1>
            <div class="text-sm text-slate-500">{{ app.property_address }} &middot; Permit #{{ permitNumber(app) }}</div>
          </div>
        </div>
        <span class="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 h-fit">{{ app.status }}</span>
      </div>

      <!-- Pipeline apps (27-type flow): show each office in order. Legacy apps (5-type flow,
           empty app.pipeline) keep the original single-stage stepper. -->
      <div v-if="app.pipeline && app.pipeline.length" class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <h2 class="font-bold text-ink-700 mb-4">Where your application is</h2>
        <ol class="space-y-3">
          <li v-for="step in app.pipeline" :key="step.id" class="flex items-center gap-3 text-sm">
            <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" :class="stepClass(step.status)">
              <svg v-if="step.status === 'approved'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              <svg v-else-if="step.status === 'rejected'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              <template v-else>&middot;</template>
            </span>
            <div class="min-w-0">
              <div class="font-semibold text-slate-700">{{ step.department_name }}</div>
              <div class="text-xs text-slate-400">{{ step.step_label }}</div>
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
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a v-if="doc.file_path" :href="downloadUrl(doc.id)" class="text-sm font-semibold text-brand-600 hover:underline">View</a>
                <label v-if="doc.status === 'Needs Re-upload' || doc.status === 'Missing'" class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md cursor-pointer">
                  {{ reuploadingId === doc.id ? 'Uploading…' : 'Re-upload' }}
                  <input type="file" class="hidden" @change="reupload(doc, $event)" />
                </label>
              </div>
            </li>
          </ul>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 flex flex-col">
          <h2 class="font-bold text-ink-700 mb-4">Activity &amp; Messages</h2>
          <div class="flex-1 space-y-3 max-h-80 overflow-y-auto scroll-soft pr-1">
            <div v-for="item in activity" :key="item.id" class="text-sm">
              <template v-if="item.type === 'status_change'">
                <div class="text-xs text-slate-400">{{ formatDate(item.created_at) }} — {{ item.body }}</div>
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
    </template>
  </AppShell>
  `,
};

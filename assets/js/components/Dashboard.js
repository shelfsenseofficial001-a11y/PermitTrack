import { apiGet, apiPostForm } from '../api/client.js';
import AppShell from './AppShell.js';
import StatusStepper from './StatusStepper.js';
import { permitNumber, permitIconClass, formatDate } from '../util.js';

export default {
  name: 'Dashboard',
  components: { AppShell, StatusStepper },
  data() {
    return {
      apps: [],
      stats: { active_applications: 0, needs_attention: 0, approved_this_year: 0 },
      loading: true,
      uploadingDocId: null,
    };
  },
  computed: {
    featured() {
      return this.apps.find((a) => a.blocked) || this.apps[0] || null;
    },
    others() {
      return this.apps.filter((a) => this.featured && a.id !== this.featured.id);
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    permitNumber,
    permitIconClass,
    formatDate,
    async refresh() {
      this.loading = true;
      const [appsRes, statsRes] = await Promise.all([
        apiGet('applications.php?action=list'),
        apiGet('applications.php?action=stats'),
      ]);
      this.apps = appsRes.applications;
      this.stats = statsRes;
      this.loading = false;
    },
    async quickUpload(app, event) {
      const file = event.target.files[0];
      if (!file) return;
      const detail = await apiGet(`applications.php?action=detail&id=${app.id}`);
      const doc = detail.application.documents.find((d) => d.status === 'Needs Re-upload');
      if (!doc) return;
      const fd = new FormData();
      fd.append('document_id', doc.id);
      fd.append('file', file);
      this.uploadingDocId = doc.id;
      try {
        await apiPostForm('documents.php?action=reupload', fd);
        await this.refresh();
      } finally {
        this.uploadingDocId = null;
        event.target.value = '';
      }
    },
  },
  template: `
  <AppShell>
    <div class="flex items-start justify-between flex-wrap gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-ink-700">Your Permits &amp; Licenses</h1>
        <p class="text-slate-500 text-sm mt-1">Track every application and inspection in one place, from submission to approval.</p>
      </div>
      <router-link to="/applications/new" class="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-md hover:bg-brand-700 transition shadow-sm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        New Application
      </router-link>
    </div>

    <div v-if="loading" class="text-slate-400 text-sm">Loading…</div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wide">Active Applications</div>
          <div class="text-3xl font-bold text-ink-700 mt-2">{{ stats.active_applications }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wide">Needs Your Attention</div>
          <div class="text-3xl font-bold mt-2" :class="stats.needs_attention > 0 ? 'text-red-600' : 'text-ink-700'">{{ stats.needs_attention }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wide">Approved This Year</div>
          <div class="text-3xl font-bold text-ink-700 mt-2">{{ stats.approved_this_year }}</div>
        </div>
      </div>

      <div v-if="!apps.length" class="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <p class="text-slate-500 mb-4">You don't have any permit applications yet.</p>
        <router-link to="/applications/new" class="inline-flex bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-brand-700">Start a New Application</router-link>
      </div>

      <template v-else>
        <div v-if="featured" class="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div class="flex items-start justify-between mb-6 gap-3 flex-wrap">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" :class="permitIconClass(featured.permit_type)">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </div>
              <div>
                <router-link :to="'/applications/' + featured.id" class="text-lg font-bold text-ink-700 hover:text-brand-700">{{ featured.permit_type }} Permit</router-link>
                <div class="text-sm text-slate-500">{{ featured.property_address }} &middot; Permit #{{ permitNumber(featured) }}</div>
              </div>
            </div>
            <span class="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 h-fit">{{ featured.status }}</span>
          </div>

          <div class="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-6">
            <div><span class="text-slate-400">Submitted</span> <span class="font-semibold text-slate-700">{{ formatDate(featured.created_at) }}</span></div>
            <div><span class="text-slate-400">Last updated</span> <span class="font-semibold text-slate-700">{{ formatDate(featured.updated_at) }}</span></div>
          </div>

          <StatusStepper :stages="featured.stages" :active-index="featured.stage_index" :rejected="featured.status === 'Rejected'" :blocked="featured.blocked" />

          <div v-if="featured.blocked" class="flex items-center justify-between flex-wrap gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-6">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
              <div>
                <div class="text-sm font-bold text-red-700">Action needed</div>
                <div class="text-sm text-red-600">A document on this permit needs to be re-uploaded.</div>
              </div>
            </div>
            <label class="shrink-0 cursor-pointer inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 border border-red-300 bg-white hover:bg-red-100 px-3 py-1.5 rounded-md">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              Upload Document
              <input type="file" class="hidden" @change="quickUpload(featured, $event)" />
            </label>
          </div>
        </div>

        <div v-if="others.length">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Other Active Permits</h2>
          <div class="space-y-3">
            <router-link
              v-for="app in others" :key="app.id"
              :to="'/applications/' + app.id"
              class="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-300 transition"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="permitIconClass(app.permit_type)">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-slate-900 truncate">{{ app.permit_type }} Permit</div>
                  <div class="text-xs text-slate-500 truncate">{{ app.property_address }} &middot; Submitted {{ formatDate(app.created_at) }}</div>
                </div>
              </div>
              <div class="hidden sm:block w-40 shrink-0"><StatusStepper :stages="app.stages" :active-index="app.stage_index" compact :rejected="app.status === 'Rejected'" :blocked="app.blocked" /></div>
              <span
                class="shrink-0 text-xs font-bold px-3 py-1 rounded-full"
                :class="app.blocked ? 'bg-red-100 text-red-700' : app.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'"
              >{{ app.blocked ? 'Blocked' : app.status }}</span>
              <svg class="w-4 h-4 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </router-link>
          </div>
        </div>
      </template>
    </template>
  </AppShell>
  `,
};

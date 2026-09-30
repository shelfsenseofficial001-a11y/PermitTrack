import { apiGet } from '../api/client.js?v=65';
import StaffShell from './StaffShell.js?v=65';
import { formatDate, permitIconClass } from '../util.js?v=65';
import { authState } from '../store/auth.js?v=65';
import Loader from './Loader.js?v=65';

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_applicant', label: 'Awaiting Applicant' },
];

const PRIORITY_STYLES = {
  'Standard': 'bg-brand-50 text-brand-700',
  'High Priority': 'bg-red-100 text-red-700',
  'Overdue': 'bg-sun-100 text-sun-700',
};

export default {
  name: 'ReviewerQueue',
  components: { StaffShell, Loader },
  data() {
    return {
      tabs: TABS,
      activeTab: 'new',
      apps: [],
      counts: { new: 0, in_progress: 0, awaiting_applicant: 0 },
      loading: true,
    };
  },
  computed: {
    // Barangay secretariats + the 9 offices from migration 008 run the new per-office pipeline
    // instead of the original CSV-department model (OBO/BPLO/CHO). See BREAKING_CHANGES.md #1/#6.
    isPipelineStaff() {
      const u = authState.user;
      return !!(u && u.department_permit_types === '__unassigned__');
    },
    totalCount() {
      if (this.isPipelineStaff) return this.counts.current || 0;
      return this.counts.new + this.counts.in_progress + this.counts.awaiting_applicant;
    },
    activeTabLabel() {
      return this.tabs.find((t) => t.key === this.activeTab).label;
    },
    scopeLabel() {
      const u = authState.user;
      if (!u) return '';
      if (u.role === 'admin') return 'all departments (Admin)';
      return u.department_name ? u.department_name : 'all departments';
    },
    firstName() {
      const name = authState.user && authState.user.full_name;
      return name ? name.trim().split(/\s+/)[0] : '';
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDate,
    permitIconClass,
    tabIconClass(key) {
      return { new: 'bg-brand-50 text-brand-600', in_progress: 'bg-sun-100 text-sun-700', awaiting_applicant: 'bg-brand-600 text-sun-300' }[key];
    },
    priorityClass(p) {
      return PRIORITY_STYLES[p] || 'bg-slate-100 text-slate-600';
    },
    async selectTab(tab) {
      this.activeTab = tab;
      await this.refresh();
    },
    async refresh() {
      this.loading = true;
      if (this.isPipelineStaff) {
        const [queueRes, countsRes] = await Promise.all([
          apiGet('reviewer.php?action=pipeline_queue'),
          apiGet('reviewer.php?action=pipeline_counts'),
        ]);
        this.apps = queueRes.applications;
        this.counts = countsRes;
      } else {
        const [queueRes, countsRes] = await Promise.all([
          apiGet(`reviewer.php?action=queue&tab=${this.activeTab}`),
          apiGet('reviewer.php?action=counts'),
        ]);
        this.apps = queueRes.applications;
        this.counts = countsRes;
      }
      this.loading = false;
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide relative overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-10 mb-8 flex items-end justify-between flex-wrap gap-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <div class="max-w-xl">
        <p class="text-sm font-medium text-white/85 mb-2">Welcome back{{ firstName ? ', ' + firstName : '' }}</p>
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">My Review Queue</h1>
        <p class="text-white/85 text-sm mt-2">{{ totalCount }} open application(s) · {{ scopeLabel }}</p>
      </div>
      <span class="inline-flex items-center gap-2 bg-ink-700 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
        <svg class="w-4 h-4 text-sun-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Staff Portal
      </span>
    </div>

    <!-- Stat cards double as the queue tabs (legacy staff only — a pipeline office only ever
         has one meaningful queue: applications currently waiting on it) -->
    <div v-if="!isPipelineStaff" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" role="tablist" aria-label="Queue">
      <button
        v-for="tab in tabs" :key="tab.key"
        type="button" role="tab" :aria-selected="activeTab === tab.key"
        @click="selectTab(tab.key)"
        class="text-left bg-white rounded-2xl border p-5 flex items-center gap-4 transition"
        :class="activeTab === tab.key ? 'border-brand-600 ring-4 ring-brand-600/10' : 'border-brand-100 hover:border-brand-300'"
      >
        <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="tabIconClass(tab.key)">
          <svg v-if="tab.key === 'new'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          <svg v-else-if="tab.key === 'in_progress'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide" :class="activeTab === tab.key ? 'text-brand-700' : 'text-slate-500'">{{ tab.label }}</div>
          <div class="text-3xl font-bold text-ink-700 mt-0.5">{{ counts[tab.key] }}</div>
        </div>
      </button>
    </div>

    <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">{{ isPipelineStaff ? 'Waiting on your office' : activeTabLabel + ' applications' }}</h2>

    <Loader v-if="loading" kind="queue" />

    <div v-else-if="!apps.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center text-slate-500">
      Nothing in this queue right now.
    </div>

    <div v-else class="space-y-3">
      <div v-for="app in apps" :key="app.id" class="bg-white rounded-2xl border border-brand-100 hover:border-brand-300 hover:shadow-sm transition p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="permitIconClass(app.permit_type || app.permit_type_name)">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div class="min-w-0">
            <div class="font-bold text-ink-700 truncate">{{ app.applicant_name }} &mdash; {{ app.permit_type || app.permit_type_name }} Permit</div>
            <div class="text-sm text-slate-500 mt-0.5">
              Submitted {{ formatDate(app.created_at) }} &middot; {{ app.days_in_queue }} day(s) in queue
              <template v-if="isPipelineStaff"> &middot; {{ app.step_label }}</template>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs font-bold px-3 py-1.5 rounded-full" :class="priorityClass(app.priority)">{{ app.priority }}</span>
          <router-link :to="'/reviewer/applications/' + app.id" class="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
            Review
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </router-link>
        </div>
      </div>
    </div>
  </StaffShell>
  `,
};

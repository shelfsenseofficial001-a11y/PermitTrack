import { apiGet } from '../api/client.js';
import StaffShell from './StaffShell.js';
import { formatDate } from '../util.js';

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_applicant', label: 'Awaiting Applicant' },
];

const PRIORITY_STYLES = {
  'Standard': 'bg-slate-100 text-slate-600',
  'High Priority': 'bg-red-100 text-red-700',
  'Overdue': 'bg-amber-100 text-amber-800',
};

export default {
  name: 'ReviewerQueue',
  components: { StaffShell },
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
    totalCount() {
      return this.counts.new + this.counts.in_progress + this.counts.awaiting_applicant;
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDate,
    priorityClass(p) {
      return PRIORITY_STYLES[p] || 'bg-slate-100 text-slate-600';
    },
    async selectTab(tab) {
      this.activeTab = tab;
      await this.refresh();
    },
    async refresh() {
      this.loading = true;
      const [queueRes, countsRes] = await Promise.all([
        apiGet(`reviewer.php?action=queue&tab=${this.activeTab}`),
        apiGet('reviewer.php?action=counts'),
      ]);
      this.apps = queueRes.applications;
      this.counts = countsRes;
      this.loading = false;
    },
  },
  template: `
  <StaffShell>
    <h1 class="text-2xl font-bold text-ink-700">My Review Queue</h1>
    <p class="text-slate-500 text-sm mt-1 mb-6">{{ totalCount }} application(s) currently assigned to you.</p>

    <div class="flex gap-6 border-b border-slate-200 mb-6">
      <button
        v-for="tab in tabs" :key="tab.key"
        @click="selectTab(tab.key)"
        class="pb-3 text-sm font-semibold border-b-2 -mb-px transition"
        :class="activeTab === tab.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
      >
        {{ tab.label }} <span class="text-slate-400 font-medium">({{ counts[tab.key] }})</span>
      </button>
    </div>

    <div v-if="loading" class="text-slate-400 text-sm">Loading…</div>

    <div v-else-if="!apps.length" class="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
      Nothing in this queue right now.
    </div>

    <div v-else class="space-y-3">
      <div v-for="app in apps" :key="app.id" class="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="font-bold text-slate-900 truncate">{{ app.applicant_name }} &mdash; {{ app.permit_type }} Permit</div>
          <div class="text-sm text-slate-500 mt-0.5">Submitted {{ formatDate(app.created_at) }} &middot; {{ app.days_in_queue }} day(s) in queue</div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs font-bold px-3 py-1.5 rounded-full" :class="priorityClass(app.priority)">{{ app.priority }}</span>
          <router-link :to="'/reviewer/applications/' + app.id" class="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-brand-700">
            Review
          </router-link>
        </div>
      </div>
    </div>
  </StaffShell>
  `,
};

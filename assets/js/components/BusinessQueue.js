import { apiGet } from '../api/client.js?v=70';
import StaffShell from './StaffShell.js?v=70';
import { formatDate } from '../util.js?v=70';
import Loader from './Loader.js?v=70';

const TABS = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default {
  name: 'BusinessQueue',
  components: { StaffShell, Loader },
  data() {
    return {
      tabs: TABS,
      activeTab: TABS.some((t) => t.key === this.$route.query.tab) ? this.$route.query.tab : 'pending',
      businesses: [],
      counts: { pending: 0, approved: 0, rejected: 0 },
      loading: true,
    };
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDate,
    async selectTab(tab) {
      this.activeTab = tab;
      this.$router.replace({ query: { tab } });
      await this.refresh();
    },
    async refresh() {
      this.loading = true;
      const [queue, counts] = await Promise.all([
        apiGet('business.php?action=queue&status=' + this.activeTab),
        apiGet('business.php?action=counts'),
      ]);
      this.businesses = queue.businesses;
      this.counts = counts;
      this.loading = false;
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-8 sm:px-10 mb-8 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-2">Account verification</p>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">Business Verifications</h1>
      <p class="text-white/85 text-sm mt-2">{{ counts.pending }} business(es) waiting. Check the registration, the representative's ID and the location documents.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" role="tablist" aria-label="Verification status">
      <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" @click="selectTab(tab.key)"
        class="text-left bg-white rounded-2xl border p-5 transition"
        :class="activeTab === tab.key ? 'border-brand-600 ring-4 ring-brand-600/10' : 'border-brand-100 hover:border-brand-300'">
        <div class="text-xs font-semibold uppercase tracking-wide" :class="activeTab === tab.key ? 'text-brand-700' : 'text-slate-500'">{{ tab.label }}</div>
        <div class="text-3xl font-bold mt-0.5" :class="tab.key === 'pending' && counts.pending ? 'text-sun-700' : 'text-ink-700'">{{ counts[tab.key] }}</div>
      </button>
    </div>

    <Loader v-if="loading" kind="queue" />
    <div v-else-if="!businesses.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center text-slate-500">
      {{ activeTab === 'pending' ? 'No businesses are waiting for verification.' : 'Nothing here yet.' }}
    </div>
    <div v-else class="space-y-3">
      <router-link v-for="b in businesses" :key="b.id" :to="'/staff/businesses/' + b.id"
        class="bg-white rounded-2xl border border-brand-100 hover:border-brand-300 transition p-4 flex items-center justify-between gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="font-bold text-ink-700 truncate">{{ b.business_name }} <span v-if="b.trade_name" class="font-normal text-slate-500">({{ b.trade_name }})</span></div>
          <div class="text-sm text-slate-500 truncate">{{ b.ownership_label }} · {{ b.line_of_business }} · Brgy. {{ b.barangay }}, {{ b.city }}</div>
          <div class="text-xs text-slate-400">Owner account: {{ b.owner_name }} · submitted {{ formatDate(b.submitted_at) }}
            <template v-if="b.status !== 'pending' && b.reviewer_name"> · {{ b.status }} by {{ b.reviewer_name }}</template></div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span v-if="b.status === 'pending'" class="text-xs font-bold px-3 py-1.5 rounded-full" :class="b.days_waiting >= 3 ? 'bg-red-100 text-red-700' : 'bg-sun-100 text-sun-700'">
            {{ b.days_waiting == 0 ? 'New today' : b.days_waiting + ' day(s) waiting' }}
          </span>
          <span v-else class="text-xs font-bold px-3 py-1.5 rounded-full" :class="b.status === 'approved' ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'">{{ b.status === 'approved' ? 'Approved' : 'Rejected' }}</span>
          <span class="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">{{ b.status === 'pending' ? 'Review ›' : 'View ›' }}</span>
        </div>
      </router-link>
    </div>
  </StaffShell>
  `,
};

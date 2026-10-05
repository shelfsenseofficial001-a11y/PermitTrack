import { apiGet } from '../api/client.js?v=128';
import StaffShell from './StaffShell.js?v=128';
import { formatDate } from '../util.js?v=128';
import Loader from './Loader.js?v=128';

const TABS = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default {
  name: 'ResidencyQueue',
  components: { StaffShell, Loader },
  data() {
    return {
      tabs: TABS,
      activeTab: this.$route.query.tab && TABS.some((t) => t.key === this.$route.query.tab) ? this.$route.query.tab : 'pending',
      requests: [],
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
        apiGet(`residency.php?action=queue&status=${this.activeTab}`),
        apiGet('residency.php?action=counts'),
      ]);
      this.requests = queue.requests;
      this.counts = counts;
      this.loading = false;
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-8 sm:px-10 mb-8 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-2">Account verification</p>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">Resident Verifications</h1>
      <p class="text-white/85 text-sm mt-2">{{ counts.pending }} request(s) waiting. Check that both proofs show the applicant's name and address.</p>
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

    <div v-else-if="!requests.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center text-slate-500">
      {{ activeTab === 'pending' ? 'No one is waiting for verification right now.' : 'Nothing here yet.' }}
    </div>

    <div v-else class="space-y-3">
      <router-link v-for="r in requests" :key="r.id" :to="'/staff/residency/' + r.id"
        class="bg-white rounded-2xl border border-brand-100 hover:border-brand-300 hover:shadow-sm transition p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
          </div>
          <div class="min-w-0">
            <div class="font-bold text-ink-700 truncate">{{ r.full_name }}</div>
            <div class="text-sm text-slate-500 truncate">
              Brgy. {{ r.barangay }}, {{ r.city }} &middot; submitted {{ formatDate(r.created_at) }}
              <template v-if="r.status !== 'pending' && r.reviewer_name"> &middot; {{ r.status }} by {{ r.reviewer_name }}</template>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span v-if="r.status === 'pending'" class="text-xs font-bold px-3 py-1.5 rounded-full" :class="r.days_waiting >= 3 ? 'bg-red-100 text-red-700' : 'bg-sun-100 text-sun-700'">
            {{ r.days_waiting === 0 ? 'New today' : r.days_waiting + ' day(s) waiting' }}
          </span>
          <span v-else class="text-xs font-bold px-3 py-1.5 rounded-full" :class="r.status === 'approved' ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'">{{ r.status === 'approved' ? 'Approved' : 'Rejected' }}</span>
          <span class="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">
            {{ r.status === 'pending' ? 'Review' : 'View' }}
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </div>
      </router-link>
    </div>
  </StaffShell>
  `,
};

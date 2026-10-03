import { apiGet } from '../api/client.js?v=114';
import AppShell from './AppShell.js?v=114';
import PermitList from './PermitList.js?v=114';
import { authState } from '../store/auth.js?v=114';
import Loader from './Loader.js?v=114';

// Every permit the signed-in applicant has ever filed, with a status filter and search.
export default {
  name: 'MyPermits',
  components: { AppShell, PermitList, Loader },
  data() {
    return { apps: [], loading: true, filter: 'all', search: '' };
  },
  computed: {
    // ?open=<id> arrives from a notification: show that permit, open, whatever the filter
    openId() {
      return this.$route.query.open || null;
    },
    canApply() {
      return !!(authState.user && authState.user.can_apply);
    },
    counts() {
      return {
        all: this.apps.length,
        action: this.apps.filter((a) => a.blocked).length,
        progress: this.apps.filter((a) => !a.blocked && a.status !== 'Approved' && a.status !== 'Rejected').length,
        approved: this.apps.filter((a) => a.status === 'Approved').length,
        rejected: this.apps.filter((a) => a.status === 'Rejected').length,
      };
    },
    tabs() {
      return [
        { key: 'all', label: 'All', count: this.counts.all },
        { key: 'action', label: 'Needs action', count: this.counts.action },
        { key: 'progress', label: 'In progress', count: this.counts.progress },
        { key: 'approved', label: 'Approved', count: this.counts.approved },
        { key: 'rejected', label: 'Rejected', count: this.counts.rejected },
      ].filter((t) => t.key === 'all' || t.count > 0);
    },
    filtered() {
      const q = this.search.trim().toLowerCase();
      return this.apps.filter((a) => {
        const byStatus =
          this.filter === 'all' ? true :
          this.filter === 'action' ? a.blocked :
          this.filter === 'approved' ? a.status === 'Approved' :
          this.filter === 'rejected' ? a.status === 'Rejected' :
          !a.blocked && a.status !== 'Approved' && a.status !== 'Rejected';
        if (!byStatus) return false;
        if (!q) return true;
        return [a.permit_type, a.property_address, a.status, a.permit_number]
          .some((v) => String(v || '').toLowerCase().includes(q));
      });
    },
  },
  watch: {
    // A filter or search left over from earlier could hide the permit being pointed at
    openId: {
      immediate: true,
      handler(id) {
        if (id) {
          this.filter = 'all';
          this.search = '';
        }
      },
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      const res = await apiGet('applications.php?action=list');
      this.apps = res.applications;
      this.loading = false;
    },
  },
  template: `
  <AppShell>
    <div class="flex items-end justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-ink-700">My Permits</h1>
        <p class="text-slate-500 text-sm mt-1">Every application you've filed, newest first.</p>
      </div>
      <router-link to="/applications/new" class="inline-flex items-center gap-1.5 bg-ink-700 text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-ink-600 transition shadow-lg">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        {{ canApply ? 'New Application' : 'Browse Permits' }}
      </router-link>
    </div>

    <Loader v-if="loading" kind="permits" />

    <div v-else-if="!apps.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center">
      <p class="text-slate-500 mb-4">You don't have any permit applications yet.</p>
      <router-link to="/applications/new" class="inline-flex bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700">{{ canApply ? 'Start a New Application' : 'Browse Permits' }}</router-link>
    </div>

    <template v-else>
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div class="flex flex-wrap gap-2">
          <button v-for="t in tabs" :key="t.key" type="button" @click="filter = t.key"
            class="text-sm font-semibold px-3.5 py-2 rounded-full border transition"
            :class="filter === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-brand-100 text-slate-600 hover:border-brand-300'">
            {{ t.label }}
            <span class="ml-1 text-xs" :class="filter === t.key ? 'text-white/70' : 'text-slate-400'">{{ t.count }}</span>
          </button>
        </div>
        <div class="relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="search" type="search" placeholder="Search permits" aria-label="Search permits"
            class="w-full sm:w-64 rounded-xl border border-brand-100 bg-white pl-10 pr-4 py-2 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
        </div>
      </div>

      <transition name="fade" mode="out-in">
        <PermitList v-if="filtered.length" key="list" :apps="filtered" :auto-open="false" :open-id="openId" @changed="refresh" />
        <div v-else key="empty" class="bg-white rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-500">
          No permits match this filter.
        </div>
      </transition>
    </template>
  </AppShell>
  `,
};

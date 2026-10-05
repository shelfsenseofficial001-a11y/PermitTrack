import { apiGet } from '../api/client.js?v=117';
import AppShell from './AppShell.js?v=117';
import PermitList from './PermitList.js?v=117';
import { authState, loadCurrentUser } from '../store/auth.js?v=117';
import Loader from './Loader.js?v=117';

// How many permits the dashboard previews before sending you to My Permits
const PREVIEW_COUNT = 3;

export default {
  name: 'Dashboard',
  components: { AppShell, PermitList, Loader },
  data() {
    return {
      apps: [],
      stats: { active_applications: 0, needs_attention: 0, approved_this_year: 0 },
      loading: true,
      businesses: [],
    };
  },
  computed: {
    user() {
      return authState.user;
    },
    residentStatus() {
      return (authState.user && authState.user.resident_status) || 'none';
    },
    canApply() {
      return !!(authState.user && authState.user.can_apply);
    },
    firstName() {
      const u = authState.user;
      return (u && (u.first_name || (u.full_name || '').trim().split(/\s+/)[0])) || '';
    },
    // The dashboard previews only the most pressing few; My Permits has them all
    previewApps() {
      return [...this.apps]
        .sort((a, b) => (b.blocked ? 1 : 0) - (a.blocked ? 1 : 0))
        .slice(0, PREVIEW_COUNT);
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    businessBadge(status) {
      return {
        draft: { text: 'Draft · finish it', cls: 'bg-sun-100 text-sun-700' },
        pending: { text: 'Under review', cls: 'bg-sun-100 text-sun-700' },
        approved: { text: '✓ Verified', cls: 'bg-brand-100 text-brand-700' },
        rejected: { text: 'Needs changes', cls: 'bg-red-100 text-red-700' },
      }[status];
    },
    async refresh() {
      this.loading = true;
      // Also refresh the account so a newly approved label shows up without logging in again
      const [, appsRes, statsRes, bizRes] = await Promise.all([
        loadCurrentUser(),
        apiGet('applications.php?action=list'),
        apiGet('applications.php?action=stats'),
        apiGet('business.php?action=list'),
      ]);
      this.businesses = bizRes.businesses;
      this.apps = appsRes.applications;
      this.stats = statsRes;
      this.loading = false;
    },
  },
  template: `
  <AppShell>
    <div class="pt-gradient-wide relative overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-10 mb-8 flex items-end justify-between flex-wrap gap-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <div class="max-w-xl">
        <p class="text-sm font-medium text-white/85 mb-2">Welcome back{{ firstName ? ', ' + firstName : '' }}</p>
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">Your Permits &amp; Licenses</h1>
        <p class="text-white/85 text-sm mt-2">Track every application and inspection in one place, from submission to approval.</p>
      </div>
      <router-link to="/applications/new" class="inline-flex items-center gap-1.5 bg-ink-700 text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-ink-600 transition shadow-lg">
        <svg v-if="canApply" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        {{ canApply ? 'New Application' : 'Browse Permits' }}
      </router-link>
    </div>

    <!-- Account level and upgrades -->
    <div v-if="user && user.role === 'applicant'" class="bg-white rounded-2xl border border-brand-100 p-6 mb-8">
      <div class="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="font-bold text-ink-700">Your account</h2>
            <span v-for="level in user.levels" :key="level" class="text-xs font-bold px-2.5 py-1 rounded-full"
              :class="level === 'Normal User' ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-700'">{{ level }}</span>
          </div>
          <p class="text-sm text-slate-500 max-w-xl">
            {{ canApply ? 'You can apply for permits. You can also add another label to your account.' : 'As a Normal User you can browse permits and their requirements. To apply, verify your account as a Resident, a Business Owner, or both.' }}
          </p>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border p-5" :class="residentStatus === 'rejected' ? 'border-red-200 bg-red-50/60' : 'border-brand-100 bg-meadow/60'">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-brand-600 text-sun-300 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
            </div>
            <div class="font-bold text-ink-700">{{ residentStatus === 'verified' ? 'Verified Resident' : 'Become a Resident' }}</div>
          </div>
          <template v-if="residentStatus === 'verified'">
            <p class="text-sm text-slate-500 mb-4">Your residency is verified. You can apply for resident permits.</p>
            <span class="inline-flex text-xs font-bold px-3 py-1.5 rounded-full bg-brand-100 text-brand-700">✓ Verified</span>
          </template>
          <template v-else-if="residentStatus === 'pending'">
            <p class="text-sm text-slate-500 mb-4">City Staff is checking your proofs of residence. We'll notify you when it's done.</p>
            <router-link to="/residency" class="inline-flex text-xs font-bold px-3 py-1.5 rounded-full bg-sun-100 text-sun-700 hover:bg-sun-200">Under review · View</router-link>
          </template>
          <template v-else-if="residentStatus === 'rejected'">
            <p class="text-sm text-red-700 mb-4">Your last request wasn't approved. See what to fix and submit new proofs.</p>
            <router-link to="/residency" class="inline-flex bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-700 transition">See details</router-link>
          </template>
          <template v-else>
            <p class="text-sm text-slate-500 mb-4">Upload two proofs of residence. City Staff checks them, then you can apply for resident permits.</p>
            <router-link to="/residency" class="inline-flex bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition">Start verification</router-link>
          </template>
        </div>
        <div class="rounded-2xl border border-brand-100 bg-meadow/60 p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-sun-300 text-ink-700 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1"/></svg>
            </div>
            <div class="font-bold text-ink-700">{{ businesses.length ? 'Your businesses' : 'Add your business' }}</div>
          </div>
          <p v-if="!businesses.length" class="text-sm text-slate-500 mb-4">Already trading in Dasmariñas? Record the business here with its DTI/SEC/CDA certificate. Once City Staff verify it, you can file and renew its permits.</p>
          <ul v-else class="space-y-2 mb-4">
            <li v-for="b in businesses" :key="b.id">
              <router-link :to="'/businesses/' + b.id" class="flex items-center justify-between gap-2 rounded-xl bg-white border border-brand-100 px-3 py-2 hover:border-brand-300">
                <span class="text-sm font-semibold text-slate-800 truncate">{{ b.business_name }}</span>
                <span class="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" :class="businessBadge(b.status).cls">{{ businessBadge(b.status).text }}</span>
              </router-link>
            </li>
          </ul>
          <router-link to="/businesses/new" class="inline-flex bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition">
            {{ businesses.length ? 'Add another business' : 'Add your business' }}
          </router-link>
        </div>
      </div>
    </div>

    <Loader v-if="loading" kind="dashboard" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white rounded-2xl border border-brand-100 p-5 flex items-center gap-4">
          <div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Applications</div>
            <div class="text-3xl font-bold text-ink-700 mt-0.5">{{ stats.active_applications }}</div>
          </div>
        </div>
        <div class="bg-white rounded-2xl border p-5 flex items-center gap-4" :class="stats.needs_attention > 0 ? 'border-red-200' : 'border-brand-100'">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="stats.needs_attention > 0 ? 'bg-red-50 text-red-600' : 'bg-sun-100 text-sun-700'">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Needs Your Attention</div>
            <div class="text-3xl font-bold mt-0.5" :class="stats.needs_attention > 0 ? 'text-red-600' : 'text-ink-700'">{{ stats.needs_attention }}</div>
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-brand-100 p-5 flex items-center gap-4">
          <div class="w-11 h-11 rounded-xl bg-brand-600 text-sun-300 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Approved This Year</div>
            <div class="text-3xl font-bold text-ink-700 mt-0.5">{{ stats.approved_this_year }}</div>
          </div>
        </div>
      </div>

      <div v-if="!apps.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center">
        <p class="text-slate-500 mb-4">You don't have any permit applications yet.</p>
        <router-link to="/applications/new" class="inline-flex bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700">{{ canApply ? 'Start a New Application' : 'Browse Permits' }}</router-link>
      </div>

      <template v-else>
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wide">
            {{ apps.length > previewApps.length ? 'Needs Your Attention' : 'Your Permits' }}
          </h2>
          <router-link to="/permits" class="text-sm font-semibold text-brand-700 hover:underline inline-flex items-center gap-1">
            View all {{ apps.length }} permits
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
          </router-link>
        </div>
        <PermitList :apps="previewApps" show-details-link :show-detail="false" @changed="refresh" />
      </template>
    </template>
  </AppShell>
  `,
};

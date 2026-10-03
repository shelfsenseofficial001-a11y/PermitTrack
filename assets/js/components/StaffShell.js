import { authState, logout, reloadAs, signOutPathFor } from '../store/auth.js?v=113';
import { apiGet } from '../api/client.js?v=113';
import { openChangePassword } from '../store/ui.js?v=113';

export default {
  name: 'StaffShell',
  data() {
    return { authState, pendingResidency: 0, pendingBusinesses: 0 };
  },
  computed: {
    initials() {
      const name = this.authState.user && this.authState.user.full_name;
      if (!name) return '';
      return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
  },
  async mounted() {
    // Badges on the verification links
    const [residency, business] = await Promise.all([
      apiGet('residency.php?action=counts').catch(() => ({ pending: 0 })),
      apiGet('business.php?action=counts').catch(() => ({ pending: 0 })),
    ]);
    this.pendingResidency = residency.pending;
    this.pendingBusinesses = business.pending;
  },
  methods: {
    openChangePassword,
    async doLogout() {
      const leaving = authState.user;
      const next = await logout();
      if (next) return reloadAs(next);
      this.$router.push(signOutPathFor(leaving)); // staff go back to the Staff Portal login
    },
  },
  template: `
  <div class="min-h-screen bg-meadow">
    <header class="bg-ink-700 text-white sticky top-0 z-10 shadow-[0_8px_24px_-12px_rgba(16,48,29,0.6)]">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/reviewer" class="flex items-center gap-2.5">
            <img src="assets/images/PermitTrackIcon.png?v=113" alt="" class="w-9 h-9 object-contain shrink-0" />
            <div class="leading-tight">
              <div class="text-sm font-bold">PermitTrack</div>
              <div class="text-[11px] text-ink-300 tracking-wide">{{ authState.user && authState.user.role === 'admin' ? 'ADMIN · STAFF PORTAL' : 'STAFF PORTAL' }}</div>
            </div>
          </router-link>
          <nav class="hidden md:flex items-center gap-5 text-sm font-medium whitespace-nowrap">
            <router-link to="/reviewer" class="text-ink-200 hover:text-white transition" active-class="!text-sun-300">My Queue</router-link>
            <router-link to="/staff/residency" class="inline-flex items-center gap-1.5 text-ink-200 hover:text-white transition" active-class="!text-sun-300" title="Resident Verifications">
              Residents
              <span v-if="pendingResidency" class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-sun-400 text-ink-700 text-[11px] font-bold inline-flex items-center justify-center" :aria-label="pendingResidency + ' waiting'">{{ pendingResidency }}</span>
            </router-link>
            <router-link v-if="authState.user && authState.user.role === 'admin'" to="/admin" class="text-ink-200 hover:text-white transition order-last" active-class="!text-sun-300">Admin</router-link>
            <router-link to="/staff/businesses" class="inline-flex items-center gap-1.5 text-ink-200 hover:text-white transition" active-class="!text-sun-300" title="Business Verifications">
              Businesses
              <span v-if="pendingBusinesses" class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-sun-400 text-ink-700 text-[11px] font-bold inline-flex items-center justify-center" :aria-label="pendingBusinesses + ' waiting'">{{ pendingBusinesses }}</span>
            </router-link>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-brand-500 ring-2 ring-sun-300/70 flex items-center justify-center text-xs font-bold">{{ initials }}</div>
            <span class="hidden sm:inline text-sm">{{ authState.user && authState.user.full_name }}</span>
          </div>
          <button type="button" @click="openChangePassword" class="hidden sm:inline text-xs text-ink-300 hover:text-white transition">Password</button>
          <button @click="doLogout" class="text-xs text-ink-300 hover:text-red-300 transition">Log out</button>
        </div>
      </div>
    </header>
    <main class="page-body max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <slot></slot>
    </main>
  </div>
  `,
};

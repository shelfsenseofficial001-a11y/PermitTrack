import { authState } from '../store/auth.js?v=115';
import { apiGet } from '../api/client.js?v=115';
import { openChangePassword, askSignOut } from '../store/ui.js?v=115';

export default {
  name: 'StaffShell',
  data() {
    return { authState, pendingResidency: 0, pendingBusinesses: 0, menuOpen: false };
  },
  computed: {
    initials() {
      const name = this.authState.user && this.authState.user.full_name;
      if (!name) return '';
      return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
    isAdmin() {
      return !!(this.authState.user && this.authState.user.role === 'admin');
    },
    // The bottom tray on phones: the same destinations as the header nav on desktop, laid out
    // like the residents' tray so both portals feel like one app
    trayTabs() {
      const p = this.$route.path;
      const tabs = [
        { key: 'queue', to: '/reviewer', label: 'My Queue', active: p.startsWith('/reviewer') },
        { key: 'residents', to: '/staff/residency', label: 'Residents', badge: this.pendingResidency, active: p.startsWith('/staff/residency') },
        { key: 'businesses', to: '/staff/businesses', label: 'Businesses', badge: this.pendingBusinesses, active: p.startsWith('/staff/businesses') },
      ];
      if (this.isAdmin) tabs.push({ key: 'admin', to: '/admin', label: 'Admin', active: p.startsWith('/admin') });
      return tabs;
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocClick);
    document.removeEventListener('keydown', this.onKey);
  },
  async mounted() {
    this.onDocClick = (e) => {
      if (this.menuOpen && this.$refs.menu && !this.$refs.menu.contains(e.target)) this.menuOpen = false;
    };
    this.onKey = (e) => { if (e.key === 'Escape') this.menuOpen = false; };
    document.addEventListener('click', this.onDocClick);
    document.addEventListener('keydown', this.onKey);

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
    // Asks first; the sign-out itself (and its veil) runs from app.js, shared by every menu
    doLogout() {
      this.menuOpen = false;
      askSignOut();
    },
  },
  template: `
  <div class="min-h-screen bg-meadow">
    <header class="bg-ink-700 text-white sticky top-0 z-10 shadow-[0_8px_24px_-12px_rgba(16,48,29,0.6)]">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/reviewer" class="flex items-center gap-2.5">
            <img src="assets/images/PermitTrackIcon.png?v=115" alt="" class="w-9 h-9 object-contain shrink-0" />
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
        <!-- Account menu, the same one residents have -->
        <div ref="menu" class="relative">
          <button type="button" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-haspopup="menu"
            class="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/10 transition">
            <div class="w-8 h-8 rounded-full bg-brand-500 ring-2 ring-sun-300/70 flex items-center justify-center text-xs font-bold">{{ initials }}</div>
            <span class="hidden sm:inline text-sm">{{ authState.user && authState.user.full_name }}</span>
            <svg class="w-4 h-4 text-ink-300 transition-transform" :class="menuOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <transition name="pop">
          <div v-if="menuOpen" role="menu"
            class="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-ink-700 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] p-2 text-sm">
            <div class="px-3 py-2.5 border-b border-white/10 mb-1">
              <div class="font-semibold text-white truncate">{{ authState.user && authState.user.full_name }}</div>
              <div class="text-xs text-ink-300 truncate">{{ authState.user && (authState.user.email || authState.user.phone) }}</div>
              <div class="flex flex-wrap gap-1 mt-2">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sun-300 text-ink-700">{{ isAdmin ? 'Admin' : 'City Staff' }}</span>
                <span v-if="authState.user && authState.user.department_name" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-ink-200 truncate max-w-full">{{ authState.user.department_name }}</span>
              </div>
            </div>
            <button type="button" role="menuitem" @click="menuOpen = false; openChangePassword()" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
              <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Change password
            </button>
            <div class="h-px bg-white/10 my-1"></div>
            <button type="button" role="menuitem" @click="doLogout" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-300 hover:bg-red-500/15">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
              Sign out
            </button>
          </div>
          </transition>
        </div>
      </div>
    </header>
    <!-- On phones, extra room at the bottom so the last of the page clears the tab tray -->
    <main class="page-body max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <slot></slot>
    </main>

    <!-- Bottom tab tray on phones; the header carries these links from md up -->
    <nav aria-label="Main"
      class="md:hidden fixed inset-x-0 bottom-0 z-40 bg-ink-700/95 backdrop-blur-md border-t border-white/10 shadow-[0_-12px_30px_-18px_rgba(7,24,14,0.6)] pb-[env(safe-area-inset-bottom)]">
      <div class="grid h-16" :class="trayTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'">
        <router-link v-for="t in trayTabs" :key="t.key" :to="t.to" :aria-current="t.active ? 'page' : null"
          class="group flex flex-col items-center justify-center gap-1 focus:outline-none"
          :class="t.active ? 'text-sun-300' : 'text-ink-300 hover:text-white active:text-white'">
          <span class="relative w-14 h-8 rounded-full flex items-center justify-center transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-sun-300/60"
            :class="t.active ? 'bg-white/10' : ''">
            <!-- My Queue -->
            <svg v-if="t.key === 'queue'" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            <!-- Residents -->
            <svg v-else-if="t.key === 'residents'" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
            <!-- Businesses -->
            <svg v-else-if="t.key === 'businesses'" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>
            <!-- Admin -->
            <svg v-else class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>
            <span v-if="t.badge" class="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-sun-400 text-ink-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-ink-700"
              :aria-label="t.badge + ' waiting'">{{ t.badge > 9 ? '9+' : t.badge }}</span>
          </span>
          <span class="text-[11px] font-semibold leading-none">{{ t.label }}</span>
        </router-link>
      </div>
    </nav>
  </div>
  `,
};

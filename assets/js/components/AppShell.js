import { authState, logout, listAccounts, switchAccount, reloadAs, signOutPathFor } from '../store/auth.js?v=65';
import { apiGet, apiPost } from '../api/client.js?v=65';
import ChatWidget from './ChatWidget.js?v=65';
import AddAccountModal from './AddAccountModal.js?v=65';
import { timeAgo } from '../util.js?v=65';
import { uiState, openChangePassword } from '../store/ui.js?v=65';
import Loader from './Loader.js?v=65';

export default {
  name: 'AppShell',
  components: { ChatWidget, AddAccountModal, Loader },
  data() {
    return {
      authState, uiState, menuOpen: false, accountsOpen: false, accounts: [], accountsLoading: false,
      switching: false, switchError: '', addingAccount: false,
      notifOpen: false, notifications: [], unread: 0, notifLoading: false,
    };
  },
  async mounted() {
    // Close the account and notification menus on an outside click or Escape
    this.onDocClick = (e) => {
      if (this.menuOpen && this.$refs.menu && !this.$refs.menu.contains(e.target)) this.menuOpen = false;
      if (this.notifOpen && this.$refs.notif && !this.$refs.notif.contains(e.target)) this.notifOpen = false;
    };
    this.onKey = (e) => {
      if (e.key === "Escape") { this.menuOpen = false; this.notifOpen = false; }
    };
    document.addEventListener('click', this.onDocClick);
    document.addEventListener('keydown', this.onKey);
    // Load the badge count up front; the list itself is fetched when the bell opens
    if (this.isApplicant) await this.loadNotifications();
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocClick);
    document.removeEventListener('keydown', this.onKey);
  },
  computed: {
    initials() {
      const name = this.authState.user && this.authState.user.full_name;
      if (!name) return '';
      return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
    // The feed is built from the applicant's own permits; staff have their own queues
    isApplicant() {
      return !!(this.authState.user && this.authState.user.role === 'applicant');
    },
    // The bottom tray on phones: the same three destinations as the header nav on desktop
    trayTabs() {
      const canApply = !!(this.authState.user && this.authState.user.can_apply);
      const p = this.$route.path;
      return [
        { key: 'dashboard', to: '/dashboard', label: 'Dashboard', active: p === '/dashboard' },
        // A single permit's page belongs to My Permits, so that tab stays lit while you're in one
        { key: 'permits', to: '/permits', label: 'My Permits', active: p === '/permits' || /^\/applications\/\d+/.test(p) },
        { key: 'new', to: '/applications/new', label: canApply ? 'New Application' : 'Browse Permits', active: p === '/applications/new' },
      ];
    },
  },
  watch: {
    menuOpen(open) {
      if (!open) this.accountsOpen = false;
    },
    // Something outside the bell (the Notifications page) marked them read: refresh the badge
    'uiState.notificationsVersion'() {
      if (this.isApplicant) this.loadNotifications();
    },
  },
  methods: {
    initialsOf(name) {
      return (name || '').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
    async loadNotifications() {
      this.notifLoading = true;
      try {
        const res = await apiGet('notifications.php?action=list');
        this.notifications = res.notifications;
        // The badge counts what's arrived since the bell was last opened; unread dots on the
        // items themselves stay until each is opened or "Mark all as read" is used
        this.unread = res.unseen ?? res.unread;
      } catch (e) {
        this.notifications = [];
      } finally {
        this.notifLoading = false;
      }
    },
    async toggleNotifications() {
      this.notifOpen = !this.notifOpen;
      this.menuOpen = false;
      if (!this.notifOpen) return;
      await this.loadNotifications();
      // Opening the bell clears the badge ("seen"). The dots stay: they mean "not opened yet"
      if (this.unread) {
        this.unread = 0;
        apiPost('notifications.php?action=seen', {}).catch(() => {});
      }
    },
    timeAgo,
    openChangePassword,
    // Land on the permit itself in My Permits, already open, rather than a bare page
    openNotification(n) {
      this.notifOpen = false;
      if (n.unread) {
        n.unread = false;
        apiPost('notifications.php?action=read', { id: n.id }).catch(() => {});
      }
      this.$router.push({ path: '/permits', query: { open: String(n.application_id) } });
    },
    async toggleAccounts() {
      this.accountsOpen = !this.accountsOpen;
      if (!this.accountsOpen) return;
      this.switchError = '';
      this.accountsLoading = true;
      try {
        this.accounts = await listAccounts();
      } finally {
        this.accountsLoading = false;
      }
    },
    async chooseAccount(a) {
      if (a.current) {
        this.menuOpen = false;
        return;
      }
      this.switching = true;
      this.switchError = '';
      try {
        reloadAs(await switchAccount(a.id));
      } catch (e) {
        this.switchError = e.message;
        this.accounts = await listAccounts();
      } finally {
        this.switching = false;
      }
    },
    async doLogout() {
      const leaving = authState.user;
      const next = await logout();
      // Another account on this browser takes over; otherwise wherever this role signs out to
      if (next) reloadAs(next);
      else this.$router.push(signOutPathFor(leaving));
    },
  },
  template: `
  <div class="min-h-screen bg-meadow">
    <header class="bg-ink-700 text-white sticky top-0 z-10 shadow-[0_8px_24px_-12px_rgba(16,48,29,0.6)]">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/dashboard" class="flex items-center gap-2.5">
            <img src="assets/images/PermitTrackIcon.png?v=65" alt="" class="w-9 h-9 object-contain shrink-0" />
            <div class="leading-tight">
              <div class="text-sm font-bold">PermitTrack</div>
              <div class="text-[11px] text-ink-300">City of Dasmariñas</div>
            </div>
          </router-link>
          <nav class="hidden md:flex items-center gap-5 text-sm font-medium whitespace-nowrap">
            <router-link to="/dashboard" class="text-ink-200 hover:text-white transition" active-class="!text-sun-300">Dashboard</router-link>
            <router-link to="/permits" class="text-ink-200 hover:text-white transition" active-class="!text-sun-300">My Permits</router-link>
            <router-link to="/applications/new" class="text-ink-200 hover:text-white transition" active-class="!text-sun-300">{{ authState.user && authState.user.can_apply ? 'New Application' : 'Browse Permits' }}</router-link>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <!-- Notifications -->
          <div v-if="isApplicant" ref="notif" class="relative">
            <button type="button" @click="toggleNotifications" :aria-expanded="notifOpen" aria-haspopup="menu"
              :title="unread ? unread + ' new notifications' : 'Notifications'"
              class="flex items-center justify-center w-9 h-9 rounded-full text-ink-300 hover:text-white hover:bg-white/10 transition" :class="notifOpen ? 'bg-white/10 text-white' : ''">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span v-if="unread" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sun-400 text-ink-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-ink-700">
                {{ unread > 9 ? '9+' : unread }}
              </span>
            </button>

            <!-- Phones: spans the screen just under the header. The bell sits left of the avatar, so a
                 panel hung from the bell's right edge would run off the left side. From sm up it
                 hangs under the bell as usual. -->
            <transition name="pop">
            <div v-if="notifOpen" role="menu"
              class="origin-top sm:origin-top-right fixed inset-x-3 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[22rem] rounded-2xl bg-ink-700 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] p-2 text-sm">
              <div class="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 mb-1">
                <div class="font-semibold text-white">Notifications</div>
                <router-link to="/notifications" @click="notifOpen = false" class="text-xs font-semibold text-sun-300 hover:underline">View all</router-link>
              </div>

              <Loader v-if="notifLoading" variant="inline" kind="notifications" class="justify-center py-5 text-ink-300" />

              <div v-else-if="!notifications.length" class="flex flex-col items-center text-center px-4 py-7">
                <span class="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <svg class="w-5 h-5 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </span>
                <p class="font-semibold text-white">No notifications yet.</p>
                <p class="text-xs text-ink-300 mt-1 leading-relaxed">Updates about your permits and applications will show up here.</p>
              </div>

              <!-- On phones, short enough to stay clear of the bottom tab tray -->
              <div v-else class="max-h-[min(24rem,calc(100dvh-14rem))] md:max-h-96 overflow-y-auto scroll-dark pr-0.5">
                <button v-for="n in notifications" :key="n.id" type="button" role="menuitem" @click="openNotification(n)"
                  class="w-full text-left flex gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition">
                  <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                    :class="n.kind === 'message' ? 'bg-sun-300/20 text-sun-300' : 'bg-brand-500/20 text-brand-300'">
                    <svg v-if="n.kind === 'message'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>
                    <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-start gap-2">
                      <span class="block font-semibold text-white leading-snug flex-1">{{ n.title }}</span>
                      <span v-if="n.unread" class="mt-1 w-2 h-2 rounded-full bg-sun-400 shrink-0"></span>
                    </span>
                    <span class="block text-xs text-ink-200 leading-relaxed mt-0.5 line-clamp-2">{{ n.body }}</span>
                    <span class="block text-[11px] text-ink-400 mt-1">{{ n.property_address }} &middot; {{ timeAgo(n.created_at) }}</span>
                  </span>
                </button>
              </div>
            </div>
            </transition>
          </div>
          <!-- Account menu -->
          <div ref="menu" class="relative">
            <button type="button" @click="menuOpen = !menuOpen; notifOpen = false" :aria-expanded="menuOpen" aria-haspopup="menu"
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
                  <span v-for="level in (authState.user ? authState.user.levels : [])" :key="level"
                    class="text-[11px] font-bold px-2 py-0.5 rounded-full" :class="level === 'Normal User' ? 'bg-white/10 text-ink-200' : 'bg-sun-300 text-ink-700'">{{ level }}</span>
                </div>
              </div>
              <router-link to="/account" role="menuitem" @click="menuOpen = false" class="flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My account
              </router-link>
              <button type="button" role="menuitem" @click="menuOpen = false; openChangePassword()" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10">
                <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Change password
              </button>
              <div class="h-px bg-white/10 my-1"></div>
              <div class="relative">
                <button type="button" role="menuitem" @click="toggleAccounts" :aria-expanded="accountsOpen"
                  class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-ink-100 hover:bg-white/10" :class="accountsOpen ? 'bg-white/10' : ''">
                  <span class="flex items-center gap-3">
                    <svg class="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M8 21H3v-5"/><path d="M3 21l7-7"/></svg>
                    Switch account
                  </span>
                  <svg class="w-4 h-4 text-ink-400 transition-transform" :class="accountsOpen ? 'rotate-90' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                </button>

                <!-- Accounts signed in on this browser (opens inside the menu, on the right) -->
                <transition name="expand">
                <div v-if="accountsOpen" class="mt-1 rounded-xl bg-black/20 border border-white/10 p-1.5">
                  <Loader v-if="accountsLoading" variant="inline" kind="accounts" class="px-2 text-ink-300" />
                  <button v-for="a in accounts" :key="a.id" type="button" @click="chooseAccount(a)" :disabled="switching"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-white/10" :aria-current="a.current ? 'true' : null">
                    <span class="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center" :class="a.current ? 'ring-2 ring-emerald-400' : 'ring-1 ring-white/20'">
                      <span v-if="a.current" class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    </span>
                    <span class="w-7 h-7 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{{ initialsOf(a.full_name) }}</span>
                    <span class="min-w-0">
                      <span class="block font-semibold text-white truncate">{{ a.full_name }}</span>
                      <span class="block text-[11px] text-ink-300 truncate">{{ a.role === 'applicant' ? a.contact : (a.role === 'admin' ? 'Admin' : 'City Staff') + ' · ' + a.contact }}</span>
                    </span>
                  </button>
                  <p v-if="switchError" class="px-3 py-1 text-xs text-red-300">{{ switchError }}</p>
                  <div class="h-px bg-white/10 my-1"></div>
                  <button type="button" @click="menuOpen = false; addingAccount = true" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-white hover:bg-white/10">
                    <span class="w-3.5 text-center text-lg leading-none text-ink-300">+</span>
                    Add account
                  </button>
                </div>
                </transition>
              </div>
              <button type="button" role="menuitem" @click="doLogout" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-300 hover:bg-red-500/15">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
                Sign out
              </button>
            </div>
            </transition>
          </div>
        </div>
      </div>
    </header>
    <!-- On phones, extra room at the bottom so the last of the page clears the tab tray -->
    <main class="page-body max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <slot></slot>
    </main>

    <!-- Bottom tab tray on phones; the header carries these links from md up -->
    <nav v-if="isApplicant" aria-label="Main"
      class="md:hidden fixed inset-x-0 bottom-0 z-40 bg-ink-700/95 backdrop-blur-md border-t border-white/10 shadow-[0_-12px_30px_-18px_rgba(7,24,14,0.6)] pb-[env(safe-area-inset-bottom)]">
      <div class="grid grid-cols-3 h-16">
        <router-link v-for="t in trayTabs" :key="t.key" :to="t.to" :aria-current="t.active ? 'page' : null"
          class="group flex flex-col items-center justify-center gap-1 focus:outline-none"
          :class="t.active ? 'text-sun-300' : 'text-ink-300 hover:text-white active:text-white'">
          <span class="w-14 h-8 rounded-full flex items-center justify-center transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-sun-300/60"
            :class="t.active ? 'bg-white/10' : ''">
            <!-- Dashboard -->
            <svg v-if="t.key === 'dashboard'" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
            <!-- My Permits -->
            <svg v-else-if="t.key === 'permits'" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M16 3v4h4"/><path d="M4 7v12a2 2 0 0 0 2 2h9"/><path d="M10 12h6M10 16h4"/></svg>
            <!-- New Application / Browse Permits -->
            <svg v-else-if="authState.user && authState.user.can_apply" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
            <svg v-else class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <span class="text-[11px] font-semibold leading-none">{{ t.label }}</span>
        </router-link>
      </div>
    </nav>

    <ChatWidget v-if="authState.user && authState.user.role === 'applicant'" />
    <transition name="modal">
      <AddAccountModal v-if="addingAccount" @close="addingAccount = false" />
    </transition>
  </div>
  `,
};

import { authState, logout } from '../store/auth.js';

export default {
  name: 'StaffShell',
  data() {
    return { authState };
  },
  computed: {
    initials() {
      const name = this.authState.user && this.authState.user.full_name;
      if (!name) return '';
      return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
  },
  methods: {
    async doLogout() {
      await logout();
      this.$router.push('/login');
    },
  },
  template: `
  <div class="min-h-screen bg-slate-50">
    <header class="bg-ink-700 text-white sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/reviewer" class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-xs">PT</div>
            <div class="leading-tight">
              <div class="text-sm font-bold">PermitTrack</div>
              <div class="text-[11px] text-ink-300 tracking-wide">STAFF PORTAL</div>
            </div>
          </router-link>
          <nav class="hidden sm:flex items-center gap-5 text-sm font-medium">
            <router-link to="/reviewer" class="text-ink-200 hover:text-white transition" active-class="text-white">My Queue</router-link>
            <span class="text-ink-400 cursor-default" title="Not available in this demo">All Applications</span>
            <span class="text-ink-400 cursor-default" title="Not available in this demo">Reports</span>
            <span class="text-ink-400 cursor-default" title="Not available in this demo">Departments</span>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold">{{ initials }}</div>
            <span class="hidden sm:inline text-sm">{{ authState.user && authState.user.full_name }}</span>
          </div>
          <button @click="doLogout" class="text-xs text-ink-300 hover:text-red-300 transition">Log out</button>
        </div>
      </div>
    </header>
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <slot></slot>
    </main>
  </div>
  `,
};

import { reactive } from 'vue';
import { apiGet } from '../api/client.js?v=118';

/**
 * The account picker on the sign-in pages: a tab on the left edge that pulls out a list of the
 * accounts this install can be signed in as, grouped by level, and fills the form with the one
 * you click. The list comes from the API (auth.php?action=demo_accounts), which only names
 * accounts the shared demo password actually opens, so nothing here is a dead end and a real
 * person's account never shows up. The whole thing disappears when testing.demo_accounts is off.
 */

// Credentials carried from one sign-in page to the other. The API refuses a staff account on the
// resident page and a resident account on the Staff Portal, so picking across the two routes to
// the right page and leaves the details here for it to collect on arrival.
const handoff = reactive({ identifier: '', password: '' });

/** Returns credentials routed here from the other sign-in page, once, or null. */
export function takeDemoPrefill() {
  if (!handoff.identifier) return null;
  const credentials = { identifier: handoff.identifier, password: handoff.password };
  handoff.identifier = '';
  handoff.password = '';
  return credentials;
}

export default {
  name: 'DemoAccounts',
  props: {
    // Which sign-in page this is on, so a pick from the other side knows to route instead of fill.
    portal: { type: String, default: 'resident' },
  },
  emits: ['fill'],
  data() {
    return {
      open: false,
      loaded: false,
      loading: false,
      error: '',
      enabled: true,
      password: '',
      groups: [],
      query: '',
      // Group key -> open?. Set the first time the list arrives: the groups for this page's own
      // portal start open, the other page's start closed.
      expanded: {},
    };
  },
  computed: {
    // Groups with the search applied. A group with nothing left drops out entirely.
    visibleGroups() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.groups;
      return this.groups
        .map((group) => ({
          ...group,
          accounts: group.accounts.filter((a) =>
            `${a.name} ${a.email} ${a.detail}`.toLowerCase().includes(q)),
        }))
        .filter((group) => group.accounts.length);
    },
    totalShown() {
      return this.visibleGroups.reduce((n, g) => n + g.accounts.length, 0);
    },
  },
  methods: {
    toggle() {
      this.open = !this.open;
      if (this.open && !this.loaded && !this.loading) this.load();
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const res = await apiGet('auth.php?action=demo_accounts');
        this.enabled = !!res.enabled;
        this.password = res.password || '';
        this.groups = res.groups || [];
        this.expanded = Object.fromEntries(this.groups.map((g) => [g.key, g.portal === this.portal]));
        this.loaded = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    // While searching every matching group is open — a hit hidden inside a collapsed group
    // looks like no hit at all.
    isExpanded(group) {
      return !!this.query.trim() || !!this.expanded[group.key];
    },
    toggleGroup(group) {
      if (this.query.trim()) return;
      this.expanded[group.key] = !this.expanded[group.key];
    },
    pick(group, account) {
      const credentials = { identifier: account.email, password: this.password };
      this.open = false;
      if (group.portal === this.portal) {
        this.$emit('fill', credentials);
        return;
      }
      handoff.identifier = credentials.identifier;
      handoff.password = credentials.password;
      this.$router.push(group.portal === 'staff' ? '/staff/login' : '/login');
    },
  },
  template: `
  <div v-if="enabled">
    <!-- Hangs off the card's right edge, square where it meets the card so it reads as attached.
         Hidden while the panel is out, since the panel covers that edge on a narrow screen. -->
    <button v-show="!open" type="button" @click="toggle"
      :aria-expanded="open ? 'true' : 'false'" aria-controls="demo-accounts-panel"
      aria-label="Show demo accounts"
      class="absolute top-1/2 -translate-y-1/2 right-0 sm:translate-x-full z-30 flex flex-col items-center gap-2 py-5 px-1.5 rounded-l-2xl sm:rounded-l-none sm:rounded-r-2xl bg-brand-600 text-white shadow-[0_10px_30px_-10px_rgba(16,48,29,0.65)] hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 transition-colors duration-200 motion-reduce:transition-none">
      <span class="text-[10px] font-bold uppercase tracking-[0.2em] [writing-mode:vertical-rl]">Demo</span>
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </button>

    <transition enter-from-class="opacity-0" leave-to-class="opacity-0"
      enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-200 motion-reduce:transition-none">
      <div v-if="open" @click="open = false" class="fixed inset-0 z-40 bg-ink-900/25 backdrop-blur-[1px]"></div>
    </transition>

    <transition enter-from-class="translate-x-full" leave-to-class="translate-x-full"
      enter-active-class="transition-transform duration-300 ease-out motion-reduce:transition-none"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:transition-none">
      <aside v-if="open" id="demo-accounts-panel"
        class="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-white shadow-[0_0_60px_-12px_rgba(16,48,29,0.45)] flex flex-col">

        <div class="px-5 pt-5 pb-4 border-b border-ink-100">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-bold text-ink-700">Demo accounts</h2>
              <p class="text-xs text-slate-500 mt-0.5">Pick one and the form fills itself.</p>
            </div>
            <button type="button" @click="open = false" aria-label="Close demo accounts"
              class="shrink-0 p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <p v-if="password" class="mt-3 text-xs text-slate-500">
            Every account below uses the password
            <code class="font-mono font-semibold text-ink-700 bg-brand-50 ring-1 ring-brand-100 rounded px-1.5 py-0.5">{{ password }}</code>
          </p>
          <div v-if="loaded && groups.length" class="relative mt-3">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input v-model="query" type="search" placeholder="Search name, email or office"
              aria-label="Search demo accounts"
              class="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-3 py-3">
          <p v-if="loading" class="px-2 py-6 text-sm text-slate-500">Loading accounts…</p>
          <p v-else-if="error" class="px-2 py-6 text-sm text-red-600">{{ error }}</p>
          <p v-else-if="query.trim() && !totalShown" class="px-2 py-6 text-sm text-slate-500">No account matches “{{ query }}”.</p>
          <p v-else-if="!groups.length" class="px-2 py-6 text-sm text-slate-500">No demo accounts on this install.</p>

          <div v-for="group in visibleGroups" :key="group.key" class="mb-1.5">
            <button type="button" @click="toggleGroup(group)"
              :aria-expanded="isExpanded(group) ? 'true' : 'false'"
              class="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left hover:bg-brand-50/70 transition">
              <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none"
                :class="isExpanded(group) ? 'rotate-90' : ''"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              <span class="flex-1 text-xs font-bold uppercase tracking-wider text-ink-600">{{ group.label }}</span>
              <span class="shrink-0 text-[11px] font-semibold text-slate-400 tabular-nums">{{ group.accounts.length }}</span>
            </button>

            <div v-if="isExpanded(group)" class="pl-1 pr-0.5 pb-1">
              <p class="px-2 pb-2 text-[11px] leading-relaxed text-slate-500">{{ group.note }}</p>
              <p v-if="group.portal !== portal" class="mx-2 mb-2 px-2.5 py-1.5 rounded-lg bg-sun-50 ring-1 ring-sun-200 text-[11px] leading-relaxed text-ink-700">
                Signs in on the {{ group.portal === 'staff' ? 'Staff Portal' : 'resident' }} page — picking one takes you there with the form already filled.
              </p>
              <button v-for="account in group.accounts" :key="account.email" type="button" @click="pick(group, account)"
                class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 transition group/acct">
                <span class="block text-sm font-semibold text-ink-700 truncate">{{ account.name }}</span>
                <span class="block text-xs text-slate-500 truncate group-hover/acct:text-brand-700">{{ account.email }}</span>
                <span v-if="account.detail" class="block text-[11px] text-slate-400 truncate">{{ account.detail }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </transition>
  </div>
  `,
};

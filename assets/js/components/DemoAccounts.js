import { reactive } from 'vue';
import { apiGet } from '../api/client.js?v=119';

/**
 * The account picker: the accounts this install can be signed in as, grouped by level, filling
 * the form with the one you click. The list comes from the API (auth.php?action=demo_accounts),
 * which only names accounts the shared demo password actually opens, so nothing here is a dead
 * end and a real person's account never shows up. It all disappears when testing.demo_accounts
 * is off.
 *
 * Two shapes, same list: `variant="tab"` is the tab on the edge of the sign-in card, and
 * `variant="inline"` sits in the flow of a form that is already on screen — the Add account
 * modal. The inline one shows only the levels its own form can sign in, because the modal has
 * nowhere to send you if you pick the wrong kind.
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

// A mark and a colour per level, so the six groups are told apart at a glance rather than by
// reading the heading. Keyed by the group keys auth.php?action=demo_accounts returns; anything
// unrecognised falls back to the neutral slate entry.
const LEVELS = {
  unregistered: { chip: 'bg-slate-100 text-slate-600', ring: 'ring-slate-200', border: 'border-slate-200', head: 'bg-slate-50',
    paths: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'] },
  resident: { chip: 'bg-brand-100 text-brand-700', ring: 'ring-brand-200', border: 'border-brand-200', head: 'bg-brand-50',
    paths: ['m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'] },
  business: { chip: 'bg-sun-100 text-sun-700', ring: 'ring-sun-200', border: 'border-sun-200', head: 'bg-sun-50',
    paths: ['M3 8h18v12H3z', 'M8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3'] },
  office: { chip: 'bg-sky-100 text-sky-700', ring: 'ring-sky-200', border: 'border-sky-200', head: 'bg-sky-50',
    paths: ['M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17', 'M15 9h4a1 1 0 0 1 1 1v11', 'M2 21h20', 'M8 7h3', 'M8 11h3', 'M8 15h3'] },
  barangay: { chip: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200', border: 'border-emerald-200', head: 'bg-emerald-50',
    paths: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5'] },
  admin: { chip: 'bg-violet-100 text-violet-700', ring: 'ring-violet-200', border: 'border-violet-200', head: 'bg-violet-50',
    paths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
};

/** The list itself: the search box and one card per level. Both variants render this. */
const DemoAccountList = {
  name: 'DemoAccountList',
  props: {
    groups: { type: Array, default: () => [] },
    portal: { type: String, default: 'resident' },
    loading: Boolean,
    error: { type: String, default: '' },
    // Levels this form cannot sign in are shown with a note instead of silently filling a field
    // that will be refused. The modal passes false and they are left out altogether.
    showOtherPortals: { type: Boolean, default: true },
  },
  emits: ['pick'],
  data() {
    return {
      query: '',
      // Group key -> open?. The levels this form can sign in start open, the rest closed.
      expanded: {},
    };
  },
  watch: {
    groups: {
      immediate: true,
      handler(groups) {
        this.expanded = Object.fromEntries((groups || []).map((g) => [g.key, g.portal === this.portal]));
      },
    },
  },
  computed: {
    offered() {
      return this.showOtherPortals ? this.groups : this.groups.filter((g) => g.portal === this.portal);
    },
    // Levels with the search applied. A level with nothing left drops out entirely.
    visibleGroups() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.offered;
      return this.offered
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
    level(group) {
      return LEVELS[group.key] || LEVELS.unregistered;
    },
    // First letters of the first and last word — enough to tell two rows apart while scanning.
    initials(name) {
      const words = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!words.length) return '?';
      const last = words.length > 1 ? words[words.length - 1][0] : '';
      return (words[0][0] + last).toUpperCase();
    },
    // While searching every matching level is open — a hit hidden inside a collapsed one looks
    // like no hit at all.
    isExpanded(group) {
      return !!this.query.trim() || !!this.expanded[group.key];
    },
    toggleGroup(group) {
      if (this.query.trim()) return;
      this.expanded[group.key] = !this.expanded[group.key];
    },
  },
  template: `
  <div>
    <div v-if="offered.length" class="relative mb-3">
      <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input v-model="query" type="search" placeholder="Search name, email or office"
        aria-label="Search demo accounts"
        class="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
    </div>

    <p v-if="loading" class="px-1 py-5 text-sm text-slate-500">Loading accounts…</p>
    <p v-else-if="error" class="px-1 py-5 text-sm text-red-600">{{ error }}</p>
    <p v-else-if="query.trim() && !totalShown" class="px-1 py-5 text-sm text-slate-500">No account matches “{{ query }}”.</p>
    <p v-else-if="!offered.length" class="px-1 py-5 text-sm text-slate-500">No demo accounts on this install.</p>

    <!-- One bordered card per level, so a group is a thing you can see the edges of rather than
         a heading floating above a run of names. -->
    <section v-for="group in visibleGroups" :key="group.key"
      class="mb-2.5 last:mb-0 rounded-2xl bg-white ring-1 overflow-hidden" :class="level(group).ring">
      <button type="button" @click="toggleGroup(group)"
        :aria-expanded="isExpanded(group) ? 'true' : 'false'"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition hover:brightness-[0.97]"
        :class="level(group).head">
        <span class="shrink-0 w-7 h-7 rounded-lg grid place-items-center" :class="level(group).chip">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-for="d in level(group).paths" :key="d" :d="d" />
          </svg>
        </span>
        <span class="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wider text-ink-700">{{ group.label }}</span>
        <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-white/80 ring-1 ring-black/5 text-[11px] font-bold text-ink-600 tabular-nums">{{ group.accounts.length }}</span>
        <svg class="w-3.5 h-3.5 shrink-0 text-ink-400 transition-transform duration-200 motion-reduce:transition-none"
          :class="isExpanded(group) ? 'rotate-90' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>

      <div v-if="isExpanded(group)" class="p-2 pt-2.5 bg-slate-50/70 border-t" :class="level(group).border">
        <p class="px-1 pb-2 text-[11px] leading-relaxed text-slate-500">{{ group.note }}</p>
        <p v-if="group.portal !== portal" class="mb-2 px-2.5 py-1.5 rounded-lg bg-sun-50 ring-1 ring-sun-200 text-[11px] leading-relaxed text-ink-700">
          Signs in on the {{ group.portal === 'staff' ? 'Staff Portal' : 'resident' }} page — picking one takes you there with the form already filled.
        </p>
        <!-- and one card per account inside it -->
        <button v-for="account in group.accounts" :key="account.email" type="button" @click="$emit('pick', group, account)"
          class="w-full mb-1.5 last:mb-0 flex items-start gap-2.5 text-left px-2.5 py-2 rounded-xl bg-white ring-1 ring-slate-200 hover:ring-brand-500 hover:shadow-[0_6px_14px_-8px_rgba(16,48,29,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 transition group/acct">
          <span class="shrink-0 mt-0.5 w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold" :class="level(group).chip">{{ initials(account.name) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-ink-700 truncate">{{ account.name }}</span>
            <span class="block text-xs text-slate-500 truncate group-hover/acct:text-brand-700">{{ account.email }}</span>
            <span v-if="account.detail" class="block mt-0.5 text-[11px] text-slate-400 truncate">{{ account.detail }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
  `,
};

export default {
  name: 'DemoAccounts',
  components: { DemoAccountList },
  props: {
    // Which sign-in form this is attached to, so a pick from the other side knows to route.
    portal: { type: String, default: 'resident' },
    // 'tab' hangs off the sign-in card; 'inline' sits in the flow of a form already on screen.
    variant: { type: String, default: 'tab' },
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
    };
  },
  computed: {
    // Inline sits inside a single form with nowhere to send a pick it cannot sign in, so it
    // offers only its own levels. The tab can route to the other page, so it shows everything.
    showOtherPortals() {
      return this.variant !== 'inline';
    },
  },
  mounted() {
    // The tab loads when it is opened; inline is part of the form, so it is ready up front.
    if (this.variant === 'inline') this.load();
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
        this.loaded = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
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
    <!-- Inline: a disclosure inside the form it fills. -->
    <div v-if="variant === 'inline'" class="rounded-2xl ring-1 ring-brand-200 bg-brand-50/50 overflow-hidden">
      <button type="button" @click="open = !open" :aria-expanded="open ? 'true' : 'false'"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-brand-50 transition">
        <span class="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-brand-600 text-white">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/></svg>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-semibold text-ink-700">Use a demo account</span>
          <span class="block text-[11px] text-slate-500">Pick one and both fields fill themselves.</span>
        </span>
        <svg class="w-3.5 h-3.5 shrink-0 text-ink-400 transition-transform duration-200 motion-reduce:transition-none"
          :class="open ? 'rotate-90' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <div v-if="open" class="p-2.5 border-t border-brand-200 bg-white/60">
        <p v-if="password" class="mb-2.5 text-[11px] text-slate-500">
          Every account uses the password
          <code class="font-mono font-semibold text-ink-700 bg-white ring-1 ring-brand-200 rounded px-1.5 py-0.5">{{ password }}</code>
        </p>
        <div class="max-h-72 overflow-y-auto pr-0.5">
          <DemoAccountList :groups="groups" :portal="portal" :loading="loading" :error="error"
            :show-other-portals="showOtherPortals" @pick="pick" />
        </div>
      </div>
    </div>

    <template v-else>
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
          class="fixed inset-y-0 right-0 z-50 w-[22rem] max-w-[88vw] bg-white shadow-[0_0_60px_-12px_rgba(16,48,29,0.45)] flex flex-col">

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
          </div>

          <div class="flex-1 overflow-y-auto px-3 py-3">
            <DemoAccountList :groups="groups" :portal="portal" :loading="loading" :error="error"
              :show-other-portals="showOtherPortals" @pick="pick" />
          </div>
        </aside>
      </transition>
    </template>
  </div>
  `,
};

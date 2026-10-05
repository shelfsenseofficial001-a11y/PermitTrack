import { apiGet, apiPost } from '../api/client.js?v=128';
import AppShell from './AppShell.js?v=128';
import { notificationsChanged } from '../store/ui.js?v=128';
import { timeAgo, formatDate, formatDateTime } from '../util.js?v=128';
import Loader from './Loader.js?v=128';
import NotificationIcon from './NotificationIcon.js?v=128';

// Every update on the applicant's permits in one place — the full version of the bell's
// dropdown, with filters by read state, kind, permit and free text, grouped by day.
const LIMIT = 200;

export default {
  name: 'Notifications',
  components: { AppShell, Loader, NotificationIcon },
  data() {
    return {
      items: [],
      unread: 0,
      loading: true,
      error: '',
      marking: false,
      // filters
      show: 'all',        // 'all' | 'unread'
      kind: 'all',        // 'all' | 'stage' | 'message'
      permit: '',         // application_id as a string, '' = every permit
      search: '',
      limit: LIMIT,
    };
  },
  computed: {
    // The permits that appear in the feed, for the permit filter
    permits() {
      const seen = new Map();
      this.items.forEach((n) => {
        if (!seen.has(n.application_id)) {
          seen.set(n.application_id, { id: String(n.application_id), label: n.permit_type + ' · ' + n.property_address });
        }
      });
      return [...seen.values()];
    },
    // Counts reflect the other filters, so each chip says what clicking it would show
    kindCounts() {
      const base = this.items.filter((n) => this.matches(n, { kind: 'all' }));
      return {
        all: base.length,
        stage: base.filter((n) => n.kind === 'stage').length,
        message: base.filter((n) => n.kind === 'message').length,
      };
    },
    unreadCount() {
      return this.items.filter((n) => n.unread).length;
    },
    filtered() {
      return this.items.filter((n) => this.matches(n));
    },
    filtersActive() {
      return this.show !== 'all' || this.kind !== 'all' || this.permit !== '' || this.search.trim() !== '';
    },
    // Today / Yesterday / This week / Earlier, newest first within each
    groups() {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const day = 24 * 60 * 60 * 1000;
      const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
      const buckets = {};
      this.filtered.forEach((n) => {
        const t = new Date(String(n.created_at).replace(' ', 'T')).getTime();
        const label = t >= startOfToday.getTime() ? 'Today'
          : t >= startOfToday.getTime() - day ? 'Yesterday'
          : t >= startOfToday.getTime() - 6 * day ? 'This week'
          : 'Earlier';
        (buckets[label] = buckets[label] || []).push(n);
      });
      return order.filter((l) => buckets[l]).map((label) => ({ label, items: buckets[label] }));
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    timeAgo,
    formatDateTime,
    formatDate,
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const res = await apiGet('notifications.php?action=list&limit=' + LIMIT);
        this.items = res.notifications;
        this.unread = res.unread;
      } catch (e) {
        this.error = e.message || 'Could not load your notifications.';
      } finally {
        this.loading = false;
      }
    },
    // One place that decides whether a notification passes the filters. `override` lets
    // the chip counts ask "what if this one filter were different?"
    matches(n, override = {}) {
      const f = { show: this.show, kind: this.kind, permit: this.permit, search: this.search, ...override };
      if (f.show === 'unread' && !n.unread) return false;
      if (f.kind !== 'all' && n.kind !== f.kind) return false;
      if (f.permit && String(n.application_id) !== f.permit) return false;
      const q = f.search.trim().toLowerCase();
      if (q && ![n.title, n.body, n.property_address, n.permit_type].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    },
    clearFilters() {
      this.show = 'all';
      this.kind = 'all';
      this.permit = '';
      this.search = '';
    },
    async markAllRead() {
      if (!this.unreadCount) return;
      this.marking = true;
      try {
        await apiPost('notifications.php?action=read_all', {});
        this.items = this.items.map((n) => ({ ...n, unread: false }));
        this.unread = 0;
        notificationsChanged(); // the header badge refreshes too
      } finally {
        this.marking = false;
      }
    },
    // Opening one marks just that one read, then shows its permit
    open(n) {
      if (n.unread) {
        n.unread = false;
        apiPost('notifications.php?action=read', { id: n.id }).then(notificationsChanged).catch(() => {});
      }
      this.$router.push({ path: '/permits', query: { open: String(n.application_id) } });
    },
  },
  template: `
  <AppShell>
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-ink-700">Notifications</h1>
        <p class="text-slate-500 text-sm mt-1">Every update on your permits, newest first.</p>
      </div>
      <button type="button" @click="markAllRead" :disabled="!unreadCount || marking"
        class="inline-flex items-center gap-2 text-sm font-semibold text-ink-700 bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:text-brand-700 disabled:opacity-50 disabled:hover:ring-slate-200 disabled:hover:text-ink-700 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
        {{ marking ? 'Marking…' : 'Mark all as read' }}
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-brand-100 p-3 sm:p-4 mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
      <div class="flex flex-wrap items-center gap-3 min-w-0">
        <!-- All / Unread -->
        <div class="inline-flex p-1 rounded-xl bg-meadow ring-1 ring-brand-100 shrink-0" role="group" aria-label="Read state">
          <button v-for="o in [{ k: 'all', l: 'All' }, { k: 'unread', l: 'Unread' }]" :key="o.k" type="button" @click="show = o.k" :aria-pressed="show === o.k"
            class="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition"
            :class="show === o.k ? 'bg-white text-ink-700 shadow-sm ring-1 ring-brand-100' : 'text-slate-500 hover:text-ink-700'">
            {{ o.l }}
            <span v-if="o.k === 'unread' && unreadCount" class="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-sun-300 text-ink-700">{{ unreadCount }}</span>
          </button>
        </div>

        <!-- Kind -->
        <div class="flex flex-wrap gap-2" role="group" aria-label="Type">
          <button v-for="o in [{ k: 'all', l: 'All types' }, { k: 'stage', l: 'Status updates' }, { k: 'message', l: 'Messages' }]" :key="o.k"
            type="button" @click="kind = o.k" :aria-pressed="kind === o.k"
            class="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full border transition"
            :class="kind === o.k ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-brand-100 text-slate-600 hover:border-brand-300'">
            {{ o.l }}
            <span class="text-xs" :class="kind === o.k ? 'text-white/70' : 'text-slate-400'">{{ kindCounts[o.k] }}</span>
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 lg:ml-auto">
        <!-- Permit -->
        <div class="relative">
          <label for="notif-permit" class="sr-only">Permit</label>
          <select id="notif-permit" v-model="permit"
            class="appearance-none w-full sm:w-60 rounded-xl border border-brand-100 bg-white pl-3.5 pr-9 py-2 text-sm text-ink-700 font-medium focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition truncate">
            <option value="">All permits</option>
            <option v-for="p in permits" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <svg class="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <!-- Search -->
        <div class="relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="search" type="search" placeholder="Search notifications" aria-label="Search notifications"
            class="w-full sm:w-60 rounded-xl border border-brand-100 bg-white pl-10 pr-4 py-2 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
        </div>
      </div>
    </div>

    <div v-if="filtersActive && !loading" class="flex items-center justify-between gap-3 mb-3 text-sm">
      <span class="text-slate-500">Showing <span class="font-semibold text-ink-700">{{ filtered.length }}</span> of {{ items.length }}</span>
      <button type="button" @click="clearFilters" class="font-semibold text-brand-700 hover:underline">Clear filters</button>
    </div>

    <!-- States -->
    <Loader v-if="loading" kind="notifications" />

    <div v-else-if="error" class="bg-white rounded-2xl border border-red-200 p-10 text-center">
      <p class="text-red-600 mb-3">{{ error }}</p>
      <button type="button" @click="load" class="text-sm font-semibold text-brand-700 hover:underline">Try again</button>
    </div>

    <div v-else-if="!items.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center">
      <span class="mx-auto w-12 h-12 rounded-full bg-meadow text-brand-700 flex items-center justify-center mb-3">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </span>
      <p class="font-semibold text-ink-700">No notifications yet.</p>
      <p class="text-sm text-slate-500 mt-1">Updates about your permits and applications will show up here.</p>
    </div>

    <transition v-else name="fade" mode="out-in">
      <div v-if="!filtered.length" key="empty" class="bg-white rounded-2xl border border-dashed border-brand-200 p-10 text-center">
        <p class="font-semibold text-ink-700">No notifications match these filters.</p>
        <button type="button" @click="clearFilters" class="mt-2 text-sm font-semibold text-brand-700 hover:underline">Clear filters</button>
      </div>

      <transition-group v-else key="list" name="list" tag="div" class="relative space-y-6">
        <section v-for="g in groups" :key="g.label">
          <h2 class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 mb-2.5 px-1">{{ g.label }}</h2>
          <transition-group name="list" tag="ul" class="relative bg-white rounded-2xl border border-brand-100 divide-y divide-brand-100 overflow-hidden">
            <li v-for="n in g.items" :key="n.id">
              <button type="button" @click="open(n)" :aria-label="n.title + '. Open permit'"
                class="group w-full text-left flex gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition hover:bg-meadow/70 focus:outline-none focus-visible:bg-meadow"
                :class="n.unread ? 'bg-brand-50/60' : ''">
                <NotificationIcon :item="n" class="mt-0.5" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-start gap-2">
                    <span class="flex-1 font-semibold text-ink-700 leading-snug">{{ n.title }}</span>
                    <span v-if="n.unread" class="mt-1.5 w-2 h-2 rounded-full bg-sun-400 ring-2 ring-sun-100 shrink-0" aria-label="Unread"></span>
                  </span>
                  <span class="block text-sm text-slate-600 leading-relaxed mt-0.5">{{ n.body }}</span>
                  <span class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-400">
                    <span v-if="n.property_address && n.property_address !== 'N/A'" class="font-medium text-slate-500">{{ n.property_address }}</span>
                    <span v-if="n.property_address && n.property_address !== 'N/A'" aria-hidden="true">·</span>
                    <span :title="timeAgo(n.created_at)">{{ formatDateTime(n.created_at) }}</span>
                  </span>
                </span>
                <span class="hidden sm:flex items-center gap-1 self-center text-xs font-semibold text-brand-700 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition shrink-0">
                  Open permit
                </span>
                <svg class="w-4 h-4 text-slate-300 group-hover:text-brand-600 self-center shrink-0 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </li>
          </transition-group>
        </section>
      </transition-group>
    </transition>

    <p v-if="!loading && items.length >= limit" class="text-xs text-slate-400 text-center mt-6">Showing your latest {{ limit }} notifications.</p>
  </AppShell>
  `,
};

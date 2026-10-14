import { apiGet, apiPost } from '../api/client.js?v=168';
import { authState } from '../store/auth.js?v=168';
import { timeAgo, formatDateTime } from '../util.js?v=168';
import StaffShell from './StaffShell.js?v=168';
import Loader from './Loader.js?v=168';
import MessageThread from './MessageThread.js?v=168';
import BaseModal from './BaseModal.js?v=168';

// The office's inbox, in two kinds (api/conversations.php): questions applicants sent from the chat
// launcher, routed to the office that issues the permit they're about; and the threads of
// applications that pass through this office, once someone has written in one — those show the
// application's status lines between the messages. Admins see every office's.
//
// Two panes from lg up — the list beside the open thread — and one at a time below that, where
// /staff/messages is the list and /staff/messages/:id is a thread.

const LIST_POLL_MS = 20000;
const THREAD_POLL_MS = 8000;

const FILTERS = [
  { key: 'awaiting', labelKey: 'sm.filterAwaiting' },
  { key: 'open', labelKey: 'sm.filterOpen' },
  { key: 'closed', labelKey: 'sm.filterClosed' },
];

export default {
  name: 'StaffMessages',
  components: { StaffShell, Loader, MessageThread, BaseModal },
  data() {
    return {
      authState,
      filters: FILTERS,
      filter: 'awaiting',
      conversations: [],
      loading: true,
      error: '',
      thread: null,
      messages: [],
      threadLoading: false,
      closing: false,
      reopening: false,
      confirmClose: false, // the "mark as done?" dialog is up
    };
  },
  computed: {
    isAdmin() {
      return !!(this.authState.user && this.authState.user.role === 'admin');
    },
    selectedId() {
      return this.$route.params.id ? Number(this.$route.params.id) : null;
    },
    counts() {
      return {
        awaiting: this.conversations.filter((c) => c.awaiting_office).length,
        open: this.conversations.filter((c) => c.status === 'open').length,
        closed: this.conversations.filter((c) => c.status === 'closed').length,
      };
    },
    shown() {
      if (this.filter === 'awaiting') return this.conversations.filter((c) => c.awaiting_office);
      return this.conversations.filter((c) => c.status === this.filter);
    },
  },
  watch: {
    selectedId: { immediate: true, handler(id) { id ? this.openThread(id) : this.leaveThread(); } },
  },
  async mounted() {
    await this.loadList();
    this.listTimer = setInterval(() => {
      if (document.visibilityState === 'visible') this.loadList(true);
    }, LIST_POLL_MS);
  },
  beforeUnmount() {
    clearInterval(this.listTimer);
    clearInterval(this.threadTimer);
  },
  methods: {
    timeAgo,
    formatDateTime,
    initials(name) {
      return String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    },
    async loadList(quiet = false) {
      if (!quiet) this.loading = true;
      try {
        const res = await apiGet('conversations.php?action=list');
        this.conversations = res.conversations;
      } catch (e) {
        if (!quiet) this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    select(c) {
      this.$router.push('/staff/messages/' + c.id);
    },
    async openThread(id) {
      clearInterval(this.threadTimer);
      this.threadLoading = !this.thread || this.thread.id !== id;
      this.error = '';
      await this.fetchThread(id);
      this.threadLoading = false;
      this.scrollThread();
      this.threadTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && this.thread) this.fetchThread(this.thread.id, true);
      }, THREAD_POLL_MS);
    },
    leaveThread() {
      clearInterval(this.threadTimer);
      this.thread = null;
      this.messages = [];
    },
    async fetchThread(id, quiet = false) {
      try {
        const before = this.messages.length;
        const res = await apiGet('conversations.php?action=get&id=' + id);
        this.thread = res.conversation;
        this.messages = res.messages;
        // Reading it cleared it server-side; mirror that in the list without another round trip.
        const row = this.conversations.find((c) => c.id === id);
        if (row) Object.assign(row, { unread: false, status: res.conversation.status, awaiting_office: res.conversation.awaiting_office });
        if (quiet && res.messages.length > before) this.scrollThread();
      } catch (e) {
        if (!quiet) {
          this.error = e.message;
          this.thread = null;
        }
      }
    },
    // MessageThread sent, edited or removed something: take the server's version of the thread
    async onChanged({ scroll }) {
      if (!this.thread) return;
      await this.fetchThread(this.thread.id);
      if (scroll) this.scrollThread();
      this.loadList(true);
    },
    // Runs after the dialog's confirmation, never straight from the header button
    async closeThread() {
      if (!this.thread || this.closing) return;
      this.closing = true;
      try {
        await apiPost('conversations.php?action=close', { id: this.thread.id });
        await this.fetchThread(this.thread.id);
        this.loadList(true);
        this.confirmClose = false;
      } catch (e) {
        this.error = e.message;
        this.confirmClose = false;
      } finally {
        this.closing = false;
      }
    },
    // The undo for closeThread. Needs no confirmation of its own: it is the way back.
    async reopenThread() {
      if (!this.thread || this.reopening) return;
      this.reopening = true;
      this.error = '';
      try {
        await apiPost('conversations.php?action=reopen', { id: this.thread.id });
        await this.fetchThread(this.thread.id);
        this.loadList(true);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.reopening = false;
      }
    },
    scrollThread() {
      this.$nextTick(() => this.$refs.msgThread && this.$refs.msgThread.scrollToBottom());
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-8 sm:px-10 mb-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-2">{{ isAdmin ? $t('sm.everyOffice') : ((authState.user && authState.user.department_name) || $t('sm.noOffice')) }}</p>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">{{ $t('sm.title') }}</h1>
      <p class="text-white/85 text-sm mt-2">
        {{ $t('sm.intro') }}
        <template v-if="counts.awaiting"> {{ $t('sm.waitingReply', { n: counts.awaiting }) }}</template>
      </p>
    </div>

    <div class="grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-5 items-start">
      <!-- the list: hidden on small screens while a thread is open -->
      <div :class="selectedId ? 'hidden lg:block' : ''">
        <div class="flex gap-1.5 p-1 rounded-2xl bg-white ring-1 ring-brand-100 mb-3" role="tablist" :aria-label="$t('sm.filterLabel')">
          <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="filter === f.key ? 'true' : 'false'" @click="filter = f.key"
            class="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition"
            :class="filter === f.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-brand-50 hover:text-ink-700'">
            {{ $t(f.labelKey) }}
            <span class="min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold grid place-items-center"
              :class="filter === f.key ? 'bg-white/20' : (f.key === 'awaiting' && counts.awaiting ? 'bg-sun-400 text-ink-700' : 'bg-slate-100')">{{ counts[f.key] }}</span>
          </button>
        </div>

        <Loader v-if="loading" kind="queue" />
        <div v-else-if="!shown.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-10 text-center text-sm text-slate-500">
          {{ filter === 'awaiting' ? $t('sm.nobodyWaiting') : $t('sm.nothing') }}
        </div>
        <div v-else :key="'list-' + filter" class="pt-stagger bg-white rounded-2xl ring-1 ring-brand-100 overflow-hidden divide-y divide-slate-100">
          <button v-for="c in shown" :key="c.id" type="button" @click="select(c)"
            class="w-full flex items-start gap-3 px-4 py-3.5 text-left transition"
            :class="c.id === selectedId ? 'bg-brand-50' : 'hover:bg-brand-50/50'">
            <span class="relative shrink-0 w-10 h-10 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold">
              {{ initials(c.applicant_name) }}
              <span v-if="c.unread" class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sun-400 ring-2 ring-white"></span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="text-sm truncate" :class="c.unread ? 'font-bold text-ink-700' : 'font-semibold text-ink-700'">{{ c.applicant_name }}</span>
                <span class="shrink-0 text-[11px] text-slate-400">{{ timeAgo(c.last_message_at) }}</span>
              </span>
              <span class="block text-[11px] text-brand-700 font-semibold truncate">{{ c.subject }}<span v-if="c.application_id" class="font-normal text-slate-400"> · Application #{{ c.application_id }}</span><span v-if="isAdmin" class="font-normal text-slate-400"> · {{ c.office_name }}</span></span>
              <span class="block mt-0.5 text-xs truncate" :class="c.unread ? 'text-ink-700 font-semibold' : 'text-slate-500'">{{ c.last_message }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- the thread -->
      <div :class="selectedId ? '' : 'hidden lg:block'">
        <div v-if="!selectedId" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center">
          <div class="mx-auto w-14 h-14 rounded-2xl bg-brand-50 ring-1 ring-brand-100 grid place-items-center text-brand-700">
            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
          </div>
          <p class="mt-4 text-sm font-semibold text-ink-700">{{ $t('sm.pick') }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ $t('sm.pickBody') }}</p>
        </div>

        <section v-else :key="'thread-' + selectedId" class="pt-rise-in bg-white rounded-2xl ring-1 ring-brand-100 overflow-hidden flex flex-col h-[min(42rem,calc(100vh-12rem))]">
          <Loader v-if="threadLoading" kind="generic" :label="$t('sm.opening')" />
          <template v-else-if="thread">
            <header class="shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
              <router-link to="/staff/messages" class="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100" :aria-label="$t('sm.backToMessages')">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              </router-link>
              <div class="w-10 h-10 shrink-0 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold">{{ initials(thread.applicant_name) }}</div>
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-bold text-ink-700 truncate">{{ thread.applicant_name }}</h2>
                <p class="text-xs text-slate-500 truncate">
                  <template v-if="thread.application_id">{{ $t('sm.applicationNo', { id: thread.application_id }) }} · {{ thread.subject }} · {{ thread.application_status }}</template>
                  <template v-else>{{ $t('sm.about', { subject: thread.subject }) }}<template v-if="isAdmin"> · {{ $t('sm.sentTo', { office: thread.office_name }) }}</template></template>
                </p>
              </div>
              <router-link v-if="thread.application_id" :to="'/reviewer/applications/' + thread.application_id"
                class="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl bg-brand-50 ring-1 ring-brand-100 text-brand-700 hover:bg-brand-100 transition">{{ $t('sm.openApplication') }}</router-link>
              <template v-if="thread.status === 'closed'">
                <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">{{ $t('sm.closed') }}</span>
                <button type="button" @click="reopenThread" :disabled="reopening" :title="$t('sm.reopenHint')"
                  class="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand-700 disabled:opacity-50 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                  {{ reopening ? $t('sm.reopening') : $t('sm.reopen') }}
                </button>
              </template>
              <button v-else type="button" @click="confirmClose = true" :disabled="closing"
                class="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                :title="$t('sm.markDoneHint')">
                {{ $t('sm.markDone') }}
              </button>
            </header>

            <MessageThread ref="msgThread" :key="thread.id" :thread="thread" :messages="messages" variant="staff"
              :placeholder="$t('msg.staffPlaceholder')" :hint="$t('msg.staffHint')" :error="error"
              @changed="onChanged" />
          </template>
          <p v-else class="p-8 text-sm text-red-600">{{ error || $t('sm.cantOpen') }}</p>
        </section>
      </div>
    </div>

    <!-- Marking a conversation done takes it off the "needs a reply" list, so it is asked first -->
    <BaseModal v-if="confirmClose && thread" :title="$t('sm.confirmCloseTitle')" :eyebrow="$t('sm.confirmCloseEyebrow')"
      :subtitle="$t('sm.confirmCloseBody', { name: thread.applicant_name })" :dismissible="!closing" @close="confirmClose = false">
      <template #icon>
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      </template>
      <p class="text-sm text-slate-500 leading-relaxed">{{ $t('sm.confirmCloseUndo') }}</p>
      <template #footer>
        <div class="ml-auto flex items-center gap-2">
          <button type="button" @click="confirmClose = false" :disabled="closing"
            class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 disabled:opacity-50 transition">{{ $t('msg.cancel') }}</button>
          <button type="button" @click="closeThread" :disabled="closing"
            class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
            {{ closing ? $t('sm.closing') : $t('sm.markDone') }}
          </button>
        </div>
      </template>
    </BaseModal>
  </StaffShell>
  `,
};

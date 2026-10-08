import { apiGet, apiPost } from '../api/client.js?v=118';
import { authState } from '../store/auth.js?v=118';
import { timeAgo, formatDateTime } from '../util.js?v=118';
import StaffShell from './StaffShell.js?v=118';
import Loader from './Loader.js?v=118';
import LogoMark from './LogoMark.js?v=118';

// The office's inbox: questions applicants sent to this office from the chat launcher, before or
// outside an application (api/conversations.php routes each one to the office that issues the
// permit it's about). Admins see every office's.
//
// Two panes from lg up — the list beside the open thread — and one at a time below that, where
// /staff/messages is the list and /staff/messages/:id is a thread.

const LIST_POLL_MS = 20000;
const THREAD_POLL_MS = 8000;

const FILTERS = [
  { key: 'awaiting', label: 'Needs a reply' },
  { key: 'open', label: 'All open' },
  { key: 'closed', label: 'Closed' },
];

export default {
  name: 'StaffMessages',
  components: { StaffShell, Loader, LogoMark },
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
      reply: '',
      sending: false,
      closing: false,
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
      this.reply = '';
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
    async sendReply() {
      const message = this.reply.trim();
      if (!message || this.sending || !this.thread) return;
      this.sending = true;
      this.error = '';
      try {
        await apiPost('conversations.php?action=send', { id: this.thread.id, message });
        this.reply = '';
        await this.fetchThread(this.thread.id);
        this.scrollThread();
        this.loadList(true);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.sending = false;
      }
    },
    async closeThread() {
      if (!this.thread || this.closing) return;
      this.closing = true;
      try {
        await apiPost('conversations.php?action=close', { id: this.thread.id });
        await this.fetchThread(this.thread.id);
        this.loadList(true);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.closing = false;
      }
    },
    scrollThread() {
      this.$nextTick(() => {
        const el = this.$refs.log;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-8 sm:px-10 mb-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-2">{{ isAdmin ? 'Every office' : ((authState.user && authState.user.department_name) || 'No office assigned — ask an admin to add you to one') }}</p>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">Messages</h1>
      <p class="text-white/85 text-sm mt-2">
        Questions applicants sent about a permit your office issues — before they've filed, or outside an application.
        <template v-if="counts.awaiting"> {{ counts.awaiting }} waiting on a reply.</template>
      </p>
    </div>

    <div class="grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-5 items-start">
      <!-- the list: hidden on small screens while a thread is open -->
      <div :class="selectedId ? 'hidden lg:block' : ''">
        <div class="flex gap-1.5 p-1 rounded-2xl bg-white ring-1 ring-brand-100 mb-3" role="tablist" aria-label="Filter messages">
          <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="filter === f.key ? 'true' : 'false'" @click="filter = f.key"
            class="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition"
            :class="filter === f.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-brand-50 hover:text-ink-700'">
            {{ f.label }}
            <span class="min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold grid place-items-center"
              :class="filter === f.key ? 'bg-white/20' : (f.key === 'awaiting' && counts.awaiting ? 'bg-sun-400 text-ink-700' : 'bg-slate-100')">{{ counts[f.key] }}</span>
          </button>
        </div>

        <Loader v-if="loading" kind="queue" />
        <div v-else-if="!shown.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-10 text-center text-sm text-slate-500">
          {{ filter === 'awaiting' ? 'Nobody is waiting on a reply.' : 'Nothing here.' }}
        </div>
        <div v-else class="bg-white rounded-2xl ring-1 ring-brand-100 overflow-hidden divide-y divide-slate-100">
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
              <span class="block text-[11px] text-brand-700 font-semibold truncate">{{ c.subject }}<span v-if="isAdmin" class="font-normal text-slate-400"> · {{ c.office_name }}</span></span>
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
          <p class="mt-4 text-sm font-semibold text-ink-700">Pick a conversation</p>
          <p class="mt-1 text-sm text-slate-500">The applicant sees your reply in their chat, and gets an email or SMS about it.</p>
        </div>

        <section v-else class="bg-white rounded-2xl ring-1 ring-brand-100 overflow-hidden flex flex-col h-[min(42rem,calc(100vh-12rem))]">
          <Loader v-if="threadLoading" kind="generic" label="Opening the conversation…" />
          <template v-else-if="thread">
            <header class="shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
              <router-link to="/staff/messages" class="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Back to messages">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              </router-link>
              <div class="w-10 h-10 shrink-0 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold">{{ initials(thread.applicant_name) }}</div>
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-bold text-ink-700 truncate">{{ thread.applicant_name }}</h2>
                <p class="text-xs text-slate-500 truncate">About the {{ thread.subject }}<template v-if="isAdmin"> · sent to {{ thread.office_name }}</template></p>
              </div>
              <span v-if="thread.status === 'closed'" class="shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Closed</span>
              <button v-else type="button" @click="closeThread" :disabled="closing"
                class="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                title="Mark this as answered. If the applicant writes again, it reopens.">
                {{ closing ? 'Closing…' : 'Mark as done' }}
              </button>
            </header>

            <div ref="log" class="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft px-4 sm:px-5 py-5 bg-meadow/40" aria-live="polite">
              <div class="space-y-3">
                <div v-for="m in messages" :key="m.id" :class="m.from_office ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                  <span class="px-1 mb-0.5 text-[11px] font-semibold text-slate-500">{{ m.mine ? 'You' : m.sender_name }}</span>
                  <div class="max-w-[80%] px-3.5 py-2 text-sm whitespace-pre-line break-words"
                    :class="m.from_office ? 'rounded-2xl rounded-br-md bg-brand-600 text-white' : 'rounded-2xl rounded-bl-md bg-white ring-1 ring-brand-100 text-slate-700 shadow-[0_6px_16px_-12px_rgba(16,48,29,0.35)]'">{{ m.body }}</div>
                  <span class="px-1 mt-0.5 text-[10px] text-slate-400" :title="formatDateTime(m.created_at)">{{ timeAgo(m.created_at) }}</span>
                </div>
              </div>
            </div>

            <form @submit.prevent="sendReply" class="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4">
              <p v-if="error" class="mb-2 text-sm text-red-600" role="alert">{{ error }}</p>
              <div class="flex items-end gap-2">
                <label for="staff-reply" class="sr-only">Reply</label>
                <textarea id="staff-reply" v-model="reply" rows="2" maxlength="2000" placeholder="Write a reply to the applicant…"
                  class="flex-1 min-w-0 max-h-40 resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
                  @keydown.enter.ctrl.prevent="sendReply" @keydown.enter.meta.prevent="sendReply"></textarea>
                <button type="submit" :disabled="sending || !reply.trim()"
                  class="shrink-0 inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                  <LogoMark v-if="sending" animated color="currentColor" class="w-5 h-5" />
                  {{ sending ? 'Sending' : 'Send' }}
                </button>
              </div>
              <p class="mt-1.5 text-[11px] text-slate-400">Ctrl + Enter to send. Don't ask for passwords or ID numbers here.</p>
            </form>
          </template>
          <p v-else class="p-8 text-sm text-red-600">{{ error || 'This conversation could not be opened.' }}</p>
        </section>
      </div>
    </div>
  </StaffShell>
  `,
};

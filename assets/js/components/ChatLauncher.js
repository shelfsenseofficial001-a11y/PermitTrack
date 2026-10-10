import { apiGet, apiPost } from '../api/client.js?v=119';
import { authState } from '../store/auth.js?v=119';
import { uiState } from '../store/ui.js?v=119';
import { timeAgo } from '../util.js?v=119';
import ChatWidget from './ChatWidget.js?v=119';
import GibsPeek from './GibsPeek.js?v=119';
import LogoMark from './LogoMark.js?v=119';

/**
 * The one chat button in the corner. It opens a panel with three tabs:
 *
 *   Home      a greeting, the ways to get help, your latest conversation, and a help search
 *   Messages  your conversations with City offices, and starting a new one. Every application
 *             you've filed has its thread here too: its status updates and its messages, in order
 *   Help      the FAQ, readable and searchable, plus Gibs for anything it doesn't cover
 *
 * Writing to a person means choosing who first: Gibs for an instant answer, or City staff —
 * and then which permit it's about, because that decides which office gets it
 * (api/conversations.php routes to whoever issues that permit).
 *
 * Signed out, it is help only: the FAQ and Gibs work, and messaging asks you to sign in.
 * Gibs himself is the existing ChatWidget, run headless — this owns the corner, he owns his dialog.
 */

const UNREAD_POLL_MS = 30000;
const THREAD_POLL_MS = 8000;

// Gibs's own "hide him" preference, shared with ChatWidget, so hiding him there also stops him
// peeking over this button.
const HIDE_KEY = 'permittrack.hideGibs';
function gibsHiddenPref() {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; }
}

export default {
  name: 'ChatLauncher',
  components: { ChatWidget, GibsPeek, LogoMark },
  props: {
    // The landing page holds the button back until its FAQ is on screen; everywhere else it is
    // simply there. Once shown it stays, so an open conversation never vanishes on a scroll.
    visible: { type: Boolean, default: true },
    liftForFab: { type: Boolean, default: false },
    liftForBar: { type: Boolean, default: false },
  },
  data() {
    return {
      authState,
      uiState,
      open: false,
      tab: 'home',            // home | messages | help
      // Messages tab: list | who | permit | compose | thread
      view: 'list',
      conversations: [],
      listLoaded: false,
      listLoading: false,
      unread: 0,
      // Starting a conversation
      options: [],
      optionsLoading: false,
      permitQuery: '',
      chosen: null,           // { id, name, office }
      draft: '',
      sending: false,
      error: '',
      // An open thread
      thread: null,
      messages: [],
      threadLoading: false,
      reply: '',
      // Help
      faqs: [],
      faqsLoaded: false,
      helpQuery: '',
      article: null,
      gibsHidden: gibsHiddenPref(),
    };
  },
  computed: {
    signedIn() {
      return !!(this.authState.user && this.authState.user.role === 'applicant');
    },
    firstName() {
      const u = this.authState.user;
      if (!u) return '';
      return u.first_name || String(u.full_name || '').split(' ')[0] || '';
    },
    latest() {
      return this.conversations[0] || null;
    },
    permitGroups() {
      const q = this.permitQuery.trim().toLowerCase();
      if (!q) return this.options;
      return this.options
        .map((g) => ({ ...g, permits: g.permits.filter((p) => `${p.name} ${p.office || ''}`.toLowerCase().includes(q)) }))
        .filter((g) => g.permits.length);
    },
    helpResults() {
      const q = this.helpQuery.trim().toLowerCase();
      if (!q) return this.faqs;
      return this.faqs.filter((f) => `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(q));
    },
    helpGroups() {
      const out = [];
      this.helpResults.forEach((f) => {
        let g = out.find((x) => x.category === f.category);
        if (!g) out.push(g = { category: f.category, items: [] });
        g.items.push(f);
      });
      return out;
    },
    // The bottom-right offsets, matching what the old Ask button used so nothing else on the
    // page has to move: above the phone tab tray, above a sticky action bar, or above Back to top.
    cornerClass() {
      return this.liftForBar ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-24'
        : ['bottom-[calc(4.75rem+env(safe-area-inset-bottom))]', this.liftForFab ? 'md:bottom-[5.25rem]' : 'md:bottom-5'];
    },
  },
  watch: {
    open(isOpen) {
      const coversPage = !window.matchMedia('(min-width: 768px)').matches;
      document.documentElement.style.overflow = isOpen && coversPage ? 'hidden' : '';
      if (isOpen) {
        if (this.signedIn) this.loadList();
        if (!this.faqsLoaded) this.loadFaqs();
      } else {
        this.stopThreadPoll();
      }
    },
    signedIn: { immediate: true, handler(on) { on ? this.startUnreadPoll() : this.stopUnreadPoll(); } },
    'uiState.chatThreadRequest'(req) {
      if (req && this.signedIn) this.openApplication(req.applicationId);
    },
  },
  mounted() {
    this.onKey = (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    };
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
    this.stopUnreadPoll();
    this.stopThreadPoll();
    if (this.open) document.documentElement.style.overflow = '';
  },
  methods: {
    timeAgo,
    toggle() {
      this.open ? this.close() : (this.open = true);
    },
    close() {
      this.open = false;
      this.$nextTick(() => this.$refs.fab && this.$refs.fab.focus());
    },
    goTab(tab) {
      this.tab = tab;
      this.error = '';
      if (tab === 'messages' && this.view !== 'thread') this.view = 'list';
      if (tab === 'help') this.article = null;
      if (tab !== 'messages') this.stopThreadPoll();
    },
    go(path) {
      this.close();
      this.$router.push(path);
    },

    // ---- unread badge
    startUnreadPoll() {
      this.stopUnreadPoll();
      this.refreshUnread();
      this.unreadTimer = setInterval(() => {
        if (document.visibilityState === 'visible') this.refreshUnread();
      }, UNREAD_POLL_MS);
    },
    stopUnreadPoll() {
      clearInterval(this.unreadTimer);
      this.unreadTimer = null;
      this.unread = 0;
    },
    async refreshUnread() {
      try {
        const res = await apiGet('conversations.php?action=unread');
        // New replies since the list was loaded: fetch it again so the dots are right too.
        if (res.unread !== this.unread && this.listLoaded) this.loadList();
        this.unread = res.unread;
      } catch (e) { /* the badge just stays as it was */ }
    },

    // ---- conversations
    async loadList() {
      this.listLoading = !this.listLoaded;
      try {
        const res = await apiGet('conversations.php?action=list');
        this.conversations = res.conversations;
        this.listLoaded = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.listLoading = false;
      }
    },
    newMessage() {
      this.tab = 'messages';
      this.error = '';
      if (!this.signedIn) { this.view = 'list'; return; }
      this.view = 'who';
    },
    async choosePeople() {
      this.view = 'permit';
      this.permitQuery = '';
      if (this.options.length) return;
      this.optionsLoading = true;
      try {
        const res = await apiGet('conversations.php?action=options');
        this.options = res.groups;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.optionsLoading = false;
      }
    },
    choosePermit(permit) {
      if (!permit.available) return;
      this.chosen = permit;
      this.draft = '';
      this.error = '';
      this.view = 'compose';
      this.$nextTick(() => this.$refs.compose && this.$refs.compose.focus());
    },
    async start() {
      const message = this.draft.trim();
      if (!message || this.sending) return;
      this.sending = true;
      this.error = '';
      try {
        const res = await apiPost('conversations.php?action=start', { permit_type_id: this.chosen.id, message });
        this.draft = '';
        await this.loadList();
        await this.openThread(res.id);
      } catch (e) {
        this.error = e.message;
      } finally {
        this.sending = false;
      }
    },
    async openThread(id) {
      this.tab = 'messages';
      this.view = 'thread';
      this.error = '';
      this.reply = '';
      this.threadLoading = !this.thread || this.thread.id !== id;
      await this.fetchThread(id);
      this.threadLoading = false;
      this.scrollThread();
      this.stopThreadPoll();
      this.threadTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && this.view === 'thread' && this.thread) this.fetchThread(this.thread.id, true);
      }, THREAD_POLL_MS);
      this.$nextTick(() => this.$refs.reply && this.$refs.reply.focus());
    },
    // A permit page's "Open in Messages": find (or make) that application's thread and open it.
    async openApplication(applicationId) {
      this.open = true;
      this.tab = 'messages';
      this.view = 'thread';
      this.thread = null;
      this.messages = [];
      this.threadLoading = true;
      try {
        const res = await apiGet('conversations.php?action=for_application&application_id=' + applicationId);
        if (!this.listLoaded) this.loadList();
        await this.openThread(res.id);
      } catch (e) {
        this.threadLoading = false;
        this.view = 'list';
        this.error = e.message;
      }
    },
    openApplicationPage() {
      if (this.thread && this.thread.application_id) this.go('/applications/' + this.thread.application_id);
    },
    async fetchThread(id, quiet = false) {
      try {
        const before = this.messages.length;
        const res = await apiGet('conversations.php?action=get&id=' + id);
        this.thread = res.conversation;
        this.messages = res.messages;
        // Opening it read it: clear its dot here rather than waiting for the next poll.
        const row = this.conversations.find((c) => c.id === id);
        if (row) row.unread = false;
        this.unread = this.conversations.filter((c) => c.unread).length;
        if (quiet && res.messages.length > before) this.scrollThread();
      } catch (e) {
        if (!quiet) this.error = e.message;
      }
    },
    stopThreadPoll() {
      clearInterval(this.threadTimer);
      this.threadTimer = null;
    },
    backToList() {
      this.stopThreadPoll();
      this.view = 'list';
      this.thread = null;
      this.messages = [];
      this.loadList();
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
      } catch (e) {
        this.error = e.message;
      } finally {
        this.sending = false;
        this.$nextTick(() => this.$refs.reply && this.$refs.reply.focus());
      }
    },
    scrollThread() {
      this.$nextTick(() => {
        const el = this.$refs.threadLog;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    // ---- help
    async loadFaqs() {
      try {
        const res = await apiGet('chat.php?action=faqs');
        this.faqs = res.faqs;
        this.faqsLoaded = true;
      } catch (e) { /* the help list just stays empty; Gibs still works */ }
    },
    openArticle(faq) {
      this.tab = 'help';
      this.article = faq;
    },
    searchFromHome() {
      this.tab = 'help';
      this.article = null;
      this.$nextTick(() => this.$refs.helpSearch && this.$refs.helpSearch.focus());
    },
    paragraphs(text) {
      return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    },
    // Gibs takes over the corner while he's open; this panel steps aside and comes back after.
    askGibs() {
      this.open = false;
      this.$refs.gibs.openChat();
    },
    gibsClosed() {
      this.gibsHidden = gibsHiddenPref();
      this.$nextTick(() => this.$refs.fab && this.$refs.fab.focus());
    },
  },
  template: `
  <div>
    <ChatWidget ref="gibs" headless @closed="gibsClosed" />

    <GibsPeek v-if="visible && !gibsHidden" :suppressed="open" :lift-for-fab="liftForFab" :lift-for-bar="liftForBar" @open="open = true" />

    <!-- The button. It pops in rather than fading, so arriving with the FAQ reads as an offer. -->
    <transition enter-from-class="opacity-0 scale-50 translate-y-3" enter-active-class="transition duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none"
      leave-to-class="opacity-0 scale-75" leave-active-class="transition duration-200 motion-reduce:transition-none">
      <button v-if="visible" ref="fab" type="button" @click="toggle" :aria-expanded="open ? 'true' : 'false'"
        :aria-label="open ? 'Close help and messages' : (unread ? 'Help and messages, ' + unread + ' unread' : 'Help and messages')"
        class="fixed right-5 z-40 w-14 h-14 rounded-full bg-brand-600 text-white place-items-center shadow-[0_14px_30px_-10px_rgba(16,48,29,0.65)] hover:bg-brand-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 transition"
        :class="[cornerClass, open ? 'hidden md:grid' : 'grid']">
        <transition enter-from-class="opacity-0 rotate-90 scale-50" enter-active-class="transition duration-200" leave-to-class="opacity-0 -rotate-90 scale-50" leave-active-class="transition duration-150" mode="out-in">
          <svg v-if="!open" key="chat" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="3"/>
          </svg>
          <svg v-else key="close" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </transition>
        <span v-if="unread && !open" class="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-sun-400 text-ink-700 text-[11px] font-bold grid place-items-center ring-2 ring-white pt-badge-pop">{{ unread > 9 ? '9+' : unread }}</span>
      </button>
    </transition>

    <!-- The panel: whole screen on phones; from md up it rises out of the button in the corner. -->
    <transition enter-from-class="opacity-0 md:translate-y-4 md:scale-[0.96]" enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0 md:translate-y-3 md:scale-[0.97]" leave-active-class="transition duration-150 ease-in motion-reduce:transition-none">
      <section v-if="open" role="dialog" aria-modal="false" aria-label="Help and messages"
        class="font-inter fixed z-50 inset-0 md:inset-auto md:right-5 md:w-[390px] md:h-[min(660px,calc(100vh-8rem))] md:origin-bottom-right flex flex-col bg-white md:rounded-[28px] overflow-hidden shadow-[0_40px_90px_-24px_rgba(7,24,14,0.55)] ring-1 ring-black/5"
        :class="liftForBar ? 'md:bottom-[10.5rem]' : (liftForFab ? 'md:bottom-[9.75rem]' : 'md:bottom-24')">

        <!-- ======================= HOME ======================= -->
        <div v-if="tab === 'home'" class="pt-tab-in flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft bg-meadow/40">
          <!-- A dark header, not the sign-in gradient: that one runs from lime to forest green, so
               no single text colour stays readable across it at every width. -->
          <div class="pt-chat-head relative px-6 pt-6 pb-16 text-white">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <LogoMark class="w-9 h-9 drop-shadow" />
                <span class="text-base font-bold">PermitTrack</span>
              </div>
              <button type="button" @click="close" aria-label="Close" class="p-2 -mr-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <h2 class="mt-9 text-[28px] leading-tight font-extrabold tracking-tight">
              Hi {{ signedIn ? firstName : 'there' }} <span class="inline-block origin-[70%_70%] pt-wave">👋</span><br>How can we help?
            </h2>
          </div>

          <div class="pt-stagger px-4 -mt-10 pb-5 space-y-3 relative">
            <!-- Write to a person -->
            <button v-if="signedIn" type="button" @click="newMessage"
              class="w-full flex items-center gap-3 text-left bg-white rounded-2xl ring-1 ring-ink-100 px-4 py-3.5 shadow-[0_10px_28px_-16px_rgba(16,48,29,0.45)] hover:ring-brand-400 transition group">
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-bold text-ink-700">Send us a message</span>
                <span class="block text-xs text-slate-500 mt-0.5">The office that issues your permit replies, usually within a working day or two</span>
              </span>
              <svg class="w-5 h-5 shrink-0 text-brand-600 group-hover:translate-x-0.5 transition" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>
            </button>
            <button v-else type="button" @click="go('/login')"
              class="w-full flex items-center gap-3 text-left bg-white rounded-2xl ring-1 ring-ink-100 px-4 py-3.5 shadow-[0_10px_28px_-16px_rgba(16,48,29,0.45)] hover:ring-brand-400 transition group">
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-bold text-ink-700">Message a City office</span>
                <span class="block text-xs text-slate-500 mt-0.5">Sign in or create an account to write to City Hall</span>
              </span>
              <span class="shrink-0 text-xs font-semibold text-brand-700 group-hover:underline">Sign in →</span>
            </button>

            <!-- The latest conversation, so a reply is one tap away -->
            <button v-if="signedIn && latest" type="button" @click="openThread(latest.id)"
              class="w-full text-left bg-white rounded-2xl ring-1 ring-ink-100 px-4 py-3 hover:ring-brand-400 transition">
              <span class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recent message</span>
                <span class="text-[11px] text-slate-400">{{ timeAgo(latest.last_message_at) }}</span>
              </span>
              <span class="mt-1.5 flex items-start gap-2.5">
                <span class="relative shrink-0 w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/></svg>
                  <span v-if="latest.unread" class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-sun-400 ring-2 ring-white"></span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-ink-700 truncate">{{ latest.subject }}</span>
                  <span class="block text-xs truncate" :class="latest.unread ? 'text-ink-700 font-semibold' : 'text-slate-500'">{{ latest.last_message }}</span>
                </span>
              </span>
            </button>

            <!-- Gibs -->
            <button type="button" @click="askGibs"
              class="w-full flex items-center gap-3 text-left bg-white rounded-2xl ring-1 ring-ink-100 px-4 py-3.5 hover:ring-brand-400 transition group">
              <img src="assets/images/gibsIcon.png" alt="" width="36" height="36" class="w-9 h-9 shrink-0 rounded-lg ring-1 ring-black/10 [image-rendering:pixelated]" />
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-bold text-ink-700">Ask Gibs</span>
                <span class="block text-xs text-slate-500 mt-0.5">Instant answers about permits, any time</span>
              </span>
              <svg class="w-4 h-4 shrink-0 text-slate-400 group-hover:text-brand-600 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <!-- Search for help -->
            <div class="bg-white rounded-2xl ring-1 ring-ink-100 p-2">
              <button type="button" @click="searchFromHome"
                class="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 px-3.5 py-3 text-left transition">
                <span class="text-sm font-semibold text-ink-700">Search for help</span>
                <svg class="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              </button>
              <button v-for="f in faqs.slice(0, 4)" :key="f.id" type="button" @click="openArticle(f)"
                class="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left rounded-xl hover:bg-brand-50 transition group">
                <span class="text-sm text-slate-600 group-hover:text-ink-700">{{ f.question }}</span>
                <svg class="w-4 h-4 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
              <p v-if="!faqsLoaded" class="px-3.5 py-3 text-xs text-slate-400">Loading help articles…</p>
            </div>
          </div>
        </div>

        <!-- ======================= MESSAGES ======================= -->
        <div v-else-if="tab === 'messages'" class="pt-tab-in flex-1 min-h-0 flex flex-col bg-white">
          <header class="shrink-0 flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
            <button v-if="view !== 'list'" type="button" @click="view === 'compose' ? (view = 'permit') : (view === 'permit' ? (view = 'who') : backToList())"
              aria-label="Back" class="p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div class="flex-1 min-w-0 text-center">
              <h2 class="text-sm font-bold text-ink-700 truncate">
                <template v-if="view === 'list'">Messages</template>
                <template v-else-if="view === 'who'">Who do you want to talk to?</template>
                <template v-else-if="view === 'permit'">Which permit is this about?</template>
                <template v-else-if="view === 'compose'">{{ chosen && chosen.office }}</template>
                <template v-else-if="thread">{{ thread.office_name }}</template>
              </h2>
              <p v-if="view === 'compose' && chosen" class="text-[11px] text-slate-400 truncate">About: {{ chosen.name }}</p>
              <p v-if="view === 'thread' && thread" class="text-[11px] text-slate-400 truncate"><template v-if="thread.application_id">Application #{{ thread.application_id }} · </template>About: {{ thread.subject }}<span v-if="thread.status === 'closed'"> · closed</span></p>
            </div>
            <button type="button" @click="close" aria-label="Close" class="p-2 -mr-1 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>

          <!-- signed out -->
          <div v-if="!signedIn" class="flex-1 grid place-items-center px-8 text-center">
            <div>
              <div class="mx-auto w-14 h-14 rounded-2xl bg-brand-50 ring-1 ring-brand-100 grid place-items-center text-brand-700">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
              </div>
              <h3 class="mt-4 text-base font-bold text-ink-700">Talk to City Hall</h3>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">Messages go to the office that issues your permit. Sign in so they know who to reply to.</p>
              <div class="mt-5 flex flex-col gap-2">
                <button type="button" @click="go('/login')" class="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition">Sign in</button>
                <button type="button" @click="go('/register')" class="w-full py-2.5 rounded-xl text-sm font-semibold text-brand-700 hover:bg-brand-50 transition">Create an account</button>
              </div>
            </div>
          </div>

          <!-- list -->
          <template v-else-if="view === 'list'">
            <div class="pt-stagger flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft">
              <p v-if="error" class="mx-4 mt-3 rounded-xl bg-red-50 ring-1 ring-red-100 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>
              <p v-if="listLoading" class="px-5 py-6 text-sm text-slate-500">Loading your messages…</p>
              <div v-else-if="!conversations.length" class="h-full grid place-items-center px-8 text-center">
                <div>
                  <div class="mx-auto w-14 h-14 rounded-2xl bg-brand-50 ring-1 ring-brand-100 grid place-items-center text-brand-700">
                    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
                  </div>
                  <h3 class="mt-4 text-base font-bold text-ink-700">No messages yet</h3>
                  <p class="mt-1.5 text-sm text-slate-500">Ask the office that handles your permit — or Gibs, for an instant answer.</p>
                </div>
              </div>
              <button v-for="c in conversations" :key="c.id" type="button" @click="openThread(c.id)"
                class="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-slate-100 hover:bg-brand-50/60 transition">
                <span class="relative shrink-0 w-10 h-10 rounded-full grid place-items-center"
                  :class="c.application_id ? 'bg-sun-100 text-sun-700' : 'bg-brand-100 text-brand-700'">
                  <svg v-if="c.application_id" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
                  <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/></svg>
                  <span v-if="c.unread" class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sun-400 ring-2 ring-white"></span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2">
                    <span class="text-sm truncate" :class="c.unread ? 'font-bold text-ink-700' : 'font-semibold text-ink-700'">{{ c.subject }}</span>
                    <span class="shrink-0 text-[11px] text-slate-400">{{ timeAgo(c.last_message_at) }}</span>
                  </span>
                  <span class="block text-[11px] text-slate-400 truncate"><template v-if="c.application_id">Application #{{ c.application_id }} · {{ c.application_status }} · </template>{{ c.office_name }}<span v-if="c.status === 'closed'"> · closed</span></span>
                  <span class="block mt-0.5 text-xs truncate" :class="c.unread ? 'text-ink-700 font-semibold' : 'text-slate-500'">{{ c.last_message }}</span>
                </span>
              </button>
            </div>
            <div class="shrink-0 p-3 border-t border-slate-100">
              <button type="button" @click="newMessage"
                class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 shadow-[0_10px_22px_-10px_rgba(31,122,58,0.7)] transition">
                Send us a message
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>
              </button>
            </div>
          </template>

          <!-- step 1: who -->
          <div v-else-if="view === 'who'" class="pt-stagger flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-meadow/40">
            <button type="button" @click="askGibs"
              class="w-full flex items-start gap-3 text-left bg-white rounded-2xl ring-1 ring-ink-100 p-4 hover:ring-brand-400 hover:shadow-[0_10px_24px_-14px_rgba(16,48,29,0.5)] transition">
              <img src="assets/images/gibsIcon.png" alt="" width="44" height="44" class="w-11 h-11 shrink-0 rounded-xl ring-1 ring-black/10 [image-rendering:pixelated]" />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2"><span class="text-sm font-bold text-ink-700">Gibs</span><span class="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 ring-1 ring-brand-100 rounded-full px-2 py-0.5">Instant</span></span>
                <span class="block text-xs text-slate-500 mt-1 leading-relaxed">The PermitTrack assistant. Requirements, fees, how verification works — answered right away.</span>
              </span>
            </button>
            <button type="button" @click="choosePeople"
              class="w-full flex items-start gap-3 text-left bg-white rounded-2xl ring-1 ring-ink-100 p-4 hover:ring-brand-400 hover:shadow-[0_10px_24px_-14px_rgba(16,48,29,0.5)] transition">
              <span class="w-11 h-11 shrink-0 rounded-xl bg-sky-100 text-sky-700 grid place-items-center">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/><path d="M8 7h3M8 11h3M8 15h3"/></svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2"><span class="text-sm font-bold text-ink-700">City staff</span><span class="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 ring-1 ring-sky-100 rounded-full px-2 py-0.5">A person</span></span>
                <span class="block text-xs text-slate-500 mt-1 leading-relaxed">Pick the permit you're asking about and it goes straight to the office that issues it.</span>
              </span>
            </button>
          </div>

          <!-- step 2: which permit -->
          <template v-else-if="view === 'permit'">
            <div class="shrink-0 px-4 pt-3 pb-2">
              <div class="relative">
                <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input v-model="permitQuery" type="search" placeholder="Search permits or offices" aria-label="Search permits"
                  class="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
              </div>
            </div>
            <div class="pt-tab-in flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft px-4 pb-4">
              <p v-if="optionsLoading" class="py-6 text-sm text-slate-500">Loading permits…</p>
              <p v-else-if="!permitGroups.length" class="py-6 text-sm text-slate-500">No permit matches “{{ permitQuery }}”.</p>
              <div v-for="g in permitGroups" :key="g.key" class="mt-3 first:mt-1">
                <h3 class="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ g.label }}</h3>
                <div class="rounded-2xl ring-1 ring-ink-100 overflow-hidden divide-y divide-slate-100">
                  <button v-for="p in g.permits" :key="p.id" type="button" @click="choosePermit(p)" :disabled="!p.available"
                    class="w-full flex items-center gap-3 px-3.5 py-3 text-left bg-white transition"
                    :class="p.available ? 'hover:bg-brand-50 group' : 'opacity-60 cursor-not-allowed'">
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-semibold text-ink-700">{{ p.name }}</span>
                      <span v-if="p.available" class="block text-[11px] text-slate-500 mt-0.5">Goes to {{ p.office }}</span>
                      <span v-else class="block text-[11px] text-red-600 mt-0.5">{{ p.reason }}</span>
                    </span>
                    <svg v-if="p.available" class="w-4 h-4 shrink-0 text-slate-300 group-hover:text-brand-600 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- step 3: write it -->
          <form v-else-if="view === 'compose'" @submit.prevent="start" class="pt-tab-in flex-1 min-h-0 flex flex-col">
            <div class="flex-1 min-h-0 overflow-y-auto p-4 bg-meadow/40">
              <div class="rounded-2xl bg-white ring-1 ring-ink-100 p-3.5 text-xs text-slate-500 leading-relaxed">
                <span class="font-semibold text-ink-700">{{ chosen.office }}</span> issues the {{ chosen.name }}, so your message goes to them.
                Please don't send passwords or ID numbers here.
              </div>
              <label for="chat-compose" class="sr-only">Your message</label>
              <textarea id="chat-compose" ref="compose" v-model="draft" rows="7" maxlength="2000"
                :placeholder="'What would you like to ask about the ' + chosen.name + '?'"
                class="mt-3 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
                @keydown.enter.ctrl.prevent="start" @keydown.enter.meta.prevent="start"></textarea>
              <p class="mt-1 text-right text-[11px] text-slate-400 tabular-nums">{{ draft.length }} / 2000</p>
              <p v-if="error" class="mt-2 text-sm text-red-600" role="alert">{{ error }}</p>
            </div>
            <div class="shrink-0 p-3 border-t border-slate-100">
              <button type="submit" :disabled="sending || !draft.trim()"
                class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                <LogoMark v-if="sending" animated color="currentColor" class="w-5 h-5" />
                {{ sending ? 'Sending…' : 'Send message' }}
              </button>
            </div>
          </form>

          <!-- a thread -->
          <template v-else-if="view === 'thread'">
            <div ref="threadLog" class="pt-tab-in flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft px-4 py-4 bg-meadow/40" aria-live="polite">
              <div v-if="threadLoading" class="py-10 grid place-items-center"><LogoMark animated class="w-9 h-9" /></div>
              <template v-else>
              <div v-if="thread && thread.application_id" class="pt-rise-in mb-4 flex items-center gap-3 rounded-2xl bg-white ring-1 ring-ink-100 p-3 shadow-[0_8px_20px_-16px_rgba(16,48,29,0.5)]">
                <span class="shrink-0 w-9 h-9 rounded-xl bg-sun-100 text-sun-700 grid place-items-center">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-bold text-ink-700 truncate">{{ thread.subject }}</span>
                  <span class="block text-[11px] text-slate-500 truncate">Application #{{ thread.application_id }} · {{ thread.application_status }}</span>
                </span>
                <button type="button" @click="openApplicationPage" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 ring-1 ring-brand-100 hover:bg-brand-100 transition">View</button>
              </div>
              <transition-group name="list" tag="div" class="relative space-y-2.5">
                <div v-for="m in messages" :key="m.id" :class="m.kind === 'event' ? 'flex justify-center py-0.5' : (m.mine ? 'flex flex-col items-end' : 'flex flex-col items-start')">
                  <p v-if="m.kind === 'event'" class="max-w-[92%] text-center text-[11px] leading-snug text-slate-500 bg-white/80 ring-1 ring-ink-100 rounded-xl px-3 py-1.5">
                    {{ m.body }} <span class="text-slate-400">· {{ timeAgo(m.created_at) }}</span>
                  </p>
                  <template v-else>
                  <span v-if="!m.mine" class="px-1 mb-0.5 text-[11px] font-semibold text-slate-500">{{ m.sender_name }}</span>
                  <div class="max-w-[85%] px-3.5 py-2 text-sm whitespace-pre-line break-words"
                    :class="m.mine ? 'rounded-2xl rounded-br-md bg-brand-600 text-white' : 'rounded-2xl rounded-bl-md bg-white ring-1 ring-brand-100 text-slate-700 shadow-[0_6px_16px_-12px_rgba(16,48,29,0.35)]'">{{ m.body }}</div>
                  <span class="px-1 mt-0.5 text-[10px] text-slate-400">{{ timeAgo(m.created_at) }}</span>
                  </template>
                </div>
              </transition-group>
              </template>
            </div>
            <form @submit.prevent="sendReply" class="shrink-0 border-t border-slate-100 bg-white p-3">
              <p v-if="error" class="mb-2 text-sm text-red-600" role="alert">{{ error }}</p>
              <div class="flex items-end gap-2">
                <label for="chat-reply" class="sr-only">Reply</label>
                <textarea id="chat-reply" ref="reply" v-model="reply" rows="1" maxlength="2000" placeholder="Write a reply…"
                  class="flex-1 min-w-0 max-h-32 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
                  @keydown.enter.exact.prevent="sendReply"></textarea>
                <button type="submit" :disabled="sending || !reply.trim()" aria-label="Send reply"
                  class="shrink-0 w-11 h-11 rounded-xl bg-brand-600 text-white grid place-items-center hover:bg-brand-700 disabled:opacity-50 transition">
                  <LogoMark v-if="sending" animated color="currentColor" class="w-5 h-5" />
                  <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>
                </button>
              </div>
              <p class="mt-1.5 text-[10px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
            </form>
          </template>
        </div>

        <!-- ======================= HELP ======================= -->
        <div v-else class="pt-tab-in flex-1 min-h-0 flex flex-col bg-white">
          <header class="shrink-0 flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
            <button v-if="article" type="button" @click="article = null" aria-label="Back to help" class="p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2 class="flex-1 text-center text-sm font-bold text-ink-700">Help</h2>
            <button type="button" @click="close" aria-label="Close" class="p-2 -mr-1 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>

          <div v-if="article" :key="article.id" class="pt-tab-in flex-1 min-h-0 overflow-y-auto px-5 py-5">
            <span class="text-[11px] font-bold uppercase tracking-wider text-brand-700">{{ article.category }}</span>
            <h3 class="mt-1 text-lg font-bold leading-snug text-ink-700">{{ article.question }}</h3>
            <div class="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
              <p v-for="(para, i) in paragraphs(article.answer)" :key="i">{{ para }}</p>
            </div>
            <button v-if="article.link" type="button" @click="go(article.link.path)"
              class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">{{ article.link.label }} →</button>
            <div class="mt-7 rounded-2xl bg-meadow ring-1 ring-brand-100 p-4">
              <p class="text-sm font-semibold text-ink-700">Didn't answer it?</p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button type="button" @click="askGibs" class="px-3.5 py-2 rounded-xl bg-white ring-1 ring-brand-200 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition">Ask Gibs</button>
                <button type="button" @click="newMessage" class="px-3.5 py-2 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 transition">Message an office</button>
              </div>
            </div>
          </div>

          <template v-else>
            <div class="shrink-0 px-4 pt-3 pb-2 space-y-2.5">
              <div class="relative">
                <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input ref="helpSearch" v-model="helpQuery" type="search" placeholder="Search for help" aria-label="Search for help"
                  class="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
              </div>
              <button type="button" @click="askGibs"
                class="w-full flex items-center gap-3 text-left rounded-xl bg-ink-700 text-white px-3.5 py-2.5 hover:bg-ink-600 transition">
                <img src="assets/images/gibsIcon.png" alt="" width="28" height="28" class="w-7 h-7 rounded-md ring-1 ring-white/25 [image-rendering:pixelated]" />
                <span class="flex-1 text-sm font-semibold">Chat with Gibs instead</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            <div class="pt-stagger flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft px-4 pb-4">
              <p v-if="!faqsLoaded" class="py-6 text-sm text-slate-500">Loading help articles…</p>
              <p v-else-if="!helpResults.length" class="py-6 text-sm text-slate-500">Nothing matches “{{ helpQuery }}”. Try Gibs — he understands plain questions.</p>
              <div v-for="g in helpGroups" :key="g.category" class="mt-3 first:mt-1">
                <h3 class="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ g.category }}</h3>
                <div class="rounded-2xl ring-1 ring-ink-100 overflow-hidden divide-y divide-slate-100">
                  <button v-for="f in g.items" :key="f.id" type="button" @click="openArticle(f)"
                    class="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left bg-white hover:bg-brand-50 transition group">
                    <span class="text-sm text-slate-600 group-hover:text-ink-700">{{ f.question }}</span>
                    <svg class="w-4 h-4 shrink-0 text-slate-300 group-hover:text-brand-600 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- The three tabs -->
        <nav class="shrink-0 grid grid-cols-3 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Help and messages">
          <button v-for="t in [{ key: 'home', label: 'Home' }, { key: 'messages', label: 'Messages' }, { key: 'help', label: 'Help' }]" :key="t.key"
            type="button" @click="goTab(t.key)" :aria-current="tab === t.key ? 'page' : null"
            :aria-label="t.key === 'messages' && unread ? 'Messages, ' + unread + ' unread' : t.label"
            class="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition"
            :class="tab === t.key ? 'text-brand-700' : 'text-slate-400 hover:text-slate-600'">
            <svg v-if="t.key === 'home'" class="w-6 h-6" viewBox="0 0 24 24" :fill="tab === 'home' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
            <svg v-else-if="t.key === 'messages'" class="w-6 h-6" viewBox="0 0 24 24" :fill="tab === 'messages' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
            <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01" stroke-width="3"/></svg>
            {{ t.label }}
            <span v-if="t.key === 'messages' && unread" aria-hidden="true" class="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-sun-400 text-ink-700 text-[10px] font-bold grid place-items-center ring-2 ring-white">{{ unread > 9 ? '9+' : unread }}</span>
            <span v-if="tab === t.key" class="absolute top-0 inset-x-6 h-0.5 rounded-full bg-brand-600"></span>
          </button>
        </nav>
      </section>
    </transition>
  </div>
  `,
};

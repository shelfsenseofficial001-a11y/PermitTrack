import { apiGet, apiPost } from '../api/client.js?v=74';
import BaseModal from './BaseModal.js?v=74';
import GibsMascot from './GibsMascot.js?v=74';
import GibsPeek from './GibsPeek.js?v=74';

// The Gibs P. assistant: an "Ask" button (with Gibs peeking above it) that opens a two-pane dialog —
// Gibs on a stage on the left, the chat on the right (stacked on phones). Answers come from
// api/chat.php.

const TYPING_LINES = ['Gibs is thinking…', 'Gibs is flipping through the rulebook…', 'Gibs is checking with the barangay…', 'Gibs is crafting an answer…'];

export default {
  name: 'ChatWidget',
  components: { BaseModal, GibsMascot, GibsPeek },
  props: {
    // True while another bottom-right floating control (e.g. Landing's "Back to top") is also
    // showing, so the Ask button lifts above it instead of the two overlapping.
    liftForFab: { type: Boolean, default: false },
  },
  data() {
    return {
      open: false,
      started: false,
      messages: [], // { from: 'bot' | 'user', text, link?, suggestions? }
      draft: '',
      sending: false,
      typingLine: TYPING_LINES[0],
      mascotState: 'idle', // idle | greeting | thinking | answering | error — see GibsMascot.js
      mascotTimer: null,
      confirmReset: false,
    };
  },
  computed: {
    // While you type (and he isn't busy reacting to something), Gibs turns to listen.
    stageState() {
      return this.mascotState === 'idle' && this.draft.trim() ? 'listening' : this.mascotState;
    },
  },
  watch: {
    open(isOpen) {
      document.body.style.overflow = isOpen ? 'hidden' : '';
    },
  },
  mounted() {
    this.onKey = (e) => {
      // With the reset confirmation up, Escape belongs to that dialog, not this one.
      if (e.key === 'Escape' && this.open && !this.confirmReset) this.close();
    };
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    clearTimeout(this.mascotTimer);
    document.removeEventListener('keydown', this.onKey);
    if (this.open) document.body.style.overflow = '';
  },
  methods: {
    // Splits an answer into paragraphs and "- " bullet lists for display
    blocks(text) {
      const out = [];
      text.split('\n').forEach((line) => {
        if (line.startsWith('- ')) {
          const last = out[out.length - 1];
          if (last && last.type === 'list') last.items.push(line.slice(2));
          else out.push({ type: 'list', items: [line.slice(2)] });
        } else if (line.trim()) {
          out.push({ type: 'p', text: line });
        }
      });
      return out;
    },
    // Holds mascotState at a value for a bit, then falls back to idle — so "answering"/"error"
    // read as a momentary reaction rather than getting stuck.
    setMascot(state, revertAfterMs) {
      clearTimeout(this.mascotTimer);
      this.mascotState = state;
      if (revertAfterMs) {
        this.mascotTimer = setTimeout(() => { this.mascotState = 'idle'; }, revertAfterMs);
      }
    },
    async greet() {
      this.setMascot('greeting', 2000);
      try {
        const res = await apiGet('chat.php?action=start');
        this.messages.push({ from: 'bot', text: res.text, suggestions: res.suggestions });
      } catch (e) {
        this.messages.push({ from: 'bot', text: 'Oops — Gibs tripped over a cable. Give it a moment and try again?' });
        this.setMascot('error', 1500);
      }
    },
    async openChat() {
      this.open = true;
      if (!this.started) {
        this.started = true;
        this.greet();
      }
      this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    close() {
      this.open = false;
      this.$nextTick(() => this.$refs.askButton && this.$refs.askButton.focus());
    },
    async send(text) {
      const message = (text ?? this.draft).trim();
      if (!message || this.sending) return;
      this.draft = '';
      // Suggestions belong to the previous answer; hide them once the user moves on
      this.messages.forEach((m) => { m.suggestions = []; });
      this.messages.push({ from: 'user', text: message });
      this.sending = true;
      this.typingLine = TYPING_LINES[Math.floor(Math.random() * TYPING_LINES.length)];
      this.setMascot('thinking');
      this.scrollDown();
      try {
        const res = await apiPost('chat.php?action=ask', { message });
        this.messages.push({ from: 'bot', text: res.text, link: res.link, suggestions: res.suggestions });
        this.setMascot('answering', 1100);
      } catch (e) {
        this.messages.push({ from: 'bot', text: e.message });
        this.setMascot('error', 1600);
      } finally {
        this.sending = false;
        this.scrollDown();
      }
    },
    keepChat() {
      this.confirmReset = false;
      this.relockScroll();
    },
    async resetChat() {
      this.confirmReset = false;
      this.relockScroll();
      this.messages = [];
      this.draft = '';
      try {
        await apiPost('chat.php?action=reset', {});
      } catch (e) {
        // The conversation is already cleared on screen; the server-side counters are cosmetic.
      }
      await this.greet();
      this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    // BaseModal releases the page scroll lock when it closes, but the chat dialog is still open.
    relockScroll() {
      this.$nextTick(() => { if (this.open) document.body.style.overflow = 'hidden'; });
    },
    go(path) {
      this.close();
      this.$router.push(path);
    },
    scrollDown() {
      this.$nextTick(() => {
        const el = this.$refs.log;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  template: `
  <!-- On phones the Ask button sits above the bottom tab tray (4rem + the home-bar inset), which
       already clears a page-level FAB like Landing's "Back to top"; from md up it normally sits at
       bottom-5, but lifts higher when liftForFab is set so the two don't overlap. -->
  <div class="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3"
    :class="liftForFab ? 'md:bottom-[5.25rem]' : 'md:bottom-5'">
    <GibsPeek :suppressed="open" :lift-for-fab="liftForFab" @open="openChat" />

    <button v-show="!open" ref="askButton" type="button" @click="openChat" :aria-expanded="open" aria-label="Open Gibs P., the PermitTrack assistant"
      class="flex items-center gap-2 rounded-full bg-ink-700 text-white pl-3 pr-4 py-3 shadow-lg hover:bg-ink-600 transition">
      <span class="w-7 h-7 rounded-full bg-sun-400 text-ink-700 flex items-center justify-center font-bold text-sm">?</span>
      <span class="text-sm font-semibold">Ask</span>
    </button>
  </div>

  <transition enter-from-class="opacity-0" enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
    leave-to-class="opacity-0" leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none">
    <div v-if="open" class="font-inter fixed inset-0 z-50 flex md:items-center md:justify-center md:p-6 bg-ink-900/45 backdrop-blur-[3px]" @click.self="close">
      <section role="dialog" aria-modal="true" aria-labelledby="gibs-title"
        class="relative w-full h-[100dvh] md:h-[min(44rem,calc(100vh-3rem))] md:max-w-[64rem] flex flex-col md:flex-row bg-white md:rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-[0_40px_90px_-24px_rgba(7,24,14,0.55)]">

        <!-- The stage: Gibs, big and in full view. It's a plain white room for now. -->
        <div class="relative shrink-0 h-[34vh] md:h-auto md:w-[42%] bg-white border-b md:border-b-0 md:border-r border-slate-100">
          <GibsMascot mode="stage" fill :state="stageState" />
          <p class="hidden md:block absolute bottom-4 inset-x-0 text-center text-[11px] text-slate-400 pointer-events-none">Drag to spin me around</p>
        </div>

        <!-- The chat -->
        <div class="flex-1 min-h-0 flex flex-col bg-meadow/40">
          <header class="flex items-center gap-2 px-5 py-3.5 bg-white border-b border-slate-100 shrink-0">
            <div class="min-w-0 flex-1 leading-tight">
              <h2 id="gibs-title" class="text-sm font-bold text-ink-700">Gibs P. <span class="font-medium text-slate-400">· PermitTrack assistant</span></h2>
              <p class="text-[11px] text-slate-400 mt-0.5">Please don't share passwords or ID numbers here.</p>
            </div>
            <button type="button" @click="confirmReset = true" :disabled="sending || messages.length < 2"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 px-3 py-2 rounded-xl hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              New chat
            </button>
            <button type="button" @click="close" aria-label="Close assistant"
              class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>

          <div ref="log" class="flex-1 min-h-0 overflow-y-auto scroll-soft px-5 py-5" aria-live="polite">
            <transition-group name="list" tag="div" class="space-y-3">
            <div v-for="(m, i) in messages" :key="i" :class="m.from === 'user' ? 'flex justify-end' : ''">
              <div v-if="m.from === 'user'" class="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 text-white px-3.5 py-2 text-sm">{{ m.text }}</div>
              <div v-else class="max-w-[92%]">
                <div class="rounded-2xl rounded-bl-md bg-white border border-brand-100 px-3.5 py-2.5 text-sm text-slate-700 space-y-1.5 shadow-[0_6px_16px_-12px_rgba(16,48,29,0.35)]">
                  <template v-for="(b, j) in blocks(m.text)" :key="j">
                    <p v-if="b.type === 'p'">{{ b.text }}</p>
                    <ul v-else class="list-disc pl-5 space-y-0.5"><li v-for="(item, k) in b.items" :key="k">{{ item }}</li></ul>
                  </template>
                  <button v-if="m.link" type="button" @click="go(m.link.path)" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">{{ m.link.label }} →</button>
                </div>
                <div v-if="m.suggestions && m.suggestions.length" class="flex flex-wrap gap-1.5 mt-2">
                  <button v-for="s in m.suggestions" :key="s" type="button" @click="send(s)"
                    class="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 text-left">{{ s }}</button>
                </div>
              </div>
            </div>
            </transition-group>
            <div v-if="sending" class="text-xs text-slate-400 mt-3">{{ typingLine }}</div>
          </div>

          <form @submit.prevent="send()" class="border-t border-slate-100 bg-white p-3 flex gap-2 shrink-0">
            <input ref="input" v-model="draft" maxlength="500" placeholder="Ask Gibs about permits, verification…" aria-label="Your question"
              class="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
            <button type="submit" :disabled="sending || !draft.trim()" class="px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">Send</button>
          </form>
        </div>
      </section>
    </div>
  </transition>

  <BaseModal v-if="confirmReset" title="Start a new chat?" eyebrow="New conversation" tone="sun"
    subtitle="This clears everything in the current chat. Your permits and account aren't affected."
    @close="keepChat">
    <template #icon>
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
    </template>
    <p class="text-sm text-slate-500 leading-relaxed">Gibs won't take it personally. He forgets things faster than a goldfish anyway.</p>
    <template #footer>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button type="button" @click="keepChat" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Continue current chat</button>
        <button type="button" @click="resetChat"
          class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
          Reset now
        </button>
      </div>
    </template>
  </BaseModal>
  `,
};

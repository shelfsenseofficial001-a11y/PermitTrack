import { apiGet, apiPost } from '../api/client.js?v=128';
import BaseModal from './BaseModal.js?v=128';
import GibsMascot from './GibsMascot.js?v=128';
import GibsPeek from './GibsPeek.js?v=128';

// The Gibs P. assistant: an "Ask" button (with Gibs peeking above it) that opens a two-pane dialog —
// Gibs on a stage on the left, the chat on the right (stacked on phones). Answers come from
// api/chat.php.

const TYPING_LINES = ['Gibs is thinking…', 'Gibs is flipping through the rulebook…', 'Gibs is checking with the barangay…', 'Gibs is putting an answer together…'];

// "Hide Visualization" (hides Gibs) is a per-browser preference, so localStorage is fine (and losing it in a private
// window is harmless).
const HIDE_KEY = 'permittrack.hideGibs';
function readHidden() {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; }
}

export default {
  name: 'ChatWidget',
  components: { BaseModal, GibsMascot, GibsPeek },
  props: {
    // True while another bottom-right floating control (e.g. Landing's "Back to top") is also
    // showing, so the Ask button lifts above it instead of the two overlapping.
    liftForFab: { type: Boolean, default: false },
    // True on pages with a sticky action bar along the bottom (New Application's Back /
    // Continue), so the Ask button rides above it on every screen size instead of covering it.
    liftForBar: { type: Boolean, default: false },
  },
  data() {
    return {
      open: false,
      started: false,
      messages: [], // { from: 'bot' | 'user', text, link?, suggestions? }
      draft: '',
      sending: false,
      typingLine: TYPING_LINES[0],
      mascotState: 'idle', // idle | greeting | thinking | answering | pondering | error — see GibsMascot.js
      mascotTimer: null,
      confirmReset: false,
      gibsHidden: readHidden(),
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
      // The panel only covers the page on phones. From md up it's a corner panel anchored over
      // the Ask button, so the page behind it stays scrollable.
      const coversPage = !window.matchMedia('(min-width: 768px)').matches;
      document.documentElement.style.overflow = isOpen && coversPage ? 'hidden' : '';
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
    if (this.open) document.documentElement.style.overflow = '';
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
        // Off-topic or stumped (answered: false): he thinks it over instead of celebrating.
        this.setMascot(res.answered === false ? 'pondering' : 'answering', 1100);
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
    // A new chat starts from the top, language question included (chat.php's start action resets it).
    async resetChat() {
      this.confirmReset = false;
      this.relockScroll();
      this.messages = [];
      this.draft = '';
      await this.greet();
      this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    // Hides him everywhere — the stage beside the chat and the peeking by the Ask button.
    toggleGibs() {
      this.gibsHidden = !this.gibsHidden;
      try { localStorage.setItem(HIDE_KEY, this.gibsHidden ? '1' : '0'); } catch (e) { /* just not remembered */ }
    },
    // BaseModal releases the page scroll lock when it closes, but the chat dialog is still open.
    relockScroll() {
      this.$nextTick(() => { if (this.open) document.documentElement.style.overflow = 'hidden'; });
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
  <div class="fixed right-5 z-40 flex flex-col items-end gap-3"
    :class="liftForBar ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-24'
      : ['bottom-[calc(4.75rem+env(safe-area-inset-bottom))]', liftForFab ? 'md:bottom-[5.25rem]' : 'md:bottom-5']">
    <GibsPeek v-if="!gibsHidden" :suppressed="open" :lift-for-fab="liftForFab" :lift-for-bar="liftForBar" @open="openChat" />

    <button ref="askButton" type="button" @click="open ? close() : openChat()" :aria-expanded="open"
      :aria-label="open ? 'Close Gibs P.' : 'Open Gibs P., the PermitTrack assistant'"
      :class="open ? 'hidden md:flex' : 'flex'"
      class="items-center gap-2 rounded-full bg-ink-700 text-white pl-3 pr-4 py-3 shadow-lg hover:bg-ink-600 transition">
      <img src="assets/images/gibsIcon.png" alt="" width="28" height="28" class="w-7 h-7 rounded-md ring-1 ring-white/25 [image-rendering:pixelated]" />
      <span class="text-sm font-semibold">Ask</span>
    </button>
  </div>

  <!-- Phones get the whole screen; from md up the panel rises out of the Ask button in the corner,
       so the page behind it stays readable and the chip it belongs to is still in view. -->
  <transition enter-from-class="opacity-0 md:translate-y-3 md:scale-[0.97]" enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
    leave-to-class="opacity-0 md:translate-y-2 md:scale-[0.98]" leave-active-class="transition duration-150 ease-in motion-reduce:transition-none">
    <div v-if="open"
      class="font-inter gibs-shell z-50 flex bg-ink-900/45 backdrop-blur-[3px] md:bg-transparent md:backdrop-blur-none md:origin-bottom-right"
      :class="liftForFab || liftForBar ? 'is-lifted' : ''" @click.self="close">
      <section role="dialog" aria-modal="true" aria-labelledby="gibs-title"
        class="gibs-panel relative flex flex-col bg-white md:rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-[0_40px_90px_-24px_rgba(7,24,14,0.55)]"
        :class="gibsHidden ? 'is-narrow' : ''">

        <!-- Who you are talking to, and the way out — across the top of the panel, above the stage,
             so they are in the same place whether the two panes sit side by side or stacked. -->
        <header class="flex items-center gap-2 px-5 py-3.5 bg-white border-b border-slate-100 shrink-0">
          <img src="assets/images/gibsIcon.png" alt="" width="36" height="36"
            class="w-9 h-9 shrink-0 rounded-lg ring-1 ring-black/10 [image-rendering:pixelated]" />
          <div class="min-w-0 flex-1 leading-tight">
            <h2 id="gibs-title" class="text-sm font-bold text-ink-700 truncate">Gibs P. <span class="font-medium text-slate-400">· PermitTrack assistant</span></h2>
            <p class="text-[11px] text-slate-400 mt-0.5 truncate">Please don't share passwords or ID numbers here.</p>
          </div>
          <!-- Hiding lives on the stage itself; once hidden, the way back is here. -->
          <button v-if="gibsHidden" type="button" @click="toggleGibs" aria-label="Show Visualization" title="Show Visualization"
            class="shrink-0 inline-flex items-center p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button" @click="close" aria-label="Close assistant"
            class="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="flex-1 min-h-0 flex flex-col md:flex-row">

        <!-- The stage: Gibs, big and in full view. It's a plain white room for now. -->
        <div v-if="!gibsHidden" class="relative shrink-0 h-[30vh] md:h-auto md:w-[42%] bg-white border-b md:border-b-0 md:border-r border-slate-100">
          <GibsMascot mode="stage" fill :state="stageState" />
          <button type="button" @click="toggleGibs" aria-label="Hide Visualization" title="Hide Visualization"
            class="absolute top-3 right-3 z-10 p-2.5 rounded-xl bg-white/90 text-slate-400 ring-1 ring-slate-200 hover:text-slate-700 hover:bg-slate-50 transition">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.16 3.19M6.6 6.6C3.9 8.4 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="m2 2 20 20"/></svg>
          </button>
          <p class="hidden md:block absolute bottom-4 inset-x-0 text-center text-[11px] text-slate-400 pointer-events-none">Drag to spin me around</p>
        </div>

        <!-- The chat. min-w-0 matters as much as min-h-0: without it this flex item will not
             shrink below its content's min-content width and would spill past the panel. -->
        <div class="flex-1 min-w-0 min-h-0 flex flex-col bg-meadow/40">
          <div ref="log" class="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft px-5 py-5" aria-live="polite">
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

          <form @submit.prevent="send()" class="border-t border-slate-100 bg-white p-3 flex items-center gap-2 shrink-0">
            <!-- New chat sits where you type, as a round plus — it starts the conversation over -->
            <button type="button" @click="confirmReset = true" :disabled="sending || messages.length < 2"
              aria-label="New chat" title="New chat"
              class="shrink-0 w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center transition"
              :class="sending || messages.length < 2 ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_6px_14px_-6px_rgba(31,122,58,0.6)] hover:bg-brand-700 active:scale-95'">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <input ref="input" v-model="draft" maxlength="500" placeholder="Ask Gibs about permits, verification…" aria-label="Your question"
              class="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
            <button type="submit" :disabled="sending || !draft.trim()" class="shrink-0 self-stretch px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">Send</button>
          </form>
        </div>

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

import { apiGet, apiPost } from '../api/client.js?v=66';

// Floating FAQ assistant for resident / business users (prototype — answers come from api/chat.php)
export default {
  name: 'ChatWidget',
  data() {
    return {
      open: false,
      started: false,
      messages: [], // { from: 'bot' | 'user', text, link?, suggestions? }
      draft: '',
      sending: false,
    };
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
    async toggle() {
      this.open = !this.open;
      if (this.open && !this.started) {
        this.started = true;
        try {
          const res = await apiGet('chat.php?action=start');
          this.messages.push({ from: 'bot', text: res.text, suggestions: res.suggestions });
        } catch (e) {
          this.messages.push({ from: 'bot', text: "Sorry, the assistant isn't available right now." });
        }
      }
      if (this.open) this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    async send(text) {
      const message = (text ?? this.draft).trim();
      if (!message || this.sending) return;
      this.draft = '';
      // Suggestions belong to the previous answer; hide them once the user moves on
      this.messages.forEach((m) => { m.suggestions = []; });
      this.messages.push({ from: 'user', text: message });
      this.sending = true;
      this.scrollDown();
      try {
        const res = await apiPost('chat.php?action=ask', { message });
        this.messages.push({ from: 'bot', text: res.text, link: res.link, suggestions: res.suggestions });
      } catch (e) {
        this.messages.push({ from: 'bot', text: e.message });
      } finally {
        this.sending = false;
        this.scrollDown();
      }
    },
    go(path) {
      this.open = false;
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
  <!-- On phones it sits above the bottom tab tray (4rem + the home-bar inset); from md up, in the corner -->
  <div class="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 z-40 flex flex-col items-end gap-3">
    <transition name="chat">
    <section v-if="open" class="origin-bottom-right w-[min(24rem,calc(100vw-2.5rem))] h-[min(34rem,calc(100dvh-13rem))] md:h-[min(34rem,calc(100vh-7rem))] bg-white rounded-2xl shadow-[0_24px_60px_-20px_rgba(16,48,29,0.45)] border border-brand-100 flex flex-col overflow-hidden"
      role="dialog" aria-label="PermitTrack assistant">
      <header class="bg-ink-700 text-white px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-sun-400 text-ink-700 flex items-center justify-center font-bold">?</div>
          <div class="leading-tight">
            <div class="text-sm font-bold">PermitTrack Assistant</div>
            <div class="text-[11px] text-ink-300">Answers common questions · prototype</div>
          </div>
        </div>
        <button type="button" @click="open = false" class="text-ink-300 hover:text-white text-xl leading-none px-1" aria-label="Close assistant">×</button>
      </header>

      <div ref="log" class="flex-1 overflow-y-auto scroll-soft px-4 py-4 space-y-3 bg-meadow/60" aria-live="polite">
        <div v-for="(m, i) in messages" :key="i" :class="m.from === 'user' ? 'flex justify-end' : ''">
          <div v-if="m.from === 'user'" class="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 text-white px-3.5 py-2 text-sm">{{ m.text }}</div>
          <div v-else class="max-w-[92%]">
            <div class="rounded-2xl rounded-bl-md bg-white border border-brand-100 px-3.5 py-2.5 text-sm text-slate-700 space-y-1.5">
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
        <div v-if="sending" class="text-xs text-slate-400">Assistant is typing…</div>
      </div>

      <form @submit.prevent="send()" class="border-t border-slate-100 p-3 flex gap-2">
        <input ref="input" v-model="draft" maxlength="500" placeholder="Ask about permits, verification…" aria-label="Your question"
          class="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
        <button type="submit" :disabled="sending || !draft.trim()" class="px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">Send</button>
      </form>
    </section>
    </transition>

    <button type="button" @click="toggle" :aria-expanded="open" aria-label="Open PermitTrack assistant"
      class="flex items-center gap-2 rounded-full bg-ink-700 text-white pl-3 pr-4 py-3 shadow-lg hover:bg-ink-600 transition">
      <span class="w-7 h-7 rounded-full bg-sun-400 text-ink-700 flex items-center justify-center font-bold text-sm">{{ open ? '×' : '?' }}</span>
      <span class="text-sm font-semibold">{{ open ? 'Close' : 'Ask' }}</span>
    </button>
  </div>
  `,
};

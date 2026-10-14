import { apiPost } from '../api/client.js?v=168';
import { timeAgo, formatDateTime } from '../util.js?v=168';
import MessageBubble from './MessageBubble.js?v=168';
import MessageComposer from './MessageComposer.js?v=168';
import LogoMark from './LogoMark.js?v=168';

// A conversation's messages and the box to write in, shared by the staff inbox and the applicant's
// chat panel so replying, editing and removing behave the same on both sides. The parent owns
// loading and polling the thread and gives us `messages`; every change made here goes to the API and
// then tells the parent (`changed`) to fetch again, so what is on screen is always what the server has.

const RUN_GAP_MS = 10 * 60 * 1000; // messages further apart than this start a new run
// created_at arrives as 'YYYY-MM-DD HH:MM:SS' (Safari needs the T)
const stamp = (s) => new Date(String(s).replace(' ', 'T')).getTime();

export default {
  name: 'MessageThread',
  components: { MessageBubble, MessageComposer, LogoMark },
  props: {
    thread: { type: Object, required: true },
    messages: { type: Array, default: () => [] },
    variant: { type: String, default: 'applicant' }, // 'staff' | 'applicant' — see MessageBubble
    loading: Boolean,
    placeholder: { type: String, default: '' },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },            // a problem the parent wants shown by the box
    enterToSend: Boolean,
    iconButton: Boolean,
  },
  emits: ['changed'],
  data() {
    return { text: '', replyTo: null, editing: null, sending: false, localError: '' };
  },
  computed: {
    isStaff() {
      return this.variant === 'staff';
    },
    // Where each message sits in a run of messages from the same person: 'single', 'first',
    // 'middle' or 'last'. A run is nested — one name above it, bubbles stacked close, the time
    // after the last — and ends when someone else speaks, a status line comes between, or the
    // gap is long enough that it is a new conversation moment rather than a follow-up.
    positions() {
      const joined = (a, b) => !!a && !!b && a.kind === 'message' && b.kind === 'message'
        && a.sender_id === b.sender_id && a.sender_name === b.sender_name
        && Math.abs(stamp(b.created_at) - stamp(a.created_at)) <= RUN_GAP_MS;
      return this.messages.map((m, i) => {
        const before = joined(this.messages[i - 1], m);
        const after = joined(m, this.messages[i + 1]);
        return before ? (after ? 'middle' : 'last') : (after ? 'first' : 'single');
      });
    },
  },
  watch: {
    // Someone can remove the message you are about to answer while you are typing. Drop the reply
    // rather than send one pointing at nothing (the server would refuse it anyway).
    messages() {
      for (const key of ['replyTo', 'editing']) {
        const target = this[key];
        if (!target) continue;
        const now = this.messages.find((m) => m.id === target.id);
        if (!now || now.deleted) {
          this[key] = null;
          if (key === 'editing') this.text = '';
        }
      }
    },
  },
  methods: {
    timeAgo,
    formatDateTime,
    focus() {
      this.$nextTick(() => this.$refs.composer && this.$refs.composer.focus());
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.log;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    startReply(m) {
      this.editing = null;
      this.replyTo = m;
      this.localError = '';
      this.focus();
    },
    startEdit(m) {
      this.replyTo = null;
      this.editing = m;
      this.text = m.body;
      this.localError = '';
      this.focus();
    },
    cancelMode() {
      if (this.editing) this.text = '';
      this.replyTo = null;
      this.editing = null;
      this.localError = '';
    },
    // Scrolls to the message a reply quotes and lights it for a moment
    jumpTo(id) {
      const log = this.$refs.log;
      const el = log && log.querySelector('[data-mid="' + id + '"]');
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.remove('pt-flash');
      void el.offsetWidth; // restart the animation if it is already running
      el.classList.add('pt-flash');
      setTimeout(() => el.classList.remove('pt-flash'), 1600);
    },

    async submit() {
      const message = this.text.trim();
      if (!message || this.sending) return;
      this.sending = true;
      this.localError = '';
      try {
        if (this.editing) {
          await apiPost('conversations.php?action=edit', { id: this.thread.id, message_id: this.editing.id, message });
        } else {
          await apiPost('conversations.php?action=send', {
            id: this.thread.id, message, reply_to: this.replyTo ? this.replyTo.id : undefined,
          });
        }
        const wasEdit = !!this.editing;
        this.text = '';
        this.replyTo = null;
        this.editing = null;
        // Your own new message scrolls into view; fixing an old one shouldn't move you
        this.$emit('changed', { scroll: !wasEdit });
      } catch (e) {
        this.localError = e.message;
      } finally {
        this.sending = false;
        this.focus();
      }
    },
    async remove(m) {
      this.localError = '';
      try {
        await apiPost('conversations.php?action=remove', { id: this.thread.id, message_id: m.id });
        if (this.editing && this.editing.id === m.id) this.cancelMode();
        if (this.replyTo && this.replyTo.id === m.id) this.replyTo = null;
        this.$emit('changed', { scroll: false });
      } catch (e) {
        this.localError = e.message;
      }
    },
  },
  template: `
  <div class="flex-1 min-h-0 flex flex-col">
    <div ref="log" data-thread-log class="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-soft bg-meadow/40"
      :class="isStaff ? 'px-4 sm:px-5 py-5' : 'px-4 py-4'" aria-live="polite">
      <div v-if="loading" class="py-10 grid place-items-center"><LogoMark animated class="w-9 h-9" /></div>
      <template v-else>
        <slot name="top"></slot>
        <transition-group name="list" tag="div" class="relative" :class="isStaff ? 'space-y-3' : 'space-y-2.5'">
          <!-- !mt-[3px]: inside a run the bubbles sit almost touching, overriding the space between rows -->
          <div v-for="(m, i) in messages" :key="m.id" :class="positions[i] === 'middle' || positions[i] === 'last' ? '!mt-[3px]' : ''">
            <p v-if="m.kind === 'event'" class="mx-auto w-fit max-w-[92%] text-center text-[11px] leading-snug text-slate-500 bg-white/80 ring-1 ring-ink-100 rounded-xl px-3 py-1.5" :title="formatDateTime(m.created_at)">
              {{ m.body }} <span class="text-slate-400">· {{ timeAgo(m.created_at) }}</span>
            </p>
            <MessageBubble v-else :message="m" :variant="variant" :position="positions[i]"
              @reply="startReply" @edit="startEdit" @remove="remove" @jump="jumpTo" />
          </div>
        </transition-group>
      </template>
    </div>

    <MessageComposer ref="composer" v-model="text" :reply-to="replyTo" :editing="editing" :sending="sending"
      :placeholder="placeholder" :hint="hint" :error="localError || error"
      :enter-to-send="enterToSend" :icon-button="iconButton"
      @submit="submit" @cancel="cancelMode" />
  </div>
  `,
};

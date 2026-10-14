import LogoMark from './LogoMark.js?v=168';

// The box a message is written in. It grows with what is typed — one line to start with, taller as
// the message does, up to MAX_HEIGHT and then it scrolls — and it is also where a reply or an edit is
// set up: a bar above it names the message being answered, or says the one being edited is loaded.

const MAX_HEIGHT = 220; // px: about ten lines before it scrolls

export default {
  name: 'MessageComposer',
  components: { LogoMark },
  props: {
    modelValue: { type: String, default: '' },
    replyTo: { type: Object, default: null },   // the message being answered
    editing: { type: Object, default: null },   // the message being edited
    sending: Boolean,
    placeholder: { type: String, default: '' },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },
    // true: Enter sends and Shift+Enter makes a new line. false: Enter makes a new line and
    // Ctrl/Cmd+Enter sends (the staff inbox, where replies run longer).
    enterToSend: Boolean,
    // The send button is a labelled button (staff) or just an icon (the narrow chat panel).
    iconButton: Boolean,
  },
  emits: ['update:modelValue', 'submit', 'cancel'],
  computed: {
    barName() {
      return this.replyTo.mine ? this.$t('msg.you') : this.replyTo.sender_name;
    },
    barPreview() {
      const m = this.editing || this.replyTo;
      return m ? m.body.replace(/\s+/g, ' ') : '';
    },
    canSend() {
      return !this.sending && !!this.modelValue.trim();
    },
    // The hint as runs of plain text and keys: "[[Ctrl]] + [[Enter]] to send" becomes
    // [key Ctrl] [text " + "] [key Enter] [text " to send"], so the keys can be drawn as keycaps.
    hintParts() {
      return this.hint.split(/(\[\[[^\]]+\]\])/).filter(Boolean).map((s) =>
        s.startsWith('[[') ? { key: s.slice(2, -2) } : { text: s });
    },
  },
  watch: {
    // Cleared after sending, filled for an edit: either way the height has to follow
    modelValue() {
      this.$nextTick(this.resize);
    },
  },
  mounted() {
    this.resize();
    // The box can be mounted before it has a layout (inside something still opening, or in a
    // hidden pane), where scrollHeight reads 0 and the measurement is meaningless. Measure again
    // once it has a width — and whenever that width changes, since wrapping changes the height.
    // Only width is compared, so the height this sets can't trigger it again.
    const el = this.$refs.box;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.lastWidth = el.clientWidth;
      this.observer = new ResizeObserver(() => {
        if (el.clientWidth !== this.lastWidth) {
          this.lastWidth = el.clientWidth;
          this.resize();
        }
      });
      this.observer.observe(el);
    }
  },
  beforeUnmount() {
    if (this.observer) this.observer.disconnect();
  },
  methods: {
    focus() {
      const el = this.$refs.box;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    },
    resize() {
      const el = this.$refs.box;
      if (!el || !el.clientWidth) return; // no layout yet: nothing to measure
      el.style.height = 'auto';
      // scrollHeight leaves out the border, and the box is border-box
      const wanted = el.scrollHeight + (el.offsetHeight - el.clientHeight);
      el.style.height = Math.min(wanted, MAX_HEIGHT) + 'px';
      el.style.overflowY = wanted > MAX_HEIGHT ? 'auto' : 'hidden';
    },
    onInput(e) {
      this.$emit('update:modelValue', e.target.value);
      this.resize();
    },
    onKeydown(e) {
      if (e.key === 'Escape' && (this.replyTo || this.editing)) {
        e.preventDefault();
        this.$emit('cancel');
        return;
      }
      if (e.key !== 'Enter' || e.isComposing) return;
      const send = this.enterToSend ? !e.shiftKey : (e.ctrlKey || e.metaKey);
      if (send) {
        e.preventDefault();
        if (this.canSend) this.$emit('submit');
      }
    },
  },
  template: `
  <form @submit.prevent="canSend && $emit('submit')" class="shrink-0 border-t border-slate-100 bg-white p-3" :class="iconButton ? '' : 'sm:p-4'">
    <p v-if="error" class="mb-2 text-sm text-red-600" role="alert">{{ error }}</p>

    <!-- what this message is for: answering one, or changing one -->
    <transition name="expand">
      <div v-if="replyTo || editing" class="mb-2 flex items-start gap-2 rounded-xl bg-brand-50 ring-1 ring-brand-100 border-l-4 border-brand-600 pl-3 pr-1.5 py-1.5">
        <svg v-if="editing" class="w-4 h-4 mt-0.5 shrink-0 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        <svg v-else class="w-4 h-4 mt-0.5 shrink-0 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-bold text-brand-700">{{ editing ? $t('msg.editing') : (replyTo.mine ? $t('msg.replyingToSelf') : $t('msg.replyingTo', { name: barName })) }}</p>
          <p class="text-xs text-slate-500 truncate">{{ barPreview }}</p>
        </div>
        <button type="button" @click="$emit('cancel')" :aria-label="$t('msg.cancel')"
          class="shrink-0 w-6 h-6 rounded-full grid place-items-center text-slate-400 hover:bg-white hover:text-slate-700 transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </transition>

    <div class="flex items-end gap-2">
      <label for="msg-compose" class="sr-only">{{ $t('msg.message') }}</label>
      <textarea id="msg-compose" ref="box" :value="modelValue" @input="onInput" @keydown="onKeydown" rows="1" maxlength="2000"
        :placeholder="placeholder"
        class="flex-1 min-w-0 min-h-[2.75rem] resize-none overflow-hidden rounded-xl border border-slate-300 px-3.5 py-[0.7rem] text-sm leading-5 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"></textarea>
      <button v-if="iconButton" type="submit" :disabled="!canSend" :aria-label="editing ? $t('msg.save') : $t('msg.send')"
        class="shrink-0 w-11 h-11 rounded-xl bg-brand-600 text-white grid place-items-center hover:bg-brand-700 disabled:opacity-50 transition">
        <LogoMark v-if="sending" animated color="currentColor" class="w-5 h-5" />
        <svg v-else-if="editing" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>
      </button>
      <button v-else type="submit" :disabled="!canSend"
        class="shrink-0 inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
        <LogoMark v-if="sending" animated color="currentColor" class="w-5 h-5" />
        {{ sending ? $t('msg.sending') : (editing ? $t('msg.save') : $t('msg.send')) }}
      </button>
    </div>
    <p v-if="hint" class="mt-1.5 text-[11px] leading-6 text-slate-400">
      <template v-for="(p, i) in hintParts" :key="i">
        <kbd v-if="p.key"
          class="inline-block align-baseline px-1.5 py-[3px] rounded-md border border-slate-300 border-b-[3px] bg-slate-50 font-mono text-[10px] font-semibold leading-none text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.06)]">{{ p.key }}</kbd>
        <template v-else>{{ p.text }}</template>
      </template>
    </p>
  </form>
  `,
};

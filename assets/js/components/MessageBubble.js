import { timeAgo, formatDateTime } from '../util.js?v=168';

// One message in a thread, for both sides of the conversation (the staff inbox and the applicant's
// chat panel use it identically). It shows what the message says, the message it replies to, and
// "edited" — which opens the version it started as — and lets the reader reply to it, or, if it is
// theirs, edit or remove it.
//
// Reply: the arrow beside the bubble, the menu, or — on a touch screen — dragging the message toward the
// middle of the screen, like Messenger: your own messages (on the right) swipe left, the other person's
// (on the left) swipe right. A drag only counts when it is clearly horizontal, so scrolling the thread
// never triggers it, and the row sets touch-action: pan-y so the browser leaves sideways movement
// to us.

const SWIPE_COMMIT = 56;   // px dragged before letting go replies
const SWIPE_MAX = 84;      // how far the row follows the finger

export default {
  name: 'MessageBubble',
  props: {
    message: { type: Object, required: true },
    // 'staff': the office's messages sit on the right, whoever on the office wrote them.
    // 'applicant': your own messages sit on the right.
    variant: { type: String, default: 'applicant' },
    // Its place in a run of messages from the same person (MessageThread works it out):
    // 'single' | 'first' | 'middle' | 'last'. A run shows one name, the bubbles join up, and the
    // time comes once, after the last.
    position: { type: String, default: 'single' },
  },
  emits: ['reply', 'edit', 'remove', 'jump'],
  data() {
    return {
      menuOpen: false,
      menuUp: false,
      confirmingRemove: false,
      showOriginal: false,
      dx: 0,
      dragging: false,
    };
  },
  computed: {
    m() {
      return this.message;
    },
    right() {
      return this.variant === 'staff' ? this.m.from_office : this.m.mine;
    },
    // Above the bubble: who wrote it. Your own are unlabelled in the applicant's panel, where "you"
    // is obvious; the office has several people writing, so it always says.
    label() {
      if (this.variant === 'staff') return this.m.mine ? this.$t('msg.you') : this.m.sender_name;
      return this.m.mine ? '' : this.m.sender_name;
    },
    startsRun() {
      return this.position === 'single' || this.position === 'first';
    },
    endsRun() {
      return this.position === 'single' || this.position === 'last';
    },
    // The bubble's corners. Its tail side (right for the office/your own, left for the other party)
    // is squared off where it joins the next or previous bubble in the run, and the last one keeps
    // the small tail corner at the bottom.
    shape() {
      const s = this.right ? 'r' : 'l';
      const top = `rounded-t${s}-md`;
      const bottom = `rounded-b${s}-md`;
      return {
        single: 'rounded-2xl ' + bottom,
        first: 'rounded-2xl ' + bottom,
        middle: 'rounded-2xl ' + top + ' ' + bottom,
        last: 'rounded-2xl ' + top + ' ' + bottom,
      }[this.position];
    },
    bubbleColour() {
      return this.right
        ? 'bg-brand-600 text-white'
        : 'bg-white ring-1 ring-brand-100 text-slate-700 shadow-[0_6px_16px_-12px_rgba(16,48,29,0.35)]';
    },
    // The time line sits under the last bubble of a run. A bubble that was edited keeps its line
    // anyway, because "edited" is how the original is reached.
    showMeta() {
      return this.endsRun || this.m.edited;
    },
    progress() {
      return Math.min(1, Math.abs(this.dx) / SWIPE_COMMIT);
    },
  },
  beforeUnmount() {
    this.unlisten();
  },
  methods: {
    timeAgo,
    formatDateTime,

    // ---- the actions menu
    toggleMenu() {
      if (this.menuOpen) return this.closeMenu();
      // Open upward when there isn't room below inside the scrolling thread
      const log = this.$el.closest('[data-thread-log]');
      if (log) {
        const room = log.getBoundingClientRect().bottom - this.$el.getBoundingClientRect().bottom;
        this.menuUp = room < 170;
      }
      this.menuOpen = true;
      this.confirmingRemove = false;
      document.addEventListener('pointerdown', this.onOutside, true);
      document.addEventListener('keydown', this.onKey);
    },
    closeMenu() {
      this.menuOpen = false;
      this.confirmingRemove = false;
      this.unlisten();
    },
    unlisten() {
      document.removeEventListener('pointerdown', this.onOutside, true);
      document.removeEventListener('keydown', this.onKey);
    },
    onOutside(e) {
      const menu = this.$refs.menu;
      const trigger = this.$refs.more;
      if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) this.closeMenu();
    },
    onKey(e) {
      if (e.key === 'Escape') this.closeMenu();
    },
    pick(action) {
      this.closeMenu();
      this.$emit(action, this.m);
    },
    confirmRemove() {
      this.closeMenu();
      this.$emit('remove', this.m);
    },

    // ---- swipe to reply (touch only; a mouse has the buttons)
    onPointerDown(e) {
      if (e.pointerType !== 'touch' || this.m.deleted) return;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.tracking = true;
      this.locked = false;
    },
    onPointerMove(e) {
      if (!this.tracking) return;
      // Toward the middle of the screen: left for a bubble on the right, right for one on the left
      const dir = this.right ? -1 : 1;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      if (!this.locked) {
        // Decide once: a clearly vertical move is a scroll, and a horizontal one the wrong way is
        // not ours either — leave both alone for good.
        if ((Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) || (Math.abs(dx) > 8 && dir * dx < 0)) {
          this.tracking = false;
          return;
        }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        this.locked = true;
        this.dragging = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      }
      // Only toward the middle of the screen, and with some give so it feels like pulling against something
      const pulled = Math.max(0, dir * dx) * 0.7;
      const before = Math.abs(this.dx) >= SWIPE_COMMIT;
      this.dx = dir * Math.min(pulled, SWIPE_MAX);
      if (!before && Math.abs(this.dx) >= SWIPE_COMMIT && navigator.vibrate) navigator.vibrate(8);
    },
    onPointerUp() {
      if (this.dragging && Math.abs(this.dx) >= SWIPE_COMMIT) this.$emit('reply', this.m);
      this.endDrag();
    },
    endDrag() {
      this.tracking = false;
      this.locked = false;
      this.dragging = false;
      this.dx = 0;
    },
  },
  template: `
  <div :data-mid="m.id" class="relative rounded-2xl" style="touch-action: pan-y"
    @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="endDrag">

    <!-- what dragging reveals: a reply arrow that grows until it is far enough to count -->
    <span v-if="dragging" aria-hidden="true"
      class="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center"
      :class="right ? 'right-2' : 'left-2'"
      :style="{ opacity: progress, transform: 'translateY(-50%) scale(' + (0.6 + 0.4 * progress) + ')' }">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
    </span>

    <div class="group/row flex flex-col" :class="right ? 'items-end' : 'items-start'"
      :style="{ transform: dx ? 'translateX(' + dx + 'px)' : null, transition: dragging ? 'none' : 'transform .2s cubic-bezier(.2,.7,.2,1)' }">

      <span v-if="label && startsRun" class="px-1 mb-0.5 text-[11px] font-semibold text-slate-500">{{ label }}</span>

      <div class="flex items-end gap-1.5 max-w-[88%]" :class="right ? 'flex-row-reverse' : ''">

        <!-- removed: the row stays so the thread and any replies to it still make sense -->
        <div v-if="m.deleted"
          class="px-3.5 py-2 text-sm italic ring-1 ring-slate-200 text-slate-400 inline-flex items-center gap-1.5 whitespace-nowrap" :class="shape">
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>
          {{ $t('msg.removed') }}
        </div>

        <template v-else>
          <div class="min-w-0 px-3.5 py-2 text-sm break-words" :title="formatDateTime(m.created_at)"
            :class="[shape, bubbleColour]">
            <button v-if="m.reply_to" type="button" @click="$emit('jump', m.reply_to.id)"
              :title="$t('msg.jumpToOriginal')"
              class="block w-full text-left mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-xs transition"
              :class="right ? 'bg-white/15 border-white/70 hover:bg-white/25' : 'bg-brand-50 border-brand-500 hover:bg-brand-100/70'">
              <span class="block font-bold truncate" :class="right ? 'text-white' : 'text-brand-700'">{{ m.reply_to.mine ? $t('msg.you') : m.reply_to.sender_name }}</span>
              <span v-if="m.reply_to.deleted" class="block italic truncate" :class="right ? 'text-white/70' : 'text-slate-400'">{{ $t('msg.removed') }}</span>
              <span v-else class="block truncate" :class="right ? 'text-white/85' : 'text-slate-500'">{{ m.reply_to.body }}</span>
            </button>
            <span class="whitespace-pre-line">{{ m.body }}</span>
          </div>

          <!-- beside the bubble: shown on hover, or always where there is no hover (touch) -->
          <div class="relative shrink-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" @click="$emit('reply', m)" :aria-label="$t('msg.reply')" :title="$t('msg.reply')"
              class="w-7 h-7 rounded-full grid place-items-center text-slate-400 hover:bg-slate-200/70 hover:text-brand-700 transition">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
            </button>
            <button v-if="m.mine" ref="more" type="button" @click="toggleMenu" :aria-expanded="menuOpen ? 'true' : 'false'" aria-haspopup="menu"
              :aria-label="$t('msg.more')" :title="$t('msg.more')"
              class="w-7 h-7 rounded-full grid place-items-center text-slate-400 hover:bg-slate-200/70 hover:text-ink-700 transition">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>

            <transition name="pop">
              <div v-if="menuOpen" ref="menu" role="menu"
                class="absolute z-30 w-44 rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_18px_40px_-12px_rgba(16,48,29,0.35)] p-1.5"
                :class="[menuUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5', right ? 'right-0' : 'left-0']">
                <template v-if="!confirmingRemove">
                  <button type="button" role="menuitem" @click="pick('reply')"
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-brand-50 transition">
                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                    {{ $t('msg.reply') }}
                  </button>
                  <button type="button" role="menuitem" @click="pick('edit')"
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-brand-50 transition">
                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                    {{ $t('msg.edit') }}
                  </button>
                  <button type="button" role="menuitem" @click="confirmingRemove = true"
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 14h10l1-14"/></svg>
                    {{ $t('msg.remove') }}
                  </button>
                </template>
                <div v-else class="p-1.5">
                  <p class="text-sm font-semibold text-ink-700">{{ $t('msg.removeTitle') }}</p>
                  <p class="mt-0.5 text-xs text-slate-500 leading-snug">{{ $t('msg.removeBody') }}</p>
                  <div class="mt-2.5 flex gap-1.5">
                    <button type="button" @click="confirmingRemove = false"
                      class="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 transition">{{ $t('msg.cancel') }}</button>
                    <button type="button" @click="confirmRemove"
                      class="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition">{{ $t('msg.remove') }}</button>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </template>
      </div>

      <!-- when, and — if it was changed — a way to see what it said before -->
      <span v-if="showMeta" class="px-1 mt-0.5 text-[10px] text-slate-400">
        <span v-if="endsRun" :title="formatDateTime(m.created_at)">{{ timeAgo(m.created_at) }}</span>
        <template v-if="m.edited">
          <template v-if="endsRun">·</template>
          <button type="button" @click="showOriginal = !showOriginal" :aria-expanded="showOriginal ? 'true' : 'false'"
            :title="$t('msg.seeOriginal') + ' · ' + formatDateTime(m.edited_at)"
            class="font-semibold underline decoration-dotted underline-offset-2 hover:text-brand-700 transition">{{ $t('msg.edited') }}</button>
        </template>
      </span>
      <transition name="expand">
        <div v-if="m.edited && showOriginal" class="mt-1 max-w-[85%] rounded-xl bg-white/80 ring-1 ring-slate-200 px-3 py-2 text-xs">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ $t('msg.original') }}</p>
          <p class="mt-0.5 whitespace-pre-line break-words text-slate-600">{{ m.original_body }}</p>
        </div>
      </transition>
    </div>
  </div>
  `,
};

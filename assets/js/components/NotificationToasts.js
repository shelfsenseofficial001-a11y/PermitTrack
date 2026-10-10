// Toasts for notifications you haven't caught up on: the ones waiting when a page loads, and the
// ones that arrive while you're on it. They drop in under the bell they belong to, clear of Gibs in
// the bottom right, and each is the same item the bell and the Notifications page show — clicking
// it opens that permit.

import NotificationIcon from './NotificationIcon.js?v=129';
import { notificationTone } from '../util.js?v=129';

const DISMISS_MS = 7000;

// One toast, so each can run its own countdown. The countdown pauses while the pointer is over it
// or while it has keyboard focus, so a toast can't vanish mid-read or mid-click.
const Toast = {
  name: 'NotificationToast',
  components: { NotificationIcon },
  props: { item: { type: Object, required: true } },
  emits: ['open', 'close'],
  computed: {
    tone() {
      return notificationTone(this.item);
    },
  },
  data() {
    return { paused: false, timer: null };
  },
  mounted() {
    this.start();
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    start() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.$emit('close', this.item.id), DISMISS_MS);
    },
    pause() {
      this.paused = true;
      clearTimeout(this.timer);
    },
    resume() {
      this.paused = false;
      this.start();
    },
  },
  template: `
  <div class="toast-in pointer-events-auto relative w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white ring-1 ring-brand-100 shadow-[0_18px_40px_-18px_rgba(7,24,14,0.45)] overflow-hidden"
    role="status" @mouseenter="pause" @mouseleave="resume" @focusin="pause" @focusout="resume">
    <button type="button" @click="$emit('open', item)" class="group w-full text-left flex gap-3 pl-4 pr-9 py-3.5 transition hover:bg-meadow/60 focus:outline-none focus-visible:bg-meadow">
      <NotificationIcon :item="item" class="mt-0.5" />
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-ink-700 leading-snug">{{ item.title }}</span>
        <span class="block text-[13px] text-slate-600 leading-snug mt-0.5 line-clamp-2">{{ item.body }}</span>
        <span class="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-brand-700">
          Open permit
          <svg class="w-3 h-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </span>
    </button>

    <button type="button" @click="$emit('close', item.id)" aria-label="Dismiss notification"
      class="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>

    <!-- How long it has left. Freezes with the countdown while you're reading it. -->
    <span class="absolute bottom-0 left-0 h-[3px] toast-timer" :class="[tone.dot, paused ? 'toast-timer-paused' : '']"
      :style="{ animationDuration: ${DISMISS_MS} + 'ms' }" aria-hidden="true"></span>
  </div>
  `,
};

export default {
  name: 'NotificationToasts',
  components: { Toast },
  props: { items: { type: Array, default: () => [] } },
  emits: ['open', 'close'],
  template: `
  <!-- Below the sticky header, and click-through except on the toasts themselves -->
  <div class="fixed top-20 right-4 z-[60] flex flex-col items-end gap-2.5 pointer-events-none">
    <Toast v-for="n in items" :key="n.id" :item="n" @open="$emit('open', $event)" @close="$emit('close', $event)" />
  </div>
  `,
};

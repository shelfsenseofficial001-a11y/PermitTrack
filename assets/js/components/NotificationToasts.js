// Toasts for notifications you haven't caught up on: the ones waiting when a page loads, and the
// ones that arrive while you're on it. They drop in under the bell they belong to, clear of Gibs in
// the bottom right, and each is the same item the bell and the Notifications page show — clicking
// it opens that permit.

import NotificationIcon from './NotificationIcon.js?v=168';
import { notificationTone } from '../util.js?v=168';

const DISMISS_MS = 7000;

// Swiping a toast away on a touch screen: dragged left past this (or a third of its width) it goes.
const SWIPE_DISMISS_PX = 80;

// One toast, so each can run its own countdown. The countdown pauses while the pointer is over it
// or while it has keyboard focus, so a toast can't vanish mid-read or mid-click.
//
// On a touch screen it can also be swiped to the left to dismiss. The gesture lives on a wrapper
// around the toast, not the toast itself: the toast's entrance animation holds its final transform
// and opacity (animation-fill-mode: both), which would override anything set on it directly.
// A drag only counts once it is clearly horizontal, so scrolling the page never dismisses one,
// and the wrapper sets touch-action: pan-y so the browser leaves sideways movement to us.
const Toast = {
  name: 'NotificationToast',
  components: { NotificationIcon },
  props: { item: { type: Object, required: true } },
  emits: ['open', 'close'],
  computed: {
    tone() {
      return notificationTone(this.item);
    },
    // How far through the swipe it is, 0 to 1: the toast fades as it goes
    progress() {
      return Math.min(1, Math.max(0, -this.dx / (this.width || 320)));
    },
  },
  data() {
    return { paused: false, timer: null, dx: 0, dragging: false, leaving: false, width: 0 };
  },
  mounted() {
    this.start();
  },
  beforeUnmount() {
    clearTimeout(this.timer);
    clearTimeout(this.leaveTimer);
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
      if (this.dragging || this.leaving) return;
      this.paused = false;
      this.start();
    },

    onPointerDown(e) {
      if (e.pointerType !== 'touch' || this.leaving) return;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.tracking = true;
      this.locked = false;
      this.width = this.$el.getBoundingClientRect().width;
    },
    onPointerMove(e) {
      if (!this.tracking) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      if (!this.locked) {
        // Decide once: a clearly vertical move is the page scrolling, so leave it alone for good.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          this.tracking = false;
          return;
        }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        this.locked = true;
        this.dragging = true;
        this.pause(); // it can't expire under the finger
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      }
      // Follows the finger to the left; to the right it only gives a little, like pulling on a band
      this.dx = dx < 0 ? dx : Math.min(dx * 0.25, 16);
    },
    onPointerUp() {
      if (!this.dragging) { this.tracking = false; return; }
      // The drag ends with a click on whatever was under the finger; that is not a tap on the toast
      this.swallowClick = true;
      setTimeout(() => { this.swallowClick = false; }, 0);
      if (this.dx <= -Math.min(SWIPE_DISMISS_PX, this.width * 0.35)) {
        this.dismissLeft();
      } else {
        this.snapBack();
      }
    },
    onPointerCancel() {
      if (this.dragging) this.snapBack(); else this.tracking = false;
    },
    snapBack() {
      this.tracking = false;
      this.locked = false;
      this.dragging = false;
      this.dx = 0;
      this.resume();
    },
    // Slides the rest of the way off to the left, then goes
    dismissLeft() {
      this.tracking = false;
      this.dragging = false;
      this.leaving = true;
      this.dx = -(this.width + 40);
      this.leaveTimer = setTimeout(() => this.$emit('close', this.item.id), 180);
    },
    onClickCapture(e) {
      if (this.swallowClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
  },
  template: `
  <div class="pointer-events-auto" style="touch-action: pan-y"
    :style="{ transform: dx ? 'translateX(' + dx + 'px)' : null, opacity: dx ? 1 - progress * 0.85 : null, transition: dragging ? 'none' : 'transform .18s ease-out, opacity .18s ease-out' }"
    @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerCancel" @click.capture="onClickCapture">
  <div class="toast-in relative w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white ring-1 ring-brand-100 shadow-[0_18px_40px_-18px_rgba(7,24,14,0.45)] overflow-hidden"
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
  <div class="fixed top-20 right-4 z-[80] flex flex-col items-end gap-2.5 pointer-events-none">
    <Toast v-for="n in items" :key="n.id" :item="n" @open="$emit('open', $event)" @close="$emit('close', $event)" />
  </div>
  `,
};

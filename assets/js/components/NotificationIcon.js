import { notificationTone } from '../util.js?v=129';

// The icon tile beside a notification, in the tone the server gave it. Shared by the toast and
// the Notifications page so the two can never disagree about what an event looks like.
//
// Decorative: the headline next to it already says what happened, so it is hidden from screen
// readers rather than given a label that would be read out twice.
export default {
  name: 'NotificationIcon',
  props: {
    item: { type: Object, required: true },
    size: { type: String, default: 'md' },   // 'md' in lists, 'sm' where space is tight
    // The bell's dropdown is a dark panel, where a solid light tile would glare
    dark: { type: Boolean, default: false },
  },
  computed: {
    tone() {
      const t = notificationTone(this.item);
      return { ...t, wrap: this.dark ? t.dark : t.wrap };
    },
    boxClass() {
      return this.size === 'sm' ? 'w-7 h-7 rounded-full' : 'w-9 h-9 rounded-xl';
    },
    iconClass() {
      return this.size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    },
  },
  template: `
  <span class="shrink-0 flex items-center justify-center" :class="[boxClass, tone.wrap]" aria-hidden="true">
    <svg v-if="tone.icon === 'alert'" :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
    <svg v-else-if="tone.icon === 'cross'" :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>
    <svg v-else-if="tone.icon === 'check'" :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    <svg v-else-if="tone.icon === 'chat'" :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>
    <svg v-else-if="tone.icon === 'arrow'" :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    <svg v-else :class="iconClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></svg>
  </span>
  `,
};

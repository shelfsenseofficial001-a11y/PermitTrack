import { openApplicationThread } from '../store/ui.js?v=119';
import { timeAgo } from '../util.js?v=119';

// Where "Activity & Messages" used to be on a permit. The conversation itself lives in Messages
// now (the chat panel's thread for this application); this shows the latest thing that happened
// and opens that thread.
export default {
  name: 'ThreadCard',
  props: {
    applicationId: { type: [Number, String], required: true },
    activity: { type: Array, default: () => [] },
    tone: { type: String, default: 'brand' }, // the border colour of the card it sits beside
  },
  computed: {
    latest() {
      return this.activity.length ? this.activity[this.activity.length - 1] : null;
    },
    messageCount() {
      return this.activity.filter((a) => a.type === 'message').length;
    },
    cardClass() {
      return this.tone === 'slate' ? 'border-slate-200 p-6' : 'border-brand-100 p-5';
    },
  },
  methods: {
    timeAgo,
    open() {
      openApplicationThread(this.applicationId);
    },
  },
  template: `
  <div class="rounded-xl border bg-white flex flex-col" :class="cardClass">
    <div class="flex items-center gap-3">
      <span class="shrink-0 w-10 h-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 text-brand-700 grid place-items-center">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12z"/></svg>
      </span>
      <div class="min-w-0">
        <h3 class="font-bold text-ink-700">Messages</h3>
        <p class="text-xs text-slate-500">{{ activity.length }} update{{ activity.length === 1 ? '' : 's' }}<template v-if="messageCount"> · {{ messageCount }} message{{ messageCount === 1 ? '' : 's' }}</template></p>
      </div>
    </div>
    <p class="mt-4 text-sm text-slate-600 leading-relaxed">
      This permit's updates and your conversation with the offices handling it are in <span class="font-semibold text-ink-700">Messages</span>. They can reply to you there.
    </p>
    <div v-if="latest" class="mt-4 rounded-lg bg-slate-50 ring-1 ring-slate-100 px-3 py-2.5">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Latest · {{ timeAgo(latest.created_at) }}</p>
      <p class="mt-0.5 text-sm text-slate-700 line-clamp-2"><span v-if="latest.type === 'message'" class="font-semibold">{{ latest.sender_name }}: </span>{{ latest.body }}</p>
    </div>
    <div class="mt-auto pt-5">
      <button type="button" @click="open"
        class="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-700 shadow-[0_10px_22px_-12px_rgba(31,122,58,0.8)] transition">
        Open in Messages
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  </div>
  `,
};

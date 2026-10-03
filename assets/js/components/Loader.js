// The one loading indicator used everywhere, so waiting always looks like PermitTrack:
// the mark inside a sweeping brand-green arc, with a line of copy that fits what is loading.
//
//   variant="overlay"  covers a card while a form is submitting (the sign-in screens)
//   variant="panel"    stands in for page content that hasn't arrived yet
//   variant="inline"   a compact row inside a menu or an expanded panel
//
// Messages rotate on the longer waits so a slow connection reads as progress. They are
// flavour, not real status — nothing here claims to know how far along the request is.
const MESSAGES = {
  login: ['Checking your credentials…', 'Dusting off your permits…', 'Almost in…'],
  staff: ['Verifying staff credentials…', 'Unlocking the review queue…', 'Almost there…'],
  register: ['Setting up your account…', 'Reserving your spot at City Hall…', 'Nearly done…'],
  verify: ['Checking your code…', 'Matching it against ours…', 'One moment…'],
  dashboard: ['Rounding up your permits…', 'Checking what moved…'],
  permits: ['Gathering your permits…', 'Sorting newest first…'],
  notifications: ['Catching up on your updates…', 'Sorting by when they landed…'],
  detail: ['Opening your permit…', 'Fetching documents and messages…'],
  documents: ['Fetching documents and activity…'],
  queue: ['Loading the queue…', 'Sorting by what needs you first…'],
  review: ['Opening the application…', 'Pulling up the documents…'],
  business: ['Loading your businesses…'],
  residency: ['Loading your verification…'],
  admin: ['Loading…', 'Gathering accounts and settings…'],
  accounts: ['Finding your accounts…'],
  generic: ['Loading…'],
};

export default {
  name: 'Loader',
  props: {
    variant: { type: String, default: 'panel' }, // overlay | panel | inline
    kind: { type: String, default: 'generic' },
    // Shown while an overlay is up; ignored otherwise
    show: { type: Boolean, default: true },
    // Overrides the message set entirely
    label: { type: String, default: '' },
  },
  data() {
    return { index: 0 };
  },
  computed: {
    messages() {
      if (this.label) return [this.label];
      return MESSAGES[this.kind] || MESSAGES.generic;
    },
    message() {
      return this.messages[Math.min(this.index, this.messages.length - 1)];
    },
    visible() {
      return this.variant === 'overlay' ? this.show : true;
    },
  },
  watch: {
    visible: { immediate: true, handler(on) { on ? this.start() : this.stop(); } },
  },
  beforeUnmount() {
    this.stop();
  },
  methods: {
    start() {
      this.stop();
      this.index = 0;
      if (this.messages.length < 2) return;
      // Advance through the messages, then rest on the last one
      this.timer = setInterval(() => {
        if (this.index >= this.messages.length - 1) return this.stop();
        this.index += 1;
      }, 1500);
    },
    stop() {
      clearInterval(this.timer);
      this.timer = null;
    },
  },
  template: `
  <!-- overlay: sits over the card it belongs to (that card needs position:relative) -->
  <transition v-if="variant === 'overlay'" name="fade">
    <div v-if="show" class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-[22px] bg-white/85 backdrop-blur-sm"
      role="status" aria-live="polite">
      <span class="relative w-20 h-20 grid place-items-center">
        <svg class="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#dcefd3" stroke-width="4" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1f7a3a" stroke-width="4" stroke-linecap="round" stroke-dasharray="60 166" class="pt-ring-spin" />
        </svg>
        <img src="assets/images/PermitTrackIcon.png?v=114" alt="" class="w-10 h-10 object-contain" />
      </span>
      <span class="text-center px-6">
        <transition name="swap" mode="out-in"><span :key="message" class="block text-sm font-semibold text-ink-700">{{ message }}</span></transition>
        <span class="block text-xs text-slate-400 mt-1">Hang tight — this only takes a moment.</span>
      </span>
    </div>
  </transition>

  <!-- panel: a placeholder card where the content will appear -->
  <div v-else-if="variant === 'panel'" class="bg-white rounded-2xl border border-brand-100 px-6 py-12 flex flex-col items-center justify-center gap-4"
    role="status" aria-live="polite">
    <span class="relative w-16 h-16 grid place-items-center">
      <svg class="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#dcefd3" stroke-width="4" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#1f7a3a" stroke-width="4" stroke-linecap="round" stroke-dasharray="46 130" class="pt-ring-spin" />
      </svg>
      <img src="assets/images/PermitTrackIcon.png?v=114" alt="" class="w-8 h-8 object-contain" />
    </span>
    <transition name="swap" mode="out-in"><p :key="message" class="text-sm font-semibold text-ink-700">{{ message }}</p></transition>
  </div>

  <!-- inline: a quiet row inside a menu or an already-open panel -->
  <div v-else class="flex items-center gap-2.5 px-1 py-2" role="status" aria-live="polite">
    <svg class="w-4 h-4 -rotate-90 shrink-0" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-25" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="13 37" class="pt-ring-spin" />
    </svg>
    <span class="text-xs font-medium">{{ message }}</span>
  </div>
  `,
};

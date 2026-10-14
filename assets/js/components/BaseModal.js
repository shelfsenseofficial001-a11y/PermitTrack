// The frame every dialog in the app shares: the brand gradient hairline, an icon tile and
// title in the header, a body, and a footer bar for actions — the same card-and-footer shape
// as the Profile page, so dialogs read as part of the site rather than a browser popup.
export default {
  name: 'BaseModal',
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    // Small label above the title, e.g. "Account security"
    eyebrow: { type: String, default: '' },
    // 'brand' for routine dialogs, 'sun' for ones that need attention
    tone: { type: String, default: 'brand' },
    // False for dialogs the user must complete (no close button, backdrop or Escape)
    dismissible: { type: Boolean, default: true },
    // 'md' is the usual narrow dialog; 'xl' is for ones that hold a list (the all-permits dialog)
    size: { type: String, default: 'md' },
    // Stacking override for a modal that must sit above another already-raised layer — e.g. the
    // chat widget's own "New chat" confirmation, which has to clear the chat panel itself
    // (see ChatWidget.js). Every other caller keeps the default, which matches NotificationToasts'
    // old shared value.
    zIndex: { type: String, default: '60' },
  },
  emits: ['close'],
  data() {
    return { titleId: 'modal-title-' + Math.random().toString(36).slice(2, 8) };
  },
  mounted() {
    // Something opened over the dialog (the demo-accounts panel) takes Escape first: it marks the
    // event handled, and the dialog leaves it for that to close.
    this.onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) this.dismiss(); };
    document.addEventListener('keydown', this.onKey);
    // The page scrolls on <html> (index.html sets its overflow), so that is what gets locked.
    // Locking <body> instead leaves the page scrolling and unsticks the sticky header.
    document.documentElement.style.overflow = 'hidden';
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
    document.documentElement.style.overflow = '';
  },
  methods: {
    dismiss() {
      if (this.dismissible) this.$emit('close');
    },
  },
  template: `
  <transition appear enter-from-class="opacity-0" enter-active-class="transition-opacity duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0">
    <div class="font-inter fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-ink-900/55 backdrop-blur-[3px]" :class="'z-[' + zIndex + ']'" @click.self="dismiss">
      <transition appear enter-from-class="opacity-0 translate-y-8 scale-[0.88]" enter-active-class="transition duration-500 ease-[cubic-bezier(.34,1.45,.64,1)] motion-reduce:transition-none motion-reduce:duration-0">
        <!-- The frame that animates in, around the dialog proper. The dialog clips to its rounded
             corners (overflow-hidden), so anything meant to hang off its edge — the demo-accounts
             tab, see the "edge" slot — has to sit out here, beside it, or it would be cut off. -->
        <div class="relative w-full" :class="size === 'xl' ? 'max-w-3xl' : 'max-w-[440px]'">
        <div class="relative w-full max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white overflow-hidden ring-1 ring-black/5 shadow-[0_40px_90px_-24px_rgba(7,24,14,0.55)]"
          role="dialog" aria-modal="true" :aria-labelledby="titleId">

          <div class="pt-gradient-wide h-1.5 shrink-0" aria-hidden="true"></div>

          <!-- Header -->
          <div class="flex items-start gap-4 px-7 pt-6 pb-5 shrink-0">
            <span class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
              :class="tone === 'sun' ? 'bg-sun-300 text-ink-700' : 'bg-ink-700 text-sun-300'">
              <slot name="icon"></slot>
            </span>
            <div class="min-w-0 flex-1 pt-0.5">
              <div v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-wider mb-0.5"
                :class="tone === 'sun' ? 'text-sun-700' : 'text-brand-700'">{{ eyebrow }}</div>
              <h2 :id="titleId" class="text-xl font-bold tracking-tight text-ink-700 leading-snug">{{ title }}</h2>
              <p v-if="subtitle" class="text-sm text-slate-500 mt-1 leading-relaxed">{{ subtitle }}</p>
            </div>
            <button v-if="dismissible" type="button" @click="dismiss" aria-label="Close"
              class="-mr-2 -mt-1 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 transition shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Body scrolls on short screens; header and footer stay put -->
          <div class="px-7 pb-6 overflow-y-auto scroll-soft">
            <slot></slot>
          </div>

          <div v-if="$slots.footer" class="flex flex-wrap items-center gap-3 px-7 py-4 border-t border-brand-100 bg-slate-50/70 shrink-0">
            <slot name="footer"></slot>
          </div>
        </div>
        <slot name="edge"></slot>
        </div>
      </transition>
    </div>
  </transition>
  `,
};

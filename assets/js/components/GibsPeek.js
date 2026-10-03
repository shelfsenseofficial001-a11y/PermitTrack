import GibsMascot from './GibsMascot.js?v=114';

// Gibs P. sneaking a look from behind the right edge of the window every so often, offering help.
// The canvas's right edge is flush with the window edge, so the window itself is the "wall" he
// peeks around. Clicking him opens the chat; he stays tucked away while the chat is open.

const LINES = ['Psst… need help?', 'Psst! Over here!', "Stuck? I don't bite.", 'I know permit stuff. Ask me!', 'Permit questions? I got you.'];
const rand = (min, max) => min + Math.random() * (max - min);

export default {
  name: 'GibsPeek',
  components: { GibsMascot },
  props: {
    suppressed: { type: Boolean, default: false }, // true while the chat panel is open
    liftForFab: { type: Boolean, default: false },
  },
  emits: ['open'],
  data() {
    const small = window.innerWidth < 768;
    return {
      out: false,
      hovered: false,
      bubble: '',
      showBubble: false,
      width: small ? 76 : 96,
      height: small ? 180 : 228,
      // With reduced motion he peeks out once and stays put instead of sliding in and out.
      calm: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    };
  },
  // Frequent on purpose — so first-time visitors notice him and learn the chat exists.
  mounted() {
    this.schedule(1500);
  },
  beforeUnmount() {
    clearTimeout(this.timer);
    clearTimeout(this.bubbleTimer);
  },
  watch: {
    suppressed(open) {
      if (open) {
        clearTimeout(this.timer);
        this.hide();
      } else {
        this.schedule(this.calm ? 1500 : 4000);
      }
    },
  },
  methods: {
    schedule(ms) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.peekOut(), ms);
    },
    peekOut() {
      if (this.suppressed) return;
      this.out = true;
      this.bubble = LINES[Math.floor(Math.random() * LINES.length)];
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => { if (this.out) this.showBubble = true; }, 1100);
      if (this.calm) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.maybeHide(), rand(5000, 8000));
    },
    // He won't duck away while you're pointing at him.
    maybeHide() {
      if (this.hovered) {
        this.timer = setTimeout(() => this.maybeHide(), 1500);
        return;
      }
      this.hide();
      this.schedule(rand(3500, 7000));
    },
    hide() {
      this.out = false;
      this.showBubble = false;
      clearTimeout(this.bubbleTimer);
    },
  },
  template: `
  <!-- Sits just above the Ask button: its bottom offsets are the button's own plus its height. -->
  <div class="fixed right-0 z-40 select-none pointer-events-none bottom-[calc(8.5rem+env(safe-area-inset-bottom))]"
    :class="liftForFab ? 'md:bottom-[9rem]' : 'md:bottom-[5rem]'"
    :style="{ width: width + 'px', height: height + 'px' }" aria-hidden="true">
    <transition name="pop">
      <div v-if="showBubble && out && !suppressed"
        class="absolute top-10 right-full mr-0.5 whitespace-nowrap rounded-2xl rounded-br-md bg-white border border-brand-100 shadow-[0_10px_24px_-10px_rgba(16,48,29,0.45)] px-3 py-1.5 text-xs font-semibold text-ink-700">
        {{ bubble }}
      </div>
    </transition>
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-pointer"
      :class="out && !suppressed ? 'pointer-events-auto' : 'pointer-events-none'"
      @click="$emit('open')" @mouseenter="hovered = true" @mouseleave="hovered = false">
      <GibsMascot mode="peek" state="idle" :peek="out && !suppressed" :width="width" :height="height" />
    </button>
  </div>
  `,
};

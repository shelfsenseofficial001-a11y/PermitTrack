import { i18n, setLang, LANGUAGES } from '../store/i18n.js?v=168';

// The language choice: a flag and EN / PH. The flags are drawn here rather than typed as emoji —
// Windows draws a flag emoji as two letters, not a flag, and this is mostly used on Windows.
//
// Two shapes: the dropdown for a header (`dark` switches its colours for a light header), and
// `segmented`, two buttons side by side, for places a dropdown would be clipped — the phone menu.

const Flag = {
  name: 'LanguageFlag',
  props: { code: { type: String, required: true } },
  template: `
  <svg v-if="code === 'tl'" viewBox="0 0 24 16" class="block w-full h-full" aria-hidden="true">
    <rect width="24" height="8" fill="#0038a8"/><rect y="8" width="24" height="8" fill="#ce1126"/>
    <path d="M0 0v16l11-8z" fill="#fff"/><circle cx="3.6" cy="8" r="1.7" fill="#fcd116"/>
  </svg>
  <svg v-else viewBox="0 0 24 16" class="block w-full h-full" aria-hidden="true">
    <rect width="24" height="16" fill="#fff"/>
    <g fill="#b22234"><rect width="24" height="2.3"/><rect y="4.6" width="24" height="2.3"/><rect y="9.2" width="24" height="2.3"/><rect y="13.7" width="24" height="2.3"/></g>
    <rect width="10.5" height="9.2" fill="#3c3b6e"/>
    <g fill="#fff"><circle cx="2.2" cy="2" r=".7"/><circle cx="5.2" cy="2" r=".7"/><circle cx="8.2" cy="2" r=".7"/><circle cx="3.7" cy="4.6" r=".7"/><circle cx="6.7" cy="4.6" r=".7"/><circle cx="2.2" cy="7.2" r=".7"/><circle cx="5.2" cy="7.2" r=".7"/><circle cx="8.2" cy="7.2" r=".7"/></g>
  </svg>
  `,
};

export default {
  name: 'LanguageSelect',
  components: { Flag },
  props: {
    dark: { type: Boolean, default: true },
    segmented: Boolean,
  },
  data() {
    return { open: false, languages: LANGUAGES, i18n };
  },
  computed: {
    current() {
      return this.languages.find((l) => l.code === this.i18n.lang) || this.languages[0];
    },
  },
  mounted() {
    this.onDoc = (e) => {
      if (this.open && this.$refs.root && !this.$refs.root.contains(e.target)) this.open = false;
    };
    this.onKey = (e) => { if (e.key === 'Escape') this.open = false; };
    document.addEventListener('click', this.onDoc);
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDoc);
    document.removeEventListener('keydown', this.onKey);
  },
  methods: {
    choose(code) {
      setLang(code);
      this.open = false;
    },
  },
  template: `
  <!-- two buttons, for the phone menu -->
  <div v-if="segmented" class="flex gap-1.5 p-1 rounded-2xl bg-white ring-1 ring-slate-200" role="radiogroup" :aria-label="$t('shell.language')">
    <button v-for="l in languages" :key="l.code" type="button" role="radio" :aria-checked="l.code === i18n.lang ? 'true' : 'false'" @click="choose(l.code)"
      class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition"
      :class="l.code === i18n.lang ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-700 hover:bg-slate-100'">
      <span class="block w-5 h-[14px] rounded-[3px] overflow-hidden ring-1 ring-black/20 shrink-0"><Flag :code="l.code" /></span>
      {{ l.short }}
    </button>
  </div>

  <div v-else ref="root" class="relative">
    <button type="button" @click="open = !open" :aria-expanded="open ? 'true' : 'false'" aria-haspopup="listbox"
      :aria-label="$t('shell.language') + ': ' + current.label"
      class="flex items-center gap-1.5 rounded-full pl-2 pr-2 py-1.5 text-sm font-semibold transition"
      :class="dark ? 'text-white hover:bg-white/10' : 'text-ink-700 hover:bg-ink-700/5'">
      <span class="block w-5 h-[14px] rounded-[3px] overflow-hidden ring-1 ring-black/20 shrink-0"><Flag :code="current.code" /></span>
      <span>{{ current.short }}</span>
      <svg class="w-3.5 h-3.5 transition-transform" :class="[open ? 'rotate-180' : '', dark ? 'text-ink-300' : 'text-slate-400']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <transition name="pop">
      <ul v-if="open" role="listbox" :aria-label="$t('shell.language')"
        class="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border p-1.5 text-sm shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] z-30"
        :class="dark ? 'bg-ink-700 border-white/10' : 'bg-white border-slate-200'">
        <li v-for="l in languages" :key="l.code">
          <button type="button" role="option" :aria-selected="l.code === i18n.lang ? 'true' : 'false'" @click="choose(l.code)"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition"
            :class="[dark ? 'text-ink-100 hover:bg-white/10' : 'text-ink-700 hover:bg-brand-50', l.code === i18n.lang ? (dark ? 'bg-white/10' : 'bg-brand-50') : '']">
            <span class="block w-6 h-4 rounded-[3px] overflow-hidden ring-1 ring-black/20 shrink-0"><Flag :code="l.code" /></span>
            <span class="flex-1 min-w-0">
              <span class="block font-semibold">{{ l.label }}</span>
              <span class="block text-[11px]" :class="dark ? 'text-ink-300' : 'text-slate-400'">{{ l.short }}</span>
            </span>
            <svg v-if="l.code === i18n.lang" class="w-4 h-4 shrink-0" :class="dark ? 'text-sun-300' : 'text-brand-600'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
        </li>
      </ul>
    </transition>
  </div>
  `,
};

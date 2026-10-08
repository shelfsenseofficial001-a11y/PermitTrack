// A select that actually looks like the rest of the app.
//
// A native <select> renders its open list as operating-system chrome: on Windows that is a plain
// white box with a blue highlight, which no CSS can reach. This replaces it with a real listbox.
//
// Replacing a native control means owing back what it gave for free, so this keeps the keyboard
// behaviour people expect: Up/Down move, Home/End jump, Enter or Space picks, Escape cancels and
// returns focus to the button, typing a letter jumps to the next option starting with it, and the
// open list is announced as a listbox with the current option marked selected.
//
// Worth it for a short, fixed list like "why is this document being sent back". Long lists — the
// province and city pickers, which run to dozens of entries and want the browser's own search —
// are better left native.
export default {
  name: 'SelectMenu',
  props: {
    // [{ value, label }]
    options: { type: Array, required: true },
    modelValue: { type: [String, Number], default: '' },
    placeholder: { type: String, default: 'Choose…' },
    // Names the control for screen readers; pair with the visible <label>'s id via labelledby
    labelledby: { type: String, default: '' },
    id: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return { open: false, active: -1, typed: '', typedAt: 0 };
  },
  computed: {
    selected() {
      return this.options.find((o) => o.value === this.modelValue) || null;
    },
    label() {
      return this.selected ? this.selected.label : this.placeholder;
    },
  },
  mounted() {
    this.onDocClick = (e) => {
      if (this.open && this.$el && !this.$el.contains(e.target)) this.open = false;
    };
    document.addEventListener('click', this.onDocClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocClick);
  },
  methods: {
    toggle() {
      this.open ? this.close() : this.openList();
    },
    openList() {
      this.open = true;
      this.active = Math.max(0, this.options.findIndex((o) => o.value === this.modelValue));
      this.$nextTick(() => this.scrollActiveIntoView());
    },
    close(refocus = false) {
      this.open = false;
      if (refocus) this.$nextTick(() => this.$refs.button && this.$refs.button.focus());
    },
    pick(i) {
      const option = this.options[i];
      if (!option) return;
      this.$emit('update:modelValue', option.value);
      this.close(true);
    },
    move(delta) {
      if (!this.open) { this.openList(); return; }
      const last = this.options.length - 1;
      this.active = Math.min(last, Math.max(0, this.active + delta));
      this.scrollActiveIntoView();
    },
    jump(to) {
      if (!this.open) this.openList();
      this.active = to === 'start' ? 0 : this.options.length - 1;
      this.scrollActiveIntoView();
    },
    // Typing letters jumps through the list, the way a native select does
    onKeyChar(e) {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      this.typed = now - this.typedAt > 800 ? e.key : this.typed + e.key;
      this.typedAt = now;
      const i = this.options.findIndex((o) => o.label.toLowerCase().startsWith(this.typed.toLowerCase()));
      if (i >= 0) {
        if (!this.open) this.openList();
        this.active = i;
        this.scrollActiveIntoView();
      }
    },
    scrollActiveIntoView() {
      const list = this.$refs.list;
      const el = list && list.children[this.active];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    },
  },
  template: `
  <div class="relative">
    <button type="button" ref="button" :id="id"
      @click="toggle" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
      @keydown.home.prevent="jump('start')" @keydown.end.prevent="jump('end')"
      @keydown.enter.prevent="open ? pick(active) : openList()"
      @keydown.space.prevent="open ? pick(active) : openList()"
      @keydown.esc="close(true)" @keydown="onKeyChar"
      aria-haspopup="listbox" :aria-expanded="open" :aria-labelledby="labelledby || undefined"
      class="w-full flex items-center justify-between gap-2 text-left bg-white border rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
      :class="open ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-300 hover:border-brand-300'">
      <span :class="selected ? 'text-slate-800 font-medium' : 'text-slate-400'">{{ label }}</span>
      <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform" :class="open ? 'rotate-180' : ''"
           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <transition
      enter-from-class="opacity-0 -translate-y-1" enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0" leave-active-class="transition duration-100 ease-in motion-reduce:transition-none">
      <ul v-if="open" ref="list" role="listbox" :aria-activedescendant="id ? id + '-opt-' + active : undefined"
        class="absolute z-30 left-0 right-0 mt-1.5 max-h-60 overflow-auto rounded-xl bg-white border border-slate-200 shadow-[0_18px_40px_-12px_rgba(16,48,29,0.35)] p-1.5">
        <li v-for="(o, i) in options" :key="o.value" :id="id ? id + '-opt-' + i : undefined"
          role="option" :aria-selected="o.value === modelValue"
          @click="pick(i)" @mousemove="active = i"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
          :class="[
            i === active ? 'bg-[#f3f9e3]' : '',
            o.value === modelValue ? 'font-semibold text-brand-700' : 'text-slate-700'
          ]">
          <svg v-if="o.value === modelValue" class="w-3.5 h-3.5 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          <span v-else class="w-3.5 shrink-0" aria-hidden="true"></span>
          {{ o.label }}
        </li>
      </ul>
    </transition>
  </div>
  `,
};

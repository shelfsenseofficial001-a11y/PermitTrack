// Themed replacement for a plain <input list> + <datalist> barangay picker. A native datalist
// dropdown is unstyled browser chrome (it can't be reskinned) and only offers options once you've
// typed into it — this shows the full list immediately, filters as you type, and looks like the
// rest of the app.
export default {
  name: 'BarangaySelect',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },   // [{ id, name }]
    placeholder: { type: String, default: 'Start typing to search…' },
    invalid: { type: Boolean, default: false },
    inputId: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return { query: this.modelValue, open: false, highlighted: -1 };
  },
  computed: {
    filtered() {
      const q = this.query.trim().toLowerCase();
      const list = !q ? this.options : this.options.filter((b) => b.name.toLowerCase().includes(q));
      return list.slice(0, 200);
    },
  },
  watch: {
    modelValue(v) {
      if (v !== this.query) this.query = v;
    },
  },
  methods: {
    openList() {
      this.open = true;
      this.highlighted = this.filtered.findIndex((b) => b.name === this.modelValue);
    },
    onInput() {
      this.open = true;
      this.highlighted = -1;
      this.$emit('update:modelValue', this.query);
    },
    choose(name) {
      this.query = name;
      this.open = false;
      this.$emit('update:modelValue', name);
    },
    onBlur() {
      // Let a click on an option register before the panel disappears.
      setTimeout(() => { this.open = false; }, 150);
    },
    move(delta) {
      if (!this.open) { this.openList(); return; }
      const max = this.filtered.length - 1;
      if (max < 0) return;
      this.highlighted = Math.min(max, Math.max(0, this.highlighted + delta));
    },
    chooseHighlighted() {
      if (this.open && this.highlighted >= 0 && this.filtered[this.highlighted]) {
        this.choose(this.filtered[this.highlighted].name);
      }
    },
  },
  template: `
  <div class="relative">
    <input :id="inputId" v-model="query" type="text" autocomplete="off" :placeholder="placeholder"
      class="w-full rounded-xl border bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-[#1f7a3a]/15 focus:border-[#1f7a3a] outline-none transition pr-9"
      :class="invalid ? 'border-red-300' : 'border-slate-300'"
      role="combobox" aria-expanded="open" aria-autocomplete="list"
      @focus="openList" @input="onInput" @blur="onBlur"
      @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="chooseHighlighted" @keydown.esc="open = false" />
    <button type="button" tabindex="-1" aria-hidden="true"
      class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
      @mousedown.prevent="open ? (open = false) : openList()">
      <svg class="w-4 h-4 transition-transform" :class="open ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <ul v-if="open && filtered.length" class="absolute z-20 mt-1.5 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.25)]">
      <li v-for="(b, i) in filtered" :key="b.id">
        <button type="button" @mousedown.prevent="choose(b.name)"
          class="w-full text-left px-3.5 py-2 text-sm transition"
          :class="i === highlighted || b.name === modelValue ? 'bg-[#f3f9e3] text-[#1f7a3a] font-semibold' : 'text-slate-700 hover:bg-slate-50'">
          {{ b.name }}
        </button>
      </li>
    </ul>
    <p v-else-if="open && query.trim()" class="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-400 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.25)]">
      No barangay matches “{{ query }}”.
    </p>
  </div>
  `,
};

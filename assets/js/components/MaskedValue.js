// A value a reviewer needs but should not have sitting on screen: a TIN, a registration number,
// a date of birth. RA 10173 treats government ID numbers and dates of birth as sensitive personal
// information, and these screens are read in a city office where other people walk past.
//
// Hidden every time the screen loads — the reveal is never remembered, so a shared or unattended
// workstation does not keep showing it. Reviewers still need the real value to check it against a
// submitted document, so this hides rather than redacts.
//
// Hidden means the characters are NOT in the page: a CSS blur would leave them selectable,
// copyable and one inspector click from being read, which is not what "hidden" should mean.
//
// The toggle is a labelled Show/Hide button, the same one the Change password dialog uses, rather
// than a bare icon — a control that does something should say what.
export default {
  name: 'MaskedValue',
  props: {
    value: { type: [String, Number], default: '' },
    // Names the value for screen readers and for the button's accessible label, e.g. "TIN"
    label: { type: String, required: true },
    empty: { type: String, default: '—' },
  },
  data() {
    return { shown: false };
  },
  computed: {
    hasValue() {
      return this.value !== null && this.value !== undefined && String(this.value).trim() !== '';
    },
    // A fixed run of dots: matching the real length would leak how many digits the number has.
    masked() {
      return '•'.repeat(12);
    },
  },
  template: `
  <span v-if="!hasValue" class="font-semibold text-slate-800">{{ empty }}</span>
  <!-- The button is pinned to the end of the field rather than sitting after the value, so it
       does not jump when the dots are swapped for a longer or shorter number. Sizing the value
       to fit both states would mean rendering the real one to measure it, which would put it in
       the page while it is meant to be hidden. -->
  <span v-else class="flex w-full max-w-[20rem] items-center justify-between gap-3">
    <span class="min-w-0 font-semibold text-slate-800 break-all"
          :class="shown ? '' : 'tracking-[0.15em] text-slate-400 select-none'">
      {{ shown ? value : masked }}
    </span>
    <button type="button" @click="shown = !shown"
      :aria-label="(shown ? 'Hide ' : 'Show ') + label" :aria-pressed="shown"
      class="shrink-0 w-[4.25rem] text-center text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ring-1 ring-inset ring-slate-200 bg-white text-slate-500 hover:text-brand-700 hover:ring-brand-300 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 transition">
      {{ shown ? 'Hide' : 'Show' }}
    </button>
  </span>
  `,
};

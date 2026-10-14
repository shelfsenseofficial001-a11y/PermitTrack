// The green check beside an email or mobile number that has been verified. Hovering it (or
// focusing it with the keyboard) shows a small "Verified" box above it. The box is our own rather
// than the browser's title tooltip, which waits about a second and is not shown on every device.
export default {
  name: 'VerifiedBadge',
  props: { label: { type: String, default: 'Verified' } },
  template: `
  <span class="group/verified relative inline-flex align-text-bottom cursor-default rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
    tabindex="0" role="img" :aria-label="label">
    <svg class="w-4 h-4 text-brand-600" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor"/>
      <path d="m7.5 12.5 3 3 6-6.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 px-2.5 py-1 rounded-lg bg-ink-700 text-white text-[11px] font-semibold leading-none whitespace-nowrap shadow-[0_8px_18px_-6px_rgba(7,24,14,0.5)] opacity-0 translate-y-1 transition duration-150 group-hover/verified:opacity-100 group-hover/verified:translate-y-0 group-focus/verified:opacity-100 group-focus/verified:translate-y-0">
      {{ label }}
      <span class="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-ink-700" aria-hidden="true"></span>
    </span>
  </span>
  `,
};

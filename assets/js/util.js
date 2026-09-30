const TYPE_CODES = {
  'Food Service': 'FS',
  'Building/Renovation': 'BR',
  'Sign': 'SN',
  'Business License': 'BL',
  'Special Event': 'SE',
};

export function permitNumber(app) {
  const code = TYPE_CODES[app.permit_type] || 'PT';
  const year = new Date(app.created_at).getFullYear();
  return `${code}-${year}-${String(app.id).padStart(4, '0')}`;
}

const TYPE_ICON_STYLES = {
  'Food Service': 'bg-orange-100 text-orange-600',
  'Building/Renovation': 'bg-blue-100 text-blue-600',
  'Sign': 'bg-purple-100 text-purple-600',
  'Business License': 'bg-emerald-100 text-emerald-600',
  'Special Event': 'bg-pink-100 text-pink-600',
};

export function permitIconClass(permitType) {
  return TYPE_ICON_STYLES[permitType] || 'bg-slate-100 text-slate-600';
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// "3h ago" reads better than a date for something recent; older than a week falls back to a date
export function timeAgo(value) {
  if (!value) return '—';
  const then = new Date(String(value).replace(' ', 'T'));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (!isFinite(mins)) return '—';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  if (days < 7) return days + 'd ago';
  return formatDate(value);
}

// Every "Back" link in the app shares one look: a white pill with a solid green arrow badge,
// clearly visible on both the white auth card and the meadow page background.
export const backButtonClass = 'group inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white ring-1 ring-brand-200 shadow-[0_6px_16px_-8px_rgba(16,48,29,0.35)] text-sm font-semibold text-ink-700 hover:ring-brand-400 hover:text-brand-700 hover:shadow-[0_10px_22px_-10px_rgba(16,48,29,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/60 transition';
export const backIconClass = 'w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5';

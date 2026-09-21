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

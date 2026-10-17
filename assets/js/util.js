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
  // MySQL hands back '2026-10-01 14:33:00'; Safari will not parse that without the T
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// The date and the time of day, for the moments where "when exactly" is the point: a file
// arriving, an application being filed, a stage changing.
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d)) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
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

// Sign-up and sign-in check the same two things, so the rules live here rather than in each
// form. The server checks again on its side — normalize_ph_mobile() in api/config.php is what
// actually decides a number is usable; these only catch the mistake before the round trip.
export const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value).trim());
export const isValidPhMobile = (value) => /^(\+?63|0)?9\d{9}$/.test(String(value).replace(/[\s-]/g, ''));

// Strips anything but digits, for the numbers-only boxes (OTP codes, postal codes) that are
// type="text" rather than type="number" — those don't block a pasted or typed letter on their
// own, so the field has to clean up after itself.
export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

// Null when a number field is fine as-is, otherwise the message to show under it. Covers the two
// mistakes a type="number" input doesn't stop on its own: a minus sign (HTML's min="0" marks the
// field :invalid but never blocks typing "-5"), and letters, which some browsers still let through
// on paste. allowDecimal controls whether a fractional part (e.g. floor area in sqm) is fine.
export function numberFieldError(value, { allowDecimal = false } = {}) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed === '-' || trimmed.startsWith('-')) return 'Negative numbers aren’t allowed.';
  const pattern = allowDecimal ? /^\d+(\.\d+)?$/ : /^\d+$/;
  if (!pattern.test(trimmed)) return 'Numbers only, please.';
  return null;
}

/**
 * The sign-in box takes either an email or a mobile number, so the error has to name the one the
 * person was clearly reaching for — telling someone who typed "asasasas" that it is not a valid
 * mobile number is no help. Digits and the punctuation a number carries mean they meant a number;
 * anything else means they meant an email. Returns '' when the value is fine (or still empty).
 */
export function identifierError(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const meantAsPhone = /^[\d+][\d\s()-]*$/.test(trimmed);
  if (meantAsPhone) {
    return isValidPhMobile(trimmed) ? '' : 'Invalid mobile number. Use a format like 0917 123 4567.';
  }
  return isValidEmail(trimmed) ? '' : 'Invalid email address.';
}

// Every "Back" link in the app shares one look: a white pill with a solid green arrow badge,
// clearly visible on both the white auth card and the meadow page background.
export const backButtonClass = 'group inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white ring-1 ring-brand-200 shadow-[0_6px_16px_-8px_rgba(16,48,29,0.35)] text-sm font-semibold text-ink-700 hover:ring-brand-400 hover:text-brand-700 hover:shadow-[0_10px_22px_-10px_rgba(16,48,29,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/60 transition';
export const backIconClass = 'w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5';

// What can be attached to a permit. Mirrors ALLOWED_UPLOAD_EXTENSIONS in api/config.php —
// the server is what actually enforces this (it also inspects the file's real contents);
// these just stop an obvious mistake before the upload starts.
export const ALLOWED_UPLOAD_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
export const UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXT.map((e) => '.' + e).join(',');
export const UPLOAD_TYPES_LABEL = 'JPG, PNG, WEBP, HEIC or PDF';

/**
 * How a notification should look. The server decides the tone (see notification_presentation()
 * in api/notifications.php); this turns it into the icon and colours.
 *
 * The point is that the bell reads as what it is at a glance: something you must act on is amber
 * and carries a warning mark, a refusal is red, good news is green. Before this, every status
 * change — including a document being sent back — arrived as the same green tick.
 *
 * `icon` names a path drawn by the <NotificationIcon> component, so the toast and the
 * Notifications page cannot drift apart.
 */
// `dark` is the same tone on the bell's dark dropdown, where a solid light tile would glare.
export const NOTIFICATION_TONES = {
  action:   { wrap: 'bg-sun-100 text-sun-700',     dark: 'bg-sun-300/20 text-sun-300',     dot: 'bg-sun-400',   icon: 'alert' },
  refused:  { wrap: 'bg-red-100 text-red-700',     dark: 'bg-red-400/20 text-red-300',     dot: 'bg-red-400',   icon: 'cross' },
  good:     { wrap: 'bg-brand-100 text-brand-700', dark: 'bg-brand-500/20 text-brand-300', dot: 'bg-brand-500', icon: 'check' },
  progress: { wrap: 'bg-slate-100 text-slate-500', dark: 'bg-white/10 text-ink-200',       dot: 'bg-slate-300', icon: 'arrow' },
  neutral:  { wrap: 'bg-slate-100 text-slate-500', dark: 'bg-white/10 text-ink-200',       dot: 'bg-slate-300', icon: 'dot' },
  message:  { wrap: 'bg-[#f3f9e3] text-brand-700', dark: 'bg-sun-300/20 text-sun-300',     dot: 'bg-brand-400', icon: 'chat' },
};

export function notificationTone(item) {
  return NOTIFICATION_TONES[item && item.tone] || NOTIFICATION_TONES.progress;
}

// Why a reviewer sent a document back. Mirrors DOCUMENT_REJECT_REASONS in api/config.php —
// the server is what validates the choice; this is the list the dropdown offers.
export const DOCUMENT_REJECT_REASONS = [
  { value: 'unreadable', label: 'Blurry or hard to read' },
  { value: 'wont_open', label: "File won't open" },
  { value: 'wrong_document', label: 'Wrong document' },
  { value: 'incomplete', label: 'Incomplete — pages missing' },
  { value: 'expired', label: 'Expired or out of date' },
  { value: 'mismatch', label: "Details don't match the application" },
  { value: 'unsupported_format', label: 'Unsupported file format or size' },
  { value: 'other', label: 'Other (please explain)' },
];

/** The wording for a stored reason code, for screens that show a rejected document. */
export function rejectReasonLabel(value) {
  const found = DOCUMENT_REJECT_REASONS.find((r) => r.value === value);
  return found ? found.label : '';
}

// Report User categories (section 4, mockup 4). Mirrors USER_REPORT_CATEGORIES in api/config.php.
export const USER_REPORT_CATEGORIES = [
  { value: 'nsfw', label: 'NSFW / Inappropriate Media' },
  { value: 'fraudulent_documents', label: 'Fraudulent / Altered Documents' },
  { value: 'fake_payment', label: 'Fake Payment Proof' },
  { value: 'malicious_files', label: 'Malicious File Attachments' },
  { value: 'spam', label: 'Spam & Queue Flooding' },
  { value: 'identity_theft', label: 'Identity Theft & Unauthorized Representation' },
  { value: 'misrepresentation', label: 'Misrepresentation of Business Scope' },
  { value: 'falsified_ownership', label: 'Falsified Lease/Property Ownership' },
];

export function userReportCategoryLabel(value) {
  const found = USER_REPORT_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value;
}

// Named so the message can say why, rather than just listing what is allowed
const OFFICE_EXT = ['doc', 'docx', 'ppt', 'pptx', 'pptm', 'xls', 'xlsx', 'odt', 'odp', 'pages', 'key'];

/** Null when the file's extension is allowed, otherwise a message for the user. */
export function uploadTypeError(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ALLOWED_UPLOAD_EXT.includes(ext)) return null;
  if (OFFICE_EXT.includes(ext)) {
    return 'Office files cannot be used as supporting documents, because they can be edited. Upload a scan, photo or PDF instead.';
  }
  return 'Only a scan, photo or PDF can be uploaded (' + UPLOAD_TYPES_LABEL + ').';
}

// Staff's tracking of an approved permit's physical handoff, once delivery is chosen.
// Mirrors DELIVERY_STATUS_LABELS and DELIVERY_FEE in api/config.php.
export const DELIVERY_STATUS_STEPS = [
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];
// Delivery is free (section 5) — kept as a constant for the one place this could change later.
export const DELIVERY_FEE = 0.00;

export const DELIVERY_METHOD_LABELS = {
  pickup: 'Pick up at the office',
  delivery: 'Delivered to an address',
  barangay_pickup: 'Pick up at your barangay hall',
};

export function deliveryStatusLabel(value) {
  const found = DELIVERY_STATUS_STEPS.find((s) => s.value === value);
  return found ? found.label : '';
}

export function formatPeso(amount) {
  return '₱' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Permit names already end in "Permit" (e.g. "Demolition Permit"). Add the word only when it is
// missing, so a headline never reads "Demolition Permit Permit".
export function permitLabel(name) {
  const n = (name || '').trim();
  if (!n) return '';
  return /\bpermit$/i.test(n) ? n : n + ' Permit';
}

// Base permit type name -> its renewal permit type name. Mirrors RENEWABLE_PERMITS in
// api/lib/pipeline.php — construction-type permits and personal certificates are never renewable.
// Due every year by January 20 (section 2 of the spec this was built from).
export const RENEWAL_DUE_DATE = 'January 20';

export const RENEWABLE_PERMITS = {
  'Business License': 'Business Permit Renewal',
  'Food Service': 'Food Service (Sanitary) Renewal',
  'Liquor/Tobacco License': 'Liquor/Tobacco License Renewal',
  'Market Stall/Vending Permit': 'Market Stall/Vending Permit Renewal',
  'MTOP/TODA Permit': 'MTOP/TODA Permit Renewal',
  'Sign Permit': 'Sign Permit Renewal',
  'Sign': 'Sign Permit Renewal',
  'Barangay Business Clearance (New)': 'Barangay Business Clearance (Renewal)',
  'Barangay Business Clearance': 'Barangay Business Clearance (Renewal)',
  'Barangay Clearance for Tricycles (TODA)': 'Barangay Clearance for Tricycles (TODA) Renewal',
  'Barangay Clearance for Tricycles': 'Barangay Clearance for Tricycles (TODA) Renewal',
  'Building Permit': 'Building Permit Renewal',
  // Allow renewing an existing renewal permit in subsequent years:
  'Business Permit Renewal': 'Business Permit Renewal',
  'Food Service (Sanitary) Renewal': 'Food Service (Sanitary) Renewal',
  'Liquor/Tobacco License Renewal': 'Liquor/Tobacco License Renewal',
  'Market Stall/Vending Permit Renewal': 'Market Stall/Vending Permit Renewal',
  'MTOP/TODA Permit Renewal': 'MTOP/TODA Permit Renewal',
  'Sign Permit Renewal': 'Sign Permit Renewal',
  'Barangay Business Clearance (Renewal)': 'Barangay Business Clearance (Renewal)',
  'Barangay Clearance for Tricycles (TODA) Renewal': 'Barangay Clearance for Tricycles (TODA) Renewal',
  'Building Permit Renewal': 'Building Permit Renewal',
};

export function isRenewableBaseType(name) {
  return Object.prototype.hasOwnProperty.call(RENEWABLE_PERMITS, (name || '').trim());
}

import { reactive } from 'vue';
import { apiGet, apiPost } from '../api/client.js?v=67';

export const authState = reactive({
  user: null,
  loaded: false,
  // Set while an email/phone code is outstanding: { channel, sent_to, resend_after_seconds, dev_code? }
  verification: null,
});

export async function loadCurrentUser() {
  const { user } = await apiGet('auth.php?action=me');
  authState.user = user;
  authState.loaded = true;
  return user;
}

/** Returns the signed-in user, or null when a verification code must be entered first. */
export async function login(identifier, password, asStaff) {
  const res = await apiPost('auth.php?action=login', { identifier, password, as_staff: asStaff });
  if (res.needs_verification) {
    authState.verification = res.verification;
    return null;
  }
  authState.user = res.user;
  return res.user;
}

/** Creates the account and starts verification (the user is signed in after entering the code). */
export async function register(payload) {
  const { verification } = await apiPost('auth.php?action=register', payload);
  authState.verification = verification;
}

export async function verifyCode(code) {
  const { user } = await apiPost('auth.php?action=verify', { code });
  authState.user = user;
  authState.verification = null;
  return user;
}

export async function resendCode() {
  const { verification } = await apiPost('auth.php?action=resend', {});
  authState.verification = verification;
  return verification;
}

/**
 * Signs out the current account. If another account is signed in on this browser, the server
 * switches to it and that user is returned; otherwise returns null.
 */
export async function logout() {
  const res = await apiPost('auth.php?action=logout', {});
  authState.user = res.user || null;
  authState.verification = null;
  return authState.user;
}

/** Accounts signed in on this browser: [{ id, full_name, contact, role, current }] */
export async function listAccounts() {
  const { accounts } = await apiGet('auth.php?action=accounts');
  return accounts;
}

export async function switchAccount(id) {
  const { user } = await apiPost('auth.php?action=switch', { id });
  authState.user = user;
  return user;
}

/** After switching or signing out into another account, reload so every page shows that user's data. */
export function reloadAs(user) {
  location.hash = '#' + homePathFor(user);
  location.reload();
}

export async function changePassword(currentPassword, newPassword) {
  const { user } = await apiPost('auth.php?action=change_password', { current_password: currentPassword, new_password: newPassword });
  authState.user = user;
  return user;
}

// Where someone lands after signing out: staff and admins back to the Staff Portal login,
// residents and businesses to the public landing page. Pass the user from *before* logout.
export function signOutPathFor(user) {
  return user && (user.role === 'staff' || user.role === 'admin') ? '/staff/login' : '/';
}

export function homePathFor(user) {
  if (!user) return '/login';
  // A temporary password is handled by the dialog in app.js, over whichever page this is
  return user.role === 'staff' || user.role === 'admin' ? '/reviewer' : '/dashboard';
}

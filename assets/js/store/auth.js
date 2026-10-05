import { reactive } from 'vue';
import { apiGet, apiPost } from '../api/client.js?v=128';
import { beginTransition, carryTransitionThroughReload } from './ui.js?v=128';

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

/**
 * Sends the ID token from the Google button to the server. Returns the signed-in user, or null
 * when this Google account has no account here yet and the sign-up form has to be finished.
 */
export async function googleSignIn(credential) {
  const res = await apiPost('auth.php?action=google', { credential });
  if (res.needs_profile) return null;
  authState.user = res.user;
  return res.user;
}

/** The Google sign-up waiting to be finished: { email, first_name, last_name }, or null. */
export async function googleSignupProfile() {
  const { profile } = await apiGet('auth.php?action=google_profile');
  return profile;
}

export async function googleRegister(payload) {
  const { user } = await apiPost('auth.php?action=google_register', payload);
  authState.user = user;
  return user;
}

export async function googleCancel() {
  await apiPost('auth.php?action=google_cancel', {});
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
 * Signs the current account out and leaves nobody signed in — it never steps into another
 * account. Others that signed in on this browser stay signed in, and listAccounts() offers
 * them to the chooser on the Sign in button.
 */
export async function logout() {
  await apiPost('auth.php?action=logout', {});
  authState.user = null;
  authState.verification = null;
}

/** Accounts signed in on this browser: [{ id, full_name, contact, role, current }] */
export async function listAccounts() {
  const { accounts } = await apiGet('auth.php?action=accounts');
  return accounts;
}

/** Removes another account from this browser's "signed in" list. */
export async function forgetAccount(id) {
  await apiPost('auth.php?action=forget', { id });
}

export async function switchAccount(id) {
  const { user } = await apiPost('auth.php?action=switch', { id });
  authState.user = user;
  return user;
}

/**
 * After switching into another account, reload so every page shows that user's data. The
 * "Switching accounts…" veil goes up first and stays up through the reload (see ui.js).
 */
export function reloadAs(user) {
  beginTransition('switch');
  carryTransitionThroughReload('switch');
  // Long enough for the blur to settle over the page before it goes
  setTimeout(() => {
    location.hash = '#' + homePathFor(user);
    location.reload();
  }, 450);
}

export async function changePassword(currentPassword, newPassword) {
  const { user } = await apiPost('auth.php?action=change_password', { current_password: currentPassword, new_password: newPassword });
  authState.user = user;
  return user;
}

// Signing out always lands on the public landing page, whoever was signed in — staff included,
// who reach the Staff Portal again from the link in its footer.
export function signOutPathFor() {
  return '/';
}

export function homePathFor(user) {
  if (!user) return '/login';
  // A temporary password is handled by the dialog in app.js, over whichever page this is
  return user.role === 'staff' || user.role === 'admin' ? '/reviewer' : '/dashboard';
}

import { reactive } from 'vue';

// App-wide UI state for overlays that any page or shell can open.
// Remembering the switch per browser is the point: a tester turns hints on once and they stay
// on across reloads. Nothing here reaches the server, and a blocked localStorage just means the
// switch starts off.
const HINTS_KEY = "permittrack.reviewerHints";
function readHints() {
  try { return localStorage.getItem(HINTS_KEY) === "1"; } catch (e) { return false; }
}

// Switching accounts reloads the page. The veil is carried across that reload so it is already
// up as the new account's page draws underneath it, rather than flashing off and back on.
const TRANSITION_KEY = 'permittrack.transition';
function readCarriedTransition() {
  try {
    const kind = sessionStorage.getItem(TRANSITION_KEY);
    sessionStorage.removeItem(TRANSITION_KEY);
    return kind === 'switch' ? 'switch' : null;
  } catch (e) {
    return null;
  }
}

export const uiState = reactive({
  changePasswordOpen: false,
  // The full-screen veil: 'switch' | 'signout' (blurred) | 'signin' (the opening reveal) | null
  transition: readCarriedTransition(),
  // For 'signin': where the reveal opens from (the button pressed, in viewport px) and what it says
  transitionOrigin: null,
  transitionGreeting: '',
  transitionLine: '',
  // The "Sign out?" confirmation, shared by every account menu
  confirmSignOut: false,
  // A page asking the chat panel to open an application's thread (openApplicationThread()).
  // A fresh object each time, so asking twice for the same one still opens it.
  chatThreadRequest: null,
  // "Which account approves this step?" — a testing aid, shown on the pipeline. The API only
  // sends the accounts when the install allows it (app_config testing.reviewer_hints).
  reviewerHints: readHints(),
  // Bumped when notifications change somewhere other than the bell (e.g. "Mark all as read"
  // on the Notifications page), so the header badge knows to refresh its count.
  notificationsVersion: 0,
});

export function openChangePassword() {
  uiState.changePasswordOpen = true;
}

export function askSignOut() {
  uiState.confirmSignOut = true;
}

export function beginTransition(kind) {
  uiState.transition = kind;
}

export function endTransition() {
  uiState.transition = null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Signing in, as a moment rather than a page swap: the screen opens out from the button that was
 * pressed into the brand green, the mark flies with a welcome, and it lifts away to show the
 * account's first page arriving underneath. Every sign-in finishes here — residents, staff, and a
 * new account confirming its code — so they all look the same.
 *
 * The hold is long enough for the arrow to fly its path once and land (about 1s of LogoMark's
 * loop), which is what makes it read as an arrival and not a flicker.
 */
export async function enterSignedIn(router, path, user, { from = null, greeting = '', line = '' } = {}) {
  const box = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
  uiState.transitionOrigin = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
  const first = (user && (user.first_name || String(user.full_name || '').trim().split(/\s+/)[0])) || '';
  uiState.transitionGreeting = greeting || (first ? `Welcome back, ${first}` : 'Welcome back');
  uiState.transitionLine = line;
  beginTransition('signin');
  await wait(1050);
  await router.push(path);
  // the first page has mounted underneath; lift the screen as its sections rise in
  setTimeout(endTransition, 120);
}

// For a transition that ends in a page reload: keep the veil up through it
export function carryTransitionThroughReload(kind) {
  try { sessionStorage.setItem(TRANSITION_KEY, kind); } catch (e) { /* it just fades on reload */ }
}

export function notificationsChanged() {
  uiState.notificationsVersion += 1;
}

export function toggleReviewerHints() {
  uiState.reviewerHints = !uiState.reviewerHints;
  try { localStorage.setItem(HINTS_KEY, uiState.reviewerHints ? "1" : "0"); } catch (e) { /* not worth failing over */ }
}

/** Opens the chat panel on an application's thread in Messages — where its messages live. */
export function openApplicationThread(applicationId) {
  uiState.chatThreadRequest = { applicationId: Number(applicationId) };
}

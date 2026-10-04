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
  // The full-screen blurred veil: 'switch' | 'signout' | null
  transition: readCarriedTransition(),
  // The "Sign out?" confirmation, shared by every account menu
  confirmSignOut: false,
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

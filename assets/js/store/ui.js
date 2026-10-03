import { reactive } from 'vue';

// App-wide UI state for overlays that any page or shell can open.
// Remembering the switch per browser is the point: a tester turns hints on once and they stay
// on across reloads. Nothing here reaches the server, and a blocked localStorage just means the
// switch starts off.
const HINTS_KEY = "permittrack.reviewerHints";
function readHints() {
  try { return localStorage.getItem(HINTS_KEY) === "1"; } catch (e) { return false; }
}

export const uiState = reactive({
  changePasswordOpen: false,
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

export function notificationsChanged() {
  uiState.notificationsVersion += 1;
}

export function toggleReviewerHints() {
  uiState.reviewerHints = !uiState.reviewerHints;
  try { localStorage.setItem(HINTS_KEY, uiState.reviewerHints ? "1" : "0"); } catch (e) { /* not worth failing over */ }
}

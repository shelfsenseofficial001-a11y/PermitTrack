import { reactive } from 'vue';

// App-wide UI state for overlays that any page or shell can open.
export const uiState = reactive({
  changePasswordOpen: false,
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

import { reactive } from 'vue';
import { apiGet, apiPost } from '../api/client.js';

export const authState = reactive({
  user: null,
  loaded: false,
});

export async function loadCurrentUser() {
  const { user } = await apiGet('auth.php?action=me');
  authState.user = user;
  authState.loaded = true;
  return user;
}

export async function login(email, password, asStaff) {
  const { user } = await apiPost('auth.php?action=login', { email, password, as_staff: asStaff });
  authState.user = user;
  return user;
}

export async function register(payload) {
  const { user } = await apiPost('auth.php?action=register', payload);
  authState.user = user;
  return user;
}

export async function logout() {
  await apiPost('auth.php?action=logout', {});
  authState.user = null;
}

const BASE = 'api';

async function handle(res) {
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    // Some refusals carry more than a message — a confirmation the caller has to collect before
    // retrying, for instance. Keep the body and status on the error so it is not thrown away.
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function apiGet(path) {
  return fetch(`${BASE}/${path}`, { credentials: 'same-origin' }).then(handle);
}

export function apiPost(path, data) {
  return fetch(`${BASE}/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
  }).then(handle);
}

export function apiPostForm(path, formData) {
  return fetch(`${BASE}/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  }).then(handle);
}

export function downloadUrl(docId) {
  return `${BASE}/documents.php?action=download&id=${docId}`;
}

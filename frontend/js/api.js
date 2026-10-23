// api.js - Pure networking layer. Decoupled from State and UI.

import { endSession, getAccessToken, refreshAccessToken } from './auth.js';

const HOSTNAME = window.location.hostname || 'localhost';
export const API_URL = `http://${HOSTNAME}:8080/api/cas`; // Note: your main Java API URL

const send = (url, options, token) => fetch(url, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

/**
 * Generic API Call wrapper
 * Waits for the page's session, sends the access token, and on a 401 renews it once and retries once. If the
 * renewal fails, the session ends (see auth.js) and the call never resolves: no stored data shows up without a session.
 * Other failures, an API down included, throw, so the caller can switch to the offline mode.
 */
export async function fetchApi(url, options = {}) {
  let res = await send(url, options, await getAccessToken());

  if (res.status === 401) {
    console.warn('Access token refused. Renewing it once...');
    const renewed = await refreshAccessToken();
    if (!renewed.token) return endSession(renewed);
    res = await send(url, options, renewed.token);
    if (res.status === 401) return endSession();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API HTTP Error: ${res.status} - ${text}`);
  }

  // Handle empty responses safely (like 204 No Content for DELETE)
  if (res.status === 204) {
    return null;
  }

  return await res.json();
}

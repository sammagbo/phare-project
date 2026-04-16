// api.js - Pure networking layer. Decoupled from State and UI.

export const API_URL = 'http://localhost:8080/api/cas';

/**
 * Generic API Call wrapper
 * Throws errors so the caller (Store) can handle the online/offline state.
 */
export async function fetchApi(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API HTTP Error: ${res.status} - ${text}`);
  }
  
  return await res.json();
}

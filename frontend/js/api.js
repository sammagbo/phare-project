// api.js - Pure networking layer. Decoupled from State and UI.

import { getToken, logoutUser, refreshAccessToken } from './auth.js';

const HOSTNAME = window.location.hostname || 'localhost';
export const API_URL = `http://${HOSTNAME}:8080/api/cas`; // Note: your main Java API URL

/**
 * Generic API Call wrapper
 * Throws errors so the caller can handle the online/offline state.
 * Automatically injects the JWT token and attempts refresh if expired.
 */
export async function fetchApi(url, options = {}, isRetry = false) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });
  
  // Handle Token Expiry
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !isRetry) {
      console.warn("Token expired. Attempting to refresh access token...");
      
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Retry the original request with the new token
        return fetchApi(url, options, true);
      } else {
        // Refresh failed, fallback to login
        logoutUser();
      }
    }
    
    // Default error handling for non-auth failures
    const text = await res.text();
    throw new Error(`API HTTP Error: ${res.status} - ${text}`);
  }
  
  // Handle empty responses safely (like 204 No Content for DELETE)
  if (res.status === 204) {
    return null;
  }
  
  return await res.json();
}

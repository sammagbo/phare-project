/**
 * entretien-api.js
 * Networking layer for interview scheduling.
 * Communicates with the Java Spring Boot API (/api/entretiens).
 * Falls back to localStorage when the API is unreachable.
 */

import { fetchApi } from './api.js';

const HOSTNAME = window.location.hostname || 'localhost';
export const ENTRETIEN_API_URL = `http://${HOSTNAME}:8080/api/entretiens`;

// ── localStorage keys (fallback) ──
const REUNIONS_KEY = 'phare_reunions';

// ═══════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════

/**
 * Fetch all scheduled interviews.
 * @returns {Promise<Array>} List of Eleve objects with entretien data
 */
export async function getScheduledEntretiens() {
  try {
    return await fetchApi(ENTRETIEN_API_URL);
  } catch (err) {
    console.warn('Entretien API offline — using localStorage fallback', err.message);
    return null; // Caller handles fallback
  }
}

/**
 * Fetch all students pending interviews.
 * @returns {Promise<Array>} List of Eleve objects without entretien data
 */
export async function getPendingEntretiens() {
  try {
    return await fetchApi(`${ENTRETIEN_API_URL}/pending`);
  } catch (err) {
    console.warn('Entretien API offline — using localStorage fallback', err.message);
    return null;
  }
}

/**
 * Schedule an interview for a student.
 * @param {number} eleveId - The student's database ID
 * @param {string} date    - Interview date (YYYY-MM-DD)
 * @param {string} heure   - Interview time (HH:mm)
 * @param {string} membre  - pHARe team member name
 * @returns {Promise<Object|null>} Updated Eleve or null on failure
 */
export async function scheduleEntretien(eleveId, date, heure, membre) {
  try {
    return await fetchApi(`${ENTRETIEN_API_URL}/${eleveId}`, {
      method: 'PUT',
      body: JSON.stringify({ date, heure, membre })
    });
  } catch (err) {
    console.warn('Schedule failed — saving locally', err.message);
    return null;
  }
}

/**
 * Cancel a student's interview.
 * @param {number} eleveId - The student's database ID
 * @returns {Promise<boolean>} true if successful
 */
export async function cancelEntretien(eleveId) {
  try {
    await fetchApi(`${ENTRETIEN_API_URL}/${eleveId}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('Cancel failed — clearing locally', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════
//  LOCALSTORAGE FALLBACK (offline mode)
// ═══════════════════════════════════════════════

/**
 * Save reunion data to localStorage (legacy format).
 * Used when the API is unreachable.
 */
export function saveReunionLocal(reunionData) {
  localStorage.setItem(REUNIONS_KEY, JSON.stringify(reunionData));
}

/**
 * Load reunion data from localStorage.
 */
export function loadReunionLocal() {
  try {
    return JSON.parse(localStorage.getItem(REUNIONS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

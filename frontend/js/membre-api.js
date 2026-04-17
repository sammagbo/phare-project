/**
 * membre-api.js
 * Networking layer for pHARe team member management.
 * Communicates with /api/membres endpoints.
 */

import { fetchApi } from './api.js';

const HOSTNAME = window.location.hostname || 'localhost';
export const MEMBRES_API_URL = `http://${HOSTNAME}:8080/api/membres`;

/**
 * Fetch all members (sorted alphabetically by the API).
 * @returns {Promise<Array|null>} Array of { id, nom } or null on failure
 */
export async function fetchMembres() {
  try {
    return await fetchApi(MEMBRES_API_URL);
  } catch (err) {
    console.warn('Membres API offline', err.message);
    return null;
  }
}

/**
 * Add a new member.
 * @param {string} nom - Member name
 * @returns {Promise<Object|null>} Created member { id, nom } or null
 */
export async function addMembre(nom) {
  try {
    return await fetchApi(MEMBRES_API_URL, {
      method: 'POST',
      body: JSON.stringify({ nom })
    });
  } catch (err) {
    console.warn('Add membre failed', err.message);
    return null;
  }
}

/**
 * Delete a member by ID.
 * @param {number} id - Member database ID
 * @returns {Promise<boolean>}
 */
export async function deleteMembre(id) {
  try {
    await fetchApi(`${MEMBRES_API_URL}/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('Delete membre failed', err.message);
    return false;
  }
}

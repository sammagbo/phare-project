// store.js - Centralized application state and observer

import { fetchApi, API_URL } from './api.js';

export const STORAGE_KEY = 'phare_cases';
export const MEMBERS_KEY = 'phare_members';

const INITIAL_MEMBERS = [
  'Antoine Kopp', 'Aline Soulhat', 'Alex Sarno', 'Ana Maria Sezerino',
  'Céline Berger', 'Daiana Santos', 'Élodie Mazet', 'Giselle Paz',
  'Jonathan Wasato', 'Maria Beatriz Guimarães', 'Rafaela Lomba',
  'Vanessa Coelho', 'Vanessa Laga', 'Whilian Xavier'
];

/**
 * State object representing the "truth"
 */
const state = {
  cases: [],
  members: [],
  apiOnline: false,
  editingId: null,
  searchQuery: ''
};

// Event Subscriptions
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach(fn => fn(state));
}

/**
 * ACTIONS
 */

export function getState() {
  return state;
}

export function setSearchQuery(query) {
  state.searchQuery = query;
  notify();
}

export function setEditingId(id) {
  state.editingId = id;
  notify();
}

export function loadMembers() {
  const saved = localStorage.getItem(MEMBERS_KEY);
  if (saved) {
    try {
      state.members = JSON.parse(saved);
    } catch (e) {
      console.error("Error loading members", e);
      state.members = [...INITIAL_MEMBERS];
    }
  } else {
    state.members = [...INITIAL_MEMBERS];
  }
}

export function addMember(name) {
  if (!name || state.members.includes(name)) return false;
  state.members.push(name);
  state.members.sort();
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(state.members));
  notify();
  return true;
}

export function removeMember(index) {
  state.members.splice(index, 1);
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(state.members));
  notify();
}

export async function fetchCases() {
  try {
    const data = await fetchApi(API_URL);
    state.apiOnline = true;
    state.cases = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('API Offline - Fallback LocalStorage', err.message);
    state.apiOnline = false;
    try {
      state.cases = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch(e) {
      state.cases = [];
    }
  }
  notify();
}

export async function saveCase(payload) {
  if (state.editingId) {
    try {
      await fetchApi(`${API_URL}/${state.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      state.apiOnline = true;
    } catch (err) {
      state.apiOnline = false;
      const idx = state.cases.findIndex(c => c.id == state.editingId);
      if (idx !== -1) state.cases[idx] = { ...state.cases[idx], ...payload };
    }
    state.editingId = null;
  } else {
    try {
      await fetchApi(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.apiOnline = true;
    } catch (err) {
      state.apiOnline = false;
      state.cases.unshift({ id: Date.now(), ...payload });
    }
  }

  // If we are offline, the local array has mutated, we sync to storage:
  if (!state.apiOnline) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
  }

  // Refetch if online
  if (state.apiOnline) {
    await fetchCases();
  } else {
    notify(); // Trigger UI from offline diff
  }
  return true;
}

export async function deleteCase(id) {
  try {
    await fetchApi(`${API_URL}/${id}`, { method: 'DELETE' });
    state.apiOnline = true;
  } catch (err) {
    state.apiOnline = false;
    state.cases = state.cases.filter(c => c.id != id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
  }
  
  if (state.apiOnline) {
    await fetchCases();
  } else {
    notify();
  }
}

export function importJSON(data) {
  state.cases = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  notify();
}

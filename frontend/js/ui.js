import { animateEntry, animateCardAdd, animateCardRemove, animateHistoryStagger } from './animations.js';
import * as store from './store.js';

// Mapping local front-end <-> APIs back-end
const TO_BACK  = { victime:'VICTIME', temoin:'TEMOIN', intimidateur:'INTIMIDATEUR' };
const TO_FRONT = { VICTIME:'victime', TEMOIN:'temoin', INTIMIDATEUR:'intimidateur' };

let studentCount = 0; // Local view state for uncommitted form cards

// ══════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  
  // Initialize State
  await store.loadMembers(); 

  // Initialize View
  const now = new Date();
  document.getElementById('date').value  = now.toISOString().slice(0, 10);
  document.getElementById('heure').value = now.toTimeString().slice(0, 5);
  renderEmptyState();
  animateEntry();

  // Watch for state changes
  store.subscribe(render);

  await store.fetchCases();
});

function setupEventListeners() {
  document.body.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;

    const actionType = action.dataset.action;
    
    switch (actionType) {
      case 'add-student':
        addStudentUI();
        break;
      case 'save-case':
        handleSaveCase();
        break;
      case 'import-json':
        document.getElementById('import-file').click();
        break;
      case 'export-json':
        exportJSON();
        break;
      case 'print-report':
        printReport();
        break;
      case 'open-members':
        document.getElementById('member-modal').classList.add('active');
        break;
      case 'close-members':
        document.getElementById('member-modal').classList.remove('active');
        break;
      case 'add-member':
        handleAddMember();
        break;
      case 'cancel-edit':
        store.setEditingId(null);
        resetForm();
        toast('Modification annulée.');
        break;
    }
  });

  document.getElementById('students-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-student]');
    if(btn) removeStudentUI(btn.dataset.deleteStudent);
  });

  document.getElementById('history-list').addEventListener('click', (e) => {
    const btnEdit = e.target.closest('[data-edit-case]');
    if(btnEdit) editCaseUI(btnEdit.dataset.editCase);

    const btnSched = e.target.closest('[data-schedule-case]');
    if(btnSched) window.location.href = `phare-reunion.html?cas=${btnSched.dataset.scheduleCase}`;

    const btnDel = e.target.closest('[data-delete-case]');
    if(btnDel) {
      if (confirm("Supprimer ce cas de l'historique ?")) {
        store.deleteCase(btnDel.dataset.deleteCase).then(() => toast('Cas supprimé.'));
      }
    }
  });

  document.getElementById('member-list-items').addEventListener('click', async (e) => {
    const btnRemove = e.target.closest('[data-remove-member]');
    if(btnRemove) {
      const idx = parseInt(btnRemove.dataset.removeMember, 10);
      if (confirm(`Supprimer de la liste ?`)) {
        await store.removeMember(idx);
        toast("Membre retiré");
      }
    }
  });

  document.getElementById('member-modal').addEventListener('click', (e) => {
    if(e.target.id === 'member-modal') document.getElementById('member-modal').classList.remove('active');
  });

  const searchInput = document.getElementById('search-input');
  if(searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.setSearchQuery(e.target.value);
    });
  }

  const importFile = document.getElementById('import-file');
  if(importFile) importFile.addEventListener('change', processImport);

  // RT Feedback clear for Date/Time
  document.getElementById('date').addEventListener('change', function() {
    this.classList.remove('invalid');
    document.getElementById('error-date').classList.remove('visible');
  });
  document.getElementById('heure').addEventListener('change', function() {
    this.classList.remove('invalid');
    document.getElementById('error-heure').classList.remove('visible');
  });
}

// ══════════════════════════════════════════════════════════
//  REACTIVE RENDER (Similar to React Component Render)
// ══════════════════════════════════════════════════════════

let lastCasesSign = null;

function render(state) {
  // Render API Badge
  const badgeEl = document.getElementById('api-status');
  if (badgeEl) {
    badgeEl.textContent = state.apiOnline ? '🟢 API connectée' : '🔴 Mode hors-ligne';
    badgeEl.className = 'badge api-badge ' + (state.apiOnline ? 'online' : 'offline');
  }

  // Render Edit Banner Visibility
  const editBanner = document.getElementById('edit-banner');
  if (state.editingId) {
    editBanner.classList.add('visible');
  } else {
    editBanner.classList.remove('visible');
  }

  // Render Members Modal List
  const memContainer = document.getElementById('member-list-items');
  if (state.members.length === 0) {
    memContainer.innerHTML = '<p style="text-align:center; font-size:.8rem; color:var(--text-light); padding:1rem;">Aucun membre enregistré.</p>';
  } else {
    memContainer.innerHTML = state.members.map((m, i) => `
      <div class="card" style="padding: 0.75rem 1rem; flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-weight: 600;">${m}</span>
        <button class="btn btn-ghost" data-remove-member="${i}" style="color: var(--accent); border: none; padding: 0.5rem;">✕</button>
      </div>
    `).join('');
  }
  
  // Sync all live form dropdowns with state.members
  updateAllMemberSelectsUI(state.members);

  // Filter History Data based on Search
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = query
    ? state.cases.filter(c => c.eleves.some(e => e.nom.toLowerCase().includes(query)))
    : state.cases;

  // Render history if changed
  const currentSign = JSON.stringify(filtered);
  if (currentSign !== lastCasesSign) {
    renderHistoryUI(filtered, state);
    lastCasesSign = currentSign;
  }
}

// ══════════════════════════════════════════════════════════
//  UI DOM LOGIC (Forms, Validations, DOM Manipulations)
// ══════════════════════════════════════════════════════════

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => el.className = 'toast', 2500);
}

async function handleAddMember() {
  const input = document.getElementById('new-member-name');
  const name = input.value.trim();
  if (!name) return;
  if(await store.addMember(name)) {
    input.value = '';
    toast("Membre ajouté");
  } else {
    toast("Membre déjà présent", true);
  }
}

function updateAllMemberSelectsUI(members) {
  const selects = document.querySelectorAll('select[data-field="membre"]');
  selects.forEach(select => {
    const currentVal = select.value;
    const opts = ['Choisir…', ...members]
      .map((m, i) => `<option value="${i === 0 ? '' : m}"${i === 0 ? ' disabled' : ''}>${m}</option>`)
      .join('');
    select.innerHTML = opts;
    if (members.includes(currentVal)) {
      select.value = currentVal;
    } else {
      select.value = '';
    }
  });
}

function renderEmptyState() {
  const list = document.getElementById('students-list');
  if (list.querySelectorAll('.student-card').length === 0) {
    list.innerHTML = '<div class="empty-state">Aucun élève ajouté. Cliquez sur « ＋ Ajouter un élève » pour commencer.</div>';
  }
}

function updateLocalVictimsRefsUI() {
  const cards = document.querySelectorAll('.student-card');
  const victims = [];

  cards.forEach(c => {
    const type = c.querySelector('[data-field="type"]').value;
    const nom = c.querySelector('[data-field="nom"]').value.trim();
    if ((type === 'victime' || type === 'VICTIME') && nom !== '') {
      victims.push(nom);
    }
  });

  cards.forEach(c => {
    const type = c.querySelector('[data-field="type"]').value;
    const linkField = c.querySelector('.field-link');
    const select = c.querySelector('[data-field="lie_a"]');
    
    const isRoleRequiringLink = (type === 'temoin' || type === 'TEMOIN' || type === 'intimidateur' || type === 'INTIMIDATEUR');
    
    if (isRoleRequiringLink) {
      linkField.style.display = 'flex';
      const currentVal = select.value;
      const opts = ['<option value="" disabled selected>Choisir…</option>'];
      
      victims.forEach(v => {
        opts.push(`<option value="${v}">${v}</option>`);
      });

      if (victims.length === 0) {
        opts.push(`<option value="" disabled>Aucune victime ajoutée</option>`);
      }
      
      select.innerHTML = opts.join('');
      
      if (victims.includes(currentVal)) {
        select.value = currentVal;
      } else if (victims.length === 1) {
        select.value = victims[0];
        select.classList.remove('invalid');
        c.querySelector('[data-error="lie_a"]').classList.remove('visible');
      }
    } else {
      linkField.style.display = 'none';
      select.value = '';
    }
  });
  
  // Chips Update
  const hint = document.getElementById('role-hint');
  if (cards.length === 0) { hint.style.display = 'none'; return; }
  hint.style.display = 'flex';

  const typesArray = Array.from(cards).map(card => {
    const sel = card.querySelector('[data-field="type"]');
    return sel.value ? (TO_BACK[sel.value] || sel.value) : '';
  });

  document.getElementById('chip-victime').classList.toggle('met', typesArray.includes('VICTIME'));
  document.getElementById('chip-temoin').classList.toggle('met', typesArray.includes('TEMOIN'));
  document.getElementById('chip-intimidateur').classList.toggle('met', typesArray.includes('INTIMIDATEUR'));
}

function addStudentUI(presetData = null) {
  const list = document.getElementById('students-list');
  const empty = list.querySelector('.empty-state');
  if (empty) empty.remove();

  studentCount++;
  const id = studentCount;
  const card = document.createElement('div');
  card.className = 'student-card';
  card.id = `student-${id}`;

  const stateMembers = store.getState().members;
  const opts = ['Choisir…', ...stateMembers]
    .map((m, i) => `<option value="${i === 0 ? '' : m}"${i === 0 ? ' disabled selected' : ''}>${m}</option>`)
    .join('');

  card.innerHTML = `
    <div class="field-group">
      <label>Nom de l'élève</label>
      <input type="text" placeholder="Prénom Nom" data-field="nom">
      <div class="field-error" data-error="nom">Le nom est obligatoire.</div>
    </div>
    <div class="field-group">
      <label>Classe</label>
      <input type="text" placeholder="Ex: 6ème A" data-field="classe">
      <div class="field-error" data-error="classe">La classe est obligatoire.</div>
    </div>
    <div class="field-group">
      <label>Type</label>
      <select data-field="type">
        <option value="" disabled selected>Choisir…</option>
        <option value="victime">Victime</option>
        <option value="temoin">Témoin</option>
        <option value="intimidateur">Intimidateur</option>
      </select>
      <div class="field-error" data-error="type">Le type est obligatoire.</div>
    </div>
    <div class="field-group field-link" style="display:none">
      <label>Lié à (Victime)</label>
      <select data-field="lie_a">
        <option value="" disabled selected>Choisir…</option>
      </select>
      <div class="field-error" data-error="lie_a">Cible manquante.</div>
    </div>
    <div class="field-group">
      <label>Membre pHARe</label>
      <select data-field="membre">${opts}</select>
    </div>
    <button class="btn btn-ghost" style="color: var(--accent); align-self: flex-end; margin-bottom: 1.25rem;" title="Supprimer" data-delete-student="${id}">✕</button>
  `;
  list.appendChild(card);
  
  if (presetData) {
    card.querySelector('[data-field="nom"]').value = presetData.nom;
    const typeLower = TO_FRONT[presetData.type] || presetData.type;
    card.querySelector('[data-field="type"]').value = typeLower;
    card.setAttribute('data-type', typeLower);
    if (presetData.membre) card.querySelector('[data-field="membre"]').value = presetData.membre;
    if (presetData.classe) card.querySelector('[data-field="classe"]').value = presetData.classe;
  }

  animateCardAdd(card);

  updateLocalVictimsRefsUI();
  
  if (presetData && presetData.lie_a) {
    card.querySelector('[data-field="lie_a"]').value = presetData.lie_a;
  } else if (!presetData) {
    card.querySelector('input').focus();
  }

  // Reactivity for real-time validation checks
  card.querySelector('[data-field="nom"]').addEventListener('input', function() {
    this.classList.remove('invalid');
    card.querySelector('[data-error="nom"]').classList.remove('visible');
    card.classList.remove('error');
    updateLocalVictimsRefsUI();
  });
  card.querySelector('[data-field="classe"]').addEventListener('input', function() {
    this.classList.remove('invalid');
    card.querySelector('[data-error="classe"]').classList.remove('visible');
    card.classList.remove('error');
  });
  card.querySelector('[data-field="type"]').addEventListener('change', function() {
    this.classList.remove('invalid');
    card.querySelector('[data-error="type"]').classList.remove('visible');
    card.classList.remove('error');
    card.setAttribute('data-type', this.value);
    updateLocalVictimsRefsUI();
  });
  card.querySelector('[data-field="lie_a"]').addEventListener('change', function() {
    this.classList.remove('invalid');
    card.querySelector('[data-error="lie_a"]').classList.remove('visible');
    card.classList.remove('error');
  });
}

function removeStudentUI(id) {
  const card = document.getElementById(`student-${id}`);
  if (card) {
    animateCardRemove(card, () => {
      card.remove(); 
      renderEmptyState(); 
      updateLocalVictimsRefsUI();
    });
  }
}

function editCaseUI(id) {
  const c = store.getState().cases.find(x => x.id == id);
  if (!c) return;

  store.setEditingId(id);
  document.getElementById('date').value  = c.date;
  document.getElementById('heure').value = c.heure;

  document.getElementById('students-list').innerHTML = '';
  studentCount = 0;
  c.eleves.forEach(e => addStudentUI(e));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  document.getElementById('error-summary').classList.remove('visible');
  document.getElementById('students-list').innerHTML = '';
  const now = new Date();
  document.getElementById('date').value  = now.toISOString().slice(0, 10);
  document.getElementById('heure').value = now.toTimeString().slice(0, 5);
  studentCount = 0;
  renderEmptyState();
}

async function handleSaveCase() {
  const cards = document.querySelectorAll('.student-card');
  if (cards.length === 0) {
    toast('Aucun élève à enregistrer.', true);
    return;
  }

  const dateVal  = document.getElementById('date').value;
  const heureVal = document.getElementById('heure').value;
  let ok = true;

  if (!dateVal) { document.getElementById('date').classList.add('invalid'); ok=false; }
  if (!heureVal) { document.getElementById('heure').classList.add('invalid'); ok=false; }

  // Extract form
  const students = [];
  cards.forEach(card => {
    const nom  = card.querySelector('[data-field="nom"]').value.trim();
    const classe = card.querySelector('[data-field="classe"]').value.trim();
    const type = card.querySelector('[data-field="type"]').value;
    const membre = card.querySelector('[data-field="membre"]').value;
    const lie_a= card.querySelector('[data-field="lie_a"]').value;
    
    if(!nom || !classe || !type || ((type==='temoin'||type==='intimidateur') && !lie_a)) {
      ok = false;
      card.classList.add('error');
    } else {
      students.push({ nom, classe, type: TO_BACK[type] || type, membre, lie_a });
    }
  });

  if (!ok) {
    toast('Veuillez corriger les champs.', true);
    return;
  }

  if (!students.some(s => s.type === 'VICTIME')) {
    toast('Ajoutez au moins une Victime.', true);
    return;
  }

  // Dispatch Action To Store
  const success = await store.saveCase({ date: dateVal, heure: heureVal, eleves: students });
  if(success) {
    toast('Cas sauvegardé avec succès !');
    resetForm();
  } else {
    toast('Erreur, vérifiez la console', true);
  }
}

// ══════════════════════════════════════════════════════════
//  HISTORY RENDERER (Called purely from Reactivity Loop)
// ══════════════════════════════════════════════════════════

function renderHistoryUI(filteredCases, state) {
  const container = document.getElementById('history-list');
  const countEl = document.getElementById('search-count');
  const totalCount = state.cases.length;

  countEl.textContent = state.searchQuery
    ? `${filteredCases.length} résultat${filteredCases.length !== 1 ? 's' : ''}`
    : (totalCount ? `${totalCount} cas` : '');

  if (filteredCases.length === 0) {
    container.innerHTML = state.searchQuery
      ? '<div class="empty-history">Aucun cas trouvé pour cette recherche.</div>'
      : '<div class="empty-history">Aucun cas enregistré pour le moment.</div>';
    return;
  }

  container.innerHTML = filteredCases.map((c) => {
    const lines = c.eleves.map(e =>
      `<div class="student-entry" style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem;">
        <span class="badge" style="background: var(--${typeClass(e.type)}); color: #fff; min-width: 90px; text-align: center;">${typeLabel(e.type)}</span>
        <span style="font-weight: 700;">${e.nom}</span>
        ${e.membre ? `<span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.75rem;">👤 ${e.membre}</span>` : ''}
      </div>`
    ).join('');

    return `
      <div class="card history-card animate-reveal" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
          <div>
            <div style="font-family: var(--font-display); font-size: 1.1rem; color: var(--primary); font-weight: 700;">📅 Dossier du ${formatDate(c.date)}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">🕘 ${c.heure}</div>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-ghost" style="padding: 0.4rem 0.75rem; font-size: 0.75rem;" data-edit-case="${c.id}" title="Modifier">✏️</button>
            <button class="btn btn-ghost" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; color: var(--primary);" data-schedule-case="${c.id}" title="Planifier">📅</button>
            <button class="btn btn-ghost" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; color: var(--accent);" data-delete-case="${c.id}" title="Supprimer">✕</button>
          </div>
        </div>
        <div class="history-students">${lines}</div>
      </div>
    `;
  }).join('');

  const cards = container.querySelectorAll('.history-card');
  animateHistoryStagger(cards);
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function typeIcon(t)  { return { VICTIME:'🔴', TEMOIN:'🟡', INTIMIDATEUR:'🟣', victime:'🔴', temoin:'🟡', intimidateur:'🟣' }[t] || ''; }
function typeLabel(t) { return { VICTIME:'Victime', TEMOIN:'Témoin', INTIMIDATEUR:'Intimidateur', victime:'Victime', temoin:'Témoin', intimidateur:'Intimidateur' }[t] || t; }
function typeClass(t) { return TO_FRONT[t] || t; }

// ══════════════════════════════════════════════════════════
//  I/O JSON
// ══════════════════════════════════════════════════════════

function processImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (confirm(`Importer ${data.length} cas ? Cela remplacera vos données locales.`)) {
        store.importJSON(data);
        toast('Données importées avec succès !');
      }
    } catch (err) {
      toast('Erreur lors de la lecture du fichier JSON.', true);
    }
    event.target.value = ''; 
  };
  reader.readAsText(file);
}

function exportJSON() {
  const cachedCases = store.getState().cases;
  if (cachedCases.length === 0) { toast('Aucun cas à exporter.', true); return; }
  const blob = new Blob([JSON.stringify(cachedCases, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `phare_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function printReport() {
  const cachedCases = store.getState().cases;
  if (cachedCases.length === 0) { toast('Aucun cas à imprimer.', true); return; }
  // HTML logic
  const colors = { VICTIME:'#c0392b', TEMOIN:'#9a7d0a', INTIMIDATEUR:'#6c2d8b' };
  const bgs    = { VICTIME:'#fdecea', TEMOIN:'#fef9e7', INTIMIDATEUR:'#f0e0f7' };
  const rows = cachedCases.map(c => {
    const trs = c.eleves.map(e => `<tr><td style="padding:6px 10px;border:1px solid #ddd">${e.nom}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:center"><span style="background:${bgs[TO_BACK[e.type] || e.type]};color:${colors[TO_BACK[e.type] || e.type]};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700">${typeLabel(e.type)}</span></td><td style="padding:6px 10px;border:1px solid #ddd">${e.membre || '—'}</td></tr>`).join('');
    return `<div style="margin-bottom:24px;page-break-inside:avoid"><h3 style="margin:0 0 6px;color:#1a5632">${formatDate(c.date)} à ${c.heure}</h3><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#e8f0eb"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Nom</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:center">Type</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Membre</th></tr></thead><tbody>${trs}</tbody></table></div>`;
  }).join('');
  
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;max-width:800px;margin:auto;padding:32px}</style></head><body><h1>Rapport pHARe</h1>${rows}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

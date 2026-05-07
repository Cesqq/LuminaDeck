// Studio drag/drop profile editor. Loads the active profile from the Rust
// backend, renders a SortableJS-powered palette + grid + inspector, and
// pushes changes back via `save_active_profile` which also broadcasts a
// `profile_update` WS message to subscribed mobile clients.

import { ACTION_CATALOG, CATEGORIES, CATEGORY_LABELS, GRID_DIMENSIONS, findCatalogEntry, totalCells } from './action-catalog.js';
import { attachInspector, setSelection, clearSelection } from './inspector.js';

const { invoke } = window.__TAURI__.core;

const SAVE_DEBOUNCE_MS = 400;

/**
 * Action types that FREE_LIMITS in `packages/shared/src/types.ts` rejects.
 * Source of truth — keep in sync if FREE_LIMITS changes.
 */
const PRO_ONLY_ACTION_TYPES = new Set([
  'obs',
  'discord',
  'macro',
  'multi_action',
  'folder',
]);

let profile = null;
let currentPageId = null;
let selectedButtonId = null;
let saveTimer = null;
let initialised = false;
let gateWired = false;
let proLocked = true; // pessimistic until paired phone reports Pro

function getPeerState() {
  return window.__LUMINA_PEER_STATE || { connected: false, isPro: false };
}

export async function initEditor() {
  wireGate();
  applyGateState(getPeerState());
  // Don't pull a profile into memory until a phone is actually connected —
  // the editor needs the phone's Pro tier to decide what's locked.
  if (!getPeerState().connected) return;
  await loadEditorInternal();
}

function wireGate() {
  if (gateWired) return;
  gateWired = true;
  const gate = document.getElementById('editor-gate');
  // Clicks on the "Go to Pair Device" link inside the gate drive the main
  // navigation without reloading the app — reuses the existing .nav-item
  // click handler by programmatically clicking the matching sidebar entry.
  gate?.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jump-to-page]');
    if (!a) return;
    e.preventDefault();
    const navItem = document.querySelector(`.nav-item[data-page="${a.dataset.jumpToPage}"]`);
    if (navItem) navItem.click();
  });
  window.addEventListener('lumina-peer-change', (e) => {
    applyGateState(e.detail || getPeerState());
  });
}

function applyGateState(state) {
  const gate = document.getElementById('editor-gate');
  const layout = document.getElementById('editor-layout');
  if (!gate || !layout) return;
  if (state.connected) {
    gate.style.display = 'none';
    layout.style.display = '';
    if (!initialised) void loadEditorInternal();
    applyProGating(state.isPro);
  } else {
    gate.style.display = '';
    layout.style.display = 'none';
  }
}

function applyProGating(isPro) {
  proLocked = !isPro;
  const list = document.getElementById('palette-list');
  if (!list) return;
  // Remove any existing banner so we don't double-stack on repeat calls.
  list.querySelector('.editor-pro-banner')?.remove();
  if (proLocked) {
    const banner = document.createElement('div');
    banner.className = 'editor-pro-banner';
    banner.innerHTML = '<strong>Free tier</strong> — multi-action, OBS, Discord, macros and folders are locked on your paired phone. Upgrade to Pro in the mobile app to unlock.';
    list.insertBefore(banner, list.firstChild);
  }
  for (const tile of list.querySelectorAll('.palette-tile')) {
    const type = tile.dataset.actionType;
    if (!PRO_ONLY_ACTION_TYPES.has(type)) continue;
    tile.dataset.proOnly = 'true';
    tile.dataset.proLocked = String(proLocked);
    const label = tile.querySelector('.palette-tile-label');
    if (label && !label.querySelector('.pro-pill')) {
      const pill = document.createElement('span');
      pill.className = 'pro-pill';
      pill.textContent = 'PRO';
      label.appendChild(pill);
    }
  }
}

async function loadEditorInternal() {
  if (initialised) return;
  initialised = true;
  console.log('[editor] loadEditorInternal starting');
  try {
    profile = await invoke('get_active_profile');
    console.log('[editor] loaded profile:', profile);
  } catch (e) {
    console.error('[editor] get_active_profile failed', e);
    toast('Failed to load profile: ' + e, 'error');
    initialised = false;
    return;
  }
  if (!profile.pages || profile.pages.length === 0) {
    profile.pages = [newPage(1, '3x4')];
  }
  currentPageId = profile.pages[0].id;

  if (typeof window.Sortable !== 'function') {
    console.warn('[editor] SortableJS missing — drag/drop disabled, click/dblclick still work');
    toast('SortableJS failed to load — click to place tiles instead', 'error');
  }

  renderPalette();
  renderPageTabs();
  renderGrid();
  wireToolbar();
  wireCategoryFilters();
  wireSearch();

  attachInspector({
    onChange: (updated) => applyButtonUpdate(updated),
    onDelete: (btn) => { removeButton(btn.id); clearSelection(); queueSave(); },
  });

  // Re-apply Pro gating now that palette tiles exist — handles the race
  // where applyGateState fired before renderPalette() populated the list.
  applyProGating(getPeerState().isPro);

  toast('Editor ready — ' + profile.pages.length + ' page' + (profile.pages.length === 1 ? '' : 's'), 'success');
  console.log('[editor] ready');
}

// ── Palette ───────────────────────────────────────────────
function renderPalette() {
  const list = document.getElementById('palette-list');
  const cats = document.getElementById('palette-categories');
  list.innerHTML = '';
  cats.innerHTML = '';

  // "All" + one chip per category that actually has entries
  const visibleCats = CATEGORIES.filter(c => ACTION_CATALOG.some(e => e.category === c));
  cats.appendChild(categoryChip('all', 'All', true));
  for (const c of visibleCats) {
    cats.appendChild(categoryChip(c, CATEGORY_LABELS[c]));
  }

  for (const entry of ACTION_CATALOG) {
    list.appendChild(paletteTile(entry));
  }

  if (window.Sortable) {
    new window.Sortable(list, {
      group: { name: 'tiles', pull: 'clone', put: false },
      sort: false,
      animation: 120,
      // WebView2's native HTML5 drag-drop is flaky — force SortableJS's
      // pointer-based fallback. It gives us the same API plus reliable
      // drag-through-iframe/overlay behaviour.
      forceFallback: true,
      fallbackClass: 'sortable-drag',
      fallbackTolerance: 4,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
    });
  }
}

function categoryChip(id, label, active = false) {
  const chip = document.createElement('div');
  chip.className = 'palette-category' + (active ? ' active' : '');
  chip.textContent = label;
  chip.dataset.category = id;
  chip.addEventListener('click', () => {
    document.querySelectorAll('.palette-category').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filterPalette();
  });
  return chip;
}

function paletteTile(entry) {
  const el = document.createElement('div');
  el.className = 'palette-tile';
  el.dataset.actionType = entry.actionType;
  el.dataset.category = entry.category;
  el.title = 'Click to place in first empty slot, or drag onto the grid';
  el.innerHTML = `
    <div class="palette-tile-icon">${entry.icon}</div>
    <div class="palette-tile-body">
      <div class="palette-tile-label"></div>
      <div class="palette-tile-desc"></div>
    </div>
  `;
  el.querySelector('.palette-tile-label').textContent = entry.label;
  el.querySelector('.palette-tile-desc').textContent = entry.description;
  const place = () => {
    if (proLocked && PRO_ONLY_ACTION_TYPES.has(entry.actionType)) {
      toast('Pro-only tile — upgrade Lumina Deck on your phone to unlock', 'error');
      return;
    }
    const page = activePage();
    const slot = firstEmptySlot(page);
    if (slot === -1) { toast('No empty slots on this page', 'error'); return; }
    placeButton(page, slot, entry);
    queueSave();
    renderGrid();
    const newBtn = findButton(page, slot);
    if (newBtn) setSelectedButtonId(newBtn.id);
  };
  // Single click works even when SortableJS is unavailable; dblclick is
  // kept as a power-user shortcut that matches drag behaviour.
  el.addEventListener('click', place);
  el.addEventListener('dblclick', place);
  return el;
}

function filterPalette() {
  const activeCat = document.querySelector('.palette-category.active')?.dataset.category || 'all';
  const search = (document.getElementById('palette-search')?.value || '').toLowerCase();
  for (const tile of document.querySelectorAll('.palette-tile')) {
    const matchesCat = activeCat === 'all' || tile.dataset.category === activeCat;
    const matchesSearch = !search
      || tile.querySelector('.palette-tile-label').textContent.toLowerCase().includes(search)
      || tile.querySelector('.palette-tile-desc').textContent.toLowerCase().includes(search);
    tile.style.display = matchesCat && matchesSearch ? '' : 'none';
  }
}

function wireCategoryFilters() { /* handled inline via categoryChip */ }

function wireSearch() {
  const input = document.getElementById('palette-search');
  if (input) input.addEventListener('input', filterPalette);
}

// ── Grid ──────────────────────────────────────────────────
function renderGrid() {
  const gridEl = document.getElementById('editor-grid');
  const page = activePage();
  const dims = GRID_DIMENSIONS[page.layout] || GRID_DIMENSIONS['3x4'];
  gridEl.style.gridTemplateColumns = `repeat(${dims.cols}, 1fr)`;
  gridEl.style.gridTemplateRows = `repeat(${dims.rows}, auto)`;
  gridEl.innerHTML = '';

  const total = dims.cols * dims.rows;
  for (let i = 0; i < total; i++) {
    gridEl.appendChild(cellEl(page, i));
  }

  if (window.Sortable) {
    new window.Sortable(gridEl, {
      group: 'tiles',
      animation: 150,
      forceFallback: true,
      fallbackClass: 'sortable-drag',
      fallbackTolerance: 4,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onAdd: (evt) => onPaletteDrop(evt),
      onUpdate: (evt) => onGridReorder(evt),
    });
  }

  const picker = document.getElementById('layout-picker');
  if (picker) picker.value = page.layout;

  updateStatus(`Page ${page.name} · ${dims.cols}×${dims.rows} · ${page.buttons.length}/${total} used`);
}

function cellEl(page, position) {
  const btn = findButton(page, position);
  const cell = document.createElement('div');
  cell.className = 'editor-cell' + (btn ? ' filled' : '');
  if (btn?.customImage) cell.classList.add('has-image');
  cell.dataset.position = String(position);
  if (btn) {
    cell.dataset.buttonId = btn.id;
    cell.title = 'Click to edit';
    if (btn.id === selectedButtonId) cell.classList.add('selected');
    if (btn.color && !btn.customImage) cell.style.borderColor = btn.color;
    const imgHtml = btn.customImage
      ? `<img class="editor-cell-image" src="${escapeHtml(btn.customImage)}" alt="">`
      : '';
    cell.innerHTML = `
      ${imgHtml}
      <div class="editor-cell-icon">${btn.customImage ? '' : escapeHtml(btn.icon || iconForAction(btn.action))}</div>
      <div class="editor-cell-label"></div>
      <div class="editor-cell-type-badge">${escapeHtml(btn.action?.type || 'empty')}</div>
    `;
    cell.querySelector('.editor-cell-label').textContent = btn.label || '';
  } else {
    cell.title = 'Empty slot — click a palette tile on the left, or drag one here';
    cell.innerHTML = '<div class="editor-cell-icon" style="opacity:0.25">+</div>';
  }
  cell.addEventListener('click', () => {
    if (btn) setSelectedButtonId(btn.id);
    else clearSelectedButton();
  });
  return cell;
}

function iconForAction(action) {
  if (!action) return '+';
  const entry = findCatalogEntry(action.type);
  return entry?.icon || '?';
}

// ── Page tabs ─────────────────────────────────────────────
function renderPageTabs() {
  const host = document.getElementById('editor-page-tabs');
  host.innerHTML = '';
  for (const pg of profile.pages) {
    const tab = document.createElement('div');
    tab.className = 'page-tab' + (pg.id === currentPageId ? ' active' : '');
    tab.dataset.pageId = pg.id;
    tab.innerHTML = `
      <span class="page-tab-label"></span>
      ${profile.pages.length > 1 ? '<button class="page-tab-close" title="Remove page">×</button>' : ''}
    `;
    tab.querySelector('.page-tab-label').textContent = pg.name;
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.page-tab-close')) {
        e.stopPropagation();
        if (confirm(`Remove page "${pg.name}"?`)) {
          removePage(pg.id);
        }
        return;
      }
      currentPageId = pg.id;
      clearSelectedButton();
      renderPageTabs();
      renderGrid();
    });
    tab.addEventListener('dblclick', () => {
      const next = prompt('Rename page', pg.name);
      if (next && next.trim()) {
        pg.name = next.trim();
        renderPageTabs();
        queueSave();
      }
    });
    host.appendChild(tab);
  }
}

function addPage() {
  const dims = activePage().layout || '3x4';
  const page = newPage(profile.pages.length + 1, dims);
  profile.pages.push(page);
  currentPageId = page.id;
  clearSelectedButton();
  renderPageTabs();
  renderGrid();
  queueSave();
}

function removePage(pageId) {
  if (profile.pages.length <= 1) return;
  profile.pages = profile.pages.filter(p => p.id !== pageId);
  if (currentPageId === pageId) currentPageId = profile.pages[0].id;
  clearSelectedButton();
  renderPageTabs();
  renderGrid();
  queueSave();
}

function newPage(n, layout) {
  return {
    id: 'page-' + crypto.randomUUID().slice(0, 8),
    name: 'Page ' + n,
    buttons: [],
    layout,
  };
}

// ── Toolbar ───────────────────────────────────────────────
function wireToolbar() {
  document.getElementById('btn-add-page')?.addEventListener('click', addPage);
  document.getElementById('btn-reload-profile')?.addEventListener('click', async () => {
    profile = await invoke('get_active_profile');
    currentPageId = profile.pages[0]?.id || null;
    clearSelectedButton();
    renderPageTabs();
    renderGrid();
    toast('Reloaded from disk');
  });
  document.getElementById('btn-push-to-phone')?.addEventListener('click', pushNow);
  document.getElementById('btn-export-profile')?.addEventListener('click', exportProfile);
  document.getElementById('btn-import-profile')?.addEventListener('click', importProfile);
  document.getElementById('btn-import-sd')?.addEventListener('click', importStreamDeckProfile);
  document.getElementById('layout-picker')?.addEventListener('change', (e) => {
    const page = activePage();
    page.layout = e.target.value;
    // Clip out-of-range buttons
    const total = totalCells(page.layout);
    page.buttons = page.buttons.filter(b => b.position < total);
    renderGrid();
    queueSave();
  });
}

async function exportProfile() {
  // Ensure the latest in-memory edits are flushed before export so the
  // file reflects exactly what's on-screen.
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await doSave();
  try {
    const path = await invoke('export_profile_to_file');
    if (path) toast('Exported to ' + path, 'success');
  } catch (e) {
    toast('Export failed: ' + e, 'error');
  }
}

async function importProfile() {
  try {
    const imported = await invoke('import_profile_from_file');
    if (!imported) return;
    profile = imported;
    currentPageId = profile.pages[0]?.id || null;
    clearSelectedButton();
    renderPageTabs();
    renderGrid();
    toast('Imported profile: ' + profile.name, 'success');
  } catch (e) {
    toast('Import failed: ' + e, 'error');
  }
}

async function importStreamDeckProfile() {
  try {
    const result = await invoke('import_stream_deck_profile');
    if (!result) return;
    profile = result.profile;
    currentPageId = profile.pages[0]?.id || null;
    clearSelectedButton();
    renderPageTabs();
    renderGrid();
    const imported = result.importedCount ?? 0;
    const unsup = (result.unsupported || []).length;
    const warns = (result.warnings || []).length;
    let msg = `Imported ${imported} buttons from hardware-deck profile`;
    if (unsup > 0) msg += `, ${unsup} placeholder (unsupported action)`;
    if (warns > 0) msg += `, ${warns} warning${warns === 1 ? '' : 's'}`;
    toast(msg, unsup > 0 ? 'error' : 'success');
    if (warns > 0) console.warn('[sd-import]', result.warnings);
  } catch (e) {
    toast('Hardware-deck profile import failed: ' + e, 'error');
  }
}

async function pushNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await doSave();
  toast('Pushed to connected devices', 'success');
}

// ── Drag handlers ─────────────────────────────────────────
function onPaletteDrop(evt) {
  const item = evt.item;
  const actionType = item.dataset?.actionType;
  const position = evt.newIndex;
  const page = activePage();
  // SortableJS inserted the cloned palette tile as a DOM node; replace it
  // by re-rendering. We only care about the data-level change.
  const entry = findCatalogEntry(actionType);
  if (entry) {
    const existing = findButton(page, position);
    if (existing) {
      // Replace the existing button's action to the dropped tile
      existing.action = entry.defaultAction();
    } else {
      placeButton(page, position, entry);
    }
  }
  queueSave();
  renderGrid();
  const newBtn = findButton(page, position);
  if (newBtn) setSelectedButtonId(newBtn.id);
}

function onGridReorder(evt) {
  const page = activePage();
  const oldPos = evt.oldIndex;
  const newPos = evt.newIndex;
  if (oldPos === newPos) return;
  const moving = findButton(page, oldPos);
  const swapped = findButton(page, newPos);
  if (moving) moving.position = newPos;
  if (swapped) swapped.position = oldPos;
  queueSave();
  renderGrid();
}

// ── Mutation helpers ──────────────────────────────────────
function activePage() {
  return profile.pages.find(p => p.id === currentPageId) || profile.pages[0];
}

function findButton(page, position) {
  return page.buttons.find(b => b.position === position) || null;
}

function firstEmptySlot(page) {
  const total = totalCells(page.layout);
  for (let i = 0; i < total; i++) {
    if (!findButton(page, i)) return i;
  }
  return -1;
}

function placeButton(page, position, entry) {
  page.buttons.push({
    id: 'btn-' + crypto.randomUUID().slice(0, 8),
    action: entry.defaultAction(),
    page: 0,
    position,
  });
}

function removeButton(buttonId) {
  const page = activePage();
  page.buttons = page.buttons.filter(b => b.id !== buttonId);
  renderGrid();
}

function applyButtonUpdate(updated) {
  const page = activePage();
  const idx = page.buttons.findIndex(b => b.id === updated.id);
  if (idx !== -1) page.buttons[idx] = updated;
  renderGrid();
  queueSave();
}

function setSelectedButtonId(id) {
  selectedButtonId = id;
  document.querySelectorAll('.editor-cell').forEach(c => c.classList.remove('selected'));
  if (id) {
    const cell = document.querySelector(`.editor-cell[data-button-id="${id}"]`);
    if (cell) cell.classList.add('selected');
    const btn = activePage().buttons.find(b => b.id === id);
    if (btn) setSelection(btn);
  } else {
    clearSelection();
  }
}

function clearSelectedButton() {
  selectedButtonId = null;
  document.querySelectorAll('.editor-cell').forEach(c => c.classList.remove('selected'));
  clearSelection();
}

// ── Save (debounced) ──────────────────────────────────────
function queueSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, SAVE_DEBOUNCE_MS);
}

async function doSave() {
  saveTimer = null;
  profile.updatedAt = new Date().toISOString();
  try {
    await invoke('save_active_profile', { profile });
    updateStatus('Saved ' + new Date().toLocaleTimeString());
  } catch (e) {
    toast('Save failed: ' + e, 'error');
  }
}

// ── Misc helpers ──────────────────────────────────────────
function updateStatus(text) {
  const el = document.getElementById('editor-status');
  if (el) el.textContent = text;
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = 'editor-toast ' + kind;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 2200);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

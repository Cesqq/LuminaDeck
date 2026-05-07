// Auto-Switch — global rule editor. Each rule binds a process name to a
// profile id. The Rust matcher task runs on every window-change and emits
// `profile_switch` to every connected device when a rule fires.

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

let initialised = false;
let rules = [];
let lastWindow = null;

export async function initAutoProfile() {
  if (initialised) return;
  initialised = true;

  document.getElementById('ap-add-rule')?.addEventListener('click', () => {
    rules.push({ processName: '', profileId: '' });
    renderRules();
  });
  document.getElementById('ap-refresh-window')?.addEventListener('click', refreshActiveWindow);

  // Track the live foreground app so the per-rule capture button has
  // something to grab even before the user opens this page mid-session.
  listen('active-window-change', (e) => {
    lastWindow = e.payload?.process_name || null;
    updateActiveWindowDisplay();
  });

  await Promise.all([loadRules(), refreshActiveWindow()]);
}

async function loadRules() {
  try {
    rules = (await invoke('get_profile_rules')) || [];
  } catch (e) {
    console.error('get_profile_rules failed', e);
    rules = [];
  }
  renderRules();
}

async function refreshActiveWindow() {
  try {
    const w = await invoke('get_current_active_window');
    if (w) lastWindow = w;
  } catch (e) {
    console.error('get_current_active_window failed', e);
  }
  updateActiveWindowDisplay();
}

function updateActiveWindowDisplay() {
  const el = document.getElementById('ap-active-window');
  if (el) el.textContent = lastWindow || '— (no foreground detected)';
}

function renderRules() {
  const host = document.getElementById('ap-rules-list');
  if (!host) return;
  host.innerHTML = '';
  if (rules.length === 0) {
    host.innerHTML = '<div class="empty">No rules yet — add one to bind a process to a profile.</div>';
    return;
  }
  rules.forEach((rule, idx) => {
    host.appendChild(ruleRow(rule, idx));
  });
}

function ruleRow(rule, idx) {
  const row = document.createElement('div');
  row.className = 'auto-rule-row';
  row.innerHTML = `
    <div class="auto-rule-fields">
      <div class="auto-rule-field">
        <label class="field-label">Process name</label>
        <div class="auto-rule-process">
          <input class="field-input" type="text" placeholder="chrome.exe" />
          <button class="btn-xs btn-secondary" data-act="capture" title="Capture current foreground window">↧ Capture</button>
        </div>
      </div>
      <div class="auto-rule-field">
        <label class="field-label">Profile ID</label>
        <input class="field-input" type="text" placeholder="profile-id" />
      </div>
    </div>
    <button class="btn-xs btn-danger auto-rule-remove" data-act="remove" title="Remove rule">×</button>
  `;
  const [procInput, profileInput] = row.querySelectorAll('.field-input');
  procInput.value = rule.processName || '';
  profileInput.value = rule.profileId || '';

  procInput.addEventListener('input', () => { rule.processName = procInput.value; persistDebounced(); });
  profileInput.addEventListener('input', () => { rule.profileId = profileInput.value; persistDebounced(); });

  row.querySelector('[data-act="capture"]').addEventListener('click', () => {
    if (!lastWindow) {
      alert('No foreground window detected yet. Click an app on your desktop first.');
      return;
    }
    rule.processName = lastWindow;
    procInput.value = lastWindow;
    persistDebounced();
  });

  row.querySelector('[data-act="remove"]').addEventListener('click', () => {
    rules.splice(idx, 1);
    renderRules();
    persistImmediate();
  });

  return row;
}

let saveTimer = null;
function persistDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistImmediate, 400);
}

async function persistImmediate() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  // Strip empty rows server-side; UI keeps blanks while editing.
  const clean = rules.filter(r => r.processName.trim() && r.profileId.trim());
  try {
    await invoke('set_profile_rules', { rules: clean });
  } catch (e) {
    console.error('set_profile_rules failed', e);
  }
}

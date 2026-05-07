// Studio plugins page — replaces the static badge cards with live status
// + a per-plugin config form rendered from each plugin's `config_schema`.

const { invoke } = window.__TAURI__.core;

let initialised = false;
let openPanels = new Set();

export async function initPlugins() {
  if (initialised) return;
  initialised = true;
  await refresh();
  // Light periodic refresh — picks up status changes from external events
  // (e.g. OBS launched after Studio).
  setInterval(refresh, 10000);
}

export async function refresh() {
  const host = document.getElementById('page-plugins');
  if (!host) return;
  let statuses;
  try {
    statuses = await invoke('get_plugin_status');
  } catch (e) {
    host.innerHTML = `<div class="empty">Failed to load plugins: ${escapeHtml(String(e))}</div>`;
    return;
  }
  // Drop the legacy static cards on first run.
  host.innerHTML = '';
  for (const status of statuses) {
    host.appendChild(await pluginCard(status));
  }
}

async function pluginCard(status) {
  const card = document.createElement('div');
  card.className = 'plugin-card';
  card.innerHTML = `
    <div class="plugin-icon" style="background:rgba(108,92,231,0.15)">${iconFor(status.name)}</div>
    <div class="plugin-info">
      <div class="plugin-name"></div>
      <div class="plugin-desc"></div>
    </div>
    <span class="plugin-status ${status.available ? 'badge-green' : 'badge-red'}"></span>
    <button class="btn-xs btn-secondary" data-action="configure">Configure</button>
  `;
  card.querySelector('.plugin-name').textContent = displayName(status.name);
  card.querySelector('.plugin-desc').textContent = status.capabilities.join(' · ') || 'No capabilities';
  card.querySelector('.plugin-status').textContent = status.available ? 'Connected' : 'Disconnected';

  const panel = document.createElement('div');
  panel.className = 'plugin-config-panel';
  panel.style.display = openPanels.has(status.name) ? 'block' : 'none';
  if (openPanels.has(status.name)) {
    await renderConfigPanel(status.name, panel);
  }

  const wrap = document.createElement('div');
  wrap.appendChild(card);
  wrap.appendChild(panel);

  card.querySelector('[data-action="configure"]').addEventListener('click', async () => {
    if (openPanels.has(status.name)) {
      openPanels.delete(status.name);
      panel.style.display = 'none';
    } else {
      openPanels.add(status.name);
      panel.innerHTML = '<div class="empty">Loading…</div>';
      panel.style.display = 'block';
      await renderConfigPanel(status.name, panel);
    }
  });

  return wrap;
}

async function renderConfigPanel(name, panel) {
  let payload;
  try {
    payload = await invoke('get_plugin_config', { name });
  } catch (e) {
    panel.innerHTML = `<div class="empty">Failed: ${escapeHtml(String(e))}</div>`;
    return;
  }
  const schema = payload.schema || {};
  const config = payload.config || {};
  const fields = Array.isArray(schema.fields) ? schema.fields : [];

  panel.innerHTML = '';

  if (schema.description) {
    const desc = document.createElement('div');
    desc.className = 'plugin-config-desc';
    desc.textContent = schema.description;
    panel.appendChild(desc);
  }

  const form = document.createElement('div');
  form.className = 'plugin-config-form';
  const inputs = {};

  for (const f of fields) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = f.label || f.id;
    row.appendChild(lbl);

    let input;
    if (f.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'field-input';
      if (f.min !== undefined) input.min = String(f.min);
      if (f.max !== undefined) input.max = String(f.max);
      input.value = config[f.id] ?? f.default ?? '';
    } else if (f.type === 'password') {
      input = document.createElement('input');
      input.type = 'password';
      input.className = 'field-input';
      input.placeholder = config.passwordSet ? '•••••• (saved — leave blank to keep)' : 'Enter password';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'field-input';
      if (f.placeholder) input.placeholder = f.placeholder;
      input.value = config[f.id] ?? f.default ?? '';
    }
    inputs[f.id] = { input, type: f.type };
    row.appendChild(input);

    if (f.help) {
      const help = document.createElement('div');
      help.className = 'field-help';
      help.textContent = f.help;
      row.appendChild(help);
    }
    form.appendChild(row);
  }

  const buttons = document.createElement('div');
  buttons.className = 'plugin-config-buttons';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-xs btn-primary';
  saveBtn.textContent = 'Save & Reconnect';
  saveBtn.addEventListener('click', async () => {
    const cfg = {};
    for (const [id, meta] of Object.entries(inputs)) {
      if (meta.type === 'number') {
        const n = parseInt(meta.input.value, 10);
        if (!Number.isNaN(n)) cfg[id] = n;
      } else if (meta.type === 'password') {
        // Only send password if the user typed something — empty means keep
        if (meta.input.value.length > 0) cfg[id] = meta.input.value;
      } else {
        if (meta.input.value !== '') cfg[id] = meta.input.value;
      }
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await invoke('configure_plugin', { name, config: cfg });
      saveBtn.textContent = 'Saved';
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save & Reconnect'; }, 1200);
      refresh();
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Reconnect';
      alert('Save failed: ' + e);
    }
  });
  buttons.appendChild(saveBtn);

  const testBtn = document.createElement('button');
  testBtn.className = 'btn-xs btn-secondary';
  testBtn.textContent = 'Test Connection';
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing…';
    try {
      const ok = await invoke('test_plugin', { name });
      testBtn.textContent = ok ? '✓ Connected' : '✗ Unreachable';
      setTimeout(() => { testBtn.disabled = false; testBtn.textContent = 'Test Connection'; }, 1500);
    } catch (e) {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
      alert('Test failed: ' + e);
    }
  });
  buttons.appendChild(testBtn);

  panel.appendChild(form);
  panel.appendChild(buttons);
}

function iconFor(name) {
  switch (name) {
    case 'obs': return '🎬';
    case 'discord': return '💬';
    case 'window_monitor': return '🪟';
    default: return '⚡';
  }
}
function displayName(name) {
  switch (name) {
    case 'obs': return 'OBS Studio';
    case 'discord': return 'Discord';
    case 'window_monitor': return 'Window Monitor';
    default: return name;
  }
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

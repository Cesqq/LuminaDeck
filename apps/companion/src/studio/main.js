// LuminaDeck Studio — main entry. A0.2a (lite): extracted from inline
// <script type="module"> in index.html so we can drop 'unsafe-inline' from
// the script-src CSP. Further decomposition into per-page modules
// (router/devices/plugins/settings) lands with A1's Studio editor.

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// ── Navigation ─────────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');
const topTitle = document.getElementById('topbar-title');

const pageTitles = {
  dashboard: 'Dashboard',
  pair: 'Pair Device',
  devices: 'Devices',
  editor: 'Editor',
  'auto-profile': 'Auto-Switch',
  plugins: 'Plugins',
  settings: 'Settings',
};

// Lazy-load heavy pages so first paint stays fast.
const lazyPages = {
  editor: () => import('./editor.js').then(m => m.initEditor()),
  plugins: () => import('./plugins.js').then(m => m.initPlugins()),
  'auto-profile': () => import('./auto-profile.js').then(m => m.initAutoProfile()),
};
const lazyLoaded = new Set();

navItems.forEach(item => {
  item.addEventListener('click', async () => {
    const page = item.dataset.page;
    navItems.forEach(n => n.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    topTitle.textContent = pageTitles[page] || page;

    if (lazyPages[page] && !lazyLoaded.has(page)) {
      lazyLoaded.add(page);
      try { await lazyPages[page](); } catch (e) {
        lazyLoaded.delete(page);
        console.error('Failed to load ' + page, e);
      }
    }
  });
});

// ── Click delegation (replaces onclick="..." inline handlers) ─
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-copy-target]');
  if (copyBtn) {
    const text = document.getElementById(copyBtn.dataset.copyTarget)?.textContent;
    if (text && text !== '—') navigator.clipboard.writeText(text);
    return;
  }
  const removeBtn = e.target.closest('[data-remove-id]');
  if (removeBtn) {
    invoke('remove_paired_device', { deviceId: removeBtn.dataset.removeId })
      .then(refreshDevices)
      .catch(console.error);
  }
});

// ── Server info ────────────────────────────────────────────
async function refreshInfo() {
  try {
    const info = await invoke('get_server_info');
    document.getElementById('local-ip').textContent = info.ip;
    document.getElementById('manual-ip').textContent = info.ip;
    document.getElementById('sidebar-ip').textContent = `${info.ip}:9877`;
    document.getElementById('stat-connected').textContent = String(info.connectedDevices);
    document.getElementById('stat-paired').textContent = String(info.pairedCount);
    document.getElementById('cert-fp').textContent = info.certFingerprint || '—';

    const dot = document.getElementById('sidebar-dot');
    const stxt = document.getElementById('sidebar-status-text');
    if (info.status === 'running') {
      dot.className = 'status-dot';
      stxt.textContent = info.connectedDevices > 0
        ? `${info.connectedDevices} connected`
        : 'Waiting...';
    }
    const verEl = document.getElementById('sidebar-version');
    if (verEl && info.companionVersion) verEl.textContent = `v${info.companionVersion}`;
  } catch (e) { console.error(e); }
}

// ── QR code ────────────────────────────────────────────────
// Payload (~250 bytes) is dense enough that the QR auto-selects ~Type 9-10
// (53-57 modules wide). At 180px each module landed at ~3px, below the iPhone
// camera's reliable scan threshold. 320px puts each module at ~5-6px, plus a
// 16px white quiet-zone border keeps the finder pattern legible against the
// dark card background.
async function generateQR() {
  try {
    const data = await invoke('get_qr_pairing_data');
    const container = document.getElementById('qr-container');
    container.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(data.json);
    qr.make();
    const mc = qr.getModuleCount();
    // Snap module size to an integer pixel so each module renders crisply.
    // Target ≥5px per module; 16px quiet zone on each side.
    const moduleSize = Math.max(5, Math.floor(288 / mc));
    const quiet = 16;
    const size = moduleSize * mc + quiet * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.borderRadius = '12px';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < mc; r++)
      for (let c = 0; c < mc; c++)
        if (qr.isDark(r, c))
          ctx.fillRect(quiet + c * moduleSize, quiet + r * moduleSize, moduleSize, moduleSize);
    container.appendChild(canvas);
  } catch (e) {
    document.getElementById('qr-container').innerHTML = '<div class="empty">QR failed</div>';
  }
}

// ── Devices ────────────────────────────────────────────────
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function refreshDevices() {
  try {
    const devices = await invoke('get_paired_devices');
    const container = document.getElementById('device-list');
    if (devices.length === 0) {
      container.innerHTML = '<div class="empty">No paired devices</div>';
      return;
    }
    container.innerHTML = devices.map(d => `
      <div class="device-card">
        <div class="device-avatar">📱</div>
        <div class="device-details">
          <div class="device-name">${esc(d.name)}</div>
          <div class="device-meta">Paired ${d.paired_at}</div>
        </div>
        <button class="btn-remove" data-remove-id="${esc(d.id)}">Remove</button>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

// ── Connected devices ──────────────────────────────────────
const connectedDevices = new Map();

function renderConnected() {
  const container = document.getElementById('connected-devices-list');
  const badge = document.getElementById('device-badge');
  if (connectedDevices.size === 0) {
    container.innerHTML = '<div class="empty">No devices connected</div>';
    badge.style.display = 'none';
    return;
  }
  badge.textContent = String(connectedDevices.size);
  badge.style.display = '';
  container.innerHTML = '';
  for (const [peer, info] of connectedDevices) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="device-avatar" style="border-color:var(--green)">📱</div>
      <div class="device-details">
        <div class="device-name">${esc(info.name)}</div>
        <div class="device-meta">${esc(peer)} · Protocol v${esc(info.protocol)}</div>
      </div>
      <span class="plugin-status badge-green">Live</span>
    `;
    container.appendChild(card);
  }
}

// ── Events ─────────────────────────────────────────────────

/**
 * Global peer-state accessor — editor.js reads this to decide whether to
 * show the gate or the layout and whether to lock Pro-only palette items.
 * `proStatus` falls back to a conservative Free tier when the paired
 * phone runs a pre-v1.3 protocol that doesn't send the field.
 */
function aggregatePeerState() {
  const peers = Array.from(connectedDevices.values());
  const anyConnected = peers.length > 0;
  // If ANY connected peer is Pro, treat the editor as Pro — most common
  // case is a single paired phone, so this is effectively the phone's tier.
  const anyPro = peers.some((p) => p.proStatus?.isPro === true);
  return {
    connected: anyConnected,
    isPro: anyConnected ? anyPro : false,
    peerCount: peers.length,
  };
}
window.__LUMINA_PEER_STATE = aggregatePeerState();

function broadcastPeerChange() {
  window.__LUMINA_PEER_STATE = aggregatePeerState();
  window.dispatchEvent(new CustomEvent('lumina-peer-change', {
    detail: window.__LUMINA_PEER_STATE,
  }));
}

listen('device-identified', (e) => {
  const { device_name, device_id, peer, protocol_version, proStatus } = e.payload;
  connectedDevices.set(peer, {
    name: device_name,
    id: device_id,
    protocol: protocol_version,
    proStatus: proStatus ?? null,
  });
  renderConnected();
  broadcastPeerChange();
});

listen('connection-change', (e) => {
  const { event_type, peer, active_count } = e.payload;
  if (event_type === 'disconnected') { connectedDevices.delete(peer); renderConnected(); }
  document.getElementById('stat-connected').textContent = String(active_count);
  const stxt = document.getElementById('sidebar-status-text');
  stxt.textContent = active_count > 0 ? `${active_count} connected` : 'Waiting...';
  refreshInfo();
  broadcastPeerChange();
});

listen('active-window-change', (e) => {
  const { process_name } = e.payload;
  const el1 = document.getElementById('active-window');
  const el2 = document.getElementById('active-window-plugins');
  if (el1) el1.textContent = process_name || '—';
  if (el2) el2.textContent = process_name || '—';
});

// When a phone successfully pairs, the active pairing secret on the Rust
// side is consumed (set to None). The QR currently rendered embeds that
// now-invalid secret — any subsequent scan would fail with "Device is not
// paired". Regenerate immediately so the next phone has a usable QR ready.
listen('pairing-complete', () => {
  console.log('[studio] pairing-complete received, regenerating QR');
  generateQR();
  refreshDevices();
});

// ── Init ───────────────────────────────────────────────────
refreshInfo();
generateQR();
refreshDevices();
setInterval(refreshInfo, 10000);
setInterval(refreshDevices, 30000);

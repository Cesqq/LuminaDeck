// Inspector — renders action + appearance fields for the selected button.
// Callers provide the button + a `onChange(updatedButton)` callback; the
// inspector never writes to disk directly, it just produces a new button
// object and lets the editor coordinate saves.

import { ACTION_CATALOG, findCatalogEntry } from './action-catalog.js';

const formEl = document.getElementById('inspector-form');
const emptyEl = document.getElementById('inspector-empty');

let current = null;
let onChange = () => {};
let onDelete = () => {};

export function attachInspector({ onChange: c, onDelete: d }) {
  onChange = c || (() => {});
  onDelete = d || (() => {});
}

export function setSelection(button) {
  current = button;
  if (!button) {
    formEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  formEl.hidden = false;
  render();
}

export function clearSelection() {
  setSelection(null);
}

function render() {
  formEl.innerHTML = '';
  formEl.appendChild(section('Action', [
    actionTypePicker(),
    ...renderActionFields(),
  ]));
  formEl.appendChild(section('Appearance', [
    field('Label', 'text',  current.label || '', { maxLength: 16 }, (v) => update({ label: v || undefined })),
    field('Label position', 'select', current.labelPosition || 'bottom', {
      options: [
        { value: 'bottom', label: 'Bottom' },
        { value: 'top', label: 'Top' },
        { value: 'hidden', label: 'Hidden' },
      ],
    }, (v) => update({ labelPosition: v })),
    field('Icon (emoji or text)', 'text', current.icon || '', { maxLength: 4 },
      (v) => update({ icon: v || undefined })),
    customImageField(current.customImage, (v) => update({ customImage: v || undefined })),
    field('Color', 'color', current.color || '#6c5ce7', {},
      (v) => update({ color: v })),
  ]));
  formEl.appendChild(actionsRow());
}

function section(title, children) {
  const sec = document.createElement('div');
  sec.className = 'inspector-section';
  const header = document.createElement('div');
  header.className = 'inspector-section-header';
  header.textContent = title;
  header.addEventListener('click', () => sec.classList.toggle('collapsed'));
  const body = document.createElement('div');
  body.className = 'inspector-section-body';
  for (const child of children) {
    if (child) body.appendChild(child);
  }
  sec.appendChild(header);
  sec.appendChild(body);
  return sec;
}

function actionTypePicker() {
  const currentType = current.action?.type || null;
  const row = document.createElement('div');
  row.className = 'field-row';
  const lbl = document.createElement('label');
  lbl.className = 'field-label';
  lbl.textContent = 'Action type';
  row.appendChild(lbl);

  const sel = document.createElement('select');
  sel.className = 'field-select';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '— None —';
  sel.appendChild(emptyOpt);
  for (const entry of ACTION_CATALOG) {
    const opt = document.createElement('option');
    opt.value = entry.actionType;
    opt.textContent = entry.label;
    sel.appendChild(opt);
  }
  sel.value = currentType || '';
  sel.addEventListener('change', () => {
    const next = sel.value;
    if (!next) { update({ action: null }); return; }
    if (next === currentType) return;
    const entry = findCatalogEntry(next);
    if (!entry) return;
    update({ action: entry.defaultAction() });
  });
  row.appendChild(sel);
  return row;
}

function renderActionFields() {
  if (!current.action) return [];
  const entry = findCatalogEntry(current.action.type);
  if (!entry) return [];
  const fields = [];
  for (const f of entry.fields) {
    fields.push(renderField(f));
  }
  return fields;
}

function renderField(spec) {
  const val = current.action[spec.id];
  if (spec.type === 'key-capture') {
    return keyCaptureField(spec, val || []);
  }
  if (spec.type === 'boolean') {
    return checkboxField(spec, !!val, (v) => updateAction({ [spec.id]: v }));
  }
  if (spec.type === 'select') {
    return field(spec.label, 'select', val ?? spec.options?.[0]?.value ?? '', {
      options: spec.options || [],
      required: spec.required,
      help: spec.help,
    }, (v) => updateAction({ [spec.id]: v }));
  }
  if (spec.type === 'number') {
    return field(spec.label, 'number', val ?? '', {
      min: spec.min, max: spec.max, required: spec.required, help: spec.help,
    }, (v) => updateAction({ [spec.id]: v === '' ? undefined : Number(v) }));
  }
  if (spec.type === 'textarea') {
    return field(spec.label, 'textarea', val ?? '', {
      maxLength: spec.max, required: spec.required, help: spec.help,
    }, (v) => updateAction({ [spec.id]: v }));
  }
  return field(spec.label, 'text', val ?? '', {
    maxLength: spec.max, required: spec.required, placeholder: spec.placeholder,
    help: spec.help,
  }, (v) => updateAction({ [spec.id]: v || undefined }));
}

function field(label, inputType, value, opts, onInput) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const lbl = document.createElement('label');
  lbl.className = 'field-label' + (opts.required ? ' field-required' : '');
  lbl.textContent = label;
  row.appendChild(lbl);

  let input;
  if (inputType === 'textarea') {
    input = document.createElement('textarea');
    input.className = 'field-textarea';
  } else if (inputType === 'select') {
    input = document.createElement('select');
    input.className = 'field-select';
    for (const opt of (opts.options || [])) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      input.appendChild(o);
    }
  } else if (inputType === 'color') {
    input = document.createElement('input');
    input.type = 'color';
    input.className = 'field-color';
  } else {
    input = document.createElement('input');
    input.type = inputType;
    input.className = 'field-input';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.maxLength) input.maxLength = opts.maxLength;
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.max !== undefined) input.max = String(opts.max);
  }
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(input.value));
  input.addEventListener('change', () => onInput(input.value));
  row.appendChild(input);

  if (opts.help) {
    const help = document.createElement('div');
    help.className = 'field-help';
    help.textContent = opts.help;
    row.appendChild(help);
  }
  return row;
}

const MAX_CUSTOM_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB data-URL cap

function customImageField(value, onChangeFn) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const lbl = document.createElement('label');
  lbl.className = 'field-label';
  lbl.textContent = 'Custom image (PNG / GIF / JPG)';
  row.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'field-image';

  const preview = document.createElement('div');
  preview.className = 'field-image-preview';
  if (value) {
    const img = document.createElement('img');
    img.src = value;
    preview.appendChild(img);
  } else {
    const empty = document.createElement('div');
    empty.className = 'field-image-empty';
    empty.textContent = 'No image set';
    preview.appendChild(empty);
  }
  wrap.appendChild(preview);

  const buttons = document.createElement('div');
  buttons.className = 'field-image-buttons';

  const pickInput = document.createElement('input');
  pickInput.type = 'file';
  pickInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
  pickInput.style.display = 'none';
  pickInput.addEventListener('change', () => {
    const file = pickInput.files?.[0];
    if (!file) return;
    if (file.size > MAX_CUSTOM_IMAGE_BYTES) {
      alert(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max 2 MB.`);
      pickInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChangeFn(reader.result);
    };
    reader.onerror = () => alert('Failed to read image');
    reader.readAsDataURL(file);
    pickInput.value = '';
  });

  const pick = document.createElement('button');
  pick.type = 'button';
  pick.textContent = value ? 'Replace…' : 'Choose image…';
  pick.addEventListener('click', () => pickInput.click());
  buttons.appendChild(pick);

  if (value) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'danger';
    clear.textContent = 'Remove';
    clear.addEventListener('click', () => onChangeFn(null));
    buttons.appendChild(clear);
  }

  wrap.appendChild(pickInput);
  wrap.appendChild(buttons);
  row.appendChild(wrap);

  const help = document.createElement('div');
  help.className = 'field-help';
  help.textContent = 'GIFs animate on the tile face. Stored inline as a data URL; cap 2 MB.';
  row.appendChild(help);

  return row;
}

function checkboxField(spec, checked, onChangeFn) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const lbl = document.createElement('label');
  lbl.className = 'field-checkbox';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChangeFn(cb.checked));
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(' ' + spec.label));
  row.appendChild(lbl);
  if (spec.help) {
    const help = document.createElement('div');
    help.className = 'field-help';
    help.textContent = spec.help;
    row.appendChild(help);
  }
  return row;
}

function keyCaptureField(spec, keys) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const lbl = document.createElement('label');
  lbl.className = 'field-label' + (spec.required ? ' field-required' : '');
  lbl.textContent = spec.label;
  row.appendChild(lbl);

  const capture = document.createElement('div');
  capture.className = 'field-key-capture';
  capture.textContent = keys.length ? 'Click to re-capture' : 'Click and press keys';
  capture.tabIndex = 0;

  const chips = document.createElement('div');
  chips.className = 'field-key-chips';
  renderChips();

  function renderChips() {
    chips.innerHTML = '';
    for (const k of keys) {
      const chip = document.createElement('span');
      chip.className = 'key-chip';
      chip.textContent = k;
      chips.appendChild(chip);
    }
  }

  let capturing = false;
  const startCapture = () => {
    capturing = true;
    capture.classList.add('capturing');
    capture.textContent = 'Press keys…';
    keys.length = 0;
    renderChips();
  };
  const stopCapture = () => {
    capturing = false;
    capture.classList.remove('capturing');
    capture.textContent = keys.length ? 'Click to re-capture' : 'Click and press keys';
    updateAction({ [spec.id]: [...keys] });
  };
  capture.addEventListener('click', () => {
    if (capturing) stopCapture(); else startCapture();
  });
  capture.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();
    const normalized = normalizeKey(e);
    if (!normalized) return;
    if (keys.length >= 4) return;
    if (!keys.includes(normalized)) keys.push(normalized);
    renderChips();
  });
  capture.addEventListener('blur', () => {
    if (capturing) stopCapture();
  });

  row.appendChild(capture);
  row.appendChild(chips);
  if (spec.help) {
    const help = document.createElement('div');
    help.className = 'field-help';
    help.textContent = spec.help;
    row.appendChild(help);
  }
  return row;
}

function normalizeKey(e) {
  // Emit lowercase modifier names first, then the main key.
  const map = {
    Control: 'ctrl', Alt: 'alt', Shift: 'shift', Meta: 'win',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    ' ': 'space', Escape: 'esc',
  };
  if (e.key in map) return map[e.key];
  const k = e.key.toLowerCase();
  if (/^f\d+$/.test(k)) return k;
  if (k.length === 1) return k;
  return k;
}

function actionsRow() {
  const row = document.createElement('div');
  row.className = 'inspector-actions';
  const clear = document.createElement('button');
  clear.className = 'btn-xs btn-secondary';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => update({ action: null, label: undefined, icon: undefined, color: undefined }));
  const del = document.createElement('button');
  del.className = 'btn-xs btn-danger';
  del.textContent = 'Delete';
  del.addEventListener('click', () => {
    if (confirm('Remove this button?')) onDelete(current);
  });
  row.appendChild(clear);
  row.appendChild(del);
  return row;
}

function update(patch) {
  current = { ...current, ...patch };
  onChange(current);
  render();
}

function updateAction(patch) {
  const nextAction = { ...(current.action || {}), ...patch };
  current = { ...current, action: nextAction };
  onChange(current);
  // Don't re-render the full form on each keystroke — only chips/other
  // derived UI needs update, and those are handled inline.
}

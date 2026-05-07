// Studio-side mirror of packages/shared/src/action-forms.ts. Kept in sync
// MANUALLY until we add a Vite/bundler step so the HTML page can import
// from @luminadeck/shared. Any change here must be mirrored there, and
// vice versa.

export const GRID_DIMENSIONS = {
  '2x4': { cols: 2, rows: 4 },
  '3x4': { cols: 3, rows: 4 },
  '4x5': { cols: 4, rows: 5 },
  '5x3': { cols: 5, rows: 3 },
  '8x4': { cols: 8, rows: 4 },
  '8x8': { cols: 8, rows: 8 },
};

export const CATEGORY_LABELS = {
  input: 'Input',
  system: 'System',
  app: 'App',
  integration: 'Integration',
  flow: 'Flow',
  time: 'Time',
};

export const ACTION_CATALOG = [
  {
    actionType: 'keybind',
    renderer: 'keybind',
    label: 'Keyboard Shortcut',
    description: 'Send a key combo to your PC.',
    category: 'input',
    icon: '⌨',
    defaultAction: () => ({ type: 'keybind', keys: [] }),
    fields: [
      { id: 'keys', label: 'Keys', type: 'key-capture', required: true,
        help: 'Tap keys to capture. Up to 4 per combo.' },
    ],
  },
  {
    actionType: 'app_launch',
    renderer: 'app-launch',
    label: 'Launch App',
    description: 'Open an exe or shortcut.',
    category: 'app',
    icon: '🚀',
    defaultAction: () => ({ type: 'app_launch', path: '' }),
    fields: [
      { id: 'path', label: 'Path', type: 'file-path', required: true, max: 260,
        placeholder: 'C:\\Program Files\\App\\app.exe' },
    ],
  },
  {
    actionType: 'system_action',
    renderer: 'system-action',
    label: 'System Action',
    description: 'Volume, media, screenshot, lock…',
    category: 'system',
    icon: '⚙',
    defaultAction: () => ({ type: 'system_action', action: 'volume_up' }),
    fields: [
      { id: 'action', label: 'Action', type: 'select', required: true, options: [
        { value: 'volume_up', label: 'Volume Up' },
        { value: 'volume_down', label: 'Volume Down' },
        { value: 'volume_mute', label: 'Mute' },
        { value: 'media_play_pause', label: 'Play / Pause' },
        { value: 'media_next', label: 'Next Track' },
        { value: 'media_prev', label: 'Previous Track' },
        { value: 'media_stop', label: 'Stop' },
        { value: 'screenshot', label: 'Screenshot' },
        { value: 'lock_screen', label: 'Lock Screen' },
        { value: 'sleep', label: 'Sleep' },
        { value: 'brightness_up', label: 'Brightness Up' },
        { value: 'brightness_down', label: 'Brightness Down' },
        { value: 'mic_mute', label: 'Mic Mute' },
        { value: 'minimize_window', label: 'Minimize Window' },
        { value: 'snap_left', label: 'Snap Left' },
        { value: 'snap_right', label: 'Snap Right' },
        { value: 'switch_window', label: 'Switch Window' },
        { value: 'close_window', label: 'Close Window' },
      ] },
    ],
  },
  {
    actionType: 'text_input',
    renderer: 'text-input',
    label: 'Type Text',
    description: 'Paste/type text into focused window.',
    category: 'input',
    icon: '📝',
    defaultAction: () => ({ type: 'text_input', text: '' }),
    fields: [
      { id: 'text', label: 'Text', type: 'textarea', required: true, max: 4096 },
    ],
  },
  {
    actionType: 'multi_action',
    renderer: 'multi-action',
    label: 'Multi-Action',
    description: 'Sequence of actions with delays.',
    category: 'flow',
    icon: '⚡',
    defaultAction: () => ({ type: 'multi_action', actions: [] }),
    fields: [],
  },
  {
    actionType: 'folder',
    renderer: 'folder',
    label: 'Folder',
    description: 'Nested button grid.',
    category: 'flow',
    icon: '📁',
    defaultAction: () => ({
      type: 'folder', folderId: crypto.randomUUID(), folderName: 'Folder',
      buttons: [], layout: '3x4',
    }),
    fields: [
      { id: 'folderName', label: 'Name', type: 'text', required: true, max: 32 },
    ],
  },
  {
    actionType: 'timer',
    renderer: 'timer',
    label: 'Timer',
    description: 'Countdown/count-up on the tile.',
    category: 'time',
    icon: '⏱',
    defaultAction: () => ({ type: 'timer', durationMs: 60000, countUp: false }),
    fields: [
      { id: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 1000, max: 86400000 },
      { id: 'countUp', label: 'Count up', type: 'boolean' },
      { id: 'label', label: 'Label', type: 'text', max: 32 },
    ],
  },
  {
    actionType: 'counter',
    renderer: 'counter',
    label: 'Counter',
    description: 'Tap to increment; total on tile.',
    category: 'time',
    icon: '#',
    defaultAction: () => ({ type: 'counter', initialValue: 0, step: 1 }),
    fields: [
      { id: 'initialValue', label: 'Start', type: 'number', required: true },
      { id: 'step', label: 'Step', type: 'number', required: true, min: -1000, max: 1000 },
      { id: 'label', label: 'Label', type: 'text', max: 32 },
    ],
  },
  {
    actionType: 'obs',
    renderer: 'obs',
    label: 'OBS Studio',
    description: 'Scene / record / stream control.',
    category: 'integration',
    icon: '🎬',
    defaultAction: () => ({ type: 'obs', command: 'switch_scene' }),
    fields: [
      { id: 'command', label: 'Command', type: 'select', required: true, options: [
        { value: 'switch_scene', label: 'Switch Scene' },
        { value: 'toggle_record', label: 'Toggle Record' },
        { value: 'toggle_stream', label: 'Toggle Stream' },
        { value: 'toggle_source', label: 'Toggle Source' },
        { value: 'replay_buffer', label: 'Save Replay Buffer' },
        { value: 'obs_screenshot', label: 'Screenshot' },
      ] },
      { id: 'sceneName', label: 'Scene', type: 'text', max: 128 },
      { id: 'sourceName', label: 'Source', type: 'text', max: 128 },
    ],
  },
  {
    actionType: 'discord',
    renderer: 'discord',
    label: 'Discord',
    description: 'Mute / deafen via hotkeys.',
    category: 'integration',
    icon: '💬',
    defaultAction: () => ({ type: 'discord', command: 'toggle_mute' }),
    fields: [
      { id: 'command', label: 'Command', type: 'select', required: true, options: [
        { value: 'toggle_mute', label: 'Toggle Mute' },
        { value: 'toggle_deafen', label: 'Toggle Deafen' },
        { value: 'push_to_talk', label: 'Push to Talk' },
      ] },
    ],
  },
  {
    actionType: 'macro',
    renderer: 'macro',
    label: 'Macro',
    description: 'Run a saved macro.',
    category: 'flow',
    icon: '🎯',
    defaultAction: () => ({ type: 'macro', macroId: '', macroName: '' }),
    fields: [
      { id: 'macroId', label: 'Macro ID', type: 'text', required: true, max: 64 },
      { id: 'macroName', label: 'Macro name', type: 'text', required: true, max: 64 },
    ],
  },
];

export const CATEGORIES = ['input', 'system', 'app', 'integration', 'flow', 'time'];

export function findCatalogEntry(actionType) {
  return ACTION_CATALOG.find(e => e.actionType === actionType);
}

export function totalCells(layout) {
  const dims = GRID_DIMENSIONS[layout] || GRID_DIMENSIONS['3x4'];
  return dims.cols * dims.rows;
}

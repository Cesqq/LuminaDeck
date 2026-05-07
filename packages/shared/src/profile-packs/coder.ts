import type { ProfileConfig } from '../types';

/**
 * Coder pack — Pro tier. Two pages of dev workflow tiles. Page 1 is
 * editor-focused (VS Code shortcuts + git); page 2 is terminal/build/Docker.
 *
 * Keybinds target VS Code defaults on Windows. Re-bind in your editor or
 * tweak the tiles after import to match your IDE (JetBrains, Sublime, etc.).
 *
 * Why Pro: the killer dev moment — one-tap "run tests + format + commit"
 * macros — only works once you bind multiple actions per tile, which is
 * Pro-gated. Free users see the pack greyed-out with an Upgrade CTA.
 */
export const coderPack: ProfileConfig = {
  id: 'pack-coder',
  name: 'Coder',
  theme: 'monokai',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
  pages: [
    // ── Page 1: Editor + Git ─────────────────────────────────────
    {
      id: 'pack-coder-editor',
      name: 'Editor & Git',
      layout: '3x4',
      buttons: [
        // Row 1 — navigation
        {
          id: 'coder-cmd-palette', label: 'Cmd Palette', icon: 'wand',
          color: '#272822', page: 0, position: 0,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 'p'] },
        },
        {
          id: 'coder-quick-open', label: 'Quick Open', icon: 'target',
          color: '#272822', page: 0, position: 1,
          action: { type: 'keybind', keys: ['ctrl', 'p'] },
        },
        {
          id: 'coder-find', label: 'Find in Files', icon: 'target',
          color: '#272822', page: 0, position: 2,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 'f'] },
        },
        // Row 2 — editing
        {
          id: 'coder-format', label: 'Format', icon: 'wand',
          color: '#A6E22E', page: 0, position: 3,
          action: { type: 'keybind', keys: ['shift', 'alt', 'f'] },
        },
        {
          id: 'coder-rename', label: 'Rename', icon: 'text',
          color: '#A6E22E', page: 0, position: 4,
          action: { type: 'keybind', keys: ['f2'] },
        },
        {
          id: 'coder-comment', label: 'Toggle //', icon: 'text',
          color: '#A6E22E', page: 0, position: 5,
          action: { type: 'keybind', keys: ['ctrl', 'slash'] },
        },
        // Row 3 — git
        {
          id: 'coder-git-status', label: 'git status', icon: 'target',
          color: '#F92672', page: 0, position: 6,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'git status\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-git-pull', label: 'git pull', icon: 'rewind',
          color: '#F92672', page: 0, position: 7,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'git pull\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-git-push', label: 'git push', icon: 'broadcast',
          color: '#F92672', page: 0, position: 8,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'git push\n' },
          ], delays: [400] },
        },
        // Row 4 — utility
        {
          id: 'coder-save-all', label: 'Save All', icon: 'save',
          color: '#66D9EF', page: 0, position: 9,
          action: { type: 'keybind', keys: ['ctrl', 'k', 's'] },
        },
        {
          id: 'coder-toggle-term', label: 'Terminal', icon: 'terminal',
          color: '#66D9EF', page: 0, position: 10,
          action: { type: 'keybind', keys: ['ctrl', 'backtick'] },
        },
        {
          id: 'coder-zen-mode', label: 'Zen Mode', icon: 'wand',
          color: '#66D9EF', page: 0, position: 11,
          action: { type: 'keybind', keys: ['ctrl', 'k', 'z'] },
        },
      ],
    },
    // ── Page 2: Terminal / Build / Docker ──────────────────────────
    {
      id: 'pack-coder-build',
      name: 'Build & Run',
      layout: '3x4',
      buttons: [
        // Row 1 — build commands (npm)
        {
          id: 'coder-npm-dev', label: 'npm dev', icon: 'play-pause',
          color: '#A6E22E', page: 1, position: 0,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'npm run dev\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-npm-build', label: 'npm build', icon: 'wand',
          color: '#A6E22E', page: 1, position: 1,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'npm run build\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-npm-test', label: 'npm test', icon: 'bug',
          color: '#A6E22E', page: 1, position: 2,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'npm test\n' },
          ], delays: [400] },
        },
        // Row 2 — docker
        {
          id: 'coder-docker-ps', label: 'docker ps', icon: 'layers',
          color: '#0DB7ED', page: 1, position: 3,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'docker ps\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-docker-up', label: 'compose up', icon: 'broadcast',
          color: '#0DB7ED', page: 1, position: 4,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'docker compose up -d\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-docker-down', label: 'compose down', icon: 'stop',
          color: '#0DB7ED', page: 1, position: 5,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'docker compose down\n' },
          ], delays: [400] },
        },
        // Row 3 — process control
        {
          id: 'coder-kill-port', label: 'Kill :3000', icon: 'close-tab',
          color: '#F92672', page: 1, position: 6,
          action: { type: 'multi_action', actions: [
            { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
            { type: 'text_input', text: 'npx kill-port 3000\n' },
          ], delays: [400] },
        },
        {
          id: 'coder-clear', label: 'clear', icon: 'screenshot',
          color: '#F92672', page: 1, position: 7,
          action: { type: 'keybind', keys: ['ctrl', 'l'] },
        },
        {
          id: 'coder-cancel', label: 'Ctrl+C', icon: 'stop',
          color: '#F92672', page: 1, position: 8,
          action: { type: 'keybind', keys: ['ctrl', 'c'] },
        },
        // Row 4 — power tools
        {
          id: 'coder-debug', label: 'Debug F5', icon: 'bug',
          color: '#FD971F', page: 1, position: 9,
          action: { type: 'keybind', keys: ['f5'] },
        },
        {
          id: 'coder-step-over', label: 'Step Over', icon: 'next-track',
          color: '#FD971F', page: 1, position: 10,
          action: { type: 'keybind', keys: ['f10'] },
        },
        {
          id: 'coder-step-into', label: 'Step Into', icon: 'next-track',
          color: '#FD971F', page: 1, position: 11,
          action: { type: 'keybind', keys: ['f11'] },
        },
      ],
    },
  ],
};

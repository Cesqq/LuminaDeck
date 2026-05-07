import type { ProfileConfig } from '../types';

/**
 * OBS Streaming — free pack. Uses the companion's OBS plugin, so tiles fire
 * `obs` actions rather than keybinds. Assumes four standard scene names
 * ("Starting Soon", "Main", "BRB", "Ending"); rename them inside OBS or
 * edit the tiles after import to match your actual scene list.
 */
export const obsStreamingPack: ProfileConfig = {
  id: 'pack-obs-streaming',
  name: 'OBS Streaming',
  theme: 'neon-rgb',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-obs-main',
      name: 'OBS Streaming',
      layout: '3x4',
      buttons: [
        { id: 'obs-scene-start', label: 'Starting', icon: 'clock', color: '#5EB85B', page: 0, position: 0,
          action: { type: 'obs', command: 'switch_scene', sceneName: 'Starting Soon' } },
        { id: 'obs-scene-main',  label: 'Main', icon: 'video', color: '#5EB85B', page: 0, position: 1,
          action: { type: 'obs', command: 'switch_scene', sceneName: 'Main' } },
        { id: 'obs-scene-brb',   label: 'BRB', icon: 'coffee', color: '#5EB85B', page: 0, position: 2,
          action: { type: 'obs', command: 'switch_scene', sceneName: 'BRB' } },

        { id: 'obs-scene-ending', label: 'Ending', icon: 'flag', color: '#5EB85B', page: 0, position: 3,
          action: { type: 'obs', command: 'switch_scene', sceneName: 'Ending' } },
        { id: 'obs-rec',    label: 'Record', icon: 'record', color: '#D92D20', page: 0, position: 4,
          action: { type: 'obs', command: 'toggle_record' } },
        { id: 'obs-stream', label: 'Stream', icon: 'broadcast', color: '#D92D20', page: 0, position: 5,
          action: { type: 'obs', command: 'toggle_stream' } },

        { id: 'obs-mic',  label: 'Mic', icon: 'mic', color: '#1A1A2E', page: 0, position: 6,
          action: { type: 'obs', command: 'toggle_source', sourceName: 'Mic' } },
        { id: 'obs-cam',  label: 'Webcam', icon: 'camera', color: '#1A1A2E', page: 0, position: 7,
          action: { type: 'obs', command: 'toggle_source', sourceName: 'Webcam' } },
        { id: 'obs-replay', label: 'Replay', icon: 'rewind', color: '#0F3460', page: 0, position: 8,
          action: { type: 'obs', command: 'replay_buffer' } },

        { id: 'obs-snap', label: 'Screenshot', icon: 'screenshot', color: '#0F3460', page: 0, position: 9,
          action: { type: 'obs', command: 'obs_screenshot' } },
        { id: 'obs-mute', label: 'Sys mute', icon: 'volume-mute', color: '#16213E', page: 0, position: 10,
          action: { type: 'system_action', action: 'volume_mute' } },
        { id: 'obs-copy', label: 'Copy', icon: 'copy', color: '#16213E', page: 0, position: 11,
          action: { type: 'keybind', keys: ['ctrl', 'c'] } },
      ],
    },
  ],
};

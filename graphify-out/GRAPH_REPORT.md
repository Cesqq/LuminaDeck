# Graph Report - C:/Dev/LuminaDeck  (2026-04-20)

## Corpus Check
- 88 files · ~270,781 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 273 nodes · 363 edges · 28 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `LuminaDeckClient` - 14 edges
2. `DiscoveryManager` - 11 edges
3. `ObsPlugin` - 9 edges
4. `SessionManager` - 8 edges
5. `DiscordPlugin` - 7 edges
6. `PluginManager` - 7 edges
7. `get_local_ip()` - 5 edges
8. `start_server()` - 5 edges
9. `get_foreground_window_info()` - 5 edges
10. `execute_keybind()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Mobile RN UI"
Cohesion: 0.06
Nodes (0): 

### Community 1 - "Tauri Core Lib"
Cohesion: 0.11
Nodes (18): add_paired_device(), AppState, chrono_now_iso(), devices_path(), get_local_ip(), get_network_info(), get_network_interfaces(), get_qr_pairing_data() (+10 more)

### Community 2 - "Companion Server"
Cohesion: 0.13
Nodes (15): ConnectionEvent, ConnectionStats, DeviceIdentifiedEvent, handle_connection(), handle_message(), PeerRate, RateLimiter, start_server() (+7 more)

### Community 3 - "WebSocket Client"
Cohesion: 0.2
Nodes (1): LuminaDeckClient

### Community 4 - "In-App Purchases"
Cohesion: 0.2
Nodes (6): checkEntitlement(), checkProEntitlement(), getProPackage(), getProPrice(), purchasePro(), restorePurchases()

### Community 5 - "Action Framework"
Cohesion: 0.17
Nodes (4): Action, ActionError, Plugin, PluginManager

### Community 6 - "Profile Export/Import"
Cohesion: 0.23
Nodes (9): importProfile(), isValidButton(), isValidPage(), isValidProfile(), createDefaultProfile(), loadProfile(), loadSettings(), saveProfile() (+1 more)

### Community 7 - "Device Discovery"
Cohesion: 0.21
Nodes (1): DiscoveryManager

### Community 8 - "Session Auth"
Cohesion: 0.23
Nodes (3): build_totp(), SessionManager, SessionSetupPayload

### Community 9 - "OBS Plugin"
Cohesion: 0.24
Nodes (2): ObsInner, ObsPlugin

### Community 10 - "Key Resolution"
Cohesion: 0.25
Nodes (0): 

### Community 11 - "Window Monitor"
Cohesion: 0.43
Nodes (5): ActiveWindowMessage, get_foreground_window_info(), get_process_name(), get_window_title(), WindowMonitor

### Community 12 - "Discord Plugin"
Cohesion: 0.25
Nodes (1): DiscordPlugin

### Community 13 - "Macro Editor UI"
Cohesion: 0.29
Nodes (2): createStep(), uid()

### Community 14 - "Action Tiles"
Cohesion: 0.25
Nodes (0): 

### Community 15 - "Keybind Action"
Cohesion: 0.52
Nodes (6): execute_keybind(), is_extended(), is_modifier(), make_key_input(), resolve_vk(), vk_map()

### Community 16 - "Profile Context"
Cohesion: 0.5
Nodes (2): createDefaultProfile(), generateId()

### Community 17 - "WS Test Harness"
Cohesion: 0.8
Nodes (4): log(), main(), sleep(), ts()

### Community 18 - "Supabase Backend"
Cohesion: 0.83
Nodes (3): fetchFeatureFlags(), isSupabaseConfigured(), validateReceipt()

### Community 19 - "Protocol Test"
Cohesion: 0.83
Nodes (3): assert(), main(), ts()

### Community 20 - "Image Picker"
Cohesion: 1.0
Nodes (2): pickButtonImage(), requestImagePermission()

### Community 21 - "Icon Generation"
Cohesion: 1.0
Nodes (2): generateIco(), main()

### Community 22 - "Tauri Build Script"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Tauri Main Entry"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "App Launch Action"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "System Action"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Text Input Action"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Zeroconf Types"
Cohesion: 1.0
Nodes (1): Zeroconf

## Knowledge Gaps
- **16 isolated node(s):** `ServerInfo`, `QrData`, `NetworkInterface`, `ConnectionEvent`, `StatsSnapshot` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Tauri Build Script`** (2 nodes): `build.rs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tauri Main Entry`** (2 nodes): `main.rs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Launch Action`** (2 nodes): `app_launch.rs`, `launch_app()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `System Action`** (2 nodes): `system.rs`, `execute_system_action()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Text Input Action`** (2 nodes): `text_input.rs`, `execute_text_input()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Zeroconf Types`** (2 nodes): `react-native-zeroconf.d.ts`, `Zeroconf`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `ServerInfo`, `QrData`, `NetworkInterface` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mobile RN UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Tauri Core Lib` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Companion Server` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
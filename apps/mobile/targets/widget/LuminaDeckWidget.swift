// LuminaDeckWidget.swift
//
// iOS 26 Control Center + Lock Screen widget for LuminaDeck (Phase B1).
//
// WIRING STATUS — this file is source-ready; the Xcode wiring is pending
// a Mac build:
//
//   1. Install `expo-apple-targets` (community plugin) into apps/mobile.
//   2. Declare this target in `apps/mobile/targets/widget/target.yml` (the
//      plugin reads YAML schemas describing widget extensions).
//   3. Run `npx expo prebuild --platform ios --clean` on the Mac and the
//      plugin copies this Swift source into the generated Xcode project.
//   4. Add the same App Group identifier to the main app + this widget in
//      Apple Developer Portal and Signing & Capabilities.
//
// Until then this file exists as the contract the companion, Swift
// runtime, and React-side tile-sync code all target.

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Control Widgets (iOS 18/26 Control Center)

@available(iOS 18.0, *)
struct LuminaDeckControlWidget: ControlWidget {
    static let kind: String = "com.luminadeck.app.control"

    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: Self.kind,
            provider: LuminaDeckPinnedTileProvider()
        ) { tile in
            ControlWidgetButton(action: ExecutePinnedTileIntent(buttonId: tile.buttonId)) {
                Label(tile.label, systemImage: tile.systemImage)
            }
        }
        .displayName("LuminaDeck Tile")
        .description("Fire a LuminaDeck tile from Control Center.")
    }
}

@available(iOS 18.0, *)
struct LuminaDeckPinnedTileProvider: AppIntentControlValueProvider {
    func currentValue(configuration: PinnedTileConfiguration) async throws -> PinnedTile {
        PinnedTileStore.shared.tile(for: configuration.tileSlot) ?? PinnedTile.placeholder
    }

    func previewValue(configuration: PinnedTileConfiguration) -> PinnedTile {
        PinnedTile.placeholder
    }
}

// MARK: - Home Screen + Lock Screen Widget (iOS 17+)
//
// Reads up to six pinned tiles from the App Group and renders them as a
// grid sized to the widget family. The user pins tiles in the main app
// Editor (one slot per tile, slot ids `slot-0` … `slot-5`).
//
// Pro gating: the FREE tier shows up to 1 tile — large/medium families
// degrade to the small layout. Pro shows the full grid. The flag lives
// in the App Group so the widget can read it without round-tripping to
// the main app.

@available(iOS 17.0, *)
struct LuminaDeckHomeWidget: Widget {
    static let kind: String = "com.luminadeck.app.home"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: PinnedTileTimelineProvider()) { entry in
            HomeWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("LuminaDeck")
        .description("Fire your pinned PC actions from the Home Screen.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

/// One timeline entry — the widget refreshes hourly (system policy
/// already throttles tighter), but most of its renders come from
/// reloadAllTimelines() called by the main app on save.
struct PinnedTilesEntry: TimelineEntry {
    let date: Date
    let tiles: [PinnedTile]
    let isPro: Bool
}

@available(iOS 17.0, *)
struct PinnedTileTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PinnedTilesEntry {
        PinnedTilesEntry(date: Date(), tiles: [.placeholder], isPro: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (PinnedTilesEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PinnedTilesEntry>) -> Void) {
        let entry = currentEntry()
        // Refresh every 30 min — pinned tiles only change when the user
        // edits the deck, and the main app calls reloadAllTimelines on
        // save so this is just a backstop.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: entry.date) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry() -> PinnedTilesEntry {
        let tiles = PinnedTileStore.shared.allTiles()
        let isPro = PinnedTileStore.shared.isPro()
        return PinnedTilesEntry(date: Date(), tiles: tiles, isPro: isPro)
    }
}

@available(iOS 17.0, *)
struct HomeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PinnedTilesEntry

    /// Free tier: 1 tile max. Pro: family-appropriate count.
    private var visibleTiles: [PinnedTile] {
        let cap = entry.isPro ? proCap(for: family) : 1
        return Array(entry.tiles.prefix(cap))
    }

    private func proCap(for family: WidgetFamily) -> Int {
        switch family {
        case .systemSmall: return 1
        case .systemMedium: return 4
        case .systemLarge: return 6
        case .accessoryCircular, .accessoryInline: return 1
        case .accessoryRectangular: return 1
        @unknown default: return 1
        }
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            CircularTileView(tile: visibleTiles.first ?? .placeholder)
        case .accessoryInline:
            Label((visibleTiles.first ?? .placeholder).label,
                  systemImage: (visibleTiles.first ?? .placeholder).systemImage)
        case .accessoryRectangular:
            RectangularTileView(tile: visibleTiles.first ?? .placeholder)
        case .systemSmall:
            // Single big tile fills the widget — easy thumb target.
            HomeBigTile(tile: visibleTiles.first ?? .placeholder)
        case .systemMedium:
            // 2×2 grid — even Pro caps at 4 here so each tile stays tappable.
            TileGrid(tiles: visibleTiles, columns: 2)
        case .systemLarge:
            // 3×2 grid for the full pinned set.
            TileGrid(tiles: visibleTiles, columns: 3)
        @unknown default:
            HomeBigTile(tile: visibleTiles.first ?? .placeholder)
        }
    }
}

@available(iOS 17.0, *)
struct HomeBigTile: View {
    let tile: PinnedTile

    var body: some View {
        Button(intent: ExecutePinnedTileIntent(buttonId: tile.buttonId)) {
            VStack(spacing: 8) {
                Image(systemName: tile.systemImage)
                    .font(.system(size: 36, weight: .semibold))
                Text(tile.label)
                    .font(.caption)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .tint(Color(hex: tile.accentHex))
    }
}

@available(iOS 17.0, *)
struct TileGrid: View {
    let tiles: [PinnedTile]
    let columns: Int

    var body: some View {
        let cols = Array(repeating: GridItem(.flexible(), spacing: 6), count: columns)
        LazyVGrid(columns: cols, spacing: 6) {
            ForEach(tiles, id: \.buttonId) { tile in
                Button(intent: ExecutePinnedTileIntent(buttonId: tile.buttonId)) {
                    VStack(spacing: 4) {
                        Image(systemName: tile.systemImage)
                            .font(.title3)
                        Text(tile.label)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(Color(hex: tile.accentHex).opacity(0.15))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

@available(iOS 17.0, *)
struct CircularTileView: View {
    let tile: PinnedTile

    var body: some View {
        Button(intent: ExecutePinnedTileIntent(buttonId: tile.buttonId)) {
            Image(systemName: tile.systemImage)
                .font(.title2)
        }
        .buttonStyle(.plain)
    }
}

@available(iOS 17.0, *)
struct RectangularTileView: View {
    let tile: PinnedTile

    var body: some View {
        Button(intent: ExecutePinnedTileIntent(buttonId: tile.buttonId)) {
            HStack(spacing: 6) {
                Image(systemName: tile.systemImage)
                    .font(.body)
                Text(tile.label)
                    .font(.caption)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

private extension Color {
    init(hex: String) {
        let cleaned = hex.replacingOccurrences(of: "#", with: "")
        var v: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&v)
        let r = Double((v >> 16) & 0xff) / 255.0
        let g = Double((v >> 8) & 0xff) / 255.0
        let b = Double(v & 0xff) / 255.0
        self = Color(red: r, green: g, blue: b)
    }
}

// MARK: - Widget Bundle

@main
struct LuminaDeckWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 17.0, *) {
            LuminaDeckHomeWidget()
        }
        if #available(iOS 18.0, *) {
            LuminaDeckControlWidget()
        }
    }
}

// MARK: - Shared pinned-tile model

/// Mirror of the JS-side tile descriptor written to the App Group container
/// by `apps/mobile/src/lib/widgetSync.ts`. Keep the field names in sync.
struct PinnedTile: Codable {
    let buttonId: String
    let label: String
    let systemImage: String   // SF Symbol name, not our internal icon id
    let accentHex: String     // "#FF6B35"
    /// Pre-serialized action JSON. The widget AppIntent posts this
    /// verbatim as the `action` field of the `/intent-execute` body —
    /// the companion is stateless and just verifies HMAC + dispatches
    /// whatever action is in the request. Optional so older payloads
    /// (no action wired) decode cleanly and we can show a placeholder.
    let actionJSON: String?

    static let placeholder = PinnedTile(
        buttonId: "placeholder",
        label: "Pick a tile",
        systemImage: "square.grid.2x2",
        accentHex: "#FF6B35",
        actionJSON: nil
    )
}

/// Thin wrapper over the shared App Group `UserDefaults` instance. The App
/// Group identifier is defined in `app.config.ts -> extra.appGroup` and must
/// match the capability granted in Xcode.
struct PinnedTileStore {
    static let shared = PinnedTileStore()
    static let appGroup = "group.com.luminadeck.shared"
    static let defaultsKey = "luminadeck.pinnedTiles.v1"
    static let isProKey = "luminadeck.isPro.v1"

    func tile(for slot: String) -> PinnedTile? {
        guard let all = decodeAll() else { return nil }
        return all[slot]
    }

    /// All pinned tiles in slot order (slot-0, slot-1, …). Used by the
    /// Home Screen + Lock Screen widget families. Returns the placeholder
    /// list when nothing is stored yet so previews aren't blank.
    func allTiles() -> [PinnedTile] {
        guard let all = decodeAll() else { return [.placeholder] }
        return all
            .sorted { $0.key.localizedStandardCompare($1.key) == .orderedAscending }
            .map { $0.value }
    }

    /// Pro-tier flag — written to the App Group by the main app on every
    /// IAP receipt validation. Stored as a UTF-8 "1" / "0" string Data
    /// because the RN bridge can only write strings; widget reads the
    /// data back and treats "1" as true. See `writeIsPro` in widgetSync.ts.
    func isPro() -> Bool {
        guard let defaults = UserDefaults(suiteName: Self.appGroup),
              let data = defaults.data(forKey: Self.isProKey),
              let str = String(data: data, encoding: .utf8)
        else { return false }
        return str == "1"
    }

    private func decodeAll() -> [String: PinnedTile]? {
        guard let defaults = UserDefaults(suiteName: Self.appGroup),
              let data = defaults.data(forKey: Self.defaultsKey)
        else { return nil }
        return try? JSONDecoder().decode([String: PinnedTile].self, from: data)
    }
}

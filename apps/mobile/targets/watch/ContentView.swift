// ContentView.swift
//
// watchOS companion for LuminaDeck (Phase B3).
//
// Six-slot grid — the user picks which six tiles go to the Watch from
// a dedicated "Watch" mini-page in the mobile editor. WCSession bridges
// the tile selection from iPhone → Watch, and taps from Watch → iPhone
// (the iPhone then POSTs /intent-execute over LAN).
//
// WHY NOT DIRECT-TO-COMPANION? watchOS is battery-constrained and the
// Watch is often off-network (LTE fallback charges the battery fast).
// Relaying via iPhone keeps the Watch fast and offline-tolerant.
//
// STATUS — source-ready. See README.md for expo-apple-targets wiring.

import SwiftUI
import WatchConnectivity

@main
struct LuminaDeckWatchApp: App {
    @StateObject private var store = WatchTileStore()

    var body: some Scene {
        WindowGroup {
            // TabView with .verticalPage style is the watchOS-native
            // gesture for swiping between sibling screens. Three pages:
            // wrist deck (favorites), trackpad, and Scribble/keyboard.
            // Pro-gating lives on the iPhone side — when the user isn't
            // Pro, the phone simply doesn't push the trackpad/scribble
            // capability flag and these tabs become read-only previews.
            // For v1.4 the gating UI lands in a follow-up; for now all
            // three tabs are always available so QA can exercise them.
            if #available(watchOS 9.0, *) {
                TabView {
                    WatchTileGridView(store: store)
                        .tabItem { Label("Deck", systemImage: "square.grid.2x2.fill") }
                    TrackpadView(store: store)
                        .tabItem { Label("Pad", systemImage: "rectangle.and.hand.point.up.left.fill") }
                    ScribbleView(store: store)
                        .tabItem { Label("Type", systemImage: "keyboard") }
                }
                .tabViewStyle(.verticalPage)
            } else {
                WatchTileGridView(store: store)
            }
        }
    }
}

struct WatchTileGridView: View {
    @ObservedObject var store: WatchTileStore

    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(store.tiles, id: \.slot) { tile in
                    WatchTileButton(tile: tile) {
                        WKInterfaceDevice.current().play(.click)
                        store.firePress(buttonId: tile.buttonId)
                    }
                }
            }
            .padding(6)
        }
        .navigationTitle("Deck")
    }
}

struct WatchTileButton: View {
    let tile: WatchTile
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                Image(systemName: tile.systemImage)
                    .font(.title3)
                Text(tile.label)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(Color(hex: tile.accentHex).opacity(0.25))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct WatchTile: Codable, Identifiable {
    var id: String { slot }
    let slot: String
    let buttonId: String
    let label: String
    let systemImage: String
    let accentHex: String
}

private extension Color {
    init(hex: String) {
        let cleaned = hex.replacingOccurrences(of: "#", with: "")
        var v: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&v)
        let r = Double((v >> 16) & 0xff) / 255.0
        let g = Double((v >> 8)  & 0xff) / 255.0
        let b = Double(v & 0xff) / 255.0
        self = Color(red: r, green: g, blue: b)
    }
}

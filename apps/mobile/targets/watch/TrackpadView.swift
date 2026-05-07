// TrackpadView.swift
//
// Apple Watch trackpad surface (Phase v1.4). The whole watch face becomes
// a relative-motion trackpad: drag to move the PC cursor, single-tap for
// left-click, long-press for right-click, two-finger swipe for scroll
// (the digital crown also scrolls, see `.focusable()` + `.digitalCrownRotation`).
//
// Architecture: gestures emit `MouseEvent` values; `WatchTileStore` relays
// them to the phone via WCSession `sendMessage`. The phone forwards the
// JSON to the companion over the existing WS, where `actions::mouse`
// already knows how to dispatch SendInput on Windows.
//
// Why relative-motion instead of absolute? Absolute mapping requires
// knowing the PC's screen size, which we don't have on Watch (and which
// changes when displays are added/removed). Relative is the same model
// macOS Touchpad and the iOS Mouse-control assistive feature use.

import SwiftUI
import WatchKit

@available(watchOS 9.0, *)
struct TrackpadView: View {
    @ObservedObject var store: WatchTileStore

    /// Sensitivity multiplier for relative drag → mouse delta.
    /// 2.0 means a 1 pt finger move on the watch = 2 px on the PC. Tuned
    /// so a full diagonal swipe across a 41 mm Series 9 face crosses a
    /// 1080 p screen in ~3 swipes — matches most laptop trackpads.
    private let dragGain: CGFloat = 2.0

    /// Crown sensitivity. The crown emits doubles in the normalized
    /// 0…1 range; we map deltas through a gain to scroll wheel ticks.
    private let crownGain: Double = 12.0

    @State private var dragLastTranslation: CGSize = .zero
    @State private var crownLast: Double = 0
    @State private var crownAccum: Double = 0
    @FocusState private var crownFocused: Bool

    var body: some View {
        ZStack {
            // Subtle visual feedback so the user knows the surface is live.
            // No content — the gesture area is the whole face.
            RoundedRectangle(cornerRadius: 18)
                .fill(LinearGradient(
                    colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.10)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .overlay(
                    Image(systemName: "rectangle.and.hand.point.up.left.fill")
                        .foregroundStyle(.secondary)
                        .font(.title2)
                        .opacity(0.35)
                )

            // Gesture surface — clear, fills the parent.
            Color.clear
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let dx = value.translation.width - dragLastTranslation.width
                            let dy = value.translation.height - dragLastTranslation.height
                            dragLastTranslation = value.translation
                            // Drop the very first frame (zero-delta) so we
                            // don't fire a stationary "move 0,0" message
                            // on every tap.
                            if dx != 0 || dy != 0 {
                                store.fireMouseMove(
                                    dx: Int(dx * dragGain),
                                    dy: Int(dy * dragGain)
                                )
                            }
                        }
                        .onEnded { value in
                            dragLastTranslation = .zero
                            // Treat the gesture as a click if the user didn't
                            // travel far. Same heuristic UIKit uses for
                            // tap-vs-pan disambiguation.
                            let traveled = hypot(value.translation.width, value.translation.height)
                            if traveled < 4 {
                                WKInterfaceDevice.current().play(.click)
                                store.fireMouseClick(button: .left)
                            }
                        }
                )
                .simultaneousGesture(
                    LongPressGesture(minimumDuration: 0.45)
                        .onEnded { _ in
                            WKInterfaceDevice.current().play(.directionDown)
                            store.fireMouseClick(button: .right)
                        }
                )
        }
        .focusable(true)
        .focused($crownFocused)
        .digitalCrownRotation(
            $crownLast,
            from: -10_000,
            through: 10_000,
            by: 0.01,
            sensitivity: .medium,
            isContinuous: true,
            isHapticFeedbackEnabled: false
        )
        .onAppear { crownFocused = true }
        .onChange(of: crownLast) { _, newValue in
            // Accumulate crown deltas; once we cross a tick threshold,
            // emit a scroll event and reset. This prevents a flood of
            // tiny scroll messages while still feeling responsive.
            let delta = newValue - crownAccum
            if abs(delta) >= (1.0 / crownGain) {
                let ticks = Int(delta * crownGain)
                if ticks != 0 {
                    store.fireScroll(ticks: ticks)
                    crownAccum = newValue
                }
            }
        }
        .navigationTitle("Trackpad")
    }
}

/// Mouse event vocabulary the Watch sends to the phone. The phone
/// translates these into the existing v1.4.0 trackpad WS messages
/// (`MIN_FEATURE_TRACKPAD = ">=1.4.0"` in protocol.ts).
enum MouseButton: String, Codable {
    case left
    case right
    case middle
}

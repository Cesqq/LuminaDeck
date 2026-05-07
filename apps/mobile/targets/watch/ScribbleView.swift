// ScribbleView.swift
//
// Apple Watch keyboard / Scribble / dictation surface (Phase v1.4). A
// single SwiftUI `TextField` gives us all three input modes for free:
// Series 7+ shows the QuickPath swipe keyboard, every Watch supports
// Scribble handwriting, and the dictation mic is always one tap away.
//
// On submit we send the text to the phone via WCSession; the phone
// dispatches it to the companion as a `text_input` action, which the
// Windows side already knows how to type via SendInput.
//
// The view also exposes a "send & clear" button so you can chain shorter
// messages without dismissing the keyboard between them — useful for
// rapid command-firing scenarios like "open", then "/cmd", then "enter".

import SwiftUI
import WatchKit

@available(watchOS 9.0, *)
struct ScribbleView: View {
    @ObservedObject var store: WatchTileStore

    @State private var text: String = ""
    @State private var lastSent: String? = nil
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 8) {
            TextField("Write or speak…", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(3, reservesSpace: true)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { sendCurrent() }

            HStack(spacing: 8) {
                Button(action: sendCurrent) {
                    Label("Send", systemImage: "arrow.up.circle.fill")
                        .labelStyle(.iconOnly)
                        .font(.title3)
                }
                .disabled(text.isEmpty)
                .buttonStyle(.borderedProminent)
                .tint(.blue)

                Button(action: sendReturn) {
                    Label("Enter", systemImage: "return")
                        .labelStyle(.iconOnly)
                        .font(.title3)
                }
                .buttonStyle(.bordered)
            }

            if let last = lastSent, !last.isEmpty {
                Text("sent: \(last)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(8)
        .navigationTitle("Type")
        .onAppear { focused = true }
    }

    private func sendCurrent() {
        let payload = text
        guard !payload.isEmpty else { return }
        WKInterfaceDevice.current().play(.click)
        store.fireTextInput(text: payload)
        lastSent = payload
        text = ""
        // Refocus so chained sends don't require re-tapping the field —
        // the keyboard sheet stays up but the field clears for the next
        // command.
        focused = true
    }

    private func sendReturn() {
        WKInterfaceDevice.current().play(.directionUp)
        // Send a literal newline; on the companion side `text_input`
        // expands it via SendInput's VK_RETURN. Cheaper than wiring a
        // separate "press Enter" verb.
        store.fireTextInput(text: "\n")
    }
}

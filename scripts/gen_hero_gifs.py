#!/usr/bin/env python3
"""Generate 10 small loop GIFs for Hero Demo tiles. Programmatic so we
ship without copyright/trademark risk and keep file sizes tiny.

Each GIF is 200x200, ~30 frames at 33ms = ~1 second loop. Output goes
to apps/mobile/assets/gifs/ and is bundled into the RN APK/IPA.
"""

from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets" / "gifs"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 200, 200
FRAMES = 28
DURATION_MS = 36  # ~28 fps


def save_loop(name: str, frames: list[Image.Image]) -> None:
    p = OUT / f"{name}.gif"
    frames[0].save(
        p,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=DURATION_MS,
        optimize=True,
        disposal=2,
    )
    print(f"  wrote {p.name}  {p.stat().st_size // 1024} KB")


# Brand-aligned palette
NAVY = (12, 18, 38)
INDIGO = (18, 14, 38)
BLUE = (91, 141, 217)
CYAN = (98, 184, 227)
PURPLE = (123, 47, 247)
MAGENTA = (255, 0, 170)
ORANGE = (255, 107, 53)
RED = (255, 71, 87)
WHITE = (255, 255, 255)


def fresh_canvas(bg=NAVY) -> Image.Image:
    return Image.new("RGB", (W, H), bg)


# ---------------------------------------------------------------------------
# 1. equalizer — 5 vertical bars dancing
# ---------------------------------------------------------------------------
def gif_equalizer():
    frames = []
    bar_count = 5
    bar_w = 18
    gap = 12
    total_w = bar_count * bar_w + (bar_count - 1) * gap
    x0 = (W - total_w) // 2
    for f in range(FRAMES):
        img = fresh_canvas()
        d = ImageDraw.Draw(img)
        for i in range(bar_count):
            phase = f / FRAMES * 2 * math.pi + i * 0.7
            h = int(60 + 65 * (0.5 + 0.5 * math.sin(phase)))
            x = x0 + i * (bar_w + gap)
            y = (H - h) // 2 + 20
            color = (
                BLUE if i % 2 == 0 else CYAN
            )
            d.rounded_rectangle([x, y, x + bar_w, y + h], radius=6, fill=color)
        frames.append(img)
    save_loop("equalizer", frames)


# ---------------------------------------------------------------------------
# 2. vinyl — rotating disc with grooves
# ---------------------------------------------------------------------------
def gif_vinyl():
    frames = []
    cx, cy, r = W // 2, H // 2, 80
    for f in range(FRAMES):
        img = fresh_canvas((8, 8, 14))
        d = ImageDraw.Draw(img)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 20, 24))
        for i, gr in enumerate(range(20, r, 8)):
            shade = 30 + (i * 4) % 20
            d.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], outline=(shade, shade, shade), width=1)
        # Center label
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=MAGENTA)
        # Rotation indicator: small dot on the label
        angle = f / FRAMES * 2 * math.pi
        dx = int(14 * math.cos(angle))
        dy = int(14 * math.sin(angle))
        d.ellipse([cx + dx - 3, cy + dy - 3, cx + dx + 3, cy + dy + 3], fill=WHITE)
        # Spindle
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(0, 0, 0))
        frames.append(img)
    save_loop("vinyl", frames)


# ---------------------------------------------------------------------------
# 3. recording — pulsing red dot with text REC
# ---------------------------------------------------------------------------
def gif_recording():
    frames = []
    cx, cy = W // 2 - 25, H // 2
    for f in range(FRAMES):
        img = fresh_canvas((20, 8, 12))
        d = ImageDraw.Draw(img)
        # Pulsing dot
        scale = 0.5 + 0.5 * (0.5 + 0.5 * math.sin(f / FRAMES * 2 * math.pi))
        r = int(28 + 12 * scale)
        # Glow halo
        for halo in (r + 22, r + 14, r + 7):
            alpha_factor = 1 - (halo - r) / 24
            shade = int(80 * alpha_factor)
            d.ellipse([cx - halo, cy - halo, cx + halo, cy + halo], outline=(shade + 80, shade // 2, shade // 2), width=2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)
        # REC text to the right
        d.text((cx + r + 15, cy - 10), "REC", fill=WHITE)
        frames.append(img)
    save_loop("recording", frames)


# ---------------------------------------------------------------------------
# 4. waveform — sliding sine wave
# ---------------------------------------------------------------------------
def gif_waveform():
    frames = []
    for f in range(FRAMES):
        img = fresh_canvas((10, 14, 30))
        d = ImageDraw.Draw(img)
        phase = f / FRAMES * 2 * math.pi
        prev = None
        for x in range(0, W, 2):
            t = x / W * 4 * math.pi - phase
            y = int(H / 2 + 50 * math.sin(t) * math.cos(t * 0.5))
            color = CYAN if x % 6 == 0 else BLUE
            if prev is not None:
                d.line([prev, (x, y)], fill=color, width=3)
            prev = (x, y)
        frames.append(img)
    save_loop("waveform", frames)


# ---------------------------------------------------------------------------
# 5. drumPads — 4 pads blinking in a rhythm pattern
# ---------------------------------------------------------------------------
def gif_drumPads():
    frames = []
    pad_size = 70
    gap = 16
    grid_w = 2 * pad_size + gap
    x0 = (W - grid_w) // 2
    y0 = (H - grid_w) // 2
    pattern = [0, 1, 2, 1, 0, 3, 2, 3]  # which pad lights on each step
    for f in range(FRAMES):
        img = fresh_canvas((14, 8, 30))
        d = ImageDraw.Draw(img)
        step = (f * len(pattern)) // FRAMES
        active = pattern[step % len(pattern)]
        for idx in range(4):
            row = idx // 2
            col = idx % 2
            x = x0 + col * (pad_size + gap)
            y = y0 + row * (pad_size + gap)
            base = MAGENTA if idx == active else (60, 30, 80)
            d.rounded_rectangle([x, y, x + pad_size, y + pad_size], radius=10, fill=base)
            # Inner highlight when active
            if idx == active:
                d.rounded_rectangle([x + 8, y + 8, x + pad_size - 8, y + pad_size - 8], radius=6, outline=WHITE, width=2)
        frames.append(img)
    save_loop("drumPads", frames)


# ---------------------------------------------------------------------------
# 6. cursor — blinking text cursor with code lines
# ---------------------------------------------------------------------------
def gif_cursor():
    frames = []
    for f in range(FRAMES):
        img = fresh_canvas((12, 14, 22))
        d = ImageDraw.Draw(img)
        # Code lines (static)
        line_specs = [
            (20, BLUE, 80),
            (38, CYAN, 130),
            (56, BLUE, 50),
            (74, MAGENTA, 110),
            (92, CYAN, 140),
            (110, BLUE, 70),
            (128, CYAN, 100),
            (146, BLUE, 90),
        ]
        for y, color, width_px in line_specs:
            d.rounded_rectangle([18, y, 18 + width_px, y + 8], radius=2, fill=color)
        # Blinking cursor on the last line
        cursor_x = 18 + 90 + 4
        cursor_y = 146
        if f % 14 < 7:
            d.rectangle([cursor_x, cursor_y, cursor_x + 4, cursor_y + 12], fill=WHITE)
        frames.append(img)
    save_loop("cursor", frames)


# ---------------------------------------------------------------------------
# 7. radar — sonar sweep on a circular grid
# ---------------------------------------------------------------------------
def gif_radar():
    frames = []
    cx, cy, r = W // 2, H // 2, 80
    for f in range(FRAMES):
        img = fresh_canvas((6, 18, 24))
        d = ImageDraw.Draw(img)
        # Ring grid
        for ring in (r // 3, 2 * r // 3, r):
            d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=(20, 80, 100), width=1)
        # Cross
        d.line([cx - r, cy, cx + r, cy], fill=(20, 80, 100), width=1)
        d.line([cx, cy - r, cx, cy + r], fill=(20, 80, 100), width=1)
        # Sweep
        angle = f / FRAMES * 2 * math.pi
        sweep_count = 12
        for i in range(sweep_count):
            sub_angle = angle - i * 0.04
            shade = int(180 * (1 - i / sweep_count))
            x = cx + int(r * math.cos(sub_angle))
            y = cy + int(r * math.sin(sub_angle))
            d.line([(cx, cy), (x, y)], fill=(0, shade, shade // 2), width=2)
        # Blip
        blip_angle = angle - 0.6
        bx = cx + int((r * 0.65) * math.cos(blip_angle))
        by = cy + int((r * 0.65) * math.sin(blip_angle))
        d.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(0, 255, 180))
        frames.append(img)
    save_loop("radar", frames)


# ---------------------------------------------------------------------------
# 8. headphones — concentric pulsing rings
# ---------------------------------------------------------------------------
def gif_headphones():
    frames = []
    cx, cy = W // 2, H // 2
    for f in range(FRAMES):
        img = fresh_canvas((20, 12, 38))
        d = ImageDraw.Draw(img)
        # Outer headphone arc (band)
        d.arc([cx - 70, cy - 80, cx + 70, cy + 60], start=200, end=340, fill=WHITE, width=6)
        # Earcups
        d.ellipse([cx - 78, cy - 18, cx - 38, cy + 38], fill=PURPLE)
        d.ellipse([cx + 38, cy - 18, cx + 78, cy + 38], fill=PURPLE)
        # Pulsing bass rings
        phase = f / FRAMES * 2 * math.pi
        for i in range(3):
            ring_phase = (phase + i * 2) % (2 * math.pi)
            ring_scale = ring_phase / (2 * math.pi)
            ring_r = int(30 + 60 * ring_scale)
            shade = int(180 * (1 - ring_scale))
            d.ellipse([cx - ring_r, cy + 10 - ring_r, cx + ring_r, cy + 10 + ring_r],
                      outline=(shade, shade // 2, shade // 4 + 80), width=2)
        frames.append(img)
    save_loop("headphones", frames)


# ---------------------------------------------------------------------------
# 9. spectrum — colour-shifting frequency bars
# ---------------------------------------------------------------------------
def gif_spectrum():
    frames = []
    bars = 14
    bar_w = (W - 30) // bars
    for f in range(FRAMES):
        img = fresh_canvas((4, 6, 12))
        d = ImageDraw.Draw(img)
        for i in range(bars):
            phase = f / FRAMES * 2 * math.pi + i * 0.4
            h = int(40 + 90 * (0.5 + 0.5 * math.sin(phase)))
            x = 15 + i * bar_w
            y = (H - h) // 2 + 30
            # Color gradient — hot in middle
            mid_distance = abs(i - bars / 2) / (bars / 2)
            if mid_distance < 0.3:
                color = ORANGE
            elif mid_distance < 0.6:
                color = MAGENTA
            else:
                color = PURPLE
            d.rectangle([x, y, x + bar_w - 2, y + h], fill=color)
        frames.append(img)
    save_loop("spectrum", frames)


# ---------------------------------------------------------------------------
# 10. cassette — two reels rotating
# ---------------------------------------------------------------------------
def gif_cassette():
    frames = []
    for f in range(FRAMES):
        img = fresh_canvas((8, 10, 20))
        d = ImageDraw.Draw(img)
        # Body
        d.rounded_rectangle([20, 50, W - 20, H - 50], radius=10, fill=(40, 30, 60))
        # Tape window
        d.rounded_rectangle([35, 65, W - 35, H - 80], radius=6, fill=(20, 16, 40))
        # Reels
        for cx in (60, W - 60):
            cy = 90
            angle = f / FRAMES * 2 * math.pi
            d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(140, 140, 140))
            for spoke in range(6):
                a = angle + spoke * (math.pi / 3)
                x2 = cx + int(14 * math.cos(a))
                y2 = cy + int(14 * math.sin(a))
                d.line([(cx, cy), (x2, y2)], fill=(60, 60, 60), width=2)
            d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(0, 0, 0))
        # Label band
        d.rectangle([28, H - 48, W - 28, H - 30], fill=CYAN)
        frames.append(img)
    save_loop("cassette", frames)


def main():
    print(f"writing GIFs to {OUT}")
    gif_equalizer()
    gif_vinyl()
    gif_recording()
    gif_waveform()
    gif_drumPads()
    gif_cursor()
    gif_radar()
    gif_headphones()
    gif_spectrum()
    gif_cassette()
    total = sum(p.stat().st_size for p in OUT.glob("*.gif"))
    print(f"\ntotal: {total // 1024} KB across {len(list(OUT.glob('*.gif')))} GIFs")


if __name__ == "__main__":
    main()

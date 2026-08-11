#!/usr/bin/env python3
"""Render a short 3D-styled title commitment process training video.

The animation is intentionally self-contained: it uses Pillow for drawing and
ffmpeg for encoding so the video can be regenerated in a plain Cloud Agent VM.
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1280
HEIGHT = 720
FPS = 24
SECONDS_PER_STEP = 2.8
CARD_SPACING = 3.25
FRAME_DIR = Path("/tmp/title_commitment_process_frames")
DEFAULT_OUTPUT = Path("/opt/cursor/artifacts/title_commitment_process_3d.mp4")

BLUE = (8, 66, 119)
BLUE_DARK = (5, 35, 70)
GOLD = (244, 184, 46)
PAPER = (248, 245, 232)
INK = (30, 39, 48)
GREEN = (55, 150, 89)
RED = (197, 68, 57)


STEPS = [
    {
        "num": "1",
        "title": "Receive and Review the Order",
        "summary": "Order packet arrives with buyer, seller, lender, and property details.",
        "bullets": ["Title order", "Parties", "Property", "Transaction terms"],
        "icon": "order",
    },
    {
        "num": "2",
        "title": "Search the Public Records",
        "summary": "County and public records are searched for deeds, liens, judgments, and taxes.",
        "bullets": ["Deeds", "Mortgages", "Liens", "Taxes"],
        "icon": "search",
    },
    {
        "num": "3",
        "title": "Title Examination",
        "summary": "Search results are examined to identify ownership, encumbrances, and exceptions.",
        "bullets": ["Ownership", "Open liens", "Easements", "Restrictions"],
        "icon": "examine",
    },
    {
        "num": "4",
        "title": "Complete Schedule A",
        "summary": "The commitment terms are prepared: amount, estate, insured parties, and legal description.",
        "bullets": ["Proposed insured", "Policy amount", "Estate", "Legal description"],
        "icon": "schedule",
    },
    {
        "num": "5",
        "title": "Add Requirements and Exceptions",
        "summary": "Requirements show what must be satisfied; exceptions identify matters not covered.",
        "bullets": ["Payoffs", "Releases", "Recorded easements", "Restrictions"],
        "icon": "requirements",
    },
    {
        "num": "6",
        "title": "Review for Accuracy",
        "summary": "Quality review checks names, legal descriptions, requirements, and exceptions.",
        "bullets": ["Names", "Vesting", "Requirements", "Exceptions"],
        "icon": "review",
    },
    {
        "num": "7",
        "title": "Issue the Commitment",
        "summary": "The final commitment is issued and distributed to the transaction parties.",
        "bullets": ["Buyer", "Seller", "Lender", "Real estate agent"],
        "icon": "issue",
    },
    {
        "num": "8",
        "title": "Closing Summary",
        "summary": "Accurate search, careful examination, quality review, then the title commitment.",
        "bullets": ["Order", "Search", "Examine", "Prepare", "Review", "Issue"],
        "icon": "summary",
    },
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default(size=size)


FONTS = {
    "hero": font(62, True),
    "hero_small": font(28, True),
    "step": font(24, True),
    "card_title": font(30, True),
    "body": font(19),
    "body_bold": font(19, True),
    "small": font(16),
    "badge": font(31, True),
}


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(lerp(x, y, t)) for x, y in zip(a, b))


def text_center(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, fill: tuple[int, int, int], used_font: ImageFont.ImageFont) -> None:
    box = draw.textbbox((0, 0), text, font=used_font)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2), text, fill=fill, font=used_font)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, used_font: ImageFont.ImageFont, width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=used_font) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded_panel(size: tuple[int, int], radius: int, fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None, width: int = 2) -> Image.Image:
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill, outline=outline, width=width)
    return image


def draw_background(image: Image.Image, frame: int, total_frames: int) -> None:
    pixels = image.load()
    for y in range(HEIGHT):
        t = y / HEIGHT
        color = blend((218, 237, 249), (34, 74, 108), t)
        for x in range(WIDTH):
            pixels[x, y] = color

    draw = ImageDraw.Draw(image, "RGBA")
    horizon = 465
    draw.rectangle((0, horizon, WIDTH, HEIGHT), fill=(20, 44, 68, 180))
    camera_phase = frame / max(total_frames, 1)
    for i in range(-18, 30):
        x = WIDTH / 2 + i * 85 - (camera_phase * 700) % 85
        draw.line((x, horizon, x + (x - WIDTH / 2) * 1.7, HEIGHT), fill=(255, 255, 255, 38), width=2)
    for i in range(10):
        y = horizon + i * i * 4.2
        draw.line((0, y, WIDTH, y), fill=(255, 255, 255, 28), width=2)

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    glow_draw.ellipse((WIDTH / 2 - 430, 35, WIDTH / 2 + 430, 455), fill=(255, 255, 255, 42))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(46)))


def draw_3d_eye(draw: ImageDraw.ImageDraw, cx: float, cy: float, scale: float, blink: float) -> None:
    if blink > 0.9:
        draw.arc((cx - 11 * scale, cy - 5 * scale, cx + 11 * scale, cy + 7 * scale), 0, 180, fill=(42, 28, 24), width=max(2, int(3 * scale)))
        return
    draw.ellipse((cx - 10 * scale, cy - 7 * scale, cx + 10 * scale, cy + 7 * scale), fill=(252, 246, 238), outline=(50, 32, 25), width=max(1, int(2 * scale)))
    draw.ellipse((cx - 3 * scale, cy - 5 * scale, cx + 6 * scale, cy + 5 * scale), fill=(91, 54, 32))
    draw.ellipse((cx + 1 * scale, cy - 4 * scale, cx + 4 * scale, cy - 1 * scale), fill=(255, 255, 255))


def draw_shaded_ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    base: tuple[int, int, int],
    shadow: tuple[int, int, int],
    highlight: tuple[int, int, int],
    highlight_shift: tuple[float, float] = (-0.22, -0.28),
) -> None:
    x1, y1, x2, y2 = box
    draw.ellipse(box, fill=shadow)
    steps = 18
    for i in range(steps, 0, -1):
        t = i / steps
        inset_x = (x2 - x1) * (1.0 - t) * 0.45
        inset_y = (y2 - y1) * (1.0 - t) * 0.45
        cx_shift = (x2 - x1) * highlight_shift[0] * (1.0 - t)
        cy_shift = (y2 - y1) * highlight_shift[1] * (1.0 - t)
        color = blend(base, highlight, (1.0 - t) * 0.55)
        draw.ellipse((x1 + inset_x + cx_shift, y1 + inset_y + cy_shift, x2 - inset_x + cx_shift, y2 - inset_y + cy_shift), fill=color)


def draw_shaded_capsule(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    width: float,
    base: tuple[int, int, int],
    shadow: tuple[int, int, int],
) -> None:
    draw.line((start[0], start[1], end[0], end[1]), fill=shadow, width=max(1, int(width)))
    draw.line((start[0] - width * 0.08, start[1] - width * 0.12, end[0] - width * 0.08, end[1] - width * 0.12), fill=base, width=max(1, int(width * 0.72)))
    r = width / 2
    draw_shaded_ellipse(draw, (start[0] - r, start[1] - r, start[0] + r, start[1] + r), base, shadow, blend(base, (255, 255, 255), 0.2))
    draw_shaded_ellipse(draw, (end[0] - r, end[1] - r, end[0] + r, end[1] + r), base, shadow, blend(base, (255, 255, 255), 0.2))


def draw_person(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0, phase: float = 0.0, active: float = 1.0) -> None:
    skin = (233, 184, 146)
    hair = (45, 34, 30)
    hair_hi = (104, 82, 70)
    jacket = (30, 34, 42)
    blouse = (252, 250, 246)
    float_y = math.sin(phase * 1.6) * 5 * active
    gesture = math.sin(phase * 3.7) * active
    blink = (math.sin(phase * 2.4) + 1.0) / 2.0
    cy = int(cy + float_y)

    draw.ellipse((cx - 59 * scale, cy + 29 * scale, cx + 59 * scale, cy + 47 * scale), fill=(0, 0, 0, 46))
    draw.polygon(
        [
            (cx - 50 * scale, cy + 38 * scale),
            (cx - 31 * scale, cy - 44 * scale),
            (cx + 33 * scale, cy - 44 * scale),
            (cx + 52 * scale, cy + 38 * scale),
        ],
        fill=jacket,
    )
    draw.polygon([(cx - 45 * scale, cy + 34 * scale), (cx - 26 * scale, cy - 35 * scale), (cx + 7 * scale, cy + 35 * scale)], fill=(53, 58, 70, 180))
    draw.polygon([(cx - 26 * scale, cy - 43 * scale), (cx, cy + 13 * scale), (cx + 26 * scale, cy - 43 * scale)], fill=blouse)
    draw.polygon([(cx - 19 * scale, cy - 41 * scale), (cx - 4 * scale, cy - 8 * scale), (cx - 28 * scale, cy - 20 * scale)], fill=(255, 255, 255))
    draw.polygon([(cx + 19 * scale, cy - 41 * scale), (cx + 4 * scale, cy - 8 * scale), (cx + 28 * scale, cy - 20 * scale)], fill=(255, 255, 255))
    draw.line((cx - 39 * scale, cy - 23 * scale, cx - 48 * scale, cy + 33 * scale), fill=(77, 82, 93), width=max(2, int(5 * scale)))
    draw.line((cx + 39 * scale, cy - 23 * scale, cx + 49 * scale, cy + 33 * scale), fill=(12, 14, 18), width=max(2, int(5 * scale)))

    left_hand = (cx - 57 * scale, cy + 12 * scale + gesture * 4 * scale)
    right_hand = (cx + 66 * scale, cy - 37 * scale - gesture * 10 * scale)
    draw_shaded_capsule(draw, (cx - 34 * scale, cy - 9 * scale), left_hand, 10 * scale, jacket, (9, 11, 15))
    draw_shaded_capsule(draw, (cx + 34 * scale, cy - 9 * scale), right_hand, 10 * scale, jacket, (9, 11, 15))
    draw_shaded_ellipse(draw, (left_hand[0] - 13 * scale, left_hand[1] - 9 * scale, left_hand[0] + 15 * scale, left_hand[1] + 9 * scale), skin, (181, 110, 86), (255, 221, 188))
    draw_shaded_ellipse(draw, (right_hand[0] - 10 * scale, right_hand[1] - 10 * scale, right_hand[0] + 10 * scale, right_hand[1] + 10 * scale), skin, (181, 110, 86), (255, 221, 188))
    draw.line((right_hand[0] + 5 * scale, right_hand[1] - 5 * scale, right_hand[0] + 20 * scale, right_hand[1] - 18 * scale), fill=skin, width=max(2, int(4 * scale)))

    draw_shaded_ellipse(draw, (cx - 39 * scale, cy - 112 * scale, cx + 39 * scale, cy - 34 * scale), hair, (20, 15, 13), hair_hi)
    draw.pieslice((cx - 50 * scale, cy - 101 * scale, cx - 12 * scale, cy - 16 * scale), 82, 265, fill=hair)
    draw.pieslice((cx + 10 * scale, cy - 102 * scale, cx + 52 * scale, cy - 15 * scale), -82, 98, fill=hair)
    draw_shaded_ellipse(draw, (cx - 30 * scale, cy - 98 * scale, cx + 31 * scale, cy - 39 * scale), skin, (185, 112, 88), (255, 224, 190))
    draw.pieslice((cx - 31 * scale, cy - 105 * scale, cx + 31 * scale, cy - 59 * scale), 185, 355, fill=hair)
    for offset in (-25, -15, -5, 5, 15):
        draw.arc((cx + offset * scale, cy - 111 * scale, cx + (offset + 26) * scale, cy - 70 * scale), 200, 322, fill=hair_hi, width=max(1, int(2 * scale)))
    draw.line((cx - 22 * scale, cy - 86 * scale, cx - 7 * scale, cy - 89 * scale), fill=(72, 50, 39), width=max(1, int(2 * scale)))
    draw.line((cx + 6 * scale, cy - 89 * scale, cx + 22 * scale, cy - 86 * scale), fill=(72, 50, 39), width=max(1, int(2 * scale)))
    draw_3d_eye(draw, cx - 11 * scale, cy - 78 * scale, scale, blink)
    draw_3d_eye(draw, cx + 14 * scale, cy - 78 * scale, scale, blink)
    draw.ellipse((cx + 18 * scale, cy - 66 * scale, cx + 24 * scale, cy - 61 * scale), fill=(240, 139, 138, 105))
    draw.ellipse((cx - 24 * scale, cy - 66 * scale, cx - 18 * scale, cy - 61 * scale), fill=(240, 139, 138, 105))
    draw.arc((cx - 11 * scale, cy - 67 * scale, cx + 15 * scale, cy - 49 * scale), 18, 162, fill=(124, 55, 61), width=max(1, int(3 * scale)))
    draw.ellipse((cx + 11 * scale, cy - 96 * scale, cx + 16 * scale, cy - 91 * scale), fill=(255, 233, 205, 120))


def draw_document(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], title: str) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=8, fill=(255, 255, 248), outline=(55, 80, 105), width=2)
    draw.rectangle((x1 + 12, y1 + 13, x2 - 12, y1 + 37), fill=(233, 239, 245))
    text_center(draw, ((x1 + x2) / 2, y1 + 25), title, BLUE_DARK, FONTS["small"])
    for i in range(5):
        y = y1 + 55 + i * 18
        draw.line((x1 + 18, y, x2 - 18, y), fill=(125, 140, 150), width=2)


def draw_magnifier(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=BLUE_DARK, width=9, fill=(229, 246, 255, 170))
    draw.line((cx + r * 0.7, cy + r * 0.7, cx + r * 1.6, cy + r * 1.6), fill=(101, 72, 37), width=14)


def draw_checklist(draw: ImageDraw.ImageDraw, x: int, y: int, items: list[str], good: bool = True) -> None:
    color = GREEN if good else RED
    for index, item in enumerate(items[:6]):
        yy = y + index * 31
        draw.rounded_rectangle((x, yy, x + 22, yy + 22), radius=4, outline=color, width=3, fill=(255, 255, 255))
        if good:
            draw.line((x + 5, yy + 11, x + 10, yy + 17, x + 18, yy + 6), fill=color, width=3)
        else:
            draw.line((x + 6, yy + 6, x + 16, yy + 16), fill=color, width=3)
            draw.line((x + 16, yy + 6, x + 6, yy + 16), fill=color, width=3)
        draw.text((x + 32, yy - 1), item, fill=INK, font=FONTS["small"])


def draw_icon(draw: ImageDraw.ImageDraw, step: dict[str, str | list[str]], box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    icon = step["icon"]
    if icon == "order":
        draw_document(draw, (x1 + 8, y1 + 12, x1 + 112, y2 - 12), "TITLE ORDER")
        draw.polygon([(cx + 6, cy - 10), (cx + 58, cy - 10), (cx + 58, cy - 27), (cx + 96, cy + 10), (cx + 58, cy + 47), (cx + 58, cy + 29), (cx + 6, cy + 29)], fill=BLUE)
        draw.polygon([(x2 - 88, cy + 26), (x2 - 15, cy + 26), (x2 - 15, cy - 22), (x2 - 52, cy - 51), (x2 - 88, cy - 22)], fill=(228, 185, 103), outline=BLUE_DARK)
        draw.rectangle((x2 - 59, cy - 3, x2 - 43, cy + 26), fill=(98, 63, 42))
    elif icon == "search":
        for i, label in enumerate(["DEEDS", "LIENS", "TAXES"]):
            draw_document(draw, (x1 + 18 + i * 82, y1 + 20 + i * 9, x1 + 91 + i * 82, y2 - 33 + i * 9), label)
        draw_magnifier(draw, x2 - 78, y1 + 92, 44)
    elif icon == "examine":
        draw_document(draw, (x1 + 14, y1 + 16, x1 + 132, y2 - 18), "SEARCH")
        draw.polygon([(x1 + 150, cy - 10), (x1 + 205, cy - 10), (x1 + 205, cy - 28), (x1 + 238, cy + 9), (x1 + 205, cy + 46), (x1 + 205, cy + 28), (x1 + 150, cy + 28)], fill=BLUE)
        draw_checklist(draw, x2 - 145, y1 + 28, ["Ownership", "Liens", "Easements", "Restrictions"], True)
    elif icon == "schedule":
        draw_document(draw, (x1 + 25, y1 + 15, x2 - 18, y2 - 12), "SCHEDULE A")
        draw_checklist(draw, x1 + 54, y1 + 72, ["Insured", "Amount", "Estate", "Property"], True)
    elif icon == "requirements":
        draw.rounded_rectangle((x1 + 16, y1 + 18, cx - 5, y2 - 15), radius=10, fill=(236, 251, 239), outline=GREEN, width=3)
        draw.rounded_rectangle((cx + 5, y1 + 18, x2 - 16, y2 - 15), radius=10, fill=(252, 238, 237), outline=RED, width=3)
        text_center(draw, ((x1 + cx) / 2, y1 + 42), "REQUIREMENTS", GREEN, FONTS["small"])
        text_center(draw, ((cx + x2) / 2, y1 + 42), "EXCEPTIONS", RED, FONTS["small"])
        draw_checklist(draw, x1 + 34, y1 + 66, ["Payoffs", "Releases", "Documents"], True)
        draw_checklist(draw, cx + 26, y1 + 66, ["Easements", "Restrictions", "Minerals"], False)
    elif icon == "review":
        draw_document(draw, (x1 + 35, y1 + 12, x2 - 35, y2 - 12), "QUALITY REVIEW")
        draw_checklist(draw, x1 + 75, y1 + 69, ["Names", "Legal description", "Vesting", "Requirements", "Exceptions"], True)
    elif icon == "issue":
        draw_document(draw, (x1 + 18, y1 + 18, x1 + 138, y2 - 18), "COMMITMENT")
        draw.rounded_rectangle((x1 + 43, cy - 14, x1 + 114, cy + 24), radius=5, outline=GREEN, width=5)
        text_center(draw, (x1 + 79, cy + 4), "ISSUED", GREEN, FONTS["body_bold"])
        draw.polygon([(x1 + 162, cy - 8), (x1 + 226, cy - 8), (x1 + 226, cy - 28), (x1 + 262, cy + 11), (x1 + 226, cy + 50), (x1 + 226, cy + 29), (x1 + 162, cy + 29)], fill=BLUE)
        for i, label in enumerate(["BUYER", "SELLER", "LENDER"]):
            px = x2 - 115 + (i % 2) * 60
            py = y1 + 55 + (i // 2) * 75
            draw.ellipse((px - 13, py - 24, px + 13, py + 2), fill=(211, 157, 112))
            draw.rectangle((px - 18, py, px + 18, py + 35), fill=BLUE_DARK if i != 1 else GOLD)
            text_center(draw, (px, py + 48), label, INK, FONTS["small"])
    else:
        centers = [(x1 + 45 + i * 48, cy + int(20 * math.sin(i))) for i in range(6)]
        labels = ["ORDER", "SEARCH", "EXAM", "PREP", "REVIEW", "ISSUE"]
        for i, (px, py) in enumerate(centers):
            draw.ellipse((px - 23, py - 23, px + 23, py + 23), fill=(255, 255, 255), outline=BLUE_DARK, width=3)
            text_center(draw, (px, py), labels[i][0], BLUE_DARK, FONTS["body_bold"])
            if i < len(centers) - 1:
                nx, ny = centers[i + 1]
                draw.line((px + 26, py, nx - 26, ny), fill=BLUE, width=4)
        burst = [(x2 - 118 + math.cos(i * math.pi / 8) * (76 if i % 2 == 0 else 56), y1 + 78 + math.sin(i * math.pi / 8) * (76 if i % 2 == 0 else 56)) for i in range(16)]
        draw.polygon(burst, fill=GOLD, outline=BLUE_DARK)
        text_center(draw, (x2 - 118, y1 + 58), "EFFECTIVE", RED, FONTS["small"])
        text_center(draw, (x2 - 118, y1 + 83), "TITLE", RED, FONTS["small"])
        text_center(draw, (x2 - 118, y1 + 108), "COMMITMENT", RED, FONTS["small"])


def make_card(step: dict[str, str | list[str]], active: float, phase: float) -> Image.Image:
    card = Image.new("RGBA", (560, 360), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card, "RGBA")
    draw.rounded_rectangle((0, 0, 559, 359), radius=28, fill=PAPER, outline=BLUE_DARK, width=5)
    draw.rounded_rectangle((0, 0, 559, 65), radius=28, fill=BLUE, outline=BLUE_DARK, width=5)
    draw.rectangle((0, 38, 559, 68), fill=BLUE)
    draw.rounded_rectangle((16, 12, 64, 58), radius=9, fill=GOLD, outline=(135, 92, 17), width=3)
    text_center(draw, (40, 34), str(step["num"]), BLUE_DARK, FONTS["badge"])
    title = str(step["title"]).upper()
    if draw.textlength(title, font=FONTS["step"]) > 440:
        title = title.replace(" AND ", " & ")
    draw.text((80, 18), title, fill=(255, 255, 255), font=FONTS["step"])

    draw_icon(draw, step, (22, 85, 316, 278))
    draw_person(draw, 464, 258, 0.95, phase=phase, active=active)

    if active > 0.45:
        prompts = {
            "1": "Review the order!",
            "2": "Search records!",
            "3": "Examine title!",
            "4": "Build Schedule A!",
            "5": "Add requirements!",
            "6": "Quality check!",
            "7": "Issue it!",
            "8": "Great closing!",
        }
        bubble_alpha = int(235 * ease((active - 0.45) / 0.55))
        bubble = Image.new("RGBA", card.size, (0, 0, 0, 0))
        bubble_draw = ImageDraw.Draw(bubble, "RGBA")
        bubble_draw.rounded_rectangle((342, 84, 538, 132), radius=18, fill=(255, 255, 255, bubble_alpha), outline=(91, 169, 226, bubble_alpha), width=3)
        bubble_draw.polygon([(443, 132), (462, 154), (472, 130)], fill=(255, 255, 255, bubble_alpha), outline=(91, 169, 226, bubble_alpha))
        text_center(bubble_draw, (440, 108), prompts.get(str(step["num"]), "Let's go!"), BLUE_DARK, FONTS["body_bold"])
        card.alpha_composite(bubble)

    summary_lines = wrap_text(draw, str(step["summary"]), FONTS["body"], 500)
    y = 292
    for line in summary_lines[:3]:
        draw.text((30, y), line, fill=INK, font=FONTS["body"])
        y += 23

    if active > 0.55:
        shine = Image.new("RGBA", card.size, (0, 0, 0, 0))
        shine_draw = ImageDraw.Draw(shine, "RGBA")
        x = int(-220 + active * 520)
        shine_draw.polygon([(x, 0), (x + 80, 0), (x + 300, 360), (x + 220, 360)], fill=(255, 255, 255, 34))
        card.alpha_composite(shine)
    return card


def paste_card(scene: Image.Image, card: Image.Image, center: tuple[float, float], scale: float, active: float) -> None:
    w = max(1, int(card.width * scale))
    h = max(1, int(card.height * scale))
    x = int(center[0] - w / 2)
    y = int(center[1] - h / 2)

    draw = ImageDraw.Draw(scene, "RGBA")
    depth = int(22 * scale)
    shadow = Image.new("RGBA", (w + depth * 3, h + depth * 3), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow, "RGBA")
    shadow_draw.rounded_rectangle((depth, depth, depth + w, depth + h), radius=max(8, int(28 * scale)), fill=(0, 0, 0, 92))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(3, int(10 * scale))))
    scene.alpha_composite(shadow, (x - depth, y - depth // 2))

    draw.polygon([(x + w, y + depth), (x + w + depth, y), (x + w + depth, y + h), (x + w, y + h + depth)], fill=(28, 60, 92, 210))
    draw.polygon([(x + depth, y + h), (x + w + depth, y + h), (x + w, y + h + depth), (x, y + h + depth)], fill=(15, 36, 58, 210))

    resized = card.resize((w, h), Image.Resampling.LANCZOS)
    if active > 0.77:
        halo = Image.new("RGBA", (w + 48, h + 48), (0, 0, 0, 0))
        halo_draw = ImageDraw.Draw(halo, "RGBA")
        halo_draw.rounded_rectangle((16, 16, w + 32, h + 32), radius=max(16, int(38 * scale)), outline=(255, 223, 103, 145), width=max(4, int(9 * scale)))
        scene.alpha_composite(halo.filter(ImageFilter.GaussianBlur(7)), (x - 24, y - 24))
    scene.alpha_composite(resized, (x, y))


def camera_position(time_seconds: float) -> tuple[float, int, float]:
    segment = time_seconds / SECONDS_PER_STEP
    index = min(int(segment), len(STEPS) - 1)
    local = segment - index
    if index >= len(STEPS) - 1:
        return index * CARD_SPACING, index, 1.0
    move = ease(max(0.0, (local - 0.48) / 0.52))
    return lerp(index * CARD_SPACING, (index + 1) * CARD_SPACING, move), index, local


def render_frame(frame: int, total_frames: int) -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw_background(image, frame, total_frames)
    draw = ImageDraw.Draw(image, "RGBA")

    time_seconds = frame / FPS
    camera_x, active_index, local = camera_position(time_seconds)
    display_index = max(0, min(len(STEPS) - 1, int(round(camera_x / CARD_SPACING))))

    intro = 1.0 - ease(min(1.0, time_seconds / 2.2))
    draw.text((52, 34), "TITLE", fill=(255, 255, 255, 210), font=FONTS["hero_small"])
    draw.text((52, 70), "COMMITMENT PROCESS", fill=(255, 255, 255, 235), font=FONTS["hero"])
    draw.rounded_rectangle((52, 146, 488, 205), radius=18, fill=(255, 255, 255, int(190 * max(0.25, intro))), outline=(255, 255, 255, 120), width=2)
    draw.text((74, 162), "A 3D training walkthrough from order intake to issued commitment", fill=BLUE_DARK, font=FONTS["body_bold"])

    order: list[tuple[float, int, float, float]] = []
    for i in range(len(STEPS)):
        world_x = i * CARD_SPACING
        dx = world_x - camera_x
        z = 1.0 + abs(dx) * 0.52
        screen_x = WIDTH / 2 + dx * 150 / z
        bob = math.sin(frame / 18 + i) * 4
        screen_y = 386 + abs(dx) * 12 + bob
        active = max(0.0, 1.0 - abs(dx) / CARD_SPACING)
        order.append((z, i, screen_x, screen_y + 88 * (1 - active)))

    for z, i, screen_x, screen_y in sorted(order, reverse=True):
        dx = i * CARD_SPACING - camera_x
        active = max(0.0, 1.0 - abs(dx) / CARD_SPACING)
        scale = 0.22 + active * 0.58
        card = make_card(STEPS[i], active, phase=frame / FPS + i * 0.37)
        paste_card(image, card, (screen_x, screen_y), scale, active)

    progress_width = 760
    progress_x = (WIDTH - progress_width) // 2
    progress_y = HEIGHT - 86
    draw.rounded_rectangle((progress_x, progress_y, progress_x + progress_width, progress_y + 16), radius=8, fill=(255, 255, 255, 55))
    progress = min(1.0, time_seconds / (len(STEPS) * SECONDS_PER_STEP))
    draw.rounded_rectangle((progress_x, progress_y, progress_x + int(progress_width * progress), progress_y + 16), radius=8, fill=GOLD)
    label = f"Step {STEPS[display_index]['num']}: {STEPS[display_index]['title']}"
    text_center(draw, (WIDTH / 2, HEIGHT - 40), label, (255, 255, 255), FONTS["body_bold"])

    final_focus = max(0.0, 1.0 - abs(((len(STEPS) - 1) * CARD_SPACING) - camera_x) / CARD_SPACING)
    if display_index == len(STEPS) - 1 and final_focus > 0.55:
        alpha = int(210 * ease((final_focus - 0.55) / 0.45))
        draw.rounded_rectangle((802, 106, 1195, 248), radius=24, fill=(255, 249, 214, alpha), outline=(255, 209, 72, alpha), width=4)
        lines = ["ACCURATE SEARCH", "CAREFUL EXAMINATION", "QUALITY REVIEW", "EFFECTIVE TITLE COMMITMENT"]
        for j, line in enumerate(lines):
            text_center(draw, (999, 134 + j * 28), line, RED, FONTS["body_bold"])

    return image.convert("RGB")


def encode_video(frame_dir: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(frame_dir / "frame_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--frames", type=Path, default=FRAME_DIR)
    args = parser.parse_args()

    total_frames = int(len(STEPS) * SECONDS_PER_STEP * FPS)
    if args.frames.exists():
        shutil.rmtree(args.frames)
    args.frames.mkdir(parents=True)

    for frame in range(total_frames):
        image = render_frame(frame, total_frames)
        image.save(args.frames / f"frame_{frame:04d}.png", optimize=True)
        if frame % FPS == 0:
            print(f"rendered {frame // FPS:02d}s / {math.ceil(total_frames / FPS)}s")

    encode_video(args.frames, args.output)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()

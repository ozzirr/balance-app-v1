#!/usr/bin/env python3
"""Generate localized App Store screenshot sets for Balance."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


CANVAS = (1242, 2688)
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_REGULAR_INDEX = 0
FONT_BOLD_INDEX = 1

WHITE = "#F5F6FA"
MUTED = "#AFB6C5"
VIOLET = "#A98BFF"
MINT = "#70D9AA"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size, index=FONT_BOLD_INDEX if bold else FONT_REGULAR_INDEX)


def premium_background(accent: str) -> Image.Image:
    top = (7, 10, 19)
    bottom = (10, 15, 27)
    canvas = Image.new("RGBA", CANVAS)
    draw = ImageDraw.Draw(canvas)
    for y in range(CANVAS[1]):
        ratio = y / (CANVAS[1] - 1)
        color = tuple(round(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(3))
        draw.line((0, y, CANVAS[0], y), fill=color + (255,))

    glows = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glows)
    glow_draw.ellipse((760, -320, 1510, 430), fill=accent + "30")
    glow_draw.ellipse((-420, 2050, 420, 2890), fill="#4FC69A18")
    glows = glows.filter(ImageFilter.GaussianBlur(190))
    canvas.alpha_composite(glows)

    # Subtle vertical light gives the set depth without becoming a graphic element.
    light = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    light_draw = ImageDraw.Draw(light)
    light_draw.rectangle((0, 0, 260, CANVAS[1]), fill="#FFFFFF08")
    light = light.filter(ImageFilter.GaussianBlur(170))
    canvas.alpha_composite(light)
    return canvas


def draw_copy(
    canvas: Image.Image,
    headline: tuple[str, ...],
    subtitle: tuple[str, ...],
    accent: str,
) -> None:
    draw = ImageDraw.Draw(canvas)
    x = 88
    draw.rounded_rectangle((x, 112, x + 58, 120), radius=4, fill=accent)

    headline_font = font(76, bold=True)
    y = 166
    for line in headline:
        draw.text((x, y), line, font=headline_font, fill=WHITE)
        y += 88

    subtitle_font = font(34)
    y += 28
    for line in subtitle:
        draw.text((x, y), line, font=subtitle_font, fill=MUTED)
        y += 45


def rounded_ui(source: Path, width: int, crop_top: int = 0) -> Image.Image:
    image = Image.open(source).convert("RGB")
    if crop_top:
        image = image.crop((0, crop_top, image.width, image.height))
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width, image.height), radius=46, fill=255)
    image.putalpha(mask)
    return image


def place_ui(canvas: Image.Image, source: Path, x: int, y: int, width: int, crop_top: int = 0) -> None:
    ui = rounded_ui(source, width, crop_top)

    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (x, y + 26, x + ui.width, y + ui.height + 26),
        radius=48,
        fill="#000000B8",
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(42))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(ui, (x, y))


def render_feature(
    source: Path,
    output: Path,
    headline: tuple[str, ...],
    subtitle: tuple[str, ...],
    accent: str,
    *,
    ui_x: int,
    ui_y: int,
    ui_width: int,
    crop_top: int,
) -> None:
    canvas = premium_background(accent)
    draw_copy(canvas, headline, subtitle, accent)
    place_ui(canvas, source, ui_x, ui_y, ui_width, crop_top)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, "PNG", optimize=True)


def render_cta(icon_path: Path, output: Path, locale: str) -> None:
    canvas = premium_background(VIOLET)
    draw = ImageDraw.Draw(canvas)

    x = 88
    draw.rounded_rectangle((x, 112, x + 58, 120), radius=4, fill=MINT)
    title_font = font(82, bold=True)
    if locale == "it":
        title = ("Prendi il controllo", "del tuo patrimonio")
        subtitle = "Semplice. Privato. Sempre tuo."
        signature = "Il tuo patrimonio, nel tempo."
        cta = ("Inizia oggi.", "Il tuo patrimonio merita chiarezza.")
    else:
        title = ("Take control of", "your net worth")
        subtitle = "Simple. Private. Always yours."
        signature = "Your net worth, over time."
        cta = ("Start today.", "Your net worth deserves clarity.")

    draw.text((x, 172), title[0], font=title_font, fill=WHITE)
    draw.text((x, 272), title[1], font=title_font, fill=WHITE)
    draw.text((x, 414), subtitle, font=font(37), fill=MUTED)

    icon_size = 500
    icon = Image.open(icon_path).convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", icon.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, icon_size, icon_size), radius=112, fill=255)
    icon.putalpha(mask)
    icon_x = (CANVAS[0] - icon_size) // 2
    icon_y = 790

    glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((icon_x - 130, icon_y - 130, icon_x + icon_size + 130, icon_y + icon_size + 130), fill="#9473FF42")
    glow = glow.filter(ImageFilter.GaussianBlur(145))
    canvas.alpha_composite(glow)

    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (icon_x, icon_y + 30, icon_x + icon_size, icon_y + icon_size + 30),
        radius=112,
        fill="#000000C0",
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(50))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(icon, (icon_x, icon_y))

    draw = ImageDraw.Draw(canvas)
    draw.text((x, 1580), "Balance", font=font(60, bold=True), fill=WHITE)
    draw.text((x, 1660), signature, font=font(36), fill=MUTED)

    # A restrained brand signature derived from the icon's balance line.
    draw.rounded_rectangle((x, 1775, 420, 1783), radius=4, fill="#52689F")
    draw.rounded_rectangle((x, 1810, 300, 1818), radius=4, fill=MINT)

    draw.text((x, 2250), cta[0], font=font(54, bold=True), fill=WHITE)
    draw.text((x, 2322), cta[1], font=font(33), fill=MUTED)

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, "PNG", optimize=True)


def render_offline_first(icon_path: Path, output: Path, locale: str) -> None:
    canvas = premium_background(MINT)
    if locale == "it":
        headline = ("Offline-first,", "davvero")
        subtitle = ("Nessun conto bancario da collegare.",)
        rows = [
            ("Dati sul dispositivo", "Funziona offline. Il patrimonio non viene inviato online."),
            ("Nessun account richiesto", "Inizia senza registrazione o sincronizzazione."),
            ("Aggiorna quando vuoi", "Anche una sola volta al mese."),
        ]
        badge = "Manuale per scelta. Privato per design."
    else:
        headline = ("Offline-first,", "for real")
        subtitle = ("No bank account connection required.",)
        rows = [
            ("Data stays on device", "Works offline. Your net worth is never sent online."),
            ("No account required", "Start without signup or cloud sync."),
            ("Update on your terms", "Even just once a month."),
        ]
        badge = "Manual by choice. Private by design."

    draw_copy(
        canvas,
        headline,
        subtitle,
        MINT,
    )
    draw = ImageDraw.Draw(canvas)

    panel = (88, 610, 1154, 2110)
    draw.rounded_rectangle(panel, radius=52, fill="#111620", outline="#FFFFFF14", width=2)

    icon_size = 164
    icon = Image.open(icon_path).convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", icon.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, icon_size, icon_size), radius=38, fill=255)
    icon.putalpha(mask)
    canvas.alpha_composite(icon, (918, 680))

    title_font = font(48, bold=True)
    body_font = font(33)
    row_y = 760
    for index, (title, body) in enumerate(rows):
        dot_y = row_y + 18
        draw.ellipse((138, dot_y, 158, dot_y + 20), fill=MINT)
        draw.text((194, row_y), title, font=title_font, fill=WHITE)
        draw.text((194, row_y + 70), body, font=body_font, fill=MUTED)
        if index < len(rows) - 1:
            draw.line((138, row_y + 250, 1098, row_y + 250), fill="#FFFFFF12", width=2)
        row_y += 370

    draw.rounded_rectangle((138, 1882, 1104, 1998), radius=58, fill="#18251F", outline="#70D9AA58", width=2)
    draw.text((194, 1911), badge, font=font(34, bold=True), fill=MINT)

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", type=Path, help="Deprecated; kept for command compatibility")
    parser.add_argument("--dashboard", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--wallet", type=Path, required=True)
    parser.add_argument("--cashflow", type=Path, required=True)
    parser.add_argument("--icon", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--locale", choices=("it", "en"), default="it")
    args = parser.parse_args()

    copy = {
        "it": [
            (("Il tuo patrimonio,", "nel tempo"), ("Liquidità, investimenti e previdenza", "in una sola vista.")),
            (("Segui ogni cambiamento",), ("Confronta il patrimonio mese dopo mese.",)),
            (("Organizza ciò", "che possiedi"), ("Conti, investimenti e previdenza", "sempre in ordine.")),
            (("Anticipa il tuo", "cash flow"), ("Entrate e uscite ricorrenti,", "senza sorprese.")),
        ],
        "en": [
            (("Your net worth,", "over time"), ("Cash, investments and retirement", "in one clear view.")),
            (("Track every change",), ("Compare your net worth month by month.",)),
            (("Organize what", "you own"), ("Cash, investments and retirement", "always in order.")),
            (("Plan your", "cash flow"), ("Recurring income and expenses,", "with no surprises.")),
        ],
    }[args.locale]

    # A single, deliberate frame across every feature card: the complete app
    # screen remains visible, including the bottom tab bar.
    shared_layout = dict(ui_x=121, ui_y=510, ui_width=1000, crop_top=0)
    cards = [
        (
            args.dashboard,
            "01-patrimonio-nel-tempo.png",
            *copy[0],
            VIOLET,
            shared_layout,
        ),
        (
            args.snapshot,
            "03-snapshot.png",
            *copy[1],
            MINT,
            shared_layout,
        ),
        (
            args.wallet,
            "04-wallet.png",
            *copy[2],
            VIOLET,
            shared_layout,
        ),
        (
            args.cashflow,
            "05-cashflow.png",
            *copy[3],
            MINT,
            shared_layout,
        ),
    ]

    for source, filename, headline, subtitle, accent, layout in cards:
        render_feature(source, args.out / filename, headline, subtitle, accent, **layout)

    render_offline_first(args.icon, args.out / "02-offline-first.png", args.locale)
    cta_filename = "06-inizia-balance.png" if args.locale == "it" else "06-start-balance.png"
    render_cta(args.icon, args.out / cta_filename, args.locale)


if __name__ == "__main__":
    main()

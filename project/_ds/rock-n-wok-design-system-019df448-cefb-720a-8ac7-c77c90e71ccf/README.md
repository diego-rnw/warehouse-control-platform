# ROCK N' WOK — Design System

> Una mezcla entre tradición china, actitud contemporánea y un estilo visual memorable.
> **Urbano · Moderno · Atrevido · Energético**

ROCK N' WOK is a Chinese-food brand built on attitude. The visual language is loud, high-contrast, and uncompromising — full black backgrounds, signature yellow, and Maneki the cat throwing rock-horns. This system codifies how to design **on-brand** for the brand's slide decks, menus, marketing, and any other surface that needs to feel like ROCK N' WOK.

---

## At a glance

- **Wordmark:** "ROCK N' WOK" set in **Monument Extended Ultrabold**, all caps, with a yellow underline accent under the "N".
- **Mascot:** **Maneki**, a stylized lucky cat throwing the 🤘 sign. Black + yellow + white only — never recolor him.
- **Dominant trio:** Pure black `#000000` · Yellow `#FFCD02` · White `#FFFFFF`.
- **Accents (sparingly!):** Orange `#E84926` · Green `#29E7BC`.
- **Type:** Monument Extended (display) + Montserrat (everything else, variable weight).

---

## Source materials provided

The brand owner shipped these raw assets (originals preserved in `uploads/`, working copies in `assets/` and `fonts/`):

| Original file | Working copy | Use |
|---|---|---|
| `Logo_RNW_Mesa de trabajo 1.png` | `assets/logo-rnw-color.png` | Full-color logo (black wordmark + yellow underline) — use on white/light. |
| `Logo_RNW-02.png` | `assets/logo-rnw-white-on-black.png` | White wordmark on black — primary lockup for dark surfaces. |
| `Logo_RNW-03.png` | `assets/logo-rnw-black.png` | All-black wordmark — silhouette / single-color print. |
| `RockNWok_Gatito-04.png` | `assets/maneki-cat.png` | Maneki mascot illustration (transparent PNG). |
| `Paleta de colores.png` | `assets/palette-reference.png` | Original Pantone-spec palette sheet. |
| `Montserrat-VariableFont_wght.ttf` | `fonts/Montserrat-VariableFont_wght.ttf` | Body / UI font (full weight range 100–900). |
| `Montserrat-Black.ttf` | `fonts/Montserrat-Black.ttf` | Static fallback at weight 900. |
| `MonumentExtended-Ultrabold.otf` | `fonts/MonumentExtended-Ultrabold.otf` | Display font for titles & wordmark. |

No codebase, no Figma — this system is built from the brand guidelines, palette sheet, and logo lockups provided directly by the brand owner.

---

## CONTENT FUNDAMENTALS

The brand speaks **Spanish** by default (this is a Mexican brand serving Chinese food with attitude).

### Tone
- **Direct, loud, irreverent.** Short sentences. Few words on screen. Let typography do the shouting.
- **Confident, never apologetic.** No softening qualifiers ("maybe", "kind of", "we hope").
- **Urban + irreverent + a little punk.** Imagine a rock concert poster, not a restaurant menu.
- **Tradition meets attitude.** Reference Chinese food + culture honestly, but filter it through a contemporary, street-wear voice.

### Casing
- **Hero titles → ALL CAPS.** Always. Monument Extended in caps is the brand's primary voice.
- **Labels & kickers → ALL CAPS** with wide letter-spacing (`0.16em`). Examples: `PROYECTO:`, `MENÚ:`, `CAPÍTULO 01`, `2025`.
- **Body copy → Sentence case** in Montserrat. Keep it short.
- **Avoid Title Case.** It softens the brand.

### Punctuation & idiom
- The brand name is written **"ROCK N' WOK"** — note the apostrophe replaces the "and". When set in the logo it carries a yellow underline beneath the **N**. In running text, write `ROCK N' WOK` in caps.
- Use **bold em-dashes** ("—") and ALL-CAPS callouts to break up paragraphs.
- Numbers and prices are loud — set in display weights when they're a focal point.

### Pronouns / address
- Address the customer directly, **tú** (informal Spanish). Never **usted**.
- "We" voice from the brand uses first-person plural — but use it rarely. Most copy is imperative or declarative ("PIDE AHORA", "NUEVO SABOR").

### Emoji
- **No.** The Maneki cat does the work emoji would do. The brand has its own visual mascot — don't dilute it with emoji.
- One exception: the 🤘 rock-horns gesture is a brand motif (Maneki throws it). It's fine in social copy as a wink, but never in headers or formal materials.

### Example copy

✅ On-brand:
- `PROYECTO: NUEVA CARTA OTOÑO 2025`
- `WOKS QUE ROCKEAN`
- `PIDE AHORA. SIN PRETEXTOS.`
- `CAPÍTULO 03 — MENÚ`

❌ Off-brand:
- `Welcome to our wonderful selection of Chinese-inspired dishes...`
- `We hope you'll love our new menu items! 🥡✨`
- `Check Out The New Fall Menu`

---

## VISUAL FOUNDATIONS

### Color
- The brand is a **black canvas**. Default every layout to `#000000` background — full black, *not* process black, *not* `#111`. Pure black gives the yellow its punch.
- **Yellow `#FFCD02` is the protagonist.** Use it for the underline-accent under titles, for callout blocks, for kickers, for one-word emphasis, and for the wordmark accent.
- **White is the primary text color** on dark surfaces. Reserve white for body copy and headlines that don't need yellow energy.
- **Orange `#E84926` and Green `#29E7BC` are accents only** — for tiny dots, single chips, a numeric kicker, a stripe, a chart highlight. Never as a hero block. Never as a background.
- **No gradients.** Solid blocks of color, hard edges. The brand is flat by design.

### Typography
- **Monument Extended Ultrabold** — the megaphone. Use only for hero titles, slide titles, posters. Always uppercase, very tight tracking, line-height ~0.95.
- **Montserrat** — everything else. Take advantage of the variable weight range:
  - `900 (Black)` for **kickers** like `PROYECTO:` and high-energy labels
  - `800 / 700` for sub-titles and emphasis
  - `500` for UI labels
  - `400` for body
  - `300` for long-form running copy (rare)
- **Don't mix more than two type families.** Monument + Montserrat is the entire kit.
- **Hierarchy is created by SIZE + WEIGHT, not color.** Massive title → tiny kicker → medium body. The contrast itself is the design.

### Layout & composition
- **Generous space + tight type.** Headlines are huge and pressed up against each other; the surrounding canvas breathes black.
- **Asymmetric, anchored to corners.** Titles often hug the left edge. Maneki sometimes peeks in from a corner.
- **Big jumps in scale.** Kicker at 14px and headline at 144px in the same composition. The drama is the point.
- **Stack, don't center.** Left-aligned blocks > centered text. Centering kills the urban energy.
- **8-pt grid** with 4px micro-adjustments. Generous padding (`48–96px`) on slides and posters.

### Backgrounds
- **Full black flats** are the default. ~80% of layouts.
- **White-on-yellow** or **black-on-yellow** for high-energy callout slides.
- **Photos** should be high-contrast, often desaturated or duotone-tinted toward black + yellow. No soft pastels, no warm-Instagram filters.
- **No textures, no patterns, no gradient meshes.** Cleanliness is the brand.
- The yellow **underline accent** (the bar under the "N" in the logo) is a recurring motif — apply under emphasized words.

### Animation
- **Snap, don't drift.** Cuts and hard transitions over slow fades.
- Easing: `cubic-bezier(0.2, 0.9, 0.3, 1)` for confident snaps; `linear` for marquees.
- Wordmarks slide in fast (~180ms). Maneki bounces (slight overshoot, 1.05× scale).
- Avoid: parallax, slow fades, particle effects, anything "elegant".

### Hover / press states
- **Hover on yellow:** darken to `#E6B800` (var `--rnw-yellow-dark`) — no opacity changes.
- **Hover on dark surfaces:** lighten background to `#1A1A1A` or add a 1px yellow border-bottom.
- **Press:** `transform: translateY(1px)` + immediate color shift. No bounce on press.
- **Focus:** 2px yellow outline at `2px` offset. Never blue browser default.

### Borders, corners, shadows
- **Sharp corners by default.** Buttons and cards default to `border-radius: 0` or 2–4px max. Pill shapes (`999px`) only for chip-style tags.
- **Borders are thick and confident** (2px or 3px), in yellow or white. Hairline borders feel weak — avoid.
- **Shadows are rare.** When used: a hard-offset block (`0 12px 0 0 #FFCD02`), never a blurred soft shadow. The brand is FLAT.
- **No glassmorphism, no blur, no inner shadows.**

### Cards
- A "card" in this system is a **flat black block with a yellow border** OR a **flat yellow block with black text**. That's it.
- Optional: a yellow underline at the top of a card title block (echoing the logo accent).
- Padding is generous: `32–48px`.

### Imagery
- Photography of food: top-down, hard light, on a black or yellow surface. Sticky, glossy textures (sauce, glaze) play well with the high-contrast palette.
- Lifestyle imagery: urban, night, neon-adjacent — but desaturated so the brand yellow stays the brightest thing on screen.
- **Black & white + yellow accent** is a signature treatment.

### Use of transparency / blur
- **Almost never.** The brand is opaque, flat, decisive. Transparency suggests softness, which is off-brand.
- A rare exception: low-opacity white text (~48%) for legal / disclaimer copy.

### Layout rules / fixed elements
- The wordmark when present sits **top-left** or **bottom-right** at consistent margin (~48–64px from edge).
- Maneki, when used, peeks in from a corner — never centered like a stamp. He should feel like he's *intruding*, not posing.
- Page numbers, dates, "CAPÍTULO XX" labels live in the bottom-left as small kickers in Montserrat 900 / 12px.

---

## ICONOGRAPHY

ROCK N' WOK has **no proprietary icon system** — the brand owner did not provide one, and the visual language doesn't lean on icons. The mascot **Maneki** does much of the work an icon set would do in another brand.

### Approach
- **Maneki is the icon.** When you need a "wow" or "highlight" moment, place Maneki rather than a generic icon.
- **No emoji.** See Content Fundamentals.
- **Unicode glyphs are fine** for arrows (`→ ← ↑ ↓`), bullets (`•`), and plus/minus. Set them in Montserrat Black for weight.
- **For utility icons** (cart, location, clock, etc. — needed in apps/web): use **Lucide** at stroke-width `2.5` (load via CDN — `https://unpkg.com/lucide@latest/dist/umd/lucide.js`) for its bold, geometric, slightly punk feel. Render in white or yellow; never multi-color. **This is a substitution** — flag to the user if they want a custom icon set instead.
- **Custom illustrations** (food, instruments, kitchen tools) should be commissioned in Maneki's style: **black + yellow + white**, hand-drawn line, slight imperfection, no gradients. Never auto-generate them.

### Logo usage rules
- Use the **full wordmark** — never crop, recolor, or split it.
- On dark/black: use `assets/logo-rnw-white-on-black.png`.
- On light/white: use `assets/logo-rnw-color.png` (black wordmark + yellow underline).
- For single-color print or where yellow isn't available: `assets/logo-rnw-black.png`.
- Maintain clear-space: at least the height of the "R" on all sides.
- Minimum size: 80px wide on screen, 20mm wide in print.

### Mascot usage rules
- Always use the original `assets/maneki-cat.png`. Don't recolor.
- Maneki appears at **3 standard sizes**: large (hero, ~600px tall), medium (corner accent, ~240px), small (icon-replacement, ~80px).
- Maneki should "peek" or "intrude" into compositions — never centered as a stamp.

---

## INDEX — what's in this folder

```
/
├── README.md                    ← you are here
├── SKILL.md                     ← agent skill manifest
├── colors_and_type.css          ← all color & type tokens (CSS vars + classes)
├── assets/
│   ├── logo-rnw-color.png       ← black wordmark + yellow underline (light bg)
│   ├── logo-rnw-white-on-black.png  ← white wordmark (dark bg) — PRIMARY
│   ├── logo-rnw-black.png       ← all-black wordmark (silhouette)
│   ├── maneki-cat.png           ← brand mascot
│   └── palette-reference.png    ← original Pantone palette sheet
├── fonts/
│   ├── Montserrat-VariableFont_wght.ttf  ← variable, 100–900
│   ├── Montserrat-Black.ttf
│   └── MonumentExtended-Ultrabold.otf
├── preview/                     ← cards shown in the Design System tab
└── slides/                      ← sample slide templates (16:9, 1280×720)
    └── index.html
```

### Quick start

```html
<link rel="stylesheet" href="colors_and_type.css" />
<body style="background: var(--bg-1); color: var(--fg-1);">
  <p class="rnw-kicker">PROYECTO:</p>
  <h1 class="rnw-display-xl">WOKS QUE ROCKEAN</h1>
</body>
```

---
name: Add2Wallet
description: A quiet, fast tool for turning a ticket, coupon, or membership card into a signed Apple Wallet pass.
colors:
  bg: "oklch(98% 0.004 210)"
  bg-subtle: "oklch(95.5% 0.006 210)"
  fg: "oklch(23% 0.014 210)"
  fg-muted: "oklch(46% 0.014 210)"
  fg-faint: "oklch(62% 0.012 210)"
  border: "oklch(87% 0.009 210)"
  border-strong: "oklch(78% 0.012 210)"
  accent: "oklch(52% 0.10 200)"
  accent-hover: "oklch(46% 0.11 200)"
  accent-active: "oklch(41% 0.11 200)"
  accent-fg: "oklch(99% 0.004 200)"
  accent-subtle: "oklch(94% 0.02 200)"
  danger: "oklch(54% 0.19 27)"
  danger-bg: "oklch(96% 0.03 27)"
  danger-border: "oklch(85% 0.07 27)"
  success: "oklch(58% 0.14 152)"
  success-bg: "oklch(95% 0.04 152)"
typography:
  title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  data:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "0.01em"
rounded:
  control: "10px"
  pass: "18px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.bg-subtle}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
---

# Design System: Add2Wallet

## 1. Overview

**Creative North Star: "The Quiet Counter"**

Picture a well-run box-office window: no queue, no small talk, the clerk
already knows what you need before you finish asking. That's the standard
here. Add2Wallet is a three-screen personal tool — login, upload, review —
used in short, task-focused bursts by one person who wants a ticket in
their Wallet and nothing else from the interface. Every screen is legible
on first glance, with no decoration competing with the task and no chrome
standing in for screens that don't exist.

The interface stays out of the way almost everywhere, which is what makes
the one place it doesn't — the review screen's pass preview — land. That
preview is the emotional payoff of the whole flow (this is what's about to
be in your Wallet), and it's the only surface with extra visual craft: a
larger corner radius that echoes an actual Wallet pass, a soft ambient
shadow (the one documented exception to flat-by-default), and a subtle
top-left gloss that reads as a physical stacked card rather than a flat
`<div>`.

What this rejects: SaaS-marketing visual tropes (hero gradients, big
rounded icon+heading+text cards, feature grids, testimonial carousels),
dashboard chrome bolted onto a tool that has three screens total, and
consumer-app cuteness (confetti, mascots, playful copy). Nearest reference
points in spirit: Raycast and Linear for restraint and speed, Things 3 for
how a small personal tool can still feel considered, Apple's own
Wallet/Passbook rendering for the literal subject matter — used honestly
(the pass preview is a flat colored card with a soft shadow, the way a
real `.pkpass` actually renders in Wallet, not a glass/blur effect, which
would misrepresent what the artifact looks like).

**Key Characteristics:**
- Restrained color — a near-monochrome, cool-tinted neutral scale (never pure black/white) with one deep-teal accent (`oklch(52% 0.10 200)`) used only for primary actions, focus rings, and links.
- Geist for all UI text; Geist Mono specifically for barcode values and any field that's costly to get wrong — monospace is a semantic signal, not a stylistic one.
- Responsive, not choreographed, motion — a 120–200ms `ease-out-quart` on hover/focus/press states, a `:active` scale-down for tactile feedback, nothing that performs on load.
- Flat by default (`--radius-control: 10px`, no shadows) with one documented, deliberate exception: the pass preview (`--radius-pass: 18px` + `--shadow-pass`).

## 2. Colors

**The Restrained Rule.** Neutrals do almost all the work; the accent
(`accent`, deep teal) appears only on primary buttons, focus rings, links,
and the dropzone's active/hover state — never as page-wide decoration.

### Primary
- **Accent — deep teal** (`oklch(52% 0.10 200)`, brightened to `oklch(72% 0.12 200)` in dark mode for contrast against the dark background): the single interactive color. Cool and precise, reads as calm competence rather than urgency.

### Neutral
- **Background** (`oklch(98% 0.004 210)` light / `oklch(19% 0.012 210)` dark): the page surface. Tinted very slightly cool rather than pure white/black.
- **Background, subtle** (`oklch(95.5% 0.006 210)` / `oklch(24% 0.014 210)`): input fills, the dropzone, code blocks — one step off the page background.
- **Foreground** (`oklch(23% 0.014 210)` / `oklch(93% 0.008 210)`): primary text.
- **Foreground, muted / faint**: secondary text and placeholder-tier text, two steps of recession off the primary foreground.
- **Border / border-strong**: input outlines and section dividers. `border-strong` is reserved for hover states, never used at rest.

### Semantic
- **Danger** (`oklch(54% 0.19 27)`): error banners and the barcode-verify hint's implied stakes. Always paired with an icon (`WarningCircle`), never color alone.
- **Success** (`oklch(58% 0.14 152)`): reserved for future success confirmations. Currently unused in the shipped screens (no success state exists yet in the flow) but tokenized for consistency.

### Named Rules
**The Ten Percent Rule.** The accent color's total footprint on any single screen stays under 10% of the visible surface. On the review screen, that's exactly one button and one focus ring at a time — never more.

## 3. Typography

**Body/UI Font:** Geist (loaded via `next/font/google` in `app/layout.tsx`, exposed as `--font-geist-sans`).
**Data/Mono Font:** Geist Mono (`--font-geist-mono`), reserved for barcode values and the "dates usually go here" secondary field group on the review screen.

**Character:** One well-made UI sans carries everything read as prose or a label — no serif, no second display face. Monospace is never decorative: when a field renders in Geist Mono, it means "this is exact data, check it," which matters most on the review screen where a wrong barcode or date is the single most expensive mistake the app can make.

### Hierarchy
- **Title** (600, 22px, -0.01em): the one heading per screen — "Welcome back," "Add a pass," "Review pass." No larger display scale exists; this tool has no hero moment to earn one.
- **Body** (400, 14–15px): subtitles, form values, button labels.
- **Label** (500, 13px): field labels, always positioned above their input.
- **Data** (400, 14px, Geist Mono): barcode value, primary/secondary field values in the review form's field-list editor, the pass preview's barcode readout.

### Named Rules
**The Mono-Means-Verify Rule.** Monospace is applied to primary and secondary fields (which most often carry dates, gate numbers, seat numbers) and the barcode value, never to auxiliary fields or free-text descriptions. If a new field type is added, ask "would getting this wrong break the pass at the gate?" before deciding whether it earns monospace.

## 4. Elevation

Flat by default — `--radius-control: 10px`, no box-shadow anywhere in the
form chrome (inputs, buttons, section dividers use a 1px border, not
elevation). The one exception is the pass preview, which carries
`--shadow-pass` (a two-layer, hue-tinted shadow — never pure black) plus a
subtle top-left gloss gradient. This is deliberate: it's the one object
in the app meant to read as physical.

### Shadow Vocabulary
- **`--shadow-pass`** (light: `0 1px 2px oklch(20% 0.01 210 / 0.06), 0 16px 32px -10px oklch(20% 0.03 210 / 0.24)`; dark: `0 1px 2px oklch(0% 0 0 / 0.35), 0 20px 40px -10px oklch(0% 0 0 / 0.55)`): used exclusively on the pass preview card, to separate it from the surrounding form the way a real Wallet pass floats above the stack behind it.

### Named Rules
**The Flat-By-Default Rule.** No box-shadow as decoration anywhere else. If a future component needs to feel separated from its background, reach for a background-tone change or a hairline border before reaching for a shadow — the pass preview is the one earned exception, not a precedent.

## 5. Components

### Buttons
- **Shape:** `--radius-control` (10px), consistent with inputs.
- **Primary:** `accent` background, `accent-fg` text, 44px height, 0 20px padding. Hover darkens to `accent-hover`, active to `accent-active` plus a `scale(0.98)` tactile press.
- **Ghost:** transparent background, `border` outline, `fg-muted` text — used for the single secondary action ("Back"). Hover brightens text to `fg` and border to `border-strong`.
- Disabled state: `opacity: 0.5` on both variants, no color change.

### Inputs / Fields
- **Style:** `bg-subtle` fill, 1px `border` outline, `--radius-control`, label positioned above via the shared `Field` component — never placeholder-as-label.
- **Focus:** border shifts to `accent`, background lifts to `bg` (page-level), plus the global 2px accent `:focus-visible` outline. Focus rings only appear on keyboard focus, never on mouse click.
- **Mono variant:** barcode value and primary/secondary field-list values render in Geist Mono via a shared `.mono` class (see Typography, The Mono-Means-Verify Rule).
- **Color inputs:** native `<input type="color">`, restyled to match the standard input shell (same radius, border, background) rather than the browser default.
- **Error:** field-level error text renders below the input in `danger`, 12px, via the shared `Field` component's `error` prop (not yet exercised by real validation copy — currently only the aggregate `StatusMessage` banner is used for validation/submission errors).

### Status Messages
- **Style:** icon (Phosphor `WarningCircle` for error, `CheckCircle` for success, `fill` weight) plus text, on a tinted background (`danger-bg` / `success-bg`) with a matching 1px border. Meaning is always carried by icon + text together, never color alone.
- **Details slot:** optional secondary content below the header line — a validation-issue list, or (on the upload screen) a monospace `<pre>` dump of raw OCR text when structuring fails outright.

### Pass Preview (signature component)
- **Shape:** `--radius-pass` (18px) — larger than every other radius in the app, deliberately, because it's echoing a real Wallet pass's actual corner radius, not decoration.
- **Background / text:** driven live by the form's `backgroundColor`/`foregroundColor` fields via inline CSS custom properties (`--pass-bg`, `--pass-fg`), so the preview always matches exactly what gets signed into the `.pkpass`.
- **Shadow:** `--shadow-pass` (see Elevation) plus a `linear-gradient(160deg, rgb(255 255 255 / 0.16), transparent 45%)` overlay for a soft top-left sheen — a physical-object cue, not a glass/blur material (the real pass isn't glass; see Overview).
- **Layout:** organization name (uppercase, 12px, 0.82 opacity) + style badge (pill, `color-mix` tinted to the pass's own foreground) in the header row; title (19px/600) + description below; primary fields (16px/600 values) and secondary+auxiliary fields (13px/500, 0.92 opacity) as wrapping label/value groups; a bottom barcode row (QR icon + Geist Mono value + format label) separated by a `color-mix`-tinted hairline.
- **Honesty rule:** no fake rendered barcode graphic. The barcode row shows the icon, the raw value in mono, and the format name as text — never a synthesized scannable-looking code, which would misrepresent what the app can actually produce without a barcode-rendering dependency.

## 6. Do's and Don'ts

### Do:
- **Do** keep the accent color's footprint under 10% of any screen (The Ten Percent Rule).
- **Do** render barcode values and primary/secondary field values in Geist Mono (The Mono-Means-Verify Rule).
- **Do** give the pass preview the only shadow and the only non-10px radius in the app — it's the one moment of payoff in the flow.
- **Do** carry error/success meaning via icon + text together (`StatusMessage`), never color alone.
- **Do** keep transitions to 120–200ms `ease-out-quart` state changes (hover, focus, press) — confirm what happened, don't perform.
- **Do** tint every neutral toward the accent's hue (210° for neutrals, 200° for the accent) — never pure `#000`/`#fff`.

### Don't:
- **Don't** use SaaS-marketing visual tropes: hero gradients, big rounded icon+heading+text cards, feature grids, testimonial carousels. This tool has no marketing surface.
- **Don't** add dashboard chrome — sidebars, top nav, settings sprawl — for a tool that is three screens: login, upload, review.
- **Don't** reach for consumer-app cuteness: mascots, confetti, playful microcopy.
- **Don't** apply box-shadow anywhere outside the pass preview (The Flat-By-Default Rule).
- **Don't** render a fake/synthesized barcode graphic — text + icon + format label only.
- **Don't** apply blur/glass materials to the pass preview. It's a flat colored card with a soft shadow, matching how `.pkpass` actually renders in Apple Wallet — not a glassmorphism surface.

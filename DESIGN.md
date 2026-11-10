---
name: Try FX Replay Free
description: Dark chart-terminal landing for FX Replay, one Electric Blue accent, flat hairline panels.
colors:
  electric-blue: "#0260FD"
  accent-text-blue: "#5695FE"
  button-hover-blue: "#01307F"
  button-pressed-blue: "#012054"
  terminal-black: "#030303"
  panel-black: "#0A0A0A"
  hairline: "#1A1A1A"
  hairline-strong: "#2A2A2A"
  hairline-ghost: "#3A3A3A"
  candle-down: "#4A4A4A"
  input-edge: "#6D6D6D"
  input-edge-hover: "#888888"
  muted-gray: "#888888"
  body-gray: "#D1D1D1"
  paper-white: "#F6F6F6"
  disabled-button-text: "#7A7A7A"
  error-red: "#CD3636"
  error-text: "#F8D7DA"
typography:
  display:
    fontFamily: "Lato, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 4vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Lato, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 1.3rem + 2vw, 2.75rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Lato, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Nunito Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Nunito Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.6
  button:
    fontFamily: "Nunito Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1
  caption:
    fontFamily: "Nunito Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  focus: "2px"
  control: "8px"
  panel: "12px"
spacing:
  2xs: "4px"
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.paper-white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover-blue}"
    textColor: "{colors.paper-white}"
  button-primary-pressed:
    backgroundColor: "{colors.button-pressed-blue}"
    textColor: "{colors.paper-white}"
  button-primary-disabled:
    backgroundColor: "{colors.button-pressed-blue}"
    textColor: "{colors.disabled-button-text}"
  input-text:
    backgroundColor: "{colors.terminal-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  panel:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.body-gray}"
    rounded: "{rounded.panel}"
    padding: "clamp(20px, 3vw, 32px)"
---

# Design System: Try FX Replay Free

## Overview

**Creative North Star: "The Replay Terminal"**

The page reads like a trading terminal with the lights low: a near-black ground, hairline rules where a chart would draw its grid, gray candles, and one blue line that marks "now". Everything that is not the playhead or the action to take stays neutral, so the eye lands on the two places that matter: where the replay stops, and where you sign up.

Density is calm and editorial rather than dashboard-busy. Big Lato Black headlines with tight tracking carry the argument; Nunito Sans body text in a soft light gray does the explaining. Surfaces are flat. Depth comes from one step of tone (terminal black to panel black) and 1px hairlines, never from shadow, blur or gradient.

The tokens come from the FX Replay Brand Kit (`src/styles/tokens.css`, regenerated from `brand-kit.html`). Product code references the kit's **semantic** tokens (`--bg-primary`, `--border-primary`, `--btn-bg-primary-active` ...) and a small set of page-level aliases in `src/styles/global.css` for roles the kit does not name. No raw hex outside `tokens.css`.

**Key Characteristics:**
- Dark-first ground, two tonal surfaces, hairline borders.
- Electric Blue is scarce and semantic: playhead, primary CTA, focus, and the Replay label.
- Lato 900 display with negative tracking; Nunito Sans body.
- Flat: zero shadows anywhere.
- The chart illustration is static SVG computed at build time, styled through chart role aliases.

## Colors

A monochrome terminal palette with a single saturated blue, plus the kit's error pair for form feedback.

### Primary
- **Electric Blue** (`--brand-electric-blue` / `--blue-600`, via `--border-brand`, `--btn-bg-primary-active`, `--chart-playhead`): the playhead line and its marker, the primary button fill, the focused input border, and text selection. Used for shapes and large fills only; it is 3.8:1 on the ground, too low for small text.
- **Accent Text Blue** (`--blue-400`, aliased as `--text-accent` and `--focus-ring`): any blue *text* (links, the "Replay" panel title, caret) and the 2px focus outline. This is the AA-safe stand-in for Electric Blue at text sizes.
- **Button Hover Blue / Button Pressed Blue** (`--blue-800` / `--blue-900`, via `--btn-bg-primary-hover` / `-pressed`): darker steps for button state. `--btn-bg-primary-disabled` also resolves to blue-900 because the kit points it at `blue-950`, which the kit never defines.

### Neutral
- **Terminal Black** (`--bg-primary`, dark-900): page ground, input fill.
- **Panel Black** (`--bg-secondary`, dark-800): the signup panel, diptych panels, the closing band.
- **Hairline** (`--border-primary`, dark-700): header/footer rules, step dividers, chart grid lines, the diptych frame and gutter.
- **Hairline Strong** (`--border-secondary`, dark-600): signup panel border, the hatch in the replay's hidden zone.
- **Ghost Hairline** (`--border-tertiary`, dark-500): the dashed ghost playhead in the Hindsight panel.
- **Input Edge** (alias `--border-input` = neutral-500): text input borders. The kit's border tokens are under 3:1 on the ground, so inputs use this alias to meet WCAG 1.4.11. Hover lifts to `--border-input-hover` (neutral-400).
- **Paper White** (`--text-primary`, neutral-50): headings, labels, strong text, button text.
- **Body Gray** (`--text-secondary`, neutral-200): body copy, captions; also `--chart-up` (rising candles).
- **Muted Gray** (`--text-disabled`, neutral-400): footer, step numerals, the "Hidden" label, the illustration note.
- **Candle Down** (alias `--chart-down` = dark-400): falling candles.

### Feedback
- **Error Red** (`--error`): invalid input border. **Error Text** (`--text-error`, error-light): inline and form-level error messages.

### Named Rules
**The One Blue Rule.** Electric Blue marks only the playhead, the primary CTA, focus and the Replay title. If a new element wants blue and is none of those, it stays neutral.

**The Text Blue Rule.** Blue text always uses `--text-accent` (blue-400), never `--text-brand` (blue-600), on the dark ground.

**The Semantic Token Rule.** Components reference semantic tokens or the global.css aliases, never primitives or hex. A missing role gets a named alias in global.css with a comment saying why.

## Typography

**Display Font:** Lato 900 (with Helvetica Neue, Arial)
**Body Font:** Nunito Sans Variable (with system UI stack)

**Character:** Heavy, compressed-looking Lato Black headlines give the confidence of a trading floor headline; the rounded Nunito Sans body keeps the explanation friendly to cold traffic. Only Lato 400 and 900 are loaded, and 900 is preloaded because the h1 is the LCP element.

### Hierarchy
- **Display** (900, clamp 2.5rem to 4.75rem, 1.05): the hero h1 only, capped at 13ch.
- **Headline** (900, clamp 1.75rem to 2.75rem, 1.05): section titles, capped at 22ch. The signup title uses a smaller clamp (1.5rem to 1.875rem).
- **Title** (900, 1.125 to 1.25rem, -0.01em): step titles, diptych panel titles, step numerals.
- **Body** (400, 1.0625rem, 1.6): all running copy; hero lead scales up to 1.25rem. Measures held at 36 to 52ch.
- **Label** (700, 0.9375rem): form labels; the trader-count line uses 700 at body size.
- **Button** (800, 1rem, 1): button text.
- **Caption** (400, 0.8125 to 0.875rem): illustration note and footer.

### Named Rules
**The Tight Display Rule.** Every Lato heading uses weight 900, line-height 1.05 and negative tracking (-0.03em at headline size and up, -0.01em at title size), with `text-wrap: balance`.

## Layout

Single column inside a `.wrap` container (max 72rem, gutter `clamp(1rem, 4vw, 2.5rem)`). One breakpoint at 56rem: the hero becomes a two-column grid (copy 1.25fr, signup panel min 20rem / 1fr) and the steps section becomes title-left, list-right (1fr / 1.6fr, 4rem gap). Below it everything stacks, with the form directly after the hero copy and before the illustration.

The diptych uses `auto-fit` columns with a 22rem minimum, so it collapses to stacked panels on its own without a media query.

Vertical rhythm is fluid: major sections pad `clamp(3rem, 7vw, 6rem)`, the hero is tighter (`clamp(2rem, 5vw, 4rem)` top) so the diptych and its playhead show in the first desktop viewport. Inner gaps step through 0.25, 0.375, 0.75, 1, 1.5 and 4rem.

## Elevation & Depth

Completely flat. No `box-shadow` anywhere, no blur, no glass, no gradients. Depth is one tonal step (Terminal Black ground, Panel Black surfaces) plus 1px hairlines. The only "lift" is a 1px downward nudge on a pressed button.

### Named Rules
**The Hairline Rule.** Containers separate from the ground with a 1px `--border-primary` or `--border-secondary` line and a tone step, never a shadow. Groups of panels share one frame and a 1px gutter drawn by the frame color showing through.

## Shapes

Gently rounded and consistent: 8px on controls (buttons, inputs), 12px on panels (signup, diptych frame, which clips its children). Focus outlines carry a 2px radius. The only circle is the small neutral dot before the trader-count line. Chart candles use a 1px corner. Hidden future in the replay chart is a 45-degree hatch, not a fade.

## Components

### Buttons
Solid, single-variant, confident.
- **Shape:** 8px radius, 52px minimum height, 24px side padding, no border.
- **Primary:** Electric Blue fill, Paper White text, button type.
- **Hover / Pressed:** fill steps to blue-800, then blue-900 with a 1px translateY; 150ms ease-out transitions.
- **Disabled:** blue-900 fill, dark-100 text, `cursor: progress` (used before the island hydrates). `aria-disabled` while submitting keeps the hover fill.
- The kit also defines secondary, outline and minimal button tokens; this page does not use them.

### Cards / Containers (signup panel)
- **Corner Style:** 12px.
- **Background:** Panel Black; **Border:** 1px Hairline Strong. Success state swaps the border to Electric Blue.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** `clamp(1.25rem, 3vw, 2rem)`, 1rem gap between children.

### Inputs / Fields
- **Style:** Terminal Black fill, 1px Input Edge border, 8px radius, 48px height, 14px side padding, label stacked above with 6px gap.
- **Hover:** border lifts to neutral-400.
- **Focus:** global 2px Accent Text Blue outline at 0 offset plus Electric Blue border.
- **Error:** Error Red border, Error Text message below. Read-only shows Body Gray text.

### Navigation
A bare header: wordmark only (inline SVG, `currentColor`, 18px tall) in a 4rem bar with a bottom hairline. No links. The footer repeats the wordmark at 14px in Muted Gray.

### Steps List
Numbered list without boxes: each item is a two-column row (2.5rem numeral column, text), separated by top hairlines with a closing bottom hairline. Numerals are Lato 900 in Muted Gray, not blue.

### Hindsight / Replay Diptych (signature)
The same build-time SVG candlestick chart drawn twice in one 12px-rounded frame with a 1px gutter. Panels: Panel Black, title (Lato 900, 1.125rem) plus caption. Grid lines in Hairline; rising candles Body Gray, falling candles Candle Down; wicks 1.5px non-scaling. Replay panel: hatched hidden zone past the playhead with a Muted Gray "Hidden" label, a 2px Electric Blue playhead and triangular marker, and the title in Accent Text Blue. Hindsight panel marks the same x with a dashed (4/5) Ghost Hairline line so the two panels align at a glance. A caption-size note below states the prices are made up.

## Do's and Don'ts

### Do:
- **Do** use semantic tokens and global.css aliases (`--text-accent`, `--border-input`, `--chart-*`, `--focus-ring`) instead of primitives or hex.
- **Do** keep Electric Blue to the playhead, the primary CTA, focus and the Replay title.
- **Do** separate surfaces with a 1px hairline and the dark-900 to dark-800 tone step.
- **Do** set Lato headings at 900 with negative tracking and balanced wrapping.
- **Do** draw chart illustrations as static SVG styled through `--chart-up`, `--chart-down` and `--chart-playhead`, labelled as illustrative.
- **Do** keep inputs on `--border-input` so their edge stays at 3:1 or better.

### Don't:
- **Don't** add `box-shadow`, glass/backdrop blur or gradient text to any surface or button.
- **Don't** set small text in `--text-brand` / blue-600; it fails AA on the ground.
- **Don't** reference `--blue-950`; it is not defined in the kit.
- **Don't** color the step numerals, proof dot or candles blue; they are neutral by design.

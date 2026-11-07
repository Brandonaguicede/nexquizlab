---
name: NexQuiz
description: Evaluaciones en vivo para ProfeLink.
colors:
  bg: "#080f1b"
  surface: "#0e192b"
  surface-2: "#172742"
  surface-sunk: "#0a1424"
  line: "#203653"
  line-strong: "#4c6c97"
  text: "#f6f7fc"
  muted: "#b5cbed"
  subtle: "#9eb9df"
  accent: "#087cff"
  accent-hover: "#258dff"
  accent-text: "#39aaff"
  accent-soft: "#12376a"
  on-accent: "#ffffff"
  true: "#12dca3"
  true-ink: "#003e32"
  true-text: "#39e9bc"
  true-soft: "#0d3a34"
  false: "#ff5f83"
  false-ink: "#590e27"
  false-text: "#ff8fa8"
  false-soft: "#402033"
  success: "#4de3b2"
  danger: "#ff6a7e"
  danger-soft: "#42202c"
  field: "#0a172a"
typography:
  display:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "clamp(40px, 3.65vw, 65px)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-.035em"
  headline:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "clamp(32px, 3.5vw, 56px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-.03em"
  section-title:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "31px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-.02em"
  lead:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 750
  caption:
    fontFamily: "'Manrope Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 650
rounded:
  control: "15px"
  card: "20px"
  icon-tile: "17px"
  auth-card: "29px"
  pill: "999px"
spacing:
  compact: "12px"
  control-gap: "12px"
  block: "20px"
  card-grid: "26px"
  section: "32px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.subtle}"
  button-secondary:
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    height: "52px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
---

# Design System: NexQuiz

## Overview

**Creative North Star: "NexQuiz, a luminous classroom"**

NexQuiz retains ProfeLink's blue identity and Manrope typography, with the dimensional dark-blue treatment explicitly supplied in the user's five reference screens on 2026-11-05. Electric-blue controls, cyan edge light, navy surfaces and educational 3D cutouts now define the shared visual language. The supplied references are the visual authority; this is not a claim of pixel identity to their original illustration files.

The current application uses a consistently dark palette, including when the operating system requests light mode. `apps/web/src/styles/reference.css`, imported after `global.css`, owns the current overrides. Preserve the established form labels, readable states and real data while extending the appearance.

**Key Characteristics:**
- Dark navy ground, blue-toned text and luminous primary actions.
- Heavy Manrope headings, rounded controls and restrained cyan edge highlights.
- Blue educational cutouts and vector ribbon geometry around meaningful HTML content.
- Emerald and rose distinguish Verdadero and Falso during play.

## Colors

### Primary
Electric blue carries action; brighter cyan-blue identifies emphasis, focus and illuminated edges. Primary buttons use a blue gradient with an inset highlight, whose exact treatment lives in the sidecar.

### Neutral
The navy ground, surface, sunk surface and raised surface tokens distinguish depth without changing the palette family. White-blue text carries headings; muted and subtle blue carry supporting copy. Borders range from quiet structural lines to stronger control outlines.

### Semantic
True/false colors remain separate from the action color. Each has a fill, readable ink and softer background counterpart. Success and danger are reserved for feedback and destructive actions.

**The Action-and-Answer Rule.** Keep blue for navigation and action, and emerald/rose for answer meaning. Do not substitute a second action palette.

## Typography

**Display and Body Font:** Manrope Variable, self-hosted through `@fontsource-variable/manrope`, with the existing system sans fallback.

Display text is heavy with compact leading and negative tracking. General headings inherit the existing ramp; the supplied surfaces have scoped sizes for the greeting, library heading, login heading and landing headline. Supporting copy stays lighter and blue-tinted. Controls use semibold-to-heavy weights, with normal sentence case.

- Display: landing headline; three-line desktop composition, fluid down to mobile.
- Headline: greeting banner and large application headings.
- Section title: dashboard sections and library grouping.
- Lead: explanatory paragraphs, usually limited to roughly 35–51 characters per line by their surface.
- Control/caption: actions, chips and metadata. Numeric counts use tabular figures where inherited from the existing components.

## Layout

The main shell and header share a centered maximum width (1600px), increasing on very wide screens; desktop gutters are 48px. The teacher start area has its own centered width (1436px). The header uses horizontal navigation and an account chip, then wraps navigation onto a separate row at 900px.

Application content uses task-first hierarchy: section headings, clear primary actions, real questionnaire data, then pagination. The teacher cards form two columns; the library uses a horizontal thumbnail/copy/action row on desktop. At narrower widths the action row wraps, and at 600px the library becomes a single-column card with a two-column action group. The public hero and login use split compositions, stacking at 900px. The instructional sequence becomes one column there as well.

Desktop composition adjustments begin at 1181px: the landing copy is inset, the question preview is slightly reduced and the login cutout is enlarged. These belong to those reference surfaces, not a universal layout rule.

## Elevation & Depth

Depth is a deliberate feature of the supplied appearance: navy tonal layering, thin blue outlines, inset highlights and soft blue shadows make controls and plates feel dimensional. Primary actions are the brightest interactive elements. Cards and form surfaces use scoped depth treatments; the login form has cyan edges, while ordinary application containers remain quieter.

The preview's perspective and the decorative ribbons are static. Button feedback uses short easing and a small pressed scale. The inherited live-game motion remains intact, and reduced-motion preferences remove transitions and animations.

## Shapes

Controls use gently rounded corners, cards use broader corners and compact status/navigation chips use pills. Icon tiles are rounded blue squares. The login form has a larger silhouette than ordinary cards. Use SVG paths for curved ribbon geometry and real SVG icons for connectors; the ribbons do not carry content or intercept interaction.

## Components

### Buttons
Primary actions use the blue gradient, pale-blue border and inset highlight defined in the sidecar. The general minimum height is 52px, with scoped compact/navigation and larger teacher-action variants. Hover brightens the surface; pressed feedback scales slightly. Disabled actions use the raised surface and subdued text without glow. Secondary actions retain a navy surface and stronger outline; destructive actions use danger text and a rose border.

### Inputs and selectors
Keep visible labels, dark fields and blue outlines. Authentication fields have leading SVG icons and a separate password-visibility button. Library search/filter/sort controls share one row on desktop, then reflow without hiding their labels from assistive technology. Focus is visible; errors and pending states remain real and readable.

### Cards and chips
Questionnaire cards preserve real titles, descriptions, question counts and actions. The create tile uses a dashed outline and a prominent plus control. Metadata chips use compact blue-tinted text and a subtle raised fill. True/false chips preserve semantic colors.

### Navigation and footer
The active navigation item is a filled blue pill with an icon. Navigation options remain role-aware. The account chip exposes the profile route. The footer keeps the NexQuiz mark before the descriptive text at every breakpoint and retains the System/Architecture links.

### Illustration and preview
Four transparent educational assets live under `apps/web/public/art`: checklist, laptop, room-code group and trophy. They are generated equivalents of the reference illustrations; each embeds its generation prompt. The live-question preview is built from HTML, with readable text and answer surfaces, rather than a page-sized bitmap. Decorative images have empty alt text; meaningful UI remains accessible HTML.

## Do's and Don'ts

### Do
- **Do** use the final dark tokens from `reference.css`, even under a light operating-system preference.
- **Do** preserve the user's supplied blue illumination, pill controls and dimensional illustration language.
- **Do** keep existing labels, real API data, focus states, loading states and role restrictions intact.
- **Do** keep blue action and emerald/rose answer meaning distinct.
- **Do** respect reduced motion and retain readable mobile reflow.

### Don't
- **Don't** restore the superseded automatic light palette or paper/green visual world.
- **Don't** turn reference-specific page compositions into rules for every new screen.
- **Don't** replace functional controls or meaningful text with flattened screenshot imagery.
- **Don't** describe generated cutouts as the original reference assets or claim numerical pixel identity without evidence.
- **Don't** add continuous decorative motion to frequently used application controls.

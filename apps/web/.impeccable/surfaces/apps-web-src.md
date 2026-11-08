---
version: 1
slug: "apps-web-src"
primary_target: "apps/web/src"
related_targets: []
---

# NexQuiz web app

Scope: every route of apps/web (dashboard, quizzes, editor, host, join, play, results, history, account, system pages). Mode: Operate.

Audience and job: teachers prepare true/false quizzes and run a room from a laptop or projector; students join from phones and answer under a countdown. Success: create → open room → share code → play → see ranking without hunting for the next step.

Constraints: user-pinned identity from a ProfeLink screenshot (NexQuiz is ProfeLink's live-activity area). Dark by default plus automatic light theme (user choice). Game moments may own their colors (user choice). Keep Playwright-visible labels where possible.

## Direction contract

THESIS: NexQuiz is a room inside ProfeLink, not a separate brand; it refuses the standalone quiz-show look and greets people with "what's next" instead of a marketing hero.

OWN-WORLD: near-black ground, navy cards without heavy chrome, one bright blue for action and names, pill badges for state, heavy Manrope headings. In play, Verdadero is emerald and Falso is rose, the only saturated fields in the product.

STORY: a signed-in visitor is greeted by name, can type a room code right there, and sees their quizzes ready to play; a host sees one big code with copy actions; a student sees a countdown and two thumb-sized answers.

FIRST VIEWPORT: dashboard: greeting with blue name at display size, "¿Qué sigue?" wide card with icon tile, inline code field and blue arrow button at right; quiz cards grid below. Signed out: headline left, live question preview card right.

FORM: user-pinned (ProfeLink reference screenshot); no seed roll, a pinned direction beats the roll. Code-led (no image generation).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

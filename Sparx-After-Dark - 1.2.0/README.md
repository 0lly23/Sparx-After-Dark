# Sparx After Dark

A Manifest V3 extension for Chrome and Edge that gives Sparx Maths a calmer, dark, rounded interface inspired by Monkeytype, plus a separate original-question practice mode.

It does not alter Sparx questions, answers, progress, timers, or any Sparx functionality. The standalone practice mode makes original questions locally in your browser; it does not use or copy Sparx content.

## Install locally

1. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this folder (the folder containing `manifest.json`).
5. Open Sparx Maths and use the extension toolbar button to personalise it. The extension supports the current `maths.sparx-learning.com` question pages as well as the older Sparx Maths domain.

## Included controls

- Enable or disable the theme.
- Accent, background, surface, and text colours.
- Corner roundness.
- Rounded, clean sans, or mono typeface.
- Compact cards, image dimming, and reduced motion.
- Optional local Answer Journal: records the question label, submitted text answer, outcome, and time only after Sparx marks it. Visual or interactive answers are recorded as a placeholder instead of being copied. Entries stay in the browser and can be cleared from the journal. It does not copy Bookwork codes or question content.
- Optional local Stuck? guide: detects broad topic words only on the current page, suggests a bundled fact sheet, and lets the learner choose a topic manually. It never sends, stores, fills, or submits question content or answers.
- Optional scientific calculator side panel. It is a local numerical tool with DEG/RAD trig, powers, roots, logs, memory, factorial, nCr/nPr, and scientific notation; it cannot read, fill, or submit Sparx answers. It stays closed until the user presses its small side button. A separate, default-off permission-required switch can make it available on questions Sparx labels calculator-not-allowed, where it gives a clear warning. The popup also includes a separate local Study calculator.
- One-click reset to the default Monkeytype-like palette.
- Standalone Practice mode with topic, calculator, and GCSE Foundation/Higher filters.

## Notes for development

Sparx changes its generated HTML classes over time, so the stylesheet intentionally targets stable semantic elements alongside partial class names. If a specific future Sparx screen needs a sharper treatment, add a narrowly scoped selector to `theme.css` rather than modifying the learning content.

---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Review the live theme and layout matrix

## Evidence

CSS and jsdom cannot verify computed contrast, wrapping, clipping, or community-theme behavior.

## Why it matters

VS-11 is the first-slice gate and Phase 12 extends it to every applicable M00–M17 state.

## Approach

Capture and inspect default light/dark, representative community themes and accents, full and
constrained leaves, 200% zoom, long names, and both locales in a live Obsidian vault.

## Acceptance criteria

- VS-01–VS-10 states pass the initial matrix.
- Every later applicable screen has a pass, defect, or explicit not-applicable record.
- Visual evidence names theme, width, zoom, locale, host version, and build.

## Risks

Screenshots alone cannot verify interaction or accessible names.

## Outcome

Rendered host integration has explicit release evidence instead of inferred CSS compliance.

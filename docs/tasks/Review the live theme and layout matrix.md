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

## Amendments

**2026-09-08** — the plan-editor stack's browser evidence is NOT this task's matrix, and the two
should not be confused. Every PR from #74 to #88 ran four browser scenarios (light, dark, custom
accent, German at 460 px) through a scripted runner, and every one of them says which browser:
installed Edge 152 for #74 to #85, a Chromium 148 named through `RP_CHROMIUM_EXECUTABLE` for #86
to #88, never the pinned build. #91 ran nine journeys × four scenarios and eighteen reference
comparisons on its own head and says final M00–M17 visual acceptance and live-host acceptance
remain open; #92 is coverage only. Criterion 3's host version and build are therefore recorded
for a browser, not a host, and criterion 1's VS states have no record against the landed
7d4bc381.

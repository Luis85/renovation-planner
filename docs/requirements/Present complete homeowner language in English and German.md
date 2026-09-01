---
type: PBI
parent: "[[Release hardening]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Multilanguage]]"
  - "[[Use the editor in Obsidian themes and constrained layouts]]"
---

# Present complete homeowner language in English and German

## Actor

An English- or German-speaking homeowner using Obsidian in their chosen language.

## Main flow

1. Every released M00–M17 state is inventoried for visible and announced strings.
2. English supplies a complete canonical value for every key.
3. German supplies reviewed homeowner language for every released journey.
4. Missing non-release locale values fall back one key at a time according to
   [[Multilanguage]].
5. Error, stale, empty, busy, disabled, and confirmation states are exercised in both languages.

## Extensions

- **3a** — A German term has no safe direct equivalent. Research records the chosen homeowner
  wording and checks comprehension rather than exposing an internal geometry term.
- **4a** — A translation or interpolation is missing. The fallback remains readable and the
  release evidence records the gap; no blank label ships.
- **5a** — Longer German copy changes layout. The constrained/theme matrix must still pass.

## Guarantee

Every released sentence is available in English and German, uses homeowner concepts, preserves
interpolation meaning, and never exposes Zone, Polygon, Vertex, Scene, or tool-internal vocabulary.

## Acceptance criteria

1. English and German cover every released visible and accessible string.
2. Missing-key and interpolation fallback tests preserve a complete readable sentence.
3. Error and stale states say what happened and the safe next action in both languages.
4. German long-copy states remain operable in constrained layouts and at 200% zoom.
5. A homeowner comprehension check covers Room, Existing, Planned, Work, stale refresh, and
   disabled-action language.

## Assumptions

- Obsidian's language remains the authority; the plugin adds no language switch.
- Currency and units remain project data, not translation choices.
- Comprehension is manual evidence and cannot be inferred from locale-table completeness.

## Sources

[[Multilanguage]]; Phase 12 and per-screen done criteria in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md);
homeowner vocabulary in
[[Renovation Planner — Editor Interaction & Mental Model Specification]].

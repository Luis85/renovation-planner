---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 50
status: Removed
started: ""
finished: 2026-08-30
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The plan editor is unusable in a sidebar leaf

Found while capturing design slice 14's finished empty states at a sidebar's width, not
introduced by that slice and not caused by it.

## The question

`styles/editor.css` gives the Layers panel a fixed `width: 12rem` (192px) and the Inspector
panel a fixed `width: 17rem` (272px, wider since slice 10's Requirements panel needed the
room). Together that is 464px before the canvas region gets anything. `PlanCanvas`'s own
`min-width: 0` (the same rule that makes it a well-behaved flex item at all) means it has no
floor: at any pane narrower than 464px, the canvas collapses to zero width and disappears —
not badly, not cropped, gone.

`npm run harness-shot component:editor/PlanEditorRoot -- --width=460` renders exactly that:
the toolbar, the Layers panel and the Inspector panel all draw correctly, and there is
nothing between them. Neither Plan Editor empty state (`noBackground`, `noZones`) is visible
either, because the overlay lives inside the very region that has vanished — an empty state
built to be actionable is exactly as unreachable as the canvas it sits over.

## What is true today

- The two panel widths were each a stated, deliberate judgement (`styles/editor.css`'s own
  comments above each rule) against the five-region shell's normal size, never checked
  against a narrow pane.
- 460px is not an arbitrary probe width — it is the width `npm run harness-shot`'s own
  `-- --width=` flag exists to test, and CLAUDE.md names it explicitly as "the width an
  Obsidian sidebar leaf actually has."
- The plugin's `manifest.json` declares `isDesktopOnly: false`. A phone or a narrow sidebar
  is not a hypothetical client of this view; it is a promised one.

## Why no gate saw it

jsdom lays nothing out — every test that mounts `PlanEditorRoot` measures markup and
reactive state, never a pixel width, so a `min-width: 0` collapsing to zero is invisible to
the whole suite regardless of coverage. The two fixed Plan Editor captures
(`npm run harness-shot`'s `plan-editor-{light,dark}.png`) render at the harness's default
1280px, which is wider than 464px by a wide margin, so neither fixed capture has ever been
narrow enough to show this. The only instrument that can see it is a screenshot taken at a
narrow width, and nothing runs one as part of `npm run check` — `harness-shot` is
deliberately outside it, for the same reason the harness itself is: it draws and asserts
nothing, there is no baseline to diff against, and it is not CI.

## Why it matters

- **This is more than cosmetic given the manifest's own promise.** `isDesktopOnly: false`
  says a phone user can open this plugin; a sidebar-width failure in the desktop app is the
  same defect at a size Obsidian's desktop UI reaches routinely (a docked sidebar, a split
  pane), not only on mobile.
- Design slice 14 built two overlays specifically so a user with nothing to look at is told
  what to do next. Both are unreachable at exactly the width where a user most needs
  guidance — a narrow pane is itself a "getting started in a small space" moment, not a
  power-user configuration.
- It generalises past this one pane: any consumer of the five-region shell at a width under
  ~464px inherits the same collapse, and the shell has no reported minimum width anywhere a
  gate or a type could enforce one.

## What closes it

Not designed here — this note exists so the finding is not lost, per this repository's own
rule that a category invariant needs an instrument that can see it before it can be fixed
with any confidence. Candidates worth weighing when it is picked up: a minimum pane width
below which the shell degrades on purpose (stacking panels, or hiding one), collapsible
Layers/Inspector panels reclaiming their width on demand, or a documented minimum supported
pane width enforced by nothing but stated plainly. Whichever is chosen, `npm run harness-shot
component:editor/PlanEditorRoot -- --width=460` is the reproduction and the eventual
regression check — no other instrument here can drive it.

## References

- `styles/editor.css` — `.rp-editor-layers, .rp-editor-inspector` (`width: 12rem`) and
  `.rp-editor-inspector` (`width: 17rem`), and the canvas's `min-width: 0`.
- `manifest.json` — `isDesktopOnly: false`.
- CLAUDE.md — `npm run harness-shot`'s `-- --width=460` flag, named as the width an Obsidian
  sidebar leaf actually has; and the harness/harness-shot section's account of what each
  instrument can and cannot see.
- [[Plan editor and canvas]] — slice 5, which built the five-region shell this panel sizing
  belongs to.

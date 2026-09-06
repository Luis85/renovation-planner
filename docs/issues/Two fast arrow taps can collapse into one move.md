---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 90
status: New
started: ""
finished: ""
horizon: Now
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

# Two fast arrow taps can collapse into one move

`createNudgeSelectionAction` (`src/presentation/editor/runtime.ts:406`) reads
`deps.projectStore.zones.get(String(zoneId))` synchronously at the moment the arrow key
handler calls it, computes `translate(inverse, by)` from that snapshot, and dispatches the
move. The `!event.repeat` filter in `EditorSurface.vue`'s keyboard handler exists to stop OS
autorepeat from reading the same pre-move zone dozens of times — it says nothing about two
genuinely separate key-down events fired close enough together that the store has not yet
refreshed between them. `projectStore.zones` is only refreshed by a queued hydrate
(`runtime.ts`'s reindex path), not synchronously after a dispatched command resolves, so a
second real tap that lands before that hydrate settles reads the SAME pre-move geometry as the
first, translates from the same origin, and the two dispatched moves do not compose — the
second overwrites rather than adds to the first.

## What is true today

Nothing in `createNudgeSelectionAction` or its caller waits for the store to reflect the first
move before a second call can read `deps.projectStore.zones` again. `!event.repeat` only
distinguishes held-key autorepeat from a fresh key-down; it does not order two fresh key-downs
against the store's own refresh.

## What closes it

Observing the race needs a query fake that actually re-reads the repository between two
dispatches, rather than today's `fakeQueries` shape returning a captured array (a fixed
snapshot cannot show two reads producing different answers). Once observable, the fix is
either to derive the translate origin from the LAST dispatched command's outcome rather than
from the store, or to serialize nudges the way `InspectorStore`'s ticket already serializes its
own reads — the runtime's existing `singleFlight` helper is the house shape for this.

## References

- [[Plan editor and canvas]]
- `src/presentation/editor/runtime.ts` — `createNudgeSelectionAction`'s synchronous store read.
- Item 6, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/issues-brief.md` — the T14
  keyboard-nudge follow-up this note answers.

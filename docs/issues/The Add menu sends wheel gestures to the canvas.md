---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 20
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: high
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The Add menu sends wheel gestures to the canvas

## The question

The canvas overlay stops `pointerdown`, `pointerup` and `pointercancel`, but not `wheel`
(`src/presentation/editor/surface/EditorSurface.vue:1238-1245`). The Add menu is deliberately
scrollable (`styles/editor-shell.css:180-195`), so a wheel gesture over its overflowing content
bubbles to the canvas's `@wheel` handler at
`src/presentation/editor/surface/EditorSurface.vue:1185-1194`.

`onWheel` prevents the browser default and pans or zooms the viewport
(`src/presentation/editor/surface/EditorSurface.vue:358-402`). The menu therefore cannot consume
the gesture as its own scroll. Design spec §7.2 describes an anchored, independently operable
menu; sending its scrolling gesture into the plan camera violates that boundary.

## What is true today

- The overlay's three stopped event names are explicit at
  `src/presentation/editor/surface/EditorSurface.vue:1240-1242`; `wheel` is absent.
- The menu's `max-height` and `overflow-y: auto` at `styles/editor-shell.css:189-195` make wheel
  scrolling an ordinary path, not a hypothetical one.
- A search of `tests/presentation/editor/add/addMenu.test.ts` finds no `WheelEvent` and no wheel
  assertion. The pointer and keyboard cases cannot distinguish a scrolling menu from a viewport
  movement underneath it.

## Why it matters

Opening Add over a short pane makes the menu scrollable. Trying to reach a lower choice instead
moves or zooms the renovation plan and suppresses the menu's native scroll, changing spatial
context during a navigation gesture that should be confined to the menu.

## What closes it

Stop wheel propagation at the overlay or Add-menu boundary while leaving the event's default
scroll behavior available to the menu. Add a mounted-tree test that dispatches a cancelable
wheel event over the overflowing menu and requires an unchanged viewport and
`defaultPrevented === false`; removing the wheel stop must make that test fail.

## What closed it

**2026-09-04.** `@wheel.stop` added to `.rp-plan-overlay` beside its three existing pointer
stops, at the bubble phase so `defaultPrevented` stays `false` and the menu's own overflow can
still scroll. Holding test: `addMenu.test.ts` › 'a wheel over the menu scrolls the menu, never
the plan' — mutation-checked by removing `@wheel.stop` and observing red at
`wheel.defaultPrevented`. Commit "fix(add-menu): close before activate, root-owned Escape, focus
boundary, wheel and unmount retirement — with tests that count".

## References

- `src/presentation/editor/surface/EditorSurface.vue:358-402,1185-1194,1238-1245`
- `styles/editor-shell.css:180-195`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 1.

# Konva and Obsidian Performance Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three concrete gaps a research-and-measurement pass found between the Plan editor and current Konva / Obsidian guidance (pop-out window listeners, device-pixel-ratio changes, a missing large-plan instrument), and record what was measured as already right so nobody re-audits it.

**Architecture:** No new layer, store or dependency. One harness knob (`?rooms=N`) makes a large plan capturable and measurable; one composable re-targets the four main-window listeners at the element's own window/document; one watcher inside `PlanCanvas.vue` tells Konva when the device pixel ratio changes. Everything else in this document is a finding with a number beside it and a decision, so the next reader starts from the measurement rather than from the Konva docs again.

**Tech Stack:** Konva 10.3.2, vue-konva 3.4, Vue 3.5, Pinia, Obsidian API 1.13.0, Vitest + jsdom (`tests/helpers/canvas.ts` puts a real rasteriser behind jsdom), the Vite browser harness (`npm run harness`).

**Spec:** none. This plan carries its own research and measurements in §1 and §2 below; the tasks in §3 argue from them.

## Global Constraints

- `npm run check` is the definition of done and runs in CI on the pull request; run `npm run check:fast -- <paths>` between edits (CLAUDE.md, Definition of done).
- Every user-visible string goes through `tr(...)` with an `en` AND a `de` entry. No task here adds one.
- Nothing outside `infrastructure/` writes to the vault; `presentation/` may not import `obsidian`. No task here touches persistence.
- A view type and a command id are DATA, not text. No task here renames one.
- A fake must not be kinder, thinner, harsher or faster than the real thing. Task 2's pop-out test therefore uses a real second `document` (an iframe's), not a stub.
- `tests/**` is type-checked by `npm run build`; `Platform` and `getLanguage` resets are per file.
- `docs/tests/cases/*.md` is the home of a manual case; each carries a Runs table and an unrun case says so.

---

## §1 What the research says (2026-09-13, official sources only)

Konva (https://konvajs.org/docs/performance/All_Performance_Tips.html and the pages it links):

1. Konva 8+ redraws a dirty layer once per animation frame on its own; `batchDraw()` is only for changes Konva cannot see.
2. "Do not create too many layers. Usually 3-5 is max." Each layer is one full-size scene canvas (plus a hit canvas, which Konva 10 sizes to 0×0 when the layer is `listening: false` — `node_modules/konva/lib/Layer.js`, `setSize`).
3. `listening: false` on non-interactive nodes and layers removes them from the hit graph.
4. `perfectDrawEnabled: false` avoids the buffer canvas a fill+stroke+opacity shape otherwise draws through; `shadowForStrokeEnabled: false` avoids a second pass on stroked shapes with shadows.
5. `Konva.pixelRatio` is `window.devicePixelRatio || 1`, read ONCE at module load (`node_modules/konva/lib/Global.js`, the `pixelRatio` field; `Canvas.js`'s constructor takes it before ever reaching `getDevicePixelRatio`), so a window moved to a monitor with a different ratio keeps drawing at the old one.
6. Memory leaks: `destroy()` nodes and stages on teardown; Konva assigns `window.Konva` at module scope.
7. vue-konva applies only changed `config` keys (non-strict mode), deep-watches every node's `config`, and on a Layer's or Group's `onUpdated` walks its vnode subtree to re-derive z-order. Template order is z-order; keys must be stable ids.

Obsidian (https://docs.obsidian.md/plugins/guides/load-time, https://docs.obsidian.md/plugins/guides/defer-views, https://docs.obsidian.md/Reference/TypeScript+API/Component, https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines):

8. `onload` registers and nothing more; vault scans go in `workspace.onLayoutReady`.
9. Since 1.7.2 a leaf's view is a `DeferredView` until shown; guard `leaf.view` reads with `instanceof`, match leaves by `getViewState()`, and let `revealLeaf` load it. Never hold view references in the plugin.
10. `registerEvent` / `registerDomEvent` / `registerInterval` for auto-cleanup; `onClose` releases what `onOpen` built.
11. Pop-out windows (0.15+): a leaf can live in a document other than the plugin's `document`. Listeners on `window`/`document` from the main window do not hear events in a pop-out; use the element's `ownerDocument` and its `defaultView`. `useDimensionObstacles.ts` already does this for `requestAnimationFrame`.
12. MDN: react to a DPR change through `matchMedia('(resolution: Ndppx)')` `change`, re-armed after each change because the query is for one value.

## §2 What the code measured, in the harness (`?view=plan-editor`, 1600×1000, DPR 1, two-room fixture)

Probe: `window.Konva.stages[0]`, `Konva.Layer.prototype.drawScene` wrapped to count draws, 40 synthetic wheel events dispatched on `.rp-plan-canvas`, Vue's microtask flush timed before the next two frames.

| Fact | Measured |
|---|---|
| Konva layers mounted | 7, all `listening: false`, stage `listening: true` |
| Scene canvas per layer | 992×912 → 3.6 MB each, 25.2 MB total at DPR 1 (×4 at DPR 2) |
| Hit canvas per layer | 0 MB (Konva 10 sizes it to zero for a non-listening layer) |
| Layers with no shape in this fixture | `background`, `construction`, `asset`, `annotation` |
| Pan (one wheel notch): Vue work / layer draws | 3.4 ms / 7 of 7 layers |
| Zoom (one wheel notch): Vue work / layer draws | 6.9 ms / 7 of 7 layers |
| Hover (pointermove): Vue work / layer draws | 0.8 ms / 0 |
| `Konva.autoDrawEnabled` / `hitOnDragEnabled` | true / false (defaults, correct) |

Already right, verified by reading, so no task exists for it:

- Every layer, group and shape the editor draws sets `listening: false`; the two shapes in `StructureLayer.vue` that omit it (`wall-edge`, `wall-body`) sit under a non-listening layer, which Konva resolves by ancestor walk.
- `perfectDrawEnabled: false` on every fill+stroke shape that also carries opacity (zone fill, captions); the wall passes are stroke-only and never reach the buffer canvas. No shadow anywhere.
- `strokeScaleEnabled: false` on every screen-sized outline; captions counter-scale by `1 / zoom`.
- `onload` registers only; the index scan starts in `onLayoutReady`; the three vault listeners are `registerEvent`ed inside it.
- Deferred views: `rebindOpenViews` guards every `leaf.view` with `instanceof`, `revealPlanEditor.ts` matches leaves by `getViewState().state.planId`, and `revealCandidate` goes through `revealLeaf`. A deferred Plan editor is constructed later by the factory, which reads deps at that moment.
- `PlanEditorView.onClose` unmounts the Vue app, which destroys the stage (`scene.test.ts`, "leaves no Konva stage, theme listener or resize observer behind on unmount"); `window.Konva` is released by `konvaGlobal.ts`.
- Chromium already coalesces `wheel` and `pointermove` to one per frame, so a rAF throttle in `EditorSurface.vue` would buy nothing.
- `touch-action: none` on `.rp-plan-canvas`; the stage is sized from a `ResizeObserver` on the container, which is more exact than `ItemView.onResize`.

## §3 Tasks

### Task 1: `?rooms=N` harness knob, and the manual canvas-performance case

The only plan the harness can draw has two rooms, and `planningPerformance.test.ts` measures the projection, not the canvas. Konva's levers (layer caching, transform-by-node) are worth taking only if a large plan misses SDD §62's budget (pan/zoom 60 fps, 30 minimum), and nothing today can produce a large plan outside a vault.

**Files:**
- Create: `tests/harness/roomsKnob.ts`
- Create: `tests/harness/roomsKnob.test.ts`
- Modify: `tests/harness/page.ts` (the Plan editor knob block, beside `lockedZoneIds`)
- Modify: `tests/harness/planEditor.ts` (`mountPlanEditorHarness` options, beside `locked`)
- Create: `docs/tests/cases/Canvas performance.md`

**Interfaces:**
- Produces: `roomsDeps(base: PlanEditorDeps, count: number): PlanEditorDeps` — wraps `queries.findZonesByPlan` and appends `count` rectangular `ZoneDto`s on a grid after the seeded zones. Ids are `harness-room-<n>`, names `Room <n>`.
- Produces: `mountPlanEditorHarness(host, { rooms?: number })`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @vitest-environment jsdom
 *
 * `?rooms=N` (2026-09-13 performance pass): a plan with N synthetic rooms after the seeded ones,
 * so a capture or a probe can look at the canvas at the size SDD §62 budgets for.
 */
import { beforeEach, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

it('?rooms=40 draws forty rooms after the seeded ones, each with its own id', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl } = mountPlanEditorHarness(document.body, { rooms: 40 });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelectorAll('.rp-floor-inspector .rp-room-list__row').length >= 40, 'forty rooms');
	const ids = [...leafEl.querySelectorAll<HTMLElement>('.rp-floor-inspector .rp-room-list__row')].map(row => row.dataset['rpId']);
	expect(ids.filter(id => id?.startsWith('harness-room-'))).toHaveLength(40);
	expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run check:fast -- tests/harness/roomsKnob.test.ts`
Expected: a type error on `rooms` (not an option of `mountPlanEditorHarness`) — the build half of `check:fast` refuses first.

- [ ] **Step 3: Write `roomsDeps`**

```ts
// tests/harness/roomsKnob.ts
/**
 * `?rooms=N`: N synthetic 4000×3000 mm rooms on a grid to the right of the seeded flat, so the
 * harness can draw a plan of the size SDD §62 budgets for. Appended AFTER the seeded zones so
 * every other knob (`?select`, `?locked`, `?detailed`) still finds the ids it names.
 */
import { ok } from '../../src/core/result/Result';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import type { ZoneDto } from '../../src/application/read-models/ZoneDto';

const WIDTH = 4000, DEPTH = 3000, GAP = 500, COLUMNS = 10, ORIGIN_X = 12_000;

export function syntheticRooms(count: number, planId: string): ZoneDto[] {
	return Array.from({ length: count }, (_, index) => {
		const x = ORIGIN_X + (index % COLUMNS) * (WIDTH + GAP), y = Math.floor(index / COLUMNS) * (DEPTH + GAP);
		return { id: `harness-room-${index + 1}`, planId, name: `Room ${index + 1}`, zoneType: 'Room', status: 'Planned',
			points: [{ x, y }, { x: x + WIDTH, y }, { x: x + WIDTH, y: y + DEPTH }, { x, y: y + DEPTH }] };
	});
}

export function roomsDeps(base: PlanEditorDeps, count: number): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: async (planId) => {
				const found = await base.queries.findZonesByPlan(planId);
				return found.ok ? ok({ ...found.value, zones: [...found.value.zones, ...syntheticRooms(count, planId)] }) : found;
			},
		},
	};
}
```

Check the exact import paths for `ok`, `PlanEditorDeps` and `ZoneDto` against `tests/harness/detailPlanKnob.ts`, which imports the same three; copy its spellings.

- [ ] **Step 4: Thread the option**

In `tests/harness/planEditor.ts`, add to the options interface beside `locked`:

```ts
	/** How many synthetic rooms `roomsKnob.ts` appends after the seeded zones (`?rooms=N`). */
	readonly rooms?: number;
```

and in the deps chain beside the `locked`/`detailed` lines:

```ts
	const withRooms = options.rooms === undefined ? detailedZones : roomsDeps(detailedZones, options.rooms);
```

then use `withRooms` where `detailedZones` was used next. Import `roomsDeps` from `./roomsKnob`.

In `tests/harness/page.ts`, beside `const lockedZoneIds`:

```ts
/** `?rooms=N` (2026-09-13): clamped like `?projects=`, for the same reason its paragraph gives. */
const askedRooms = Math.max(0, Number.parseInt(params.get('rooms') ?? '', 10));
```

and in the `mountPlanEditorHarness` call: `rooms: Number.isFinite(askedRooms) ? askedRooms : undefined,`. Update the knob docblock's count ("nine knobs" → "ten knobs") and add one sentence naming `?rooms=`.

- [ ] **Step 5: Run the test and the harness pins**

Run: `npm run check:fast -- tests/harness/roomsKnob.test.ts tests/harness/harness.test.ts tests/harness/knobRejectionIsolation.test.ts tests/build/harness-shot.test.ts`
Expected: PASS. If `knobRejectionIsolation.test.ts` enumerates knobs, add `rooms` where it lists them.

- [ ] **Step 6: Write the manual case**

`docs/tests/cases/Canvas performance.md`, in the shape of `docs/tests/cases/Canvas Navigation.md` (copy its frontmatter and Runs table):

```markdown
# Canvas performance

Preconditions: `npm run harness`, open `http://localhost:5173/?view=plan-editor&rooms=80` in a
pane at least 1200 px wide. Budget: SDD §62 — pan/zoom at 60 fps, 30 minimum.

1. Paste in the console, read `pan.vueMs`, `zoom.vueMs`, and the draw counts:

    ```js
    const K = window.Konva, stage = K.stages[0], el = document.querySelector('.rp-plan-canvas'), r = el.getBoundingClientRect();
    const counts = {}, proto = K.Layer.prototype, orig = proto.drawScene;
    proto.drawScene = function (...a) { counts[this.name()] = (counts[this.name()] ?? 0) + 1; return orig.apply(this, a); };
    const raf = () => new Promise(res => requestAnimationFrame(() => res()));
    const micro = async () => { for (let i = 0; i < 5; i++) await null; };
    async function run(make, n = 40) { const vue = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); el.dispatchEvent(make()); await micro(); vue.push(performance.now() - t0); await raf(); await raf(); } return { vueMs: vue.sort((a, b) => a - b)[n >> 1] }; }
    const at = { clientX: r.left + 400, clientY: r.top + 400, bubbles: true, cancelable: true, deltaMode: 0 };
    const pan = await run(() => new WheelEvent('wheel', { ...at, deltaX: 40, deltaY: 0 })), panDraws = { ...counts };
    for (const k in counts) delete counts[k];
    let z = 1; const zoom = await run(() => new WheelEvent('wheel', { ...at, deltaX: 0, deltaY: (z = -z) * 60 })), zoomDraws = { ...counts };
    proto.drawScene = orig;
    console.table({ pan, zoom }); console.table({ panDraws, zoomDraws });
    ```

2. Record `pan.vueMs` and `zoom.vueMs` at `rooms=0`, `rooms=40`, `rooms=80`. A reading over 8 ms
   leaves less than half a frame for Konva's own draw and is the trigger for §4's levers.
3. Middle-button drag for two seconds and watch the Performance panel's frame chart: no frame
   over 33 ms is the floor SDD §62 names.

## Runs

| Date | Build | rooms=0 | rooms=40 | rooms=80 | Result |
|---|---|---|---|---|---|
| 2026-09-13 | 31fb0c3f, harness, DPR 1 | pan 3.4 ms, zoom 6.9 ms | not run | not run | 2-room fixture only; the knob did not exist |
```

- [ ] **Step 7: Run the case once and fill in the row**

Run `npm run harness`, open the URL with `rooms=40` and `rooms=80`, run the snippet, record the numbers in the Runs table. Then decide §4 against them and write the decision in the table's Result column.

- [ ] **Step 8: Commit**

```bash
git add tests/harness/roomsKnob.ts tests/harness/roomsKnob.test.ts tests/harness/page.ts tests/harness/planEditor.ts "docs/tests/cases/Canvas performance.md"
git commit -m "Add the ?rooms=N harness knob and the manual canvas-performance case"
```

### Task 2: Listen on the element's own window and document, for pop-out leaves

Four listeners are registered on the plugin's main `window`/`document`. In an Obsidian pop-out window the leaf's element belongs to another document, so today: the Add menu, the View menu and the Property tree menu do not close on an outside press in a pop-out; and a space-pan armed in a pop-out stays armed after that window loses focus (the defect `onBlur`'s docblock exists to prevent, back through a door it did not name). `CanvasContextMenu.vue` and `useDimensionObstacles.ts` already resolve through the element.

**Files:**
- Create: `src/presentation/composables/use-owner-listener.ts`
- Create: `tests/presentation/composables/useOwnerListener.test.ts`
- Modify: `src/presentation/editor/add/AddMenu.vue:357-361`
- Modify: `src/presentation/editor/shell/EditorViewMenu.vue:36-37`
- Modify: `src/presentation/editor/shell/PropertyTreeMenu.vue:57-65`
- Modify: `src/presentation/editor/surface/EditorSurface.vue:1234,1278`
- Create: `tests/presentation/editor/shell/editorViewMenuPopOut.test.ts` (no test drives `EditorViewMenu` or `PropertyTreeMenu` today — measured with `grep -rl EditorViewMenu tests`, empty)

Check `src/presentation/composables/` exists with the same name-per-file convention before creating; if the directory holds `use*.ts` files, match them.

**Interfaces:**
- Produces:

```ts
/**
 * Adds `listener` to the DOCUMENT or WINDOW that owns `element`, and answers the function
 * that removes it. `document` and `window` are the main window's in an Obsidian pop-out leaf,
 * where the element lives in another document entirely — so a listener added there never
 * hears the pop-out. `CanvasContextMenu.vue` and `useDimensionObstacles.ts` already resolve
 * through the element; this is that rule as one function so a fifth caller cannot forget it.
 */
export function ownerDocumentOf(element: Element): Document;
export function ownerWindowOf(element: Element): Window;
export function listenOnOwner(element: Element, target: 'document' | 'window', type: string, listener: EventListener, options?: AddEventListenerOptions): () => void;
```

- [ ] **Step 1: Write the failing composable test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { listenOnOwner, ownerWindowOf } from '../../../src/presentation/composables/use-owner-listener';

/** A REAL second document, the way a pop-out leaf has one: an iframe's. */
function popOut(): { element: HTMLElement; doc: Document; win: Window } {
	const frame = document.createElement('iframe');
	document.body.append(frame);
	const doc = frame.contentDocument!, win = frame.contentWindow!;
	const element = doc.createElement('div');
	doc.body.append(element);
	return { element, doc, win };
}

describe('listenOnOwner', () => {
	it('hears a press in the document that owns the element, not in the main one', () => {
		const { element, doc } = popOut();
		let heard = 0;
		const stop = listenOnOwner(element, 'document', 'pointerdown', () => { heard += 1; }, { capture: true });
		document.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(0);
		doc.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(1);
		stop();
		doc.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(1);
	});

	it('hears a blur on the window that owns the element', () => {
		const { element, win } = popOut();
		let heard = 0;
		listenOnOwner(element, 'window', 'blur', () => { heard += 1; });
		window.dispatchEvent(new Event('blur'));
		expect(heard).toBe(0);
		win.dispatchEvent(new Event('blur'));
		expect(heard).toBe(1);
		expect(ownerWindowOf(element)).toBe(win);
	});
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm run check:fast -- tests/presentation/composables/useOwnerListener.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the composable**

```ts
export function ownerDocumentOf(element: Element): Document {
	return element.ownerDocument;
}

export function ownerWindowOf(element: Element): Window {
	// `defaultView` is `null` only for a document no window shows, which no mounted element has.
	const view = element.ownerDocument.defaultView;
	if (view === null) throw new Error('element belongs to a document no window shows');
	return view;
}

export function listenOnOwner(element: Element, target: 'document' | 'window', type: string, listener: EventListener, options?: AddEventListenerOptions): () => void {
	const host: EventTarget = target === 'document' ? ownerDocumentOf(element) : ownerWindowOf(element);
	host.addEventListener(type, listener, options);
	return () => host.removeEventListener(type, listener, options);
}
```

The `throw` is a programmer-error door (SDD §65's shape), not a guard: every caller runs from `onMounted` on a rendered element. If coverage reports the arm unreachable, drive it with a `document.implementation.createHTMLDocument()` element in the test rather than removing the check.

- [ ] **Step 4: Run to see it pass, then re-point the four call sites**

`EditorViewMenu.vue` (the pattern for the other two menus):

```ts
let stopOutside: (() => void) | null = null;
onMounted(() => { if (disclosure.value) stopOutside = listenOnOwner(disclosure.value, 'document', 'pointerdown', outside, { capture: true }); });
onBeforeUnmount(() => { stopOutside?.(); stopOutside = null; });
```

`AddMenu.vue:357-361` and `PropertyTreeMenu.vue:57-65`: same substitution on whichever element ref the component already holds (read each file's `ref` for its root or `<details>`); keep the existing capture flag.

`EditorSurface.vue`: replace `window.addEventListener('blur', onBlur)` at 1234 with `stopBlur = listenOnOwner(container.value!, 'window', 'blur', onBlur)` — inside the existing `onMounted`, after the `container.value === null` early return, so the element is known to exist — and replace the `removeEventListener` at 1278 with `stopBlur?.()`. Extend the paragraph above it: the listener is on the element's OWN window because a pop-out leaf has one of its own.

- [ ] **Step 5: Add one pop-out case to an existing menu test**

In the new `tests/presentation/editor/shell/editorViewMenuPopOut.test.ts` (`// @vitest-environment jsdom`, `mount` from `@vue/test-utils`, a Pinia if the component reads a store — read its `<script setup>` first), add:

```ts
it('closes on an outside press in the document that owns it, as a pop-out leaf has', async () => {
	const frame = document.createElement('iframe');
	document.body.append(frame);
	const doc = frame.contentDocument!;
	const host = doc.createElement('div');
	doc.body.append(host);
	const wrapper = mount(EditorViewMenu, { attachTo: host, /* the same props the sibling cases pass */ });
	await wrapper.find('summary').trigger('click');
	expect((wrapper.find('details').element as HTMLDetailsElement).open).toBe(true);
	doc.dispatchEvent(new Event('pointerdown'));
	expect((wrapper.find('details').element as HTMLDetailsElement).open).toBe(false);
	wrapper.unmount();
});
```

Watch it fail against the OLD `document.addEventListener` first (revert the component, run, see red, restore) — the rule for an invariant a comment states.

- [ ] **Step 6: Run the touched directories**

Run: `npm run check:fast -- tests/presentation/composables tests/presentation/editor/shell tests/presentation/editor/add tests/presentation/editor/canvasNavigation.test.ts tests/presentation/editor/scene.test.ts`
Expected: PASS, including "leaves no Konva stage, theme listener or resize observer behind on unmount".

- [ ] **Step 7: Commit**

```bash
git add src/presentation/composables/use-owner-listener.ts tests/presentation/composables/useOwnerListener.test.ts src/presentation/editor/add/AddMenu.vue src/presentation/editor/shell/EditorViewMenu.vue src/presentation/editor/shell/PropertyTreeMenu.vue src/presentation/editor/surface/EditorSurface.vue tests/presentation/editor/shell
git commit -m "Listen on the element's own window and document so pop-out leaves hear their menus and blur"
```

### Task 3: Follow the device pixel ratio when the window moves between monitors

Konva reads `devicePixelRatio` once per module and caches it (§1.5), and each layer canvas keeps the ratio it was created with. Obsidian on a laptop docked to an external monitor is the ordinary case: load at 2×, drag to a 1× monitor, and every layer keeps a 4× backing store and downsamples; load at 1×, drag to 2×, and every line is blurry until the plugin reloads. Konva exposes `canvas.setPixelRatio(ratio)`, which resizes the backing store; this task calls it on a `(resolution)` media-query change on the element's own window (§1.12), re-armed per value.

**Files:**
- Create: `src/presentation/editor/scene/use-pixel-ratio.ts`
- Create: `tests/presentation/editor/scene/usePixelRatio.test.ts`
- Modify: `src/presentation/editor/PlanCanvas.vue` (a `ref` on `<VStage>`, one call in `<script setup>`)
- Modify: `src/presentation/designer/DesignerCanvas.vue` (the second stage; same one call — read its `<VStage>` first)

**Interfaces:**
- Produces:

```ts
/**
 * Keeps every layer of `stage()` drawing at the pixel ratio of the monitor the window is on.
 * Konva samples `devicePixelRatio` once per module and never again (Global.js,
 * `Konva.pixelRatio`), so without this a window dragged between a 2× and a 1× monitor draws
 * blurry or four times too large until the plugin reloads. Arms `matchMedia('(resolution:
 * <dpr>dppx)')` on the element's own window — a pop-out has one — and re-arms after each change,
 * since the query is for one value. Returns the disposer; call it on unmount.
 */
export function followPixelRatio(element: Element, stage: () => Konva.Stage | null): () => void;
```

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import Konva from 'konva';
import { installCanvas } from '../../../helpers/canvas';
import { followPixelRatio } from '../../../../src/presentation/editor/scene/use-pixel-ratio';

/** jsdom has no `matchMedia`; this one records the query and lets a test fire its `change`. */
function fakeMatchMedia(win: Window): { fire: () => void; queries: string[] } {
	const listeners: Array<() => void> = [], queries: string[] = [];
	Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => {
		queries.push(query);
		return { matches: true, media: query, addEventListener: (_: string, cb: () => void) => listeners.push(cb), removeEventListener: (_: string, cb: () => void) => listeners.splice(listeners.indexOf(cb), 1) };
	} });
	return { fire: () => [...listeners].forEach(cb => cb()), queries };
}

describe('followPixelRatio', () => {
	afterEach(() => { Konva.stages.forEach(stage => stage.destroy()); });

	it('resizes every layer backing store to the new ratio and re-arms for the new value', () => {
		installCanvas();
		const host = document.createElement('div'); document.body.append(host);
		const stage = new Konva.Stage({ container: host, width: 100, height: 50 });
		stage.add(new Konva.Layer(), new Konva.Layer());
		const media = fakeMatchMedia(window);
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
		const stop = followPixelRatio(host, () => stage);
		expect(media.queries).toEqual(['(resolution: 1dppx)']);
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
		media.fire();
		for (const layer of stage.getLayers()) {
			expect(layer.getCanvas().getPixelRatio()).toBe(2);
			expect(layer.getCanvas()._canvas.width).toBe(200);
		}
		expect(media.queries.at(-1)).toBe('(resolution: 2dppx)');
		stop();
		media.fire();
		expect(media.queries).toHaveLength(2);
	});

	it('does nothing when the ratio reported did not change', () => {
		installCanvas();
		const host = document.createElement('div'); document.body.append(host);
		const stage = new Konva.Stage({ container: host, width: 100, height: 50 });
		stage.add(new Konva.Layer());
		const media = fakeMatchMedia(window);
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
		const draw = vi.spyOn(stage.getLayers()[0], 'batchDraw');
		followPixelRatio(host, () => stage);
		media.fire();
		expect(draw).not.toHaveBeenCalled();
	});
});
```

If `layer.getCanvas()._canvas` is not typed, read it through `layer.getCanvas().getNativeCanvasElement?.()` or cast once with a comment naming why (`tests/helpers/canvas.ts` may already expose the element). Konva stages destroyed in `afterEach` because `Konva.stages` is module-level state — the `--no-isolate` refusal in CLAUDE.md is about exactly this registry.

- [ ] **Step 2: Run to see it fail**

Run: `npm run check:fast -- tests/presentation/editor/scene/usePixelRatio.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the follower**

```ts
import type Konva from 'konva';
import { ownerWindowOf } from '../../composables/use-owner-listener';

export function followPixelRatio(element: Element, stage: () => Konva.Stage | null): () => void {
	const win = ownerWindowOf(element);
	let query: MediaQueryList | null = null;
	let current = win.devicePixelRatio;
	const arm = (): void => {
		query?.removeEventListener('change', onChange);
		query = win.matchMedia(`(resolution: ${current}dppx)`);
		query.addEventListener('change', onChange);
	};
	function onChange(): void {
		const next = win.devicePixelRatio;
		if (next !== current) {
			current = next;
			for (const layer of stage()?.getLayers() ?? []) {
				layer.getCanvas().setPixelRatio(next);
				layer.batchDraw();
			}
		}
		arm();
	}
	arm();
	return () => { query?.removeEventListener('change', onChange); query = null; };
}
```

`ownerWindowOf` comes from Task 2; if Task 3 runs first, inline `element.ownerDocument.defaultView` with the same null check and swap it when Task 2 lands.

- [ ] **Step 4: Mount it in both canvases**

`PlanCanvas.vue`: add `const stageRef = ref<{ getStage(): Konva.Stage } | null>(null);`, put `ref="stageRef"` on `<VStage>`, and

```ts
let stopPixelRatio: (() => void) | null = null;
onMounted(() => { const node = stageRef.value?.getStage(); if (node) stopPixelRatio = followPixelRatio(node.container(), () => stageRef.value?.getStage() ?? null); });
onBeforeUnmount(() => { stopPixelRatio?.(); stopPixelRatio = null; });
```

vue-konva's `VStage` exposes `getStage()` (`node_modules/vue-konva/dist/vue-konva.mjs`, the `Stage` component's `expose`). `konva` may be imported here as a TYPE only: `presentation/` is allowed `konva`, and `import type` leaves no runtime edge (CLAUDE.md, the `isolatedModules` note). `DesignerCanvas.vue`: the same three lines on its own `<VStage>`.

- [ ] **Step 5: Run the scene and designer suites**

Run: `npm run check:fast -- tests/presentation/editor/scene tests/presentation/editor/scene.test.ts tests/presentation/designer`
Expected: PASS; "leaves no Konva stage, theme listener or resize observer behind on unmount" still green, since the disposer runs before the stage is destroyed.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/scene/use-pixel-ratio.ts tests/presentation/editor/scene/usePixelRatio.test.ts src/presentation/editor/PlanCanvas.vue src/presentation/designer/DesignerCanvas.vue
git commit -m "Follow the device pixel ratio when the window moves between monitors"
```

### Task 4: Record the pass

**Files:**
- Modify: `docs/development/agent-guide-increment-history.md` (append a section, "Konva and Obsidian performance polish, 2026-09-13")
- Modify: `docs/tests/cases/Canvas performance.md` (Runs table row from Task 1 step 7)

- [ ] **Step 1: Write the history section** — §2's table, the four "already right" verifications, Task 2 and 3's defects in one sentence each, and §4's levers with the measurement that decided each. Twenty lines, not two hundred.

- [ ] **Step 2: Open the pull request** — `npm run check` runs there. Body: the §2 table and the one-line outcome of the `rooms=80` run.

```bash
git add docs/development/agent-guide-increment-history.md "docs/tests/cases/Canvas performance.md"
git commit -m "Record the 2026-09-13 performance pass"
```

## §4 Levers held back until Task 1's numbers ask for them

Each is a real Konva lever with a real cost; none is taken on a two-room measurement of 3.4 ms. Take them in this order, one at a time, re-running the manual case after each.

1. **Skip the re-render of a layer whose only change is the camera.** Today `...props.transform` sits in every layer's `config`, so a pan re-renders all seven `VLayer` components and vue-konva walks each one's vnode subtree to re-derive z-order (§1.7) — the 3.4 ms is mostly that walk, and it grows with rooms. The lever is to set `x`/`y`/`scaleX`/`scaleY` on the Konva layer NODE from one `watch(transform)` in `PlanCanvas.vue` (through each `VLayer`'s `getNode()`) and drop them from the configs. vue-konva's non-strict mode keeps a node property it did not set. `scene.test.ts`'s "moves the layers themselves when the camera moves" and "binds the viewport transform to every world-space layer" then read the NODE rather than the config. Trigger: `pan.vueMs` over 8 ms at `rooms=80`.
2. **Do not rebuild every room's render model on a one-room preview.** `ZoneLayer.vue`'s `models` maps all zones and `enclosed` runs `enclosedByBoundary` for all of them whenever `props.preview` or `labelPreview` changes — once per pointer move during a room drag or a caption drag. Keep a `computed` of base models keyed by zone (depends on `zones` only) and rebuild only the ids the preview names; cache `enclosedByBoundary` per model reference in a `WeakMap` reset when `structure` changes. Test: spy on `enclosedByBoundary` and assert one call for a one-room preview. Trigger: a room drag at `rooms=80` showing per-move Vue work over 8 ms.
3. **Cache each room's caption group.** Three `Konva.Text` nodes per room with `stroke` + `fillAfterStrokeEnabled` are drawn twice each on every layer draw. Konva's answer is `group.cache()` on the caption group at the current `1 / zoom` scale, cleared on zoom (a cached bitmap scaled is blurry) and rebuilt on zoom end. Costs one buffer canvas per room. Trigger: the zone layer's own `drawScene` over 8 ms at `rooms=80`, measured by timing inside the probe's wrapper.
4. **One fewer full-size canvas.** `construction` is an `EmptyLayer` with no content in any vault and no slice planned; it costs one scene canvas (3.6 MB at DPR 1, 14.5 MB at DPR 2 at this pane size) and one clear per pan. Dropping its mount keeps §17's paint order (template order) and `KONVA_LAYER_IDS`; `scene.test.ts`'s "mounts all seven layers" becomes six. Refused today: 4% of canvas memory is not worth a pin rewrite, and Konva's own warning threshold is >5 layers, which seven already exceeds in a way this does not fix. Trigger: a canvas-memory complaint from a vault, or a slice that gives the layer content and makes the question moot.

## §5 Considered and refused, with the reason

- **A rAF throttle on `onWheel` / `onPointerMove`.** Chromium aligns `wheel`, `pointermove` and `mousemove` to the frame already; a second coalescer would add latency and remove nothing.
- **`stage.listening(false)`.** Konva binds its thirteen DOM listeners regardless; with every layer non-listening, `getIntersection` returns after seven `isListening` checks. Measured hover cost is 0.8 ms including our own handlers.
- **`Konva.pixelRatio = 1` on HiDPI.** Quarter the canvas memory, blurry lines on every plan. The plan is a drawing; sharpness is the product.
- **Merging layers below five.** §17's paint order is a correctness contract (a Zone paints over the plan and under an annotation), and the 2026-09-10 sidebar pass already measured that the layer count was never the problem.
- **`ItemView.onResize` instead of the `ResizeObserver`.** The observer fires for a split drag the hook may not, and it is disconnected on unmount today.
- **`__useStrictMode` on vue-konva.** It re-applies every config key on every update; the editor relies on the opposite (only changed keys) for §4.1.
- **`obsidian.debounce` for the three hand-rolled debounces** (`ProjectFilter.vue`, `EvidenceFileSearch.vue`, `VaultChangeAdapter.ts`). `presentation/` may not import `obsidian` (SDD §3.4), and `VaultChangeAdapter` already uses `window.setTimeout` with the delay as a dependency a test drives. Nothing to gain.

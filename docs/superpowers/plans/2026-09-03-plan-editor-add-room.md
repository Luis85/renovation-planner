# Plan Editor Foundation, Increment 2 — Add Room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checkpoint C2 of the vertical slice: Add → Room enters a temporary task in which a rectangular drag or two typed lengths produce one draft, a name is given or taken from a suggestion, and Create dispatches ONE reversible zone creation that selects the new Room and returns to Select — with Escape and Cancel writing nothing, undo and redo keeping one id, and reload restoring the same room.

**Architecture:** One Pinia draft store per leaf is written by a new axis-aligned `DrawRoomTool` and by the Inspector's numeric fields, read by a Konva sketch and by the form, and consumed by ONE action, `createRoomFromDraft`, that builds slice 8's existing `ReversibleCreateZoneCommand` and runs it through the leaf's one wrapped dispatcher. No new command, repository method, schema key or event. The catalogue's Room entry and the no-rooms empty state route to the new tool through one function; the polygon tool stays registered and loses its door (spec §2.1).

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, Obsidian 1.13.0 API, vitest + jsdom + axe-core, playwright-core for captures, ESLint + oxlint, lightningcss-checked stylesheets.

**Spec:** [`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md`](../specs/2026-09-03-plan-editor-add-room-design.md) — the authority when a task and a reading of the code disagree about intent; then `CLAUDE.md` ("Claims, and the checks under them", "Testing", the two plan-editor-foundation sections).

## Global Constraints

- **`npm run check` passes before every commit** (build + oxlint + ESLint + `test:coverage` + fallow). Between edits run `npm run check:fast -- <paths>`; the full gate runs ONCE per task, on a quiet tree, by the agent committing.
- **Layer bans are lint rules.** `presentation → application → domain → core`; only `src/plugin/` composes. Nothing under `presentation/` names a repository class; the draft store and the action hold PORTS and command objects from `PlanEditorContext.commands`.
- **No new vault write path.** The only write is `ReversibleCreateZoneCommand` → `CreateZoneCommand` → `ZoneRepository.save`, all pre-existing. No schema key moves; `editorRoundTrip.test.ts` stays green unchanged.
- **Every dispatch funnels through the leaf's wrapped dispatcher** (`EditorRuntime.dispatcher`). The action never calls a command's `execute` itself.
- **No user-facing string literal.** Every key lands in `src/presentation/i18n/locales/en/editor.ts` AND `de/editor.ts` in the same edit; German is formal (Sie); `de/editor.ts` is `Record<keyof typeof editorEn, string>`, so a missing German value is a build error. Sentence case in English ("Create room").
- **Room, never Zone**, in every string a user can read on this surface (PBI `Start room creation from Add`, criterion 2). Task 6 adds the test that refuses the word.
- **`max-lines` is 400** (blank and comment lines skipped) for every `src/**` file and every `styles/*.css` partial. `runtime.ts` is at its cap; Task 4 extracts before it adds.
- **Coverage floors 99/99/99/98**, headroom about one unit. Every new arm ships with its test in the SAME task; read `coverage/coverage-final.json` for the changed files before calling a task done.
- **A test is watched failing before the code that passes it**; where a step says "mutation-check", apply the mutation, run, observe the red at the named assertion, revert, and record it in the task report.
- **No control that does nothing.** A blocked action is `aria-disabled` with `aria-describedby` naming why — never `:disabled`, never a live button with a dead handler.
- **Pointer grammar is a mouse's**: a click is down+up on the same button; a drag is down/move…/up. Use `planEditorRig`'s `pointer`/`click` and `tool-context`'s `pointerAt`; never a bare `pointerdown`.
- **`vue-tsc` type-checks `tests/**`**; a fake that stops satisfying a widened interface fails `npm run build`.

## Prerequisite gate (orchestrator, not a subagent)

```bash
gh pr view 66 --json state,mergedAt        # expect: "MERGED"
git fetch origin && git checkout main && git pull
git log --oneline -1                       # the merge of #66 or a descendant
git checkout -b claude/plan-editor-add-room
grep -n "registerEditorTools" src/presentation/editor/runtime.ts | head -2   # expect: defined here (Task 4 moves it)
grep -rn "'draw-room'" src | wc -l         # expect: 0
```

If PR #66 is not merged, **STOP and report**. Tasks 4, 7, 8, 10 edit files that pull request is still changing (`runtime.ts`, `EntityInspector.vue`, `TemporaryToolBanner.vue`, `creationCatalogue.ts`, `PlanEditorRoot.vue`), and building against the open branch means re-doing them at the merge.

## File Structure

**Wave 1 — pure and jsdom, no shell**

| File | Responsibility |
|---|---|
| `src/presentation/editor/shell/formatLength.ts` (new) | `formatMetres`, `parseMetres`, `LengthRefusal`, `MAX_ROOM_SIDE_MM` |
| `src/presentation/editor/handleMetrics.ts` (modify) | gains `CLICK_EPSILON_PX = 4`, moved from `select-tool.ts` |
| `src/presentation/editor/tools/select-tool.ts` (modify) | imports the constant instead of declaring it |
| `src/presentation/editor/add/room-draft-store.ts` (new) | `useRoomDraftStore`, `RoomRect`, `RoomDraftPort` |
| `src/presentation/editor/tools/editor-tool.ts` (modify) | `ToolId` gains `'draw-room'` |
| `src/presentation/editor/tools/draw-room-tool.ts` (new) | `DrawRoomTool` |
| `src/presentation/editor/tools/registerEditorTools.ts` (new) | `registerEditorTools`, `EditorToolDeps` — moved out of `runtime.ts`, then gains the fourth tool |
| `src/presentation/editor/add/roomCreation.ts` (new) | `createRoomFromDraft`, `RoomCreationDeps`, `RoomCreationOutcome` |
| `src/presentation/editor/runtime.ts` (modify) | registers the tool's deps; exposes `createRoom`, `canCreateRoom`, `roomDraft` |

**Wave 2 — shell**

| File | Responsibility |
|---|---|
| `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts` (modify) | every new key; `editor.room.default-name` replaces `editor.zone.default-name`; `empty.plan.no-zones.*` reworded (those three live in `en.ts`/`de.ts`) |
| `src/presentation/editor/shell/NewRoomInspector.vue` (new) | the form |
| `src/presentation/editor/shell/EntityInspector.vue` (modify) | routes to the form under `draw-room`; `tabindex="-1"` on the aside |
| `src/presentation/editor/shell/TemporaryToolBanner.vue` (modify) | `draw-room` task entry; Finish |
| `src/presentation/editor/layers/RoomDraftSketch.vue` (new) | rectangle + two labels, from the store |
| `src/presentation/editor/layers/InteractionLayer.vue` (modify) | mounts the sketch |
| `src/presentation/editor/add/creationCatalogue.ts` (modify) | Room → `draw-room`; `activateCreationEntry` |
| `src/presentation/editor/PlanEditorRoot.vue` (modify) | empty-state action through `activateCreationEntry` |
| `styles/editor-new-room.css` (new), `styles/index.css` (modify) | the form's and the Finish button's rules |

**Wave 3 — proof and record**

| File | Responsibility |
|---|---|
| `tests/presentation/editor/roomCreation.e2e.test.ts` (new) | the wired editor: drag, name, Create, undo, redo, Escape, detonation, numeric route |
| `tests/infrastructure/persistence/editorRoundTrip.test.ts` (modify) | a rectangle created through `CreateZoneCommand` round-trips |
| `tests/harness/accessibility.test.ts` (modify) | four scans |
| `tests/harness/planEditor.ts`, `tests/harness/page.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` (modify) | `?room=<w>x<d>` knob; two shots |
| `docs/tests/cases/Add a room.md` (new); `docs/tests/suites/Smoke Test the Editor.md` (modify) | the manual case |
| `docs/requirements/…`, `docs/tasks/…`, `docs/development/consolidation/…`, `CLAUDE.md` (modify) | statuses, amendments, gap #6, the increment's section |

---

### Task 1: lengths in metres, and one click epsilon

**Files:**
- Create: `src/presentation/editor/shell/formatLength.ts`
- Modify: `src/presentation/editor/handleMetrics.ts`, `src/presentation/editor/tools/select-tool.ts`
- Test: `tests/presentation/editor/shell/formatLength.test.ts`

**Interfaces:**
- Produces: `formatMetres(mm: number): string` (two decimals max, `en-US`, no unit), `parseMetres(text: string): { ok: true; mm: number } | { ok: false; reason: LengthRefusal }`, `type LengthRefusal = 'not-a-number' | 'not-positive' | 'too-large'`, `MAX_ROOM_SIDE_MM = 1_000_000`, `CLICK_EPSILON_PX = 4` (from `handleMetrics.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/presentation/editor/shell/formatLength.test.ts
import { describe, expect, it } from 'vitest';
import { formatMetres, MAX_ROOM_SIDE_MM, parseMetres } from '../../../../src/presentation/editor/shell/formatLength';

describe('formatMetres', () => {
	it('prints world millimetres as metres with at most two decimals, en-US', () => {
		expect(formatMetres(4200)).toBe('4.2');
		expect(formatMetres(3800)).toBe('3.8');
		expect(formatMetres(4255)).toBe('4.26');
		expect(formatMetres(1_234_560)).toBe('1,234.56');
	});
});

describe('parseMetres', () => {
	it('reads a decimal point and a decimal comma alike, into millimetres', () => {
		expect(parseMetres('4.2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres('4,2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres(' 3.80 ')).toEqual({ ok: true, mm: 3800 });
	});
	it('refuses text and empties as not-a-number', () => {
		expect(parseMetres('')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('four')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('4.2.1')).toEqual({ ok: false, reason: 'not-a-number' });
	});
	it('refuses zero and negatives as not-positive', () => {
		expect(parseMetres('0')).toEqual({ ok: false, reason: 'not-positive' });
		expect(parseMetres('-3')).toEqual({ ok: false, reason: 'not-positive' });
	});
	it('refuses a side longer than a kilometre, and Infinity with it', () => {
		expect(parseMetres('1000.01')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('Infinity')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('1000')).toEqual({ ok: true, mm: MAX_ROOM_SIDE_MM });
	});
});
```

- [ ] **Step 2: Run it red.** `npx vitest run tests/presentation/editor/shell/formatLength.test.ts` — expected: fails to import `formatLength`.

- [ ] **Step 3: Implement.**

```ts
// src/presentation/editor/shell/formatLength.ts
/**
 * World millimetres ⇄ metres for the room draft's labels and fields (design spec §2.6). ONE
 * module beside `formatArea`, `en-US` for the reason that file gives, so the per-plan units PBI
 * replaces both in one edit. A decimal COMMA is accepted on input because this plugin ships a
 * German locale and a German keyboard's numeric pad types one.
 */
export type LengthRefusal = 'not-a-number' | 'not-positive' | 'too-large';

/** A Floor has no extent (ADR-0017), so "out of bounds" is numeric sanity: a kilometre. */
export const MAX_ROOM_SIDE_MM = 1_000_000;

export function formatMetres(mm: number): string {
	return (mm / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function parseMetres(text: string): { ok: true; mm: number } | { ok: false; reason: LengthRefusal } {
	const normalised = text.trim().replace(',', '.');
	if (normalised === '' || !/^-?\d*\.?\d+$|^Infinity$/.test(normalised)) {
		return normalised === 'Infinity' ? { ok: false, reason: 'too-large' } : { ok: false, reason: 'not-a-number' };
	}
	const metres = Number(normalised);
	if (metres <= 0) return { ok: false, reason: 'not-positive' };
	const mm = Math.round(metres * 1000);
	if (mm > MAX_ROOM_SIDE_MM) return { ok: false, reason: 'too-large' };
	return { ok: true, mm };
}
```

Then in `handleMetrics.ts` add, with the docblock moved verbatim from `select-tool.ts`:

```ts
/** Below this SCREEN displacement a release is a click, not a drag — every tool converts it through `worldPerScreenPixel()` on the release. */
export const CLICK_EPSILON_PX = 4;
```

and in `select-tool.ts` delete the local `const CLICK_EPSILON_PX = 4;` and its docblock, importing the constant from `../handleMetrics`.

- [ ] **Step 4: Run green.** `npm run check:fast -- tests/presentation/editor/shell/formatLength.test.ts tests/presentation/editor/tools` — the select-tool cases must still pass with the imported constant.

- [ ] **Step 5: Commit.** `git commit -m "feat(editor): metres in one module, and one click epsilon for every tool"`

---

### Task 2: the room draft store

**Files:**
- Create: `src/presentation/editor/add/room-draft-store.ts`
- Test: `tests/presentation/editor/add/roomDraftStore.test.ts`

**Interfaces:**
- Consumes: `parseMetres`, `formatMetres`, `LengthRefusal` (Task 1); `createPolygon` from `core/geometry/Polygon`; `Point` from `core/geometry/Point`.
- Produces:

```ts
export interface RoomRect { readonly x: number; readonly y: number; readonly width: number; readonly depth: number }
export type DimensionAxis = 'width' | 'depth';
export const useRoomDraftStore = defineStore('editor-room-draft', () => { … });
export type RoomDraftStore = ReturnType<typeof useRoomDraftStore>;
/** What the tool needs — nothing about names or fields. */
export type RoomDraftPort = Pick<RoomDraftStore, 'rect' | 'setRect' | 'clearRect' | 'reset' | 'beginTask' | 'settle'>;
```
State and actions exactly as spec §3: `origin`, `widthMm`, `depthMm`, `name`, `nameTouched`, `keepAdding`, `widthText`, `depthText`, `widthError`, `depthError`, `settledSize`, `submitting`; getters `rect`, `geometry`, `areaMm2`, `valid`; actions `beginTask(defaultName)`, `setRect(rect)`, `clearRect()`, `reset()`, `setName(text)`, `suggestName(text)`, `commitDimension(axis, text, placeAt)`, `settle()`, `setKeepAdding(flag)`, `setSubmitting(flag)`. `settledSize` is built with `tr('editor.room.settled', { width, depth, area })` — the key lands in Task 6; until then the store uses the key and the test asserts on the PARAMS through `t('en', …)` in Task 6's update. In THIS task assert `settledSize` against a locally computed `tr(...)` call so the case is independent of the copy.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/presentation/editor/add/roomDraftStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';

const centre = () => ({ x: 10_000, y: 6_000 });

describe('RoomDraftStore', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('derives four points, clockwise from the min corner, and the area', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 1000, y: 2000, width: 4200, depth: 3800 });
		expect(draft.geometry?.points).toEqual([
			{ x: 1000, y: 2000 }, { x: 5200, y: 2000 }, { x: 5200, y: 5800 }, { x: 1000, y: 5800 },
		]);
		expect(draft.areaMm2).toBe(15_960_000);
		expect(draft.widthText).toBe('4.2');
		expect(draft.depthText).toBe('3.8');
	});

	it('is valid only with a rect, a non-blank name, no field error and no submit in flight', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		expect(draft.valid).toBe(false);
		draft.setRect({ x: 0, y: 0, width: 100, depth: 100 });
		expect(draft.valid).toBe(true);
		draft.setName('   ');
		expect(draft.valid).toBe(false);
		draft.setName('Kitchen');
		draft.commitDimension('width', 'x', centre);
		expect(draft.valid).toBe(false);
		draft.commitDimension('width', '4.2', centre);
		expect(draft.valid).toBe(true);
		draft.setSubmitting(true);
		expect(draft.valid).toBe(false);
	});

	it('a refused dimension keeps the typed text and names the reason; a correction clears it', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('depth', '-2', centre);
		expect(draft.depthText).toBe('-2');
		expect(draft.depthError).toBe('not-positive');
		expect(draft.rect).toBeNull();
		draft.commitDimension('depth', '2', centre);
		expect(draft.depthError).toBeNull();
	});

	it('the numeric route places a rect centred on placeAt() once both sides are known', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('width', '4.2', centre);
		expect(draft.rect).toBeNull();
		draft.commitDimension('depth', '3.8', centre);
		expect(draft.rect).toEqual({ x: 10_000 - 2100, y: 6_000 - 1900, width: 4200, depth: 3800 });
	});

	it('a numeric commit over an existing rect keeps the min corner and changes one side', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 500, y: 700, width: 4200, depth: 3800 });
		draft.commitDimension('width', '5', centre);
		expect(draft.rect).toEqual({ x: 500, y: 700, width: 5000, depth: 3800 });
	});

	it('beginTask resets keepAdding and the name; clearRect keeps both; reset drops the name', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setKeepAdding(true);
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 100, depth: 100 });
		draft.clearRect();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Kitchen');
		expect(draft.keepAdding).toBe(true);
		draft.beginTask('Room 2');
		expect(draft.name).toBe('Room 2');
		expect(draft.nameTouched).toBe(false);
		expect(draft.keepAdding).toBe(false);
		draft.reset();
		expect(draft.name).toBe('');
	});

	it('settle writes the sentence from the rect, and null without one', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.settle();
		expect(draft.settledSize).toBeNull();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		draft.settle();
		expect(draft.settledSize).toContain('4.2');
		expect(draft.settledSize).toContain('3.8');
		expect(draft.settledSize).toContain('15.96 m²');
	});
});
```

- [ ] **Step 2: Run it red.** `npx vitest run tests/presentation/editor/add/roomDraftStore.test.ts`.

- [ ] **Step 3: Implement.** Use `formatArea` for the area in `settle()`; `tr('editor.room.settled', { width: formatMetres(w), depth: formatMetres(d), area: formatArea(w * d) })`. Add the key `editor.room.settled` to BOTH `en/editor.ts` (`'{width} m by {depth} m, {area}'`) and `de/editor.ts` (`'{width} m mal {depth} m, {area}'`) in this task — it is the store's own key and the interpolation-hole test needs both halves. `geometry` uses `createPolygon` and returns `null` on a refusal (unreachable with positive finite sides, but the getter's type is what the action reads; do not `expectOk` inside a getter). `setRect` re-formats both texts and clears both errors. `commitDimension` on success: set the side; if `origin === null && widthMm !== null && depthMm !== null` then `origin = { x: c.x - widthMm / 2, y: c.y - depthMm / 2 }` with `c = placeAt()`; then `settle()`.

- [ ] **Step 4: Run green**, then `npx vitest run tests/presentation/i18n` (the hole test sees the new key in both tables).

- [ ] **Step 5: Commit.** `git commit -m "feat(editor): the room draft store — one rectangle written by a drag or by two lengths"`

---

### Task 3: `DrawRoomTool`

**Files:**
- Modify: `src/presentation/editor/tools/editor-tool.ts` (`ToolId` gains `'draw-room'`; docblock names it as the Plan Editor's rectangular room tool, spec §4)
- Create: `src/presentation/editor/tools/draw-room-tool.ts`
- Test: `tests/presentation/editor/tools/drawRoomTool.test.ts`

**Interfaces:**
- Consumes: `RoomDraftPort`, `RoomRect` (Task 2); `CLICK_EPSILON_PX` (Task 1); `EditorTool`, `EditorPointerEvent`, `EditorContext`.
- Produces: `class DrawRoomTool implements EditorTool` with `constructor(deps: DrawRoomToolDeps)`, `interface DrawRoomToolDeps { readonly draft: RoomDraftPort; readonly defaultName: () => string }`, `readonly id = 'draw-room'`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/presentation/editor/tools/drawRoomTool.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DrawRoomTool } from '../../../../src/presentation/editor/tools/draw-room-tool';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

function armed() {
	const draft = useRoomDraftStore();
	const tool = new DrawRoomTool({ draft, defaultName: () => 'Room 1' });
	const { context } = toolContext(); // worldPerScreenPixel 1 → epsilon is 4 world units
	tool.activate(context);
	return { tool, draft, context };
}

describe('DrawRoomTool', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('activation begins the task with the default name and no rectangle', () => {
		const { draft } = armed();
		expect(draft.name).toBe('Room 1');
		expect(draft.rect).toBeNull();
	});

	it('a drag in any direction yields one normalised rectangle, and settles once on release', () => {
		const { tool, draft } = armed();
		let settles = 0;
		const original = draft.settle;
		draft.settle = () => { settles += 1; original(); };
		tool.pointerDown(pointerAt(5000, 4000));
		tool.pointerMove(pointerAt(3000, 4500));
		tool.pointerMove(pointerAt(800, 200));
		expect(draft.rect).toEqual({ x: 800, y: 200, width: 4200, depth: 3800 });
		tool.pointerUp(pointerAt(800, 200));
		expect(draft.rect).toEqual({ x: 800, y: 200, width: 4200, depth: 3800 });
		expect(settles).toBe(1);
		expect(tool.hasDraft()).toBe(true);
	});

	it('a click under the epsilon leaves the previous rectangle alone', () => {
		const { tool, draft } = armed();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		tool.pointerDown(pointerAt(100, 100));
		tool.pointerMove(pointerAt(102, 101));
		tool.pointerUp(pointerAt(102, 101));
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 4200, depth: 3800 });
	});

	it('ignores a secondary press', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(0, 0, 'secondary'));
		tool.pointerMove(pointerAt(500, 500, 'secondary'));
		tool.pointerUp(pointerAt(500, 500, 'secondary'));
		expect(draft.rect).toBeNull();
	});

	it('cancel clears the rectangle and keeps the name; abandonGesture restores the pre-press rectangle', () => {
		const { tool, draft } = armed();
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.pointerDown(pointerAt(5000, 5000));
		tool.pointerMove(pointerAt(6000, 6000));
		tool.abandonGesture();
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.cancel();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Kitchen');
		expect(tool.hasDraft()).toBe(false);
	});

	it('deactivate resets the whole draft', () => {
		const { tool, draft } = armed();
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		tool.deactivate();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('');
	});
});
```

- [ ] **Step 2: Run it red.**

- [ ] **Step 3: Implement.**

```ts
// src/presentation/editor/tools/draw-room-tool.ts
import type { Point } from '../../../core/geometry/Point';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { RoomDraftPort, RoomRect } from '../add/room-draft-store';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

export interface DrawRoomToolDeps {
	readonly draft: RoomDraftPort;
	readonly defaultName: () => string;
}

/**
 * The rectangular room tool (design spec §4): a primary drag writes one axis-aligned rectangle
 * into the draft store; a click changes nothing; Escape clears the rectangle and stays; a tool
 * switch resets the draft. It touches no `RenderState`, dispatches nothing and names no Zone —
 * the draft store is the one home for what it draws (spec §2.2), and `createRoomFromDraft` is
 * what turns that into a command.
 */
export class DrawRoomTool implements EditorTool {
	readonly id: ToolId = 'draw-room';
	private context: EditorContext | null = null;
	private anchor: Point | null = null;
	private rectBefore: RoomRect | null = null;

	constructor(private readonly deps: DrawRoomToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.deps.draft.beginTask(this.deps.defaultName());
	}
	deactivate(): void {
		this.anchor = null;
		this.deps.draft.reset();
		this.context = null;
	}
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		this.anchor = event.worldPoint;
		this.rectBefore = this.deps.draft.rect;
	}
	pointerMove(event: EditorPointerEvent): void {
		if (this.anchor === null) return;
		this.deps.draft.setRect(normalised(this.anchor, event.worldPoint));
	}
	pointerUp(event: EditorPointerEvent): void {
		if (this.anchor === null || event.button !== 'primary') return;
		const worldPerPixel = this.context?.viewport.worldPerScreenPixel() ?? 1;
		const moved = Math.hypot(event.worldPoint.x - this.anchor.x, event.worldPoint.y - this.anchor.y);
		this.anchor = null;
		if (moved <= CLICK_EPSILON_PX * worldPerPixel) {
			if (this.rectBefore === null) this.deps.draft.clearRect();
			else this.deps.draft.setRect(this.rectBefore);
			return;
		}
		this.deps.draft.settle();
	}
	cancel(): void {
		this.anchor = null;
		this.deps.draft.clearRect();
	}
	abandonGesture(): void {
		if (this.anchor === null) return;
		this.anchor = null;
		if (this.rectBefore === null) this.deps.draft.clearRect();
		else this.deps.draft.setRect(this.rectBefore);
	}
	hasDraft(): boolean {
		return this.deps.draft.rect !== null;
	}
}

function normalised(a: Point, b: Point): RoomRect {
	return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), depth: Math.abs(b.y - a.y) };
}
```

Note: `clearRect` on the click-with-no-previous arm is deliberate — the move wrote a tiny rect during the press and the release must take it back.

- [ ] **Step 4: Run green**, then `npm run check:fast -- tests/presentation/editor/tools` (the `ToolId` widening must not redden the manager or the switch tests).

- [ ] **Step 5: Commit.** `git commit -m "feat(editor): DrawRoomTool — a primary drag writes one axis-aligned rectangle into the draft"`

---

### Task 4: extract `registerEditorTools`, register the tool, and rename the default

**Files:**
- Create: `src/presentation/editor/tools/registerEditorTools.ts` (move `EditorToolDeps` and `registerEditorTools` out of `runtime.ts` VERBATIM first — one commit — then widen)
- Modify: `src/presentation/editor/runtime.ts`, `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts`, `src/presentation/i18n/locales/en.ts`, `de.ts` (delete `editor.zone.default-name`)
- Test: `tests/presentation/editor/zoneEditing.test.ts` (the expected name), `tests/presentation/i18n/strings.test.ts` (the absent key)

**Interfaces:**
- Consumes: `DrawRoomTool` (Task 3), `useRoomDraftStore` (Task 2).
- Produces: `EditorToolDeps` gains `readonly roomDraft: RoomDraftStore` and `readonly defaultRoomName: () => string`; `registerEditorTools` registers `new DrawRoomTool({ draft: roomDraft, defaultName: defaultRoomName })` after the polygon tool. The polygon completion's name becomes `defaultRoomName()`.

- [ ] **Step 1: The pure move.** Cut `EditorToolDeps` and `registerEditorTools` (with their docblocks and the imports only they use) from `runtime.ts` into the new file; `runtime.ts` imports the function. Run `npm run check:fast -- tests/presentation/editor` — green, nothing changed. Commit: `refactor(editor): registerEditorTools moves out of runtime.ts before the fourth tool arrives`.

- [ ] **Step 2: The failing tests.** In `zoneEditing.test.ts` change both `'Zone 2'` expectations to `'Room 2'`. In `strings.test.ts` add:

```ts
it('has no default room name that says Zone', () => {
	expect('editor.zone.default-name' in en).toBe(false);
	expect(t('en', 'editor.room.default-name', { n: '3' })).toBe('Room 3');
	expect(t('de', 'editor.room.default-name', { n: '3' })).toBe('Raum 3');
});
```

- [ ] **Step 3: Run red** (`'Zone 2'` still produced; the key still exists).

- [ ] **Step 4: Implement.** Add `'editor.room.default-name': 'Room {n}'` / `'Raum {n}'` to the two editor tables; delete `editor.zone.default-name` from `en.ts` and `de.ts` (grep `zone.default-name` under `src` and `tests` — the runtime is its only reader). In `registerEditorTools.ts`: the polygon completion's `name` becomes `defaultRoomName()`; register `DrawRoomTool`. In `runtime.ts`'s `buildRuntime`:

```ts
const roomDraft = useRoomDraftStore();
const defaultRoomName = (): string => tr('editor.room.default-name', { n: String(projectStore.zones.size + 1) });
registerEditorTools(toolManager, { context, planId, projectStore, ledger, dialogs, returnToSelect, roomDraft, defaultRoomName });
```

- [ ] **Step 5: Run green**: `npm run check:fast -- tests/presentation/editor tests/presentation/i18n`. Then `npx eslint src/presentation/editor/runtime.ts src/presentation/editor/tools/registerEditorTools.ts` — both under `max-lines`.

- [ ] **Step 6: Commit.** `git commit -m "feat(editor): register the room tool, and a new room is called Room, never Zone"`

---

### Task 5: `createRoomFromDraft`, and the runtime's two members

**Files:**
- Create: `src/presentation/editor/add/roomCreation.ts`
- Modify: `src/presentation/editor/runtime.ts` (`EditorRuntime` gains `createRoom`, `canCreateRoom`, `roomDraft`)
- Test: `tests/presentation/editor/add/roomCreation.test.ts`

**Interfaces:**
- Consumes: `ReversibleCreateZoneCommand` (`application/commands/zone/reversible-create-zone-command`), `RoomDraftStore`, `SelectionStore`, `UndoableCommand`, `DispatchResult`, `AppError`, `WriteLedger`, `PlanEditorCommandServices`.
- Produces:

```ts
export type RoomCreationOutcome = 'created' | 'invalid' | 'refused' | 'busy';
export interface RoomCreationDeps {
	readonly planId: PlanId;
	readonly commands: Pick<PlanEditorCommandServices, 'createZone' | 'deleteZone' | 'zones'>;
	readonly ledger: WriteLedger;
	readonly dispatcher: { run(command: UndoableCommand): Promise<DispatchResult> };
	readonly draft: RoomDraftStore;
	readonly selection: Pick<SelectionStore, 'select'>;
	readonly defaultName: () => string;
	readonly returnToSelect: () => void;
	readonly reportRejected: (error: AppError) => void;
}
export function createRoomFromDraft(deps: RoomCreationDeps): Promise<RoomCreationOutcome>;
```
and on `EditorRuntime`: `readonly createRoom: () => Promise<RoomCreationOutcome>; readonly canCreateRoom: Readonly<Ref<boolean>>; readonly roomDraft: RoomDraftStore;`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/presentation/editor/add/roomCreation.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../../src/core/result/Result';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createRoomFromDraft, type RoomCreationDeps } from '../../../../src/presentation/editor/add/roomCreation';
import { useRoomDraftStore } from '../../../../src/presentation/editor/add/room-draft-store';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { makePlan, makeProject } from '../../../helpers/entities';
import { RecordingEventBus, expectOk, injectedPersistenceError } from '../../../helpers/domain';

async function deps(overrides: Partial<RoomCreationDeps> = {}) {
	const planId = createPlanId();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const project = makeProject({});
	await plans.save(makePlan({ projectId: project.id, id: planId }), 'absent');
	const events = new RecordingEventBus();
	const createZone = new CreateZoneCommand(zones, plans, events);
	const draft = useRoomDraftStore();
	draft.beginTask('Room 1');
	const dispatched: unknown[] = [];
	const base: RoomCreationDeps = {
		planId,
		commands: { createZone, deleteZone: makeDeleteZoneCommand(zones, events), zones },
		ledger: new SessionWriteLedger(),
		dispatcher: { run: (command) => { dispatched.push(command); return command.execute(); } },
		draft,
		selection: { select: vi.fn() },
		defaultName: () => 'Room 2',
		returnToSelect: vi.fn(),
		reportRejected: vi.fn(),
	};
	return { d: { ...base, ...overrides }, zones, dispatched, draft };
}

describe('createRoomFromDraft', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('an invalid draft dispatches nothing', async () => {
		const { d, dispatched } = await deps();
		expect(await createRoomFromDraft(d)).toBe('invalid');
		expect(dispatched).toHaveLength(0);
	});

	it('a valid draft dispatches exactly one command, selects the new id, and returns to Select', async () => {
		const { d, zones, dispatched, draft } = await deps();
		draft.setName(' Kitchen ');
		draft.setRect({ x: 1000, y: 2000, width: 4200, depth: 3800 });
		expect(await createRoomFromDraft(d)).toBe('created');
		expect(dispatched).toHaveLength(1);
		const listed = expectOk(await zones.listByPlan(d.planId)).loaded;
		expect(listed).toHaveLength(1);
		expect(listed[0].entity.name).toBe('Kitchen');
		expect(listed[0].entity.zoneType).toBe('Room');
		expect(listed[0].entity.geometry.points).toEqual([
			{ x: 1000, y: 2000 }, { x: 5200, y: 2000 }, { x: 5200, y: 5800 }, { x: 1000, y: 5800 },
		]);
		expect(d.selection.select).toHaveBeenCalledWith([listed[0].entity.id]);
		expect(d.returnToSelect).toHaveBeenCalledTimes(1);
	});

	it('the numeric route and a drag of the same size produce identical geometry', async () => {
		const a = await deps();
		a.draft.setRect({ x: 800, y: 100, width: 4200, depth: 3800 });
		await createRoomFromDraft(a.d);
		setActivePinia(createPinia());
		const b = await deps();
		b.draft.commitDimension('width', '4.2', () => ({ x: 2900, y: 2000 }));
		b.draft.commitDimension('depth', '3.8', () => ({ x: 2900, y: 2000 }));
		await createRoomFromDraft(b.d);
		const pa = expectOk(await a.zones.listByPlan(a.d.planId)).loaded[0].entity.geometry.points;
		const pb = expectOk(await b.zones.listByPlan(b.d.planId)).loaded[0].entity.geometry.points;
		expect(pb).toEqual(pa);
	});

	it('keepAdding: the room is selected, the draft restarts with the next default name, Select is not returned to', async () => {
		const { d, draft } = await deps();
		draft.setKeepAdding(true);
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(await createRoomFromDraft(d)).toBe('created');
		expect(d.selection.select).toHaveBeenCalledTimes(1);
		expect(d.returnToSelect).not.toHaveBeenCalled();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Room 2');
		expect(draft.keepAdding).toBe(true); // an explicit choice survives one creation
	});

	it('a refused write reports once, keeps the draft, and stays in the task', async () => {
		const { d, draft } = await deps({
			dispatcher: { run: () => Promise.resolve(err(injectedPersistenceError())) },
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(await createRoomFromDraft(d)).toBe('refused');
		expect(d.reportRejected).toHaveBeenCalledTimes(1);
		expect(d.returnToSelect).not.toHaveBeenCalled();
		expect(draft.rect).not.toBeNull();
		expect(draft.submitting).toBe(false);
	});

	it('a second call while the first is in flight is dropped', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const { d, draft } = await deps({
			dispatcher: { run: async (command) => { await gate; return command.execute(); } },
		});
		draft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		const first = createRoomFromDraft(d);
		expect(await createRoomFromDraft(d)).toBe('busy');
		release();
		expect(await first).toBe('created');
	});
});
```

Check `tests/helpers/slice10.ts`'s `makeDeleteZoneCommand` signature before use and adjust the call; check `injectedPersistenceError` exists in `tests/helpers/domain.ts` (the `zoneEditing` suite imports it). If `makeProject({})` needs a name, pass `{ name: 'P' }`.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.**

```ts
// src/presentation/editor/add/roomCreation.ts
export async function createRoomFromDraft(deps: RoomCreationDeps): Promise<RoomCreationOutcome> {
	const { draft } = deps;
	if (draft.submitting) return 'busy';
	const geometry = draft.geometry;
	if (!draft.valid || geometry === null) return 'invalid';
	const command = new ReversibleCreateZoneCommand(
		deps.commands.createZone, deps.commands.deleteZone, deps.commands.zones, deps.ledger,
		{ planId: deps.planId, name: draft.name.trim(), zoneType: 'Room', geometry },
	);
	draft.setSubmitting(true);
	try {
		const result = await deps.dispatcher.run(command);
		if (!result.ok) {
			deps.reportRejected(result.error);
			return 'refused';
		}
	} finally {
		draft.setSubmitting(false);
	}
	const createdId = command.createdZoneId;
	if (createdId !== null) deps.selection.select([createdId]);
	if (draft.keepAdding) {
		const keep = draft.keepAdding;
		draft.beginTask(deps.defaultName());
		draft.setKeepAdding(keep);
	} else {
		deps.returnToSelect();
	}
	return 'created';
}
```

`ReversibleCreateZoneCommand` satisfies `UndoableCommand` structurally (its docblock says so). In `runtime.ts`:

```ts
const canCreateRoom = computed(() => roomDraft.valid);
const createRoom = (): Promise<RoomCreationOutcome> =>
	createRoomFromDraft({
		planId, commands: context.commands, ledger, dispatcher: wrappedDispatcher, draft: roomDraft, selection,
		defaultName: defaultRoomName, returnToSelect, reportRejected: reportDispatchFailure,
	});
```

and add `createRoom`, `canCreateRoom`, `roomDraft` to the returned object and the interface (docblocks: two doors, one action — spec §5.2). `defaultRoomName` counts `projectStore.zones.size + 1`, which after a refresh includes the room just created.

- [ ] **Step 4: Run green**, then `npm run check:fast -- tests/presentation/editor`.

- [ ] **Step 5: Commit.** `git commit -m "feat(editor): createRoomFromDraft — one action, one reversible command, the new room selected"`

---

### Task 6: the strings, and the word this surface may not say

**Files:**
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts`, `en.ts`, `de.ts`
- Test: `tests/presentation/i18n/strings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('says Room and never Zone anywhere a homeowner reads the editor', () => {
	const prefixes = ['editor.', 'empty.plan.'];
	for (const table of [en, de]) {
		const offenders = Object.entries(table)
			.filter(([key]) => prefixes.some((p) => key.startsWith(p)))
			.filter(([, value]) => /\bzones?\b/i.test(value));
		expect(offenders).toEqual([]);
	}
});
```

Run it: it is RED on the `empty.plan.no-zones.*` values and the existing `editor.zone-type.*`? — check: `editor.zone-type.room` values are homeowner words ("Room", "Garden"…), so they pass; if any other `editor.*` value says "zone", reword it in this task and list it in the commit message. (`editor.layer.rooms` etc. already say rooms.)

- [ ] **Step 2: Add the keys (en / de):**

| key | en | de |
|---|---|---|
| `editor.task.add-room.name` | Adding a room | Raum hinzufügen |
| `editor.task.add-room.instruction` | Drag on the floor to size the room, or type its width and depth. | Ziehen Sie auf dem Grundriss, um den Raum zu bemessen, oder geben Sie Breite und Tiefe ein. |
| `editor.task.finish` | Create room | Raum erstellen |
| `editor.task.finish.blocked` | Size the room and give it a name first | Bemessen und benennen Sie den Raum zuerst |
| `editor.room.new.heading` | New room | Neuer Raum |
| `editor.room.name` | Name | Name |
| `editor.room.suggestion.prompt` | What room is this? | Was für ein Raum ist das? |
| `editor.room.suggestion.kitchen` | Kitchen | Küche |
| `editor.room.suggestion.living-room` | Living room | Wohnzimmer |
| `editor.room.suggestion.bedroom` | Bedroom | Schlafzimmer |
| `editor.room.suggestion.bathroom` | Bathroom | Badezimmer |
| `editor.room.suggestion.hallway` | Hallway | Flur |
| `editor.room.suggestion.office` | Office | Arbeitszimmer |
| `editor.room.width` | Width (m) | Breite (m) |
| `editor.room.depth` | Depth (m) | Tiefe (m) |
| `editor.room.area` | Area | Fläche |
| `editor.room.keep-adding` | Keep adding rooms | Weitere Räume hinzufügen |
| `editor.room.create` | Create room | Raum erstellen |
| `editor.room.cancel` | Cancel | Abbrechen |
| `editor.room.error.not-a-number` | Enter a length in metres, such as 4.2 | Geben Sie eine Länge in Metern ein, zum Beispiel 4,2 |
| `editor.room.error.not-positive` | A side must be longer than zero | Eine Seite muss länger als null sein |
| `editor.room.error.too-large` | A side cannot be longer than 1000 m | Eine Seite kann nicht länger als 1000 m sein |

Reword `empty.plan.no-zones.headline` → "No rooms yet" / "Noch keine Räume"; `.body` → "Add the first room on this floor. Its area is measured from the outline and drives the quantities and costs of anything you assign to it." / German accordingly; `.action` → "Add a room" / "Raum hinzufügen". Keys unchanged.

- [ ] **Step 3: Run green:** `npx vitest run tests/presentation/i18n tests/presentation/editor/emptyStateOverlay.test.ts tests/harness/accessibility.test.ts` (the empty-state cases read keys, not copy; confirm).

- [ ] **Step 4: Commit.** `git commit -m "feat(i18n): the room task's vocabulary in both locales, and no Zone anywhere a homeowner reads"`

---

### Task 7: `NewRoomInspector`, and the frame that routes to it

**Files:**
- Create: `src/presentation/editor/shell/NewRoomInspector.vue`, `styles/editor-new-room.css`
- Modify: `src/presentation/editor/shell/EntityInspector.vue`, `styles/index.css`
- Test: `tests/presentation/editor/shell/newRoomInspector.test.ts`

**Interfaces:**
- Consumes: `useEditorRuntime()` → `roomDraft`, `createRoom`, `canCreateRoom`, `cancelActiveTask`, `activeToolId`; `useEditorStore()` → `viewport`, `stageSize`; `screenToWorld`, `screenPoint`, `STAGE_PIXELS`; `FieldError`; `formatArea`; `tr`.
- Produces: classes `rp-new-room`, `rp-new-room__field`, `rp-new-room__suggestions`, `rp-new-room__suggestion`, `rp-new-room__area`, `rp-new-room__keep`, `rp-new-room__actions`, `rp-new-room__create`, `rp-new-room__cancel`, `rp-new-room__hint`, `rp-new-room__settled`.

- [ ] **Step 1: Write the failing tests** (`mountPlanEditorCanvas`, `runtimeOf`, `settle` from `tests/helpers/editor`; `click`, `pointer` from `tests/helpers/planEditorRig`):

```ts
describe('NewRoomInspector', () => {
	it('replaces the floor and room bodies while the room tool is active, even with a selection', async () => {
		const harness = await mountPlanEditorCanvas();
		useSelectionStore(harness.pinia).select(['zone-a' as never]);
		runtimeOf(harness).setTool('draw-room');
		await settle();
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-room-inspector').exists()).toBe(false);
	});

	it('a suggestion sets the name; Create is aria-disabled until the draft is valid, with the reason described', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		expect(create.attributes('aria-disabled')).toBe('true');
		const hintId = create.attributes('aria-describedby');
		expect(harness.wrapper.find(`#${hintId}`).text()).toBe(t('en', 'editor.task.finish.blocked'));
		await harness.wrapper.findAll('button.rp-new-room__suggestion').find((b) => b.text() === 'Kitchen')!.trigger('click');
		expect(runtime.roomDraft.name).toBe('Kitchen');
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		await settle();
		expect(create.attributes('aria-disabled')).toBe('false');
		expect(harness.wrapper.find('.rp-new-room__area').text()).toContain('15.96 m²');
	});

	it('a refused width shows inline, keeps the text, and clears on correction', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('draw-room');
		await settle();
		const width = harness.wrapper.find('input[name="width"]');
		await width.setValue('abc');
		await width.trigger('blur');
		expect(width.attributes('aria-invalid')).toBe('true');
		expect(harness.wrapper.find('.rp-field-error__message').text()).toContain(t('en', 'editor.room.error.not-a-number'));
		expect((width.element as HTMLInputElement).value).toBe('abc');
		await width.setValue('4.2');
		await width.trigger('keydown', { key: 'Enter' });
		expect(width.attributes('aria-invalid')).toBeUndefined();
	});

	it('typing both lengths with no pointer places a rectangle centred on the stage', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		await harness.wrapper.find('input[name="width"]').setValue('4.2');
		await harness.wrapper.find('input[name="width"]').trigger('blur');
		await harness.wrapper.find('input[name="depth"]').setValue('3.8');
		await harness.wrapper.find('input[name="depth"]').trigger('blur');
		const rect = runtime.roomDraft.rect;
		expect(rect?.width).toBe(4200);
		expect(rect?.depth).toBe(3800);
		// 800×600 stage at the default camera: centre (400,300) → world (3520, 2520) (see planEditorRig's geometry note)
		expect(rect?.x).toBe(3520 - 2100);
		expect(rect?.y).toBe(2520 - 1900);
	});

	it('the settled-size status changes once per drag, not once per move', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('draw-room');
		await settle();
		const status = harness.wrapper.find('.rp-new-room__settled');
		const seen: string[] = [];
		const observer = new MutationObserver(() => seen.push(status.text()));
		observer.observe(status.element, { childList: true, characterData: true, subtree: true });
		const canvas = harness.canvasEl!;
		pointer(canvas, 'pointerdown', 100, 100);
		for (let i = 1; i <= 20; i += 1) pointer(canvas, 'pointermove', 100 + i * 10, 100 + i * 5);
		await settle();
		pointer(canvas, 'pointerup', 300, 200);
		await settle();
		observer.disconnect();
		expect(seen.length).toBe(1);
		expect(status.text()).toContain(' m by ');
	});

	it('Create through the form: the room is created, and focus does not fall to body', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		runtime.roomDraft.setName('Kitchen');
		await settle();
		const create = harness.wrapper.find('button.rp-new-room__create');
		(create.element as HTMLButtonElement).focus();
		await create.trigger('click');
		await until(async () => expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded.length === 2, 'the room to be written');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(document.activeElement).not.toBe(document.body);
		expect(harness.wrapper.find('.rp-editor-inspector').element.contains(document.activeElement)).toBe(true);
	});
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** `NewRoomInspector.vue`: `<section class="rp-new-room" ref="root">`, `<h3>` heading, name `<input>` bound to `draft.name` via `@input="draft.setName(...)"`; suggestions as a `<p>` prompt plus `<ul role="list">` of `<button type="button" class="rp-new-room__suggestion">`; two `<FieldError :message="widthMessage">` wrapping `<input type="text" inputmode="decimal" name="width" :id="inputId" v-bind="aria" :value="draft.widthText" @blur="commit('width', $event)" @keydown.enter.prevent="commit('width', $event)">`; `<dl class="rp-new-room__area">` with `formatArea(draft.areaMm2)` or an en dash when null; `<label class="rp-new-room__keep"><input type="checkbox" :checked="draft.keepAdding" @change="…"> {{ tr('editor.room.keep-adding') }}</label>`; actions: Create (`:aria-disabled="String(!runtime.canCreateRoom.value)"`, `:aria-describedby="hintId"`, `@click="onCreate"`) and Cancel (`@click="runtime.cancelActiveTask()"`); `<p :id="hintId" class="rp-new-room__hint" v-if="!runtime.canCreateRoom.value">` with `editor.task.finish.blocked`; `<p class="rp-new-room__settled" role="status">{{ draft.settledSize ?? '' }}</p>`. `commit(axis, event)` reads `(event.target as HTMLInputElement).value` and calls `draft.commitDimension(axis, value, stageCentreWorld)` where

```ts
const editor = useEditorStore();
function stageCentreWorld(): Point {
	const { width, height } = editor.stageSize;
	return screenToWorld(screenPoint(width / 2, height / 2), editor.viewport, STAGE_PIXELS);
}
```

`onCreate`: `if (!runtime.canCreateRoom.value) return; void runtime.createRoom();`. Focus recovery in `onBeforeUnmount`: `const aside = root.value?.closest<HTMLElement>('.rp-editor-inspector'); if (root.value?.contains(document.activeElement)) void nextTick(() => aside?.focus());`. Error message mapping: `const MESSAGE: Record<LengthRefusal, StringKey> = { 'not-a-number': 'editor.room.error.not-a-number', 'not-positive': 'editor.room.error.not-positive', 'too-large': 'editor.room.error.too-large' }`.

`EntityInspector.vue`: `const { activeToolId } = storeToRefs(useEditorStore());` and `<NewRoomInspector v-if="activeToolId === 'draw-room'" />` FIRST in the chain; `tabindex="-1"` on the `<aside>`. Update its header docblock (routing has a fourth arm; spec §2.3).

`styles/editor-new-room.css`: fields stacked with `var(--size-4-2)` gaps; suggestions as a wrapping flex row of small buttons (`.rp-new-room .rp-new-room__suggestion` at (0,2,0) for the specificity reason `editor-shell.css` records); `.rp-new-room__settled:empty { display: none; }`; Create/Cancel as a row. Add the partial to `styles/index.css`. No colour literal.

- [ ] **Step 4: Run green**, then `npm run check:fast -- tests/presentation/editor tests/build/styles.test.ts tests/build/buttonSpecificity.test.ts`.

- [ ] **Step 5: Mutation-checks.** (a) Remove the `onBeforeUnmount` focus recovery → the last case red at `not.toBe(document.body)`. (b) Call `settle()` inside `DrawRoomTool.pointerMove` → the status case red at `seen.length`. Revert both; record.

- [ ] **Step 6: Commit.** `git commit -m "feat(editor): the New room Inspector — name, suggestions, two lengths, area, keep adding, Create"`

---

### Task 8: Finish on the banner

**Files:**
- Modify: `src/presentation/editor/shell/TemporaryToolBanner.vue`, `styles/editor-shell.css`
- Test: `tests/presentation/editor/shell/temporaryToolBanner.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('names the room task and offers Finish, aria-disabled with its reason until the draft is valid', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-room');
	await settle();
	const banner = harness.wrapper.find('.rp-task-banner');
	expect(banner.text()).toContain(t('en', 'editor.task.add-room.name'));
	const finish = banner.find('button.rp-task-banner__finish');
	expect(finish.attributes('aria-disabled')).toBe('true');
	expect(harness.wrapper.find(`#${finish.attributes('aria-describedby')}`).text()).toBe(t('en', 'editor.task.add-room.instruction'));
	runtime.roomDraft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
	await settle();
	expect(finish.attributes('aria-disabled')).toBe('false');
});

it('offers no Finish under the calibrate tool, which finishes by gesture', async () => {
	const harness = await mountPlanEditorCanvas();
	runtimeOf(harness).setTool('calibrate');
	await settle();
	expect(harness.wrapper.find('button.rp-task-banner__finish').exists()).toBe(false);
});

it('Finish creates the room through the same action as the form, and focus lands on the canvas', async () => {
	const { harness, zonesRepo } = await rig();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-room');
	await settle();
	runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
	await settle();
	const finish = harness.wrapper.find('button.rp-task-banner__finish');
	(finish.element as HTMLButtonElement).focus();
	await finish.trigger('click');
	await until(async () => expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded.length === 2, 'the room to be written');
	await settle();
	expect(runtime.activeToolId.value).toBe('select');
	expect(document.activeElement).toBe(harness.canvasEl);
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** `TASKS` gains `'draw-room': { nameKey: 'editor.task.add-room.name', instructionKey: 'editor.task.add-room.instruction', finish: true }` (the type gains `finish?: true`). Template: the instruction `<span :id="instructionId">`; `<button v-if="task.finish" type="button" class="rp-task-banner__finish" :aria-disabled="String(!runtime.canCreateRoom.value)" :aria-describedby="instructionId" @click="onFinish">{{ tr('editor.task.finish') }}</button>` before Cancel; `onFinish` guards on `canCreateRoom`. `onBeforeUnmount`: if `root.value?.contains(document.activeElement)` then `nextTick(() => root.value?.closest<HTMLElement>('.rp-plan-canvas')?.focus())` — capture the canvas element BEFORE the tick, since the banner's own element is detached by then. CSS: `.rp-task-banner .rp-task-banner__finish` mirroring the Cancel rule, plus `[aria-disabled="true"]` dimming through Obsidian's own selector (nothing to add — the harness CSS already dims `button[aria-disabled="true"]`).

- [ ] **Step 4: Run green**, `npm run check:fast -- tests/presentation/editor/shell tests/harness/accessibility.test.ts`.

- [ ] **Step 5: Commit.** `git commit -m "feat(banner): Finish creates the room from the banner, through the form's own action"`

---

### Task 9: the draft on the canvas

**Files:**
- Create: `src/presentation/editor/layers/RoomDraftSketch.vue`
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Test: `tests/presentation/editor/roomDraftSketch.test.ts`

- [ ] **Step 1: Write the failing test** (`mountPlanEditorCanvas`, `drawnLines` from `planEditorRig`, `pointer`):

```ts
it('draws the drafted rectangle dashed with two dimension labels, and nothing before a rectangle exists', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-room');
	await settle();
	const before = harness.stage!.find('.room-draft');
	expect(before).toHaveLength(0);
	runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 });
	await settle();
	const outline = harness.stage!.findOne<Konva.Line>('.room-draft');
	// default camera: screen = (world + 480) / 10
	expect(outline!.points()).toEqual([148, 148, 568, 148, 568, 528, 148, 528]);
	expect(outline!.dash()).toEqual([4, 4]);
	const labels = harness.stage!.find<Konva.Text>('.room-draft-label').map((node) => node.text());
	expect(labels).toEqual(['4.2 m', '3.8 m']);
	runtime.roomDraft.clearRect();
	await settle();
	expect(harness.stage!.find('.room-draft')).toHaveLength(0);
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** `RoomDraftSketch.vue` takes `tokens: ThemeTokens` and `toScreen: (p: Point) => ScreenPoint` as props; reads `useRoomDraftStore()`; a `computed` builds the flat screen points and two label positions (width label centred above the top edge at `y - 14`, depth label to the right of the right edge, `rotation: -90` optional — keep horizontal, offset `x + 8`); renders `<VLine :config="{ name: 'room-draft', points, closed: true, stroke: tokens.accent, strokeWidth: 1.5, dash: [4, 4], strokeScaleEnabled: false, listening: false }">` and two `<VText :config="{ name: 'room-draft-label', text, x, y, fontSize: 12, fill: tokens.textNormal (whatever the token for text is called in themeTokens.ts), listening: false }">`. Label text `${formatMetres(w)} m`. `InteractionLayer.vue` mounts `<RoomDraftSketch :tokens="props.tokens" :to-screen="toScreen" />` inside its `<VLayer>` after the hover outline. Read `themeTokens.ts` for the text token's actual name before writing.

- [ ] **Step 4: Run green.** `npm run check:fast -- tests/presentation/editor`.

- [ ] **Step 5: Commit.** `git commit -m "feat(editor): the drafted room is drawn dashed on the canvas with its width and depth"`

---

### Task 10: one door for Room — the catalogue and the empty state

**Files:**
- Modify: `src/presentation/editor/add/creationCatalogue.ts`, `src/presentation/editor/PlanEditorRoot.vue`
- Test: `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/add/addMenu.test.ts`, `tests/presentation/editor/emptyStateOverlay.test.ts`

**Interfaces:**
- Produces: `export function activateCreationEntry(id: CreationEntryId, runtime: Pick<EditorRuntime, 'setTool'>): void` — finds the entry, throws if unsupported (the entry's own `activate` already does), calls `activate`.

- [ ] **Step 1: Change the tests.** `creationCatalogue.test.ts`: 'Room … activates the draw tool' → expects `'draw-room'`; add:

```ts
it('activateCreationEntry is the one door: Room reaches setTool("draw-room") exactly once', () => {
	const setTool = vi.fn<(id: ToolId | null) => void>();
	activateCreationEntry('room', { setTool });
	expect(setTool).toHaveBeenCalledTimes(1);
	expect(setTool).toHaveBeenCalledWith('draw-room');
	expect(() => activateCreationEntry('wall', { setTool })).toThrow();
});
```

`addMenu.test.ts`: every `'draw-polygon'` expectation becomes `'draw-room'`. `emptyStateOverlay.test.ts`: the two `'draw-polygon'` assertions become `'draw-room'`; the 'activates the draw tool when the noZones action is pressed' case additionally spies: `const spy = vi.spyOn(runtimeOf(harness), 'setTool')` is NOT possible on a plain object member created per leaf — instead assert on the store (`activeToolId === 'draw-room'`) and add a case in `creationCatalogue.test.ts` that `PlanEditorRoot.vue`'s source contains `activateCreationEntry('room'` and no `setTool('draw-` literal (a text assertion, the same instrument `entityRef.test.ts` uses for a caller list; say so in the docblock).

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** Catalogue: `activate: (runtime) => runtime.setTool('draw-room')`; add `activateCreationEntry`. Root: `function onEmptyStateAction(): void { activateCreationEntry('room', runtime); }` with the docblock updated (spec §7.1). Grep: `grep -rn "'draw-polygon'" src/presentation/editor/add src/presentation/editor/PlanEditorRoot.vue` → 0 lines.

- [ ] **Step 4: Run green.** `npm run check:fast -- tests/presentation/editor`.

- [ ] **Step 5: Commit.** `git commit -m "feat(add): Room routes to the room tool from the menu and the empty state through one door"`

---

### Task 11: the wired editor, end to end

**Files:**
- Create: `tests/presentation/editor/roomCreation.e2e.test.ts` (uses `rig`, `activateTool`, `click`, `pointer`, `actionButton`, `PLAN_DTO` from `planEditorRig`; `settle`, `settleUntil as until`)

- [ ] **Step 1: Write the cases** (each opens with `const { harness, zonesRepo } = await rig();` and closes with `harness.unmount()`):

1. **Drag, name, Create**: `activateTool(harness, 'draw-room')`; `pointer(canvas,'pointerdown',100,100)`, three `pointermove`s to `(520, 480)`, `pointerup` at `(520, 480)`; expect `runtimeOf(harness).roomDraft.rect` `{ x: 520, y: 520, width: 4200, depth: 3800 }` (screen→world: `10·s − 480`); set the name through the form's input (`setValue('Kitchen')` + `input`); click `button.rp-new-room__create`; `until` two zones; assert the new zone's `name`, `zoneType`, four points; `useSelectionStore(harness.pinia).selectedIds` equals `[created.id]`; `activeToolId === 'select'`; `.rp-room-inspector` shows "Kitchen"; the banner is gone; `harness.wrapper.find('.rp-task-banner').exists()` false.
2. **Undo removes it, redo restores the same id** — copy `zoneEditing.test.ts`'s undo/redo tail verbatim against the room created in case 1's steps.
3. **Escape with a drafted rectangle clears it and writes nothing; a second Escape returns to Select**: drag; `canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`; expect `rect === null`, `activeToolId === 'draw-room'`, one zone in the repository; Escape again → `'select'`.
4. **Cancel writes nothing**: drag, type a name, click `.rp-new-room__cancel` → one zone, `'select'`, `rect === null`.
5. **A detonated save leaves no phantom**: `rig()` then `vi.spyOn(zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()))`; drag; Create; `until` `Notice.shown` (or the save-state badge — read `report-failure.ts` to see which surface a `Persistence` refusal takes and assert THAT); expect one zone, `rect` intact, `'draw-room'` still active, `runtime.roomDraft.submitting === false`.
6. **The numeric route with no pointer**: type `4.2` and `3.8`, blur each, Create → two zones, the new one `4200 × 3800`, centred on the stage centre in world coordinates (`(3520, 2520)` at the default camera per the rig's geometry note → min corner `(1420, 620)`).
7. **Keep adding**: tick the checkbox, drag, Create → two zones, selection is the new id, `activeToolId === 'draw-room'`, the form shows `Room 3`, `rect === null`.

- [ ] **Step 2: Run** `npx vitest run tests/presentation/editor/roomCreation.e2e.test.ts` — every case green on the code Tasks 1–10 built; if one is red, the defect is in the increment and is fixed HERE, not by weakening the case. Then mutation-check case 5 by removing the `try/finally` in `createRoomFromDraft` → `submitting` stays true → red.

- [ ] **Step 3: Commit.** `git commit -m "test(editor): Add Room end to end — drag, name, Create, undo, redo, Escape, a detonated save, the numeric route, keep adding"`

---

### Task 12: the round trip carries a rectangle created through the command

**Files:**
- Modify: `tests/infrastructure/persistence/editorRoundTrip.test.ts`

- [ ] **Step 1: Add a case** beside `seed()`'s `makeZone` one: build `new CreateZoneCommand(stack.zones, stack.plans, new RecordingEventBus())`, execute `{ planId, name: 'Kitchen', zoneType: 'Room', geometry: expectOk(createPolygon([{x:1000,y:2000},{x:5200,y:2000},{x:5200,y:5800},{x:1000,y:5800}])) }`, then `stack.zones.getById(created.id)` → id, name, `'Room'`, the four points, `area() === 15_960_000`; and `parseFrontmatter` of the note shows `zone-type: room` and no key named `width`, `depth` or `room` — the rectangle is stored as a polygon and nothing else.

- [ ] **Step 2: Run green** (`npx vitest run tests/infrastructure/persistence/editorRoundTrip.test.ts`); update the consolidation report's §3 round-trip matrix with the new row (Task 15 carries the document edits — note it there).

- [ ] **Step 3: Commit.** `git commit -m "test(persistence): a rectangle created through CreateZoneCommand round-trips as a polygon under one id"`

---

### Task 13: accessibility scans

**Files:**
- Modify: `tests/harness/accessibility.test.ts`

- [ ] **Step 1: Four cases**, each with the file's presence assertion before `axe.run`:
1. `draw-room` active with a valid draft in the full layout — asserts `.rp-new-room` and `button.rp-new-room__create[aria-disabled="false"]` present.
2. The form with a refused width — `setValue('abc')` + blur; asserts `input[name="width"][aria-invalid="true"]`.
3. The banner under `draw-room` — asserts `button.rp-task-banner__finish`.
4. Constrained layout with the Inspector drawer open under `draw-room` (copy the existing drawer case's resize and rail click) — asserts `.rp-inspector-drawer .rp-new-room`.

- [ ] **Step 2: Run** `npx vitest run tests/harness/accessibility.test.ts` — green, or fix the markup (a suggestion `<ul>` needs `role="list"` only if a reset removes list semantics; a `role="status"` inside a `<section>` is fine).

- [ ] **Step 3: Commit.** `git commit -m "test(a11y): four scans over the room task — the form, a field error, the banner's Finish, the drawer"`

---

### Task 14: the harness knob and two captures

**Files:**
- Modify: `tests/harness/planEditor.ts` (`PlanEditorHarnessOptions.room?: { widthMm: number; depthMm: number }`), `tests/harness/page.ts` (`?room=<w>x<d>`), `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts`, `tests/harness/harness.test.ts` if it pins the knob list

- [ ] **Step 1: Tests.** In `tests/build/harness-shot.test.ts`'s inventory case add `plan-editor-add-room` and `plan-editor-add-room-narrow` to the expected names (find the case that lists shots). In `tests/harness/harness.test.ts` add a jsdom case that mounts `mountPlanEditorHarness(root, { room: { widthMm: 4200, depthMm: 3800 } })` and `settleUntil`s `.rp-new-room__settled:not(:empty)`.

- [ ] **Step 2: Implement the knob through real doors**: `openAddMenuOnceReady`, then `settleUntil` the menu, click the item whose text is the Room label, `settleUntil('.rp-new-room')`, set `input[name="width"]`'s value and dispatch `blur`, same for depth. Shots: `{ name: 'plan-editor-add-room', query: '?view=plan-editor&room=4200x3800&theme=light', selector: '.rp-new-room__settled:not(:empty)' }` and the same at `width: 460` named `plan-editor-add-room-narrow` (selector `.rp-task-banner__finish`, since the form is in the closed drawer there).

- [ ] **Step 3: Run the captures and READ them.** `npm run harness-shot` → read `harness-shots/plan-editor-add-room.png` (dashed rectangle with two labels, the form with area `15.96 m²`, Create enabled) and `plan-editor-add-room-narrow.png` (banner with Finish and Cancel, rail, rectangle drawn). Report each in a sentence; fix any layout defect found (a wrapping banner at 460 is the likeliest) and re-capture.

- [ ] **Step 4: Commit.** `git commit -m "test(harness): the ?room knob drives the numeric route, and two captures of the room task"`

---

### Task 15: the record — manual case, statuses, gap #6, CLAUDE.md

**Files:**
- Create: `docs/tests/cases/Add a room.md` (`order: 90`, `parent: "[[Smoke Test the Editor]]"`, `status: Ready`, sources: this spec §§3–7, M03, VS-04)
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (`## Cases` gains the new case), `docs/requirements/Start room creation from Add.md`, `docs/requirements/Draw and name a rectangular room.md`, `docs/requirements/Start one creation task from Add.md`, `docs/requirements/Spatial creation.md`, `docs/requirements/Editor foundation.md`, the nine task notes, `docs/tasks/Run one temporary creation task from Add.md`, `docs/tasks/Show an active creation-task banner with complete controls.md`, `docs/development/consolidation/2026-09-editor-model-consolidation.md`, `CLAUDE.md`

- [ ] **Step 1: The manual case**, ten steps in the house table (`Reachable by` / Do this / It passes when / It exists to catch), `Runs` reading "Not yet run in a vault": (1 `obsidian`) open the sample floor, Add → Room: banner "Adding a room" with Finish disabled and Cancel; (2 `browser`) drag a rectangle: dashed outline, width and depth labels follow the hand, the Inspector's Width/Depth/Area update live; (3 `desktop`) release with a screen reader running: ONE announcement "… m by … m, … m²", none during the drag; (4 `suite`) press Kitchen: name field reads Kitchen; (5 `suite`) type `abc` in Width, Tab: inline error, text kept; type `4.2`: error gone, rectangle resized from its top-left corner; (6 `obsidian`) Create: room appears, selected, Room Inspector shows Kitchen, Select pressed, focus visibly on the Inspector (not lost); (7 `obsidian`) Undo/Redo in the context bar: room gone and back; (8 `obsidian`) close and reopen the floor: Kitchen present with the same area; (9 `browser`) Add → Room, drag, Escape: rectangle gone, banner stays; Escape again: Select; (10 `obsidian`) at sidebar width: Details opens the drawer with the form, Finish on the banner creates without opening it.

- [ ] **Step 2: Statuses and amendments.** `Start room creation from Add`: `status: Done`, `started` = the date Task 1 was committed, `finished` = the date this task is committed, `## Amendments` naming the holding test per criterion (1 → `creationCatalogue.test.ts` 'one door' + `addMenu.test.ts` + `emptyStateOverlay.test.ts`; 2 → `strings.test.ts` 'says Room and never Zone'; 3 → e2e case 3; 4 → VACUOUS: `setTool` cannot refuse a registered id, recorded; 5 → `addMenu.test.ts`'s keyboard cases), plus Extension 1a as a residue (spec §2.9) and §2.1's no-door polygon tool with its trigger. `Draw and name a rectangular room`: `Done`; criteria 1 → `roomCreation.test.ts` 'identical geometry' + e2e 6; 2 → e2e 1 + `editorRoundTrip` new case; 3 → the store's `areaMm2` getter and the round-trip's `area()`; 4 → e2e 3, 4; 5 → e2e 2; 6 → e2e 6 + a11y 1; amendments: snapping and handles deferred with their PBIs, bounds narrowed (spec §2.7). `Start one creation task from Add`: the repeat residue closed (e2e 7), Finish closed (banner test), Remove last stays. The nine tasks → `Done` each with a `## Closing evidence` naming its cases; `Show an active creation-task banner…` stays Active with Finish ticked and Remove last open. `Spatial creation`: `status: Active`, `started`, a `## Progress` entry. `Editor foundation`: a dated Progress entry: "the second increment landed … C2".

- [ ] **Step 3: The consolidation report.** §3 gains the round-trip row for the created rectangle; §4 gains gap #6 — "no room kind on `Zone`; M03's type is presented as a name suggestion (spec §2.4)"; §6 gains ADR-RK with first consumer "the first query by room kind" and trigger "per-kind cost defaults or a room filter".

- [ ] **Step 4: CLAUDE.md.** After the "plan editor foundation's first increment" section add one for the second, in the file's own voice: what landed (C2), the one-store/one-action shape and why it deviates from `RenderState`, the polygon tool's stated no-door, Room-never-Zone as a test, the bounds narrowing, and whatever the captures and the mutation checks actually found — written from the task reports, not from this plan.

- [ ] **Step 5: `npm run check`** (docs only, but it is the rule), then commit: `docs(add-room): the manual case, PBI and task closures, gap #6, and CLAUDE.md's account of the increment`.

---

### Task 16: finish

- [ ] `npm run check` on a quiet tree; `npm run build` and record `dist/main.js`'s size in CLAUDE.md's bundle paragraph as "at the close of the Add Room increment".
- [ ] Open the pull request against `main` with the spec and plan linked, the four mutation checks and the two captures' readings in its body, and the residues of spec §11 listed verbatim.

## Self-review (run by the plan's author before handing off)

**Spec coverage.** §2.1 → Task 10 (routing) and Task 15 (the recorded absence). §2.2/§3 → Task 2. §2.3/§5.1 → Task 7. §2.4 → Task 7 (suggestions) and Task 15 (gap #6). §2.5 → Task 12. §2.6/§2.7 → Task 1. §2.8 → nothing to build; asserted by `draw-room` absent from `CONSTRAINING_TOOLS` (add one line to `editorSnapping.test.ts` in Task 3 if a test enumerates the list). §2.9 → Task 15 residue. §2.10 → Task 5 and e2e 7. §4 → Task 3. §5.2 → Tasks 7 and 8. §5.3 → Task 9. §5.4 → Task 7's status case. §6 → Task 5. §7 → Tasks 4, 6, 10. §8 → Tasks 4 and 6. §9 → Tasks 7 and 8 (focus), existing `routeEscape` (e2e 3). §10 → Tasks 11–14. §12 → the prerequisite gate.

**Placeholders.** None: every test step carries its code; the two "read X before writing" notes (Task 5's helper signatures, Task 9's token name) name the file to read and what to look for.

**Type consistency.** `RoomDraftPort` = `Pick<RoomDraftStore, 'rect' | 'setRect' | 'clearRect' | 'reset' | 'beginTask' | 'settle'>` in Tasks 2 and 3; `createRoomFromDraft(deps)` and `RoomCreationOutcome` in Tasks 5, 7, 8, 11; `activateCreationEntry(id, runtime)` in Task 10; `EditorRuntime.roomDraft`/`createRoom`/`canCreateRoom` in Tasks 5, 7, 8, 11, 14.

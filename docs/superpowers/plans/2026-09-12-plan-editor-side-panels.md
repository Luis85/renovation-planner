# Plan editor side panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Plan editor's two side panels resizable and collapsible in the full layout, remember that per device, and redesign both panels' chrome and content against M00.

**Architecture:** A pure `panelLayout.ts` owns bounds, parsing and the canvas-floor arithmetic; `WorkspaceStore` holds the per-leaf state; a small infrastructure store persists it through `App.loadLocalStorage` behind a `DeviceStorage` port on `PlanEditorContext`. `EditorSidePanel.vue` replaces `OverlayPanel.vue`/`InspectorDrawer.vue` and draws a header, `PanelResizer.vue` and `PanelCollapsedStrip.vue` in the full layout while keeping M16's constrained overlay unchanged. Content work is markup wrappers plus two new CSS partials.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia, Vitest (node + jsdom), `@vue/test-utils`, axe-core, lightningcss-assembled stylesheet, Playwright harness captures.

**Spec:** `docs/superpowers/specs/2026-09-12-plan-editor-side-panels-design.md`

## Global Constraints

- Obsidian variables only in CSS; no hard-coded colour (the build refuses it). No CSS nesting, `@layer` or `@scope`.
- Every `styles/*.css` partial is `@import`ed in `styles/index.css` and stays ≤ 400 lines.
- Every button rule that sets `background`, `background-color`, `color`, `box-shadow` or `all` scores ≥ (0,1,1) (use `.renovation-plan-editor .x` = (0,2,0)); every button rule with `box-shadow: none` gets its own `:focus-visible` rule with the same selector plus `:focus-visible` (`tests/build/buttonSpecificity.test.ts`, `buttonFocusRing.test.ts`).
- No inline styles except CSS custom properties bound through `:style` (precedent: `TemporaryToolBanner.vue`'s `--rp-taskbar-clearance`).
- Every user-visible string through `tr`/`t`; new keys in `en` AND `de` (German locale modules are `Record<keyof typeof …En, string>`), sentence case in English. No literal in `.setText`, `createEl` `text:`, notice calls.
- `lib` is ES2021: no `Array.prototype.at`, no `Object.hasOwn`. `Intl.ListFormat` is available.
- `max-lines` 400 for `src/**`, 450 for `tests/**`; `max-lines-per-function` 100; `max-params` 5.
- Command ids and view types unchanged.
- Width bounds: Property and layers min 200 / default 256 / max 400 px; Inspector min 280 / default 352 / max 520 px; canvas floor 320 px; collapsed strip 40 px. Storage key `${manifest.id}:panel-layout`.
- Inner loop: `npm run check:fast -- <paths>`. The full `npm run check` runs once, in Task 13, before the final commit — never two gates at once.
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File map

| File | Responsibility |
|---|---|
| Create `src/presentation/editor/shell/panelLayout.ts` | Types, bounds, defaults, `parsePanelLayout`, `clampPanelWidth`, `effectivePanelWidths`, `maxPanelWidth` |
| Create `src/presentation/editor/shell/panelSections.ts` | Strip sections and per-side string keys |
| Modify `src/presentation/stores/WorkspaceStore.ts` | `panelLayout` state, `setPanel`, `restorePanelLayout` |
| Modify `src/presentation/editor/PlanEditorContext.ts` | `DeviceStorage` port, `panelLayout` member |
| Create `src/infrastructure/obsidian/plugin-data/deviceLocalStore.ts` | Per-device JSON slot, swallow-and-warn |
| Modify `src/presentation/views/PlanEditorView.ts`, `src/plugin/planEditorDeps.ts`, `src/plugin/RenovationPlannerPlugin.ts` | Wiring |
| Create `src/presentation/editor/shell/PanelResizer.vue` | Window-splitter separator |
| Create `src/presentation/editor/shell/PanelCollapsedStrip.vue` | Collapsed strip |
| Create `src/presentation/editor/shell/EditorSidePanel.vue` | Frame for both sides, both layouts |
| Delete `OverlayPanel.vue`, `InspectorDrawer.vue` | Replaced |
| Modify `src/presentation/editor/shell/ResponsiveEditorShell.vue` | Effective widths, restore, persist |
| Create `src/presentation/editor/shell/PanelSection.vue` | One collapsible sidebar section |
| Modify `PropertyLayerPanel.vue` | Uses `PanelSection`, rooms footer |
| Create `src/presentation/editor/shell/comingLater.ts`, `ComingLaterLine.vue` | The Coming later line |
| Delete `HomeownerQuestionNav.vue`, `LinkedContentList.vue` | Replaced |
| Create `src/presentation/editor/shell/AssetAssignControl.vue` | Assign asset, lifted out of `RoomInspector` |
| Modify `RoomInspector.vue`, `StructureInspector.vue`, `ElementInspector.vue`, `FloorInspector.vue`, `ObjectRotationControls.vue` | Inspector skeleton |
| Create `styles/editor-side-panel.css`, `styles/editor-inspector-skeleton.css` | New visual language |
| Modify `styles/index.css`, `editor.css`, `editor-layout.css`, `editor-inspector.css`, `editor-visual-shell.css`, `editor-shell-fidelity.css`, `editor-visual-tasks.css`, `editor-object.css`, `editor-selection-details.css`, `editor-structure.css`, `editor-visual-overview.css` | Delete superseded rules, edit in place |
| Create `tests/helpers/deviceStorage.ts` | In-memory `DeviceStorage` |
| Create `tests/harness/panelsKnob.ts`, `tests/harness/accessibilitySidePanels.test.ts` | Harness knob, axe |
| Create `docs/tests/cases/Resize and collapse side panels.md` | Manual case |

---

### Task 1: `panelLayout.ts` — bounds, parsing and the canvas floor

**Files:**
- Create: `src/presentation/editor/shell/panelLayout.ts`
- Test: `tests/presentation/editor/shell/panelLayout.test.ts`

**Interfaces:**
- Produces:
  - `type PanelSide = 'layers' | 'inspector'`
  - `interface PanelState { readonly width: number; readonly collapsed: boolean }`
  - `type PanelLayout = Readonly<Record<PanelSide, PanelState>>`
  - `const PANEL_BOUNDS: Readonly<Record<PanelSide, { readonly min: number; readonly initial: number; readonly max: number }>>`
  - `const CANVAS_FLOOR_PX = 320`, `const STRIP_PX = 40`
  - `defaultPanelLayout(): PanelLayout`
  - `clampPanelWidth(side: PanelSide, width: number): number`
  - `parsePanelLayout(raw: unknown): PanelLayout`
  - `effectivePanelWidths(layout: PanelLayout, shellWidth: number): Readonly<Record<PanelSide, number>>`
  - `maxPanelWidth(side: PanelSide, layout: PanelLayout, shellWidth: number): number`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * The side panels' layout arithmetic (2026-09-12 side panels spec §1), asked of pure functions.
 * Node, not jsdom: nothing here touches a DOM.
 */
import { describe, expect, it } from 'vitest';
import {
	CANVAS_FLOOR_PX,
	PANEL_BOUNDS,
	STRIP_PX,
	clampPanelWidth,
	defaultPanelLayout,
	effectivePanelWidths,
	maxPanelWidth,
	parsePanelLayout,
} from '../../../../src/presentation/editor/shell/panelLayout';

describe('panel layout defaults and parsing', () => {
	it('opens both panels expanded at their default widths', () => {
		expect(defaultPanelLayout()).toEqual({
			layers: { width: 256, collapsed: false },
			inspector: { width: 352, collapsed: false },
		});
	});

	it.each([
		['null', null],
		['a string', 'wide'],
		['an array', []],
		['an empty object', {}],
	])('falls back to the defaults for %s', (_what, raw) => {
		expect(parsePanelLayout(raw)).toEqual(defaultPanelLayout());
	});

	it('keeps each valid field and defaults each invalid one on its own', () => {
		expect(parsePanelLayout({
			layers: { width: 300, collapsed: 'yes' },
			inspector: { width: Number.NaN, collapsed: true },
		})).toEqual({
			layers: { width: 300, collapsed: false },
			inspector: { width: 352, collapsed: true },
		});
	});

	it('defaults a width outside its bounds rather than trusting a hand-edited value', () => {
		expect(parsePanelLayout({ layers: { width: 199, collapsed: false }, inspector: { width: 521, collapsed: false } }))
			.toEqual(defaultPanelLayout());
		expect(parsePanelLayout({ layers: { width: 399.6, collapsed: false } }).layers.width).toBe(400);
	});

	it('clamps and rounds a width to its side', () => {
		expect(clampPanelWidth('layers', 12)).toBe(PANEL_BOUNDS.layers.min);
		expect(clampPanelWidth('inspector', 9999)).toBe(PANEL_BOUNDS.inspector.max);
		expect(clampPanelWidth('layers', 300.6)).toBe(301);
	});
});

describe('effective widths', () => {
	it('gives the stored widths when the shell has room for them and the canvas floor', () => {
		expect(effectivePanelWidths(defaultPanelLayout(), 1280)).toEqual({ layers: 256, inspector: 352 });
	});

	it('gives a collapsed panel the strip width', () => {
		const layout = { ...defaultPanelLayout(), inspector: { width: 352, collapsed: true } };
		expect(effectivePanelWidths(layout, 1280)).toEqual({ layers: 256, inspector: STRIP_PX });
	});

	it('shrinks both expanded panels proportionally so the canvas keeps its floor', () => {
		const widths = effectivePanelWidths(defaultPanelLayout(), 900);
		expect(900 - widths.layers - widths.inspector).toBeGreaterThanOrEqual(CANVAS_FLOOR_PX);
		expect(widths.layers).toBe(244);
		expect(widths.inspector).toBe(335);
	});

	it('shrinks only the expanded panel when the other is a strip', () => {
		const layout = { layers: { width: 400, collapsed: false }, inspector: { width: 520, collapsed: true } };
		expect(effectivePanelWidths(layout, 700)).toEqual({ layers: 700 - CANVAS_FLOOR_PX - STRIP_PX, inspector: STRIP_PX });
	});

	it('answers strips and zero for a shell that has not been laid out yet', () => {
		const both = { layers: { width: 256, collapsed: true }, inspector: { width: 352, collapsed: true } };
		expect(effectivePanelWidths(both, 0)).toEqual({ layers: STRIP_PX, inspector: STRIP_PX });
		expect(effectivePanelWidths(defaultPanelLayout(), 0)).toEqual({ layers: 0, inspector: 0 });
	});
});

describe('the widest a panel may be dragged', () => {
	it('is the side maximum when the shell is wide', () => {
		expect(maxPanelWidth('layers', defaultPanelLayout(), 1600)).toBe(400);
	});

	it('leaves the canvas floor beside the other panel as it stands', () => {
		expect(maxPanelWidth('inspector', defaultPanelLayout(), 1000)).toBe(1000 - CANVAS_FLOOR_PX - 256);
	});

	it('never answers less than the side minimum', () => {
		expect(maxPanelWidth('layers', defaultPanelLayout(), 400)).toBe(200);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/panelLayout.test.ts`
Expected: FAIL — cannot resolve `panelLayout`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * The Plan editor's two side panels in the FULL layout (2026-09-12 side panels spec §1): how wide
 * each may be, how a stored value is read back, and how much each actually gets in a pane of a
 * given width. `constrained` and `unsupported` (M16) never read any of this.
 *
 * Pure on purpose: the stored value comes from `App.loadLocalStorage`, which answers whatever a
 * user or another build put there, so parsing it is a trust boundary and belongs where a node test
 * can drive every arm.
 */
export type PanelSide = 'layers' | 'inspector';

export interface PanelState {
	readonly width: number;
	readonly collapsed: boolean;
}

export type PanelLayout = Readonly<Record<PanelSide, PanelState>>;

export const PANEL_BOUNDS: Readonly<Record<PanelSide, { readonly min: number; readonly initial: number; readonly max: number }>> = {
	layers: { min: 200, initial: 256, max: 400 },
	inspector: { min: 280, initial: 352, max: 520 },
};

/** The canvas never gets less than this beside two panels. */
export const CANVAS_FLOOR_PX = 320;
/** A collapsed panel's strip. */
export const STRIP_PX = 40;

export function defaultPanelLayout(): PanelLayout {
	return {
		layers: { width: PANEL_BOUNDS.layers.initial, collapsed: false },
		inspector: { width: PANEL_BOUNDS.inspector.initial, collapsed: false },
	};
}

export function clampPanelWidth(side: PanelSide, width: number): number {
	const { min, max } = PANEL_BOUNDS[side];
	return Math.round(Math.min(max, Math.max(min, width)));
}

/**
 * One side, field by field. An out-of-range width is DEFAULTED rather than clamped: this build
 * clamps on every write, so a stored value outside the bounds was not written by it.
 */
function parseState(side: PanelSide, raw: unknown): PanelState {
	const fallback = defaultPanelLayout()[side];
	if (typeof raw !== 'object' || raw === null) return fallback;
	const { width, collapsed } = raw as { readonly width?: unknown; readonly collapsed?: unknown };
	const { min, max } = PANEL_BOUNDS[side];
	const valid = typeof width === 'number' && width >= min && width <= max;
	return {
		width: valid ? Math.round(width) : fallback.width,
		collapsed: typeof collapsed === 'boolean' ? collapsed : fallback.collapsed,
	};
}

export function parsePanelLayout(raw: unknown): PanelLayout {
	const record = typeof raw === 'object' && raw !== null ? (raw as { readonly layers?: unknown; readonly inspector?: unknown }) : {};
	return { layers: parseState('layers', record.layers), inspector: parseState('inspector', record.inspector) };
}

function demand(state: PanelState): number {
	return state.collapsed ? STRIP_PX : state.width;
}

/**
 * What each panel is actually drawn at in a shell `shellWidth` px wide. The stored layout is never
 * rewritten here: a narrow leaf shrinks the panels, and widening it again gives the stored widths
 * back. Expanded panels shrink in proportion; a strip never shrinks.
 */
export function effectivePanelWidths(layout: PanelLayout, shellWidth: number): Readonly<Record<PanelSide, number>> {
	const available = shellWidth - CANVAS_FLOOR_PX;
	const wanted = demand(layout.layers) + demand(layout.inspector);
	if (wanted <= available) return { layers: demand(layout.layers), inspector: demand(layout.inspector) };
	const strips = wanted - (layout.layers.collapsed ? 0 : layout.layers.width) - (layout.inspector.collapsed ? 0 : layout.inspector.width);
	const expanded = wanted - strips;
	const scale = expanded === 0 ? 0 : Math.max(0, available - strips) / expanded;
	const width = (state: PanelState): number => (state.collapsed ? STRIP_PX : Math.floor(state.width * scale));
	return { layers: width(layout.layers), inspector: width(layout.inspector) };
}

/** The widest `side` may be dragged to in this shell, with the other panel as it stands. */
export function maxPanelWidth(side: PanelSide, layout: PanelLayout, shellWidth: number): number {
	const other = side === 'layers' ? layout.inspector : layout.layers;
	const { min, max } = PANEL_BOUNDS[side];
	return Math.max(min, Math.min(max, Math.floor(shellWidth - CANVAS_FLOOR_PX - demand(other))));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/shell/panelLayout.test.ts`
Expected: PASS. If the 900px case disagrees by one pixel, recompute by hand (580 × 256/608 = 244.2, 580 × 352/608 = 335.8) before touching the implementation.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/shell/panelLayout.ts tests/presentation/editor/shell/panelLayout.test.ts
git commit -m "feat(editor): side panel layout bounds, parsing and canvas floor"
```

---

### Task 2: `WorkspaceStore` panel state

**Files:**
- Modify: `src/presentation/stores/WorkspaceStore.ts`
- Test: `tests/presentation/stores/workspacePanelLayout.test.ts` (new file — `stores.test.ts` is near its 450-line cap)

**Interfaces:**
- Consumes: Task 1's `PanelLayout`, `PanelSide`, `PanelState`, `defaultPanelLayout`, `clampPanelWidth`.
- Produces on `useWorkspaceStore()`: `panelLayout: Ref<PanelLayout>`, `setPanel(side: PanelSide, patch: Partial<PanelState>): void`, `restorePanelLayout(layout: PanelLayout): void`; `reset()` restores the default layout.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * `WorkspaceStore`'s side-panel layout (2026-09-12 side panels spec §1). Node: a store is plain
 * reactive state.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { defaultPanelLayout } from '../../../src/presentation/editor/shell/panelLayout';

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('WorkspaceStore, the side panel layout', () => {
	it('opens at the default layout', () => {
		expect(useWorkspaceStore().panelLayout).toEqual(defaultPanelLayout());
	});

	it('patches one side, clamping its width, and replaces the record', () => {
		const workspace = useWorkspaceStore();
		const before = workspace.panelLayout;
		workspace.setPanel('layers', { width: 9999 });
		workspace.setPanel('inspector', { collapsed: true });
		expect(workspace.panelLayout).toEqual({
			layers: { width: 400, collapsed: false },
			inspector: { width: 352, collapsed: true },
		});
		expect(workspace.panelLayout).not.toBe(before);
	});

	it('restores a whole layout and resets to the defaults', () => {
		const workspace = useWorkspaceStore();
		workspace.restorePanelLayout({ layers: { width: 300, collapsed: true }, inspector: { width: 500, collapsed: false } });
		expect(workspace.panelLayout.layers).toEqual({ width: 300, collapsed: true });
		workspace.reset();
		expect(workspace.panelLayout).toEqual(defaultPanelLayout());
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run check:fast -- tests/presentation/stores/workspacePanelLayout.test.ts`
Expected: FAIL — `panelLayout` is undefined.

- [ ] **Step 3: Implement**

In `WorkspaceStore.ts`, add the import:

```ts
import { clampPanelWidth, defaultPanelLayout, type PanelLayout, type PanelSide, type PanelState } from '../editor/shell/panelLayout';
```

Replace the docblock paragraph that starts `**Which FULL-mode panels are open is deliberately not here**` with:

```ts
 * **The full-mode side panels' widths and collapsed state ARE here** (2026-09-12 side panels
 * spec), and they are the one thing in this store that outlives the leaf: `ResponsiveEditorShell`
 * restores them from per-device storage on mount and writes them back on every committed change.
 * The store itself still reaches no repository. The View menu owns grid visibility and automatic
 * object snapping; neither changes the floor or a saved record. Each leaf has its own Pinia scope.
```

After `const notesVisible = ref(true);` add:

```ts
	/** Both side panels in the full layout — see `panelLayout.ts`. Replaced, never mutated. */
	const panelLayout = ref<PanelLayout>(defaultPanelLayout());

	function setPanel(side: PanelSide, patch: Partial<PanelState>): void {
		const next = { ...panelLayout.value[side], ...patch };
		panelLayout.value = { ...panelLayout.value, [side]: { width: clampPanelWidth(side, next.width), collapsed: next.collapsed } };
	}

	function restorePanelLayout(layout: PanelLayout): void {
		panelLayout.value = layout;
	}
```

In `reset()` add `panelLayout.value = defaultPanelLayout();`, and add `panelLayout, setPanel, restorePanelLayout,` to the returned object.

- [ ] **Step 4: Run tests**

Run: `npm run check:fast -- tests/presentation/stores`
Expected: PASS, including the existing `stores.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/stores/WorkspaceStore.ts tests/presentation/stores/workspacePanelLayout.test.ts
git commit -m "feat(editor): side panel layout state in WorkspaceStore"
```

---

### Task 3: Per-device storage and its wiring

**Files:**
- Create: `src/infrastructure/obsidian/plugin-data/deviceLocalStore.ts`
- Create: `tests/infrastructure/obsidian/plugin-data/deviceLocalStore.test.ts`
- Create: `tests/helpers/deviceStorage.ts`
- Modify: `src/presentation/editor/PlanEditorContext.ts`, `src/presentation/views/PlanEditorView.ts`, `src/plugin/planEditorDeps.ts`, `src/plugin/RenovationPlannerPlugin.ts`
- Modify (add the new member or argument): `tests/helpers/editor.ts`, `tests/harness/fixture.ts`, `tests/harness/planEditor.ts`, `tests/harness/downstreamWorkspace.ts`, `tests/presentation/views/planEditorView.test.ts`, `tests/presentation/views/planEditorReopen.test.ts`, `tests/presentation/views/planEditorHostReturn.test.ts`, `tests/plugin/guardedGroups.test.ts`, `tests/plugin/guardCategory.test.ts`, `tests/plugin/planEditorWiring.test.ts`, `tests/plugin/guardWiring.test.ts`, `tests/plugin/persistence-wiring.test.ts`

**Interfaces:**
- Produces:
  - In `PlanEditorContext.ts`: `export interface DeviceStorage { read(): unknown; write(value: unknown): void }`; `PlanEditorContext.panelLayout: DeviceStorage` (required).
  - `PlanEditorDeps.panelLayout: DeviceStorage` (required).
  - `planEditorDeps(root, workspace, vault, clipboard, panelLayout: DeviceStorage): PlanEditorDeps`.
  - `class DeviceLocalStore { constructor(adapter: LocalStorageAdapter, key: string, logger: Logger); read(): unknown; write(value: unknown): void }`.
  - Test helper `memoryDeviceStorage(initial?: unknown): DeviceStorage & { readonly writes: unknown[] }`.
  - `EditorHarnessOptions.panelLayout?: DeviceStorage`.

- [ ] **Step 1: Write the failing store test**

`tests/infrastructure/obsidian/plugin-data/deviceLocalStore.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DeviceLocalStore } from '../../../../src/infrastructure/obsidian/plugin-data/deviceLocalStore';
import type { LocalStorageAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { recorder as logger } from '../../../helpers/logger';

const KEY = 'renovation-planner:panel-layout';

function fakeAdapter(): LocalStorageAdapter {
	const entries = new Map<string, unknown>();
	return {
		loadLocalStorage: (key) => entries.get(key) ?? null,
		saveLocalStorage: (key, data) => { entries.set(key, data); },
	};
}

describe('DeviceLocalStore', () => {
	it('answers null for nothing stored, then what was written', () => {
		const store = new DeviceLocalStore(fakeAdapter(), KEY, logger);
		expect(store.read()).toBeNull();
		store.write({ layers: { width: 300, collapsed: true } });
		expect(store.read()).toEqual({ layers: { width: 300, collapsed: true } });
	});

	it('answers null and warns when the host read throws', () => {
		const spy = vi.spyOn(logger, 'warn');
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => { throw new Error('blocked'); },
			saveLocalStorage: () => undefined,
		};
		expect(new DeviceLocalStore(adapter, KEY, logger).read()).toBeNull();
		expect(spy).toHaveBeenCalledWith('device-local-store.read-failed', expect.objectContaining({ key: KEY, cause: expect.any(Error) }));
		spy.mockRestore();
	});

	it('warns rather than throwing when the host write throws', () => {
		const spy = vi.spyOn(logger, 'warn');
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => null,
			saveLocalStorage: () => { throw new Error('quota exceeded'); },
		};
		expect(() => new DeviceLocalStore(adapter, KEY, logger).write({})).not.toThrow();
		expect(spy).toHaveBeenCalledWith('device-local-store.write-failed', expect.objectContaining({ key: KEY, cause: expect.any(Error) }));
		spy.mockRestore();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/infrastructure/obsidian/plugin-data/deviceLocalStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

`src/infrastructure/obsidian/plugin-data/deviceLocalStore.ts`:

```ts
import type { Logger } from '../../../application/ports/Logger';
import type { LocalStorageAdapter } from './continueContextStore';

/**
 * One per-device JSON slot over Obsidian's `App.loadLocalStorage`/`saveLocalStorage` — the surface
 * `ContinueContextStore` uses, for its reasons: not a note (opening an editor must not dirty the
 * vault), not `data.json` (`settingsFrom` drops keys it does not declare), not a file under
 * `.obsidian/` (Sync may carry it to a device with a different screen).
 *
 * It answers `unknown` and parses nothing. The shape belongs to the caller
 * (`presentation/editor/shell/panelLayout.ts`), and this layer may not import it, so the trust
 * boundary sits beside the type rather than here. Both doors swallow and warn, for
 * `ContinueContextStore`'s own "no door ever rejects" reason: a layout that failed to persist costs
 * the user a remembered width, never an error.
 */
export class DeviceLocalStore {
	constructor(
		private readonly adapter: LocalStorageAdapter,
		private readonly key: string,
		private readonly logger: Logger,
	) {}

	read(): unknown {
		try {
			return this.adapter.loadLocalStorage(this.key);
		} catch (cause) {
			this.logger.warn('device-local-store.read-failed', { key: this.key, cause });
			return null;
		}
	}

	write(value: unknown): void {
		try {
			this.adapter.saveLocalStorage(this.key, value);
		} catch (cause) {
			this.logger.warn('device-local-store.write-failed', { key: this.key, cause });
		}
	}
}
```

If the `Logger.warn` context type rejects `key`, drop `key` from both the call and the test assertion rather than casting.

- [ ] **Step 4: Run the store test**

Run: `npm run check:fast -- tests/infrastructure/obsidian/plugin-data/deviceLocalStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the port and thread it through**

`PlanEditorContext.ts` — above `export interface PlanEditorContext`:

```ts
/**
 * A per-device JSON slot (2026-09-12 side panels spec §1): `read` answers whatever was stored, or
 * `null` for nothing, and `write` never throws. Declared here, where it is consumed, because the
 * producer is in `infrastructure/` and presentation may not import it; the plugin hands in a
 * `DeviceLocalStore`, which satisfies this structurally.
 */
export interface DeviceStorage {
	read(): unknown;
	write(value: unknown): void;
}
```

Inside `PlanEditorContext`, after `clipboard`:

```ts
	/** Where the side panels' widths and collapsed state live — per device, shared by every leaf. */
	readonly panelLayout: DeviceStorage;
```

`PlanEditorView.ts`: import `type DeviceStorage` from `'../editor/PlanEditorContext'` (extend the existing import); in `PlanEditorDeps` after `clipboard` add

```ts
	/** The side panels' per-device layout slot. Required, for `clipboard`'s reason. */
	readonly panelLayout: DeviceStorage;
```

and in `mount()`'s `context` literal after `clipboard: this.deps.clipboard,` add `panelLayout: this.deps.panelLayout,`.

`planEditorDeps.ts`: import `type DeviceStorage` from `'../presentation/editor/PlanEditorContext'`; add a fifth parameter `panelLayout: DeviceStorage` after `clipboard`; add `panelLayout,` after `clipboard,` in the returned object.

`RenovationPlannerPlugin.ts`: add imports

```ts
import { DeviceLocalStore } from '../infrastructure/obsidian/plugin-data/deviceLocalStore';
import type { DeviceStorage } from '../presentation/editor/PlanEditorContext';
```

Change `planEditorViewDeps()` to

```ts
		return planEditorDeps(this.root, this.app.workspace, this.app.vault, this.editorClipboard, this.panelLayoutStorage(this.root.logger));
```

and beside `continueContextStore(...)` add

```ts
	/**
	 * The Plan editor's side panel layout (2026-09-12 side panels spec) — one slot per device, for
	 * every editor leaf, namespaced by `manifest.id` for the collision `continueStore` names. Typed as
	 * the presentation port so fallow resolves `read`/`write` through the annotation.
	 */
	private panelLayoutStore: DeviceStorage | null = null;

	private panelLayoutStorage(logger: Logger): DeviceStorage {
		this.panelLayoutStore ??= new DeviceLocalStore(this.app, `${this.manifest.id}:panel-layout`, logger);
		return this.panelLayoutStore;
	}
```

- [ ] **Step 6: The test helper and every construction site**

`tests/helpers/deviceStorage.ts`:

```ts
import type { DeviceStorage } from '../../src/presentation/editor/PlanEditorContext';

/** An in-memory `DeviceStorage`: what was written is what is read, and every write is recorded. */
export function memoryDeviceStorage(initial: unknown = null): DeviceStorage & { readonly writes: unknown[] } {
	let stored = initial;
	const writes: unknown[] = [];
	return {
		read: () => stored,
		write: (value) => {
			stored = value;
			writes.push(value);
		},
		writes,
	};
}
```

Then:
- `tests/helpers/editor.ts`: add `readonly panelLayout?: DeviceStorage;` to `EditorHarnessOptions` (import `type DeviceStorage` beside `PlanEditorContext`), and `panelLayout: options.panelLayout ?? memoryDeviceStorage(),` after `clipboard:` in the context literal.
- `tests/harness/fixture.ts:211`: add `panelLayout: deps.panelLayout,` after `clipboard: deps.clipboard,`.
- `tests/harness/planEditor.ts` (`harnessDeps`, near line 408), `tests/presentation/views/planEditorView.test.ts:64`, `tests/presentation/views/planEditorReopen.test.ts:99`: add `panelLayout: memoryDeviceStorage(),` after `clipboard: createEditorClipboard(),`.
- Every `planEditorDeps(…, createEditorClipboard())` call (`tests/plugin/guardedGroups.test.ts`, `guardCategory.test.ts`, `planEditorWiring.test.ts` ×8, `guardWiring.test.ts`, `persistence-wiring.test.ts`, `tests/harness/downstreamWorkspace.ts`, `tests/presentation/views/planEditorHostReturn.test.ts`): add `, memoryDeviceStorage()` as the fifth argument. List them with `rg -n "createEditorClipboard\(\)\)" tests` and add the import to each file.
- `referenceWorkspace.ts` and `areaNumericWorkspace.ts` spread `...base`, so they need nothing.

- [ ] **Step 7: Add the wiring case**

In `tests/plugin/planEditorWiring.test.ts`, inside its top-level `describe`, add:

```ts
	it('hands the view the per-device panel layout slot it was given', () => {
		const storage = memoryDeviceStorage();
		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault, createEditorClipboard(), storage);
		expect(deps.panelLayout).toBe(storage);
	});
```

(`root` is whatever the neighbouring cases use at lines 78-109; copy their setup exactly.)

- [ ] **Step 8: Type-check and run the touched suites**

Run: `npm run check:fast -- tests/plugin tests/presentation/views tests/infrastructure/obsidian/plugin-data`
Expected: PASS, and `vue-tsc` reports no missing `panelLayout`. Any remaining type error names a construction site this list missed; add the member there.

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/obsidian/plugin-data/deviceLocalStore.ts src/presentation/editor/PlanEditorContext.ts src/presentation/views/PlanEditorView.ts src/plugin/planEditorDeps.ts src/plugin/RenovationPlannerPlugin.ts tests
git commit -m "feat(editor): per-device storage slot for the side panel layout"
```

---

### Task 4: Strings, strip sections and `PanelResizer.vue`

**Files:**
- Create: `src/presentation/editor/shell/panelSections.ts`
- Create: `src/presentation/editor/shell/PanelResizer.vue`
- Modify: `src/presentation/i18n/locales/en/editorShell.ts`, `src/presentation/i18n/locales/de/editorShell.ts`
- Test: `tests/presentation/editor/shell/panelResizer.test.ts`

**Interfaces:**
- Consumes: Task 1's `PanelSide`.
- Produces:
  - Keys `editor.panel.collapse-layers`, `editor.panel.expand-layers`, `editor.panel.resize-layers`, `editor.panel.collapse-inspector`, `editor.panel.expand-inspector`, `editor.panel.resize-inspector`.
  - `interface PanelSectionEntry { readonly key: string; readonly icon: IconName; readonly labelKey: StringKey }`
  - `const PANEL_SECTIONS: Readonly<Record<PanelSide, readonly PanelSectionEntry[]>>`
  - `const PANEL_COPY: Readonly<Record<PanelSide, { readonly title: StringKey; readonly collapse: StringKey; readonly expand: StringKey; readonly resize: StringKey }>>`
  - `PanelResizer.vue` props `{ side: PanelSide; width: number; min: number; max: number; controls: string }`, emits `{ resize: [width: number]; commit: []; reset: []; collapse: [] }`, root `div[role="separator"][data-rp-resizer=<side>]`.

- [ ] **Step 1: Add the strings**

`en/editorShell.ts`, before `} as const;`:

```ts
	// The full layout's side panels (2026-09-12 side panels spec §1). The panel names follow
	// `editor.property-panel` and `editor.rail.details`, so a screen reader hears one name per panel.
	'editor.panel.collapse-layers': 'Collapse property and layers',
	'editor.panel.expand-layers': 'Expand property and layers',
	'editor.panel.resize-layers': 'Resize property and layers',
	'editor.panel.collapse-inspector': 'Collapse details',
	'editor.panel.expand-inspector': 'Expand details',
	'editor.panel.resize-inspector': 'Resize details',
```

`de/editorShell.ts`, before `};`:

```ts
	'editor.panel.collapse-layers': 'Grundstück und Ebenen einklappen',
	'editor.panel.expand-layers': 'Grundstück und Ebenen ausklappen',
	'editor.panel.resize-layers': 'Breite von Grundstück und Ebenen ändern',
	'editor.panel.collapse-inspector': 'Details einklappen',
	'editor.panel.expand-inspector': 'Details ausklappen',
	'editor.panel.resize-inspector': 'Breite der Details ändern',
```

- [ ] **Step 2: `panelSections.ts`**

```ts
import type { IconName } from 'obsidian';
import type { StringKey } from '../../i18n/locales/en';
import type { PanelSide } from './panelLayout';

/** One button on a collapsed strip: the `PanelSection` it opens, its icon and its name. */
export interface PanelSectionEntry {
	readonly key: string;
	readonly icon: IconName;
	readonly labelKey: StringKey;
}

/**
 * What each collapsed strip offers, in panel order. A key is `PanelSection`'s `section` prop, so a
 * strip button finds its section as `[data-rp-section="<key>"]`; the Inspector has no sections of
 * its own, so its one button expands the panel and nothing more.
 */
export const PANEL_SECTIONS: Readonly<Record<PanelSide, readonly PanelSectionEntry[]>> = {
	layers: [
		{ key: 'context', icon: 'house', labelKey: 'editor.shell.property' },
		{ key: 'layers', icon: 'layers', labelKey: 'editor.rail.layers' },
		{ key: 'rooms', icon: 'grid-2x-2', labelKey: 'editor.selection.records' },
		{ key: 'elements', icon: 'brick-wall', labelKey: 'editor.structure.list' },
	],
	inspector: [{ key: 'details', icon: 'panels-top-left', labelKey: 'editor.rail.details' }],
};

/** Each panel's own names — its header title and its three controls. */
export const PANEL_COPY: Readonly<Record<PanelSide, { readonly title: StringKey; readonly collapse: StringKey; readonly expand: StringKey; readonly resize: StringKey }>> = {
	layers: {
		title: 'editor.property-panel',
		collapse: 'editor.panel.collapse-layers',
		expand: 'editor.panel.expand-layers',
		resize: 'editor.panel.resize-layers',
	},
	inspector: {
		title: 'editor.rail.details',
		collapse: 'editor.panel.collapse-inspector',
		expand: 'editor.panel.expand-inspector',
		resize: 'editor.panel.resize-inspector',
	},
};
```

- [ ] **Step 3: Write the failing resizer test**

`tests/presentation/editor/shell/panelResizer.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * `PanelResizer` on its own (2026-09-12 side panels spec §1): the WAI-ARIA window splitter. It
 * reports widths and commits; the store and storage are the shell's, driven in `sidePanels.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import PanelResizer from '../../../../src/presentation/editor/shell/PanelResizer.vue';
import { pointer } from '../../../helpers/planEditorRig';
import type { PanelSide } from '../../../../src/presentation/editor/shell/panelLayout';

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; });

function resizer(side: PanelSide, width = 256): VueWrapper {
	wrapper = mount(PanelResizer, { props: { side, width, min: 200, max: 400, controls: 'panel-body' } });
	return wrapper;
}

function emitted(name: string): unknown[][] {
	return (wrapper as VueWrapper).emitted(name) ?? [];
}

describe('PanelResizer', () => {
	it('is a named, focusable vertical separator carrying its value and bounds', () => {
		const el = resizer('layers').get('[role="separator"]');
		expect(el.attributes()).toMatchObject({
			tabindex: '0',
			'aria-orientation': 'vertical',
			'aria-controls': 'panel-body',
			'aria-valuenow': '256',
			'aria-valuemin': '200',
			'aria-valuemax': '400',
			'aria-label': 'Resize property and layers',
			'data-rp-resizer': 'layers',
		});
	});

	it.each([
		['layers', 'ArrowRight', false, 272],
		['layers', 'ArrowLeft', true, 200],
		['inspector', 'ArrowLeft', false, 272],
		['inspector', 'ArrowRight', true, 200],
		['layers', 'Home', false, 200],
		['layers', 'End', false, 400],
	] as const)('on %s, %s (shift %s) resizes to %i and commits', async (side, key, shiftKey, expected) => {
		await resizer(side).get('[role="separator"]').trigger('keydown', { key, shiftKey });
		expect(emitted('resize')).toEqual([[expected]]);
		expect(emitted('commit')).toHaveLength(1);
	});

	it('asks to collapse on Enter and ignores other keys', async () => {
		const el = resizer('layers').get('[role="separator"]');
		await el.trigger('keydown', { key: 'Enter' });
		await el.trigger('keydown', { key: 'a' });
		expect(emitted('collapse')).toHaveLength(1);
		expect(emitted('resize')).toHaveLength(0);
	});

	it('follows a primary drag live and commits once, on release', () => {
		const el = resizer('inspector', 352).get('[role="separator"]').element as HTMLElement;
		pointer(el, 'pointerdown', 500, 10);
		pointer(el, 'pointermove', 450, 10);
		pointer(el, 'pointermove', 480, 10);
		expect(emitted('resize')).toEqual([[400], [372]]);
		expect(emitted('commit')).toHaveLength(0);
		pointer(el, 'pointerup', 480, 10);
		pointer(el, 'pointermove', 400, 10);
		expect(emitted('commit')).toHaveLength(1);
		expect(emitted('resize')).toHaveLength(2);
	});

	it('ignores a non-primary press and a move from another pointer', () => {
		const el = resizer('layers').get('[role="separator"]').element as HTMLElement;
		pointer(el, 'pointerdown', 100, 10, 1);
		pointer(el, 'pointermove', 150, 10, 1);
		pointer(el, 'pointerdown', 100, 10, 0, 1);
		pointer(el, 'pointermove', 150, 10, 0, 2);
		pointer(el, 'pointercancel', 150, 10, 0, 2);
		expect(emitted('resize')).toHaveLength(0);
		pointer(el, 'pointercancel', 150, 10, 0, 1);
		expect(emitted('commit')).toHaveLength(1);
	});

	it('resets on double-click', async () => {
		await resizer('layers').get('[role="separator"]').trigger('dblclick');
		expect(emitted('reset')).toHaveLength(1);
	});
});
```

Read `pointer` in `tests/helpers/planEditorRig.ts:321` first: the calls above assume `(element, type, x, y, button = 0, pointerId = 1)` with `x` landing in `clientX`. If it builds `clientX` differently, adjust the coordinates, not the component.

- [ ] **Step 4: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/panelResizer.test.ts`
Expected: FAIL — cannot resolve `PanelResizer.vue`.

- [ ] **Step 5: Implement `PanelResizer.vue`**

```vue
<script setup lang="ts">
/**
 * A full-layout side panel's inner edge (2026-09-12 side panels spec §1): the WAI-ARIA window
 * splitter pattern. It owns the gesture and the keys and nothing else — the width lives in
 * `WorkspaceStore`, the shell clamps it against the canvas floor through `max`, and a `commit` is
 * the one moment anything is persisted. A drag reports every move and commits once on release, so
 * storage is never written per pointer move.
 */
import { tr } from '../../i18n/strings';
import { PANEL_COPY } from './panelSections';
import type { PanelSide } from './panelLayout';

const props = defineProps<{ side: PanelSide; width: number; min: number; max: number; controls: string }>();
const emit = defineEmits<{ resize: [width: number]; commit: []; reset: []; collapse: [] }>();

const STEP = 16;
const BIG_STEP = 64;
let drag: { readonly pointerId: number; readonly startX: number; readonly startWidth: number } | null = null;

/** The Inspector grows as its LEFT edge moves left, so its horizontal deltas are mirrored. */
function signed(delta: number): number {
	return props.side === 'layers' ? delta : -delta;
}

function clamp(width: number): number {
	return Math.min(props.max, Math.max(props.min, width));
}

function onPointerDown(event: PointerEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
	drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: props.width };
}

function onPointerMove(event: PointerEvent): void {
	if (drag?.pointerId !== event.pointerId) return;
	emit('resize', clamp(drag.startWidth + signed(event.clientX - drag.startX)));
}

function onPointerEnd(event: PointerEvent): void {
	if (drag?.pointerId !== event.pointerId) return;
	drag = null;
	emit('commit');
}

function keyWidth(event: KeyboardEvent): number | null {
	const step = event.shiftKey ? BIG_STEP : STEP;
	if (event.key === 'ArrowRight') return props.width + signed(step);
	if (event.key === 'ArrowLeft') return props.width - signed(step);
	if (event.key === 'Home') return props.min;
	if (event.key === 'End') return props.max;
	return null;
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		emit('collapse');
		return;
	}
	const next = keyWidth(event);
	if (next === null) return;
	event.preventDefault();
	emit('resize', clamp(next));
	emit('commit');
}
</script>

<template>
	<div
		class="rp-side-panel__resizer"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-controls="controls"
		:aria-label="tr(PANEL_COPY[side].resize)"
		:aria-valuenow="width"
		:aria-valuemin="min"
		:aria-valuemax="max"
		:data-rp-resizer="side"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerEnd"
		@pointercancel="onPointerEnd"
		@keydown="onKeydown"
		@dblclick="emit('reset')"
	/>
</template>
```

If coverage later reports `setPointerCapture?.` as an unpaid branch, keep it: jsdom lacks the method and a real browser has it, the same trade `EditorSurface.vue` makes.

- [ ] **Step 6: Run tests**

Run: `npm run check:fast -- tests/presentation/editor/shell/panelResizer.test.ts tests/presentation/i18n`
Expected: PASS (German covers every new key).

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell/panelSections.ts src/presentation/editor/shell/PanelResizer.vue src/presentation/i18n/locales/en/editorShell.ts src/presentation/i18n/locales/de/editorShell.ts tests/presentation/editor/shell/panelResizer.test.ts
git commit -m "feat(editor): window-splitter resize handle for side panels"
```

---

### Task 5: `EditorSidePanel`, the collapsed strip, and the shell

**Files:**
- Create: `src/presentation/editor/shell/PanelCollapsedStrip.vue`
- Create: `src/presentation/editor/shell/EditorSidePanel.vue`
- Delete: `src/presentation/editor/shell/OverlayPanel.vue`, `src/presentation/editor/shell/InspectorDrawer.vue`
- Modify: `src/presentation/editor/shell/ResponsiveEditorShell.vue`
- Test: `tests/presentation/editor/shell/sidePanels.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`panelLayout.ts`, `setPanel`/`restorePanelLayout`/`panelLayout`, `PlanEditorContext.panelLayout`, `PanelResizer`, `PANEL_SECTIONS`, `PANEL_COPY`).
- Produces (DOM contract later tasks and the harness rely on):
  - Full layout, expanded: root `div.rp-persistent-panel.rp-side-panel.rp-side-panel--<side>[data-rp-shell-region=<side>]` › `div.rp-side-panel__header` (`span.rp-side-panel__title`, `button.rp-side-panel__toggle[data-rp-panel-toggle=<side>][aria-expanded="true"]`) › `div.rp-side-panel__body#<id>` (the slot) › `PanelResizer`.
  - Full layout, collapsed: root also carries `.rp-side-panel--collapsed`; header, body and resizer are `v-show`-hidden; `div.rp-side-panel__strip[data-rp-strip=<side>]` holds `button.rp-side-panel__strip-button[data-rp-panel-toggle=<side>][aria-expanded="false"]` then one `button.rp-side-panel__strip-button[data-rp-strip-section=<key>]` per `PANEL_SECTIONS` entry.
  - Constrained: exactly today's `.rp-overlay-panel` / `.rp-inspector-drawer` root, `__close` button and `tabindex="-1"`; the slot sits inside `div.rp-side-panel__body`.
  - `.rp-editor-body` carries `--rp-layers-width` and `--rp-inspector-width` in px.

- [ ] **Step 1: Write the failing integration test**

`tests/presentation/editor/shell/sidePanels.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * The full layout's side panels (2026-09-12 side panels spec §1), driven through the REAL mounted
 * editor: collapse and expand with their focus moves, the strip's section buttons, the resize
 * handle wired to `WorkspaceStore` and per-device storage, the canvas floor, and M16's constrained
 * overlay left as it was.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditor, settle, type EditorHarness } from '../../../helpers/editor';
import { memoryDeviceStorage } from '../../../helpers/deviceStorage';
import { resizeTo } from '../../../helpers/layout';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';

let open: EditorHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

async function mounted(storage = memoryDeviceStorage()): Promise<{ harness: EditorHarness; storage: ReturnType<typeof memoryDeviceStorage> }> {
	open = await mountPlanEditor({ panelLayout: storage });
	return { harness: open, storage };
}

function lastWrite(storage: ReturnType<typeof memoryDeviceStorage>): unknown {
	return storage.writes[storage.writes.length - 1];
}

describe('full-layout side panels', () => {
	it('collapses from the header to a strip, hides the content and hands focus to the strip', async () => {
		const { harness, storage } = await mounted();
		const toggle = harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]');
		expect(toggle.attributes('aria-expanded')).toBe('true');
		(toggle.element as HTMLElement).focus();
		await toggle.trigger('click');
		await settle();

		expect(harness.wrapper.get('[data-rp-region="layers"]').isVisible()).toBe(false);
		const expand = harness.wrapper.get('[data-rp-strip="layers"] [data-rp-panel-toggle="layers"]');
		expect(expand.attributes('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(expand.element);
		expect(harness.wrapper.findAll('[data-rp-strip="layers"] [data-rp-strip-section]')).toHaveLength(4);
		expect(lastWrite(storage)).toMatchObject({ layers: { collapsed: true } });
	});

	it('expands from the strip back to the header toggle', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();
		await harness.wrapper.get('[data-rp-strip="inspector"] [data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();

		expect(harness.wrapper.get('[data-rp-region="inspector"]').isVisible()).toBe(true);
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').element);
	});

	it('expands to the header toggle from a section button whose section does not exist yet', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();
		await harness.wrapper.get('[data-rp-strip-section="details"]').trigger('click');
		await settle();
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').element);
	});

	it('leaves focus where it was when the collapse click came from outside the panel', async () => {
		const { harness } = await mounted();
		(document.body as HTMLElement).focus();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		expect(document.activeElement).toBe(document.body);
	});

	it('resizes from the keyboard into the store and storage, and resets on double-click', async () => {
		const { harness, storage } = await mounted();
		const handle = harness.wrapper.get('[data-rp-resizer="layers"]');
		await handle.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
		await settle();

		expect(useWorkspaceStore(harness.pinia).panelLayout.layers.width).toBe(320);
		expect(handle.attributes('aria-valuenow')).toBe('320');
		expect(lastWrite(storage)).toMatchObject({ layers: { width: 320, collapsed: false } });

		await handle.trigger('dblclick');
		await settle();
		expect(handle.attributes('aria-valuenow')).toBe('256');
		expect(lastWrite(storage)).toMatchObject({ layers: { width: 256 } });
	});

	it('collapses from the resize handle with Enter', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('[data-rp-resizer="inspector"]').trigger('keydown', { key: 'Enter' });
		await settle();
		expect(harness.wrapper.find('[data-rp-strip="inspector"]').exists()).toBe(true);
	});

	it('mounts at a stored layout, and at the defaults over a malformed one', async () => {
		const stored = memoryDeviceStorage({ layers: { width: 300, collapsed: false }, inspector: { width: 400, collapsed: true } });
		const { harness } = await mounted(stored);
		expect(harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('300');
		expect(harness.wrapper.find('[data-rp-strip="inspector"]').exists()).toBe(true);
		harness.unmount();
		open = null;

		const garbage = await mounted(memoryDeviceStorage('wide'));
		expect(garbage.harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('256');
	});

	it('shrinks the panels to keep the canvas floor without rewriting the stored widths', async () => {
		const { harness, storage } = await mounted();
		resizeTo(harness.rootEl, 900, 800);
		await settle();

		expect(harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('244');
		expect(harness.wrapper.get('[data-rp-resizer="inspector"]').attributes('aria-valuenow')).toBe('335');
		expect(useWorkspaceStore(harness.pinia).panelLayout.layers.width).toBe(256);
		expect(storage.writes).toHaveLength(0);
	});

	it('leaves the constrained overlay usable for a panel collapsed in the full layout', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		resizeTo(harness.rootEl, 460, 800);
		await settle();

		expect(harness.wrapper.find('.rp-side-panel__strip').exists()).toBe(false);
		await harness.wrapper.get('button[data-rp-rail="layers"]').trigger('click');
		await settle();
		expect(harness.wrapper.get('.rp-overlay-panel .rp-layer-list').isVisible()).toBe(true);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/sidePanels.test.ts`
Expected: FAIL — `.rp-side-panel__toggle` not found.

- [ ] **Step 3: `PanelCollapsedStrip.vue`**

```vue
<script setup lang="ts">
/**
 * A collapsed full-layout side panel (2026-09-12 side panels spec §1): an expand button, then one
 * button per `PANEL_SECTIONS` entry. It emits which section was asked for — `null` for the expand
 * button — and `EditorSidePanel` does the expanding and the focus move, because only it can see
 * the section once it is drawn again.
 */
import { ref } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { PANEL_COPY, PANEL_SECTIONS } from './panelSections';
import type { PanelSide } from './panelLayout';

defineProps<{ side: PanelSide; controls: string }>();
const emit = defineEmits<{ expand: [section: string | null] }>();
const expandButton = ref<HTMLButtonElement | null>(null);

defineExpose({ focusExpand: (): void => (expandButton.value as HTMLButtonElement).focus() });
</script>

<template>
	<div
		class="rp-side-panel__strip"
		:data-rp-strip="side"
	>
		<button
			ref="expandButton"
			type="button"
			class="rp-side-panel__strip-button"
			:data-rp-panel-toggle="side"
			aria-expanded="false"
			:aria-controls="controls"
			:aria-label="tr(PANEL_COPY[side].expand)"
			:title="tr(PANEL_COPY[side].expand)"
			@click="emit('expand', null)"
		>
			<HostIcon :name="side === 'layers' ? 'chevron-right' : 'chevron-left'" />
		</button>
		<button
			v-for="section in PANEL_SECTIONS[side]"
			:key="section.key"
			type="button"
			class="rp-side-panel__strip-button"
			:data-rp-strip-section="section.key"
			:aria-label="tr(section.labelKey)"
			:title="tr(section.labelKey)"
			@click="emit('expand', section.key)"
		>
			<HostIcon :name="section.icon" />
		</button>
	</div>
</template>
```

- [ ] **Step 4: `EditorSidePanel.vue`**

```vue
<script setup lang="ts">
/**
 * One side panel — Property and layers, or the Inspector — in both layouts the shell draws panels
 * in (2026-09-12 side panels spec §1). It replaces `OverlayPanel` and `InspectorDrawer`, which were
 * the same component twice.
 *
 * FULL: a header with the collapse button, the panel content, and `PanelResizer` on the inner edge;
 * collapsed, `PanelCollapsedStrip`. CONSTRAINED: M16's overlay or drawer exactly as before — its
 * class names, close button and `tabindex="-1"` are what `responsiveShell.test.ts` and
 * `persistentRegions.test.ts` pin.
 *
 * The slot is `v-show`n and never unmounted, for the reason the two replaced components gave: a
 * native input keeps its identity, and a pending field edit is not committed by a blur the user
 * did not make. Every state change is EMITTED; the shell owns the store and storage.
 */
import { nextTick, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import PanelResizer from './PanelResizer.vue';
import PanelCollapsedStrip from './PanelCollapsedStrip.vue';
import { PANEL_COPY } from './panelSections';
import type { PanelSide } from './panelLayout';

const props = defineProps<{
	side: PanelSide;
	/** The shell is in its full layout, where the header, handle and strip exist at all. */
	full: boolean;
	/** The shell is constrained and this panel is its open overlay. */
	floating: boolean;
	collapsed: boolean;
	width: number;
	min: number;
	max: number;
}>();
const emit = defineEmits<{ close: []; toggle: []; resize: [width: number]; commit: []; reset: [] }>();

const bodyId = useId();
const root = ref<HTMLElement | null>(null);
const collapseButton = ref<HTMLButtonElement | null>(null);
const strip = ref<InstanceType<typeof PanelCollapsedStrip> | null>(null);

const OVERLAY_CLASS: Readonly<Record<PanelSide, string>> = { layers: 'rp-overlay-panel', inspector: 'rp-inspector-drawer' };

/** Collapsing removes the control that had focus, so focus follows to the strip — only if it was ours. */
async function collapse(): Promise<void> {
	const element = root.value as HTMLElement;
	const owned = element.contains(element.ownerDocument.activeElement);
	emit('toggle');
	await nextTick();
	if (owned) (strip.value as InstanceType<typeof PanelCollapsedStrip>).focusExpand();
}

/** Expanding lands on the section the strip named, opened, or on the header's collapse button. */
async function expand(section: string | null): Promise<void> {
	emit('toggle');
	await nextTick();
	const details = section === null ? null : (root.value as HTMLElement).querySelector<HTMLDetailsElement>(`[data-rp-section="${section}"]`);
	if (details === null) {
		(collapseButton.value as HTMLButtonElement).focus();
		return;
	}
	details.open = true;
	(details.querySelector('summary') as HTMLElement).focus();
}
</script>

<template>
	<div
		ref="root"
		:class="floating
			? OVERLAY_CLASS[side]
			: ['rp-persistent-panel', 'rp-side-panel', `rp-side-panel--${side}`, { 'rp-side-panel--collapsed': full && collapsed }]"
		:tabindex="floating ? -1 : undefined"
	>
		<button
			v-if="floating"
			type="button"
			:class="`${OVERLAY_CLASS[side]}__close`"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<div
			v-if="full && !floating"
			v-show="!collapsed"
			class="rp-side-panel__header"
		>
			<span class="rp-side-panel__title">{{ tr(PANEL_COPY[side].title) }}</span>
			<button
				ref="collapseButton"
				type="button"
				class="rp-side-panel__toggle"
				:data-rp-panel-toggle="side"
				aria-expanded="true"
				:aria-controls="bodyId"
				:aria-label="tr(PANEL_COPY[side].collapse)"
				:title="tr(PANEL_COPY[side].collapse)"
				@click="collapse"
			>
				<HostIcon :name="side === 'layers' ? 'chevron-left' : 'chevron-right'" />
			</button>
		</div>
		<div
			:id="bodyId"
			v-show="!(full && collapsed)"
			class="rp-side-panel__body"
		>
			<slot />
		</div>
		<PanelResizer
			v-if="full && !floating"
			v-show="!collapsed"
			:side="side"
			:width="width"
			:min="min"
			:max="max"
			:controls="bodyId"
			@resize="emit('resize', $event)"
			@commit="emit('commit')"
			@reset="emit('reset')"
			@collapse="collapse"
		/>
		<PanelCollapsedStrip
			v-if="full && collapsed"
			ref="strip"
			:side="side"
			:controls="bodyId"
			@expand="expand"
		/>
	</div>
</template>
```

`full && !floating` is always true together in practice (floating implies constrained); the double guard keeps a future caller from drawing a header inside an overlay. If fallow's template complexity or coverage objects to the unreachable half, drop `&& !floating` from all three and keep `full`.

- [ ] **Step 5: Wire the shell**

In `ResponsiveEditorShell.vue`:

Replace the `InspectorDrawer`/`OverlayPanel` imports with

```ts
import EditorSidePanel from './EditorSidePanel.vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import { PANEL_BOUNDS, effectivePanelWidths, maxPanelWidth, parsePanelLayout, type PanelSide } from './panelLayout';
```

and `computed` into the `vue` import. After `const workspace = useWorkspaceStore();`:

```ts
const context = usePlanEditorContext();
const { layoutMode, overlay, panelLayout } = storeToRefs(workspace);
const shellWidth = ref(0);
// Restored once, before the first render, so a leaf never draws the defaults for a frame first.
workspace.restorePanelLayout(parsePanelLayout(context.panelLayout.read()));
```

(remove the old `storeToRefs` line). At the top of `measure()`, after `const element = …`, add `shellWidth.value = element.clientWidth;` BEFORE the early return, and compute `next` from `shellWidth.value`.

Add below `measure()`:

```ts
/** What each panel is drawn at — `panelLayout.ts` keeps the canvas floor without touching the stored widths. */
const widths = computed(() => effectivePanelWidths(panelLayout.value, shellWidth.value));
const bodyStyle = computed(() => ({
	'--rp-layers-width': `${widths.value.layers}px`,
	'--rp-inspector-width': `${widths.value.inspector}px`,
}));

/** Every binding a side panel takes, in one place so the template stays flat. */
function panelProps(side: PanelSide) {
	return {
		side,
		full: layoutMode.value === 'full',
		floating: layoutMode.value === 'constrained' && overlay.value === side,
		collapsed: panelLayout.value[side].collapsed,
		width: widths.value[side],
		min: PANEL_BOUNDS[side].min,
		max: maxPanelWidth(side, panelLayout.value, shellWidth.value),
	};
}

function persist(): void {
	context.panelLayout.write(panelLayout.value);
}

function togglePanel(side: PanelSide): void {
	workspace.setPanel(side, { collapsed: !panelLayout.value[side].collapsed });
	persist();
}

function resetPanel(side: PanelSide): void {
	workspace.setPanel(side, { width: PANEL_BOUNDS[side].initial });
	persist();
}
```

Replace the two panel elements in the template with:

```vue
			<EditorSidePanel
				v-show="layoutMode === 'full' || (layoutMode === 'constrained' && overlay === 'layers')"
				v-bind="panelProps('layers')"
				data-rp-shell-region="layers"
				@close="closeOverlay('layers')"
				@keydown.esc="escapeOverlay($event, 'layers')"
				@toggle="togglePanel('layers')"
				@resize="workspace.setPanel('layers', { width: $event })"
				@commit="persist"
				@reset="resetPanel('layers')"
			>
				<slot name="panel" />
			</EditorSidePanel>
```

and the same for `inspector` with `<slot name="inspector" />`, keeping each in its current position. Bind `:style="bodyStyle"` on `div.rp-editor-body`.

Update the file's header comment to: `One mounted outlet per region. In the full layout each side panel resizes and collapses (EditorSidePanel, 2026-09-12); constrained columns become modeless overlays through CSS, without replacing native controls or committing pending text through an incidental blur. The canvas alone unmounts below the supported width, releasing its pointer gesture.`

- [ ] **Step 6: Delete the replaced components**

```bash
git rm src/presentation/editor/shell/OverlayPanel.vue src/presentation/editor/shell/InspectorDrawer.vue
```

Update prose references with `rg -n "OverlayPanel|InspectorDrawer" src tests` — comments in `tests/harness/accessibility.test.ts:661,694` and `accessibilityTrustPath.test.ts:107` now name `EditorSidePanel`. The CSS classes `.rp-overlay-panel`/`.rp-inspector-drawer` are unchanged and stay referenced.

- [ ] **Step 7: Run the shell suites**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/harness/harnessSurfaces.test.ts tests/presentation/editor/multiSelectionInspector.test.ts tests/presentation/editor/referenceWorkflow.e2e.test.ts`
Expected: PASS, including the unchanged `responsiveShell`, `persistentRegions`, `repeatedRailActivation`, `shell`, `sidebarSections`.

If `resizes from the keyboard` fails because `PlanEditorRoot.onRootKeydown` or a history shortcut consumed the key, stop propagation in `PanelResizer.onKeydown` for the handled keys only and re-run.

- [ ] **Step 8: Commit**

```bash
git add -A src/presentation/editor/shell tests/presentation/editor/shell/sidePanels.test.ts tests/harness
git commit -m "feat(editor): collapsible, resizable side panels in the full layout"
```

---

### Task 6: `PanelSection` and the section header style

**Files:**
- Create: `src/presentation/editor/shell/PanelSection.vue`
- Create: `styles/editor-side-panel.css`
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`, `styles/index.css`, `styles/editor-shell-fidelity.css`
- Test: `tests/presentation/editor/shell/sidePanels.test.ts` (add a case)

**Interfaces:**
- Consumes: Task 5's strip (`[data-rp-strip-section]`) and `EditorSidePanel.expand`, which queries `[data-rp-section="<key>"]`.
- Produces: `PanelSection.vue` props `{ section: string; title: string; open?: boolean }`; root `details.rp-sidebar-section.rp-property-<section>[data-rp-section=<section>]` › `summary.rp-sidebar-section__summary` (`span` title, `HostIcon.rp-sidebar-section__chevron`) › slot. The class `rp-sidebar-section__chevron` is also used on the Reference options summary.

- [ ] **Step 1: Add the failing case**

Append inside `describe('full-layout side panels', …)` in `sidePanels.test.ts`:

```ts
	it('opens exactly the section a strip button names and focuses its summary', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		expect(harness.wrapper.get('.rp-property-elements').attributes('open')).toBeUndefined();

		await harness.wrapper.get('[data-rp-strip-section="elements"]').trigger('click');
		await settle();

		const elements = harness.wrapper.get('[data-rp-section="elements"]');
		expect(elements.attributes('open')).toBeDefined();
		expect(harness.wrapper.get('.rp-property-context').attributes('open')).toBeDefined();
		expect(document.activeElement).toBe(elements.get('summary').element);
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/sidePanels.test.ts -t "opens exactly the section"`
Expected: FAIL — `[data-rp-section="elements"]` not found; focus is on the header toggle.

- [ ] **Step 3: `PanelSection.vue`**

```vue
<script setup lang="ts">
/**
 * One collapsible sidebar section (2026-09-12 side panels spec §2): a `<details>` whose summary is
 * the heading, with the chevron as a host icon rather than a CSS-border shape. `data-rp-section` is
 * what a collapsed strip's section button opens. `open` is the DEFAULT only — the sidebar polish
 * spec's rule that which sections are open is not persisted, kept.
 */
import HostIcon from '../../components/HostIcon.vue';

defineProps<{ section: string; title: string; open?: boolean }>();
</script>

<template>
	<details
		class="rp-sidebar-section"
		:class="`rp-property-${section}`"
		:data-rp-section="section"
		:open="open"
	>
		<summary class="rp-sidebar-section__summary">
			<span>{{ title }}</span>
			<HostIcon
				name="chevron-down"
				class="rp-sidebar-section__chevron"
			/>
		</summary>
		<slot />
	</details>
</template>
```

- [ ] **Step 4: Use it in `PropertyLayerPanel.vue`**

Import `PanelSection` and `HostIcon` (`'../../components/HostIcon.vue'`). Replace the four top-level `<details>` blocks with:

```vue
		<PanelSection
			section="context"
			:title="tr('editor.shell.property')"
			open
		>
			<PropertyTree />
		</PanelSection>
		<PanelSection
			section="layers"
			:title="tr('editor.rail.layers')"
			open
		>
			<LayerList
				:entries="entries"
				:plan="plan"
				@activate-tool="runtime.setTool"
			/>
			<details
				v-if="session.perspective !== 'review'"
				class="rp-reference-options"
			>
				<summary>
					<span>{{ tr('editor.shell.reference-options') }}</span>
					<HostIcon
						name="chevron-down"
						class="rp-sidebar-section__chevron"
					/>
				</summary>
				<ReferenceAction />
			</details>
			<ChangeLegend v-if="runtime.renovation.available" />
		</PanelSection>
		<PanelSection
			section="rooms"
			:title="tr('editor.selection.records')"
			open
		>
			<RoomSummaryList
				v-if="records.length > 0"
				:records="records"
				:heading="tr('editor.selection.records')"
				:toggle-selection="toggleSelection"
			/>
			<label v-if="records.length > 1">
				<input
					v-model="toggleSelection"
					type="checkbox"
					data-rp-action="multiple-selection"
				>
				{{ tr('editor.selection.toggle-mode') }}
			</label>
			<p v-if="records.length > 1">
				{{ tr('editor.selection.hint') }}
			</p>
		</PanelSection>
		<PanelSection
			section="elements"
			:title="tr('editor.structure.list')"
		>
			<StructureList />
		</PanelSection>
```

The rooms section's three children are unchanged here; Task 8 restructures them.

- [ ] **Step 5: `styles/editor-side-panel.css` (section headers first)**

```css
/*
 * The Plan editor's side panels (2026-09-12 side panels spec §2): the section header here, and
 * from Task 7 the frame, header, resize handle and collapsed strip. Imported after
 * `editor-shell-fidelity.css` and `editor-visual-shell.css` so a tie on specificity resolves here,
 * but every rule below is written to win on specificity anyway.
 *
 * The chevron is a host icon (`PanelSection.vue`) rotated a quarter turn while closed. It replaced
 * a CSS-border triangle that read heavier than the heading beside it.
 */

.renovation-plan-editor .rp-sidebar-section {
	padding-block: var(--size-4-2);
	border-bottom: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-sidebar-section:last-child {
	border-bottom: 0;
}

.renovation-plan-editor .rp-sidebar-section > summary,
.renovation-plan-editor .rp-reference-options > summary {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	min-height: 32px;
	margin: 0;
	padding: 0 var(--size-4-1);
	font-size: var(--font-ui-small);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
	border-radius: var(--radius-s);
	list-style: none;
	cursor: pointer;
}

.renovation-plan-editor .rp-reference-options > summary {
	font-weight: var(--font-normal);
	color: var(--text-muted);
}

.renovation-plan-editor .rp-sidebar-section > summary::-webkit-details-marker,
.renovation-plan-editor .rp-reference-options > summary::-webkit-details-marker {
	display: none;
}

.renovation-plan-editor .rp-sidebar-section > summary:hover,
.renovation-plan-editor .rp-reference-options > summary:hover {
	background-color: var(--background-modifier-hover);
}

.renovation-plan-editor .rp-sidebar-section > summary:focus-visible,
.renovation-plan-editor .rp-reference-options > summary:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

.renovation-plan-editor .rp-sidebar-section__chevron {
	flex: 0 0 16px;
	margin-inline-start: auto;
	color: var(--text-muted);
	transform: rotate(-90deg);
	transition: transform 120ms ease;
}

.renovation-plan-editor .rp-sidebar-section[open] > summary > .rp-sidebar-section__chevron,
.renovation-plan-editor .rp-reference-options[open] > summary > .rp-sidebar-section__chevron {
	transform: none;
}

@media (prefers-reduced-motion: reduce) {
	.renovation-plan-editor .rp-sidebar-section__chevron {
		transition: none;
	}
}
```

In `styles/index.css`, add `@import "./editor-side-panel.css";` on the line after `@import "./editor-shell-fidelity.css";`.

In `styles/editor-shell-fidelity.css`, delete by SELECTOR, not by line number (each deletion shifts the next): the rule `.renovation-plan-editor .rp-reference-options { margin-top: 6px; }` and the rule for `.rp-reference-options > summary` (keep `.rp-reference-options > button`), then the seven `.rp-sidebar-section` rules at the top of the file (`.rp-sidebar-section`, `:last-child`, `> summary`, `::-webkit-details-marker`, `::after`, `[open] > summary::after`, `> summary:focus-visible`). Re-read the file after deleting: every remaining rule must still start on its own line.

- [ ] **Step 6: Run tests**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/shellFidelity.test.ts tests/presentation/editor/nativeShellInputBoundaries.test.ts tests/presentation/editor/visibleCanvasSelection.test.ts tests/build/styles.test.ts`
Expected: PASS (`sidebarSections.test.ts` unchanged and green).

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell/PanelSection.vue src/presentation/editor/shell/PropertyLayerPanel.vue styles/editor-side-panel.css styles/index.css styles/editor-shell-fidelity.css tests/presentation/editor/shell/sidePanels.test.ts
git commit -m "feat(editor): sidebar sections with host-icon chevrons, reachable from the strip"
```

---

### Task 7: The panel frame's CSS, and the superseded rules deleted

**Files:**
- Modify: `styles/editor-side-panel.css` (append), `styles/editor.css`, `styles/editor-inspector.css`, `styles/editor-visual-shell.css`, `styles/editor-layout.css`
- Verify: `tests/build/styles.test.ts`, `tests/build/buttonSpecificity.test.ts`, `tests/build/buttonFocusRing.test.ts`, harness captures

**Interfaces:**
- Consumes: Task 5's DOM contract and the `--rp-layers-width`/`--rp-inspector-width` custom properties.
- Produces: nothing new in TypeScript; the panel frame's final look.

- [ ] **Step 1: Append the frame rules to `styles/editor-side-panel.css`**

```css
/*
 * The frame. `--rp-layers-width` and `--rp-inspector-width` are the EFFECTIVE widths
 * `ResponsiveEditorShell` binds on `.rp-editor-body` (canvas floor already applied); the fallbacks
 * are the defaults, for a render before the first measurement. Width changes are not animated, so
 * the Konva stage resizes once rather than per frame.
 */
.renovation-plan-editor .rp-side-panel {
	display: flex;
	position: relative;
	flex: 0 0 auto;
	flex-direction: column;
	min-height: 0;
	background-color: var(--background-primary);
}

.renovation-plan-editor .rp-side-panel--layers {
	width: var(--rp-layers-width, 256px);
	border-right: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-side-panel--inspector {
	width: var(--rp-inspector-width, 352px);
	border-left: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-side-panel > .rp-side-panel__body {
	display: flex;
	flex: 1 1 auto;
	flex-direction: column;
	min-height: 0;
}

/* In M16's overlay and drawer the body adds no box: the overlay stays the scroll container. */
.rp-overlay-panel > .rp-side-panel__body,
.rp-inspector-drawer > .rp-side-panel__body {
	display: contents;
}

/* The panel content in both layouts; only the full layout's frame makes it scroll on its own. */
.renovation-plan-editor .rp-editor-layers,
.renovation-plan-editor .rp-editor-inspector {
	padding: 0 var(--size-4-3) var(--size-4-3);
	overflow-wrap: anywhere;
	background-color: var(--background-primary);
}

.renovation-plan-editor .rp-side-panel .rp-editor-layers,
.renovation-plan-editor .rp-side-panel .rp-editor-inspector {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	scrollbar-gutter: stable;
}

.renovation-plan-editor .rp-editor-inspector {
	padding-top: var(--size-4-3);
}

.renovation-plan-editor .rp-side-panel__header {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-4-2);
	min-height: 40px;
	padding: 0 var(--size-4-2) 0 var(--size-4-3);
	border-bottom: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-side-panel__title {
	min-width: 0;
	overflow: hidden;
	font-size: var(--font-ui-small);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
	text-overflow: ellipsis;
	white-space: nowrap;
}

/*
 * Two-class compounds for the (0,1,1) Obsidian's `button:not(.clickable-icon)` scores, and their own
 * rings, which `buttonSpecificity.test.ts` and `buttonFocusRing.test.ts` check for every button.
 * 28px squares clear WCAG 2.2's 24px target minimum.
 */
.renovation-plan-editor .rp-side-panel .rp-side-panel__toggle,
.renovation-plan-editor .rp-side-panel .rp-side-panel__strip-button {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	color: var(--text-muted);
	background-color: transparent;
	box-shadow: none;
	border: none;
	border-radius: var(--radius-s);
	cursor: pointer;
}

.renovation-plan-editor .rp-side-panel .rp-side-panel__toggle:hover,
.renovation-plan-editor .rp-side-panel .rp-side-panel__strip-button:hover {
	color: var(--text-normal);
	background-color: var(--background-modifier-hover);
}

.renovation-plan-editor .rp-side-panel .rp-side-panel__toggle:focus-visible,
.renovation-plan-editor .rp-side-panel .rp-side-panel__strip-button:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

/* Collapsed: the 40px strip `panelLayout.ts` reserves as `STRIP_PX`. */
.renovation-plan-editor .rp-side-panel__strip {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--size-4-1);
	padding: var(--size-4-2) 0;
}

.renovation-plan-editor .rp-side-panel__strip > .rp-side-panel__strip-button:first-child {
	margin-bottom: var(--size-4-2);
}

/*
 * The resize handle: a 6px hit area straddling the border, invisible at rest beyond the border
 * itself. Hover, drag and keyboard focus draw a 2px accent line, which is also its focus indicator
 * (`--interactive-accent`'s contrast is recorded in `editor-shell.css`).
 */
.renovation-plan-editor .rp-side-panel__resizer {
	position: absolute;
	top: 0;
	bottom: 0;
	z-index: 2;
	width: 6px;
	cursor: col-resize;
	touch-action: none;
}

.renovation-plan-editor .rp-side-panel--layers > .rp-side-panel__resizer {
	right: -3px;
}

.renovation-plan-editor .rp-side-panel--inspector > .rp-side-panel__resizer {
	left: -3px;
}

.renovation-plan-editor .rp-side-panel__resizer::after {
	content: '';
	position: absolute;
	top: 0;
	bottom: 0;
	left: 2px;
	width: 2px;
	background-color: transparent;
}

.renovation-plan-editor .rp-side-panel__resizer:hover::after,
.renovation-plan-editor .rp-side-panel__resizer:active::after,
.renovation-plan-editor .rp-side-panel__resizer:focus-visible::after {
	background-color: var(--interactive-accent);
}

.renovation-plan-editor .rp-side-panel__resizer:focus-visible {
	outline: none;
}
```

- [ ] **Step 2: Delete what the frame supersedes**

Delete by selector, re-reading each file after its edit:
- `styles/editor.css`: the `.rp-editor-layers { flex: 0 0 auto; width: 12rem; … }` rule and the comment block directly above it ("A real width, not `--size-4-18`…").
- `styles/editor-inspector.css`: the `.rp-editor-inspector { flex: 0 0 auto; width: 17rem; … }` rule and the comment directly above it ("Wider than the layers panel since design slice 10…").
- `styles/editor-visual-shell.css`: `.renovation-plan-editor .rp-persistent-panel > .rp-editor-layers`, `.renovation-plan-editor .rp-persistent-panel > .rp-editor-inspector`, and the combined `.renovation-plan-editor .rp-editor-layers, .renovation-plan-editor .rp-editor-inspector { padding: 16px; … }` rule.
- `styles/editor-layout.css`: the `.rp-persistent-panel { display: contents; }` rule; in the comment above `.rp-overlay-panel, .rp-inspector-drawer`, replace "`min(17rem, 80%)` is the persistent Inspector's own 17rem" with "`min(17rem, 80%)` is the Inspector's old persistent width".
- `styles/editor-layout.css`: in `.rp-panel-rail`, change `background-color: var(--background-secondary);` to `background-color: var(--background-primary);` so the rail and the collapsed strip share a surface.

Then `rg -n "rp-persistent-panel" styles` must print nothing.

- [ ] **Step 3: Build gates for the stylesheet**

Run: `npm run check:fast -- tests/build/styles.test.ts tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts tests/presentation/editor/shell`
Expected: PASS. A `buttonSpecificity` failure names the selector; add `.renovation-plan-editor` in front rather than `!important`.

- [ ] **Step 4: Look at it**

Run: `npm run harness-shot`, then Read `harness-shots/plan-editor-light.png`, `plan-editor-dark.png`, `plan-editor-selected.png` and `plan-editor-narrow.png`. Check: a 40px header row with the title and a chevron on both panels; no double borders against the canvas; the layers content scrolls independently of the Inspector; the 460px rail looks like the rest of the panel surface. Fix spacing in `editor-side-panel.css` only, then re-capture.

- [ ] **Step 5: Commit**

```bash
git add styles
git commit -m "style(editor): side panel frame, header, strip and resize handle"
```

---

### Task 8: Property and layers content

**Files:**
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Modify: `styles/editor-shell-fidelity.css`, `styles/editor-visual-shell.css`, `styles/editor-visual-tasks.css`, `styles/editor-side-panel.css` (append)
- Test: `tests/presentation/editor/shell/sidebarSections.test.ts` (add a case)

**Interfaces:**
- Consumes: Task 6's `PanelSection` (rooms section).
- Produces: `div.rp-property-rooms__footer` wrapping the multiple-selection label and hint. Every existing class, `data-rp-*` attribute, id and label text stays as it is (`shell.test.ts:236-240` matches layer labels exactly; `layerList.test.ts` reads reason ids; `roomSummaryList.test.ts` reads `data-rp-lock`).

- [ ] **Step 1: Add the failing case**

In `sidebarSections.test.ts`, inside `describe('sidebar sections', …)`:

```ts
	it('keeps the multiple selection control and its hint together in the rooms section footer', async () => {
		const harness = await mountPlanEditorCanvas();
		const footer = harness.wrapper.get('.rp-property-rooms > .rp-property-rooms__footer');
		expect(footer.find('input[data-rp-action="multiple-selection"]').exists()).toBe(true);
		expect(footer.find('p').exists()).toBe(true);
		harness.unmount();
	});
```

(If the neighbouring case does not unmount its harness, match its cleanup instead.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/sidebarSections.test.ts`
Expected: FAIL — `.rp-property-rooms__footer` not found.

- [ ] **Step 3: The footer markup**

In `PropertyLayerPanel.vue`'s rooms `PanelSection`, replace the `<label v-if="records.length > 1">…</label>` and `<p v-if="records.length > 1">…</p>` with:

```vue
			<div
				v-if="records.length > 1"
				class="rp-property-rooms__footer"
			>
				<label>
					<input
						v-model="toggleSelection"
						type="checkbox"
						data-rp-action="multiple-selection"
					>
					{{ tr('editor.selection.toggle-mode') }}
				</label>
				<p>{{ tr('editor.selection.hint') }}</p>
			</div>
```

- [ ] **Step 4: Content CSS, edited where each rule already lives**

`styles/editor-shell-fidelity.css`:
- Replace the `.rp-property-tree__floor[aria-current="page"]` rule body with `background: var(--background-modifier-active-hover); border-color: transparent; box-shadow: inset 2px 0 0 var(--interactive-accent); font-weight: var(--font-semibold);` (it is a `<p>`, never a button).
- Replace `.renovation-plan-editor .rp-layer-list__row { display: block; margin: 0; padding-block: 5px; }` with
  ```css
  .renovation-plan-editor .rp-layer-list__row { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--size-4-1); margin: 0; padding-block: 2px; }
  .renovation-plan-editor .rp-layer-list__row > .rp-layer-toggle { flex: 1 0 100%; }
  ```
- Replace the `.rp-layer-list .rp-layer-list__action` rule with
  ```css
  .renovation-plan-editor .rp-layer-list .rp-layer-list__action { display: inline; height: auto; min-height: 0; margin: 0 0 var(--size-4-1); padding: 0; font-size: var(--font-ui-smaller); color: var(--text-accent); background: transparent; box-shadow: none; border: none; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .renovation-plan-editor .rp-layer-list .rp-layer-list__action[aria-disabled='true'] { color: var(--text-faint); text-decoration: none; cursor: not-allowed; }
  ```
  (its existing `:focus-visible` rule a few lines up stays).
- Replace the `.rp-layer-list__reason` rule with `.renovation-plan-editor .rp-layer-list__reason { flex: 0 1 auto; margin: 0 0 var(--size-4-1) 24px; font-size: var(--font-ui-smaller); color: var(--text-muted); }`.
- Replace `.rp-property-rooms > label` and `.rp-property-rooms > p` with
  ```css
  .renovation-plan-editor .rp-property-rooms__footer { display: grid; gap: var(--size-4-1); margin-top: var(--size-4-2); padding-top: var(--size-4-2); border-top: 1px solid var(--background-modifier-border); }
  .renovation-plan-editor .rp-property-rooms__footer > label { display: flex; gap: 6px; align-items: start; }
  .renovation-plan-editor .rp-property-rooms__footer > p { margin: 0; font-size: var(--font-ui-smaller); color: var(--text-muted); }
  ```
- In the `.rp-change-legend` rule, change `background: var(--background-secondary);` to `background: transparent;` (a card is a border, not a fill).

`styles/editor-visual-tasks.css`: delete `.renovation-plan-editor .rp-layer-list__row label { flex-basis: 8rem; }` (the row is no longer that flex layout).

`styles/editor-visual-shell.css`: replace the `.rp-structure-list__row[aria-pressed='true']` rule body with `background: var(--background-modifier-active-hover); border-color: transparent; box-shadow: inset 2px 0 0 var(--interactive-accent);` and add directly below the existing `.rp-structure-list__row:focus-visible` rule:

```css
.renovation-plan-editor .rp-structure-list__row[aria-pressed='true']:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}
```

Append to `styles/editor-side-panel.css`:

```css
/*
 * List rows' selected state, one channel beyond the fill and `aria-pressed`: a 2px leading accent
 * rule, the same on rooms, walls and the property tree's current floor.
 */
.renovation-plan-editor .rp-room-list .rp-room-list__row[aria-pressed='true'] {
	box-shadow: inset 2px 0 0 var(--interactive-accent);
}

.renovation-plan-editor .rp-room-list .rp-room-list__row[aria-pressed='true']:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

/*
 * In the sidebar an UNLOCKED room's lock shows only on hover or keyboard focus, so a list of rooms
 * is not a column of open padlocks. A locked room's always shows. `opacity` rather than
 * `visibility`, so the button stays in the tab order and `:focus-within` can reveal it.
 */
.renovation-plan-editor .rp-editor-layers .rp-room-list__item > .rp-editor-inspector-lock[aria-pressed='false'] {
	opacity: 0;
}

.renovation-plan-editor .rp-editor-layers .rp-room-list__item:hover > .rp-editor-inspector-lock,
.renovation-plan-editor .rp-editor-layers .rp-room-list__item:focus-within > .rp-editor-inspector-lock {
	opacity: 1;
}
```

- [ ] **Step 5: Run the left-panel suites**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/shellFidelity.test.ts tests/presentation/editor/structureLifecycle.test.ts tests/presentation/editor/zoneLock.e2e.test.ts tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts tests/build/styles.test.ts`
Expected: PASS.

- [ ] **Step 6: Look at it**

Run `npm run harness-shot`; Read `plan-editor-light.png`, `plan-editor-dark.png`, `plan-editor-multiple.png`. Check: layer rows align on one icon column; the no-reference reason sits under "Reference plan" with Set scale beside it; unlocked rooms show no padlock at rest; the selected room carries the accent rule.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell/PropertyLayerPanel.vue styles tests/presentation/editor/shell/sidebarSections.test.ts
git commit -m "style(editor): property and layers rows, selection rule and quiet locks"
```

---

### Task 9: The Coming later line

**Files:**
- Create: `src/presentation/editor/shell/comingLater.ts`, `src/presentation/editor/shell/ComingLaterLine.vue`
- Create: `tests/presentation/editor/shell/comingLater.test.ts`
- Delete: `src/presentation/editor/shell/HomeownerQuestionNav.vue`, `src/presentation/editor/shell/LinkedContentList.vue`
- Modify: `src/presentation/editor/shell/RoomInspector.vue`, `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`, `styles/editor-inspector.css`, `styles/editor-visual-shell.css`
- Modify tests: `tests/presentation/editor/shell/roomInspector.test.ts`, `tests/harness/accessibility.test.ts`, `tests/presentation/editor/renovationOverview.test.ts`

**Interfaces:**
- Consumes: `INSPECTOR_SECTIONS` and `type InspectorSection` from `src/presentation/read-models/roomOverview.ts`; `t`, `currentLanguage` from `src/presentation/i18n/strings.ts`.
- Produces: `comingLaterSentence(language: string, sections: readonly InspectorSection[]): string` (`''` for none); `ComingLaterLine.vue` props `{ sections: readonly InspectorSection[] }`, renders `p.rp-coming-later` or nothing; key `editor.inspector.coming-later`.

- [ ] **Step 1: Write the failing pure test**

`tests/presentation/editor/shell/comingLater.test.ts`:

```ts
/**
 * The Coming later sentence (2026-09-12 side panels spec §3), per locale, through the pure `t` —
 * no call site's language resolution involved, so both tables are driven directly.
 */
import { describe, expect, it } from 'vitest';
import { comingLaterSentence } from '../../../../src/presentation/editor/shell/comingLater';

describe('the Coming later sentence', () => {
	it('names the sections in English, in the order given', () => {
		const list = new Intl.ListFormat('en', { type: 'unit' }).format(['What’s here', 'Costs', 'Notes']);
		expect(comingLaterSentence('en', ['existing', 'costs', 'notes'])).toBe(`Coming later: ${list}`);
	});

	it('names them from the German table in German', () => {
		const list = new Intl.ListFormat('de', { type: 'unit' }).format(['Was ist zu tun', 'Fotos']);
		expect(comingLaterSentence('de', ['work', 'photos'])).toBe(`Später verfügbar: ${list}`);
	});

	it('answers nothing when nothing is unavailable', () => {
		expect(comingLaterSentence('en', [])).toBe('');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/comingLater.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Strings**

`en/editor.ts`: after `'editor.inspector.linked.notes': 'Notes',` add

```ts
	// The one line those seven labels are joined into (2026-09-12 side panels spec §3,
	// `comingLater.ts`). The labels keep their own capitals, so the list reads as names.
	'editor.inspector.coming-later': 'Coming later: {sections}',
```

and change the two comments above the question and linked groups to say they are `comingLater.ts`'s labels (was `HomeownerQuestionNav`'s / `LinkedContentList`'s rows).

`de/editor.ts`: after `'editor.inspector.linked.notes': 'Notizen',` add `'editor.inspector.coming-later': 'Später verfügbar: {sections}',`.

- [ ] **Step 4: `comingLater.ts` and `ComingLaterLine.vue`**

```ts
import { t } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { InspectorSection } from '../../read-models/roomOverview';

/**
 * Every section the Inspector cannot show yet, as one sentence (2026-09-12 side panels spec §3).
 * It replaced `HomeownerQuestionNav` and `LinkedContentList`, whose seven rows each said "Not
 * available yet" and took half a selected room's Inspector to say it. Pure and keyed on a language
 * so both locales are testable without the host's language.
 */
const LABELS: Readonly<Record<InspectorSection, StringKey>> = {
	existing: 'editor.inspector.question.existing',
	planned: 'editor.inspector.question.planned',
	work: 'editor.inspector.question.work',
	costs: 'editor.inspector.linked.costs',
	documents: 'editor.inspector.linked.documents',
	photos: 'editor.inspector.linked.photos',
	notes: 'editor.inspector.linked.notes',
};

export function comingLaterSentence(language: string, sections: readonly InspectorSection[]): string {
	if (sections.length === 0) return '';
	const labels = sections.map((section) => t(language, LABELS[section]));
	return t(language, 'editor.inspector.coming-later', { sections: new Intl.ListFormat(language, { type: 'unit' }).format(labels) });
}
```

```vue
<script setup lang="ts">
/**
 * The Coming later line — text, never a control. A Feature that supplies one of these sections
 * removes it from `INSPECTOR_SECTIONS`' unavailable list and gives it a real row elsewhere.
 */
import { computed } from 'vue';
import { currentLanguage } from '../../i18n/strings';
import { comingLaterSentence } from './comingLater';
import type { InspectorSection } from '../../read-models/roomOverview';

const props = defineProps<{ sections: readonly InspectorSection[] }>();
const sentence = computed(() => comingLaterSentence(currentLanguage(), props.sections));
</script>

<template>
	<p
		v-if="sentence !== ''"
		class="rp-coming-later"
	>
		{{ sentence }}
	</p>
</template>
```

Run: `npm run check:fast -- tests/presentation/editor/shell/comingLater.test.ts` — Expected: PASS.

- [ ] **Step 5: Rewrite the Room Inspector cases first (they must fail)**

In `roomInspector.test.ts`:
- Delete the imports of `HomeownerQuestionNav` and `LinkedContentList` (lines 17-18); add
  ```ts
  import { comingLaterSentence } from '../../../../src/presentation/editor/shell/comingLater';
  import { INSPECTOR_SECTIONS } from '../../../../src/presentation/read-models/roomOverview';
  ```
- Replace the two cases `'renders the three homeowner questions in order, …'` and `'lists costs, documents, photos and notes as unavailable rows without controls'` with:
  ```ts
  	it('names every section this build cannot show yet in one Coming later line, with no control and no count', async () => {
  		harness = await mountPlanEditorCanvas();
  		useSelectionStore().select(['zone-kitchen' as never]);
  		await settle();
  		const line = harness.wrapper.get('.rp-room-inspector .rp-coming-later');
  		expect(line.text()).toBe(comingLaterSentence('en', INSPECTOR_SECTIONS));
  		expect(line.findAll('button, a')).toHaveLength(0);
  		expect(line.text()).not.toMatch(/\d/);
  	});
  ```
- In `'omits the type/floor/area fields and both lists when the selected zone is missing from the store'` rename to `'…fields and the Coming later line…'` and replace its two `.rp-question-nav`/`.rp-linked-content` expectations with `expect(harness.wrapper.find('.rp-coming-later').exists()).toBe(false);`. Do the same in the standalone case (`wrapper.find(...)`).
- Delete the two `describe` blocks `'HomeownerQuestionNav mounted directly'` and `'LinkedContentList mounted directly'` and the comment above them.

`tests/harness/accessibility.test.ts`, case `'reports no semantic violations on the Room Inspector in the full layout with a room selected'`: replace its two expectations with
```ts
			expect(mounted.wrapper.find('.rp-coming-later').exists()).toBe(true);
			expect(mounted.wrapper.find('.rp-coming-later button').exists()).toBe(false);
```
and in the comment above, replace "`.rp-question-nav` is the three homeowner questions, each marked unavailable with NO control" with "`.rp-coming-later` names the sections this build cannot show yet, with NO control".

`tests/presentation/editor/renovationOverview.test.ts:54`: `expect(rig.wrapper.find('.rp-coming-later').exists()).toBe(!planning);`

Run: `npm run check:fast -- tests/presentation/editor/shell/roomInspector.test.ts tests/presentation/editor/renovationOverview.test.ts`
Expected: FAIL on the rewritten cases (`.rp-coming-later` not found).

- [ ] **Step 6: Use it in `RoomInspector.vue`**

- Remove the `HomeownerQuestionNav` and `LinkedContentList` imports and the `unavailableNavigation` computed.
- Import `ComingLaterLine from './ComingLaterLine.vue'` and extend the roomOverview import to `import { buildRoomOverview, type InspectorSection, type RoomOverviewDto } from '../../read-models/roomOverview';`.
- Add, where `unavailableNavigation` was:
  ```ts
  /**
   * What the Coming later line names: the three homeowner questions while there is no renovation
   * session, and the four linked sections unless connected planning supplies them — the same two
   * conditions `HomeownerQuestionNav` and `LinkedContentList` were mounted under. Read only once
   * `overview` exists, so a standalone mount with no `renovation` on its runtime never reaches it.
   */
  const comingLater = computed<readonly InspectorSection[]>(() => {
  	const current = overview.value;
  	if (current === null) return [];
  	const renovation = runtime.renovation.available;
  	const wanted: readonly InspectorSection[] = [
  		...(renovation ? [] : (['existing', 'planned', 'work'] as const)),
  		...(renovation && planning ? [] : (['costs', 'documents', 'photos', 'notes'] as const)),
  	];
  	return wanted.filter((section) => current.unavailableSections.includes(section));
  });
  ```
- In the template, replace the `<HomeownerQuestionNav …/>` and `<LinkedContentList …/>` elements with `<ComingLaterLine :sections="comingLater" />`.
- In the file's header docblock, replace the sentences naming the two navigation lists with: "One Coming later line follows it (`ComingLaterLine`, 2026-09-12 side panels spec), naming `overview.unavailableSections` — `INSPECTOR_SECTIONS`' closed list of what this build has no query for yet — as text rather than as a control that would do nothing."

```bash
git rm src/presentation/editor/shell/HomeownerQuestionNav.vue src/presentation/editor/shell/LinkedContentList.vue
```

- [ ] **Step 7: CSS**

`styles/editor-inspector.css`: delete the `.rp-question-nav, .rp-linked-content`, `.rp-question-nav__row, .rp-linked-content__row` and `.rp-question-nav__state, .rp-linked-content__state` rules and the comment block directly above the first of them; in their place:

```css
/* The Coming later line (2026-09-12 side panels spec §3): muted text, never a control. */
.rp-coming-later {
	margin: var(--size-4-3) 0 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}
```

`styles/editor-visual-shell.css`: delete `.renovation-plan-editor .rp-question-nav { … }`, `.renovation-plan-editor .rp-question-nav__row { … }` and `.renovation-plan-editor .rp-linked-content__row { … }`.

`rg -n "rp-question-nav|rp-linked-content|HomeownerQuestionNav|LinkedContentList" src styles tests` must print nothing (the component library doc is updated in Task 13).

- [ ] **Step 8: Run tests**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/renovationOverview.test.ts tests/harness/accessibility.test.ts tests/presentation/i18n tests/build/styles.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A src/presentation/editor/shell src/presentation/i18n styles tests
git commit -m "feat(editor): one Coming later line replaces seven unavailable rows"
```

---

### Task 10: The Room Inspector skeleton

**Files:**
- Create: `src/presentation/editor/shell/AssetAssignControl.vue`
- Create: `styles/editor-inspector-skeleton.css`
- Modify: `src/presentation/editor/shell/RoomInspector.vue`, `src/presentation/editor/elements/ObjectRotationControls.vue`, `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`, `styles/index.css`, `styles/editor-inspector.css`, `styles/editor-object.css`
- Modify tests: `tests/presentation/editor/shell/roomInspector.test.ts`, `tests/presentation/editor/rotationInspectorRoutes.test.ts`, `tests/presentation/editor/assetOptionsRefresh.test.ts`

**Interfaces:**
- Consumes: Task 9's `ComingLaterLine`; `useEditorRuntime()` members `assetOptions`, `writesBlocked`, `pausedReasonId`, `commitEdit`.
- Produces:
  - `AssetAssignControl.vue` props `{ zoneId: ZoneId }`; keeps `div.rp-editor-requirement-assign`, `select#rp-assign-asset` (first option `value=""` placeholder), the Assign button, and `p.rp-editor-inspector-empty` when the catalogue is empty.
  - Classes Task 11 reuses: `.rp-inspector-toolbar`, `.rp-inspector-actions`, `.rp-inspector-danger`, the facts card on `> .rp-editor-inspector-fields`.
  - Keys `editor.inspector.assign.placeholder`, `editor.inspector.assign.none`.
- Deviation from spec §3, recorded in Task 13: no identity subline for a room — the facts card already carries type, area and status, and `roomInspector.test.ts` pins status inside that `dl`.

- [ ] **Step 1: Strings**

`en/editor.ts`, after `'editor.inspector.assign.button': 'Assign',`:

```ts
	'editor.inspector.assign.placeholder': 'Choose an asset',
	'editor.inspector.assign.none': 'No assets in the library yet',
```

`de/editor.ts`, after `'editor.inspector.assign.button': 'Zuweisen',`:

```ts
	'editor.inspector.assign.placeholder': 'Objekt auswählen',
	'editor.inspector.assign.none': 'Noch keine Objekte in der Bibliothek',
```

- [ ] **Step 2: Write the failing cases**

In `roomInspector.test.ts` add `runtimeOf` to the `../../../helpers/editor` import, and inside `describe('the Room Inspector, through the real mounted editor', …)`:

```ts
	it('explains an empty asset library beside a disabled picker rather than offering an empty one', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		// Set AFTER the selection has hydrated, so a late catalogue read cannot overwrite it.
		runtimeOf(harness).assetOptions.value = [];
		await settle();
		const assign = harness.wrapper.get('.rp-editor-requirement-assign');
		expect((assign.get('#rp-assign-asset').element as HTMLSelectElement).disabled).toBe(true);
		expect(assign.get('option').text()).toBe(t('en', 'editor.inspector.assign.placeholder'));
		const button = assign.get('button');
		expect(button.attributes('aria-disabled')).toBe('true');
		expect(assign.get(`#${button.attributes('aria-describedby') ?? ''}`).text()).toBe(t('en', 'editor.inspector.assign.none'));
	});

	it('offers a placeholder and the catalogue, with Assign live, once there are assets', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		runtimeOf(harness).assetOptions.value = [{ id: 'asset-tiles', name: 'Floor tiles' }] as never;
		await settle();
		const assign = harness.wrapper.get('.rp-editor-requirement-assign');
		expect(assign.findAll('option').map((option) => option.attributes('value'))).toEqual(['', 'asset-tiles']);
		expect(assign.get('button').attributes('aria-disabled')).toBeUndefined();
		expect(assign.find('.rp-editor-inspector-empty').exists()).toBe(false);
	});

	it('draws the rotation and lock controls as one toolbar, the actions as rows, and Delete last with its icon', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const room = harness.wrapper.get('.rp-room-inspector');
		expect(room.get('.rp-inspector-toolbar').find('[data-rp-lock="zone-kitchen"]').exists()).toBe(true);
		expect(room.get('.rp-inspector-actions').find('[data-rp-action="edit-outline"]').exists()).toBe(true);
		const danger = room.get('.rp-inspector-danger');
		expect(room.element.lastElementChild).toBe(danger.element);
		expect(danger.get('.rp-editor-inspector-delete').find('.rp-host-icon').exists()).toBe(true);
		expect(danger.get('.rp-editor-inspector-delete').text()).toBe(t('en', 'editor.inspector.delete-zone'));
	});
```

If `assetOptions` is not a writable `Ref` on `EditorRuntime`, read `runtime.ts` for how it is hydrated and drive it through the fixture's asset query instead; do not cast a `ComputedRef` to writable.

In `tests/presentation/editor/assetOptionsRefresh.test.ts:45`, change `expect(optionValues()).toEqual([]);` to `expect(optionValues()).toEqual(['']);` and add a comment: `// The placeholder option (2026-09-12 side panels spec) is always first.`

In `tests/presentation/editor/rotationInspectorRoutes.test.ts`, directly after the assertion that the controls have 3 buttons, add:

```ts
		for (const quarter of ['rotate-object-left', 'rotate-object-right']) {
			const button = controls[0].get(`[data-rp-action="${quarter}"]`);
			expect(button.text()).toBe('');
			expect(button.attributes('aria-label')).toBeTruthy();
			expect(button.attributes('title')).toBeTruthy();
		}
```

Run: `npm run check:fast -- tests/presentation/editor/shell/roomInspector.test.ts tests/presentation/editor/rotationInspectorRoutes.test.ts tests/presentation/editor/assetOptionsRefresh.test.ts`
Expected: FAIL on the new assertions.

- [ ] **Step 3: `AssetAssignControl.vue`**

```vue
<script setup lang="ts">
/**
 * Assign asset (design slice 10), lifted out of `RoomInspector.vue` in the 2026-09-12 side panels
 * pass so its placeholder and empty-catalogue state did not push that template past fallow's
 * complexity budget. Dispatches through `runtime.commitEdit`, the Inspector store's ONE commit
 * path (§59). The id stays `rp-assign-asset`: several suites find the picker by it.
 */
import { computed, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import type { ZoneId } from '../../../domain/zone/ZoneId';

const props = defineProps<{ zoneId: ZoneId }>();
const runtime = useEditorRuntime();
const assetOptions = runtime.assetOptions;
const pickedAssetId = ref('');
const noAssetsId = useId();

/**
 * A paused floor's shared reason wins (design spec §2.9); otherwise an empty catalogue says why
 * Assign does nothing. Never `aria-disabled="false"`, which is why a live control gets `{}`.
 */
const assignAttrs = computed<Record<string, string>>(() => {
	if (runtime.writesBlocked.value) return { 'aria-disabled': 'true', 'aria-describedby': runtime.pausedReasonId };
	return assetOptions.value.length === 0 ? { 'aria-disabled': 'true', 'aria-describedby': noAssetsId } : {};
});

/** An empty pick is inert rather than a command refused for the empty id; a paused floor refuses too. */
function assignSelected(): void {
	if (pickedAssetId.value === '' || runtime.writesBlocked.value) return;
	void runtime.commitEdit({
		kind: 'assign',
		zoneId: props.zoneId as never,
		assetId: pickedAssetId.value as never,
	});
	pickedAssetId.value = '';
}
</script>

<template>
	<div class="rp-editor-requirement-assign">
		<label for="rp-assign-asset">{{ tr('editor.inspector.assign.label') }}</label>
		<select
			id="rp-assign-asset"
			v-model="pickedAssetId"
			:disabled="assetOptions.length === 0"
		>
			<option value="">
				{{ tr('editor.inspector.assign.placeholder') }}
			</option>
			<option
				v-for="option in assetOptions"
				:key="option.id"
				:value="option.id"
			>
				{{ option.name }}
			</option>
		</select>
		<button
			type="button"
			v-bind="assignAttrs"
			@click="assignSelected"
		>
			{{ tr('editor.inspector.assign.button') }}
		</button>
		<p
			v-if="assetOptions.length === 0"
			:id="noAssetsId"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.inspector.assign.none') }}
		</p>
	</div>
</template>
```

- [ ] **Step 4: `RoomInspector.vue`**

Script: remove `assetOptions`, `pickedAssetId`, `assignSelected` and the `ref` import if nothing else uses it; import `AssetAssignControl from './AssetAssignControl.vue'` and `HostIcon from '../../components/HostIcon.vue'`. Change `pausedAttrs`' docblock opening to "Design spec §2.9's pause attributes for Delete…" (Assign has its own in `AssetAssignControl`).

Template, from `<ZoneLockRow` to the end of the root `div`:

```vue
		<div class="rp-inspector-toolbar">
			<ObjectRotationControls :id="dto.id" />
			<ZoneLockRow
				:zone-id="dto.id"
				:name="dto.name"
				:locked="zoneLocked"
			/>
		</div>

		<div class="rp-inspector-actions">
			<SpatialInspectorActions
				:zone-id="dto.id"
				:record="overview?.record"
			/>
		</div>

		<section
			class="rp-editor-inspector-requirements"
			:aria-label="tr('editor.inspector.requirements')"
		>
			<h4 class="rp-editor-panel-subtitle">
				{{ tr('editor.inspector.requirements') }}
			</h4>
			<p
				v-if="requirements.length === 0"
				class="rp-editor-inspector-empty"
			>
				{{ tr('editor.inspector.requirements.empty') }}
			</p>
			<ul class="rp-editor-requirement-list">
				<RequirementRow
					v-for="row in requirements"
					:key="row.requirementId"
					:row="row"
					:commit="runtime.commitField"
					:logger="logger"
					:paused="paused"
					:paused-reason-id="runtime.pausedReasonId"
				/>
			</ul>
			<AssetAssignControl :zone-id="dto.id" />
		</section>

		<ComingLaterLine :sections="comingLater" />

		<div class="rp-inspector-danger">
			<button
				type="button"
				class="rp-editor-inspector-delete"
				v-bind="pausedAttrs"
				@click="onDeleteZone"
			>
				<HostIcon name="trash" />{{ tr('editor.inspector.delete-zone') }}
			</button>
		</div>
```

- [ ] **Step 5: Icon-only quarter turns in `ObjectRotationControls.vue`**

Replace the two quarter-turn buttons' text lines `{{ tr('editor.rotation.left-quarter') }}` and `{{ tr('editor.rotation.right-quarter') }}` with nothing, and add `:title="tr('editor.rotation.left-quarter')"` / `:title="tr('editor.rotation.right-quarter')"` beside their existing `:aria-label`. The `aria-label`s already name them.

- [ ] **Step 6: `styles/editor-inspector-skeleton.css`**

```css
/*
 * The Inspector's one skeleton (2026-09-12 side panels spec §3): identity, a facts card, a toolbar,
 * action rows, feature sections, the Coming later line, and Delete at the foot. Imported after
 * `editor-side-panel.css`. Every button compound here is at least (0,2,1) and carries its own ring.
 */

/* A card is a border, never a fill. */
.renovation-plan-editor .rp-room-inspector > .rp-editor-inspector-fields,
.renovation-plan-editor .rp-structure-inspector > .rp-editor-inspector-fields,
.renovation-plan-editor .rp-floor-inspector > .rp-editor-inspector-fields,
.renovation-plan-editor .rp-multi-selection > .rp-editor-inspector-fields {
	gap: var(--size-4-1) var(--size-4-3);
	margin: var(--size-4-2) 0;
	padding: var(--size-4-2) var(--size-4-3);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
}

.renovation-plan-editor .rp-inspector-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-1);
	margin: var(--size-4-2) 0;
}

.renovation-plan-editor .rp-inspector-toolbar > .rp-object-rotation-actions {
	flex: 1 1 auto;
	margin: 0;
}

.renovation-plan-editor .rp-inspector-toolbar > .rp-editor-inspector-lock-row {
	margin: 0 0 0 auto;
}

/* Action rows: M00's stacked rows, not a wrap of bordered buttons. */
.renovation-plan-editor .rp-inspector-actions {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin: var(--size-4-2) 0;
}

.renovation-plan-editor .rp-inspector-actions > button:not(.rp-related-navigation-opener) {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	width: 100%;
	min-height: 32px;
	height: auto;
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-normal);
	text-align: start;
	white-space: normal;
	background-color: transparent;
	box-shadow: none;
	border: 1px solid transparent;
	border-radius: var(--radius-s);
	cursor: pointer;
}

.renovation-plan-editor .rp-inspector-actions > button:not(.rp-related-navigation-opener):hover {
	background-color: var(--background-modifier-hover);
}

.renovation-plan-editor .rp-inspector-actions > button:not(.rp-related-navigation-opener):focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

.renovation-plan-editor .rp-inspector-actions > button[aria-disabled='true'] {
	color: var(--text-faint);
	cursor: not-allowed;
}

.renovation-plan-editor .rp-inspector-actions > p {
	margin: 0;
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

/* A feature section: the section-header look, without a disclosure. */
.renovation-plan-editor .rp-editor-inspector-requirements {
	margin-top: var(--size-4-3);
	padding-top: var(--size-4-2);
	border-top: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-editor-inspector-requirements > .rp-editor-panel-subtitle {
	margin: 0 0 var(--size-4-2);
	font-size: var(--font-ui-small);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
}

.renovation-plan-editor .rp-editor-requirement-assign > .rp-editor-inspector-empty {
	flex-basis: 100%;
	font-size: var(--font-ui-smaller);
}

/*
 * Delete at the foot, above a rule. The label is `--text-normal` and only the icon is red, for the
 * contrast `editor-inspector.css` measured when this was a bordered button: `--text-error` text
 * fails 4.5:1 in light, and the hover is a tint because solid `--background-modifier-error` has no
 * readable foreground. Both still hold.
 */
.renovation-plan-editor .rp-inspector-danger {
	margin-top: var(--size-4-4);
	padding-top: var(--size-4-2);
	border-top: 1px solid var(--background-modifier-border);
}

.renovation-plan-editor .rp-inspector-danger > button {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: var(--size-4-2);
	width: 100%;
	min-height: 32px;
	height: auto;
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-normal);
	text-align: start;
	background-color: transparent;
	box-shadow: none;
	border: 1px solid transparent;
	border-radius: var(--radius-s);
	cursor: pointer;
}

.renovation-plan-editor .rp-inspector-danger > button > .rp-host-icon {
	color: var(--text-error);
}

.renovation-plan-editor .rp-inspector-danger > button:hover {
	background-color: color-mix(in oklch, var(--background-modifier-error) 18%, transparent);
}

.renovation-plan-editor .rp-inspector-danger > button:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

.renovation-plan-editor .rp-inspector-danger > button[aria-disabled='true'] {
	color: var(--text-faint);
	cursor: not-allowed;
}
```

`styles/index.css`: add `@import "./editor-inspector-skeleton.css";` on the line after `@import "./editor-side-panel.css";`.

`styles/editor-inspector.css`: delete the three `.rp-editor-inspector .rp-editor-inspector-delete` rules (base, `:focus-visible`, `:hover`) and the long comment above the base rule.

`styles/editor-object.css`: replace every `.rp-object-rotation-actions*` and `.rp-object-rotation-hint` rule with:

```css
.renovation-plan-editor .rp-object-rotation-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-1);
	max-width: 100%;
	margin-block: var(--size-4-2);
}

.renovation-plan-editor .rp-object-rotation-actions button {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--size-4-1);
	min-width: 0;
	min-height: 32px;
	height: auto;
	font-size: var(--font-ui-small);
	white-space: normal;
}

.renovation-plan-editor .rp-object-rotation-actions .rp-host-icon { flex-shrink: 0; }
.renovation-plan-editor .rp-object-rotation-actions [data-rp-action='rotate-object'] { flex: 1 1 auto; }
.renovation-plan-editor .rp-object-rotation-actions--host [data-rp-action='rotate-object'] { flex-basis: 100%; }

.renovation-plan-editor .rp-object-rotation-actions [data-rp-action='rotate-object-left'],
.renovation-plan-editor .rp-object-rotation-actions [data-rp-action='rotate-object-right'] {
	flex: 0 0 32px;
	width: 32px;
	padding: 0;
}

.renovation-plan-editor .rp-object-rotation-hint {
	flex-basis: 100%;
	margin: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
```

- [ ] **Step 7: Run the Inspector suites and the build gates**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/rotationInspectorRoutes.test.ts tests/presentation/editor/assetOptionsRefresh.test.ts tests/presentation/editor/pausedSurfaces.test.ts tests/presentation/editor/history.e2e.test.ts tests/presentation/editor/areaCreation.e2e.test.ts tests/harness/accessibility.test.ts tests/harness/accessibilityTrustPath.test.ts tests/presentation/i18n tests/build/styles.test.ts tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts`
Expected: PASS.

- [ ] **Step 8: Look at it**

Run `npm run harness-shot`; Read `plan-editor-selected.png`, and `plan-editor-assets.png` / `plan-editor-assets-dark.png` (renovation and planning present). Check: the facts card; rotation and lock on one row with "90°" buttons as 32px squares; action rows left-aligned; Assign with its placeholder; one muted Coming later line; Delete last with a red trash icon.

- [ ] **Step 9: Commit**

```bash
git add -A src/presentation/editor/shell src/presentation/editor/elements/ObjectRotationControls.vue src/presentation/i18n styles tests
git commit -m "feat(editor): Room Inspector skeleton — facts card, toolbar, action rows, Delete at the foot"
```

---

### Task 11: Wall, element and floor Inspectors on the same skeleton

**Files:**
- Modify: `src/presentation/editor/structure/StructureInspector.vue`, `src/presentation/editor/elements/ElementInspector.vue`, `src/presentation/editor/shell/FloorInspector.vue`
- Modify: `styles/editor-inspector-skeleton.css` (append), `styles/editor-selection-details.css`, `styles/editor-structure.css`, `styles/editor-visual-tasks.css`, `styles/editor-object.css`
- Modify tests: `tests/harness/structureJourney.test.ts`, `tests/presentation/editor/assetPlacementInspector.test.ts`, `tests/presentation/editor/shell/floorInspector.test.ts`

**Interfaces:**
- Consumes: Task 10's `.rp-inspector-actions`, `.rp-inspector-danger`, facts-card selectors; Task 6's `.rp-sidebar-section__chevron`.
- Produces: `details.rp-inspector-more` (wall/opening "More actions"), `p.rp-inspector-subline` (element), `div.rp-inspector-primary` (floor). Every `data-rp-action` value is unchanged; `StructureInspector.act()` and `ElementInspector.edit()` still find their fallbacks by it.
- Deviation from spec §3, recorded in Task 13: the multiple-selection state gets only the facts card — Clear stays at the foot, because `multiSelectionInspector.test.ts` requires it to be the last button and `MultiSelectionInspector` is otherwise already rows.

- [ ] **Step 1: Write the failing assertions**

`tests/harness/structureJourney.test.ts`: after `expect(root.querySelector('.rp-structure-inspector')?.textContent).toContain('Room 1');` add

```ts
		const wallInspector = expectDefined(root.querySelector<HTMLElement>('.rp-structure-inspector'), 'wall inspector');
		expect(wallInspector.querySelector('.rp-inspector-actions [data-rp-action="edit-structure"]')).not.toBeNull();
		expect(wallInspector.querySelector('details.rp-inspector-more > summary .rp-sidebar-section__chevron')).not.toBeNull();
		expect(wallInspector.lastElementChild?.matches('.rp-inspector-danger')).toBe(true);
		expect(wallInspector.querySelector('.rp-inspector-danger [data-rp-action="delete-structure"] .rp-host-icon')).not.toBeNull();
```

and change the three `'.rp-structure-inspector > button'` selectors (the click, the `settleUntil` and the second click) to `'.rp-structure-inspector [data-rp-action="edit-structure"]'` — they meant the Edit action, which is no longer a direct child.

`tests/presentation/editor/assetPlacementInspector.test.ts`, first case, after the dimensions expectation:

```ts
	expect(inspector.findAll('.rp-inspector-subline').length).toBeGreaterThan(0);
	expect(inspector.element.lastElementChild?.matches('.rp-inspector-danger')).toBe(true);
	expect(inspector.get('.rp-inspector-danger [data-rp-action="delete-element"]').find('.rp-host-icon').exists()).toBe(true);
```

`tests/presentation/editor/shell/floorInspector.test.ts`, inside `describe('the floor state', …)`:

```ts
	it('draws the reference action as the floor\'s one primary action, directly under its name', async () => {
		harness = await mountPlanEditorCanvas();
		const primary = harness.wrapper.get('.rp-floor-inspector > .rp-inspector-primary');
		expect(primary.find('[data-rp-action="reference"]').exists()).toBe(true);
		expect(primary.element.previousElementSibling?.tagName).toBe('H3');
	});
```

Run: `npm run check:fast -- tests/harness/structureJourney.test.ts tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/editor/shell/floorInspector.test.ts`
Expected: FAIL on the new assertions.

- [ ] **Step 2: `StructureInspector.vue`**

Import `HostIcon from '../../components/HostIcon.vue'`. Template:

```vue
<template>
	<section
		v-if="wall || opening"
		class="rp-structure-inspector"
	>
		<h3>{{ tr(wall ? 'editor.add.wall.label' : `editor.add.${opening!.kind}.label`) }}</h3>
		<StructureFacts
			:wall="wall"
			:opening="opening"
			:rooms="rooms"
		/>
		<div class="rp-inspector-actions">
			<button
				type="button"
				:aria-disabled="paused"
				data-rp-action="edit-structure"
				@click="act($event, false)"
			>
				{{ tr('editor.structure.edit') }}
			</button>
			<button
				v-if="opening"
				type="button"
				:aria-disabled="!runtime.openingMove.available.value"
				data-rp-action="move-opening"
				@click="moveOpening(id, $event.currentTarget as HTMLElement)"
			>
				{{ tr('editor.opening-move.action') }}
			</button>
		</div>
		<details class="rp-inspector-more">
			<summary>
				<span>{{ tr('editor.structure.more') }}</span>
				<HostIcon
					name="chevron-down"
					class="rp-sidebar-section__chevron"
				/>
			</summary>
			<ObjectRotationControls :id="id" />
			<div
				v-if="wall"
				class="rp-inspector-actions"
			>
				<CurveAction :id="id" />
			</div>
			<StructureRenovationEntry />
		</details>
		<div class="rp-inspector-danger">
			<button
				type="button"
				:aria-disabled="paused"
				data-rp-action="delete-structure"
				@click="act($event, true)"
			>
				<HostIcon name="trash" />{{ tr('editor.structure.delete') }}
			</button>
		</div>
	</section>
</template>
```

- [ ] **Step 3: `ElementInspector.vue`**

Import `HostIcon from '../../components/HostIcon.vue'`. Template:

```vue
<template>
	<section
		v-if="element"
		class="rp-element-inspector"
		:data-rp-id="element.id"
	>
		<h3>{{ name }}</h3>
		<p class="rp-inspector-subline">
			{{ tr(zoneTypeLabel(element.kind)) }}
		</p>
		<p
			v-if="element.kind === 'object' && measuredArea?.ok"
			class="rp-inspector-subline"
		>
			{{ formatArea(measuredArea.value) }}
		</p>
		<p
			v-else-if="stairSummary"
			class="rp-inspector-subline"
		>
			{{ stairSummary }}
		</p>
		<AssetPlacementDetails
			v-else-if="element.kind === 'asset'"
			:element="element"
		/>
		<p
			v-else
			class="rp-inspector-subline"
		>
			{{ formatMetres(elementLength(element)) }} m
		</p>
		<StructureRenovationEntry />
		<ObjectRotationControls
			v-if="session.perspective === 'plan'"
			:id="element.id"
		/>
		<div class="rp-inspector-actions">
			<button
				v-if="session.perspective === 'renovate'"
				type="button"
				data-rp-action="element-plan-geometry"
				@click="runInspectorAction($event, 'edit-element', () => runtime.renovation.perspective('plan'))"
			>
				{{ tr('editor.element.plan-geometry') }}
			</button>
			<button
				v-if="element.kind !== 'asset'"
				type="button"
				data-rp-action="edit-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="edit"
			>
				{{ tr('editor.element.edit-action') }}
			</button>
		</div>
		<div class="rp-inspector-danger">
			<button
				type="button"
				data-rp-action="delete-element"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="runtime.elementActions.remove(element.id)"
			>
				<HostIcon name="trash" />{{ tr('editor.element.delete-action') }}
			</button>
		</div>
	</section>
</template>
```

- [ ] **Step 4: `FloorInspector.vue`**

Replace `<ReferenceAction />` (directly under the `h3`) with

```vue
		<div class="rp-inspector-primary">
			<ReferenceAction />
		</div>
```

- [ ] **Step 5: CSS**

Append to `styles/editor-inspector-skeleton.css`:

```css
.renovation-plan-editor .rp-inspector-subline {
	margin: 0;
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}

/* An element in the plan perspective with nothing to edit leaves an empty row group; Vue's
   `v-if` placeholders are comments, which `:empty` ignores. */
.renovation-plan-editor .rp-inspector-actions:empty {
	display: none;
}

/* "More actions": a nested disclosure wearing the sidebar's chevron. */
.renovation-plan-editor .rp-inspector-more {
	margin-top: var(--size-4-2);
}

.renovation-plan-editor .rp-inspector-more > summary {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	min-height: 32px;
	padding: 0 var(--size-4-1);
	font-size: var(--font-ui-small);
	color: var(--text-muted);
	border-radius: var(--radius-s);
	list-style: none;
	cursor: pointer;
}

.renovation-plan-editor .rp-inspector-more > summary::-webkit-details-marker {
	display: none;
}

.renovation-plan-editor .rp-inspector-more > summary:hover {
	background-color: var(--background-modifier-hover);
}

.renovation-plan-editor .rp-inspector-more > summary:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

.renovation-plan-editor .rp-inspector-more[open] > summary > .rp-sidebar-section__chevron {
	transform: none;
}

/*
 * The floor's one primary action. An accent OUTLINE with a tint and weight, not a filled accent:
 * `editor-shell.css` measured white on `--interactive-accent` under 4.5:1 in both schemes, which is
 * why the floating Select button already wears this pattern.
 */
.renovation-plan-editor .rp-inspector-primary > button {
	width: 100%;
	min-height: 32px;
	height: auto;
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-small);
	font-weight: var(--font-semibold);
	color: var(--text-normal);
	white-space: normal;
	background-color: var(--background-modifier-active-hover);
	box-shadow: none;
	border: 1px solid var(--interactive-accent);
	border-radius: var(--radius-s);
	cursor: pointer;
}

.renovation-plan-editor .rp-inspector-primary > button:hover {
	background-color: var(--background-modifier-hover);
}

.renovation-plan-editor .rp-inspector-primary > button:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

.renovation-plan-editor .rp-inspector-primary > button[aria-disabled='true'] {
	color: var(--text-faint);
	border-color: var(--background-modifier-border);
	cursor: not-allowed;
}
```

Delete the rules the new disclosure and rows supersede:
- `styles/editor-selection-details.css`: `.rp-structure-inspector > details`, `.rp-structure-inspector > details > summary`, `.rp-structure-inspector > details[open] > summary`.
- `styles/editor-structure.css`: `.rp-structure-inspector details { margin-block-start: var(--size-4-3); }`.
- `styles/editor-visual-tasks.css`: `.renovation-plan-editor .rp-structure-inspector details { margin-top: 20px; }` and `.renovation-plan-editor .rp-structure-inspector summary { margin-bottom: 12px; }`.
- `styles/editor-object.css`: `.renovation-plan-editor .rp-element-inspector > .rp-dialog-actions { justify-content: flex-start; }`.

- [ ] **Step 6: Run the touched suites and gates**

Run: `npm run check:fast -- tests/harness/structureJourney.test.ts tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/editor/shell tests/presentation/editor/structureLifecycle.test.ts tests/presentation/editor/rotationInspectorRoutes.test.ts tests/presentation/editor/objectCreation.e2e.test.ts tests/presentation/editor/linearElements.e2e.test.ts tests/presentation/editor/openingMove.test.ts tests/build/styles.test.ts tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts`
Expected: PASS.

- [ ] **Step 7: Look at it**

Run `npm run harness-shot`; Read `plan-editor-light.png` (floor state: primary action under the name, stats card) and `plan-editor-multiple.png` (facts card). The wall inspector has no fixed shot; open `npm run harness` with `?view=plan-editor&reference`, draw a wall through Add, select it, and take one screenshot with the Browser pane to check the More disclosure and Delete row.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/structure/StructureInspector.vue src/presentation/editor/elements/ElementInspector.vue src/presentation/editor/shell/FloorInspector.vue styles tests
git commit -m "feat(editor): wall, element and floor Inspectors share the skeleton"
```

---

### Task 12: Harness knob, captures and the axe suite

**Files:**
- Create: `tests/harness/panelsKnob.ts`, `tests/harness/panelsKnob.test.ts`, `tests/harness/accessibilitySidePanels.test.ts`
- Modify: `tests/harness/page.ts`, `tests/harness/planEditor.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts`

**Interfaces:**
- Consumes: Task 5's `.rp-side-panel__toggle[data-rp-panel-toggle]`, `[data-rp-strip]`, `[data-rp-resizer]`.
- Produces: `?panels=collapsed|layers|inspector` on `?view=plan-editor`; `collapsePanelsOnceReady(root: HTMLElement, which: string): Promise<void>`; `PlanEditorHarnessOptions.panels?: string`; five fixed shots `plan-editor-canvas-floor`, `plan-editor-narrow-de`, `plan-editor-panels-collapsed`, `plan-editor-panels-collapsed-dark`, `plan-editor-selected-dark`.

- [ ] **Step 1: Write the failing knob test**

`tests/harness/panelsKnob.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * `?panels=` drives the REAL header buttons, the way every knob in this harness drives a control
 * rather than a store, so a capture of it proves the button works.
 */
import { describe, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

describe('the ?panels knob', () => {
	it.each([
		['collapsed', 2],
		['inspector', 1],
	] as const)('collapses %s through the header buttons', async (which, strips) => {
		installCanvas();
		installResizeObserver();
		const { leafEl: root, view } = mountPlanEditorHarness(document.body, { panels: which });
		resizeTo(sizedShellRoot(root), 1280, 900);
		await settleUntil(() => root.querySelectorAll('[data-rp-strip]').length === strips, `${strips} collapsed strip(s)`);
		expect(root.querySelector('[data-rp-strip="inspector"]')).not.toBeNull();
		await view.onClose();
	});
});
```

Run: `npm run check:fast -- tests/harness/panelsKnob.test.ts`
Expected: FAIL — `panels` is not a known option / no strip appears.

- [ ] **Step 2: The knob**

`tests/harness/panelsKnob.ts`:

```ts
import { settleUntil } from '../helpers/settle';

/**
 * `?panels=collapsed|layers|inspector` (2026-09-12 side panels spec §4): collapses through the
 * real header buttons once the full layout has drawn them. Ends on the click, like
 * `selectMultipleOnceReady`; a caller that needs the strip waits for it itself.
 */
export async function collapsePanelsOnceReady(root: HTMLElement, which: string): Promise<void> {
	const sides = which === 'collapsed' ? ['layers', 'inspector'] : [which];
	await settleUntil(() => root.querySelector('.rp-side-panel__toggle') !== null, 'the side panel headers');
	for (const side of sides) {
		root.querySelector<HTMLButtonElement>(`.rp-side-panel__toggle[data-rp-panel-toggle="${side}"]`)?.click();
	}
}
```

`tests/harness/planEditor.ts`:
- Import `import { collapsePanelsOnceReady } from './panelsKnob';` beside `selectMultipleOnceReady`.
- In `PlanEditorHarnessOptions`, after `add`:
  ```ts
  	/** `collapsed`, `layers` or `inspector`: collapses those full-layout side panels once drawn. */
  	readonly panels?: string;
  ```
- In `mountPlanEditorHarness`, after `if (options.add === true) knobs.push(guardKnob(openAddMenuOnceReady(leafEl)));`:
  ```ts
  	if (options.panels !== undefined) knobs.push(guardKnob(collapsePanelsOnceReady(leafEl, options.panels)));
  ```

`tests/harness/page.ts`: in the `mountPlanEditorHarness(document.body, { … })` literal, after `add: wantsAddMenu,` add `panels: params.get('panels') ?? undefined,`.

Run: `npm run check:fast -- tests/harness/panelsKnob.test.ts tests/harness/harnessSurfaces.test.ts tests/harness/knobRejectionIsolation.test.ts`
Expected: PASS.

- [ ] **Step 3: The axe suite**

`tests/harness/accessibilitySidePanels.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * axe against the full layout's side panels (2026-09-12 side panels spec §4), over the real mounted
 * editor. Each case asserts its subject is on screen before scanning, because a scan of nothing
 * reports no violations too. What this cannot grade — contrast, the resize line's visibility, hit
 * size — is `./axeOptions`' header's list, and the captures' job.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { mountPlanEditor, settle, type EditorHarness } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('axe against the plan editor side panels', { timeout: HARNESS_SCAN_MS }, () => {
	it('reports no semantic violations with both panels collapsed to strips', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			await mounted.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
			await mounted.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
			await settle();

			expect(mounted.wrapper.findAll('[data-rp-strip]')).toHaveLength(2);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	it('reports no semantic violations with a resize handle focused', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			const handle = mounted.wrapper.get('[data-rp-resizer="inspector"]');
			(handle.element as HTMLElement).focus();
			await settle();

			expect(document.activeElement).toBe(handle.element);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});
});
```

Run: `npm run check:fast -- tests/harness/accessibilitySidePanels.test.ts`
Expected: PASS. A violation names a rule and a node: fix the markup (a missing accessible name, an `aria-controls` pointing at no id), never `runOptions`.

- [ ] **Step 4: The fixed shots**

`scripts/harness-shot.mjs`, inside `SHOTS`, directly after the `plan-editor-assets-narrow` entry:

```js
	// The 2026-09-12 side panels: both collapsed to strips, in both schemes, driven through the real
	// header buttons (`?panels`); the full layout at its 900px edge, where the canvas floor shrinks
	// both panels; a selected room in dark; and the German constrained rail.
	{ name: 'plan-editor-panels-collapsed', query: '?view=plan-editor&panels=collapsed&theme=light', selector: ['[data-rp-strip="layers"]', '[data-rp-strip="inspector"]'] },
	{ name: 'plan-editor-panels-collapsed-dark', query: '?view=plan-editor&panels=collapsed', selector: ['[data-rp-strip="layers"]', '[data-rp-strip="inspector"]'] },
	{ name: 'plan-editor-canvas-floor', query: '?view=plan-editor&theme=light', selector: FLOOR_STATE, width: 900 },
	{ name: 'plan-editor-selected-dark', query: '?view=plan-editor&select=harness-kitchen', selector: '.rp-room-inspector' },
	{ name: 'plan-editor-narrow-de', query: '?view=plan-editor&lang=de', selector: [PLAN_CANVAS, '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail'], width: 460 },
```

`tests/build/harness-shot.test.ts`, in the sorted list of `'defines exactly the fixed shots this file lists, in both directions'`:
- after `'plan-editor-assets-narrow',` add `'plan-editor-canvas-floor',`
- after `'plan-editor-narrow',` add `'plan-editor-narrow-de',`, `'plan-editor-panels-collapsed',`, `'plan-editor-panels-collapsed-dark',`
- after `'plan-editor-selected',` add `'plan-editor-selected-dark',`

Run: `npm run check:fast -- tests/build/harness-shot.test.ts`
Expected: PASS.

- [ ] **Step 5: Capture and read**

Run: `npm run harness-shot`
Read all five new PNGs in `harness-shots/`. Check: two 40px strips with a chevron and section icons, no clipped icon; at 900px both panels visibly narrower than at 1280 with the canvas still usable; the dark Inspector matches the light one's structure; the German rail labels wrap without overflowing 460px.

- [ ] **Step 6: Commit**

```bash
git add tests/harness scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "test(editor): side panel knob, captures and axe cases"
```

---

### Task 13: Records, the manual case, and the one full gate

**Files:**
- Create: `docs/tests/cases/Resize and collapse side panels.md`
- Modify: `docs/user-experience/renovation-planner-editor-specs/components/component-library.md`, `docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md`, `docs/development/agent-guide-increment-history.md`

**Interfaces:**
- Consumes: everything above. Produces no code.

- [ ] **Step 1: The manual case**

`docs/tests/cases/Resize and collapse side panels.md`:

```md
# Resize and collapse side panels

Contract: [2026-09-12 side panels design](../../superpowers/specs/2026-09-12-plan-editor-side-panels-design.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin. Open a
plan in the Plan editor in a tab at least 1200px wide.

1. Drag the Inspector's left edge toward the canvas. The line turns accent-coloured, the panel
   follows the pointer, and it stops at its maximum or where the canvas would drop below 320px.
2. Double-click the same edge. The Inspector returns to its default width.
3. Tab to a panel edge, press Arrow keys and Shift+Arrow keys. The edge moves 16px and 64px.
4. Press Enter on the edge. The panel collapses to a narrow strip and focus lands on its expand
   button.
5. On the left strip, click the Walls and openings icon. The panel expands with that section open.
6. Collapse the left panel, quit and restart Obsidian, reopen the plan. The left panel is still
   collapsed and the Inspector keeps the width from step 2.
7. Split the tab so two Plan editors sit side by side under 900px each. Both show the narrow rail;
   widen one past 900px and its panels come back as step 6 left them.
8. Open a second plan in a new tab. It opens with the same layout.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |
```

- [ ] **Step 2: Component library amendments**

In `component-library.md`:
- Retitle `### \`PanelRail\` and \`OverlayPanel\`` to `### \`PanelRail\` and \`EditorSidePanel\``, and after its **Used by:** line add:

  ```md
  **Amended 2026-09-12 (side panels design):** `EditorSidePanel` replaced `OverlayPanel` and
  `InspectorDrawer`. In the full layout it adds a header with a collapse button, a window-splitter
  resize handle (`PanelResizer`) and a collapsed strip (`PanelCollapsedStrip`); widths and collapsed
  state persist per device. In M16's constrained layout it is the overlay or drawer this entry
  always described. **Used by:** M00, M16.
  ```
- Under `### \`InspectorDrawer\``, add: `**Amended 2026-09-12:** implemented as \`EditorSidePanel\`'s constrained presentation; see §4.`
- Under `### \`HomeownerQuestionNav\`` and under `### \`LinkedContentList\``, add: `**Amended 2026-09-12 (side panels design):** while every row is unavailable, the Inspector draws one \`ComingLaterLine\` naming them instead of a row each. A section that gains a query returns as a real row.`

- [ ] **Step 3: M16 note**

In `M16-constrained-workspace.md`, under `## Data and state requirements`, add:

```md
- Full-layout side panel widths and collapsed state, per device (amended 2026-09-12 — the side
  panels design). They do not apply in the constrained layout: a panel collapsed at full width
  still opens as an overlay from the rail, and the rail shares the collapsed strip's surface.
```

- [ ] **Step 4: Increment history**

Append to `docs/development/agent-guide-increment-history.md`:

```md
## Resizable and collapsible side panels, 2026-09-12

Why: both Plan editor side panels had fixed widths, could not be put away, and had drifted from
M00 — three stylesheet partials each overrode the last one's panel rules. The user asked for
resizable, collapsible panels and a redesign of both.

**Mechanics.** `panelLayout.ts` is pure: bounds (200–400 and 280–520 px), a parse that defaults any
field it does not trust, and `effectivePanelWidths`, which shrinks expanded panels in proportion so
the canvas keeps 320px without rewriting the stored widths. `WorkspaceStore.panelLayout` holds the
per-leaf copy; `ResponsiveEditorShell` restores it from a per-device `DeviceStorage`
(`DeviceLocalStore` over `App.loadLocalStorage`) before its first render and writes it on a
committed change only — a key press, a drag's release, a toggle — never per pointer move.
`EditorSidePanel` replaced `OverlayPanel`/`InspectorDrawer` and keeps M16's constrained classes
byte-for-byte, because `responsiveShell`, `persistentRegions` and `useDimensionObstacles` name them.

**Content.** One section header (`PanelSection`, host-icon chevron), one list-row selected state
(an inset accent rule beside the fill and `aria-pressed`), sidebar padlocks shown only when locked or
on hover/focus, and one Inspector skeleton: facts card, toolbar, action rows, feature sections, a
Coming later line replacing seven "Not available yet" rows, and Delete at the foot with only its
icon red.

**Deviations from the spec, each for a test that pins the old shape rather than taste:** no identity
subline for a room (its `dl` carries type, area and status, and `roomInspector.test.ts` reads status
there); Inspector feature sections are not collapsible (a disclosure around Requirements bought
nothing its heading does not); multiple selection keeps Clear at its foot
(`multiSelectionInspector.test.ts` requires it to be the last button).

**Not run:** `docs/tests/cases/Resize and collapse side panels.md` — whether Obsidian's own pane
resizing and a restart behave as the jsdom rig says is outside every gate here.
```

- [ ] **Step 5: The one full gate**

Run: `npm run check`
Expected: build, lint, coverage-thresholded tests and fallow all green. On a coverage floor miss, read `coverage/coverage-final.json` for the changed files and add the missing case rather than lowering anything. On a fallow `unused-class-members` for `DeviceLocalStore`, confirm the plugin's `panelLayoutStore` field is typed `DeviceStorage` (Task 3). On a `beforeAll` ESLint boot timeout in `tests/build/`, re-run that file with `--no-file-parallelism` before believing it.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs(editor): side panels — manual case, component library, M16 and increment history"
```

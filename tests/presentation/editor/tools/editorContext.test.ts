/**
 * `EditorContext` (SDD §58, design slice 6): the entire API a tool gets. Two things this
 * suite pins beyond plain wiring, because they are both project Definition-of-Done items
 * routed here (see the task-8 brief and progress.md Ruling 13):
 *
 * - **DoD 11** — the facade's own type surface is exactly the seven spec members, and no
 *   member (at any depth) exposes a function shaped like a repository method
 *   (`getById`/`save`/`delete`/`listBy*`). That is a runtime check over a real
 *   `EditorContext` built from stub deps, plus a check that the walker doing the work can
 *   actually find a planted violation — a matcher that never fires would make the
 *   "exposes no repository member" assertion vacuously true. The walker does not descend
 *   a class instance's prototype chain (see its own docstring below), so a repository
 *   passed as a class instance rather than a plain object would keep `getById` invisible
 *   to it — a real blind spot, not a hypothetical one to dismiss.
 * - **DoD 8** — `SelectionStore`'s type contains only domain IDs; no Konva node/ref type
 *   is reachable from it. This is a claim about a TYPE, which nothing at runtime can see
 *   directly, so it is checked the way
 *   `tests/presentation/editor/declarations.test.ts` checks its own category invariant:
 *   read the one module that produces the type (`selection-store.ts`) as text and look
 *   for an IMPORT from `konva` or `vue-konva`, including a subpath import
 *   (`konva/lib/Node`, `vue-konva/lib/...`) — Konva's own `package.json` `exports` map
 *   declares `./lib/*`, and that is where its type-only exports (e.g.
 *   `KonvaEventObject`) actually live, so a subpath is not an exotic form to miss. Without
 *   any such import, nothing in that file's type positions can name a Konva type at all —
 *   TypeScript has no ambient `Konva` global anywhere Konva's or vue-konva's own types
 *   declare, nor anywhere in this codebase (`grep -rn "declare global" src/` finds
 *   nothing) for a bare identifier to resolve against, so an import is the only way a
 *   Konva type could become reachable here. The check is deliberately an IMPORT check and
 *   not a bare-word search for `Konva`: this file's own prose already says "No Konva node,
 *   ref, or shape is reachable from this store" in a doc comment, and a bare-word matcher
 *   flagged that comment as a violation the first time this test ran — a real false
 *   positive, caught by running the test, not reasoned about in advance. What this check
 *   still cannot see: a Konva type reached through a field whose OWN module imports Konva
 *   two hops away (`SelectionStore`'s only field type, `EntityId`, does not, so today
 *   there is no such hop to miss) or a Konva import written some other way (`await
 *   import('konva')`, `require('konva')`) that this codebase's ESM style does not use.
 *   The instrument is tested before it is trusted, same as that file's precedent, and it
 *   is also checked for a required PRESENCE, not only an absence: a positive assertion
 *   confirms the store's own runtime keys stay exactly the domain-ID surface, so a future
 *   field like `nodes: ref<unknown[]>` would fail this suite even though it names no
 *   Konva type at all.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { ok } from '../../../../src/core/result/Result';
import type { Result } from '../../../../src/core/result/Result';
import type { AppError } from '../../../../src/core/errors/AppError';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { SnapService } from '../../../../src/presentation/editor/snapping/snap-service';
import { RenderState } from '../../../../src/presentation/editor/tools/render-state';
import { screenPoint, type Point, type ScreenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import {
	createEditorContext,
	type EditorContext,
	type EditorContextDeps,
} from '../../../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import {
	useSelectionStore,
	type SelectionStore,
} from '../../../../src/presentation/editor/selection/selection-store';

const SRC = fileURLToPath(new URL('../../../../src/', import.meta.url));
const SELECTION_STORE_MODULE = 'presentation/editor/selection/selection-store.ts';

/**
 * Matches an ES-module import from `konva` or `vue-konva`, including a subpath of either
 * (`konva/lib/Node`, `vue-konva/lib/...`) — the only way a Konva type can become nameable
 * in a file this codebase's ESM style (no ambient `Konva` global, no `require`). The
 * subpath form matters, not just the bare package: Konva's `package.json` `exports` map
 * declares `./lib/*`, and that is where its type-only exports live, so
 * `import type { KonvaEventObject } from 'konva/lib/Node'` is the realistic way a
 * slice-6 tool typing a pointer event would reach for a Konva type — an earlier, narrower
 * version of this pattern (`from 'konva'` / `from 'vue-konva'` only, no subpath) missed
 * exactly that form.
 *
 * Deliberately NOT a bare-word search for `Konva`: `selection-store.ts`'s own doc comment
 * already reads "No Konva node, ref, or shape is reachable from this store", and a
 * bare-word matcher flags that prose as a violation — a real false positive hit while
 * writing this test, not a hypothetical one.
 */
const KONVA_IMPORT = /from\s+['"](?:vue-)?konva(?:\/[^'"]*)?['"]/;

function stubSelection(): SelectionStore {
	return {
		selectedIds: [],
		select: () => undefined,
		clear: () => undefined,
		isSelected: () => false,
	} as unknown as SelectionStore;
}

function stubViewport(): EditorContext['viewport'] {
	return {
		worldToScreen: (p: Point): ScreenPoint => screenPoint(p.x, p.y),
		screenToWorld: (p: ScreenPoint): Point => ({ x: p.x, y: p.y }),
		setPan: () => undefined,
		setZoom: () => undefined,
	};
}

function stubDeps(): EditorContextDeps {
	return {
		bindViewport: stubViewport,
		selection: stubSelection(),
		snapService: new SnapService({ gridSpacingMm: 100, toleranceMm: 10, angleStepRadians: Math.PI / 2 }),
		commandDispatcher: {
			run: (_command: UndoableCommand): Promise<Result<void, AppError>> => Promise.resolve(ok(undefined)),
		},
		writeLedger: new SessionWriteLedger(),
		renderState: new RenderState(),
		activePlan: { id: createPlanId(), calibration: null },
	};
}

const SPEC_MEMBERS = [
	'viewport',
	'selection',
	'snapService',
	'commandDispatcher',
	'writeLedger',
	'renderState',
	'activePlan',
].toSorted();

/** Property names shaped like a repository or Vault-API method — the surface DoD 11 bans. */
const FORBIDDEN_NAME = /^(getById|save|delete|listBy[A-Za-z]*)$/;

/**
 * Every own-property path under `value` whose value is a function named like a
 * repository method. Recurses into any nested object — arrays included, since
 * `Object.entries` on an array yields its indices as keys, which never match
 * `FORBIDDEN_NAME` and so never change the result — and never revisits an object already
 * seen. It does NOT walk a class instance's prototype chain: `Object.entries` sees only
 * own enumerable properties, so a repository passed as a class instance (`getById` defined
 * on its prototype, not as an own property) would be invisible to this walker. That is a
 * real blind spot, not exercised here because every stub in this suite is a plain object or
 * closure — enough for `EditorContext`'s own shape, not a general instrument for an
 * arbitrary class-shaped dependency.
 */
function repositoryShapedMembers(value: unknown, path = 'context', seen = new Set<unknown>()): string[] {
	if (value === null || typeof value !== 'object' || seen.has(value)) {
		return [];
	}
	seen.add(value);
	const found: string[] = [];
	for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
		const memberPath = `${path}.${key}`;
		if (typeof member === 'function') {
			if (FORBIDDEN_NAME.test(key)) {
				found.push(memberPath);
			}
		} else if (typeof member === 'object' && member !== null) {
			found.push(...repositoryShapedMembers(member, memberPath, seen));
		}
	}
	return found;
}

describe('the repository-shaped-member instrument', () => {
	it('finds a planted violation at the top level and nested', () => {
		expect(repositoryShapedMembers({ save: () => undefined })).toEqual(['context.save']);
		expect(repositoryShapedMembers({ nested: { getById: () => undefined } })).toEqual([
			'context.nested.getById',
		]);
		expect(repositoryShapedMembers({ nested: { listByPlan: () => undefined } })).toEqual([
			'context.nested.listByPlan',
		]);
	});

	it('does not match an ordinary method name', () => {
		expect(repositoryShapedMembers({ run: () => undefined, select: () => undefined })).toEqual([]);
	});
});

describe('the Konva-import instrument', () => {
	it('matches an import from either package', () => {
		expect(KONVA_IMPORT.test("import type { Node } from 'konva';")).toBe(true);
		expect(KONVA_IMPORT.test("import { Stage } from 'vue-konva';")).toBe(true);
	});

	it('matches a subpath import — the realistic form for a Konva TYPE-only import', () => {
		// Planted because an earlier, narrower version of KONVA_IMPORT (bare package name
		// only) missed exactly this: Konva's package.json exports map declares `./lib/*`,
		// and that is where its type-only exports (e.g. KonvaEventObject) live.
		expect(KONVA_IMPORT.test("import type { KonvaEventObject } from 'konva/lib/Node';")).toBe(true);
		expect(KONVA_IMPORT.test("import type { Foo } from 'vue-konva/lib/components/Stage';")).toBe(true);
	});

	it('does not match ordinary source, including prose that merely MENTIONS Konva', () => {
		expect(KONVA_IMPORT.test("import { defineStore } from 'pinia';\nimport { ref } from 'vue';")).toBe(false);
		// The false positive this test exists to rule out: a bare-word matcher would flag
		// this comment, which asserts the ABSENCE of Konva, as though it were a violation.
		expect(KONVA_IMPORT.test('// No Konva node, ref, or shape is reachable from this store.')).toBe(false);
	});
});

describe('EditorContext', () => {
	it('wires every dep straight through, and calls bindViewport exactly once for the live viewport facade', () => {
		const deps = stubDeps();
		const viewport = stubViewport();
		let calls = 0;
		deps.bindViewport = () => {
			calls += 1;
			return viewport;
		};

		const context = createEditorContext(deps);

		expect(calls).toBe(1);
		expect(context.viewport).toBe(viewport);
		expect(context.selection).toBe(deps.selection);
		expect(context.snapService).toBe(deps.snapService);
		expect(context.commandDispatcher).toBe(deps.commandDispatcher);
		expect(context.writeLedger).toBe(deps.writeLedger);
		expect(context.renderState).toBe(deps.renderState);
		expect(context.activePlan).toBe(deps.activePlan);
	});

	it('DoD 11: has exactly the seven spec members, nothing more and nothing fewer', () => {
		const context = createEditorContext(stubDeps());

		expect(Object.keys(context).toSorted()).toEqual(SPEC_MEMBERS);
	});

	it('DoD 11: exposes no repository- or Vault-API-shaped member at any depth', () => {
		const context = createEditorContext(stubDeps());

		expect(repositoryShapedMembers(context)).toEqual([]);
	});

	it('DoD 8 (the absence half): the module that declares SelectionStore never imports Konva or vue-konva', () => {
		const source = readFileSync(join(SRC, SELECTION_STORE_MODULE), 'utf8');

		expect(KONVA_IMPORT.test(source)).toBe(false);
	});

	it('DoD 8 (the presence half): the store exposes exactly its declared domain-ID surface, nothing more', () => {
		// The absence check above only ever fails on an ADDED import; a field grown without
		// one (e.g. `nodes: ref<unknown[]>` fed by a render-model lookup) would pass it
		// silently. This asserts the store's real runtime shape — Pinia's own `$`- and
		// `_`-prefixed machinery stripped — is exactly the four SelectionStore members,
		// mirroring declarations.test.ts's own "asserts both an absence and a required
		// presence" shape rather than checking only one half of it.
		setActivePinia(createPinia());
		const store = useSelectionStore();
		const ownKeys = Object.keys(store).filter((key) => !key.startsWith('$') && !key.startsWith('_'));

		expect(ownKeys.toSorted()).toEqual(['selectedIds', 'select', 'clear', 'isSelected'].toSorted());
	});
});

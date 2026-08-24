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
 *   "exposes no repository member" assertion vacuously true.
 * - **DoD 8** — `SelectionStore`'s type contains only domain IDs; no Konva node/ref type
 *   is reachable from it. This is a claim about a TYPE, which nothing at runtime can see
 *   directly, so it is checked the way
 *   `tests/presentation/editor/declarations.test.ts` checks its own category invariant:
 *   read the one module that produces the type (`selection-store.ts`) as text and look
 *   for an IMPORT from `konva`/`vue-konva`. Without one, nothing in that file's type
 *   positions can name a Konva type at all — TypeScript has no ambient `Konva` global in
 *   this codebase (`grep -rn "declare global" src/` finds none) for a bare identifier to
 *   resolve against, so an import is the only way a Konva type could become reachable
 *   here. The check is deliberately an IMPORT check and not a bare-word search for
 *   `Konva`: this file's own prose already says "No Konva node, ref, or shape is
 *   reachable from this store" in a doc comment, and a bare-word matcher flagged that
 *   comment as a violation the first time this test ran — a real false positive, caught by
 *   running the test, not reasoned about in advance. What this narrower check still cannot
 *   see: a Konva type reached through a field whose OWN module imports Konva two hops away
 *   (`SelectionStore`'s only field type, `EntityId`, does not, so today there is no such
 *   hop to miss) or a Konva import written some other way (`await import('konva')`,
 *   `require('konva')`) that this codebase's ESM style does not use. The instrument is
 *   tested before it is trusted, same as that file's precedent.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import type { SelectionStore } from '../../../../src/presentation/editor/selection/selection-store';

const SRC = fileURLToPath(new URL('../../../../src/', import.meta.url));
const SELECTION_STORE_MODULE = 'presentation/editor/selection/selection-store.ts';

/**
 * Matches an ES-module import from `konva` or `vue-konva` — the only way a Konva type
 * can become nameable in a file this codebase's ESM style (no ambient `Konva` global, no
 * `require`). Deliberately NOT a bare-word search for `Konva`: `selection-store.ts`'s own
 * doc comment already reads "No Konva node, ref, or shape is reachable from this store",
 * and a bare-word matcher flags that prose as a violation — a real false positive hit while
 * writing this test, not a hypothetical one.
 */
const KONVA_IMPORT = /from\s+['"]konva['"]|from\s+['"]vue-konva['"]/;

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
 * repository method. Walks plain objects only (not arrays, class instances' prototype
 * chain, or anything already visited), which is enough for a facade of plain objects and
 * closures — `EditorContext`'s own shape.
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

	it('DoD 8: the module that declares SelectionStore never imports Konva or vue-konva', () => {
		const source = readFileSync(join(SRC, SELECTION_STORE_MODULE), 'utf8');

		expect(KONVA_IMPORT.test(source)).toBe(false);
	});
});

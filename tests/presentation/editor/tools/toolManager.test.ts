import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import type { EditorTool, EditorPointerEvent, ToolId } from '../../../../src/presentation/editor/tools/editor-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

/**
 * A fake `EditorTool` that records every lifecycle call it receives, in order, onto a
 * shared array — `id:method` per entry — so a test can assert the SEQUENCE
 * (`toEqual([...])`), not just per-method call counts. Counting alone cannot distinguish
 * `[cancel, deactivate, activate]` from `[activate, cancel, deactivate]`, and ordering is
 * exactly what DoD 1 requires.
 */
function fakeTool(id: ToolId, calls: string[]): EditorTool {
	return {
		id,
		activate: vi.fn<(context: EditorContext) => void>(() => {
			calls.push(`${id}:activate`);
		}),
		deactivate: vi.fn<() => void>(() => {
			calls.push(`${id}:deactivate`);
		}),
		pointerDown: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerDown`);
		}),
		pointerMove: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerMove`);
		}),
		pointerUp: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerUp`);
		}),
		cancel: vi.fn<() => void>(() => {
			calls.push(`${id}:cancel`);
		}),
	};
}

function pointerEvent(): EditorPointerEvent {
	return {
		worldPoint: { x: 1, y: 2 },
		screenPoint: screenPoint(3, 4),
		button: 'primary',
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
}

/** Never read by `ToolManager` — only ever passed through, so identity is what matters. */
function fakeContext(): EditorContext {
	return {} as EditorContext;
}

describe('ToolManager', () => {
	it('clearActiveTool runs the switch lifecycle back to no tool (design slice 8 camera mode)', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');

		manager.clearActiveTool();

		expect(calls).toEqual(['select:activate', 'select:deactivate']);
		expect(manager.activeToolId).toBeNull();
	});

	it('clearActiveTool cancels an in-flight gesture first, and is a no-op with no active tool', () => {
		const calls: string[] = [];
		const draw = fakeTool('draw-polygon', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(draw);
		manager.setActiveTool('draw-polygon');
		manager.pointerDown(pointerEvent());
		calls.length = 0;

		manager.clearActiveTool();
		expect(calls).toEqual(['draw-polygon:cancel', 'draw-polygon:deactivate']);

		// A second clear is a no-op — no cancel of a tool that is not there.
		manager.clearActiveTool();
		expect(calls).toEqual(['draw-polygon:cancel', 'draw-polygon:deactivate']);
	});

	it('registers a tool and activates it with a context from the factory', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const context = fakeContext();
		const manager = new ToolManager(() => context);

		manager.register(select);
		manager.setActiveTool('select');

		expect(calls).toEqual(['select:activate']);
		expect(select.activate).toHaveBeenCalledExactlyOnceWith(context);
		expect(manager.activeToolId).toBe('select');
	});

	it('calls the context factory fresh on every activation, not once at construction', () => {
		let factoryCalls = 0;
		const contexts: EditorContext[] = [];
		const manager = new ToolManager(() => {
			factoryCalls += 1;
			const context = fakeContext();
			contexts.push(context);
			return context;
		});
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		manager.register(select);
		manager.register(pan);

		expect(factoryCalls).toBe(0); // never called just for registering

		manager.setActiveTool('select');
		expect(factoryCalls).toBe(1);

		manager.setActiveTool('pan');
		expect(factoryCalls).toBe(2);
		expect(select.activate).toHaveBeenCalledExactlyOnceWith(contexts[0]);
		expect(pan.activate).toHaveBeenCalledExactlyOnceWith(contexts[1]);
	});

	it('switches tools with no gesture in flight: deactivate then activate, and cancel is never called', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:deactivate', 'pan:activate']);
		expect(select.cancel).not.toHaveBeenCalled();
		expect(select.deactivate).toHaveBeenCalledTimes(1);
		expect(pan.activate).toHaveBeenCalledTimes(1);
	});

	it('switches tools mid-gesture: cancel, then deactivate, then activate, in that order', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent()); // marks a gesture in flight
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:cancel', 'select:deactivate', 'pan:activate']);
		expect(select.cancel).toHaveBeenCalledTimes(1);
	});

	it('setting the already-active id is a no-op: no cancel, no deactivate, no re-activate', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		calls.length = 0;

		manager.setActiveTool('select');

		expect(calls).toEqual([]);
		expect(select.deactivate).not.toHaveBeenCalled();
		expect(select.cancel).not.toHaveBeenCalled();
		expect(select.activate).toHaveBeenCalledTimes(1); // only the first setActiveTool
	});

	it('setting the already-active id mid-gesture is still a no-op: no cancel', () => {
		// The no-op guard must run before the gesture-in-flight check, or a re-select while
		// dragging would spuriously cancel the very gesture the user did not switch away from.
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		calls.length = 0;

		manager.setActiveTool('select');

		expect(calls).toEqual([]);
		expect(select.cancel).not.toHaveBeenCalled();
	});

	it('throws for an unregistered tool id', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => manager.setActiveTool('select')).toThrow(/select/);
		expect(manager.activeToolId).toBeNull();
	});

	it('throws when a second tool registers for an id already taken', () => {
		const calls: string[] = [];
		const manager = new ToolManager(fakeContext);
		manager.register(fakeTool('select', calls));

		expect(() => manager.register(fakeTool('select', calls))).toThrow(/select/);
	});

	it('pointer events with no active tool are a no-op, not a throw', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => manager.pointerDown(pointerEvent())).not.toThrow();
		expect(() => manager.pointerMove(pointerEvent())).not.toThrow();
		expect(() => manager.pointerUp(pointerEvent())).not.toThrow();
		expect(manager.activeToolId).toBeNull();
	});

	it('forwards pointerDown/pointerMove/pointerUp to the active tool with the same event', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		const down = pointerEvent();
		const move = pointerEvent();
		const up = pointerEvent();

		manager.pointerDown(down);
		manager.pointerMove(move);
		manager.pointerUp(up);

		expect(select.pointerDown).toHaveBeenCalledExactlyOnceWith(down);
		expect(select.pointerMove).toHaveBeenCalledExactlyOnceWith(move);
		expect(select.pointerUp).toHaveBeenCalledExactlyOnceWith(up);
	});

	it('pointerUp clears the in-flight gesture, so a later switch does not cancel', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent());
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:deactivate', 'pan:activate']); // no cancel
	});

	it('cancelGesture(), e.g. on Escape, cancels the active tool once and clears the in-flight flag', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		calls.length = 0;

		manager.cancelGesture();

		expect(calls).toEqual(['select:cancel']);
		expect(select.cancel).toHaveBeenCalledTimes(1);

		// The flag is cleared: a switch right after must not cancel a second time.
		calls.length = 0;
		manager.setActiveTool('pan');
		expect(calls).toEqual(['select:deactivate', 'pan:activate']);
	});

	it('cancelGesture() reaches the active tool even with NO gesture in flight (design slice 8)', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		calls.length = 0;

		// No pointerDown ever fired: a multi-click tool (the polygon buffer, the
		// calibration prompt) sits between clicks with the in-flight flag false, and
		// Escape must still reach it. A real mouse always delivers pointerUp, so a
		// down-without-up sequence is not a state a drag produces — it is the state a
		// multi-click gesture LIVES in.
		manager.cancelGesture();

		expect(calls).toEqual(['select:cancel']);
	});

	it('cancelGesture() with no active tool at all does nothing and does not throw', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => {
			manager.cancelGesture();
		}).not.toThrow();
	});
});

/**
 * DoD 12 — "No tool-specific branching exists inside `ToolManager` or `EditorContext`" —
 * as a check rather than as the sentence `tool-manager.ts`'s own header states ("There is
 * no `if (tool.id === '...')` anywhere in this file, and there must never be one").
 *
 * This is a category invariant: "nothing in these two files special-cases a tool." Driving
 * the paths somebody thought of cannot establish it, because the next branch is the one
 * that breaks it — so the check goes at the forbidden thing, and holds for code not yet
 * written (CLAUDE.md, "A category invariant is checked at the forbidden thing").
 *
 * **What it looks for, and why that rather than the `if` shape.** Not a pattern for
 * `if (tool.id === '…')`: a special case can be a `switch`, a ternary, an `includes`, a
 * lookup table, or an early return, and a matcher for one spelling would report nothing
 * about the other five while reading as though it covered them. What every one of them
 * MUST do is name a tool — and the only way to name one in these files is a `ToolId`
 * string literal. So the check is: **no `ToolId` literal appears in either file's code.**
 * The roster is read out of `editor-tool.ts`'s own union rather than copied here, so a
 * seventh tool is covered the day it is declared.
 *
 * **What it cannot see**, stated rather than implied:
 * - a tool id reached through an imported constant (`TOOL_IDS.select`) or a variable, so
 *   that the literal never appears in these files at all;
 * - a branch keyed on something that merely CORRELATES with one tool — a field only one
 *   tool sets, say — since nothing about that names a tool;
 * - a `//` sequence inside a string literal, which the comment stripper below removes as
 *   though it were a comment. No such string exists in either file today.
 *
 * Comments are stripped before the search, and that is load-bearing rather than tidy:
 * `tool-manager.ts`'s header today names tools only in backticks (`select`, `pan`,
 * `draw-polygon`) and writes the forbidden shape with a literal ellipsis
 * (`if (tool.id === '...')`), so no `ToolId` string literal actually appears there — but a
 * future comment that quotes a real id in single quotes (the shape the "does not flag
 * prose that merely NAMES a tool id in a comment" test below plants) would flag the very
 * paragraph asserting the rule as though it broke it, the same shape of false positive
 * `editorContext.test.ts`'s Konva check already records hitting on a bare word.
 *
 * The instrument is tested before it is trusted (first `describe` below): a regex matching
 * nothing would make every assertion here pass while proving the opposite.
 */
const SRC = fileURLToPath(new URL('../../../../src/', import.meta.url));
const EDITOR_TOOL_MODULE = 'presentation/editor/tools/editor-tool.ts';
/** The two modules DoD 12 names. */
const FRAMEWORK_MODULES = [
	'presentation/editor/tools/tool-manager.ts',
	'presentation/editor/tools/editor-context.ts',
];

function readSource(relative: string): string {
	return readFileSync(join(SRC, relative), 'utf8');
}

/** Block and line comments removed. The `[^:]` guard keeps a `://` inside a URL from
 * reading as a line comment; a `//` inside any other string literal still would. */
function withoutComments(source: string): string {
	return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every member of `editor-tool.ts`'s `ToolId` union, read from the union itself. */
function toolIds(): string[] {
	const declaration = /export type ToolId =([^;]+);/.exec(readSource(EDITOR_TOOL_MODULE));
	if (declaration === null) throw new Error('ToolId union not found — this instrument is pointed at the wrong thing');
	return [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

/** Every `ToolId` string literal appearing in `source`'s code. */
function toolIdLiterals(source: string, ids: readonly string[]): string[] {
	const code = withoutComments(source);
	return ids.filter((id) => code.includes(`'${id}'`));
}

describe('the tool-specific-branching instrument', () => {
	it('reads the whole ToolId roster out of the union that declares it', () => {
		const ids = toolIds();

		// A roster that came back empty or short would make every assertion below vacuous.
		expect(ids.length).toBeGreaterThanOrEqual(6);
		expect(ids).toContain('select');
		expect(ids).toContain('calibrate');
	});

	it('finds a planted special case, in each shape one could take', () => {
		const ids = toolIds();

		expect(toolIdLiterals("if (tool.id === 'select') { return; }", ids)).toEqual(['select']);
		expect(toolIdLiterals("switch (tool.id) { case 'pan': break; }", ids)).toEqual(['pan']);
		expect(toolIdLiterals("const x = tool.id === 'measure' ? a : b;", ids)).toEqual(['measure']);
		expect(toolIdLiterals("if (['pan', 'select'].includes(tool.id)) return;", ids)).toEqual(['select', 'pan']);
	});

	it('does not flag prose that merely NAMES a tool id in a comment', () => {
		const ids = toolIds();

		// The risk this guards against: a comment stating the rule while quoting an id in
		// single quotes, as these synthetic examples do, would read as a violation to a
		// matcher run over raw text before comments are stripped — not something
		// `tool-manager.ts`'s actual header does today, but a shape a future one could.
		expect(toolIdLiterals("// never write if (tool.id === 'select')", ids)).toEqual([]);
		expect(toolIdLiterals("/**\n * Knows nothing about 'select' or 'pan'.\n */", ids)).toEqual([]);
		expect(toolIdLiterals('const registered = this.tools.get(id);', ids)).toEqual([]);
	});
});

describe('DoD 12: the framework knows no tool by name', () => {
	it.each(FRAMEWORK_MODULES)('%s names no ToolId in its code', (module) => {
		expect(toolIdLiterals(readSource(module), toolIds())).toEqual([]);
	});
});

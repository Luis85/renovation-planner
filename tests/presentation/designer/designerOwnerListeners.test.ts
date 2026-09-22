/**
 * "Nothing under `src/presentation/designer/` registers a DOM event listener."
 *
 * AD15-R2 ruled T27's note-editor half structural and recorded its losing side as LIVE rather
 * than refused: *"a source-scan category check that nothing under `src/presentation/designer/`
 * registers an owner-level key listener would hold for code not yet written, and lost only on
 * scope."* This is that check. It is a category check at the FORBIDDEN THING — the registration
 * call — rather than a drive of the key paths somebody remembered, so it holds for components
 * nobody has written yet, which is the whole reason the losing side was worth keeping.
 *
 * **The claim here is WIDER than T27's, deliberately.** T27 is about an OWNER-level listener —
 * one on `document` or `window`, above the designer's own subtree, which is what a keystroke in
 * a Markdown or CodeMirror leaf would have to reach. This refuses any of the three doors below
 * on ANY target, element-local included. Narrowing it to owner targets would mean deciding from
 * the CALLEE's text whether a receiver is `document`, `window` or an element, and that decision
 * is wrong the moment the target is held in a variable (`const owner = el.ownerDocument; …`) —
 * a check that can be stepped around by a local is not a category check. The wider claim is true
 * today (measured below), implies the narrower one, and its cost when a designer component one
 * day needs a genuine element-local listener is that this file turns red and a reviewer sees the
 * decision. `LISTENER_DOORS` is the extension point either way.
 *
 * **The file set is the DIRECTORY, not the composed tree, and that is a choice with a
 * measurement behind it.** Every `.ts` and `.vue` under `src/presentation/designer/` — 67 files
 * when this was written, pinned as non-empty rather than as a count. The alternative was
 * `reachableFrom('src/presentation/designer/AssetDesignerView.ts', …)`, which reaches 232 files,
 * 167 of them outside this directory. Five FILES among those 167 register a listener, and the
 * number is labelled because the first version of this paragraph said six — `notify.ts`'s six
 * CALLS, read as a file count, which is CLAUDE.md's *"a false sentence FROM a correct count"*
 * exactly. They are `use-owner-listener` (the shared composable itself), `use-disclosure-dismissal`
 * and `EditorSurface.vue` (its two callers, a `'document'`/`'pointerdown'` dismissal and a
 * `'window'`/`'blur'`), `followPixelRatio` (a media query), and `notify.ts` (six listeners on the
 * toast it builds). Naming them is what settles this; the count is a convenience.
 * None is a KEY listener, so T27's claim survives the composed tree — but a scan of it would be
 * red on modules this directory does not own, and exempting them by name would turn a category
 * check back into a list. So: the directory is the claim, and what it excludes is a component
 * OUTSIDE the directory that the designer mounts and that listens on its own. Note the shared
 * composable is NOT an escape: `listenOnOwner` is declared elsewhere but CALLED at the call
 * site, so a designer component reaching for it is a hit here.
 *
 * **What the instrument sees.** `tests/helpers/parsedSource.ts` — the TypeScript parser for a
 * script, `@vue/compiler-sfc` for an SFC's `<script>` and `<script setup>` blocks. A comment or
 * a string spelling `addEventListener` is not a node, which is the difference from the grep that
 * measured this first. `callsOf` matches a bare callee or the named property on any receiver, so
 * `window.addEventListener`, `el.addEventListener` and a bare `listenOnOwner(…)` are all hits.
 *
 * **What it does NOT see**, named here rather than left to read as wider than it is:
 *
 * - a door reached under another name — an alias (`const on = el.addEventListener`), a computed
 *   member (`el['add' + 'EventListener']`), or a helper in another directory that registers on
 *   its caller's behalf and is not one of `LISTENER_DOORS`. That is the same bound
 *   `registration-locality.test.ts` names for the same technique;
 * - a HANDLER PROPERTY: `el.onkeydown = handler` registers a listener and is not a CALL, so
 *   `callsOf` structurally cannot see it. Named as a blind spot rather than closed, because the
 *   claim does not need it — `grep -rnE "\.(on[a-z]+)\s*=" src/presentation/designer/` exits 1 and
 *   the same grep over all of `src/` finds no assignment either — and because closing it means
 *   `assignedTo`, which matches ONE spelled left side, so covering the shape would mean
 *   enumerating handler property names: a list inside a category check, which is the thing this
 *   file exists instead of;
 * - a TEMPLATE: an SFC's `<template>` block is not parsed here at all. That is deliberate and
 *   is the point — a `@keydown` binding is element-local by construction. T27 recorded nine key
 *   doors; eight are real bindings today (seven `@keydown` plus `AssetPresetForm.vue`'s
 *   `:on-keydown` prop), the ninth hit being prose inside `AssetDesignerRoot.vue`'s own docblock;
 * - anything at RUNTIME. This is a source scan, so a listener a dependency installs on the
 *   designer's behalf (Konva's own stage listeners, for instance) is outside it.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../../helpers/repo';
import { toPosix } from '../../helpers/posix';
import { type ParsedScript, callsOf, parseScript, parseSource } from '../../helpers/parsedSource';

/**
 * The registration doors this plugin actually has, counted by grepping `src/` in the same edit
 * as this list: `addEventListener` (the platform's own, however the receiver is spelled),
 * `listenOnOwner` (`src/presentation/composables/use-owner-listener.ts`, whose entire product is
 * a listener on the owner document or window) and `registerDomEvent` (Obsidian's, which
 * `registration-locality.test.ts` separately confines to `src/plugin/`). A door added here is a
 * door this check starts covering.
 */
const LISTENER_DOORS = ['addEventListener', 'listenOnOwner', 'registerDomEvent'] as const;

const DESIGNER = 'src/presentation/designer';

/** Every hit as `<callee> in <file>`, so a failure names the call and not merely a count. */
function listenerCallsIn(file: string, script: ParsedScript): string[] {
	return LISTENER_DOORS.flatMap((door) => callsOf(script.file, script, door).map((call) => `${call.callee} in ${file}`));
}

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(join(REPO, dir)).flatMap((name) => {
		const path = `${dir}/${name}`;
		if (statSync(join(REPO, path)).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [toPosix(path)] : [];
	});
}

const scan = (dir: string): string[] => sourceFilesUnder(dir).flatMap((file) => listenerCallsIn(file, parseScript(join(REPO, file)))).toSorted();

describe('the listener scan', () => {
	// An instrument that reaches nothing looks exactly like a clean tree, so it is proven to
	// REPORT a violation before it is pointed at `src/`. Fixtures are parsed from TEXT rather
	// than planted on disk: `tests/presentation/designer/` is a directory other cards' tests
	// walk, and a probe file written into a walked directory is the race
	// `tests/helpers/plantedProbe.ts` exists because of.
	it.each([
		['an owner-level key listener', "window.addEventListener('keydown', onKey);"],
		['one on the owner document', "el.ownerDocument.addEventListener('keydown', onKey);"],
		['one through the shared composable', "const stop = listenOnOwner(el, 'document', 'keydown', onKey);"],
		["Obsidian's own door", "this.registerDomEvent(document, 'keydown', onKey);"],
		['an element-local one, which this check refuses too', "root.addEventListener('wheel', onWheel);"],
	])('reports %s', (_what, source) => {
		expect(listenerCallsIn('fixture.ts', parseSource('fixture.ts', source))).toHaveLength(1);
	});

	it.each([
		['a comment spelling one', "// nothing here calls window.addEventListener('keydown', …)\nconst x = 1;"],
		['a string spelling one', "const doc = 'addEventListener';"],
		['a template-bound handler, which is what the designer actually uses', 'const onKeydown = (event: KeyboardEvent): void => event.stopPropagation();'],
	])('does not report %s', (_what, source) => {
		expect(listenerCallsIn('fixture.ts', parseSource('fixture.ts', source))).toEqual([]);
	});

	// The SFC half of the same argument: an SFC whose script blocks came back EMPTY would scan
	// clean, and every `.vue` in the set below would be certified by a parser that read nothing.
	it('parses an SFC script block rather than its text', () => {
		const inspector = parseScript(join(REPO, DESIGNER, 'inspector/DesignerInspector.vue'));

		expect(callsOf(inspector.file, inspector, 'defineProps')).not.toEqual([]);
	});
});

describe('the asset designer', () => {
	it('has a file set to scan at all', () => {
		const files = sourceFilesUnder(DESIGNER);

		expect(files.length).toBeGreaterThan(20);
		expect(files).toContain(`${DESIGNER}/AssetDesignerRoot.vue`);
	});

	/**
	 * The claim itself. A keystroke in a Markdown or CodeMirror editor cannot reach a designer
	 * handler because a note editor is a different leaf and there is nothing above the designer's
	 * subtree to reach — and that stays true for code not yet written only because this is asked
	 * of the call rather than of the nine key doors AD15-R2 counted.
	 */
	it('registers no DOM event listener anywhere under its own directory', () => {
		expect(scan(DESIGNER)).toEqual([]);
	});
});

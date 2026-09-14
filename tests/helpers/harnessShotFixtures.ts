import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import ts from 'typescript';
import { REPO } from './repo';
import { constantsOf, descendants, evaluate, parseScript, type Literal, type ParsedScript } from './parsedSource';

/**
 * The parsed fixtures behind every pin in `tests/build/harness-shot.test.ts` and its siblings
 * (`harnessShotItemMode.test.ts`): one shared read of `scripts/harness-shot.mjs`, `page.ts` and
 * `IndexPage.vue`, and the `SHOTS`-table reader over it. Split out so a second file pinning a
 * later group of shots shares this reader rather than re-parsing the same scripts and
 * re-declaring `shotTable` a second time — two copies of that function is the clone
 * `npm run analyze`'s duplication check exists to catch, and the header on the file this was
 * extracted from carries the fuller account of what a parsed read buys over a text pin.
 */

const PACKAGE_JSON = path.join(REPO, 'package.json');
const SCRIPT = path.join(REPO, 'scripts', 'harness-shot.mjs');
// The wait, the post-screenshot re-check and the failure-card reader, split out of SCRIPT so a
// test can call them (`captureReadiness.test.ts`) — see that file's header.
const READINESS = path.join(REPO, 'scripts', 'captureReadiness.mjs');
// Where the browser resolution actually lives, since `concept-shots.mjs` needs the same
// answer and two copies of it is the shape of the defect the block below describes.
export const RESOLVER = path.join(REPO, 'scripts', 'chromium.mjs');
// Every file that can name a Chromium. The literal ban applies to all of them, not only to
// the one that happens to own the resolver today — a re-mirrored layout is just as wrong in
// a caller as in the callee.
export const CHROMIUM_FILES = [RESOLVER, SCRIPT, path.join(REPO, 'scripts', 'concept-shots.mjs')];
export const PAGE = path.join(REPO, 'tests', 'harness', 'page.ts');
export const INDEX_PAGE = path.join(REPO, 'tests', 'harness', 'IndexPage.vue');

export const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
};

export const script = parseScript(SCRIPT);
export const readiness = parseScript(READINESS);
export const page = parseScript(PAGE);
export const indexPage = parseScript(INDEX_PAGE);
export const constants = constantsOf(script);

/** One entry of the `SHOTS` table: its fields evaluated, and the identifiers each field's initializer names. */
interface Shot {
	readonly fields: Record<string, Literal>;
	readonly names: Record<string, string[]>;
}

/**
 * The script's `SHOTS` table, by shot name: every object literal in the array initializer of
 * the `SHOTS` declaration, each field evaluated through the script's top-level constants
 * (`selector: FLOOR_STATE` reads as the class it names, a template interpolating
 * `LIBRARY_SELECTED_ASSET` reads as the query it produces, a list as a list). A field whose value
 * is not a literal is left out, so an assertion about it fails on absence rather than on a stale
 * spelling. `names` keeps which constants a field was spelled THROUGH, for the pins whose point is
 * that a selector is the shared constant rather than a second copy of its text.
 */
function shotTable(): Map<string, Shot> {
	const declaration = descendants(script.file, ts.isVariableDeclaration).find((node) => ts.isIdentifier(node.name) && node.name.text === 'SHOTS');
	const table = new Map<string, Shot>();
	if (declaration?.initializer !== undefined && ts.isArrayLiteralExpression(declaration.initializer)) {
		for (const element of declaration.initializer.elements) {
			if (!ts.isObjectLiteralExpression(element)) continue;
			const fields: Record<string, Literal> = {};
			const names: Record<string, string[]> = {};
			for (const property of element.properties) {
				if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
				const value = evaluate(property.initializer, constants);
				if (value !== null) fields[property.name.text] = value;
				names[property.name.text] = descendants(property.initializer, ts.isIdentifier).map((identifier) => identifier.text);
			}
			const { name, ...rest } = fields;
			if (typeof name === 'string') table.set(name, { fields: rest, names });
		}
	}
	expect(table.size, 'the SHOTS table parsed to nothing').toBeGreaterThan(0);
	return table;
}

export const shots = shotTable();

/** One shot's evaluated fields; a name the table lacks fails here rather than as a property of `undefined`. */
export function shot(name: string): Record<string, Literal> {
	const found = shots.get(name);
	if (found === undefined) throw new Error(`no shot named ${name}`);
	return found.fields;
}

/** The constants a shot's field was spelled through. */
export const namesIn = (name: string, field: string): string[] => shots.get(name)?.names[field] ?? [];

/** A shot's query, as the harness reads it (`page.ts`: `new URLSearchParams(window.location.search)`). */
export const query = (name: string): URLSearchParams => new URLSearchParams(String(shot(name).query));

/**
 * A Plan Editor shot's query: `view=plan-editor` FIRST, then the knob the caller asks about. The
 * view is asserted here rather than left to the knob, because a knob alone is satisfied by a
 * query that dropped `view=` — which draws the project surface and exits 0 under a plan-editor
 * name. Leading, as the text pins this replaced required, so the `?view=` spelling every capture
 * URL shares stays the one a reader greps for.
 */
export function planEditorQuery(name: string): URLSearchParams {
	const raw = String(shot(name).query);
	expect(raw.startsWith('?view=plan-editor&'), `${name} does not open on ?view=plan-editor`).toBe(true);
	const parsed = new URLSearchParams(raw);
	expect(parsed.get('view')).toBe('plan-editor');
	return parsed;
}

/** Every `selector:` property anywhere in the script, evaluated — not only the ones inside `SHOTS`. */
export const selectorsAnywhere = (): Literal[] =>
	descendants(script.file, ts.isPropertyAssignment)
		.filter((property) => property.name.getText(script.file) === 'selector')
		.map((property) => evaluate(property.initializer, constants))
		.filter((value): value is Literal => value !== null);

/** Every property named `name` with a string value, anywhere in the script — a shot entry written OUTSIDE `SHOTS` shows up here. */
export const namedEntries = (parsed: ParsedScript): number =>
	descendants(parsed.file, ts.isPropertyAssignment).filter((property) => property.name.getText(parsed.file) === 'name' && ts.isStringLiteralLike(property.initializer)).length;

export const isIdCharacter = (character: string): boolean => (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') || character === '-';

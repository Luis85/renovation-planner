import path from 'node:path';
import { expect } from 'vitest';
import ts from 'typescript';
import { REPO } from './repo';
import { constantsOf, descendants, evaluate, parseScript, type Literal } from './parsedSource';

/**
 * `scripts/harness-shot.mjs`'s `SHOTS` table as a PARSED read, shared by `tests/build/harness-shot.test.ts`
 * and `tests/build/harness-shot-designer.test.ts` — split in two once the designer's shots pushed the
 * first past the 450-line test budget, and shared here rather than copied so both files read one table.
 */

export const SCRIPT = path.join(REPO, 'scripts', 'harness-shot.mjs');

export const script = parseScript(SCRIPT);
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

/**
 * `ScreenPoint`, `screenPoint()`, `worldToScreen()` and `screenToWorld()` are declared in
 * exactly ONE module, and `Point` is re-exported from `core/geometry/` rather than
 * redeclared.
 *
 * This is a category invariant — "nothing else declares these" — so it is checked at the
 * forbidden thing rather than by naming the places that behave: a second, structurally
 * identical `ScreenPoint` would type-check at every call site and guarantee nothing at all,
 * and no amount of driving the code paths somebody thought of would find it. Slice 6
 * imports all four from here and defines none, which is the rule this keeps true for code
 * not yet written.
 *
 * **What the instrument sees, and what it cannot.** It reads every `.ts`/`.vue` file under
 * `src/` as text and looks for the DECLARATION spellings TypeScript accepts — `interface
 * X`, `type X =`, `function X(`, `const X =`, and the `export` forms of each. It cannot see
 * a declaration built some other way: a name produced by a mapped or conditional type, a
 * function assigned through a destructuring pattern, or one written with a different
 * identifier and re-exported under this one (`export { other as worldToScreen }`) — which
 * is why the re-export form is checked separately below rather than assumed away.
 *
 * The instrument is tested before it is trusted: the first case below plants each spelling
 * in a string and asserts the matcher finds it, because a regex that matched nothing would
 * make every assertion here pass while proving the opposite.
 */
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toPosix } from '../../helpers/posix';

const SRC = fileURLToPath(new URL('../../../src/', import.meta.url));

/** The one module allowed to declare the viewport vocabulary. */
const VIEWPORT_MODULE = 'presentation/editor/viewport/Viewport.ts';
/** The one module allowed to declare `Point`. */
const POINT_MODULE = 'core/geometry/Point.ts';

const NAMES = ['ScreenPoint', 'screenPoint', 'worldToScreen', 'screenToWorld'] as const;

/**
 * Every declaration spelling for `name`, as one expression. `\b` on both sides so
 * `screenPoint` does not match inside `screenPointOf`, and the `export` prefix optional
 * because a declaration is a declaration whether or not it leaves the module.
 */
function declarationPattern(name: string): RegExp {
	return new RegExp(
		String.raw`(?:^|\s)(?:export\s+)?(?:declare\s+)?(?:interface\s+${name}\b` +
			String.raw`|type\s+${name}\b\s*[=<]` +
			String.raw`|(?:async\s+)?function\s+${name}\s*[(<]` +
			String.raw`|(?:const|let|var)\s+${name}\b\s*[:=])`,
		'm',
	);
}

function sourceFiles(): string[] {
	return globSync('**/*.{ts,vue}', { cwd: SRC }).map((file) => toPosix(file));
}

function read(relative: string): string {
	return readFileSync(join(SRC, relative), 'utf8');
}

describe('the instrument', () => {
	it.each(NAMES)('matches every declaration spelling of %s', (name) => {
		const spellings = [
			`interface ${name} { readonly x: number }`,
			`export interface ${name} {}`,
			`type ${name} = number`,
			`export type ${name}<T> = T`,
			`function ${name}(a: number) {}`,
			`export async function ${name}<T>(a: T) {}`,
			`const ${name} = 1`,
			`export const ${name}: number = 1`,
		];

		for (const spelling of spellings) {
			expect(declarationPattern(name).test(`\n${spelling}\n`)).toBe(true);
		}
	});

	it('does not match a mere USE or a longer name', () => {
		const pattern = declarationPattern('screenPoint');

		expect(pattern.test('\nreturn screenPoint(1, 2);\n')).toBe(false);
		expect(pattern.test('\nfunction screenPointOf(a: number) {}\n')).toBe(false);
		expect(pattern.test("\nimport { screenPoint } from './Viewport';\n")).toBe(false);
	});

	it('finds the source tree it is pointed at', () => {
		const files = sourceFiles();

		// A glob that matched nothing would make every "no second declaration" assertion
		// below vacuously true. Both extensions, because the ban covers SFCs too.
		expect(files.length).toBeGreaterThan(40);
		expect(files).toContain(VIEWPORT_MODULE);
		expect(files.some((file) => file.endsWith('.vue'))).toBe(true);
	});
});

describe('the viewport vocabulary', () => {
	it.each(NAMES)('is declared by %s in exactly one module', (name) => {
		const pattern = declarationPattern(name);
		const declaring = sourceFiles().filter((file) => pattern.test(read(file)));

		expect(declaring).toEqual([VIEWPORT_MODULE]);
	});

	it('is not re-exported under an alias from anywhere else', () => {
		// The one spelling the declaration matcher structurally cannot see. Narrow on
		// purpose: an alias INTO one of these names is what would create a second answer,
		// while `export { screenPoint }` from the owning module is the ordinary case.
		const aliasing = sourceFiles().filter((file) => {
			if (file === VIEWPORT_MODULE) return false;
			return NAMES.some((name) => new RegExp(String.raw`\bas\s+${name}\b`).test(read(file)));
		});

		expect(aliasing).toEqual([]);
	});
});

describe('Point', () => {
	it('is declared only by core/geometry, never redeclared in presentation', () => {
		const declaring = sourceFiles().filter((file) => declarationPattern('Point').test(read(file)));

		expect(declaring).toEqual([POINT_MODULE]);
	});

	/**
	 * The positive half. A `Point` that presentation merely imported would satisfy the
	 * assertion above too — what the design actually asks for is that the viewport module
	 * RE-EXPORTS core's, so slice 6 has one import path for both halves of a coordinate pair
	 * rather than reaching into `core/` for one and here for the other.
	 */
	it('is re-exported from the viewport module', () => {
		expect(read(VIEWPORT_MODULE)).toMatch(
			/export type \{ Point \} from '.*core\/geometry\/Point'/,
		);
	});
});

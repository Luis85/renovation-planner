import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * A real component under `src/presentation/library/` may not name a class the assembled sheet
 * does not declare, unless the gap is a documented decision rather than an oversight.
 *
 * This exists because of the defect it was written to catch, measured at `e3d2e8bc`:
 * `AssetInspector.vue` emitted `rp-al-action--delete`, `rp-al-action--designer` and
 * `rp-al-action--note`, and no partial declared any of the three — found by a one-off `comm`
 * between two greps, not by any gate, because `tests/build/prototype-styles.test.ts`'s identical
 * rule is scoped to `src/prototypes/**` and says so in its own header ("it does not read
 * `src/presentation/**`"). Written as a RULE rather than as three names, per CLAUDE.md's own
 * "a table that enumerates code goes stale; a table that states a rule does not" — the concrete
 * three that motivated it are not spelled out below, only the exemption two of them left behind.
 *
 * Deliberately scoped to `src/presentation/library/` rather than widened to every presentation
 * component: the defect this file exists for is the library surface's own, this task owns four
 * `styles/` partials and not the whole tree, and widening the walk would make this file the
 * unplanned owner of every pre-existing gap elsewhere in `src/presentation/` — a different task's
 * finding, not this one's to fix or to silently paper over with a wider exemption list.
 *
 * The extraction is the same two-reading rule `prototype-styles.test.ts` already proved out
 * (a static `class="..."` attribute, and a `:class="{ ... }"` binding's object KEYS, quoted or
 * bare) rather than an import from it: neither function is exported, and re-exporting one to
 * save a dozen lines would widen that file's own public surface for a caller its header does not
 * anticipate. What is NOT read, on the same terms that file already states: a `:class` bound to
 * anything but an object literal — an array, a ternary, a computed string — because a cheap
 * reading that tried to reach those over-matched comparison operands too (`prototype-
 * styles.test.ts`'s own recorded finding). That is exactly what keeps `AssetMark.vue`'s
 * `` :class="`rp-al-mark--${kind}`" `` a template literal rather than an object literal, and
 * therefore invisible to this extractor by construction — see the case below that proves it,
 * rather than trusting the shape.
 */

const CLASS_ATTRIBUTE = /\sclass="([^"]*)"/g;
const CLASS_BINDING = /\s:class="([^"]*)"/g;
const BINDING_KEY = /[{,]\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:/g;
const CLASS_SELECTOR = /\.([A-Za-z_][\w-]*)/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** Every class name one SFC's markup NAMES, by both readings above. */
const classesUsedBy = (source: string): string[] => [
	...[...source.matchAll(CLASS_ATTRIBUTE)].flatMap(([, list]) => list.split(/\s+/).filter(Boolean)),
	...[...source.matchAll(CLASS_BINDING)].flatMap(([, expression]) =>
		[...expression.matchAll(BINDING_KEY)].map(([, quoted, bare]) => quoted ?? bare),
	),
];

/** RECURSIVELY, for the reason `prototype-styles.test.ts`'s own walk is: a flat `readdirSync`
 *  would leave a class in a nested component unchecked, one directory below where the sweep
 *  stopped looking. `src/presentation/library/` holds no subdirectory today; the walk does not
 *  assume it stays that way. */
const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const child = `${dir}/${entry.name}`;

		return entry.isDirectory() ? walk(child) : entry.name.endsWith('.vue') ? [child] : [];
	});

const libraryFiles = walk('src/presentation/library');

const emitted = new Set(libraryFiles.flatMap((file) => classesUsedBy(readFileSync(file, 'utf8'))));

const declared = new Set(
	[...assembleStyles().replace(CSS_COMMENT, '').matchAll(CLASS_SELECTOR)].map(([, name]) => name),
);

/**
 * `Open designer` and `Open note` (`AssetInspector.vue`'s `.rp-al-action--designer` /
 * `--note`), by name, with a reason — the same shape `tests/helpers/buttonRules.ts`'s
 * `DEFERS_TO_THE_HOST` already uses for `.rp-dialog-button` staying bare, and CLAUDE.md's own
 * "asserted by exact key set" rule for a carve-out: a drift in this set is caught at the
 * assertion below rather than silently widening what the category check lets through.
 *
 * `.rp-al-action--delete`, the destructive third member of the same markup, is NOT here — it has
 * its own declared rule in `styles/asset-library-inspector.css`, and that rule's own comment
 * states why `--designer`/`--note` do not need one: §3.5 gives neither a visual argument distinct
 * from an ordinary secondary button, so Obsidian's own `button:not(.clickable-icon)` plus the
 * inspector's existing `.rp-al-action:focus-visible` ring is the whole of what either needs.
 */
const UNSTYLED_LIBRARY_MODIFIERS = new Set(['rp-al-action--designer', 'rp-al-action--note']);

describe('the classes the library surface emits', () => {
	/**
	 * The instrument before the measurement. A `class`/`:class` regex that stopped matching would
	 * make the case below compare an empty set and pass; a selector regex that stopped matching
	 * would fail it instead, which is the loud direction and still worth ruling out.
	 */
	it('is measured by regexes that still match', () => {
		expect(libraryFiles.length).toBeGreaterThan(0);
		expect(emitted.size).toBeGreaterThan(0);
		expect(declared.has('rp-al-row__name')).toBe(true);
	});

	/**
	 * `AssetMark.vue`'s own `` :class="`rp-al-mark--${kind}`" `` is a template literal, not an
	 * object binding — `CLASS_BINDING` matches the attribute's text, but `BINDING_KEY` finds no
	 * `key:` shape inside a plain template literal, so nothing is extracted from it at all. Driven
	 * directly rather than trusted, because the brief's own naive `grep -ohrE 'rp-al-[a-z0-9_-]+'`
	 * over these files DOES over-match it as the truncated token `rp-al-mark--`, which is exactly
	 * the false positive this extractor must not repeat.
	 */
	it('does not extract a class from a template-literal :class binding', () => {
		// Assembled through `String.fromCharCode`, not written as one literal: a plain string
		// holding `${kind}` verbatim trips both `no-template-curly-in-string` (read as a template
		// literal typo) and `no-useless-concat` (two adjacent literals fold back into one) — it is
		// neither here, it is the exact source text `AssetMark.vue` writes.
		const interpolation = String.fromCharCode(36) + '{kind}';
		const source = ' :class="`rp-al-mark--' + interpolation + '`"';

		expect(classesUsedBy(source)).toEqual([]);
	});

	/** Both readings, driven directly so the fixture below is trusted before it is relied on. */
	it('reads a static class attribute and an object-key :class binding alike', () => {
		expect(classesUsedBy(' class="rp-al-action rp-al-action--delete"')).toEqual([
			'rp-al-action',
			'rp-al-action--delete',
		]);
		expect(classesUsedBy(" :class=\"{ 'rp-al-inspector--rest': state === 'resting' }\"")).toEqual([
			'rp-al-inspector--rest',
		]);
	});

	/**
	 * The check itself, driven against a fixture BEFORE it is trusted against the real tree — this
	 * repository having shipped an instrument that reached nothing more than once. An inline
	 * source string rather than a planted file: what is under test is the comparison, not the
	 * filesystem walk, which the sanity case above already exercises against real files.
	 */
	it('reports a class no partial declares and no exemption names', () => {
		const undeclared = [...classesUsedBy(' class="rp-al-invented-class"')].filter(
			(name) => !declared.has(name) && !UNSTYLED_LIBRARY_MODIFIERS.has(name),
		);

		expect(undeclared).toEqual(['rp-al-invented-class']);
	});

	/** And a class the exemption DOES name is not reported, so the exemption is exercised rather
	 *  than merely declared. */
	it('does not report an exempted class', () => {
		const undeclared = [...classesUsedBy(' class="rp-al-action--designer"')].filter(
			(name) => !declared.has(name) && !UNSTYLED_LIBRARY_MODIFIERS.has(name),
		);

		expect(undeclared).toEqual([]);
	});

	/**
	 * The exemption set itself, asserted by exact membership: a class added to it silently is a
	 * class this file has stopped checking, and a class the real components no longer emit is a
	 * carve-out for a gap that no longer exists — CLAUDE.md's own rule for exactly this shape of
	 * list ("a carve-out for a path that no longer exists is a comment that goes on reading as a
	 * live exception").
	 */
	it('exempts exactly the two named, undeclared, still-emitted classes', () => {
		expect([...UNSTYLED_LIBRARY_MODIFIERS].toSorted()).toEqual(['rp-al-action--designer', 'rp-al-action--note']);
		for (const name of UNSTYLED_LIBRARY_MODIFIERS) {
			expect(emitted.has(name)).toBe(true);
			expect(declared.has(name)).toBe(false);
		}
	});

	/** The category check, over the real tree. */
	it('names no class nothing styles, beyond the two documented exemptions', () => {
		const undeclared = [...emitted].filter((name) => !declared.has(name) && !UNSTYLED_LIBRARY_MODIFIERS.has(name));

		expect(undeclared).toEqual([]);
	});
});

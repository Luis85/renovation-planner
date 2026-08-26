import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * A prototype may not name a class nothing styles.
 *
 * This exists because of the defect it does NOT catch, and the distinction is the whole
 * value of the file. `ZoneSummary.vue` put its name and its area in adjacent spans, Vue's
 * `whitespace: 'condense'` removed the newline between them, and the mock rendered
 * `Kitchen12.60 m²` — through forty-four review rounds, a green `npm run check` every time.
 * jsdom lays nothing out, so no gate here can measure a gap; `textContent` reads both strings
 * and passes. A PNG read by eye is the only instrument in this repository that reaches it.
 *
 * What IS checkable is the condition that made the defect possible: the mock had no stylesheet
 * at all. `WorkPackages.vue`, written the same week, does not have the defect — not by being
 * more careful about whitespace, but by shipping `styles/work-packages.css`, whose gaps put
 * every adjacent element apart on purpose. So the trap is sprung by a mock with no styles of
 * its own, and until now nothing noticed that a mock had none.
 *
 * TWO places a class may be declared, since a mock may now carry its own `<style>` block: that
 * block, or the assembled sheet. The two are not interchangeable and the README says which to
 * reach for — the block does not ship and does not travel at promotion, a partial does both —
 * but for THIS check they are the same question, which is whether anything styles the class at
 * all.
 *
 * Naming this as "every class is declared" rather than "every mock has a stylesheet" is
 * deliberate: a partial that exists but does not cover the class a template actually writes
 * leaves exactly the same span unstyled, and the first run of this check found precisely that
 * — `rp-wp-state-word`, a hook in an hour-old mock that carried no rule and never had.
 *
 * The guarantee is narrower than "the mock looks right", and the narrowness is the point:
 *
 * - It reads DECLARATIONS, not the cascade — the same narrowing `cssVars.test.ts` states. A
 *   class declared in a block no page state reaches still counts. It is a regex over the
 *   assembled text with COMMENTS stripped, not a parse: a class named in a selector counts,
 *   and one named only in prose does not.
 * - It reads STATIC `class` attributes. A `:class` binding is invisible here; there are none
 *   in the tree today (measured, and a template-only SFC has no script to compute one), and
 *   the day one arrives this check will not see it.
 * - It says nothing about spacing, contrast, or anything else a layout engine decides.
 *
 * `styles/` only, never `tests/harness/theme.css`: criterion 5 requires a mock and a real
 * component on one screen to be styled by the same assembled sheet, so a mock leaning on the
 * harness's own sheet would draw correctly in the index and wrongly in a vault.
 *
 * And it is the ASSEMBLED sheet, through `assembleStyles()` — the build's own function, not a
 * read of the `styles/` directory. The first version of this file did read the directory, and
 * the probe that was supposed to red it stayed green: a partial `index.css` does not import is
 * absent from what ships while still sitting on disk declaring things. That the build also
 * fails on an unimported partial is not a reason to measure the wrong set here; a check whose
 * evidence is one gate away from the thing it claims about is how a claim outlives its truth.
 */

const CLASS_ATTRIBUTE = /\sclass="([^"]*)"/g;
/** A `:class` binding, whose statically knowable names this file reads two ways. */
const CLASS_BINDING = /\s:class="([^"]*)"/g;
/**
 * An object-literal KEY: `{ 'rp-a--on': x }` and, the case a quoted-only reading missed,
 * `{ selected: x }` — a valid and ordinary binding whose class name carries no quotes.
 *
 * Anchored to `{` or `,` because that is where a key actually sits. Without the anchor,
 * `{ active: a ? b : c }` would also yield `b` from the ternary inside the VALUE, and the
 * check would then demand a rule for a class nobody wrote — a red build for no defect, which
 * is the failure direction that matters here.
 */
const BINDING_KEY = /[{,]\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:/g;
const CLASS_SELECTOR = /\.([A-Za-z_][\w-]*)/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * RECURSIVELY, because `entries.ts` discovers prototypes with `**\/*.vue` and a mock is free to
 * live in `src/prototypes/editor/Panel.vue`. A flat `readdirSync` sees the subdirectory as one
 * entry, filters it out for not ending in `.vue`, and leaves every mock inside it unchecked —
 * the guard staying green over exactly the files it was written for. The instrument has to see
 * the same set the harness does.
 */
const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const child = `${dir}/${entry.name}`;

		if (entry.isDirectory()) return walk(child);
		return entry.name.endsWith('.vue') ? [child] : [];
	});

const prototypes = walk('src/prototypes').map((file) => file.replace('src/prototypes/', ''));

/**
 * EVERY `<style>` block in an SFC, with opening tags — a valid SFC may carry more than one, and
 * the first version of this read only the first match. A mock whose first block was scoped and
 * whose second was not passed the scoping case AND had the second block's selectors missing from
 * `own`, so Vite would inject global CSS that this file had just certified as contained.
 */
const styleBlocks = (sfc: string) => sfc.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];

/** An attribute NAME in an opening tag — the value, quoted or not, is consumed and discarded. */
const ATTRIBUTE = /([\w:@.-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;

/**
 * Whether a `<style>` block carries the `scoped` ATTRIBUTE.
 *
 * Asked of the attributes rather than of the tag's text, which is what this did first: a
 * substring test answers yes to `<style src="./scoped.css">`, where the word appears inside a
 * VALUE and the attribute is absent. Vite would install those rules globally and the
 * navigation-order guard below would stay green — the exact defect it exists to refuse, waved
 * through by the shape of the question rather than by its answer.
 */
const isScoped = (openingTag: string): boolean =>
	[...openingTag.replace(/^<style/, '').replace(/>$/, '').matchAll(ATTRIBUTE)].some(([, name]) => name === 'scoped');

/**
 * Every class name an SFC's markup NAMES, by both readings — one function, so the cases below
 * drive the extraction rather than restating it.
 *
 * The first version of the false-positive case restated it, and the probe that was supposed to
 * red it stayed green: re-adding the over-reading regex to this function changed nothing the
 * case could see, because the case had its own copy. A test that re-implements what it is
 * testing asserts about itself.
 */
const classesUsedBy = (source: string): string[] => [
	...[...source.matchAll(CLASS_ATTRIBUTE)].flatMap(([, list]) => list.split(/\s+/).filter(Boolean)),
	// A `:class` binding's object KEYS — `:class="{ 'rp-x--on': cond }"`. Not every bound class
	// is knowable (a computed string never will be), but a key is, and leaving bindings out
	// entirely was a real hole the moment the first scripted mock arrived: the active-filter
	// selector was bound, so deleting its rule left the state unstyled with this file green.
	...[...source.matchAll(CLASS_BINDING)].flatMap(([, expression]) =>
		[...expression.matchAll(BINDING_KEY)].map(([, quoted, bare]) => quoted ?? bare),
	),
];

const used = new Map(
	prototypes.map((file) => {
		const source = readFileSync(`src/prototypes/${file}`, 'utf8');
		const classes = classesUsedBy(source);
		// A mock may style itself, so its OWN block is a declaration source alongside the
		// assembled sheet — and only its own: one mock's block says nothing about another's,
		// since neither ships and neither is loaded when the other is on the stage.
		const own = new Set(
			styleBlocks(source).flatMap((block) =>
				[...block.replace(CSS_COMMENT, '').matchAll(CLASS_SELECTOR)].map(([, name]) => name),
			),
		);

		return [file, { classes: new Set(classes), own }] as const;
	}),
);

/**
 * Comments STRIPPED first. `.rp-example` written in a header — explaining a rule, or explaining
 * why a rule was deleted — is prose, not a declaration, and counting it would let a class keep
 * passing after the rule that styled it was removed. That is the failure mode this whole file
 * exists to catch, arriving through its own instrument.
 */
const declared = new Set(
	[...assembleStyles().replace(CSS_COMMENT, '').matchAll(CLASS_SELECTOR)].map(([, name]) => name),
);

describe('a prototype and the sheet that styles it', () => {
	/**
	 * The instrument before the measurement, both halves. A `class` regex that stopped
	 * matching would make every case below compare an empty set and pass; a selector regex
	 * that stopped matching would fail every case instead, which is the loud direction and
	 * still worth ruling out before trusting a green run.
	 */
	it('is measured by regexes that still match', () => {
		expect(prototypes.length).toBeGreaterThan(0);
		expect([...used.values()].some(({ classes }) => classes.size > 0)).toBe(true);
		expect(declared.has('rp-zone-summary__name')).toBe(true);
		// The third regex, and the one with no other case to prove it: a `<style>` extractor that
		// stopped matching would silently hand every scripted mock an empty `own` set, turning
		// the relaxation this file was rewritten for back into a failure nobody could read.
		expect([...used.values()].some(({ own }) => own.size > 0)).toBe(true);
	});

	/**
	 * SCOPED, and this is the one rule here that is about the page rather than about the mock.
	 *
	 * Vite injects a component's CSS when its module loads and never removes it, so an unscoped
	 * block goes on styling the index after the designer has navigated away — and any later
	 * entry sharing a selector, a REAL component included, inherits provisional rules. What that
	 * component looks like would then depend on the order entries were opened, which is exactly
	 * the guarantee criterion 5 makes, broken by the mechanism that was supposed to be free.
	 *
	 * A mock with no block at all passes: the rule is about what a block must be, not about
	 * having one.
	 */
	it.each(prototypes)('%s scopes every style block it has', (file) => {
		const unscoped = styleBlocks(readFileSync(`src/prototypes/${file}`, 'utf8'))
			.map((block) => block.match(/<style[^>]*>/)?.[0] ?? '')
			.filter((opening) => !isScoped(opening));

		expect(unscoped).toEqual([]);
	});

	/**
	 * The attribute reading itself, driven through the same function the loop above uses. The
	 * first case is the one a substring test gets wrong, and it is not contrived — `<style src>`
	 * is an ordinary Vue SFC feature and `scoped.css` an ordinary filename.
	 */
	it.each([
		['<style scoped>', true],
		['<style lang="scss" scoped>', true],
		['<style scoped lang="scss">', true],
		['<style>', false],
		['<style src="./scoped.css">', false],
		['<style data-scoped-later>', false],
	])('reads %s as scoped=%s', (opening, expected) => {
		expect(isScoped(opening)).toBe(expected);
	});

	/**
	 * The direction that can cost a build, driven directly rather than left to prose. A quoted
	 * string inside a CONDITION is not a class name, and reading it as one made a valid mock
	 * fail for a `.selected` rule it never needed. The fixture is a string rather than a planted
	 * file because the extraction is what is under test, not the tree.
	 */
	it('does not demand a rule for a string a condition compares against', () => {
		expect(classesUsedBy(' :class="{ active: mode === \'selected\' }"')).toEqual(['active']);
	});

	// The coverage that reading keys buys, driven through the same function so the two cases
	// cannot disagree about what the extractor is.
	it('reads a quoted key and a bare one alike', () => {
		expect(classesUsedBy(' :class="{ \'rp-a--on\': x, selected: y }"')).toEqual(['rp-a--on', 'selected']);
	});

	it.each(prototypes)('%s names no class nothing styles', (file) => {
		const entry = used.get(file);
		const undeclared = [...(entry?.classes ?? [])].filter((name) => !declared.has(name) && !entry?.own.has(name));

		expect(undeclared).toEqual([]);
	});
});

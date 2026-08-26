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
 * - It reads static `class` attributes AND the object KEYS of a `:class` binding, quoted or
 *   bare: `:class="{ 'rp-a--on': x, selected: y }"` yields both names. This bullet said a
 *   binding was invisible here and that the tree held none, and both halves stopped being true
 *   in the same increment that made them false — `WorkPackageFilters.vue` binds one, and the
 *   scripted mocks it opened the door to will bind more.
 * - What it does NOT read is a class produced any other way: an ARRAY element, either branch
 *   of a ternary, or a string a script computes. Those need a real expression parser, and the
 *   cheap reading that tried to reach them — every quoted literal in the binding — also
 *   matched the operands of comparisons, demanding a rule for `selected` in
 *   `{ active: mode === 'selected' }`. That reds `npm run check` over correct work, which is
 *   the failure direction that matters here, so the narrow reading is the deliberate one and
 *   this is the cost of it rather than an oversight.
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

/** An HTML comment, which in an SFC is PROSE — including any tag its sentences happen to name. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * EVERY `<style>` block in an SFC, with opening tags — a valid SFC may carry more than one, and
 * the first version of this read only the first match. A mock whose first block was scoped and
 * whose second was not passed the scoping case AND had the second block's selectors missing from
 * `own`, so Vite would inject global CSS that this file had just certified as contained.
 *
 * COMMENTS FIRST, for the same reason the assembled sheet is read with its own stripped: a file
 * that documents the rule by naming `<style scoped>` in prose had that sentence matched as its
 * opening tag, and everything from there to the file's one `</style>` — the real block included —
 * swallowed as that match's body. One block was reported, scoped, and the unscoped block actually
 * shipping global CSS was never looked at. A comment is the one place in a source file where a
 * tag is guaranteed to be a description of a tag rather than one.
 */
const styleBlocks = (sfc: string) =>
	sfc.replace(HTML_COMMENT, '').match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];

/** A rule's prelude — the text before its `{`. At-rule preludes are matched too and filtered out. */
const RULE_PRELUDE = /([^{}]+)\{/g;

/** The selectors a style block declares, at any nesting depth, with at-rules skipped. */
const selectorsIn = (block: string): string[] =>
	[
		...block
			.replace(/^<style[^>]*>/, '')
			.replace(/<\/style>$/, '')
			.replace(CSS_COMMENT, '')
			.matchAll(RULE_PRELUDE),
	]
		.map(([, prelude]) => prelude.trim())
		.filter((prelude) => prelude !== '' && !prelude.startsWith('@'))
		.flatMap((list) => list.split(',').map((one) => one.trim()))
		.filter(Boolean);

/**
 * A selector's SUBJECT — its final compound, which is what the selector actually styles and
 * what Vue attaches the scope attribute to.
 */
const subjectOf = (selector: string): string => selector.split(/[\s>+~]+/).filter(Boolean).at(-1) ?? '';

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
/**
 * Every class the REAL components use, read with the same function that reads a mock's — so
 * "a class a real component uses" means the same thing on both sides of the rule below.
 *
 * Recursive, like the prototype walk: `src/presentation/` is nested and a flat read would make
 * the rule quietly weaker the deeper a component sits.
 */
const componentClasses = new Set(
	walk('src/presentation').flatMap((file) => classesUsedBy(readFileSync(file, 'utf8'))),
);

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
		// And the real components' side of the isolation rule, which would be vacuous if the walk
		// or the reader came back empty — the rule would then permit every class in the tree.
		expect(componentClasses.size).toBeGreaterThan(0);
		expect(componentClasses.has('rp-editor-status-bar')).toBe(true);
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
	/**
	 * `scoped` stops a mock's rules reaching the next ENTRY. It does not stop them reaching a
	 * real component this one composes: Vue applies the parent's scope attribute to a child
	 * component's ROOT element, by design, so `.rp-panel footer { … }` around a composed
	 * `<StatusBar />` — whose root is a `<footer>` — still restyles it. That is criterion 5's
	 * promise broken from inside the mock rather than across a navigation, and the scoping case
	 * below cannot see it.
	 *
	 * Two rules close it, both about what a selector may be rather than what it happens to hit
	 * today, since the composed component is chosen by the template and can change:
	 *
	 * The SUBJECT must carry a class. A bare element subject is the shape that reaches a child
	 * root by accident, and a class of the mock's own is a thing a real component does not have.
	 */
	it.each(prototypes)('%s styles nothing by element alone', (file) => {
		const bareSubjects = styleBlocks(readFileSync(`src/prototypes/${file}`, 'utf8'))
			.flatMap((block) => selectorsIn(block))
			.filter((selector) => !/\.[A-Za-z_-]/.test(subjectOf(selector)));

		expect(bareSubjects).toEqual([]);
	});

	/**
	 * And no class it declares may be one a REAL component uses. The subject rule above stops a
	 * mock reaching a child root by element; this stops it doing so by name — which is the more
	 * likely spelling, because a designer wanting to nudge a composed component reaches for that
	 * component's own class.
	 *
	 * Declaring, not using: a mock may name a real component's class in its MARKUP (laying one
	 * out is legitimate). Putting a rule on it is what criterion 5 refuses.
	 */
	it.each(prototypes)('%s declares no class a real component uses', (file) => {
		const declaredHere = styleBlocks(readFileSync(`src/prototypes/${file}`, 'utf8')).flatMap((block) =>
			[...block.replace(CSS_COMMENT, '').matchAll(CLASS_SELECTOR)].map(([, name]) => name),
		);

		expect(declaredHere.filter((name) => componentClasses.has(name))).toEqual([]);
	});

	it.each(prototypes)('%s scopes every style block it has', (file) => {
		const unscoped = styleBlocks(readFileSync(`src/prototypes/${file}`, 'utf8'))
			.map((block) => block.match(/<style[^>]*>/)?.[0] ?? '')
			.filter((opening) => !isScoped(opening));

		expect(unscoped).toEqual([]);
	});

	/**
	 * A `<style ...>` written in PROSE is not a block, and this is the case that found the file
	 * this whole guard is pointed at. `WorkPackageFilters.vue` explains itself in an HTML comment
	 * naming `<style scoped>`; the extractor matched from THERE, ran non-greedily to the file's
	 * one `</style>`, and reported a single block whose opening tag was the comment's. The real
	 * `<style>` two-thirds down the file sat inside that match, unscoped, unread — so the mock
	 * shipped exactly the global CSS the case below exists to refuse, certified by the sentence
	 * describing the rule it broke.
	 *
	 * Both halves matter: the opening tag has to be the real one, and the count has to be one.
	 */
	it('does not read a style tag written in a comment as a block', () => {
		const sfc = '<!-- The `<style scoped>` block does not ship -->\n<style>\n.rp-a { color: red; }\n</style>\n';

		expect(styleBlocks(sfc).map((block) => block.match(/<style[^>]*>/)?.[0])).toEqual(['<style>']);
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

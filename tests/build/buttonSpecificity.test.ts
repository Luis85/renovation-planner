import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Selector, SelectorComponent } from 'lightningcss';
import { alternativesOf, compoundsOf, moreSpecific, parseSelector, propertyOf, specificityOf, stylesheetRules, subjectClasses } from '../helpers/selectors';
import { declarationsOf, drawsAnIndicator, indicatorOf } from '../helpers/indicators';

/**
 * NO RULE THIS PROJECT WRITES FOR A `<button>` MAY LOSE TO OBSIDIAN'S OWN BUTTON RULE.
 *
 * `button:not(.clickable-icon)` in `tests/harness/obsidian.css` sets `background-color`, `color`
 * and `box-shadow` at specificity **(0,1,1)** — `:not()` contributes its argument's specificity,
 * so one element plus one class beats a bare class at (0,1,0), and source order is never even
 * consulted. A rule that loses does not warn, does not fail a build, and looks correct in the
 * stylesheet: the only symptom is a colour nobody chose, in a vault.
 *
 * **It has bitten three times, which is why this is a category check rather than a fourth
 * fixture.** `.rp-dialog-button-danger` rendered plain white where it asked for red (design
 * slice 15, fixed there and nowhere else). `.rp-editor-tool-active` lost both its declarations,
 * so the ACTIVE TOOL rendered identically to the inactive ones — `aria-pressed` was bound, so a
 * screen reader was told what the screen would not say. `.rp-editor-inspector-delete`, a
 * destructive action whose whole visual argument is `--text-error`, rendered as an ordinary grey
 * button with only its border surviving (Obsidian's rule sets no border, so that one declaration
 * was never contested). `.rp-dialog-candidate` and the harness's own `.rp-harness-scheme` were
 * found by the same sweep.
 *
 * `CLAUDE.md`: a category invariant is checked at the FORBIDDEN THING, not by listing the places
 * — so this reads the selectors themselves and holds for rules nobody has written yet.
 *
 * **What it proves and what it does not.** It compares SPECIFICITY, which is the mechanism that
 * actually decides this, and it is exact about the two ends: the classes come from every
 * `<button>` in `src/presentation/`, and the rules from every sheet that ships plus the
 * harness's own. It says nothing about the COLOUR a browser finally paints — that needs `var()`
 * resolved, which no gate here does (`tests/presentation/dialogs/dangerButtonSpecificity.test.ts`
 * takes the one worked example as far as jsdom's cascade can, and a real Chromium took all five
 * the rest of the way once, by hand).
 */

/** What Obsidian's `button:not(.clickable-icon)` scores, and therefore what a rule must beat. */
const OBSIDIAN_BUTTON = [0, 1, 1] as const;

/**
 * The properties that rule actually sets, plus the SHORTHAND that resets one of them.
 *
 * `background: transparent` sets the `background-color` longhand and competes exactly as the
 * longhand does, so a rule spelled that way was skipped entirely — the scan recognised only the
 * literal `background-color`. Nothing in this repository writes the shorthand today, which is
 * the same reason every other hole here was reachable: a check sees the spellings it was written
 * against.
 *
 * `background\s*:` does not match `background-color:` — the hyphen sits between the word and the
 * colon — so listing both matches each once rather than double-counting.
 */
const CONTESTED = new Set(['background-color', 'background', 'color', 'box-shadow']);

/**
 * Rules deliberately left to lose, by name and with the reason — the shape `.oxlintrc.json` uses
 * for a rule that does not fit, so a reviewer sees the exemption rather than a silent gap.
 *
 * `.rp-dialog-button` asks for `--interactive-normal` and `--text-normal`, the very values
 * Obsidian's rule applies anyway, so losing changes nothing on screen — and staying at (0,1,0)
 * is what lets a themed vault's own button appearance win here undisturbed. `styles/dialogs.css`
 * carries the same reasoning at the rule itself.
 */
const DEFERS_TO_THE_HOST = ['.rp-dialog-button'];

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const filesUnder = (dir: string, ext: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(`${dir}/${entry.name}`, ext)
			: entry.name.endsWith(ext)
				? [`${dir}/${entry.name}`]
				: [],
	);

/**
 * How far past a `createEl('button'` call to look for its `cls`. Bounded rather than brace-matched
 * on purpose: the option object nests (`attr: { … }`), so `[^}]*` stops at the wrong brace, and a
 * real parser is far more than this needs. The limit is a stated one — a `cls` further away than
 * this, or built from a variable rather than a literal, is not seen, and the instrument case below
 * pins the one call that exists rather than trusting the window.
 */
const CREATE_WINDOW = 300;

/**
 * Every `rp-*` class this project puts on a `<button>`, from the SOURCE rather than a list — and
 * from both ways a button is made here, which is the correction this function needed.
 *
 * It read Vue templates only, so `.rp-harness-scheme` — created in `tests/harness/theme.ts` with
 * `createEl('button', { cls: … })` — was in no class set, and every rule governing it went
 * unchecked by both cases below while `theme.css` sat in `sheets` looking covered. Measured:
 * reverting its doubled selector to the bare class AND deleting its focus ring left this file
 * green. A scan that names one authoring style silently exempts the other.
 */
function buttonClasses(): Set<string> {
	const found = new Set<string>();
	const add = (text: string) => {
		for (const [cls] of text.matchAll(/\brp-[\w-]+/g)) found.add(`.${cls}`);
	};

	// `src/prototypes` as well as `src/presentation`. A mock is never shipped, but the sheet that
	// styles it IS — `styles/work-packages.css` is a real partial — and the harness is where that
	// mock is LOOKED AT, which is the whole point of drawing it. Omitting the tree left
	// `.rp-wp-new` undiscovered while its rule lost the cascade, so the screen's primary action
	// was being judged as a plain grey button.
	for (const file of ['src/presentation', 'src/prototypes'].flatMap((dir) => filesUnder(dir, '.vue'))) {
		// The OPENING TAG only, so a class on a sibling element inside the button's own markup is
		// not collected as if the button wore it. Both `class="…"` and `:class="{ x: … }"` live in
		// there, and `rp-editor-tool-active` arrives only through the second.
		for (const [tag] of readFileSync(file, 'utf8').matchAll(/<button\b[^>]*>/g)) add(tag);
	}

	// Obsidian's own DOM helper, which is how anything outside a Vue tree makes an element here.
	// `tests/harness` as well as `src`, because the harness's chrome is styled by a sheet this
	// file scans and is therefore this file's business.
	for (const dir of ['src', 'tests/harness']) {
		for (const file of filesUnder(dir, '.ts')) {
			const source = readFileSync(file, 'utf8');

			for (const match of source.matchAll(/createEl\(\s*['"]button['"]/g)) {
				const cls = /\bcls:\s*['"]([^'"]+)['"]/.exec(source.slice(match.index, match.index + CREATE_WINDOW));

				if (cls !== null) add(cls[1]);
			}
		}
	}

	return found;
}


/** Every sheet that can style one: the ones that ship, plus the harness's own chrome. */
const sheets = [
	...readdirSync('styles')
		.filter((file) => file.endsWith('.css') && file !== 'index.css')
		.map((file) => `styles/${file}`),
	'tests/harness/theme.css',
];

/** The button classes a selector's subject wears, as exact names with the leading dot. */
const buttonClassesOn = (selector: Selector, classes: Set<string>): string[] =>
	subjectClasses(selector)
		.map((name) => `.${name}`)
		.filter((name) => classes.has(name));

/**
 * Does this rule style a BUTTON at all?
 *
 * A known class on the subject is the ordinary case. The other one is a bare `button` type
 * selector — `button:not(.rp-dialog-button)`, `.rp-editor-toolbar button` — which targets buttons
 * without naming any of this project's classes and so was outside the sweep entirely.
 *
 * That gap survived a review finding about the same selector. The finding was that `:not()`'s
 * contents were read as classes the subject WEARS, which exempted the rule; fixing that stopped
 * the exemption and left the rule matching no class at all, so it went from wrongly exempt to
 * silently out of scope — a quieter version of the same miss. Found by re-running every historical
 * hole against the rewritten reader rather than by the unit cases, which is the argument for
 * keeping that sweep.
 */
const targetsAButton = (selector: Selector, classes: Set<string>): boolean =>
	buttonClassesOn(selector, classes).length > 0 ||
	compoundsOf(selector).at(-1)?.components.some((component) => component.type === 'type' && component.name === 'button') ===
		true;

/**
 * Is this selector one the threshold GOVERNS — a button rule that has not deferred to the host?
 *
 * Asked of each ALTERNATIVE separately, and true if any one of them is governed. `:is()` is a
 * union, so a selector can carry a deferring branch and a governed one at once:
 * `:is(.rp-dialog-button, button)` folds down to the one class the exemption names, inherits its
 * carve-out, and the `button` branch — every button in the project — rides out on it. Folding the
 * branches together is the same defect as reading `:not()`'s contents as classes the subject
 * wears, one layer up.
 *
 * SPECIFICITY is asked of the original selector, never of a branch: `:is(.a, button)` scores its
 * most specific argument for every element it matches, so a branch scored alone would rank the
 * rule lower than the cascade does. Expansion answers WHICH elements a rule reaches; the ranking
 * is a separate question with a separate answer.
 *
 * The two halves of the branch decision are here together rather than inline in the loop because
 * they cancelled each other out there and nothing noticed. `targetsAButton` brought a bare
 * `button` subject into scope; `onSubject` is empty for exactly those selectors, and `every` over
 * an empty list is TRUE, so the deferral clause immediately took every one of them back out. The
 * fix was one `length > 0`; the lesson is that the unit cases drove `targetsAButton` alone and so
 * agreed with a predicate that decided nothing. A test drives THIS.
 *
 * EVERY class a branch's subject wears must be a deferring one for that branch to be exempt. A
 * subject wearing both `.rp-dialog-button` and `.rp-dialog-button-danger` is governed by the
 * stricter of the two, which is the case the substring bug got backwards.
 */
const governsBranch = (branch: Selector, classes: Set<string>): boolean => {
	if (!targetsAButton(branch, classes)) return false;

	const onSubject = buttonClassesOn(branch, classes);

	return !(onSubject.length > 0 && onSubject.every((token) => DEFERS_TO_THE_HOST.includes(token)));
};

const isGoverned = (selector: Selector, classes: Set<string>): boolean =>
	alternativesOf(selector).some((branch) => governsBranch(branch, classes));


/** A selector rendered back to text, so a failure names something a reader can grep for. */
const show = (selector: Selector): string =>
	selector
		.map((component) => {
			if (component.type === 'class') return `.${component.name}`;
			if (component.type === 'id') return `#${component.name}`;
			if (component.type === 'type') return component.name;
			if (component.type === 'combinator') return component.value === 'descendant' ? ' ' : ` ${component.value} `;
			if (component.type === 'pseudo-class') return `:${component.kind}`;
			if (component.type === 'pseudo-element') return `::${component.kind}`;

			return '';
		})
		.join('');

/**
 * What the focus scan KEYS a branch by — the identity a flattening rule and its ring rule must
 * share for the second to answer the first.
 *
 * A class-bearing subject is keyed by its classes, which is the right granularity: the same class
 * flattened in one sheet and ringed in another is ringed. A subject that names no class of ours is
 * keyed by its SHAPE — the selector with `:focus-visible` removed — because that is the only
 * identity it has. `.rp-editor-toolbar button` and `.rp-editor-toolbar button:focus-visible` reduce
 * to the same string; `.rp-editor-toolbar button:hover` does not, which is correct, since a hover
 * outline is not a focus ring.
 *
 * Without this, a rule targeting our buttons by TYPE was in neither set: it flattened the host's
 * shadow and was never asked for a replacement. The specificity check had already been widened to
 * see a bare `button` subject (`targetsAButton`); this one had not, and its `seen` guard could not
 * notice, because unrelated class-based rules keep that count non-zero.
 */
/** A branch's subject — the components after its last combinator, the element the rule styles. */
const subjectOf = (branch: Selector): SelectorComponent[] =>
	branch.slice(branch.map((component) => component.type).lastIndexOf('combinator') + 1);

const focusKeys = (branch: Selector, classes: Set<string>): string[] => {
	const onSubject = buttonClassesOn(branch, classes);

	if (onSubject.length > 0) return onSubject;
	if (!targetsAButton(branch, classes)) return [];

	// Only the SUBJECT's `:focus-visible` is stripped. An ancestor's is part of what the rule is
	// scoped to and belongs in the key, or two rules that apply under different conditions would
	// answer each other.
	const ancestors = branch.slice(0, branch.length - subjectOf(branch).length);
	const subject = subjectOf(branch).filter(
		(component) => !(component.type === 'pseudo-class' && component.kind === 'focus-visible'),
	);

	return [show([...ancestors, ...subject])];
};

/**
 * The button classes a stylesheet FLATTENS without giving back a ring, each mapped to where.
 *
 * Extracted so a fixture can drive it. The decision is per BRANCH and the branch is the whole
 * point of the function existing: asked of a rule, one selector's focus state was credited to
 * every other selector sharing its declaration block. Driving it through the real stylesheets
 * cannot show that — every button class in them already has a genuine `:focus-visible` rule, so
 * a mis-credited one changes no answer. The defect is only visible on a sheet written to expose
 * it, which is what the cases below supply.
 */
const flattenedWithoutRing = (
	scanned: readonly (readonly [string, string])[],
	classes: Set<string>,
): { readonly offenders: Map<string, string>; readonly seen: number } => {
	const flattened = new Map<string, string>();
	const ringed = new Set<string>();

	// Both sets span every sheet, because the two halves need not share one. A class flattened in
	// `editor.css` and ringed in `dialogs.css` is ringed; scanning a sheet at a time would report it.
	for (const [where, css] of scanned)
		for (const rule of stylesheetRules(css)) {
		// Both read from ONE resolution of the block, in cascade order. Asked declaration by
		// declaration, `box-shadow: none; box-shadow: 0 0 0 3px red` counted as flattening on the
		// strength of a declaration the next line overrides.
		const { outline, shadow } = indicatorOf(rule.declarations);
		const flattens = shadow === false;
		const draws = outline === true || shadow === true;

		// `:focus-visible` is asked of each BRANCH, never of the rule. Asked of the rule,
		// `.rp-editor-tool-button:hover, .other:focus-visible { outline: 2px solid red }` marked the
		// button ringed for an outline it only ever draws under the pointer. It ran the other way
		// too — a selector list containing ANY `:focus-visible` could not record a flattening sibling
		// at all, so `.a, .b:focus-visible { box-shadow: none }` lost `.a`. One rule-level boolean,
		// two opposite errors, and the second one is the quieter of the two.
		for (const selector of rule.selectors) {
			for (const branch of alternativesOf(selector)) {
				// On the SUBJECT compound, never anywhere in the branch. Focusing a button does not make
				// its ancestor match `:focus-visible`, so
				// `.rp-editor-toolbar:focus-visible .rp-editor-tool-button` says nothing about the button's
				// own focus state — and a branch-wide search credited it a ring for one.
				const ringsFocus = subjectOf(branch).some(
					(component) => component.type === 'pseudo-class' && component.kind === 'focus-visible',
				);

				for (const cls of focusKeys(branch, classes)) {
					if (ringsFocus && draws) ringed.add(cls);
					// The base rule only — a `:hover` or `:disabled` variant suppressing the shadow says
					// nothing about the resting state a ring is drawn on.
					else if (!ringsFocus && flattens) flattened.set(cls, `${where}: ${show(selector)}`);
				}
			}
		}
	}

	const seen = flattened.size;

	for (const cls of ringed) flattened.delete(cls);

	// `seen` is every class this scan found flattened, ringed or not. The real-sheet case asserts it
	// is non-zero: an empty offender list is equally true of a scan that found no buttons at all —
	// the same trap `accessibility.test.ts` names for an `it.each` over an empty array — and this
	// check has already been silently out of scope twice for exactly that reason.
	return { offenders: flattened, seen };
};

describe('the instrument', () => {
	it.each([
		['button:not(.clickable-icon)', [0, 1, 1]],
		['.rp-dialog-button', [0, 1, 0]],
		['.rp-dialog .rp-dialog-button-danger', [0, 2, 0]],
		['.rp-harness-scheme.rp-harness-scheme', [0, 2, 0]],
		['.rp-editor-toolbar .rp-editor-tool-button:disabled', [0, 3, 0]],
		['#id div.a::after', [1, 1, 2]],
	])('scores %s', (selector, expected) => {
		expect(specificityOf(parseSelector(selector))).toEqual(expected);
	});

	// The two the threshold itself depends on. Score `:not()` as if it were free and Obsidian's
	// rule reads (0,0,1), which every bare class would then beat — this file would pass while
	// every rule it guards lost in the browser.
	it('gives :not() its argument, which is the whole reason the threshold is (0,1,1)', () => {
		expect(specificityOf(parseSelector('button:not(.clickable-icon)'))).toEqual([...OBSIDIAN_BUTTON]);
		expect(moreSpecific(specificityOf(parseSelector('.rp-dialog-button')), OBSIDIAN_BUTTON)).toBe(false);
		expect(moreSpecific(specificityOf(parseSelector('.rp-dialog .rp-dialog-button-danger')), OBSIDIAN_BUTTON)).toBe(true);
	});

	// `:where()` is the exception in the same family — specificity ZERO, argument included.
	it('gives :where() nothing', () => {
		expect(specificityOf(parseSelector(':where(.a, .b) .c'))).toEqual([0, 1, 0]);
	});

	/**
	 * A selector LIST inside `:is()`/`:not()`/`:has()` contributes its MOST SPECIFIC argument,
	 * never the sum (CSS Selectors 4). Summing them is a FALSE PASS, which is the direction that
	 * matters: Codex's example `:is(.rp-editor-tool-active, .other)` scored (0,2,0) and cleared
	 * the threshold while its real specificity is (0,1,0) and it loses to Obsidian's rule.
	 */
	it.each([
		[':is(.a, .b.c)', [0, 2, 0]],
		[':is(.rp-editor-tool-active, .other)', [0, 1, 0]],
		[':not(.a, .b.c)', [0, 2, 0]],
	])('takes the most specific argument of %s, not their sum', (selector, expected) => {
		expect(specificityOf(parseSelector(selector))).toEqual(expected);
	});

	// The argument pattern cannot match nested parentheses, and one `String.replace` pass never
	// re-scans what it rewrote — so an inner pseudo has to be resolved before the outer one.
	it('scores a nested functional pseudo rather than skipping it', () => {
		expect(specificityOf(parseSelector(':is(.a:not(.b))'))).toEqual([0, 2, 0]);
	});

	/**
	 * A selector LIST arrives as a list. The comma inside `:is(.a, .b)` separates nothing at the
	 * outer level, and a text split once cut that selector into two fragments — neither of them a
	 * selector, both scored wrongly. The parser makes the mistake unrepresentable: the outer list
	 * has one entry and the pseudo owns its own.
	 */
	it('reads a selector list as a list, and a nested one as the pseudo\'s own', () => {
		const rules = stylesheetRules(':is(.a, .b), .c { color: red }');

		expect(rules[0].selectors).toHaveLength(2);
		expect(specificityOf(rules[0].selectors[0])).toEqual([0, 1, 0]);
	});

	it('reads the classes off real buttons, and finds the ones only a :class binding carries', () => {
		const classes = buttonClasses();

		expect(classes.size).toBeGreaterThan(3);
		expect(classes).toContain('.rp-editor-tool-active');
		expect(classes).toContain('.rp-dialog-button-danger');
	});

	/**
	 * The imperative half. `.rp-harness-scheme` exists only as a `createEl('button', { cls })` in
	 * `tests/harness/theme.ts`, and a scan of Vue templates alone left every rule governing it
	 * unchecked while its sheet sat in `sheets` looking covered.
	 */
	it('finds a button created through createEl, not only one written as a tag', () => {
		expect(buttonClasses()).toContain('.rp-harness-scheme');
	});

	/**
	 * And one in a PROTOTYPE. The tree is never shipped, but `styles/work-packages.css` is, and
	 * the harness is where a mock is looked at — a rule that loses the cascade there is a mock
	 * being judged wrongly, which is the one thing that tree exists to prevent.
	 */
	it('finds a button in a prototype, whose sheet ships even though the mock does not', () => {
		expect(buttonClasses()).toContain('.rp-wp-new');
	});

	/**
	 * WHOLE TOKENS. `.rp-dialog-button` is a prefix of `.rp-dialog-button-danger`, and a substring
	 * test handed the danger rule the base class's `DEFERS_TO_THE_HOST` exemption — so the one
	 * rule this check was written for was the one rule it skipped.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		const classes = new Set(['.rp-dialog-button', '.rp-dialog-button-danger']);

		expect(buttonClassesOn(parseSelector('.rp-dialog .rp-dialog-button-danger'), classes)).toEqual(['.rp-dialog-button-danger']);
		expect(buttonClassesOn(parseSelector('.rp-dialog .rp-dialog-button'), classes)).toEqual(['.rp-dialog-button']);
	});

	/**
	 * `:not()` EXCLUDES, so its classes are not worn by the subject. Reading them as worn was a
	 * false pass with a nasty shape: `button:not(.rp-dialog-button)` matched the one class on the
	 * `DEFERS_TO_THE_HOST` list, inherited its exemption, and was skipped — while the rule
	 * actually applies to every OTHER button in the project.
	 *
	 * `:has()` goes with it: its argument describes a DESCENDANT, not the subject. `:is()` and
	 * `:where()` are the opposite — alternatives the subject may match — so their classes stay.
	 */
	it.each([
		['button:not(.rp-dialog-button)', []],
		['button:has(.rp-dialog-button)', []],
		[':is(.rp-dialog-button, .other)', ['.rp-dialog-button']],
		[':where(.rp-dialog-button)', ['.rp-dialog-button']],
		['.rp-dialog-button:not(.other)', ['.rp-dialog-button']],
	])('reads %s as wearing %j', (selector, expected) => {
		expect(buttonClassesOn(parseSelector(selector), new Set(['.rp-dialog-button']))).toEqual(expected);
	});

	/**
	 * A nested pseudo's specificity belongs to its own branch. Folding every result into one total
	 * counted `:is(.a, :not(.b))` twice — (0,2,0) against CSS's (0,1,0) — which reads as beating
	 * Obsidian's rule while actually losing.
	 */
	it.each([
		[':is(.rp-editor-tool-active, :not(.other))', [0, 1, 0]],
		[':is(.a:not(.b), .c)', [0, 2, 0]],
		[':not(:is(.a, .b.c))', [0, 2, 0]],
	])('keeps %s inside its own branch', (selector, expected) => {
		expect(specificityOf(parseSelector(selector))).toEqual(expected);
	});

	/**
	 * A rule can target buttons without naming one of this project's classes. `button:not(.x)` and
	 * `.rp-editor-toolbar button` both do, and both compete with Obsidian's rule at (0,1,1) or
	 * worse — a TIE, decided by source order, which is the fragility this whole check exists to
	 * remove.
	 */
	it.each([
		['button:not(.rp-dialog-button)', true],
		['.rp-editor-toolbar button', true],
		['.rp-dialog-button', true],
		['.rp-editor-toolbar', false],
		['.rp-dialog-button .icon', false],
	])('reads %s as targeting a button: %s', (selector, expected) => {
		expect(targetsAButton(parseSelector(selector), new Set(['.rp-dialog-button']))).toBe(expected);
	});

	/**
	 * The SAME selectors again, one clause further down — and this is the case that matters, because
	 * the two above it all passed while the check governed none of them.
	 *
	 * `targetsAButton` brought a bare `button` subject into scope and the deferral clause took it
	 * straight back out: those selectors wear no known class, `every` over an empty list is true, and
	 * the exemption written for `.rp-dialog-button` swallowed every button in the project that
	 * happened not to name a class. The predicate above answered `true` throughout. Drive the
	 * decision, not its first half.
	 */
	it.each([
		['button:not(.rp-dialog-button)', true],
		['.rp-editor-toolbar button', true],
		['.rp-dialog-button-danger', true],
		['.rp-dialog-button.rp-dialog-button-danger', true],
		['.rp-dialog-button', false],
		['.rp-editor-toolbar', false],
	])('governs %s: %s', (selector, expected) => {
		expect(isGoverned(parseSelector(selector), new Set(['.rp-dialog-button', '.rp-dialog-button-danger']))).toBe(expected);
	});

	/**
	 * `:is()` is a UNION, so an exemption may cover one branch and not another. Folding the
	 * alternatives into one set of classes let `:is(.rp-dialog-button, button)` inherit the
	 * carve-out written for the deferring class and carry every button in the project out with it —
	 * at (0,1,0), which loses to Obsidian's (0,1,1), so the rule the check exists to catch was
	 * exempted by the check.
	 *
	 * The negative direction matters as much: a branch decision that governed every `:is()` would
	 * pass the first two cases and destroy the exemption.
	 */
	it.each([
		[':is(.rp-dialog-button, button)', true],
		[':is(.rp-dialog-button, .rp-dialog-button-danger)', true],
		[':is(.rp-dialog-button, .other) button', true],
		[':is(.rp-dialog-button)', false],
		[':is(.rp-dialog-button, .rp-dialog-button:hover)', false],
		[':is(.rp-dialog-button, .other)', false],
	])('governs each alternative of %s separately: %s', (selector, expected) => {
		expect(isGoverned(parseSelector(selector), new Set(['.rp-dialog-button', '.rp-dialog-button-danger']))).toBe(expected);
	});

	// Expansion answers which elements a rule reaches. It must NOT be how the rule is ranked:
	// `:is()` scores its most specific argument for every element it matches, so the `button`
	// branch of the first selector ranks at (0,1,0) in the cascade, not at the (0,0,1) it would
	// score alone. Scoring a branch would under-rank the rule and report a rule that actually wins.
	it.each([
		[':is(.rp-dialog-button, button)', [0, 1, 0]],
		[':is(button, .a.b)', [0, 2, 0]],
	])('scores %s as a whole, not per branch', (selector, expected) => {
		expect(specificityOf(parseSelector(selector))).toEqual(expected);
	});

	it('reads only the subject, never an ancestor', () => {
		expect(buttonClassesOn(parseSelector('.rp-dialog-button .icon'), new Set(['.rp-dialog-button']))).toEqual([]);
	});

	/**
	 * A class inside a functional pseudo still selects the subject, so the rule is still a button
	 * rule. Reading bare tokens only made `:is(.rp-editor-tool-active, .other)` match no button
	 * class at all — the gate SKIPPED it rather than scoring it, which no threshold change could
	 * ever have rescued.
	 */
	it('sees a subject class inside a functional pseudo', () => {
		const classes = new Set(['.rp-editor-tool-active']);

		expect(buttonClassesOn(parseSelector(':is(.rp-editor-tool-active, .other)'), classes)).toEqual(['.rp-editor-tool-active']);
	});

	/**
	 * A combinator inside parentheses is not an outer combinator. A text split once lost `>`
	 * entirely, because `.a > .b` carries whitespace on both sides of it; a parsed combinator is a
	 * NODE, so neither mistake has a representation here.
	 */
	it('compounds a selector at its own combinators, not at ones inside a pseudo', () => {
		const compounds = compoundsOf(parseSelector('.rp-dialog :is(.a > .b)'));

		expect(compounds).toHaveLength(2);
		expect(compounds[0].after).toBe('descendant');
		expect(compounds[1].after).toBeNull();
	});

	it('scans sheets that exist and hold rules', () => {
		expect(sheets.length).toBeGreaterThan(3);
		expect(stylesheetRules(readFileSync('styles/editor.css', 'utf8')).length).toBeGreaterThan(5);
	});
});

describe('every button rule against Obsidian\'s own', () => {
	it('outranks button:not(.clickable-icon) wherever it sets a property that rule also sets', () => {
		const classes = buttonClasses();
		const losing: string[] = [];

		for (const sheet of sheets) {
			for (const rule of stylesheetRules(readFileSync(sheet, 'utf8'))) {
				if (!rule.declarations.some((declaration) => CONTESTED.has(propertyOf(declaration)))) continue;

				for (const selector of rule.selectors) {
					if (!isGoverned(selector, classes)) continue;
					if (!moreSpecific(specificityOf(selector), OBSIDIAN_BUTTON)) losing.push(`${sheet}: ${show(selector)}`);
				}
			}
		}

		expect(losing).toEqual([]);
	});

	/**
	 * FLATTENING A BUTTON TAKES ITS FOCUS RING WITH IT, and this is the check for that.
	 *
	 * A rule that beats (0,1,1) on `box-shadow` also beats Obsidian's `button:focus-visible`,
	 * which is where a button's ring comes from — and Obsidian's global `:focus { outline: none }`
	 * has already taken the outline, so nothing is left. Measured on a focused toolbar button
	 * after the specificity fix and before this one: `outline: none`, `box-shadow: none`, both
	 * schemes. The same pull request that fixed exactly this defect on the index's entry links
	 * reintroduced it on four other controls, by fixing something else. It was caught by review,
	 * not by any gate here — jsdom resolves no `:focus-visible`, and a capture only shows it if
	 * something happens to be focused when the shutter opens.
	 *
	 * So the rule is stated where it can be enforced: a subject that suppresses `box-shadow` must
	 * have a `:focus-visible` rule of its own. It does not check what that rule DRAWS — that is a
	 * contrast question no gate here can answer (`--interactive-accent` was chosen over Obsidian's
	 * own ring token by measuring both in a browser; the numbers are in `styles/editor.css`).
	 */
	it('gives every flattened button a focus-visible rule, since suppressing the shadow removes the ring', () => {
		const { offenders, seen } = flattenedWithoutRing(
			sheets.map((sheet) => [sheet, readFileSync(sheet, 'utf8')] as const),
			buttonClasses(),
		);

		expect([...offenders.values()]).toEqual([]);
		expect(seen).toBeGreaterThan(2);
	});

	/**
	 * The real sheets cannot show this one, and that is the reason these cases exist rather than an
	 * excuse for them: every button class in them already carries a genuine `:focus-visible` rule,
	 * so a mis-credited one changes no answer there. The defect only appears on a sheet written to
	 * expose it.
	 *
	 * Both directions of the same rule-level boolean. Crediting a sibling's focus state marks a
	 * button ringed for an outline it draws only under the pointer; the same boolean read the other
	 * way stopped a flattening selector being recorded at all, because a sibling in its list happened
	 * to carry `:focus-visible`. The second is the quieter defect — it removes a finding rather than
	 * adding a false one.
	 */
	it.each([
		[
			'a ring credited from a sibling selector',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:hover, .other:focus-visible { outline: 2px solid red; }',
		],
		[
			'a flattening selector beside a focused sibling',
			'.rp-dialog-button, .other:focus-visible { box-shadow: none; }',
		],
		[
			'a ring credited from a sibling inside :is()',
			'.rp-dialog-button { box-shadow: none; } :is(.rp-dialog-button:hover, .other:focus-visible) { outline: 2px solid red; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
	});

	/**
	 * A rule can target our buttons by TYPE and name no class of ours at all. Keyed by class, those
	 * were in neither set — flattening the host's shadow and never asked for a replacement — and the
	 * `seen` guard could not notice, because unrelated class-based rules keep that count non-zero.
	 * They are keyed by SHAPE instead, which is the only identity such a subject has.
	 */
	it.each([
		['flattens and never rings', '.rp-editor-toolbar button { box-shadow: none; }'],
		[
			'flattens and rings only on hover',
			'.rp-editor-toolbar button { box-shadow: none; } .rp-editor-toolbar button:hover { outline: 2px solid red; }',
		],
		['a bare button subject', 'button { box-shadow: none; }'],
	])('reports a type-targeted rule that %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toHaveLength(1);
	});

	/**
	 * A RING BELONGS TO THE ELEMENT THAT IS FOCUSED. Focusing a button does not make its ancestor
	 * match `:focus-visible`, so a rule keyed on the ancestor draws nothing when the button is
	 * tabbed to — and a search over the whole branch credited the button a ring for it.
	 */
	it.each([
		[
			'an ancestor carrying the focus pseudo',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog:focus-visible .rp-dialog-button { outline: 2px solid red; }',
		],
		[
			'a focused ancestor of a type-targeted button',
			'.rp-editor-toolbar button { box-shadow: none; } .rp-editor-toolbar:focus-visible button { outline: 2px solid red; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toHaveLength(1);
	});

	/**
	 * A CASCADE IS AN ORDER, and asking each declaration in isolation has none in it. Every block
	 * below leaves nothing on screen while its FIRST declaration, read alone, says a ring is drawn:
	 * a longhand overriding one component of the shorthand before it, and the same property written
	 * twice. Both are ordinary CSS, neither is exotic, and `some` accepted all of them.
	 */
	it.each([
		'outline: 2px solid red; outline-color: transparent',
		'outline: 2px solid red; outline-style: none',
		'outline: 2px solid red; outline-width: 0',
		'outline: 2px solid red; outline: none',
		'box-shadow: 0 0 0 3px red; box-shadow: none',
	])('does not count %s as a ring', (declarations) => {
		expect(drawsAnIndicator(declarationsOf(declarations))).toBe(false);
	});

	/**
	 * And the other way down the cascade, or "resolve in order" has quietly become "the last
	 * declaration wins outright". A reset FOLLOWED by a real value draws; an important reset beats
	 * a later normal declaration wherever it was written, which is why `stylesheetRules` hands back
	 * normal declarations before important ones.
	 */
	it.each([
		['outline: none; outline: 2px solid red', true],
		['outline-color: transparent; outline: 2px solid red', true],
		['outline: 2px solid transparent; outline-color: red', true],
		['box-shadow: none; box-shadow: 0 0 0 3px red', true],
		['outline: none !important; outline: 2px solid red', false],
		['box-shadow: none !important; box-shadow: 0 0 0 3px red', false],
	])('resolves %s to %s', (declarations, expected) => {
		expect(drawsAnIndicator(declarationsOf(declarations))).toBe(expected);
	});

	// The ring rule reduces to the same shape as the rule that flattened, which is what makes the
	// two answer each other. `:hover` above deliberately does not.
	it.each([
		[
			'a ring on the same shape',
			'.rp-editor-toolbar button { box-shadow: none; } .rp-editor-toolbar button:focus-visible { outline: 2px solid red; }',
		],
		['a bare button ringed', 'button { box-shadow: none; } button:focus-visible { outline: 2px solid red; }'],
	])('says nothing about a type-targeted rule with %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toEqual([]);
	});

	// And stays silent on the shapes that genuinely ring, or the branch rule has become a refusal
	// of every selector list.
	it.each([
		['a ring of its own', '.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }'],
		[
			'a ring shared with a sibling',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible, .other:focus-visible { outline: 2px solid red; }',
		],
		[
			'a ring reached through :is()',
			'.rp-dialog-button { box-shadow: none; } :is(.rp-dialog-button, .other):focus-visible { outline: 2px solid red; }',
		],
		['no flattening at all', '.rp-dialog-button { color: red; }'],
		// The flattening question is asked of the RESOLVED block too, not of each declaration: the
		// `none` here is overridden on the next line, so nothing is flattened and there is nothing
		// to demand a ring for.
		['a suppression its own block overrides', '.rp-dialog-button { box-shadow: none; box-shadow: 0 0 0 3px red; }'],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toEqual([]);
	});

	/**
	 * The check above is a negative, and a negative that has never fired is not known to fire.
	 * This drives the exact spelling every one of the five real defects had — a bare class on a
	 * button, setting a contested property — through the same predicate.
	 */
	/**
	 * The reset spellings. Each is a real declaration that draws no indicator, and each satisfied
	 * the first version of `drawsAnIndicator` because it refused only the literal `none`. A zero
	 * width is the sneakiest: it reads as a deliberate value rather than a switch-off.
	 */
	it.each(['none', '0', '0px', 'initial', 'unset', 'revert'])('does not count outline: %s as a ring', (value) => {
		expect(drawsAnIndicator(declarationsOf(`outline: ${value}`))).toBe(false);
	});

	it.each(['none', 'initial', 'unset'])('does not count box-shadow: %s as a ring', (value) => {
		expect(drawsAnIndicator(declarationsOf(`box-shadow: ${value}`))).toBe(false);
	});

	it('counts a real outline', () => {
		expect(drawsAnIndicator(declarationsOf('outline: 2px solid red;'))).toBe(true);
	});

	/**
	 * A box-shadow ring ordinarily STARTS with zeroes — `0 0 0 3px` is offset, offset, blur,
	 * spread — so the zero rule belongs to `outline`, whose first component is the width, and to
	 * nothing else. A shared rule refused the commonest focus ring there is; this case is what
	 * caught it.
	 */
	it('counts a box-shadow ring that begins with zero offsets', () => {
		expect(drawsAnIndicator(declarationsOf('box-shadow: 0 0 0 3px red;'))).toBe(true);
	});

	// A zero-width SHORTHAND draws nothing however its other components read.
	it('does not count a zero-width outline shorthand', () => {
		expect(drawsAnIndicator(declarationsOf('outline: 0 solid red;'))).toBe(false);
	});

	// `outline-offset` is not an indicator, and its hyphen is what keeps it out of the scan.
	it('does not mistake outline-offset for an indicator', () => {
		expect(drawsAnIndicator(declarationsOf('outline-offset: 1px;'))).toBe(false);
	});

	/**
	 * A value can be a fully deliberate one and still paint nothing. `outline: 2px solid transparent`
	 * has a real width and a real style — every question the earlier version of this predicate asked
	 * comes back "yes" — and the ring is invisible. So is a shadow whose colour is transparent, and
	 * so is one whose four lengths are all zero: that is a shadow exactly the size of the box, with
	 * no blur to spill past it.
	 *
	 * The parser is what makes this one comparison instead of a list of spellings — `transparent`,
	 * `#0000`, `rgba(0,0,0,0)`, `hsla(…,0)` and `light-dark(transparent, transparent)` all arrive as
	 * the same node with `alpha: 0`. A value vocabulary would have had to enumerate them, which is
	 * how this predicate got its previous three holes.
	 */
	it.each([
		'outline: 2px solid transparent',
		'outline: 2px solid #0000',
		'outline: 2px solid rgba(0, 0, 0, 0)',
		'outline: 2px solid light-dark(transparent, transparent)',
		'outline: 2px none red',
		'box-shadow: 0 0 0 3px transparent',
		'box-shadow: 0 0 0 0 red',
	])('does not count %s as a ring', (declaration) => {
		expect(drawsAnIndicator(declarationsOf(declaration))).toBe(false);
	});

	// The other direction, since a colour test that refused everything would pass the block above.
	it.each([
		'outline: 2px solid currentColor',
		'outline: 2px solid rgba(255, 0, 0, 0.5)',
		'box-shadow: 0 0 4px red',
		'box-shadow: 2px 2px 0 0 red',
		'box-shadow: 0 0 0 3px transparent, 0 0 0 3px red',
	])('counts %s as a ring', (declaration) => {
		expect(drawsAnIndicator(declarationsOf(declaration))).toBe(true);
	});

	it('reports a bare class that sets one of the contested properties', () => {
		const bare = '.rp-editor-tool-active';

		expect(buttonClasses()).toContain(bare);
		expect(moreSpecific(specificityOf(bare), OBSIDIAN_BUTTON)).toBe(false);
	});
});

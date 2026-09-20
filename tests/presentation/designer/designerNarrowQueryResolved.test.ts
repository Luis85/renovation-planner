/**
 * @vitest-environment jsdom
 *
 * `designer-narrow.css`'s container query RESOLVED BY HAND against the mounted designer — the
 * blind spot `designerResponsiveShell.test.ts`'s header names and cannot close from inside
 * jsdom, which applies no `@container` query and computes no used width.
 *
 * **This is not `designerStyles.test.ts`'s question, and the difference is the whole reason
 * both files exist.** That file reads what the narrow block DECLARES: it asks the parser for
 * the `flex`, `width` and `border` values under the query's condition and compares them to a
 * reference reading, and it never mounts anything. This file APPLIES those rules to a rendered
 * tree: it evaluates the condition arithmetically at a 520 px leaf, matches each rule's
 * selectors against the real mounted designer with jsdom's own selector engine, and asks what
 * the surviving rules do to the controls they reach. Neither subsumes the other — a rule can be
 * declared correctly and reach nothing, and a rule can reach a control while declaring
 * something no case in `designerStyles.test.ts` asked about.
 *
 * **The blind spot is EMPTY IN THE PARTIAL THIS FILE READS, and that is no longer the same claim
 * as "empty on this surface".** The narrow block declares `flex-direction`, `flex`, `width` and
 * four `border-*` properties and contains no `display`, `visibility` or `content-visibility` at
 * all — which `designerResponsiveShell.test.ts` already states and which the `describe` below
 * re-measures rather than trusting. So the claim here is a GUARD against a future hiding
 * declaration, not a discovery, and every sentence in this file is written that way.
 *
 * **What changed, recorded here rather than left for the next reader to discover.** AD18 item 3
 * shipped the FIRST `display: none` in this repository that reaches a designer toolbar control at
 * a narrow leaf: `styles/designer-toolbar.css` hides `.rp-designer-tool-label` under
 * `@container rp-designer (width < 80rem)`, so at 520 px a label is hidden by a partial this file
 * does not read. Nothing here is red and nothing should be — the control keeps its accessible name
 * through `aria-label` at every width, and a label is not itself a control, which is the whole
 * reason that design is allowed. But the sentence above used to read as "no rule hides anything on
 * this surface", and that is now false; it is narrowed to what this file actually measures.
 *
 * **Widening the read to every `styles/designer*.css` partial was considered and is NOT taken
 * here**, because it changes what this instrument IS. This file resolves ONE partial's container
 * query and throws on a condition shape it cannot read; a sweep over six partials would have to
 * decide what to do with rules that legitimately hide things, and the first thing it would report
 * is the deliberate label rule above. That is a different instrument with a different argument, and
 * building it inside a sentence-correcting edit would be the widening-without-a-decision this
 * repository refuses. The honest state is: the guard is real, its scope is one partial, and the
 * surface now has a hiding declaration outside it.
 *
 * **Which of the two real-sheet cases is the stronger one is stated at each of them, and it is
 * not the mounted one.** Reading the block's DECLARATIONS catches strictly more than applying
 * them to the tree does, because a rule can hide a region that contains no focusable control —
 * `.rp-designer-canvas` is exactly that region, measured. The mounted case earns its place on a
 * failure MESSAGE that names controls, on the per-rule `unmatched` check, and on unconditional
 * rules the declaration case never looks at; it does not earn it on reach.
 *
 * An assertion over an empty set passes for the wrong reason, so the guard is surrounded by
 * cases that prove it is not vacuous, in `regionsReachable.test.ts`'s pattern:
 *
 * - the resolver is driven against FIXTURES first, and must REPORT a control hidden under the
 *   block before it is pointed at the real sheet;
 * - the block is found at all, and its condition is satisfied at 520 and not at 900 or at the
 *   560 px boundary itself — a resolver that answered `true` for everything fails there;
 * - every rule the resolver admits matches at least one element of the mounted tree, so a class
 *   renamed on either side is red rather than quiet;
 * - the admitted rules reach at least one named control, which is the property that makes a
 *   `display: none` catchable at all.
 *
 * Each of those was watched red, and one of them is the reason the resolver resolves the
 * container NAME rather than only the width: renaming the block's container to one the sheet
 * declares nowhere left the first version of this file green in every one of its cases, while in a
 * browser the block had stopped reaching the designer at all. It now empties the admitted set
 * and the "finds the narrow block" case reports it. What is still outside this file is a
 * consistent rename of BOTH halves — `designerStyles.test.ts` is where the literal name
 * `rp-designer` is pinned, and this file checks only that the sheet agrees with itself.
 *
 * **Scope, narrowly.** It reads `styles/designer-narrow.css` and no other partial, so a hiding
 * declaration reaching these regions from `designer.css` or from a theme is outside it. It
 * resolves a width feature against a container name and THROWS on any other condition shape,
 * rather than dropping one it cannot read. And it settles nothing about appearance: jsdom lays
 * nothing out, so "not hidden by this sheet" is not "visible".
 *
 * **What DOES look at this surface below the threshold is a FIXED capture, not a `--width`
 * invocation, and the distinction is a fact about the script rather than a preference.**
 * `resolveShots` (`scripts/entryShots.mjs`) reads a positional argument as a harness-index
 * ENTRY id and refuses a width with no entry beside it — `--width applies to a named entry, and
 * the fixed shots carry their own` — so `npm run harness-shot -- --width=460` throws and
 * captures nothing. The fixed shots carry it instead: `harness-shot.mjs`'s `SHOTS` table has
 * `asset-designer-narrow` and its siblings at `width: 460`, which a bare `npm run harness-shot`
 * writes, and 460 is under the 560 px threshold resolved below, so those captures are this
 * block applied by a real engine. `npm run harness` with `?view=asset-designer` in a browser is
 * the other, and the only place the query is resolved by a browser rather than by this file.
 * Both were read (`resolveShots`, and the table grepped for the designer entries carrying a
 * `width`) rather than run: there is no pinned Chromium on the machine this was written on, and
 * an instruction nobody has run is a plan rather than a procedure — which is exactly how the
 * `--width` spelling above got into a hand-off in the first place.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';
import { designerRig, type DesignerRig } from '../../helpers/designerRig';
import { toiletShape } from '../../helpers/assetShapes';
import { clientWidthFor, resizeTo } from '../../helpers/layout';
import { settle } from '../../helpers/settle';

const NARROW_SHEET = readFileSync('styles/designer-narrow.css', 'utf8');

/**
 * The leaf width the block is resolved at. 520 is AD15 row T42's number and
 * `designerResponsiveShell.test.ts`'s own docblock explains why it is not 460; what matters
 * here is only that it sits below the threshold, which `satisfies` is asked directly.
 */
const LEAF = 520;

/** A height nothing reads: the query is `inline-size` only. */
const HEIGHT = 800;

/** Obsidian's root font size, which is what turns the block's `35rem` into pixels. */
const ROOT_FONT_PX = 16;

const LENGTH_PX: Record<string, number> = { px: 1, rem: ROOT_FONT_PX };

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
	'less-than': (a, b) => a < b,
	'less-than-equal': (a, b) => a <= b,
	'greater-than': (a, b) => a > b,
	'greater-than-equal': (a, b) => a >= b,
	equal: (a, b) => a === b,
};

/**
 * Every container name `css` mentions in a `container-name` declaration, ANYWHERE in the sheet.
 *
 * That is an APPROXIMATION of the browser's rule and the difference is worth stating. A browser
 * resolves a named `@container` against the nearest ANCESTOR OF THE MATCHED ELEMENT that
 * declares that name AND carries a `container-type`; this looks at neither the ancestry nor
 * `container-type`. Both gaps make it ADMIT rules a browser might not apply — the safe
 * direction for a guard, since an over-admitted rule can only produce a finding to look at,
 * never hide one — and both are closed in practice by the sheet itself, which puts
 * `container-type` and `container-name` on one root rule that is an ancestor of every selector
 * the block uses.
 *
 * Only the `container-name` longhand is read — the spelling `designer-narrow.css` uses and the
 * one `designerStyles.test.ts` pins the literal `rp-designer` on. A sheet rewritten to the
 * `container` shorthand would leave this empty, every named block would stop applying, and the
 * "finds the narrow block" case below goes red rather than quiet; that is the failure this
 * narrowness is allowed to have.
 */
function containerNames(css: string): Set<string> {
	const declared = stylesheetRules(css).flatMap((rule) =>
		rule.declarations.filter((d) => propertyOf(d) === 'container-name').map((d) => d as { value?: unknown }),
	);

	return new Set(
		declared.flatMap((d) => {
			const value = d.value as { type?: string; value?: unknown };
			return value.type === 'names' ? (value.value as string[]) : [];
		}),
	);
}

/**
 * Does a rule carrying `condition` apply to a container that is `width` pixels wide and carries
 * one of `names`?
 *
 * `StyleRule.condition` is the PARSED query serialized — `stylesheetRules` says so — so this
 * reads a tree rather than the source text, and `''` (no condition) always applies. It handles
 * exactly one shape: a `@container`, named or unnamed, whose query is a single width range
 * against a `px` or `rem` length. Anything else throws, because a condition silently treated as
 * inapplicable would drop its rules out of the resolved set and leave this file green about
 * rules it never looked at.
 *
 * **"Throws NAMING the condition" is true of every shape but one.** `stylesheetRules` composes
 * NESTED at-rule conditions as `[outer, inner].toSorted().join(' and ')` — two JSON documents
 * joined by a word — so a rule inside two conditions reaches `JSON.parse` as something that is
 * not JSON and fails with its `SyntaxError` rather than with the message below. Still fail
 * closed, and the correction is to the sentence rather than to the code.
 *
 * The NAME is resolved as well as the width, and that was measured rather than assumed: the
 * first version of this ignored it, so retitling the block's container to one nothing declares
 * left every case in the file green while the block had stopped reaching the designer in a real
 * browser. An unnamed query addresses the nearest container whatever it is called, so it
 * applies regardless of `names`.
 */
function satisfies(condition: string, width: number, names: ReadonlySet<string>): boolean {
	if (condition === '') return true;

	const refuse = (why: string): never => {
		throw new Error(`cannot resolve the condition (${why}): ${condition}`);
	};
	const parsed: unknown = JSON.parse(condition);
	if (!Array.isArray(parsed) || parsed[0] !== 'container') return refuse('not a container query');

	const named = parsed[2] as string | null;
	if (named !== null && !names.has(named)) return false;

	const query = parsed[3] as { type?: string; value?: Record<string, unknown> };
	if (query.type !== 'feature') return refuse('not a single feature');

	const feature = query.value as { type?: string; name?: string; operator?: string; value?: unknown };
	if (feature.type !== 'range' || feature.name !== 'width') return refuse('not a width range');

	const length = feature.value as { type?: string; value?: { value?: { unit?: string; value?: number } } };
	const unit = length.type === 'length' ? (length.value?.value?.unit ?? '') : '';
	const scale = LENGTH_PX[unit];
	const compare = COMPARE[feature.operator ?? ''];
	if (scale === undefined) return refuse(`unsupported length unit '${unit}'`);
	if (compare === undefined) return refuse(`unsupported operator '${String(feature.operator)}'`);

	// The one SILENT fallback in an otherwise refusing resolver: a length whose unit parsed but
	// whose magnitude did not becomes 0, so `width < 0` is false and the rule is dropped rather
	// than reported. Left rather than turned into a throw because the backstop is already here
	// and is louder — a dropped narrow rule empties `narrowOnly` and reddens the
	// "finds the narrow block" case, which names the block rather than one declaration.
	return compare(width, (length.value?.value?.value ?? 0) * scale);
}

/** The rules of `css` that apply to a container `width` pixels wide, the condition resolved. */
function applyingAt(css: string, width: number): StyleRule[] {
	const names = containerNames(css);
	return stylesheetRules(css).filter((rule) => satisfies(rule.condition, width, names));
}

/** The narrow block's rules: those that apply at `LEAF` and would NOT apply to a wide leaf. */
const narrowOnly = (css: string): StyleRule[] => {
	const names = containerNames(css);
	return applyingAt(css, LEAF).filter((rule) => !satisfies(rule.condition, 1400, names));
};

/**
 * The three PROPERTIES this file recognises as hiding a subject, at four values — not the set
 * of ways a control can leave the screen, which is much larger and is not what this pretends
 * to cover. `opacity: 0`, a zero width or height, positioning off-screen and `clip-path` all
 * take a control away and NONE of them is recognised here.
 *
 * Each value is matched by the PARSER's own reading of a reference rule rather than by a value
 * spelled out in code — the trick `designerStyles.test.ts` uses. That makes the match exact
 * rather than lenient, and exactness cuts both ways: `content-visibility` is not a property
 * lightningcss knows, so it parses as a CUSTOM one whose value is a raw token (measured), and
 * `content-visibility: HIDDEN` therefore serialises differently and is MISSED here. The
 * declaration case at the bottom of this file keys on the property name alone and catches that
 * spelling; `hiddenControls` does not. (`!important` is not a gap — probed, the declaration's
 * JSON is identical either way.)
 */
const HIDING: readonly [string, string][] = [
	['display', 'none'],
	['visibility', 'hidden'],
	['visibility', 'collapse'],
	['content-visibility', 'hidden'],
];

const hidingValues = new Set(
	HIDING.map(([property, value]) =>
		JSON.stringify(stylesheetRules(`.reference { ${property}: ${value}; }`)[0]?.declarations[0]),
	),
);

/** Which of a rule's declarations hide their subject, by property name. */
const hidesWith = (rule: StyleRule): string[] =>
	rule.declarations.filter((d) => hidingValues.has(JSON.stringify(d))).map((d) => propertyOf(d));

/**
 * Six element kinds, named exactly — NOT "everything a user can put the focus on", which this
 * would have to spell `[tabindex]`, `[contenteditable]`, `audio[controls]`, `video[controls]`,
 * `iframe` and `area[href]` to mean.
 *
 * That is not academic on this surface: `DesignerInspector.vue` and
 * `DesignerSelectionInspector.vue` put `tabindex="-1"` on the inspector `<aside>`, and
 * `DesignerPartRow`, `DesignerPartGroupRow` and `AssetPresetGallery` bind a roving `:tabindex`.
 * Those are all `<button>`s today, so this list happens to reach them — by the markup's current
 * shape rather than by anything this sentence promises.
 */
const CONTROLS = 'button, input, select, textarea, summary, a[href]';

/** A control named the way a failure should report it, never empty. */
function nameOf(element: Element): string {
	const label = element.closest('label');
	const text =
		(element.textContent ?? '').trim()
		|| (element.getAttribute('aria-label') ?? '').trim()
		|| (label === null ? '' : (label.textContent ?? '').trim());

	return text === '' ? `<${element.tagName.toLowerCase()} class="${element.className}">` : text;
}

/**
 * The elements BELOW `root` a rule reaches, through jsdom's own selector engine.
 *
 * Below, not including: `querySelectorAll` never answers with the element it was asked of, so a
 * future narrow rule whose subject is `.renovation-asset-designer` itself reaches zero here.
 * That fails LOUDLY rather than quietly — the rule lands in `unmatched` and the case below names
 * its selector — which is why this is a documented bound rather than a bug to fix. Ancestors
 * outside `root` still participate in matching, which is what lets a descendant selector
 * naming the root class match at all.
 */
const reaches = (rule: StyleRule, root: HTMLElement): Element[] =>
	rule.selectors.flatMap((selector) => [...root.querySelectorAll(show(selector))]);

/**
 * Every named control that a rule of `css` applying at `width` would hide, as
 * `"<control> by <selector> (<property>)"` — a sentence, so a failure names the control a
 * future declaration took away rather than printing a count.
 *
 * A control is hidden by a rule that matches the control ITSELF or any element containing it:
 * `display: none` on `.rp-designer-inspector` takes every button in the inspector with it, and
 * a check that only asked about the controls' own classes would miss exactly that.
 */
function hiddenControls(css: string, root: HTMLElement, width: number): string[] {
	const controls = [...root.querySelectorAll(CONTROLS)];

	return applyingAt(css, width).flatMap((rule) => {
		const properties = hidesWith(rule);
		if (properties.length === 0) return [];

		const subjects = reaches(rule, root);
		const selector = rule.selectors.map(show).join(', ');
		return controls
			.filter((control) => subjects.some((subject) => subject === control || subject.contains(control)))
			.map((control) => `${nameOf(control)} by ${selector} (${properties.join(', ')})`);
	});
}

/** A fixture tree with one region and one named control in it, attached so selectors resolve. */
function fixtureTree(): HTMLElement {
	const root = document.createElement('div');
	root.className = 'renovation-asset-designer';
	root.innerHTML =
		'<div class="rp-designer-body"><div class="rp-designer-inspector">'
		+ '<button class="rp-designer-selection-button">Centre</button>'
		+ '</div></div>';
	document.body.appendChild(root);
	return root;
}

/** The root's own `container-name` declaration and one narrow rule — a whole sheet, as `applyingAt` reads one. */
const under = (declarations: string, container = 'rp-designer'): string =>
	'.renovation-asset-designer { container-type: inline-size; container-name: rp-designer; }'
	+ `@container ${container} (width < 35rem) { .renovation-asset-designer .rp-designer-inspector { ${declarations} } }`;

describe('the container-query resolver', () => {
	let root: HTMLElement;
	beforeAll(() => {
		root = fixtureTree();
	});
	afterAll(() => {
		root.remove();
	});

	/**
	 * The arithmetic the whole file rests on, pinned at the BOUNDARY rather than at a
	 * comfortable distance from it: `35rem` is 560 px at a 16 px root and the operator is `<`,
	 * so 559 applies and 560 does not. A resolver reading the root font as anything else, or
	 * reading `less-than` as `less-than-equal`, fails one of these four.
	 */
	it.each([
		[LEAF, true],
		[559, true],
		[560, false],
		[900, false],
	])('resolves the narrow block at %ipx to %s', (width, applies) => {
		const css = under('flex: 1;');
		const condition = stylesheetRules(css).find((rule) => rule.condition !== '')?.condition;

		expect(condition).toBeDefined();
		expect(satisfies(condition ?? '', width, containerNames(css))).toBe(applies);
	});

	/** The case the file exists for, kept permanently rather than watched once in a scratch run. */
	it.each(HIDING)('reports a control the block hides with %s: %s', (property, value) => {
		expect(hiddenControls(under(`${property}: ${value};`), root, LEAF)).toEqual([
			`Centre by .renovation-asset-designer .rp-designer-inspector (${property})`,
		]);
	});

	it('reports a control hidden by a rule with no condition at all', () => {
		const always = '.renovation-asset-designer .rp-designer-inspector { display: none; }';

		expect(hiddenControls(always, root, LEAF)).toHaveLength(1);
	});

	/** The condition is really evaluated: the same sheet reports nothing at a width above it. */
	it('reports nothing at a width the block does not apply to', () => {
		expect(hiddenControls(under('display: none;'), root, 900)).toEqual([]);
	});

	/**
	 * And the NAME is really evaluated, which the first version of this resolver did not do: a
	 * block addressing a container this sheet declares nowhere reaches nothing in a browser, so
	 * it reaches nothing here either. The same mutation against the real sheet is what empties
	 * `narrowOnly` and reddens the "finds the narrow block" case below.
	 */
	it('reports nothing for a block naming a container the sheet does not declare', () => {
		expect(hiddenControls(under('display: none;', 'rp-other'), root, LEAF)).toEqual([]);
	});

	/** What the real block declares, and the reason this guard finds nothing today. */
	it('reports nothing for a block that only rearranges', () => {
		expect(hiddenControls(under('flex: 2 1 0; width: auto; border-left: none;'), root, LEAF)).toEqual([]);
	});

	/** A rule reaching no control is not a finding, however it declares itself. */
	it('reports nothing for a hiding rule that reaches no control', () => {
		const elsewhere = under('display: none;').replace('.rp-designer-inspector', '.rp-designer-status');

		expect(hiddenControls(elsewhere, root, LEAF)).toEqual([]);
	});

	/**
	 * Fail closed: a condition this resolver cannot read is never silently inapplicable. Each
	 * fixture carries the root's `container-name` too, or the name check would decline the rule
	 * before the shape it is here to refuse was ever looked at.
	 */
	it.each([
		['@media (width < 35rem) { .a { display: none; } }', 'not a container query'],
		['@container rp-designer (width < 35em) { .a { display: none; } }', "unsupported length unit 'em'"],
		['@container rp-designer (orientation: portrait) { .a { display: none; } }', 'not a width range'],
	])('throws rather than dropping a condition it cannot resolve: %s', (css, why) => {
		const declared = '.renovation-asset-designer { container-name: rp-designer; }';

		expect(() => applyingAt(declared + css, LEAF)).toThrow(why);
	});
});

describe('the asset designer’s narrow block applied to the mounted tree', () => {
	/** One mount for every case below: the rig builds a real Konva stage and is not cheap. */
	const MOUNT_MS = 60_000;
	let rig: DesignerRig;
	let root: HTMLElement;

	beforeAll(async () => {
		// Both channels a width can arrive through, as `designerResponsiveShell.test.ts` supplies
		// them — not because anything in this tree reads one (nothing does; that file's
		// import-graph walk is the measurement), but so the tree under test is the same tree that
		// file asserts about at this width.
		const restore = clientWidthFor((element) =>
			element.classList.contains('renovation-asset-designer') ? LEAF : 0,
		);
		try {
			rig = await designerRig({ shape: toiletShape() });
		} finally {
			restore();
		}
		root = rig.wrapper.element as HTMLElement;
		resizeTo(root, LEAF, HEIGHT);
		await settle();
	}, MOUNT_MS);

	afterAll(() => {
		rig.unmount();
	});

	/**
	 * The instrument reached something. Three halves rather than one, because each answers a
	 * different way for this guard to become a no-op: the block could stop being found (a
	 * retitled container empties it, measured), its rules could stop matching the tree (a
	 * renamed region class, measured), and the rules could stop reaching a control — after which
	 * no `display: none` anyone writes there would be caught.
	 *
	 * The third half is asserted over the UNION of the block's rules, so three of the four could
	 * stop reaching a control and this stays green. The `unmatched` check above is the one that
	 * is per-rule, and it is why a renamed class is named rather than counted.
	 */
	it('finds the narrow block, matches it against the tree, and reaches controls through it', () => {
		const narrow = narrowOnly(NARROW_SHEET);
		expect(narrow.length).toBeGreaterThan(0);

		// Reported as the unmatched SELECTORS, so the failure names the rule whose class moved.
		const unmatched = narrow.filter((rule) => reaches(rule, root).length === 0);
		expect(unmatched.map((rule) => rule.selectors.map(show).join(', '))).toEqual([]);

		const reached = new Set(narrow.flatMap((rule) => reaches(rule, root)));
		const controls = [...root.querySelectorAll(CONTROLS)].filter((control) =>
			[...reached].some((subject) => subject === control || subject.contains(control)),
		);
		expect(controls.length).toBeGreaterThan(0);
	});

	/**
	 * The mounted reading, and it is the WEAKER of the two cases below — which the first draft of
	 * this file had exactly backwards, calling it the one the file exists for.
	 *
	 * `hiddenControls` reports a hiding rule only when its subject contains something matching
	 * `CONTROLS`, and `.rp-designer-canvas` contains nothing that does: `DesignerCanvas` renders
	 * `EditorSurface` → `VStage`, which is `<canvas>` elements and overlay `<div>`s, and the two
	 * children that WOULD carry a control, `ViewFailure` and `EmptyState`, are arms a loaded
	 * design does not take. **Measured, not reasoned**: adding `display: none` on
	 * `.rp-designer-canvas` to the narrow block left this case GREEN and reddened only the
	 * declaration case below — and hiding the canvas is the worst single regression this layout
	 * can suffer. So every hiding declaration this case can catch, the next one catches too.
	 *
	 * What it buys that the next one does not, which is why it stays: a failure that NAMES the
	 * controls taken away rather than a property, the `unmatched` selector check above that only
	 * a mounted tree can make, and reach over an UNCONDITIONAL hiding rule added to this
	 * partial — which `narrowOnly` excludes and the declaration case therefore never sees.
	 */
	it('takes no control away from a leaf at the narrow width', () => {
		expect(hiddenControls(NARROW_SHEET, root, LEAF)).toEqual([]);
	});

	/**
	 * **The case that actually guards the sheet**, and the reason the paragraph above is a
	 * measurement rather than a memory. It reads the block's declarations by PROPERTY NAME, so
	 * it is blind to nothing the case above sees: a rule reaching no control, a subject holding
	 * only canvases, and a value spelled `HIDDEN` that `hidingValues` would not match.
	 *
	 * It is three lines and needs no DOM at all.
	 */
	it('declares no display, visibility or content-visibility in the narrow block', () => {
		const declared = narrowOnly(NARROW_SHEET).flatMap((rule) => rule.declarations.map((d) => propertyOf(d)));

		expect(declared.filter((property) => HIDING.some(([hiding]) => hiding === property))).toEqual([]);
	});
});

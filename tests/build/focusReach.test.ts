import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonClassGroups, buttonClasses, sheets } from '../helpers/buttonRules';
import { flattenedWithoutRing } from '../helpers/focusCascade';

/**
 * WHICH ELEMENTS A RULE REACHES, asked of the focus scan and of nothing else.
 *
 * Split from `buttonFocusRing.test.ts` at its line budget — the fourth cut of this seam, and like
 * the other three it separates two questions rather than two halves of one. What stays there is
 * about the CASCADE: many rules over one element, and which wins. These are about REACH: whether a
 * rule applies to the button at all — an ancestor's focus state is not the button's, a type-targeted
 * subject wears no class of ours, a border-based indicator is one this scan cannot judge.
 *
 * The fixture set is duplicated rather than shared, deliberately: a helper exporting `BUTTONS` and
 * `GROUPS` would make one file's edit silently change the other's answers, and both files assert
 * against exact offender lists.
 */
const BUTTONS = new Set(['.rp-dialog-button', '.rp-dialog-button-danger', '.rp-editor-tool-button']);
const GROUPS: ReadonlySet<string>[] = [
	new Set(['.rp-dialog-button', '.rp-dialog-button-danger']),
	new Set(['.rp-editor-tool-button']),
];

describe('which elements a focus rule reaches', () => {
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
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toHaveLength(1);
	});


	// The ring rule reduces to the same shape as the rule that flattened, which is what makes the
	// two answer each other. `:hover` above deliberately does not.
	it.each([
		[
			'a ring on the same shape',
			'.rp-editor-toolbar button { box-shadow: none; } .rp-editor-toolbar button:focus-visible { outline: 2px solid red; }',
		],
		['a bare button ringed', 'button { box-shadow: none; } button:focus-visible { outline: 2px solid red; }'],
		// THE RING AND THE FLATTENING RULE NEED NOT NAME THE BUTTON THE SAME WAY. A bare `button`
		// subject matches every button, so this ring reaches the flattened class as surely as a
		// type-targeted RESET reaches it — which the case below this block already covered. Only the
		// revoking direction was widened, so the drawing rule stayed filed under `button`, could not
		// answer a site filed under `.rp-dialog-button`, and the gate rejected CSS that rings.
		[
			'a class flattened and a type-targeted ring',
			'.rp-dialog-button { box-shadow: none; } button:focus-visible { outline: 2px solid red; }',
		],
		// And the other way down that cascade, or "the reset wins" has replaced "the set wins". At
		// EQUAL scope only — the more-specific version of this puts the ring back inside `.rp-dialog`
		// and nowhere else, which is a reporting case below rather than a silent one.
		// And the twin of the reporting case above, which is what keeps the per-longhand cascade from
		// becoming "two rules setting different longhands never draw": these two combine into a solid
		// red outline of the initial medium width, and that is a ring.
		[
			'an outline assembled from two rules',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-color: red; } .rp-dialog-button:focus-visible { outline-style: solid; }',
		],
		// AN IMPORTANT SHORTHAND BESIDE A REDUNDANT NORMAL LONGHAND. The important `outline` wins every
		// component in the browser, so this ring stands and the later normal reset cannot touch it.
		// Under the whole-outline importance this file used to resolve, the normal `outline-color`
		// made `every(...)` false, the block read as wholly normal, and the reset beat it — the gate
		// rejecting CSS that rings. Per-longhand importance has no such arm: `outline` being important
		// makes every part important, whatever else the block also sets.
		[
			'an important outline shorthand beside a normal longhand',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red !important; outline-color: red; } .rp-dialog-button.rp-dialog-button:focus-visible { outline: none; }',
		],
		// And the other direction: a `:focus` RING draws when the button is tabbed to, so it answers a
		// flattening site as surely as a `:focus-visible` one. Without this the widening above would
		// be half-applied — hearing every reset while crediting no ring, which reports valid CSS.
		[
			'a ring drawn on plain :focus',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus { outline: 2px solid red; }',
		],
		[
			'a reset a later rule of equal specificity puts back',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
	])('says nothing about a type-targeted rule with %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});

	/**
	 * A CONDITION IS NOT AN IDENTITY, and a subject that is focus PLUS a condition still reaches every
	 * button. `:focus-visible:not(.keep-ring) { outline: none }` bares every focused element that has
	 * not opted out — dialog buttons included — and was in no cascade at all, because the surviving
	 * `:not()` made the subject non-universal and there was no class or `button` type left for either
	 * predicate to see.
	 *
	 * A ring at (0,2,0) with a MORE specific reset below it, so each case turns on whether the reset
	 * is filed at all. The four refusals are the round-14 line: a class, a type, an id or an attribute
	 * identifies a subset this scan cannot enumerate, and filing one would invent a key nothing can
	 * answer. A pseudo-class is a state, not a kind.
	 */
	it.each([
		[
			'a classless focus reset carrying its own conditions',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } :focus-visible:not(.keep-ring):not(.x) { outline: none; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
	});

	it.each([
		['a class', '.other.other.other:focus-visible'],
		['an attribute', '[data-x][data-y][data-z]:focus-visible'],
		['a type', 'span.a.b.c:focus-visible'],
		['an id', '#x:focus-visible'],
	])('says nothing about a more specific reset whose subject names %s', (_case, selector) => {
		expect([
			...flattenedWithoutRing(
				[
					[
						'fixture',
						`.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } ${selector} { outline: none; }`,
					],
				],
				BUTTONS,
				GROUPS,
			).offenders.keys(),
		]).toEqual([]);
	});

	/**
	 * AND `*` IS DROPPED FROM THE CONDITIONS, for exactly the reason the `button` type is: it narrows
	 * nothing. Kept, it rendered as a token no site's subject list ever contains, so a universal ring
	 * was filed into every class cascade by `cascadeKeys` and then refused by `covers` in all of
	 * them — reaching the cascade only to be thrown out of it, which is the failure the `button` type
	 * comment already warned about one line above. Found by probing this fix rather than reported.
	 */
	it('says nothing about a universal focus ring over a flattened button', () => {
		expect([
			...flattenedWithoutRing(
				[['fixture', '.rp-dialog-button { box-shadow: none; } *:focus-visible { outline: 2px solid red; }']],
				BUTTONS,
				GROUPS,
			).offenders.keys(),
		]).toEqual([]);
	});

	/**
	 * A RESERVED TRANSPARENT BORDER REVEALED ON FOCUS IS A REAL INDICATOR, and a common one: it draws
	 * a ring and shifts no layout. Reported as unringed, the gate FAILED THE BUILD on valid CSS.
	 *
	 * This scan ABSTAINS rather than crediting properly, and the reason is that modelling a border as
	 * an indicator channel would be worse than the bug. The outline and shadow model asks "does the
	 * focused state paint something"; for a border that is the wrong question, because a button with a
	 * permanent visible border and no focus treatment at all answers YES. The indicator is the CHANGE
	 * between resting and focused, a comparison this file makes nowhere.
	 *
	 * The cost is a narrow silence — `:focus-visible { border-color: transparent }` no longer reports —
	 * and it is the cheaper side of the trade against failing correct CSS.
	 */
	it.each([
		[
			'a transparent border coloured on focus',
			'.rp-dialog-button { box-shadow: none; border: 2px solid transparent; } .rp-dialog-button:focus-visible { border-color: red; }',
		],
		[
			'a logical border set on focus',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { border-inline: 2px solid red; }',
		],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});

	/**
	 * A BORDER SET AT REST IS NOT A FOCUS TREATMENT — it is the box the button already has — so it
	 * cannot buy silence for a button with no ring. This was a LIVE hole rather than a latent one:
	 * `.rp-editor-toolbar .rp-editor-tool-button` sets `box-shadow: none` and a transparent border in
	 * the shipped sheet, so with its real `:focus-visible` rule deleted this scan stayed green.
	 *
	 * The abstention was correct when written, and stopped being so three commits later: it was filed
	 * for focus branches only until base rules were admitted so they could RANK. One change, two
	 * channels, and the second was not swept.
	 */
	it.each([
		['a border set only at rest', '.rp-dialog-button { box-shadow: none; border: 1px solid red; }'],
		[
			'a border set only on hover',
			'.rp-dialog-button { box-shadow: none; border: 1px solid red; } .rp-dialog-button:hover { border-color: blue; }',
		],
	])('still reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
	});

	it('says nothing about a base border beside a real focus ring', () => {
		expect([
			...flattenedWithoutRing(
				[
					[
						'fixture',
						'.rp-dialog-button { box-shadow: none; border: 1px solid red; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
					],
				],
				BUTTONS,
				GROUPS,
			).offenders.keys(),
		]).toEqual([]);
	});

	/**
	 * AND THE SAME QUESTION ASKED OF THE REAL SHEETS, by deleting the one rule that answers for a real
	 * button and checking the scan notices. Every other real-sheet assertion here is a NEGATIVE — it
	 * passes equally if the scan has stopped seeing that button at all — and this is the case that
	 * tells those apart. It is what the at-rest border hole slipped past.
	 */
	it('reports a real button whose only focus rule is removed', () => {
		const scanned = sheets.map(
			(sheet) =>
				[
					sheet,
					readFileSync(sheet, 'utf8').replace(
						/\.rp-editor-toolbar \.rp-editor-tool-button:focus-visible \{[^}]*\}/g,
						'',
					),
				] as const,
		);

		expect([...flattenedWithoutRing(scanned, buttonClasses(), buttonClassGroups()).offenders.keys()]).toContain(
			'.rp-editor-tool-button',
		);
	});

	/**
	 * ABSTAINING IS A SILENCE, so it is scoped as tightly as the rest. Four `border-` families paint no
	 * edge — a rounded corner, a replaced decoration, and two table-layout properties — and a focus
	 * rule that only rounds a corner must not buy silence for a button with no ring. Nor may a border
	 * set on HOVER, which is not a focus state, or one scoped somewhere the site is not.
	 */
	it.each([
		['border-radius alone', '.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { border-radius: 4px; }'],
		[
			'border-image alone',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { border-image: url(a.png) 30; }',
		],
		['a border set on hover', '.rp-dialog-button { box-shadow: none; } .rp-dialog-button:hover { border: 2px solid red; }'],
		[
			'a border focus rule scoped where the site is not',
			'.rp-dialog-button { box-shadow: none; } .dialog .rp-dialog-button:focus-visible { border: 2px solid red; }',
		],
	])('still reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
	});
});

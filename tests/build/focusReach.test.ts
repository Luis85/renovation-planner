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
	 *
	 * `:focus-within` IS THE EXCEPTION and has its own group below. Stating the rule for the whole
	 * category is what buried it: that pseudo matches an ancestor PRECISELY BECAUSE a descendant is
	 * focused, so the two spellings mean opposite things in the same position.
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
		// ANCESTRY IS THE COMBINATOR THAT FOLLOWS THE COMPOUND, not its position in the list. A
		// `:focus-within` on a SIBLING says the sibling contains the focus, which focusing this button
		// does not do; `.other:focus-within + .rp-dialog > .rp-dialog-button` puts it beside the parent
		// rather than above it, which is the same fact one hop further out.
		// EACH IS WRITTEN AGAINST A FLATTENING RULE OF THE SAME SHAPE, so the two ancestor strings differ
		// in nothing but the pseudo. Written against a differently scoped one they report either way —
		// `covers` refuses them for the scope rather than for the combinator — and the mutation that
		// treats every combinator as ancestry passed all fifty cases before they were sharpened.
		[
			'a sibling that must contain the focus itself',
			'.rp-dialog .other + .rp-dialog-button { box-shadow: none; } .rp-dialog .other:focus-within + .rp-dialog-button { outline: 2px solid red; }',
		],
		[
			'a focus-within on the parent’s sibling',
			'.other + .rp-dialog > .rp-dialog-button { box-shadow: none; } .other:focus-within + .rp-dialog > .rp-dialog-button { outline: 2px solid red; }',
		],
		// The NEGATION is the opposite condition, and the bare pseudo names an ancestor by nothing else
		// — there is no universal component to put in its place, so that compound is left as written and
		// the rule reports rather than answering. Over-reporting, which is the safe side here.
		[
			'an ancestor that must not contain the focus',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog:not(:focus-within) .rp-dialog-button { outline: 2px solid red; }',
		],
		[
			'an ancestor named by nothing but the pseudo',
			'.rp-dialog-button { box-shadow: none; } :focus-within .rp-dialog-button { outline: 2px solid red; }',
		],
		// AND THE STRIP DOES NOT WIDEN WHAT A RULE COVERS. Taking `:focus-within` off the ancestor
		// leaves `.rp-dialog`, which is still a scope the unscoped flattening rule is not in.
		[
			'a ring scoped to an ancestor the flattening rule is not',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog:focus-within .rp-dialog-button { outline: 2px solid red; }',
		],
		// The other direction: a rule written that way is focus-driven, so it is not filed at rest —
		// but it still takes the ring away, and an important one takes it away from a rule it loses to.
		[
			'an important reset on an ancestor that focusing the button satisfies',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog:focus-within .rp-dialog-button { outline: none !important; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toHaveLength(1);
	});

	/**
	 * `:focus-within` ON AN ANCESTOR IS SATISFIED BY FOCUSING THE SUBJECT — that is what the pseudo
	 * means — so a ring written `.toolbar:focus-within .button` is on screen for every button the
	 * sibling rule flattens. Read as an ordinary resting scope it was BOTH an at-rest rule and one
	 * whose ancestor string no site could match, so the gate FAILED THE BUILD on CSS that visibly
	 * rings. Two halves, and each is its own mutation: the branch must stop being filed at rest, and
	 * the pseudo must come off the ancestor string the site is compared against.
	 *
	 * The third case is the ancestry rule from the other side: a sibling combinator further down the
	 * chain does not stop an earlier compound being an ancestor, because `.dialog > .other + .button`
	 * leaves `.dialog` the parent of both.
	 */
	it.each([
		[
			'a ring on an ancestor that focusing the button satisfies',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog:focus-within .rp-dialog-button { outline: 2px solid red; }',
		],
		[
			'the same through a child combinator',
			'.rp-dialog > .rp-dialog-button { box-shadow: none; } .rp-dialog:focus-within > .rp-dialog-button { outline: 2px solid red; }',
		],
		[
			'a ring on a grandparent reached past a sibling',
			'.rp-dialog .other + .rp-dialog-button { box-shadow: none; } .rp-dialog:focus-within .other + .rp-dialog-button { outline: 2px solid red; }',
		],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
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
	 * A RULE A FOCUSED ELEMENT CANNOT MATCH IS NOT IN THE FOCUSED CASCADE AT ALL — a third state
	 * beside "focus rule" and "at rest", and this file had only the two.
	 * `.button:not(:focus-visible) { box-shadow: none }` takes the resting shadow away and STOPS
	 * MATCHING the moment the button is keyboard-focused, so the host's ring appears and there is
	 * nothing to report; `.button:disabled` is never focused in the FIRST place, a disabled control
	 * being out of the tab order. Read as ordinary at-rest rules both recorded a flattening site and
	 * failed the build on CSS that rings correctly.
	 *
	 * A negation excludes focus whenever ANY of its arguments is the focus pseudo alone, because
	 * `:not(A, B)` is `NOT (A OR B)`: an A that matches every focused element fails the whole negation
	 * for one, whatever B says. That is NOT the question `isFocusPseudo` answers — its
	 * one-argument-one-component bound exists for the caller that STRIPS — and reusing it here shipped
	 * a case asserting the mixed shape still flattens. Inverted, and now the third case below.
	 */
	it.each([
		['a reset that applies only while unfocused', '.rp-dialog-button:not(:focus-visible) { box-shadow: none; }'],
		['the same written against :focus', '.rp-dialog-button:not(:focus) { box-shadow: none; }'],
		['a negation mixing focus with a class', '.rp-dialog-button:not(:focus-visible, .other) { box-shadow: none; }'],
		['a reset that applies only while disabled', '.rp-dialog-button:disabled { box-shadow: none; }'],
		// THROUGH TWO NEGATIONS IT IS STILL POSITIVELY DISABLED, which is why the walk carries a parity
		// rather than testing for the spelling. And the second is the negation's own rule applied to this
		// arm: `:not(A, B)` is `NOT (A OR B)`, so an A that no focused element can fail makes the whole
		// negation impossible for one, whatever B says.
		[
			'a positive disabled condition through two negations',
			'.rp-dialog-button:not(:not(:disabled)) { box-shadow: none; }',
		],
		[
			'a nested disabled condition beside another argument',
			'.rp-dialog-button:not(:not(:disabled), .other) { box-shadow: none; }',
		],
		// A SUBJECT ALTERNATIVE INSIDE A NEGATION IS NOT EXPANDED BEFORE THIS WALK. `alternativesOf`
		// splits `:is()` at the TOP of a branch and never inside `:not()`, so these arrived whole and
		// fell off the end of a walk that knew only `:not()` — filed at rest, flattening, reported.
		// `:where()` differs from `:is()` in specificity alone, which is nothing to this question.
		[
			'a negation wrapping a focus alternative',
			'.rp-dialog-button:not(:is(:focus-visible, .other)) { box-shadow: none; }',
		],
		[
			'the same written with :where()',
			'.rp-dialog-button:not(:where(:focus-visible, .other)) { box-shadow: none; }',
		],
		[
			'a negation wrapping an alternative that is vacuous when focused',
			'.rp-dialog-button:not(:is(:not(:disabled), .other)) { box-shadow: none; }',
		],
		// AND IT MUST BE ABSENT, not merely barred from recording a site. Filed as an ordinary at-rest
		// rule it still RANKS, and each of these outranks the ring it must not touch: neither selector
		// matches a focused button, so the red outline is on screen and there is nothing to report.
		// Suppressing only the site leaves these two red while every other case passes — and there are
		// two because the two exclusions are separate arms, either of which could be written that way.
		[
			'a more specific reset that applies only while unfocused',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:not(:focus-visible) { outline: none; }',
		],
		[
			'a more specific reset that applies only while disabled',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:disabled { outline: none; }',
		],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});

	/**
	 * The exclusion is narrow in seven directions, and each is a case. A DOUBLE negative is positive
	 * focus, so it flattens like any focus rule. A `:not()` naming something other than focus excludes
	 * nothing about focus. A `:not()` whose argument is a COMPOUND excludes nothing either —
	 * `:not(:focus-visible.other)` still matches a focused button that is not an `.other` one, which is
	 * why the shape test asks for a lone pseudo rather than for a focus pseudo somewhere inside. And
	 * `:enabled` is NOT the mirror of `:disabled`: a focused form control satisfies it, so it excludes
	 * nothing about focus either — the elements it is false for are the ones that are not form
	 * controls at all. Three more come from the disabled parity, and the comment beside them says what
	 * each holds.
	 *
	 * The last is the other direction of the same rule: an excluded rule cannot ANSWER a site either.
	 * A ring that shows only while UNFOCUSED is no focus indicator, so the site it cannot flatten is
	 * also a site it cannot clear. That one passes whether the rule is skipped outright or merely
	 * barred from recording a site — an excluded rule is filed `atRest`, and an at-rest rule already
	 * cannot answer — which is why the SILENT group below carries the case that separates them.
	 */
	it.each([
		['a doubly negated focus reset', '.rp-dialog-button:not(:not(:focus-visible)) { box-shadow: none; }'],
		['a negation that names no focus state', '.rp-dialog-button:not(.other) { box-shadow: none; }'],
		[
			'a negation whose argument is a compound',
			'.rp-dialog-button:not(:focus-visible.other) { box-shadow: none; }',
		],
		['a reset that applies only while enabled', '.rp-dialog-button:enabled { box-shadow: none; }'],
		// THE PARITY RUNS BOTH WAYS, and these are the shapes that must survive it. `:not(:disabled)` is
		// VACUOUS on a focused element rather than impossible — every focusable control satisfies it — and
		// a third negation puts the selector back there. Reached UNDER a negation the shape is
		// `(A OR B …)`, which implies nothing unless there is exactly one alternative:
		// `:not(:not(:disabled, .other))` is `:disabled OR .other`, and a focused `.other` button matches
		// it. Written with the positive side's `some` on both sides, that last one is silently excluded.
		['a vacuous not-disabled condition', '.rp-dialog-button:not(:disabled) { box-shadow: none; }'],
		[
			'a disabled condition through three negations',
			'.rp-dialog-button:not(:not(:not(:disabled))) { box-shadow: none; }',
		],
		[
			'a disjunction one focusable arm satisfies',
			'.rp-dialog-button:not(:not(:disabled, .other)) { box-shadow: none; }',
		],
		// AND THE QUANTIFIERS ARE THE NARROWNESS OF THE ALTERNATIVE ARM. A negation is impossible for a
		// focused element when SOME alternative necessarily holds, and an alternative holds only when
		// EVERY component of it does — a compound is a conjunction. So a negation over things that
		// merely CAN be true excludes nothing, and one whose alternative pairs focus with a class
		// excludes nothing either: `:focus-visible.danger` is not true of every focused button.
		[
			'a negation wrapping alternatives that name no focus state',
			'.rp-dialog-button:not(:is(.a, .other)) { box-shadow: none; }',
		],
		[
			'a negation wrapping a disabled alternative',
			'.rp-dialog-button:not(:is(:disabled, .other)) { box-shadow: none; }',
		],
		[
			'a negation wrapping a compound alternative',
			'.rp-dialog-button:not(:is(:focus-visible.danger)) { box-shadow: none; }',
		],
		[
			'a ring that shows only while unfocused',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:focus-visible) { outline: 2px solid red; }',
		],
	])('still reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
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

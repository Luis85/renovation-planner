import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Selector } from 'lightningcss';
import { alternativesOf, moreSpecific, show, specificityOf, stylesheetRules } from '../helpers/selectors';
import { declarationsOf, drawsAnIndicator, indicatorOf } from '../helpers/indicators';
import { buttonClasses, buttonClassesOn, sheets, subjectOf, targetsAButton } from '../helpers/buttonRules';

/**
 * FLATTENING A BUTTON TAKES ITS FOCUS RING WITH IT, and this file is the check for that.
 *
 * Split from `buttonSpecificity.test.ts`, which asks the sibling question — does a rule outrank
 * Obsidian's own `button:not(.clickable-icon)` — and grew past its line budget carrying both. The
 * two share what a BUTTON is (`tests/helpers/buttonRules.ts`) and nothing else, which is the seam:
 * one is about RANK, this one about what a rule leaves on screen once it has won.
 */

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

/**
 * What a branch is filed under, and WHERE it applies — two answers, because they are two questions
 * and collapsing them broke one of the other.
 *
 * The KEY identifies the button: its classes, or its subject shape when it wears none of ours.
 * Rules sharing a key compete in the cascade, which is what lets a `:focus-visible` reset revoke an
 * earlier ring.
 *
 * The CONDITIONS are what the rule is scoped to — everything above the subject, and the subject's
 * own components beside the focus pseudo. They are NOT part of the key, and the reason is that the
 * two directions want opposite things. A narrowly scoped RESET must
 * be able to outrank a broad ring, so those must share a key. A narrowly scoped RING must NOT
 * clear a broad flattening rule, because the same button outside that scope still has no
 * indicator: `.button { box-shadow: none }` with `.dialog-a .button:focus-visible { outline: … }`
 * leaves every `.button` elsewhere bare. Folding context into the key satisfies the second and
 * destroys the first; leaving it out satisfies the first and destroys the second. So it travels
 * beside the key and is asked only at the moment a ring would clear a flatten.
 */
interface Conditions {
	/** Everything above the subject, rendered losslessly — combinators included. */
	readonly ancestors: string;
	/** The subject's own components, each rendered on its own, minus the focus pseudo. */
	readonly subject: readonly string[];
}

interface FocusSite {
	readonly key: string;
	readonly conditions: Conditions;
}

const focusSites = (branch: Selector, classes: Set<string>, revokes: boolean): FocusSite[] => {
	// Only the SUBJECT's `:focus-visible` is stripped from the shape. An ancestor's is part of what
	// the rule is scoped to.
	const subject = subjectOf(branch).filter(
		(component) => !(component.type === 'pseudo-class' && component.kind === 'focus-visible'),
	);
	// EVERY condition the rule imposes, not just the ancestor chain. A subject can carry its own
	// conditions beside the focus pseudo: `.rp-dialog-button:hover:focus-visible` draws only while
	// the button is BOTH hovered and focused, so it cannot answer for an unconditional flattening
	// rule — and a context of ancestors alone dropped the `:hover` and let it.
	// The ancestor chain is rendered WHOLE rather than compound by compound, because the
	// relationships between the compounds are part of it. `.dialog .button` and `.dialog > .button`
	// hold the same compounds and match different elements — every nested `.button` is flattened by
	// the first and unreachable by the second — and a list of compounds is identical for both.
	const conditions: Conditions = {
		ancestors: show(branch.slice(0, branch.length - subjectOf(branch).length)),
		subject: subject.map((component) => show([component])),
	};
	const onSubject = buttonClassesOn(branch, classes);

	if (onSubject.length > 0) return onSubject.map((key) => ({ key, conditions }));
	if (!targetsAButton(branch, classes)) return [];

	// A TYPE-TARGETED FOCUS RULE THAT DRAWS NOTHING COMPETES IN EVERY CLASS'S CASCADE, because it
	// matches buttons wearing those classes too. Filed under its shape alone, a reset like
	// `.rp-dialog.rp-dialog button:focus-visible { outline: none }` never met the ring it outranks —
	// `.rp-dialog .rp-dialog-button:focus-visible` — and the two sat in separate cascades while the
	// browser applied both to one element and picked the reset.
	//
	// ONLY WHEN IT REVOKES, and that condition was measured rather than reasoned. Letting every
	// type-targeted focus rule join turned `.rp-editor-toolbar button:focus-visible { outline: … }`
	// into a false positive against an unrelated `.rp-dialog-button`: it is the more specific of the
	// two, so it WON that cascade, and then failed `covers` because its ancestors are not the class
	// rule's — converting a correct arrangement into a report.
	//
	// A rule that draws can only ever ADD a ring, and adding is already handled: `covers` refuses to
	// let `button:focus-visible` clear `.rp-dialog-button`, since `button` is not among that rule's
	// conditions. A rule that draws NOTHING is the only one that can take a ring away, which is the
	// case worth widening for.
	//
	// Flattening rules never join, for the same reason in reverse: filed under every class, a
	// type-targeted suppression would demand that each class's ring answer for a rule that may not
	// reach it.
	const shape = { key: show(subject), conditions };

	return revokes ? [shape, ...[...classes].map((key) => ({ key, conditions }))] : [shape];
};

/**
 * Does a ring drawn under these conditions cover a button flattened under those?
 *
 * Two questions, because a rule's scope has two parts and they behave differently.
 *
 * ABOVE the subject, the ring must be scoped no more narrowly: either nowhere at all — in which
 * case it applies everywhere the flattening rule does — or under exactly the same chain, rendered
 * losslessly with its combinators. Anything else is refused. `.dialog[data-kind='a']` and
 * `.dialog[data-kind='b']` are disjoint; `.dialog .button` and `.dialog > .button` are not the
 * same set either.
 *
 * ON the subject, every condition the ring imposes must also be imposed by the flattening rule.
 * `.button:hover:focus-visible` draws only while hovered, so it cannot answer for an
 * unconditional `.button`.
 *
 * Proving that one selector matches every element another does is not something this can do in
 * general; these are the cases it can prove, and it refuses the rest. Refusing over-reports, which
 * is the safe direction for a gate about a MISSING focus indicator.
 */
const covers = (ring: Conditions, flattened: Conditions): boolean =>
	(ring.ancestors === '' || ring.ancestors === flattened.ancestors) &&
	ring.subject.every((condition) => flattened.subject.includes(condition));

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
	// A LIST per key, not one site. The same class is flattened in as many places as the sheets
	// flatten it, and `set` kept only the last: `.dialog-a .button { box-shadow: none }` followed by
	// `.dialog-b .button { box-shadow: none }` left one entry, and a ring scoped to `.dialog-b`
	// cleared it while every button in `.dialog-a` stayed bare. A key is answered only when EVERY
	// site under it is covered.
	const flattened = new Map<string, { readonly where: string; readonly conditions: Conditions }[]>();

	// NOT a set of "has been ringed once". A `:focus-visible` rule can also take a ring AWAY, and
	// a later or more specific one wins: `.rp-dialog-button:focus-visible { outline: 2px solid red }`
	// followed by `.rp-dialog .rp-dialog-button:focus-visible { outline: none }` leaves nothing on
	// screen. A set recorded the first and had no way to hear the second, so the flattened button
	// was cleared from the offender map by a ring the cascade had already removed.
	//
	// So the winner is kept per key, decided the way the cascade decides: more specific wins, and
	// equal specificity goes to whichever comes later. THE CEILING, since this is a mini-cascade
	// and not a browser: two rules sharing a key need not match the same elements —
	// `.rp-dialog .rp-dialog-button` is a SUBSET of `.rp-dialog-button` — so a narrowly scoped
	// reset is treated as beating a broad ring for every element, which over-reports. That is the
	// safe direction for a gate about a missing focus indicator. `!important` between rules is not
	// modelled at all.
	//
	// The winner carries its CONTEXT, which is asked at clearing time rather than here — see
	// `focusSites` for why the two cannot be one key.
	const ringed = new Map<
		string,
		{
			readonly specificity: readonly [number, number, number];
			readonly draws: boolean;
			readonly conditions: Conditions;
		}
	>();

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

				for (const { key, conditions } of focusSites(branch, classes, ringsFocus && !draws)) {
					if (ringsFocus) {
						// Of the ORIGINAL selector, never of the expanded branch — `alternativesOf`'s own header
						// says so and this call site said otherwise. `:where()` contributes ZERO, argument
						// included, so `:where(#scope) .button:focus-visible` expands to something scoring an ID
						// it does not have: ranked (1,1,0) it beat a `.dialog .button:focus-visible` reset that
						// actually outranks it, and the flattened button was credited a ring the cascade never
						// draws. Expansion answers WHICH elements a rule reaches; ranking is a separate question.
						const specificity = specificityOf(selector);
						const standing = ringed.get(key);

						if (standing === undefined || !moreSpecific(standing.specificity, specificity)) {
							ringed.set(key, { specificity, draws, conditions });
						}
					}
					// The base rule only — a `:hover` or `:disabled` variant suppressing the shadow says
					// nothing about the resting state a ring is drawn on.
					else if (!ringsFocus && flattens) {
							flattened.set(key, [
								...(flattened.get(key) ?? []),
								{ where: `${where}: ${show(selector)}`, conditions },
							]);
						}
				}
			}
		}
	}

	const seen = flattened.size;

	for (const [key, winner] of ringed) {
		const sites = flattened.get(key);

		if (!winner.draws || sites === undefined) continue;

		const uncovered = sites.filter((site) => !covers(winner.conditions, site.conditions));

		if (uncovered.length === 0) flattened.delete(key);
		else flattened.set(key, uncovered);
	}

	// `seen` is every class this scan found flattened, ringed or not. The real-sheet case asserts it
	// is non-zero: an empty offender list is equally true of a scan that found no buttons at all —
	// the same trap `accessibility.test.ts` names for an `it.each` over an empty array — and this
	// check has already been silently out of scope twice for exactly that reason.
	return { offenders: flattened, seen };
};


describe('a flattened button and its focus ring', () => {
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

		expect(offenders.values().toArray().flat().map((site) => site.where)).toEqual([]);
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
		// A `:focus-visible` rule can take a ring AWAY, and the cascade decides which one stands.
		// Recorded as a set of "was ringed once", the first of these was heard and the second was
		// not, so a button with no indicator at all was cleared from the offender map.
		[
			'a ring a more specific rule removes',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog .rp-dialog-button:focus-visible { outline: none; }',
		],
		[
			'a ring a later rule of equal specificity removes',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button:focus-visible { outline: none; }',
		],
		[
			'a ring only a less specific rule draws',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// A RING SCOPED NARROWER THAN THE FLATTENING RULE COVERS ONLY PART OF IT. `.rp-dialog-button`
		// outside `.rp-dialog` is flattened and has no indicator, whatever happens inside. Keyed by
		// class alone, the scoped ring cleared every one of them.
		[
			'a ring scoped to one container, flattened everywhere',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The same shape once the cascade has been resolved: the winning rule draws, and draws only
		// inside `.rp-dialog`. Both findings at once, which is why this one is worth spelling out.
		[
			'a ring a more specific rule puts back in one container only',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// Two DISJOINT containers. Both contexts rendered `.dialog ` while the serializer dropped
		// what it did not model, so a ring drawn in one cleared a flattening rule in the other.
		[
			'a ring in a container the flattening rule does not cover',
			".dialog[data-kind='a'] .rp-dialog-button { box-shadow: none; } .dialog[data-kind='b'] .rp-dialog-button:focus-visible { outline: 2px solid red; }",
		],
		// A condition on the SUBJECT is a condition like any other: focus alone draws nothing here.
		[
			'a ring that also requires hover',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:hover:focus-visible { outline: 2px solid red; }',
		],
		// The SAME compounds, a different relationship. Every nested `.rp-dialog-button` is flattened
		// by the descendant rule and unreachable by the child ring; a list of compounds is identical
		// for both, which is why the ancestor chain is compared as one lossless string.
		[
			'a child-scoped ring over a descendant-scoped flattening rule',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog > .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// TWO containers flattened, one of them ringed. Keyed to a single site, the second flattening
		// rule replaced the first and the scoped ring cleared what was left — while every button in
		// `.dialog-a` stayed bare.
		[
			'one of two flattened containers left unringed',
			'.dialog-a .rp-dialog-button { box-shadow: none; } .dialog-b .rp-dialog-button { box-shadow: none; } .dialog-b .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The reset selects the same button by its ELEMENT TYPE and outranks the ring that selects it
		// by class. Filed under separate keys the two never met, and the browser applies both.
		[
			'a type-targeted reset outranking a class-targeted ring',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog.rp-dialog button:focus-visible { outline: none; }',
		],
		// `:where()` contributes ZERO specificity, argument included, so this ring ties the reset that
		// follows it and the LATER one wins. Scored from the expanded branch it looked ID-specific,
		// outranked the reset, and stood — the one thing `alternativesOf`'s header says a caller must
		// not do, done at a call site written two rounds after that header.
		//
		// Both rules are scoped identically on purpose: the covering test would otherwise report this
		// whatever the ranking said, and the case would prove nothing about specificity.
		[
			'a where-wrapped ring the later reset ties and beats',
			'.rp-dialog-button { box-shadow: none; } :where(#scope).rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button:focus-visible { outline: none; }',
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
		// A component nobody sets takes its CSS INITIAL value, and `outline-style`'s is `none`. So a
		// block that sets only the colour, or only the width, paints nothing at all — the style
		// nobody wrote is still refusing.
		'outline-color: red',
		'outline-width: 2px',
		'outline-color: red; outline-width: 2px',
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
		// The other two initials go the opposite way: `medium` and `currentColor` both paint, so a
		// style on its own really does draw. Without these the initial-value fix could have been
		// "treat every absent component as blank", which refuses a legitimate ring.
		['outline-style: solid', true],
		['outline-style: solid; outline-color: red', true],
		['outline: 2px solid red; outline-style: none; outline-style: solid', true],
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
		// And the other way down that cascade, or "the reset wins" has replaced "the set wins". At
		// EQUAL scope only — the more-specific version of this puts the ring back inside `.rp-dialog`
		// and nowhere else, which is a reporting case below rather than a silent one.
		[
			'a reset a later rule of equal specificity puts back',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
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
		// The covering test must not become "a scoped ring never counts": a ring in the SAME scope as
		// the flattening rule covers all of it, which is how every real rule in this project is
		// written.
		[
			'a ring in the same scope as the flattening rule',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		[
			'an unscoped ring over a scoped flattening rule',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The same attribute on both sides is the same container, and must stay silent — or the
		// lossless comparison has become "any attribute anywhere means no coverage".
		[
			'a ring in the same attributed container',
			".dialog[data-kind='a'] .rp-dialog-button { box-shadow: none; } .dialog[data-kind='a'] .rp-dialog-button:focus-visible { outline: 2px solid red; }",
		],
		// Both containers flattened and both ringed by ONE unscoped rule — which covers every site,
		// or the per-site rule has become "more than one flattening rule can never be answered".
		[
			'two flattened containers under one unscoped ring',
			'.dialog-a .rp-dialog-button { box-shadow: none; } .dialog-b .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The same relationship on both sides is the same set, and must stay silent.
		[
			'a child-scoped ring over a child-scoped flattening rule',
			'.rp-dialog > .rp-dialog-button { box-shadow: none; } .rp-dialog > .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The same shape with the type rule LESS specific than the class ring: the ring stands, and
		// the type rule joining the cascade must not change that. Without this, "compete everywhere"
		// could have become "a type-targeted reset always wins".
		[
			'a type-targeted reset the class-targeted ring outranks',
			'.rp-dialog .rp-dialog-button { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; } button:focus-visible { outline: none; }',
		],
		// And a type-targeted FLATTENING rule must not be filed under every class — that would demand
		// each class's ring answer for a rule that may not reach it.
		[
			'a type-targeted flattening rule beside a ringed class',
			'.rp-editor-toolbar button { box-shadow: none; } .rp-editor-toolbar button:focus-visible { outline: 2px solid red; } .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The flattening question is asked of the RESOLVED block too, not of each declaration: the
		// `none` here is overridden on the next line, so nothing is flattened and there is nothing
		// to demand a ring for.
		['a suppression its own block overrides', '.rp-dialog-button { box-shadow: none; box-shadow: 0 0 0 3px red; }'],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], new Set(['.rp-dialog-button'])).offenders.keys()]).toEqual([]);
	});
});

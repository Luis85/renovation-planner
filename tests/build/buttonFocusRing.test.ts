import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Selector } from 'lightningcss';
import { alternativesOf, moreSpecific, propertyOf, show, specificityOf, stylesheetRules } from '../helpers/selectors';
import { declarationsOf, drawsAnIndicator, indicatorOf } from '../helpers/indicators';
import { buttonClassGroups, buttonClasses, buttonClassesOn, sheets, subjectOf, targetsAButton } from '../helpers/buttonRules';

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
	/** The `@media`/`@supports`/`@container` query the rule sits inside, or `''` for none. */
	readonly condition: string;
	/** Everything above the subject, rendered losslessly — combinators included. */
	readonly ancestors: string;
	/** The subject's own components, each rendered on its own, minus the focus pseudo. */
	readonly subject: readonly string[];
}

interface FocusSite {
	readonly key: string;
	readonly conditions: Conditions;
}

const focusSites = (branch: Selector, classes: Set<string>, condition: string): FocusSite[] => {
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
		condition,
		ancestors: show(branch.slice(0, branch.length - subjectOf(branch).length)),
		// A `button` TYPE is dropped, and it is the ONE type that may be: every site this scan keeps
		// stands for a button already — a subject reaches `focusSites` by wearing a known button class
		// or by naming that exact type — so `button` narrows nothing a site does not already impose.
		// Kept, it read as a condition the site failed to meet, and `button:focus-visible { outline: … }`
		// could not answer a `.rp-dialog-button` flattened elsewhere. Any OTHER type is a real
		// narrowing — `a.rp-dialog-button` is the anchors wearing that class and not the buttons — so
		// this names the one it drops rather than dropping the category.
		subject: subject
			.filter((component) => !(component.type === 'type' && component.name === 'button'))
			.map((component) => show([component])),
	};
	const onSubject = buttonClassesOn(branch, classes);

	if (onSubject.length > 0) return onSubject.map((key) => ({ key, conditions }));
	if (!targetsAButton(branch, classes)) return [];

	return [{ key: show(subject), conditions }];
};

/** One `:focus-visible` declaration, as the per-site cascade needs it. */
interface FocusRule {
	readonly property: 'outline' | 'shadow';
	readonly draws: boolean;
	readonly important: boolean;
	readonly specificity: readonly [number, number, number];
	readonly conditions: Conditions;
	/** Source order within the scan, for the tie-break the cascade ends on. */
	readonly order: number;
}

/** Does `a` win over `b` — importance first, then specificity, then whichever came later? */
const beats = (a: FocusRule, b: FocusRule): boolean =>
	a.important !== b.important
		? a.important
		: moreSpecific(a.specificity, b.specificity) ||
			(!moreSpecific(b.specificity, a.specificity) && a.order > b.order);


/**
 * The cascade keys a focus rule competes in, beyond the one it is filed under.
 *
 * TWO overlaps, and the difference between them is the whole reason this is not "every key".
 *
 * A bare `button` subject really does match every button, so a revoking type-targeted rule joins
 * every class. `.rp-dialog-button-danger` does NOT match every `.rp-dialog-button`, so a revoking
 * class-targeted rule joins only the classes some ONE BUTTON wears alongside it — which
 * `buttonClassGroups` knows because it scans the markup a tag at a time. Joining every class there
 * would let a danger reset beat an unrelated ring on specificity and report a button that is fine,
 * which is round 23's over-correction in its class-versus-class form.
 *
 * FLATTENING SITES ARE NEVER WIDENED. A site belongs to the classes its subject actually wears;
 * filed under a co-occurring class as well, an ordinary suppression would demand an answer from a
 * cascade it has nothing to do with.
 *
 * A DRAWING RULE IS WIDENED TOO, and this used to say the opposite: "a rule that draws can only
 * ever ADD a ring, so it is the only one that need not be heard in a cascade it was not filed
 * under." True premise, wrong conclusion — adding a ring is exactly what a flattening site is
 * waiting for. `button:focus-visible { outline: 2px solid red }` rings a `.rp-dialog-button` as
 * surely as a type-targeted reset revokes one, and filed under `button` alone it could not answer
 * a site filed under the class. The gate REJECTED that valid pair, a false positive where every
 * other approximation in this file is deliberately the other way.
 *
 * What keeps the CLASS-GROUP half of that honest for a ring is `covers`, not this key set, and the
 * distinction is worth stating because the obvious fix is to withhold the group overlap here.
 * Withholding it changes nothing: `.rp-dialog-button-danger:focus-visible` reaching the
 * `.rp-dialog-button` cascade still fails `covers`, whose subject test asks that every condition
 * the ring imposes be imposed by the site too — and the danger class is such a condition. So the
 * key set answers WHICH cascades a rule is heard in and `covers` answers whether it may clear a
 * site, which is the same division of labour `focusSites` describes for the key and its conditions.
 * A `draws` parameter here was written first and removed: no case could tell it from its absence,
 * and an unexercised branch with a confident comment on it is the shape this repository keeps
 * finding defects in.
 */
const cascadeKeys = (
	key: string,
	classes: Set<string>,
	groups: readonly ReadonlySet<string>[],
	targetsType: boolean,
): string[] =>
	targetsType
		? [key, ...classes]
		: [...new Set([key, ...groups.filter((group) => group.has(key)).flatMap((group) => [...group])])];

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
	// The at-rule the ring sits inside is a condition like the rest, and behaves like the ancestor
	// chain: none at all covers everything, the same one covers itself, anything else is refused. A
	// ring inside `@media (prefers-color-scheme: dark)` leaves the button bare in light mode, and
	// flattening it unconditionally is exactly what a check reading a flat list of rules cannot see.
	(ring.condition === '' || ring.condition === flattened.condition) &&
	(ring.ancestors === '' || ring.ancestors === flattened.ancestors) &&
	ring.subject.every((one) => flattened.subject.includes(one));

/**
 * Does anything leave a visible indicator on THIS flattening site?
 *
 * Resolved per site rather than once per key, because a key stands for many elements and a cascade
 * winner is a property of one. Two disjoint containers can each flatten the same class and each
 * ring it; a single winner per key let the later ring replace the earlier and report a site that is
 * fully answered.
 *
 * Two conditions, and the second is what keeps the previous rounds' fixes intact:
 *
 * - something must DRAW and COVER the site — apply everywhere the flattening rule does;
 * - and nothing that draws NOTHING may beat it. A narrower reset does not cover the site, but it
 *   still reaches some of the elements the site stands for, so it disqualifies the ring rather
 *   than being filtered out of the site's cascade.
 *
 * That second clause over-reports where the two scopes are disjoint rather than nested — a reset in
 * `.dialog-b` disqualifies a ring in `.dialog-a`, which it never touches. `covers` can prove an
 * identical scope or none at all and nothing between, so it cannot tell disjoint from narrower, and
 * over-reporting is the safe side of that.
 */
const answers = (rules: readonly FocusRule[], site: { readonly conditions: Conditions }): boolean =>
	rules.some(
		(drawing) =>
			drawing.draws &&
			covers(drawing.conditions, site.conditions) &&
			!rules.some((reset) => !reset.draws && reset.property === drawing.property && beats(reset, drawing)),
	);

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
	groups: readonly ReadonlySet<string>[] = [],
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
	// PER PROPERTY, not per rule. CSS resolves `outline` and `box-shadow` independently, so a
	// specific rule setting only `box-shadow: none` does not take away a broad rule's outline — and
	// one winner per key replaced the whole standing with that rule's "draws nothing", reporting a
	// button whose ring is on screen. A rule competes only for the properties it DECLARES, which is
	// what `indicatorOf` returning `undefined` for an unmentioned property already told us.
	// EVERY focus rule, not one winner per property. A winner is a property of an ELEMENT, and a key
	// stands for many: `.dialog-a .button` and `.dialog-b .button` can each be flattened and each
	// have their own equally scoped ring, and keeping one winner let the later ring replace the
	// earlier one and report a site that is fully answered. The cascade is resolved per SITE below.
	//
	// This is the same shape as `flattened` holding one site per key — one value for something that
	// legitimately occurs many times — in the structure standing right beside it.
	const ringed = new Map<string, FocusRule[]>();
	// Source order across every sheet, which is the cascade's last tie-break.
	let order = 0;

	// Both sets span every sheet, because the two halves need not share one. A class flattened in
	// `editor.css` and ringed in `dialogs.css` is ringed; scanning a sheet at a time would report it.
	for (const [where, css] of scanned)
		for (const rule of stylesheetRules(css)) {
		// Both read from ONE resolution of the block, in cascade order. Asked declaration by
		// declaration, `box-shadow: none; box-shadow: 0 0 0 3px red` counted as flattening on the
		// strength of a declaration the next line overrides.
		const { outline, shadow } = indicatorOf(rule.declarations);
		// An outline is set by four properties, and this resolves ONE importance for all of them — a
		// per-component cascade is a bigger instrument than the rest of this file is built to be. So
		// the approximation has to fall on the safe side, and the first version fell on the wrong one:
		// it took ANY important component as making the whole outline important, and its comment
		// claimed that "errs toward letting a rule win its cascade, which is the direction that
		// reports". That is backwards. A rule that WINS is a ring that STANDS, which is the direction
		// that stays silent.
		//
		// So `outline: 2px solid red; outline-color: red !important` was treated as wholly important,
		// and a later more specific normal `outline-style: none` — which beats the normal shorthand
		// style in the browser and makes the outline invisible — could not replace it.
		//
		// EVERY declared component must be important now. A block that mixes them is treated as normal,
		// so a later rule can beat it and the site is reported. Over-reporting is the safe side here,
		// and this time the sentence matches the code.
		const declaredOutline = ['outline', 'outline-width', 'outline-style', 'outline-color'].filter((one) =>
			rule.declarations.some((declaration) => propertyOf(declaration) === one),
		);
		const importantOutline =
			declaredOutline.length > 0 && declaredOutline.every((one) => rule.important.has(one));
		const importantShadow = rule.important.has('box-shadow');
		const flattens = shadow === false;

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

				for (const { key, conditions } of focusSites(branch, classes, rule.condition)) {
					// A focus rule is heard in every cascade it can REACH, not only the one it is filed
					// under. `cascadeKeys` says which, and why the two overlaps differ — and why a rule
					// that DRAWS gets only the type one.
					const reaches = ringsFocus
						? cascadeKeys(key, classes, groups, buttonClassesOn(branch, classes).length === 0)
						: [key];

					if (ringsFocus) {
						// Of the ORIGINAL selector, never of the expanded branch — `alternativesOf`'s own header
						// says so and this call site said otherwise. `:where()` contributes ZERO, argument
						// included, so `:where(#scope) .button:focus-visible` expands to something scoring an ID
						// it does not have: ranked (1,1,0) it beat a `.dialog .button:focus-visible` reset that
						// actually outranks it, and the flattened button was credited a ring the cascade never
						// draws. Expansion answers WHICH elements a rule reaches; ranking is a separate question.
						const specificity = specificityOf(selector);

						for (const reached of reaches) {
							for (const [property, declared, important] of [
								['outline', outline, importantOutline],
								['shadow', shadow, importantShadow],
							] as const) {
								if (declared === undefined) continue;

								// APPENDED, never compared here. Which rule wins is a question about one element,
								// and this key stands for many — so it is asked per flattening site, by `answers`.
								ringed.set(reached, [
									...(ringed.get(reached) ?? []),
									{ property, draws: declared, important, specificity, conditions, order: order++ },
								]);
							}
						}
					}
					// SUPPRESSING THE SHADOW IS A FLATTENING SITE WHEREVER IT HAPPENS, focus state included.
					// Obsidian's ring for a button IS a `box-shadow` on `:focus-visible`, so
					// `.rp-dialog-button:focus-visible { box-shadow: none }` removes exactly the indicator this
					// check exists to protect — and routing every focus rule into the cascade instead meant it
					// recorded no site at all, leaving nothing to report. Not an `else`: a focus rule can both
					// take the host's shadow away and be the winner that answers for it, and one that draws an
					// outline in the same block covers its own site.
					//
					// A `:hover` or `:disabled` variant still records a site, and the base focus ring answers it:
					// its conditions are a subset of the variant's, which is what `covers` is for.
					if (flattens) {
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

	for (const [key, rules] of ringed) {
		const sites = flattened.get(key);

		if (sites === undefined) continue;

		const uncovered = sites.filter((site) => !answers(rules, site));

		if (uncovered.length === 0) flattened.delete(key);
		else flattened.set(key, uncovered);
	}

	// `seen` is every class this scan found flattened, ringed or not. The real-sheet case asserts it
	// is non-zero: an empty offender list is equally true of a scan that found no buttons at all —
	// the same trap `accessibility.test.ts` names for an `it.each` over an empty array — and this
	// check has already been silently out of scope twice for exactly that reason.
	return { offenders: flattened, seen };
};


/**
 * A fixture button set and its co-occurrence, so a case can say WHICH classes one element wears.
 * The real project's shape: `.rp-dialog-button` and `.rp-dialog-button-danger` land on the same
 * button, `.rp-editor-tool-button` on a different one.
 */
const BUTTONS = new Set(['.rp-dialog-button', '.rp-dialog-button-danger', '.rp-editor-tool-button']);
const GROUPS: ReadonlySet<string>[] = [
	new Set(['.rp-dialog-button', '.rp-dialog-button-danger']),
	new Set(['.rp-editor-tool-button']),
];

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
			buttonClassGroups(),
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
		// An IMPORTANT reset beats every normal declaration in every other rule, wherever it was
		// written. Ranked on specificity alone, the more specific normal ring won and the button was
		// credited an indicator the browser never draws.
		// Both rules are scoped identically on purpose — the doubled class raises specificity without
		// adding an ancestor — so `covers` cannot decide this and importance is the only thing that
		// can. Written the obvious way, with the ring under `.rp-dialog`, it reported under the
		// specificity-only reading too, for the unrelated reason that its scope does not cover.
		// A block that MIXES importance across the outline's components is not wholly important: the
		// normal shorthand style can still be beaten by a later normal rule, and then nothing draws.
		[
			'a mixed-importance outline a later normal reset beats',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; outline-color: red !important; } .rp-dialog-button.rp-dialog-button:focus-visible { outline-style: none; }',
		],
		[
			'an important reset a more specific normal ring cannot beat',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: none !important; } .rp-dialog-button.rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// The condition on a NESTED at-rule is the conjunction of both. Recording only the innermost
		// made this ring look like it needed the media query alone, and a suppression in a separate
		// identical `@media` block then read as answered even where the `@supports` is false.
		[
			'a ring inside two nested at-rules',
			'@media (prefers-color-scheme: dark) { .rp-dialog-button { box-shadow: none; } } @supports (display: grid) { @media (prefers-color-scheme: dark) { .rp-dialog-button:focus-visible { outline: 2px solid red; } } }',
		],
		// Obsidian's ring for a button IS a `box-shadow` on `:focus-visible`, so suppressing it in the
		// FOCUS state removes exactly the indicator this check protects. With no base rule to record
		// a site, routing every focus rule into the cascade left nothing to report at all.
		['a focus-state shadow reset with no replacement', '.rp-dialog-button:focus-visible { box-shadow: none; }'],
		// ONE BUTTON, TWO CLASSES. `ConfirmDialog.vue` puts both on the same element, so the danger
		// reset takes away the ring the base class draws — and filed under separate keys the two
		// never met.
		[
			'a reset on a class the same button also wears',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button-danger:focus-visible { outline: none; }',
		],
		[
			'a focus-state shadow reset whose replacement is scoped narrower',
			'.rp-dialog-button:focus-visible { box-shadow: none; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; }',
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
		// Two DISJOINT containers, each flattened and each ringed at its own scope. One winner per key
		// let the later ring replace the earlier, and the earlier site — fully answered — was
		// reported. A cascade winner is a property of an ELEMENT; a key stands for many.
		[
			'a reset in one of two independently ringed containers',
			'.dialog-a .rp-dialog-button { box-shadow: none; } .dialog-a .rp-dialog-button:focus-visible { outline: 2px solid red; } .dialog-b .rp-dialog-button { box-shadow: none; } .dialog-b .rp-dialog-button:focus-visible { outline: none; }',
		],
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
		// The ring only exists in one colour scheme; the suppression exists in both. A flat list of
		// rules cannot see the difference — the at-rule and the rules inside it are visited
		// separately and nothing links them, so the ring arrived looking unconditional.
		[
			'a ring that only exists in dark mode',
			'.rp-dialog-button { box-shadow: none; } @media (prefers-color-scheme: dark) { .rp-dialog-button:focus-visible { outline: 2px solid red; } }',
		],
		[
			'a ring that only exists in a narrow container',
			'.rp-dialog-button { box-shadow: none; } @container (max-width: 700px) { .rp-dialog-button:focus-visible { outline: 2px solid red; } }',
		],
		[
			'a ring conditioned differently from the rule that flattened',
			'@media (prefers-color-scheme: light) { .rp-dialog-button { box-shadow: none; } } @media (prefers-color-scheme: dark) { .rp-dialog-button:focus-visible { outline: 2px solid red; } }',
		],
		// And the property split must not become "a reset can never win": a specific rule resetting
		// the SAME property the broad one drew still takes the ring away.
		[
			'a specific rule resetting the same property',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog.rp-dialog .rp-dialog-button:focus-visible { outline: none; }',
		],
		// `:where()` contributes ZERO specificity, argument included, so this ring ties the reset that
		// follows it and the LATER one wins. Scored from the expanded branch it looked ID-specific,
		// outranked the reset, and stood — the one thing `alternativesOf`'s header says a caller must
		// not do, done at a call site written two rounds after that header.
		//
		// Both rules are scoped identically on purpose: the covering test would otherwise report this
		// whatever the ranking said, and the case would prove nothing about specificity.
		// AND THE CLASS-GROUP OVERLAP STAYS ONE-WAY, which is what stops the fix above becoming round
		// 23's over-correction wearing the other hat. `.rp-dialog-button-danger` is worn by SOME
		// `.rp-dialog-button`s, so a ring there answers only the buttons wearing both while the site
		// stands for all of them — every plain `.rp-dialog-button` is still bare. A revoking rule at
		// that class DOES reach the site, which is the case two blocks below.
		[
			'a ring on a class only some of the flattened buttons wear',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button-danger:focus-visible { outline: 2px solid red; }',
		],
		[
			'a where-wrapped ring the later reset ties and beats',
			'.rp-dialog-button { box-shadow: none; } :where(#scope).rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button:focus-visible { outline: none; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
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
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toHaveLength(1);
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
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toHaveLength(1);
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
		[
			'a reset a later rule of equal specificity puts back',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
	])('says nothing about a type-targeted rule with %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
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
		// An important RING beats a more specific normal reset, the same rule the other way up —
		// without this, "importance first" could have become "an important declaration always loses
		// the moment anything more specific exists", or only ever been checked in the resetting
		// direction.
		// EVERY component important is still wholly important, or "all of them" has become "none of
		// them" and the round-26 fix is undone.
		[
			'a wholly important outline a more specific normal reset cannot beat',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-width: 2px !important; outline-style: solid !important; outline-color: red !important; } .rp-dialog-button.rp-dialog-button:focus-visible { outline: none; }',
		],
		[
			'an important ring a more specific normal reset cannot beat',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red !important; } .rp-dialog .rp-dialog-button:focus-visible { outline: none; }',
		],
		// Both rules under the SAME conjunction is the same world.
		[
			'a ring under the same nested conditions as the rule that flattened',
			'@supports (display: grid) { @media (prefers-color-scheme: dark) { .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } } }',
		],
		// A focus rule that takes the shadow and gives an outline in the SAME block answers its own
		// site — or "a focus suppression is a site" has become "no focus rule may touch box-shadow".
		// A reset on a class NO shared button wears must not join — that is the round-23 over-correction
		// in its class-versus-class form, and it would report a button whose ring is on screen.
		[
			'a reset on a class no shared button wears',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-editor-tool-button:focus-visible { outline: none; }',
		],
		[
			'a focus-state shadow reset that draws an outline instead',
			'.rp-dialog-button:focus-visible { box-shadow: none; outline: 2px solid red; }',
		],
		// And the replacement need not be in the same block, only in the same scope.
		[
			'a focus-state shadow reset answered by an equally scoped ring',
			'.rp-dialog-button:focus-visible { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// Both containers flattened and both ringed by ONE unscoped rule — which covers every site,
		// or the per-site rule has become "more than one flattening rule can never be answered".
		// The case the per-key winner got wrong: both containers are fully answered at their own scope,
		// and neither ring may displace the other.
		[
			'two independently flattened and independently ringed containers',
			'.dialog-a .rp-dialog-button { box-shadow: none; } .dialog-a .rp-dialog-button:focus-visible { outline: 2px solid red; } .dialog-b .rp-dialog-button { box-shadow: none; } .dialog-b .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
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
		// Both under the SAME query is the same world, and must stay silent — or the at-rule test has
		// become "a ring inside any at-rule never counts", which would refuse every responsive sheet.
		[
			'a ring under the same query as the rule that flattened',
			'@media (prefers-color-scheme: dark) { .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } }',
		],
		// An unconditional ring covers a conditional flattening rule: it applies wherever that one
		// does, and everywhere else besides.
		[
			'an unconditional ring over a conditional flattening rule',
			'@media (prefers-color-scheme: dark) { .rp-dialog-button { box-shadow: none; } } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// CSS resolves `outline` and `box-shadow` independently. The more specific rule says nothing
		// about the outline the broad one draws, so the ring is on screen — and one winner per key
		// replaced the whole standing with "draws nothing" and reported a button that is fine.
		[
			'a broad outline a specific rule does not touch',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog.rp-dialog .rp-dialog-button:focus-visible { box-shadow: none; }',
		],
		// Two identical `@media` blocks are the same condition. Carrying the at-rule's source
		// location into its identity made them different, so a ring could not answer a suppression
		// written in a separate block — ordinary stylesheet organisation, refused.
		[
			'a ring in a second block with the same query',
			'@media (prefers-color-scheme: dark) { .rp-dialog-button { box-shadow: none; } } @media (prefers-color-scheme: dark) { .rp-dialog-button:focus-visible { outline: 2px solid red; } }',
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
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});
});

import type { Selector, SelectorComponent } from 'lightningcss';
import {
	alternativesOf,
	argumentsOf,
	moreSpecific,
	propertyOf,
	show,
	specificityOf,
	stylesheetRules,
} from './selectors';
import { indicatorOf, type OutlinePart } from './indicators';
import { buttonClassesOn, subjectOf, targetsAButton } from './buttonRules';

/**
 * THE CASCADE A FOCUS RING COMPETES IN, simulated far enough to answer one question: does a button
 * whose host ring was taken away get one back.
 *
 * Split out of `tests/build/buttonFocusRing.test.ts`, which grew past its line budget carrying both
 * the simulation and the cases — the same seam that file was itself split along, and the same one
 * `selectors.ts`, `indicators.ts` and `buttonRules.ts` already sit on: a reader lives in
 * `tests/helpers/`, and what it must ANSWER lives in the test beside it. `flattenedWithoutRing` is
 * the only export, because it is the only thing the cases call; everything else here is reachable
 * from it and stays private, which is what stops this becoming a second public vocabulary.
 *
 * Read that test file's header for what this is FOR, and this file for how it decides.
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

/**
 * The pseudo-classes a FOCUSED BUTTON matches, all of which govern what it looks like when tabbed
 * to — which is the only question this file asks.
 *
 * Only `:focus-visible` was here, and the other two are not variants of it but SUPERSETS: every
 * focus-visible element also matches `:focus`, and a focused button also matches
 * `:focus-within` (an element that has focus or contains it). So `.button.button:focus { outline:
 * none }` wins over a `.button:focus-visible` ring in the browser and leaves the button bare, while
 * a scan keyed to `:focus-visible` alone never heard the reset at all.
 *
 * They are stripped from the subject SHAPE as well as admitted to the cascade, for the reason the
 * `button` type is: kept, the pseudo reads as a condition the flattening site fails to impose, and
 * the rule reaches the cascade only to be refused by `covers`.
 */
const FOCUS_PSEUDOS = new Set(['focus', 'focus-visible', 'focus-within']);

/**
 * Does this component impose focus POSITIVELY — at any nesting depth, through an even number of
 * negations?
 *
 * `:is()` and `:where()` are handled by `alternativesOf` before a branch ever reaches here, so the
 * one shape left is a double negative: `:not(:not(:focus-visible))` is logically `:focus-visible`,
 * and read as a plain `:not` it classified the rule as a non-focus one that never entered the
 * cascade at all. Pathological CSS, and that is exactly the class of spelling every hole in these
 * readers has been.
 *
 * The parity is what makes it right rather than just wider. `:not(:focus-visible)` styles an
 * UNFOCUSED button and must stay a condition rather than become a focus rule, so an odd depth
 * answers false — and the same recursion delivers that without a second rule for it.
 */
const isFocusPseudo = (component: SelectorComponent, negated = false): boolean => {
	if (component.type !== 'pseudo-class') return false;
	if (FOCUS_PSEUDOS.has(component.kind)) return !negated;
	// `:not()` ALONE, because `alternativesOf` has already expanded `:is()`, `:where()` and `:any()`
	// into separate branches before one reaches here — a branch carries no union left to look inside.
	// `:has()` is not recursed either, and must not be: it describes what hangs BELOW the element,
	// so `:has(:focus-visible)` is an ancestor of something focused rather than the focused thing.
	if (component.kind !== 'not') return false;

	// PURELY a focus condition — one argument, one component — because the caller STRIPS whatever
	// this answers true for, and stripping is only sound when nothing else is inside.
	// `:not(:not(:focus-visible), .rp-dialog-button-danger)` is `focus-visible AND NOT danger`, and
	// answering true for it dropped the danger exclusion with the focus one: the ring then read as
	// covering every `.rp-dialog-button`, danger buttons included, which it does not.
	//
	// Refusing the mixed shape means it is not a focus rule at all, so nothing is credited and the
	// site is reported — over-reporting, the safe side, and the same conservative answer this
	// predicate gave before the parity arm existed.
	const args = argumentsOf(component);

	if (args.length !== 1 || args[0].length !== 1) return false;

	return isFocusPseudo(args[0][0], !negated);
};

/**
 * Is this subject condition NECESSARILY TRUE of anything that can be focused, and so no condition at
 * all once the element is?
 *
 * Exactly one spelling qualifies, and the narrowness is the point rather than an omission.
 * `:not(:disabled)` holds for every focusable element there is: a disabled form control is not in the
 * tab order at all, and nothing else matches `:disabled`, so the negation is satisfied by everything
 * that could ever receive focus. Keeping it made `.button:not(:disabled):focus-visible` — a perfectly
 * ordinary and rather careful way to write a ring — fail to cover an unconditional flattening site,
 * and the gate REPORTED a button whose ring is on screen. A false positive on valid CSS, which is the
 * one direction this file may not err in at all.
 *
 * TWO NEAR-SPELLINGS ARE REFUSED, and they are refused because they are not the same claim:
 *
 * - `:enabled` matches form elements that are not disabled, so it is FALSE for a focusable
 *   `<a class="rp-dialog-button">` or `<div tabindex="0">`. Dropping it would credit those elements a
 *   ring the rule never reaches. It is often described as the complement of `:disabled`; it is not.
 * - `:not([disabled])` is an ATTRIBUTE test, and the attribute disables nothing outside form
 *   elements — a `<div disabled tabindex="0">` is focusable and fails it.
 *
 * The shape test is one argument of one component, the same bound `isFocusPseudo` takes and for the
 * same reason: whatever answers true here is DROPPED, and dropping is only sound when nothing else is
 * inside.
 */
const impliedByFocus = (component: SelectorComponent): boolean => {
	if (component.type !== 'pseudo-class' || component.kind !== 'not') return false;

	const args = argumentsOf(component);

	if (args.length !== 1 || args[0].length !== 1) return false;

	const only = args[0][0];

	return only.type === 'pseudo-class' && only.kind === 'disabled';
};

const focusSites = (branch: Selector, classes: Set<string>, condition: string): FocusSite[] => {
	// Only the SUBJECT's `:focus-visible` is stripped from the shape. An ancestor's is part of what
	// the rule is scoped to.
	const subject = subjectOf(branch).filter(
		(component) => !isFocusPseudo(component) && !impliedByFocus(component),
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
		// THE UNIVERSAL SELECTOR NARROWS NOTHING, so it is dropped for exactly the reason the `button`
		// type is. Kept, it renders as `*` — a token no site's subject list ever contains — so
		// `*:focus-visible { outline: 2px solid red }` was filed into every class cascade by
		// `cascadeKeys` and then refused by `covers` in all of them, reaching the cascade only to be
		// thrown out of it. That is the precise failure this comment already warned about for the
		// `button` type, in a sibling line, against a component nobody had asked the same question of.
		subject: subject
			.filter(
				(component) =>
					component.type !== 'universal' && !(component.type === 'type' && component.name === 'button'),
			)
			.map((component) => show([component])),
	};
	// A PSEUDO-ELEMENT IS A DIFFERENT BOX, and the class path below would otherwise file it under the
	// button's own key: `.rp-dialog-button::after { box-shadow: none }` suppresses the shadow of the
	// generated content, not of the button, and no `::after` is ever focused. Checked HERE and not
	// only in `targetsAButton`, because a class-bearing subject never reaches that predicate — which
	// is the neighbour-shaped miss this file has already had three times.
	if (subjectOf(branch).some((component) => component.type === 'pseudo-element')) return [];

	const onSubject = buttonClassesOn(branch, classes);

	if (onSubject.length > 0) return onSubject.map((key) => ({ key, conditions }));

	// A SUBJECT THAT IS NOTHING BUT FOCUS matches every focused element, buttons included, so
	// `:focus:focus { outline: none }` and `*:focus-visible { … }` reach these cascades as surely as
	// a bare `button` does — and reached NEITHER, because after the focus pseudos are stripped there
	// is no class and no type left for the two predicates to see. It is filed by SHAPE like any other
	// classless subject, and `cascadeKeys` widens it across every class because `buttonClassesOn` is
	// empty, which is the same route a type-targeted rule takes.
	//
	// Provably universal is what makes this sound where the attribute widening was not: `*:focus`
	// matches EVERY button, so widening it states a fact, while `[type='button'][data-rp-action]`
	// matches an unknown subset and widening it invented a key nothing could answer.
	// A CONDITION IS NOT AN IDENTITY. This used to demand that nothing but `*` survive the strip, so
	// `:focus-visible:not(.keep-ring) { outline: none }` — which matches every focused element that is
	// not opted out, buttons included — was in NO cascade at all, and a reset that bares every dialog
	// button in the browser was invisible here.
	//
	// A pseudo-class beside the focus one is a STATE the element is in, not a kind of element it is,
	// so the subject still reaches every button; what the pseudo-class narrows travels with the rule
	// as a condition and `covers` decides what it may answer. A class, a type, an id or an attribute
	// is refused, and that is the round-14 line: those identify a subset this scan cannot enumerate,
	// and filing one would invent a key nothing can answer.
	//
	// The two directions come out right for free, which is why this is safe rather than merely wider:
	// as a RESET the rule disqualifies whatever it reaches, which over-reports on the safe side; as a
	// RING it must COVER the site, and `covers` asks the site to impose `:not(.keep-ring)` too.
	const focusOnly =
		subjectOf(branch).some((component) => isFocusPseudo(component)) &&
		subject.every((component) => component.type === 'universal' || component.type === 'pseudo-class');

	if (!focusOnly && !targetsAButton(branch, classes)) return [];

	return [{ key: show(subject), conditions }];
};

/**
 * A CHANNEL of this cascade. Three outline longhands and a shadow are the indicator itself;
 * `text-color` is here because `currentcolor` REFERS to it, so an indicator drawn in the keyword is
 * only as visible as the `color` that wins at that element — which is a cascade question and not a
 * block one. It carries no indicator of its own and `answers` never asks it directly.
 *
 * `indicatorOf` settles the keyword within one block and cannot settle it across blocks:
 * `.button.button:focus-visible { color: transparent }` beating a
 * `.button:focus-visible { outline: 2px solid currentColor }` leaves a solid two-pixel outline nobody
 * can see, while each block alone reads as drawing. That is what this channel is for.
 *
 * THE INITIAL DEFERS TOO, and the first version of this said it deliberately would not. That refusal
 * cited a risk — every unset `outline-color` in the project coming to depend on this channel — and
 * offered a measurement of something else: that no stylesheet here writes the keyword. Two different
 * claims, and the one that mattered was never taken. Measured properly, deferring the initial
 * changes NO answer on the real sheets: nothing real reaches `text-color: false`, because every
 * `color` this project writes is a `var()`, which is unparsed and therefore never filed at all.
 *
 * The lesson is the more useful half. `outline-color: currentColor` and an outline whose colour
 * nobody sets are THE SAME VALUE — the second is the first spelled by omission — so a boundary
 * between them was never a boundary between two risks. It was one value read two ways.
 */
type Channel = OutlinePart | 'shadow' | 'text-color' | 'border';

/** One `:focus-visible` declaration, as the per-site cascade needs it. */
interface FocusRule {
	readonly property: Channel;
	/**
	 * `'deferred'` is `currentcolor` in a block that sets no `color`: this rule draws exactly when
	 * the `text-color` channel does at the same site, which only `partDraws` can say.
	 */
	readonly draws: boolean | 'deferred';
	/**
	 * Written WITHOUT a focus pseudo, so it applies at rest and while focused alike.
	 *
	 * Such a rule competes for every longhand exactly as a focus rule does — that is what makes
	 * `.button { outline: 2px solid transparent }` with `.button:focus-visible { outline-color: red }`
	 * a real ring, composed from base geometry and a focused colour. What it cannot do is be the
	 * CHANGE: if every longhand's winner is at rest, the focused button looks like the resting one
	 * and there is no indicator, however much it paints.
	 */
	readonly atRest: boolean;
	readonly important: boolean;
	readonly specificity: readonly [number, number, number];
	readonly conditions: Conditions;
	/** Source order within the scan, for the tie-break the cascade ends on. */
	readonly order: number;
}

/**
 * What Obsidian's own focus ring for a button scores — `button:focus-visible`, one type plus one
 * pseudo-class.
 *
 * The host's ring IS a `box-shadow`, so a base rule that sets a visible shadow and OUTRANKS this
 * replaces it: the button then looks identical at rest and when tabbed to, which is no indicator
 * at all. A base rule that loses to it changes nothing about focus, because the host's ring still
 * wins — which is why this threshold has to be consulted rather than assumed, and why
 * `.rp-dialog-button { box-shadow: 0 0 0 3px red }` at (0,1,0) is correctly silent.
 */
const HOST_FOCUS_RING = [0, 1, 1] as const;

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
/**
 * What each outline longhand is when NOBODY sets it — the CSS initial values.
 *
 * `outline-style` is `none` and the other two are `medium` and `currentColor`, so an outline that
 * no rule mentions draws nothing, and one where only the style is set draws a medium outline in the
 * text colour. This is the same table `indicatorOf` starts a block from; it is here as well because
 * a CASCADE with no covering rule for a longhand lands on the initial too, and reading "no rule" as
 * "no outline" would refuse the legitimate `outline-style: solid` on its own.
 */
const INITIAL: Record<OutlinePart | 'text-color', boolean | 'deferred'> = {
	width: true,
	style: false,
	// `'deferred'`, not `true`: `outline-color`'s initial IS `currentcolor`, so an outline no rule
	// colours is exactly as dependent on the winning `color` as one that writes the keyword out.
	// `true` here credited `.button:focus-visible { outline-style: solid }` under a covering
	// `color: transparent` — a solid outline nobody can see, and the one spelling of this defect that
	// needs no `currentcolor` in the CSS at all.
	color: 'deferred',
	// AN ELEMENT NO RULE COLOURS INHERITS ONE, and no stylesheet holds what an ancestor happened to
	// have — so an unseen text colour is credited, exactly as a `var()` is and exactly as
	// `indicatorOf` credits it within one block. The two tables agree on this on purpose.
	'text-color': true,
};

/**
 * Does ONE outline longhand come out drawing at this site?
 *
 * THE OUTLINE CASCADES PER LONGHAND, and collapsing it into a single winner is a false NEGATIVE —
 * the one direction this file may not err in. `outline-color: transparent` in one rule and
 * `outline-style: solid` in a more specific one combine, in the browser, into a solid outline in a
 * transparent colour: invisible. Read as two whole-outline verdicts, the second says "draws", wins
 * on specificity, and the site is reported as answered while the button has no indicator at all.
 * The block-level reading each rule gets from `indicatorOf` is right about that BLOCK and says
 * nothing about which longhand survives across blocks, which is what a cascade decides.
 *
 * Two clauses, and they are the two the whole-outline version already had, per longhand now:
 * the winner among rules that COVER the site must draw, and nothing blank may beat it. A blank rule
 * that does not cover still reaches some of the elements the site stands for, so it disqualifies
 * rather than being filtered out — over-reporting where two scopes are disjoint rather than nested,
 * which `covers` cannot tell apart and which is the safe side of that.
 */
const partDraws = (
	rules: readonly FocusRule[],
	site: { readonly conditions: Conditions },
	part: OutlinePart | 'text-color',
): { readonly draws: boolean; readonly changesOnFocus: boolean } => {
	const forPart = rules.filter((one) => one.property === part);
	const winner = forPart
		.filter((one) => covers(one.conditions, site.conditions))
		.reduce<FocusRule | undefined>((best, one) => (best === undefined || beats(one, best) ? one : best), undefined);

	// RESOLVED HERE rather than in a helper the two callers share, because a helper that calls back
	// into this function and is called from it is mutual recursion, which `no-use-before-define`
	// refuses whichever way round the two are written. The recursion is one level deep and provably
	// so: a `text-color` rule's `draws` is a boolean, never `'deferred'`, so the arm below cannot be
	// taken twice.
	const settled = winner === undefined ? INITIAL[part] : winner.draws;
	const winnerDraws = settled === 'deferred' ? partDraws(rules, site, 'text-color').draws : settled;

	if (!winnerDraws) return { draws: false, changesOnFocus: false };

	// `=== false` rather than `!draws`, and it is a CLARITY change with no behaviour in it: `'deferred'`
	// is a truthy string, so `!draws` already answers false for one. Spelled out because the next value
	// added to this union may not be, and a falsy one would silently make every deferred rule a
	// disqualifier. Probed rather than assumed — the two spellings flip no case here.
	// BLANK **OR** AT REST, which is the same pair the shadow arm below tests and for the same reason.
	// A blank rule that beats the winner leaves those elements with nothing; an AT-REST rule that beats
	// it leaves them looking identical focused and unfocused, which is equally no indicator however
	// much it paints. `.rp-dialog-button-danger { outline: 2px solid blue !important }` reaches the
	// buttons a `.rp-dialog-button` site stands for without covering it, so it never becomes the
	// winner — it can only disqualify, and dropping the at-rest half here silently un-reported it.
	if (
		forPart.some(
			(other) => (other.draws === false || other.atRest) && (winner === undefined || beats(other, winner)),
		)
	)
		return { draws: false, changesOnFocus: false };

	// A longhand nobody sets lands on its INITIAL, which is the resting value too — so an unwritten
	// part is never the thing that changes on focus.
	return { draws: true, changesOnFocus: winner !== undefined && !winner.atRest };
};

/**
 * Does a focus rule touch a BORDER at this site — in which case this scan ABSTAINS?
 *
 * A reserved transparent border revealed on focus is a legitimate and common indicator:
 * `.button { border: 2px solid transparent }` with `.button:focus-visible { border-color: red }`
 * draws a real ring and shifts no layout. Reported as unringed, it FAILED THE BUILD on valid CSS.
 *
 * MODELLING IT AS A CHANNEL WOULD BE WORSE THAN THE BUG, which is why this abstains rather than
 * credits properly. The outline and shadow model asks "does the focused state paint something", and
 * for a border that question is the wrong one: a button with a permanent visible border and no focus
 * treatment at all answers YES. The indicator is the CHANGE between the resting and focused states,
 * which is a comparison this file's model does not make anywhere — so a border channel would credit
 * every bordered button as ringed, a false negative far wider than the false positive it fixes.
 *
 * THREE MORE PROPERTIES HAVE THE IDENTICAL SHAPE and are deliberately NOT abstained on, which is the
 * more interesting half of this decision. `background-color`, `text-decoration` and a
 * `filter: drop-shadow(…)` revealed on focus are all real indicators WCAG accepts, all reported by
 * this scan today, and all unjudgeable here for the same reason the border is — the indicator is a
 * state CHANGE. Probed unprompted; no focus rule in this project touches any of them, so the false
 * positive is latent exactly as the border's was.
 *
 * What separates them is what abstention COSTS going forward, not what it costs today. A focus rule
 * touching a border is rare; one tweaking a background is ordinary, so abstaining there would stop
 * this scan checking a large share of the buttons anyone writes next — it would quietly become a
 * gate that passes whatever it cannot read. The border is where the line sits because that trade
 * comes out the other way, and moving it is a decision for whoever hits the false positive, with
 * this measurement in hand rather than re-derived.
 *
 * So the honest answer is that this gate cannot judge it, and the site is dropped rather than
 * reported. The cost is stated rather than hidden: `.button:focus-visible { border-color: transparent }`
 * now silences a site it should report. That is the trade — a narrow silence against failing correct
 * CSS — and it is scoped by `covers` like everything else, so only a border rule that actually
 * reaches the site abstains for it.
 */
/**
 * Could this property put a visible edge on the border box?
 *
 * NARROWED because abstaining is a SILENCE, so over-matching here hides real defects rather than
 * merely reporting extra ones — the opposite of the direction the rest of this file errs in. Four
 * `border-` families paint no edge at all: `border-radius` rounds one, `border-image` replaces the
 * decoration of a border that must already exist, and `border-collapse`/`border-spacing` are table
 * layout. A `:focus-visible` rule that only rounds a corner is not an indicator and must not buy
 * silence for a button with no ring.
 */
const paintsABorder = (property: string): boolean =>
	property.startsWith('border') &&
	!['border-radius', 'border-image', 'border-collapse', 'border-spacing'].some((one) => property.startsWith(one));

const abstains = (rules: readonly FocusRule[], site: { readonly conditions: Conditions }): boolean =>
	rules.some((one) => one.property === 'border' && covers(one.conditions, site.conditions));

/**
 * IT MUST DRAW, AND IT MUST BE THE CHANGE — two conditions, and four rounds of review found this
 * file holding one of them at a time.
 *
 * The outline resolves PER LONGHAND across every rule that reaches the element, base and focus
 * alike: `.button { outline: 2px solid transparent }` with
 * `.button:focus-visible { outline-color: red }` is a real ring, whose width and style come from the
 * resting rule and whose colour comes from the focused one. Refusing base geometry made that common
 * pattern a build failure.
 *
 * But drawing is not enough. If every longhand's winner is a rule that applies AT REST, the focused
 * button is identical to the resting one and there is no indicator at all, however much paint is on
 * screen — which is what `.button { outline: 2px solid red !important }` does to a focus outline
 * under it. So at least one part must be won by a focus rule.
 *
 * The shadow arm says the same thing in one line rather than three, because a shadow is one
 * property: the rule that answers must itself be a focus rule, and nothing may beat it that is
 * either blank or at rest.
 */
const answers = (rules: readonly FocusRule[], site: { readonly conditions: Conditions }): boolean => {
	if (abstains(rules, site)) return true;

	const parts = (['width', 'style', 'color'] as const).map((part) => partDraws(rules, site, part));

	if (parts.every((part) => part.draws) && parts.some((part) => part.changesOnFocus)) return true;

	return rules.some(
		(drawing) =>
			drawing.property === 'shadow' &&
			!drawing.atRest &&
			(drawing.draws === 'deferred' ? partDraws(rules, site, 'text-color').draws : drawing.draws) &&
			covers(drawing.conditions, site.conditions) &&
			!rules.some(
				(other) =>
					other.property === 'shadow' && beats(other, drawing) && (other.draws === false || other.atRest),
			),
	);
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
export const flattenedWithoutRing = (
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
		const { shadow, parts, textColor, deferred } = indicatorOf(rule.declarations);
		// IMPORTANCE IS PER LONGHAND, because the cascade below is. A part is important when any
		// important declaration touched it — the shorthand or its own longhand — which is exact rather
		// than an approximation: `stylesheetRules` hands back normal declarations before important
		// ones, so an important declaration touching a part is the last one to set it.
		//
		// This used to resolve ONE importance for the whole outline, and both versions of that were
		// wrong in the same place. Taking ANY important component as making the outline important let
		// `outline: 2px solid red; outline-color: red !important` outrank a later normal
		// `outline-style: none` that beats it in the browser. Requiring EVERY component to be
		// important — the fix — treated that block as wholly normal, which over-reports rather than
		// under-reports but is still a different answer from the browser's. Per longhand there is no
		// approximation left to pick a safe side of.
		// `all` counts for BOTH, since an important `all` makes every property it resets important.
		const importantPart = (part: OutlinePart): boolean =>
			rule.important.has('all') || rule.important.has('outline') || rule.important.has(`outline-${part}`);
		const importantShadow = rule.important.has('all') || rule.important.has('box-shadow');
		const importantTextColor = rule.important.has('all') || rule.important.has('color');

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
				const ringsFocus = subjectOf(branch).some((component) => isFocusPseudo(component));
				// FLATTENING IS REPLACING, not only suppressing, and it is decided per BRANCH because the
				// second half of it turns on specificity. Obsidian's ring for a button is a `box-shadow`,
				// so a base rule setting a VISIBLE shadow that outranks `button:focus-visible` takes the
				// ring away exactly as `box-shadow: none` does — the button looks the same at rest and
				// focused. Only `shadow === false` counted, so that whole half was invisible.
				//
				// WHETHER A BASE SHADOW REPLACES THE HOST RING IS THE WHOLE CASCADE, not specificity alone.
				// Obsidian's `button:focus-visible { box-shadow: … }` is a NORMAL declaration at (0,1,1) in
				// a sheet loaded before every one scanned here, so ours wins on a TIE by source order, and
				// an important declaration of ours wins outright however specific it is. `moreSpecific`
				// alone missed both: an equal-specificity base shadow and a low-specificity `!important`
				// one each replace the ring while reading as losers.
				//
				// Still load-bearing in the other direction: a base shadow that genuinely loses changes
				// nothing about focus, and without the test `.rp-dialog-button { box-shadow: 0 0 0 3px red }`
				// at (0,1,0) reports while its ring is on screen. Measured — it flips a case either way.
				// The specificity is of the ORIGINAL selector, for the reason the ranking below gives.
				//
				// KNOWN ASYMMETRY, stated rather than implied: the `shadow === false` arm below is NOT
				// gated on this, so a losing `box-shadow: none` still records a site. That OVER-reports,
				// which is the safe side for a gate about a missing indicator, and every such rule this
				// project actually writes is at (0,2,0) and beats the host anyway.
				const replacesHostRing = importantShadow || !moreSpecific(HOST_FOCUS_RING, specificityOf(selector));
				//
				// A `!ringsFocus` guard was written here first, reasoning that a focus rule drawing a
				// shadow IS the indicator rather than a replacement of one. It is REDUNDANT and was
				// removed: such a rule records a site whose conditions are its own, so it covers and
				// answers that site itself. No case could tell the guard from its absence, and the
				// remaining silent case for a shadow ring drawn on focus is what pins that.
				const flattens = shadow === false || (shadow === true && replacesHostRing);

				for (const { key, conditions } of focusSites(branch, classes, rule.condition)) {
					// A focus rule is heard in every cascade it can REACH, not only the one it is filed
					// under. `cascadeKeys` says which, and why the two overlaps differ — and why a rule
					// that DRAWS gets only the type one.
					// EVERY RULE IS HEARD IN EVERY CASCADE IT REACHES, focus or not, and the `ringsFocus`
					// ternary that used to sit here kept a base rule under its own key alone. A button
					// wearing two scanned classes is one element, so
					// `.rp-dialog-button-danger { outline: none !important }` bares the very buttons a
					// `.rp-dialog-button` site stands for — and filed apart, the reset and the site never
					// met. Widening states a fact about the markup rather than a guess: `buttonClassGroups`
					// knows the pair co-occur because it scanned the tags.
					//
					// SITES are still never widened — `flattened` is keyed by `key`, not by this — and
					// `covers` still decides what a widened rule may ANSWER, so a danger reset disqualifies
					// a ring at the plain site without ever answering for it.
					const reaches = cascadeKeys(key, classes, groups, buttonClassesOn(branch, classes).length === 0);

					// `color` IS NOT A FOCUS DECLARATION and is filed outside the `ringsFocus` guard for
					// that reason: a button's text colour while focused is whatever wins at rest unless a
					// focus rule changes it, so `.button { color: transparent }` decides a `currentcolor`
					// ring drawn by a rule three sheets away.
					//
					// `cascadeKeys` RATHER THAN `reaches`, which is the only place in this loop the two
					// differ. `reaches` widens a focus branch and leaves a non-focus one under its own key,
					// and that is right for an INDICATOR — but a `color` rule is not one, and a
					// type-targeted `button { color: transparent }` reaches every button whether it names a
					// focus state or not. Filed under `button` alone it was never heard in the
					// `.rp-dialog-button` cascade, while the identical rule spelled `*:focus-visible` was —
					// one value, two answers, decided by a pseudo-class that has nothing to do with `color`.
					// Widening it states a fact by the same argument `cascadeKeys` already makes for a
					// type-targeted ring, and `covers` keeps the class-group half honest exactly as it does
					// there.
					if (textColor !== undefined)
						for (const reached of reaches)
							ringed.set(reached, [
								...(ringed.get(reached) ?? []),
								{
									property: 'text-color',
									draws: textColor,
									atRest: !ringsFocus,
									important: importantTextColor,
									specificity: specificityOf(selector),
									conditions,
									order: order++,
								},
							]);

					{
						// Of the ORIGINAL selector, never of the expanded branch — `alternativesOf`'s own header
						// says so and this call site said otherwise. `:where()` contributes ZERO, argument
						// included, so `:where(#scope) .button:focus-visible` expands to something scoring an ID
						// it does not have: ranked (1,1,0) it beat a `.dialog .button:focus-visible` reset that
						// actually outranks it, and the flattened button was credited a ring the cascade never
						// draws. Expansion answers WHICH elements a rule reaches; ranking is a separate question.
						const specificity = specificityOf(selector);

						const declarations: (readonly [Channel, boolean | 'deferred' | undefined, boolean])[] = [
							...Object.entries(parts).map((entry) => {
								const part = entry[0] as OutlinePart;
								const draws = part === 'color' && deferred.color ? ('deferred' as const) : entry[1] !== 'blank';

								return [part, draws, importantPart(part)] as const;
							}),
							['shadow', deferred.shadow ? ('deferred' as const) : shadow, importantShadow] as const,
							// `true` or `undefined`, never `false`: this is an ABSTENTION rather than an
							// indicator, so it only ever answers a site and never disqualifies one.
							['border', rule.declarations.some((one) => paintsABorder(propertyOf(one))) || undefined, false] as const,
						];

						for (const reached of reaches) {
							for (const [property, declared, important] of declarations) {
								if (declared === undefined) continue;

								// A BASE RULE FILES EVERYTHING, AS A NON-INDICATOR, which is two roles kept apart:
								// it may never ANSWER a site, and it must still OUTRANK a focus rule that would.
								//
								// This started as "files its resets and not its rings", which got the first role
								// right and dropped the second on the floor. A VISIBLE base shadow that wins the
								// cascade — `.button { box-shadow: 0 0 0 1px red !important }` over a normal
								// `.button:focus-visible { box-shadow: 0 0 0 3px blue }` — leaves the button
								// identical at rest and focused, so there is no indicator at all; dropped for
								// drawing, it left the losing blue shadow unopposed and cleared the very site it
								// had created. The outline channel had the same hole, and was not reported.
								//
								// `draws: false` is exact rather than a trick, because in THIS structure `draws`
								// means "contributes a focus indicator", not "paints something". A rule that paints
								// at rest contributes none — an outline on screen before the button is tabbed to
								// cannot be what tells a keyboard user where focus went — while still ranking
								// against anything that does, which is what `beats` then decides.
								//
								// Its resets belong in the cascade because a `box-shadow` set at rest is still set
								// while focused: `.button { box-shadow: none !important }` beats a normal
								// `.button:focus-visible { box-shadow: 0 0 0 3px red }` in the browser and leaves
								// the button bare, while this scan heard only the focus half and cleared the site.
								// Filed with its own importance, specificity and order, so `beats` decides it — a
								// NORMAL base reset at (0,1,0) still loses to a (0,2,0) focus ring and disqualifies
								// nothing, which is what keeps this from reporting every button in the project.
								//
								// Its rings do not, because a rule that draws at REST is not a focus indicator. An
								// outline on screen before the button is tabbed to cannot be what tells a keyboard
								// user where focus went, so crediting it would answer the question with the thing
								// whose absence the question is about.

								// APPENDED, never compared here. Which rule wins is a question about one element,
								// and this key stands for many — so it is asked per flattening site, by `answers`.
								ringed.set(reached, [
									...(ringed.get(reached) ?? []),
									{ property, draws: declared, atRest: !ringsFocus, important, specificity, conditions, order: order++ },
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

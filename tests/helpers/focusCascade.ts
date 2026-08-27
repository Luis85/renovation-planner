import type { Selector, SelectorComponent } from 'lightningcss';
import { alternativesOf, moreSpecific, show, specificityOf, stylesheetRules } from './selectors';
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

const isFocusPseudo = (component: SelectorComponent): boolean =>
	component.type === 'pseudo-class' && FOCUS_PSEUDOS.has(component.kind);

const focusSites = (branch: Selector, classes: Set<string>, condition: string): FocusSite[] => {
	// Only the SUBJECT's `:focus-visible` is stripped from the shape. An ancestor's is part of what
	// the rule is scoped to.
	const subject = subjectOf(branch).filter((component) => !isFocusPseudo(component));
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
	const focusOnly =
		subjectOf(branch).some((component) => isFocusPseudo(component)) &&
		subject.every((component) => component.type === 'universal');

	if (!focusOnly && !targetsAButton(branch, classes)) return [];

	return [{ key: show(subject), conditions }];
};

/** One `:focus-visible` declaration, as the per-site cascade needs it. */
interface FocusRule {
	readonly property: OutlinePart | 'shadow';
	readonly draws: boolean;
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
const INITIAL: Record<OutlinePart, boolean> = { width: true, style: false, color: true };

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
const partDraws = (rules: readonly FocusRule[], site: { readonly conditions: Conditions }, part: OutlinePart): boolean => {
	const forPart = rules.filter((one) => one.property === part);
	const winner = forPart
		.filter((one) => covers(one.conditions, site.conditions))
		.reduce<FocusRule | undefined>((best, one) => (best === undefined || beats(one, best) ? one : best), undefined);

	if (!(winner === undefined ? INITIAL[part] : winner.draws)) return false;

	return !forPart.some((blank) => !blank.draws && (winner === undefined || beats(blank, winner)));
};

const answers = (rules: readonly FocusRule[], site: { readonly conditions: Conditions }): boolean =>
	(['width', 'style', 'color'] as const).every((part) => partDraws(rules, site, part)) ||
	rules.some(
		(drawing) =>
			drawing.property === 'shadow' &&
			drawing.draws &&
			covers(drawing.conditions, site.conditions) &&
			!rules.some((reset) => !reset.draws && reset.property === 'shadow' && beats(reset, drawing)),
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
		const { shadow, parts } = indicatorOf(rule.declarations);
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

						const declarations: (readonly [OutlinePart | 'shadow', boolean | undefined, boolean])[] = [
							...Object.entries(parts).map(
								(entry) =>
									[entry[0] as OutlinePart, entry[1] !== 'blank', importantPart(entry[0] as OutlinePart)] as const,
							),
							['shadow', shadow, importantShadow] as const,
						];

						for (const reached of reaches) {
							for (const [property, declared, important] of declarations) {
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

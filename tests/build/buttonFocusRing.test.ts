import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonClassGroups, buttonClasses, sheets } from '../helpers/buttonRules';
import { flattenedWithoutRing } from '../helpers/focusCascade';

/**
 * FLATTENING A BUTTON TAKES ITS FOCUS RING WITH IT, and this file is the check for that.
 *
 * Split from `buttonSpecificity.test.ts`, which asks the sibling question — does a rule outrank
 * Obsidian's own `button:not(.clickable-icon)` — and grew past its line budget carrying both. The
 * two share what a BUTTON is (`tests/helpers/buttonRules.ts`) and nothing else, which is the seam:
 * one is about RANK, this one about what a rule leaves on screen once it has won.
 */

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
			'a ring inherited from an ancestor that has none',
			'.rp-dialog { outline: none; } .rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: inherit; }',
		],
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
		// THE OUTLINE CASCADES PER LONGHAND. The colour is transparent from the first rule and the style
		// solid from the second, and the browser combines the winning longhands into a solid outline
		// nobody can see. Collapsed into one verdict per rule, the second says "draws", wins on
		// specificity, and this site read as answered while the button had no indicator at all — a
		// false NEGATIVE, the one direction this file may not err in.
		[
			'an outline whose colour and style are won by different rules',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-color: transparent; } .rp-dialog-button.rp-dialog-button:focus-visible { outline-style: solid; }',
		],
		// The WIDTH blanked instead, and this is the case that requires all three longhands to be
		// resolved rather than the style alone — the obvious narrowing, since the style is the one
		// whose initial refuses to paint. Measured: resolving only `style` leaves this silent and the
		// case above reporting, so the two of them together pin the set.
		[
			'an outline whose width is zeroed by another rule',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:focus-visible { outline-width: 0; }',
		],
		// `all: unset` resets the outline AND the shadow, so a more specific rule spelled that way
		// takes the ring away — and the reader modelled only explicit `outline`/`box-shadow`, so the
		// earlier ring stood and this passed. The sibling gate learned to hear `all` two commits
		// earlier, in `CONTESTED`; sweeping the neighbour for the same shape is what did not happen.
		[
			'a ring a more specific all-reset removes',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:focus-visible { all: unset; }',
		],
		// And its importance travels: an important `all` makes every property it resets important, so
		// a later, more specific NORMAL ring cannot put the indicator back.
		[
			'an important all-reset a more specific normal ring cannot beat',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { all: unset !important; } .rp-dialog-button.rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// A `:focus` RESET APPLIES DURING `:focus-visible` — every focus-visible element also matches
		// `:focus` — so this wins in the browser and leaves the button bare. Keyed to `:focus-visible`
		// alone, the scan never heard the reset and kept the earlier ring.
		[
			'a focus-visible ring a more specific :focus rule removes',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:focus { outline: none; }',
		],
		// Same for `:focus-within`, which a focused button also matches — it is an element that HAS
		// focus or contains it, not only an ancestor of one.
		[
			'a focus-visible ring a more specific :focus-within rule removes',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:focus-within { outline: none; }',
		],
		// A VISIBLE base shadow that OUTRANKS the host ring replaces it, so the button looks identical
		// at rest and when tabbed to. That is no indicator, and only `box-shadow: none` was counted.
		[
			'a base shadow that outranks the host ring',
			'.rp-dialog .rp-dialog-button { box-shadow: 0 0 0 1px red; }',
		],
		// A TIE goes to us. Obsidian's ring is a normal declaration at (0,1,1) in a sheet loaded before
		// every one scanned here, so an equal-specificity base shadow wins on source order — and a
		// `moreSpecific` test alone read it as a loser and stayed silent.
		[
			'a base shadow tying the host ring, loaded after it',
			'button.rp-dialog-button { box-shadow: 0 0 0 1px red; }',
		],
		// And importance beats it from BELOW, where no specificity test can see the replacement at all.
		[
			'a less specific important base shadow',
			'.rp-dialog-button { box-shadow: 0 0 0 1px red !important; }',
		],
		// A SUBJECT THAT IS NOTHING BUT FOCUS matches every focused element, so this reset takes the
		// ring away from every button — and reached neither predicate, because stripping the focus
		// pseudos leaves no class and no type behind. Equal specificity to the ring, so source order
		// decides and the later one wins.
		[
			'a classless focus reset that ties the ring',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } :focus:focus { outline: none; }',
		],
		[
			'a universal focus reset',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } *:focus-visible:focus-visible { outline: none; }',
		],
		// And ODD depth stays a CONDITION rather than becoming focus: `:not(:focus-visible)` draws its
		// outline while the button is UNFOCUSED, so it is no indicator at all and this site is still an
		// offender. Without the parity the recursion would read it as a focus rule, credit it as a
		// ring, and clear a button that has none — the widening being strictly worse than the miss.
		[
			'an outline drawn only while unfocused',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:focus-visible) { outline: 2px solid red; }',
		],
		// A NEGATION CARRYING MORE THAN THE FOCUS CONDITION is not stripped, because stripping is what
		// answering true for it causes. `:not(:not(:focus-visible), .rp-dialog-button-danger)` means
		// `focus-visible AND NOT danger`, and dropping the whole component dropped the danger exclusion
		// with the focus one — the ring then read as covering every `.rp-dialog-button`, danger buttons
		// included, which it does not. Refused, so nothing is credited and the site is reported.
		[
			'a focus ring that excludes one class through the same negation',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:not(:focus-visible), .rp-dialog-button-danger) { outline: 2px solid red; }',
		],
		// A DOUBLE NEGATIVE IS POSITIVE. `:not(:not(:focus-visible))` is logically `:focus-visible`, and
		// read as a plain `:not` the rule was classified as a non-focus one that never entered the
		// cascade at all — so the ring stood while the browser takes it away.
		[
			'a doubly negated focus reset',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button.rp-dialog-button:not(:not(:focus-visible)) { outline: none; }',
		],
		// AND THE NEAR-SPELLINGS ARE NOT THE SAME CLAIM, which is what stops the drop from becoming
		// "anything mentioning disabled is vacuous". `:enabled` is FALSE for a focusable
		// `<a class="rp-dialog-button">` or `<div tabindex="0">`, since it matches form elements only;
		// `:not([disabled])` is an attribute test and the attribute disables nothing outside a form
		// control. Dropping either would credit elements a ring the rule never reaches.
		[
			'a ring limited to enabled form elements',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:enabled:focus-visible { outline: 2px solid red; }',
		],
		[
			'a ring limited by the disabled attribute',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not([disabled]):focus-visible { outline: 2px solid red; }',
		],
		// A REAL condition beside the vacuous one still counts, or the filter has become "a subject
		// carrying :not(:disabled) has no conditions at all".
		[
			'a ring limited to hovered buttons that are not disabled',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:disabled):hover:focus-visible { outline: 2px solid red; }',
		],
		// One argument of one component, the same bound `isFocusPseudo` takes: this `:not()` also
		// excludes another class, so dropping it would drop that exclusion with it.
		[
			'a ring whose negation mixes the vacuous condition with a real one',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:disabled, .other):focus-visible { outline: 2px solid red; }',
		],
		[
			'a where-wrapped ring the later reset ties and beats',
			'.rp-dialog-button { box-shadow: none; } :where(#scope).rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button:focus-visible { outline: none; }',
		],
		// `currentcolor` IS A REFERENCE, not a value, and the rule it refers to need not be the rule it
		// is written in. Each block alone reads as drawing: one sets a solid two-pixel outline, the
		// other sets only a colour. Together they are a ring nobody can see, and only a cascade with a
		// FOURTH channel in it can say so.
		[
			'an outline in currentcolor over a transparent colour from another rule',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; } .rp-dialog-button.rp-dialog-button:focus-visible { color: transparent; }',
		],
		[
			'a shadow in currentcolor over a transparent colour from another rule',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px currentColor; } .rp-dialog-button.rp-dialog-button:focus-visible { color: transparent; }',
		],
		// `color` is NOT a focus declaration, which is why it is collected outside the focus guard: a
		// focused button's text colour is whatever wins at REST unless a focus rule changes it. Filed
		// only from focus branches, this one is never heard and the ring stands.
		[
			'an outline in currentcolor over a transparent colour set at rest',
			'.rp-dialog-button { box-shadow: none; color: transparent; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; }',
		],
		// A TYPE-TARGETED colour reaches every button, focus state or not — so it is widened through
		// `cascadeKeys` like a type-targeted ring. Filed under `button` alone it was never heard here,
		// while the identical rule spelled `*:focus-visible` was: one value, two answers, decided by a
		// pseudo-class that has nothing to do with `color`.
		[
			'an outline in currentcolor over a transparent colour set on the button type',
			'.rp-dialog-button { box-shadow: none; } button { color: transparent; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; }',
		],
		// An unknowable `color` is filed as a rule of its own, not left out. Omitted, it does not compete
		// — so a less specific `color: red` won the channel while the browser gives this rule's
		// `inherit` the win and an unknown colour. That is what makes `color: inherit` different from
		// writing no `color` at all, which is otherwise the same thing on an inherited property.
		[
			'an outline in currentcolor under an inherited colour that outranks a painting one',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button { color: red; } .rp-dialog-button.rp-dialog-button:focus-visible { color: inherit; outline: 2px solid currentColor; }',
		],
		// A BASE RULE IS STILL IN FORCE WHILE FOCUSED, so its resets belong in the cascade. Only focus
		// declarations were filed, so the scan heard the ring and not the important reset that beats it
		// — the button is bare in the browser and the site was cleared.
		[
			'an important base shadow reset that beats the focus shadow',
			'.rp-dialog-button { box-shadow: none !important; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red; }',
		],
		// The outline channel had the identical hole and was not named in the report.
		[
			'an important base outline reset that beats the focus outline',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button { outline: none !important; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// Source order decides between two important rules of equal specificity, or "a base reset is
		// heard" has become "a base reset always wins".
		[
			'an important base shadow reset written after an equally specific important ring',
			'.rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red !important; } .rp-dialog-button.rp-dialog-button { box-shadow: none !important; }',
		],
		// A base rule files its RESETS and not its RINGS: an outline on screen before the button is
		// tabbed to cannot be what tells a keyboard user where focus went, so it must not answer the
		// site. This is the half of the guard the fix could most easily have got wrong in passing.
		[
			'a base outline drawn at rest, which is not a focus indicator',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button { outline: 2px solid red; }',
		],
		// `all: unset` reaches the text-colour channel too, so a ring drawn by a LATER, more specific
		// rule resolves against the colour the reset took away.
		[
			'an outline in currentcolor over an all-reset colour',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button { all: unset; } .rp-dialog-button.rp-dialog-button:focus-visible { outline: 2px solid currentColor; }',
		],
		// And the cascade half of the initial: no `currentcolor` anywhere in the CSS, and the outline
		// still takes the text colour.
		[
			'an outline with no colour of its own over a transparent colour from another rule',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-style: solid; } .rp-dialog-button.rp-dialog-button:focus-visible { color: transparent; }',
		],
		// IMPORTANCE FIRST on this channel too, or the fourth channel has quietly become the one that
		// ranks on specificity alone. It takes BOTH colour rules to ask that: written with one, the
		// transparent colour wins for having no rival and the case passes with importance ignored —
		// watched doing exactly that before this fixture was rewritten. In separate BLOCKS, too: written
		// beside the outline, the colour is resolved by `indicatorOf` within the block and the case
		// never reaches this channel at all.
		[
			'an outline in currentcolor over an important transparent colour a more specific one cannot beat',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; } .rp-dialog-button:focus-visible { color: transparent !important; } .rp-dialog-button.rp-dialog-button:focus-visible { color: red; }',
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
		// `:not(:disabled)` IS NO CONDITION ON A FOCUSED ELEMENT — a disabled form control is not in the
		// tab order and nothing else matches `:disabled` — so a ring written this careful way covers an
		// unconditional site. Kept, it made the gate FAIL valid CSS whose ring is on screen, which is
		// the one direction this file may not err in.
		[
			'a ring limited to buttons that are not disabled',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:not(:disabled):focus-visible { outline: 2px solid red; }',
		],
		// And the base reset must be RANKED, not merely heard. A normal one at (0,1,0) loses to the
		// (0,2,0) focus ring above it and disqualifies nothing — without this, filing base resets would
		// report every flattened button in the project, since the flattening rule is itself a base reset.
		[
			'a normal base shadow reset a more specific focus ring beats',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red; }',
		],
		[
			'an important base shadow reset an equally important later ring beats',
			'.rp-dialog-button.rp-dialog-button { box-shadow: none !important; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red !important; }',
		],
		// The fourth channel must not become "a currentcolor ring never counts". Three shapes hold that
		// line, and each fails against a different over-correction: a colour that PAINTS wins the
		// channel; NO colour rule at all lands on the initial, which is credited exactly as a `var()`
		// is; and a shadow LIST with one item that paints on its own does not depend on the keyword at
		// all, so it must not be deferred.
		[
			'a currentcolor ring over a colour that paints',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; } .rp-dialog-button.rp-dialog-button:focus-visible { color: red; }',
		],
		[
			'a currentcolor ring with no colour rule anywhere',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid currentColor; }',
		],
		// The initial must not become "an outline that sets no colour never rings" — which is what
		// `outline-style: solid` on its own has always meant, and still must.
		[
			'an outline with no colour of its own and no colour rule anywhere',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-style: solid; }',
		],
		// A ring that names its OWN colour is not deferred at all, however transparent the text is.
		[
			'an explicitly coloured ring over a transparent colour set on the button type',
			'.rp-dialog-button { box-shadow: none; } button { color: transparent; } .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		[
			'a currentcolor shadow list with an item that paints on its own',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px currentColor, 0 0 0 3px red; } .rp-dialog-button.rp-dialog-button:focus-visible { color: transparent; }',
		],
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
		// A pseudo-element is a DIFFERENT BOX: this suppresses the generated content's shadow, not the
		// button's, and no `::after` is ever focused. Filed under the button's own key it demanded a
		// ring for a box that has none to lose.
		['a shadow suppressed on generated content', '.rp-dialog-button::after { box-shadow: none; }'],
		// The same visible base shadow, ANSWERED. The widening above must not become "any button with
		// a shadow is an offender": a focus ring covering the site is the whole remedy.
		[
			'a base shadow that outranks the host ring, with a ring of its own',
			'.rp-dialog .rp-dialog-button { box-shadow: 0 0 0 1px red; } .rp-dialog .rp-dialog-button:focus-visible { outline: 2px solid red; }',
		],
		// And a focus rule drawing a shadow is the INDICATOR, not a replacement of one — `!ringsFocus`
		// is what keeps it from reporting itself.
		[
			'a shadow ring drawn on focus',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red; }',
		],
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});
});

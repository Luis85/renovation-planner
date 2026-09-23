import { describe, expect, it } from 'vitest';
import { flattenedWithoutRing } from '../helpers/focusCascade';

/**
 * A RING WHOSE COLOUR IS NOT ITS OWN, asked of the focus scan and of nothing else.
 *
 * The fifth cut of this seam, and like the other four it separates a question rather than a
 * quantity. `buttonFocusRing.test.ts` is about which rule WINS a longhand; `focusReach.test.ts` is
 * about whether a rule reaches the button at all. These are about a value that is a REFERENCE: a
 * ring painted in `currentcolor` — named, inherited, or arrived at because nobody set a colour and
 * `currentcolor` is the initial — is drawn in whatever the text-colour channel resolves to three
 * rules away. Each block alone reads as drawing, and only a cascade with that fourth channel in it
 * can say the button has no visible ring.
 *
 * The fixture set is duplicated rather than shared, deliberately, for the reason the other files
 * give: a helper exporting `BUTTONS` and `GROUPS` would make one file's edit silently change
 * another's answers, and all of them assert against exact offender lists.
 */
const BUTTONS = new Set(['.rp-dialog-button', '.rp-dialog-button-danger', '.rp-editor-tool-button']);
const GROUPS: ReadonlySet<string>[] = [
	new Set(['.rp-dialog-button', '.rp-dialog-button-danger']),
	new Set(['.rp-editor-tool-button']),
];

describe('a ring whose colour is not its own', () => {
	it.each([
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
		// AN UNPARSED COLOUR IS NOT THE KEYWORD. `fromCurrentColor` starts true, because
		// `outline-color`'s initial IS `currentcolor`, and the unparsed arms overwrote the colour while
		// leaving that provenance set — so `deferred.color` survived and this cascade replaced the blank
		// with the button's text colour, reading an inherited outline as a visible one. The block reader
		// answered correctly throughout; only a caller resolving the cascade could see it.
		[
			'a focus outline whose colour is inherited rather than named',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline-style: solid; outline-color: inherit; }',
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
		// A DEFERRAL IS RESOLVED WHEREVER IT IS JUDGED, not only where it is the candidate. Both channels
		// tested a competitor for a literal `false`, which a deferred rule is not whatever its colour
		// turns out to be — so a ring that BEATS the answering one with an invisible `currentcolor`
		// disqualified nothing and the loser answered the site. The browser paints the winner, and here
		// the winner is transparent.
		[
			'a deferred shadow that beats the answering one over a transparent colour',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px red; } .rp-dialog-button.rp-dialog-button:focus-visible { box-shadow: 0 0 0 3px currentColor; } .rp-dialog-button.rp-dialog-button.rp-dialog-button { color: transparent; }',
		],
		// The outline channel resolves its WINNER either way, so the hole there is the competitor that
		// beats the winner without covering the site — a co-occurring class, which reaches the elements
		// the site stands for and can therefore only disqualify.
		[
			'a co-occurring deferred outline that beats the ring over a transparent colour',
			'.rp-dialog-button { box-shadow: none; } .rp-dialog-button:focus-visible { outline: 2px solid red; } .rp-dialog-button-danger:focus-visible { outline-color: currentColor; } .rp-dialog-button-danger { color: transparent; }',
		],
	])('reports %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([
			'.rp-dialog-button',
		]);
	});

	it.each([
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
	])('says nothing about %s', (_case, css) => {
		expect([...flattenedWithoutRing([['fixture', css]], BUTTONS, GROUPS).offenders.keys()]).toEqual([]);
	});
});

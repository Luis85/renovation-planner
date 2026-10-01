/**
 * **The preset gallery's button neutralises Obsidian's own `button` rule, so its thumbnail fits.**
 *
 * Obsidian styles every `<button>` for a LABEL: `tests/harness/obsidian.css` declares
 * `height: var(--input-height)` (30px), `display: inline-flex`, `flex-direction: row` and
 * `white-space: nowrap` on the bare `button` type selector. A project rule that puts a picture
 * inside one and expects a CARD — a thumbnail over its caption — gets none of that for free, and
 * the failure is silent, because `overflow` is `visible`: the box keeps its declared height, the
 * button keeps 30px, and the picture is simply DRAWN outside the control.
 *
 * Found by a user walking the live vault, not by a gate: *"the preview images for presets look
 * strange as they are inside buttons and overlapping them"*. Reproduced in the browser harness
 * against this project's assembled stylesheet and the vendored `obsidian.css`, at a 300px form —
 * the button computed 30px tall against the 48px thumbnail, so the picture hung nine pixels out top
 * and bottom, across the gallery's 4px grid gap into the neighbouring row; and in row direction the
 * thumbnail's `width: 100%` shrank against a `nowrap` label to 43px, to 62px, and on `Peninsula
 * worktop with return` to exactly **zero**, whose label then overflowed the button by 16px.
 *
 * Three other project buttons already meet the same host rule and each neutralises it in its own
 * way, none of them recording that it is a pattern: `.rp-evidence-filters button` takes
 * `height: auto` with `white-space: normal`, `.rp-evidence-gallery button` takes `display: block`
 * with `height: 100%` and `white-space: normal`, and `.rp-item-color`'s swatch declares its own
 * `height: 40px` over the 30px. `.rp-preset-choice` was the fourth site and the only one that
 * neutralised nothing.
 *
 * **This file names ONE button, and the narrowing is a measurement rather than laziness.** The
 * first version derived the set — every rule declaring a fixed `height` whose selector named a
 * project button class in a non-subject position — and it reached NOTHING, because the premise is
 * false: a CSS selector need not name the element it descends through. The rule that sizes this
 * thumbnail is `.rp-preset-gallery .rp-asset-preset-preview`, which does not mention
 * `.rp-preset-choice` anywhere, while the containment that makes the defect possible lives in
 * `AssetPresetGallery.vue`'s template. A stylesheet-only instrument cannot see it, so the honest
 * check is over the button this project actually has rather than a derivation that would quietly
 * reach zero.
 *
 * It was the non-empty case that made that visible, with the three real assertions passing
 * vacuously beneath it — which is the whole argument for writing such a case, met on its first day.
 *
 * **So the known limit is stated rather than implied: this does NOT catch the next card-shaped
 * button.** The trigger for generalising is a SECOND button holding a fixed-height box. At that
 * point the instrument has to read template containment — `buttonRules.ts` already parses those
 * templates for their class attributes — or mount the tree and walk it, and either is a card of its
 * own rather than a widening of this one.
 *
 * **What no check here can see at all.** It reads DECLARATIONS, not layout: jsdom computes no used
 * height, so nothing in this repository can assert the thumbnail actually fits. Every
 * `.rp-preset-choice` case in `tests/presentation/designer/assetPresetForm.test.ts` passed both
 * before and after the fix — all 20 of that file's tests green either way, measured. The live vault and
 * `npm run harness` remain the only instruments for the picture itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonClasses, sheets } from '../helpers/buttonRules';
import { compoundHasClass, compoundsOf, stylesheetRules } from '../helpers/selectors';
import type { StyleRule } from '../helpers/selectors';

/** The button whose thumbnail this is about, bare because lightningcss's class node carries no dot. */
const BUTTON = 'rp-preset-choice';

/**
 * The properties Obsidian's `button` rule decides and a CARD-shaped button has to take back, each
 * with its reason — a list without its reasons is a list nobody can extend correctly.
 *
 * `height`, because the host fixes it at `var(--input-height)` and a taller box overhangs.
 * `flex-direction`, because the host's `row` puts the picture BESIDE its caption and then shrinks
 * it, where a card stacks. `white-space`, because the host's `nowrap` makes a caption that no
 * longer fits overflow the control rather than wrap inside it.
 *
 * All three were observed doing exactly that in the browser before this file existed; none is
 * precautionary.
 */
const NEUTRALISE = ['height', 'flex-direction', 'white-space'] as const;

/** lightningcss models a declaration either as a typed property or as a raw custom one. */
function propertyName(declaration: unknown): string {
	const entry = declaration as { property?: string; name?: string };
	return entry.property ?? entry.name ?? '';
}

/** Every rule in every stylesheet this project assembles, in the order a browser loads them. */
const all: StyleRule[] = sheets.flatMap((sheet) => stylesheetRules(readFileSync(sheet, 'utf8')));

/** The rules whose SUBJECT — the last compound — carries `BUTTON`, and which always apply. */
const governing = all.filter(
	(rule) =>
		rule.condition === ''
		&& rule.selectors.some((selector) => {
			const subject = compoundsOf(selector).at(-1);
			return subject !== undefined && compoundHasClass(subject, BUTTON);
		}),
);

describe('the preset choice button neutralises the host button rule it sits under', () => {
	/**
	 * The finds-something-at-all case, first because every assertion below is vacuous without it.
	 * A renamed class, a restructured selector or a helper that stopped answering would otherwise
	 * leave this file green while checking nothing — which is what happened to its first draft.
	 */
	it('reaches the button at all', () => {
		expect(buttonClasses()).toContain(`.${BUTTON}`);
		expect(governing.length).toBeGreaterThan(0);
	});

	it.each(NEUTRALISE)('redeclares %s', (property) => {
		const declaring = governing.filter((rule) =>
			rule.declarations.some((entry) => propertyName(entry) === property),
		);
		const complaint = `no unconditional rule whose subject is .${BUTTON} redeclares ${property}, `
			+ "so Obsidian's own button rule still decides it and the thumbnail escapes the control";
		expect(declaring.length === 0 ? complaint : 'neutralised').toBe('neutralised');
	});
});

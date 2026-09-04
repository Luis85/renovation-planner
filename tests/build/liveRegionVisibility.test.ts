import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sheets } from '../helpers/buttonRules';
import { propertyOf, stylesheetRules, subjectClasses } from '../helpers/selectors';

/**
 * A LIVE REGION HAS TO BE IN THE ACCESSIBILITY TREE BEFORE IT HAS ANYTHING TO SAY, and a
 * stylesheet is one of the ways it stops being.
 *
 * `NewRoomInspector.vue` renders its `role="status"` element from the first render precisely so
 * that the sentence `RoomDraftStore.settle()` writes is an UPDATE to a region a screen reader is
 * already watching — slice 13's own lesson, that a live region attributed on a container which
 * APPEARS announces nothing. `styles/editor-new-room.css` then took it straight back out:
 * `.rp-new-room__settled:empty { display: none; }`, and Vue compiles `{{ draft.settledSize ?? '' }}`
 * to `setElementText(el, '')`, so at rest the `<p>` holds ZERO child nodes and `:empty` matches.
 * Measured in jsdom rather than reasoned: `childNodes.length` is 0 and `el.matches(':empty')` is
 * `true` while no size has settled, and both flip in the single patch that also writes the
 * sentence — a region that was not in the tree beforehand receiving its first content. That is
 * design spec §5.4's single announcement, and `docs/tests/cases/Add a room.md` step 3's pass
 * condition, unmet; and it recurred after every Escape, since `clearRect` empties it again.
 *
 * **`visibility: hidden` is not an escape and neither is `content-visibility: hidden`** — all
 * three remove the element from the accessibility tree, so all three are refused here rather
 * than only the one that shipped.
 *
 * **What this case CANNOT see**, said plainly because a stylesheet assertion reads as more than
 * it is:
 *
 * - It reads the shipped sheets, over lightningcss's parsed tree rather than source text, so a
 *   rule reaching this element by some OTHER selector — `.rp-new-room > p:empty`, an attribute
 *   selector on `role` — is invisible to it. The subject's own class is what it keys on.
 * - It says nothing about whether a screen reader actually announces anything. jsdom has no
 *   accessibility tree and no assistive technology; `docs/tests/cases/Add a room.md` step 3 is
 *   the only instrument for the announcement itself.
 * - It is a NAMED class rather than a rule over every live region in the plugin. The general
 *   instrument — discover every `role="status"`/`aria-live` element from the `.vue` templates
 *   and hold the same rule over each one's class — is a wider tripwire over source text that
 *   belongs in its own increment; naming the one class this finding is about is the honest
 *   smaller thing, and the `seen` assertion below is what stops it going quietly vacuous.
 */
const LIVE_REGION_CLASS = 'rp-new-room__settled';

/** The three declarations that take an element out of the accessibility tree. */
const REMOVES_FROM_TREE: readonly (readonly [string, string])[] = [
	['display', 'none'],
	['visibility', 'hidden'],
	['content-visibility', 'hidden'],
];

describe('the new-room live region', () => {
	it('is never hidden by a shipped rule, so it is in the accessibility tree before it has a sentence', () => {
		const offenders: string[] = [];
		let seen = 0;

		for (const sheet of sheets) {
			for (const rule of stylesheetRules(readFileSync(sheet, 'utf8'))) {
				for (const selector of rule.selectors) {
					if (!subjectClasses(selector).includes(LIVE_REGION_CLASS)) continue;
					seen += 1;
					for (const declaration of rule.declarations) {
						const property = propertyOf(declaration);
						const value = JSON.stringify(declaration.value ?? null);
						for (const [name, keyword] of REMOVES_FROM_TREE) {
							if (property === name && value.includes(`"${keyword}"`)) {
								offenders.push(`${sheet}: ${name}: ${keyword}`);
							}
						}
					}
				}
			}
		}

		expect(offenders).toEqual([]);
		// A renamed class would otherwise pass this case having read nothing at all, which is
		// indistinguishable from a clean sheet — the vacuous-pass shape this repository keeps
		// finding in its own instruments rather than in the code they watch.
		expect(seen).toBeGreaterThan(0);
	});
});

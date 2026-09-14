import { describe, expect, it } from 'vitest';
import { planEditorQuery, shot, shots } from '../helpers/harnessShotFixtures';

/**
 * The item-mode and Add-to-asset-library shots (e2c41923), split out of `harness-shot.test.ts`
 * once that file's own `tests/**` line cap could not hold this group beside everything else —
 * see that file's header for why the parsed fixtures and the `SHOTS` reader live in
 * `tests/helpers/harnessShotFixtures.ts` rather than here a second time. The both-directions
 * census over the WHOLE `SHOTS` table stayed in that file, whole, because a table this file
 * only reads a slice of is not this file's to certify.
 */

const ITEM_DRAWN = ['.rp-task-banner [data-rp-object-shape="rectangle"][aria-pressed="true"]', '.rp-task-banner__finish[aria-disabled="false"]'];
const ITEM_SELECTORS: Record<string, unknown> = { rectangle: ITEM_DRAWN, drag: ITEM_DRAWN, promote: '.rp-new-asset__outline', saved: '.rp-element-inspector [data-rp-action="replace-asset"]' };

const itemShotFacts = (name: string) => {
	const parsed = planEditorQuery(name);
	return [name, parsed.has('reference') && parsed.has('planning'), parsed.get('item'), shot(name).selector, parsed.get('theme'), shot(name).width];
};

const itemShotWanted = (name: string, item = name.split('-')[3]) => [name, true, item, ITEM_SELECTORS[item], name.endsWith('-dark') ? null : 'light', name.endsWith('-narrow') ? 460 : undefined];

describe('the item-mode and Add-to-asset-library harness shots', () => {
	/**
	 * The item shots: each is the resting editor under a new name unless BOTH the reference workspace (the only floor with
	 * renovation and asset-creation services) and its own `&item=` gesture are on the query, and each waits on what only
	 * that gesture lands — an enabled Finish over a pressed Rectangle, the dialog's outline line, or a placement's Replace.
	 */
	it('takes the item shots over the reference workspace through the ?item knob, waiting on what each gesture lands', () => {
		const names = [...shots.keys()].filter((name) => name.startsWith('plan-editor-item-'));

		expect(names.map((name) => itemShotFacts(name))).toEqual(names.map((name) => itemShotWanted(name)));
	});
});

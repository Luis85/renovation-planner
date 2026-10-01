import { describe, expect } from 'vitest';
import { test } from './fixture';
import { contrastOf } from './designerParity';
import { writeEvidence } from './diagnostics';
import { inBothThemes, paints } from './legibility';
import { openCatalogue, WIDE } from './library';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md` step 33's colour-magnitude clause, "noticeably"
 * fainter than a real design's mark, in a real Obsidian. The library refuses to mount on mobile, so
 * the case is desktop only.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The drawn lines of every tile's `slot` in the active library leaf. */
const lines = (slot: string): string => `.workspace-leaf.mod-active .rp-al-tile ${slot} > *`;

describe('Browse the asset library, legibility guards in the real Obsidian host', () => {
	/*
	 * Step 33, "noticeably fainter than a real design's mark". GUARD (AD18-R30). A RELATION, both
	 * sides read in the same run and in both of Obsidian's themes: every design-less tile's category
	 * icon line has a LOWER WCAG 2.x contrast against its tile than every designed tile's mark line
	 * has against its own. The existing *draws a design-less tile's category icon…* case asserts the
	 * two colours differ and never which is the fainter; this is that direction, measured as it is
	 * drawn. WHAT STAYS HUMAN: "noticeably" — whether the difference is large enough for a person to
	 * read the icon as a placeholder rather than as a design — which no ratio settles.
	 */
	desktop('draws a design-less tile\'s category icon at lower contrast than a designed tile\'s mark, in both themes', async ({
		native: { browser, page, ui, directory },
	}) => {
		await openCatalogue(browser, page, ui, { designed: true, width: WIDE, layout: 'Grid' });
		await expect.poll(() => browser.$(lines('.rp-al-tile__category-icon svg')).isExisting()).toBe(true);

		const measured = await inBothThemes(browser, async () => ({
			icon: (await paints(browser, lines('.rp-al-tile__category-icon svg'), 'stroke', 'data-asset-id')).map((paint) => contrastOf(paint).ratio),
			mark: (await paints(browser, lines('.rp-al-mark--measured'), 'stroke', 'data-asset-id')).map((paint) => contrastOf(paint).ratio),
		}));
		await writeEvidence(directory, 'placeholder-contrast', measured);

		for (const [theme, { icon, mark }] of Object.entries(measured)) {
			expect(icon.length * mark.length, `${theme}: an icon and a mark to compare`).toBeGreaterThan(0);
			expect.soft(Math.max(...icon), `${theme}: the faintest mark line ${String(Math.min(...mark))}`).toBeLessThan(Math.min(...mark));
		}
	});
});

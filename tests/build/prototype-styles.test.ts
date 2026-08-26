import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * A prototype may not name a class nothing styles.
 *
 * This exists because of the defect it does NOT catch, and the distinction is the whole
 * value of the file. `ZoneSummary.vue` put its name and its area in adjacent spans, Vue's
 * `whitespace: 'condense'` removed the newline between them, and the mock rendered
 * `Kitchen12.60 m²` — through forty-four review rounds, a green `npm run check` every time.
 * jsdom lays nothing out, so no gate here can measure a gap; `textContent` reads both strings
 * and passes. A PNG read by eye is the only instrument in this repository that reaches it.
 *
 * What IS checkable is the condition that made the defect possible: the mock had no stylesheet
 * at all. `WorkPackages.vue`, written the same week, does not have the defect — not by being
 * more careful about whitespace, but by shipping `styles/work-packages.css`, whose gaps put
 * every adjacent element apart on purpose. So the trap is sprung by a mock with no styles of
 * its own, and until now nothing noticed that a mock had none.
 *
 * Naming this as "every class is declared" rather than "every mock has a stylesheet" is
 * deliberate: a partial that exists but does not cover the class a template actually writes
 * leaves exactly the same span unstyled, and the first run of this check found precisely that
 * — `rp-wp-state-word`, a hook in an hour-old mock that carried no rule and never had.
 *
 * The guarantee is narrower than "the mock looks right", and the narrowness is the point:
 *
 * - It reads DECLARATIONS, not the cascade — the same narrowing `cssVars.test.ts` states. A
 *   class declared in a block no page state reaches still counts.
 * - It reads STATIC `class` attributes. A `:class` binding is invisible here; there are none
 *   in the tree today (measured, and a template-only SFC has no script to compute one), and
 *   the day one arrives this check will not see it.
 * - It says nothing about spacing, contrast, or anything else a layout engine decides.
 *
 * `styles/` only, never `tests/harness/theme.css`: criterion 5 requires a mock and a real
 * component on one screen to be styled by the same assembled sheet, so a mock leaning on the
 * harness's own sheet would draw correctly in the index and wrongly in a vault.
 *
 * And it is the ASSEMBLED sheet, through `assembleStyles()` — the build's own function, not a
 * read of the `styles/` directory. The first version of this file did read the directory, and
 * the probe that was supposed to red it stayed green: a partial `index.css` does not import is
 * absent from what ships while still sitting on disk declaring things. That the build also
 * fails on an unimported partial is not a reason to measure the wrong set here; a check whose
 * evidence is one gate away from the thing it claims about is how a claim outlives its truth.
 */

const CLASS_ATTRIBUTE = /\sclass="([^"]*)"/g;
const CLASS_SELECTOR = /\.([A-Za-z_][\w-]*)/g;

const prototypes = readdirSync('src/prototypes').filter((file) => file.endsWith('.vue'));

const used = new Map(
	prototypes.map((file) => {
		const source = readFileSync(`src/prototypes/${file}`, 'utf8');
		const classes = [...source.matchAll(CLASS_ATTRIBUTE)].flatMap(([, list]) => list.split(/\s+/).filter(Boolean));

		return [file, new Set(classes)] as const;
	}),
);

const declared = new Set([...assembleStyles().matchAll(CLASS_SELECTOR)].map(([, name]) => name));

describe('a prototype and the sheet that styles it', () => {
	/**
	 * The instrument before the measurement, both halves. A `class` regex that stopped
	 * matching would make every case below compare an empty set and pass; a selector regex
	 * that stopped matching would fail every case instead, which is the loud direction and
	 * still worth ruling out before trusting a green run.
	 */
	it('is measured by regexes that still match', () => {
		expect(prototypes.length).toBeGreaterThan(0);
		expect([...used.values()].some((classes) => classes.size > 0)).toBe(true);
		expect(declared.has('rp-zone-summary__name')).toBe(true);
	});

	it.each(prototypes)('%s names no class the assembled sheet leaves undeclared', (file) => {
		const undeclared = [...(used.get(file) ?? [])].filter((name) => !declared.has(name));

		expect(undeclared).toEqual([]);
	});
});

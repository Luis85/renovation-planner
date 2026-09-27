import { describe, expect } from 'vitest';
import { test } from './fixture';
import { writeEvidence } from './diagnostics';
import { openCatalogue } from './library';
import { capture, difference, DISTINCT } from './pixels';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Browse the asset library.md` step 3's "distinguishable at 20px", as the host
 * paints the rows' marks. The library refuses to mount on mobile, so the case is desktop only.
 */
const desktop = mobileEmulation ? test.skip : test;

const GEOMETRY = 'Renovation/Library/Geometry';

/** The mark on the active library's row for `assetId`. */
const mark = (assetId: string): string => `.workspace-leaf.mod-active .rp-al-row[data-asset-id="${assetId}"] .rp-al-mark`;

/**
 * `library.ts`'s seeded catalogue by id (`asset-e2e-<index>`), and what this case makes each one
 * draw: two of every state that can be held at rest, so each state has a SECOND row to be compared
 * with — the control that the instrument answers "the same drawing" across two rows.
 */
const SOFA = 'asset-e2e-0';
const CHAIR = 'asset-e2e-1';
const PLANK = 'asset-e2e-2';
const PAINT = 'asset-e2e-3';
const VANITY = 'asset-e2e-4';
const CUTTER = 'asset-e2e-5';

/**
 * Sidecars written through the host's own vault, the way sync delivers one: the designed toilet's,
 * copied under two ids as a measured footprint and under two as an unscaled one — a TRACED footprint
 * awaiting its scale (`footprintPending`, the stored flag `ListAssetOutlines` reads; a typed one
 * may not be pending) — and one that is not JSON. Answers the toilet's id.
 */
const seedSidecars = (browser: NativeBrowser) =>
	browser.executeObsidian(async ({ app }, [folder, measured, unscaled, unreadable]) => {
		const toilet = app.vault.getFiles().find((file) => file.parent?.path === folder && file.extension === 'rpgeo');
		if (!toilet) throw new Error('No designed toilet to copy.');
		const document = JSON.parse(await app.vault.read(toilet)) as { shape: object };
		const copy = (assetId: string, shape: object) => JSON.stringify({ ...document, assetId, shape: { ...document.shape, ...shape } });
		for (const assetId of measured) await app.vault.create(`${folder}/${assetId}.rpgeo`, copy(assetId, {}));
		for (const assetId of unscaled) await app.vault.create(`${folder}/${assetId}.rpgeo`, copy(assetId, { footprintOrigin: 'traced', footprintPending: true }));
		await app.vault.create(`${folder}/${unreadable}.rpgeo`, '{');
		return toilet.basename;
	}, [GEOMETRY, [PLANK], [SOFA, CHAIR], PAINT] as const);

/**
 * §3.4's fifth state, *not yet read*, HELD: the host's `vault.read` answers nothing for `path` until
 * `releaseRead` runs, and the sidecar is then modified, so the library forgets that row's mark and
 * asks again. `releaseRead` puts the host's own `read` back and answers what it held.
 */
const holdRead = (browser: NativeBrowser, path: string) =>
	browser.executeObsidian(async ({ app }, file) => {
		const vault = app.vault as unknown as { read(file: { path: string }): Promise<string>; modify(file: object, data: string): Promise<void> };
		const original = vault.read;
		const held: (() => void)[] = [];
		(window as unknown as { rpReleaseRead?: () => void }).rpReleaseRead = () => {
			vault.read = original;
			for (const answer of held.splice(0)) answer();
		};
		vault.read = function (this: unknown, target) {
			const read = () => original.call(this, target);
			return target.path === file ? new Promise<string>((resolve) => { held.push(() => { resolve(read()); }); }) : read();
		};
		const sidecar = app.vault.getFileByPath(file);
		if (!sidecar) throw new Error(`No sidecar at ${file}.`);
		await vault.modify(sidecar, `${await original.call(app.vault, sidecar)}\n`);
	}, path);

const releaseRead = (browser: NativeBrowser) =>
	browser.execute(() => {
		const scope = window as unknown as { rpReleaseRead?: () => void };
		scope.rpReleaseRead?.();
		delete scope.rpReleaseRead;
	});

describe('Browse the asset library, the row marks as painted in the real Obsidian host', () => {
	/*
	 * Step 3, "five distinguishable pictures … at 20px". GUARD (AD18-R30). Each of §3.4's five
	 * states captured off a real List row in the same run — measured, unscaled, none and unreadable
	 * at rest, and not-yet-read HELD by stalling the host's read of one sidecar — and every pair
	 * compared as drawings (`difference` in `pixels.ts`: each picture's ink against its own
	 * background, so a colour difference alone does not count, which is §3.4's own rule that the
	 * states differ in kind and never only in colour): more than `DISTINCT` of the pixels either
	 * inks differ. Two rows each of measured, unscaled and none are compared too, and must answer the
	 * same drawing — without that, a capture misaligned between rows would read as "different" and
	 * the guard would pass on noise. `assetMark.test.ts` asserts five distinct classes and the
	 * per-state drawings; this is whether they PAINT differently at 20px. WHAT STAYS HUMAN:
	 * "distinguishable to an eye that has not been told" what to look for, which is about what each
	 * difference is (a dash, three dots, a cross), not how much of it there is. Every capture is in
	 * the case's evidence folder.
	 */
	desktop('paints the five mark states as five different drawings at 20px, and one state\'s two rows as the same', async ({
		native: { browser, page, ui, directory },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, layout: 'List' });
		const toilet = await seedSidecars(browser);
		for (const head of await lib.library().$$('button.rp-al-shelf__head[aria-expanded="false"]')) await head.click();
		const expected = { [toilet]: 'measured', [PLANK]: 'measured', [SOFA]: 'unscaled', [CHAIR]: 'unscaled', [VANITY]: 'none', [CUTTER]: 'none', [PAINT]: 'unreadable' };
		const kinds = () => browser.execute((ids, sel) => ids.map((id) => document.querySelector(sel.replace('ID', id))?.getAttribute('class') ?? ''), Object.keys(expected), mark('ID'));
		await expect.poll(kinds).toEqual(Object.values(expected).map((kind) => `rp-al-mark rp-al-mark--${kind}`));

		const shot = (assetId: string) => capture(browser, mark(assetId), directory, `mark-${assetId}`);
		const resting = { measured: await shot(toilet), unscaled: await shot(SOFA), none: await shot(VANITY), unreadable: await shot(PAINT) };
		const controls = {
			measured: await difference(browser, resting.measured, await shot(PLANK)),
			unscaled: await difference(browser, resting.unscaled, await shot(CHAIR)),
			none: await difference(browser, resting.none, await shot(CUTTER)),
		};
		let pending = '';
		try {
			await holdRead(browser, `${GEOMETRY}/${SOFA}.rpgeo`);
			await expect.poll(() => browser.$(mark(SOFA)).getAttribute('class')).toBe('rp-al-mark rp-al-mark--pending');
			pending = await capture(browser, mark(SOFA), directory, 'mark-pending');
		} finally {
			await releaseRead(browser);
		}
		await expect.poll(() => browser.$(mark(SOFA)).getAttribute('class')).toBe('rp-al-mark rp-al-mark--unscaled');

		const states = Object.entries({ ...resting, pending });
		const pairs = states.flatMap(([one, first], index) => states.slice(index + 1).map(([other, second]) => ({ pair: `${one}/${other}`, first, second })));
		const compared = await Promise.all(pairs.map(async ({ pair, first, second }) => ({ pair, ...(await difference(browser, first, second)) })));
		await writeEvidence(directory, 'mark-pixels', { controls, compared });

		// The instrument reaches something, and answers "the same" for two rows drawing one state.
		expect(Object.values(controls).map((control) => control.inked[0] > 0)).toEqual([true, true, false]);
		expect(Object.values(controls).map((control) => control.differing)).toEqual([0, 0, 0]);
		expect(compared).toHaveLength(10);
		expect(compared.filter((pair) => !(pair.fraction > DISTINCT)).map(({ pair, fraction }) => `${pair} ${String(fraction)}`), 'pairs painted alike').toEqual([]);
	});
});

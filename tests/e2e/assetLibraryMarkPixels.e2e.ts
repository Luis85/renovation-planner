import { describe, expect } from 'vitest';
import { test } from './fixture';
import { LIBRARY } from './designer';
import { writeEvidence } from './diagnostics';
import { openCatalogue } from './library';
import { atPixelRatio, capture, difference, DISTINCT, RATIOS } from './pixels';
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
 * `releaseRead` runs, and the library is then closed and opened again, so a fresh view asks for that
 * row's mark for the first time. `releaseRead` takes the patch off and answers what it held.
 *
 * A FIRST read, and no longer a sidecar modified under an open library: since §5.4's 2026-09-29
 * amendment a drawn row keeps its mark while it is re-read, so a re-read cannot show this state.
 */
const holdRead = (browser: NativeBrowser, path: string) =>
	browser.executeObsidian(({ app }, file) => {
		const vault = app.vault as unknown as { read(file: { path: string }): Promise<string> };
		const original = vault.read;
		const own = Object.prototype.hasOwnProperty.call(vault, 'read');
		const held: (() => void)[] = [];
		(window as unknown as { rpReleaseRead?: () => void }).rpReleaseRead = () => {
			// The patch is an own property shadowing the class's method: deleted, unless one was there before.
			if (own) vault.read = original;
			else delete (vault as { read?: unknown }).read;
			for (const answer of held.splice(0)) answer();
		};
		vault.read = function (this: unknown, target) {
			const read = () => original.call(this, target);
			return target.path === file ? new Promise<string>((resolve) => { held.push(() => { resolve(read()); }); }) : read();
		};
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
	 * states taken off a real List row in the same run, each copied only while its row draws that
	 * state and STAGED at one whole-pixel spot (`capture` in `pixels.ts`), and read at a device pixel
	 * ratio of 1 and of 2 whatever the machine's own — measured, unscaled, none and unreadable at
	 * rest, and not-yet-read HELD by stalling the host's read of one sidecar across a reopened library — and every pair
	 * compared as drawings (`difference` in `pixels.ts`: each picture's ink against its own
	 * background, so a colour difference alone does not count, which is §3.4's own rule that the
	 * states differ in kind and never only in colour): more than `DISTINCT` of the pixels either
	 * inks differ. Two rows each of measured, unscaled and none are compared too, and must answer the
	 * same drawing — without that, a capture misaligned between pictures would read as "different"
	 * and the guard would pass on noise. It has caught its own instrument twice: CI runs 36345605529
	 * and 36476196536 read the two unscaled rows 26 px apart because one copy was taken while a late
	 * re-read had put that row back to *not yet read* — which is why each copy now waits for its
	 * state (`capture`'s docblock carries the account). `assetMark.test.ts` asserts
	 * five distinct classes and the per-state drawings; this is whether they PAINT differently at
	 * 20px. WHAT STAYS HUMAN: "distinguishable to an eye that has not been told" what to look for,
	 * which is about what each difference is (a dash, three dots, a cross), not how much of it there
	 * is; and whether a dashed mark still reads as dashed on the half-pixel row a ratio-1 display may
	 * draw it on, which the stage deliberately does not reproduce (`capture`'s docblock names what it
	 * drops). Every capture is in the case's evidence folder.
	 */
	desktop('paints the five mark states as five different drawings at 20px, and one state\'s two rows as the same', async ({
		native: { browser, page, ui, directory },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, layout: 'List' });
		const toilet = await seedSidecars(browser);
		const openShelves = async () => {
			for (const head of await lib.library().$$('button.rp-al-shelf__head[aria-expanded="false"]')) await head.click();
		};
		await openShelves();
		const expected = { [toilet]: 'measured', [PLANK]: 'measured', [SOFA]: 'unscaled', [CHAIR]: 'unscaled', [VANITY]: 'none', [CUTTER]: 'none', [PAINT]: 'unreadable' };
		const kinds = () => browser.execute((ids, sel) => ids.map((id) => document.querySelector(sel.replace('ID', id))?.getAttribute('class') ?? ''), Object.keys(expected), mark('ID'));
		await expect.poll(kinds).toEqual(Object.values(expected).map((kind) => `rp-al-mark rp-al-mark--${kind}`));

		const native = await browser.execute(() => window.devicePixelRatio);
		// Each copy is taken only while its row draws `kind` (`capture`'s `state`), so a late re-read cannot slip a pending mark in.
		const shot = (assetId: string, ratio: number, kind = expected[assetId] ?? '') =>
			capture(browser, mark(assetId), directory, `mark-${kind === 'pending' ? 'pending' : assetId}@${String(ratio)}x`, `.rp-al-mark--${kind}`);
		const rest = (ratio: number) =>
			atPixelRatio(browser, ratio, async () => {
				const resting = { measured: await shot(toilet, ratio), unscaled: await shot(SOFA, ratio), none: await shot(VANITY, ratio), unreadable: await shot(PAINT, ratio) };
				const controls = {
					measured: await difference(browser, resting.measured, await shot(PLANK, ratio)),
					unscaled: await difference(browser, resting.unscaled, await shot(CHAIR, ratio)),
					none: await difference(browser, resting.none, await shot(CUTTER, ratio)),
				};
				return { resting, controls };
			});
		const atRest = [];
		for (const ratio of RATIOS) atRest.push(await rest(ratio));
		const pending: string[] = [];
		try {
			await holdRead(browser, `${GEOMETRY}/${SOFA}.rpgeo`);
			await browser.executeObsidian(({ app }, type) => { app.workspace.detachLeavesOfType(type); }, LIBRARY);
			await lib.open(Object.keys(expected).length);
			await lib.layout('List');
			await openShelves();
			await expect.poll(() => browser.$(mark(SOFA)).getAttribute('class')).toBe('rp-al-mark rp-al-mark--pending');
			for (const ratio of RATIOS) pending.push(await atPixelRatio(browser, ratio, () => shot(SOFA, ratio, 'pending')));
		} finally {
			await releaseRead(browser);
		}
		await expect.poll(() => browser.$(mark(SOFA)).getAttribute('class')).toBe('rp-al-mark rp-al-mark--unscaled');

		const byRatio = [];
		for (const [index, ratio] of RATIOS.entries()) {
			const read = atRest[index];
			const held = pending[index];
			if (!read || held === undefined) throw new Error(`No captures at ${String(ratio)}x.`);
			const { resting, controls } = read;
			const states = Object.entries({ ...resting, pending: held });
			const pairs = states.flatMap(([one, first], at) => states.slice(at + 1).map(([other, second]) => ({ pair: `${one}/${other}`, first, second })));
			const compared = [];
			for (const { pair, first, second } of pairs) compared.push({ pair, ...(await difference(browser, first, second)) });
			byRatio.push({ devicePixelRatio: ratio, controls, compared });
		}
		await writeEvidence(directory, 'mark-pixels', { nativeDevicePixelRatio: native, byRatio });

		for (const { devicePixelRatio: ratio, controls, compared } of byRatio) {
			const at = `at ${String(ratio)}x`;
			const all = [...Object.values(controls), ...compared];
			// The instrument compares one grid, reaches something, and answers "the same" for two rows drawing one state.
			expect(all.filter((each) => each.sizes[0].join() !== each.sizes[1].join()).map((each) => each.sizes), `${at}: captures of different sizes`).toEqual([]);
			expect(Object.values(controls).map((control) => control.inked[0] > 0), `${at}: ink on the controls`).toEqual([true, true, false]);
			expect(Object.values(controls).map((control) => control.differing), `${at}: two rows of one state`).toEqual([0, 0, 0]);
			expect(compared, `${at}: every pair of the five`).toHaveLength(10);
			expect.soft(compared.filter((pair) => !(pair.fraction > DISTINCT)).map(({ pair, fraction }) => `${pair} ${String(fraction)}`), `${at}: pairs painted alike`).toEqual([]);
		}
	});
});

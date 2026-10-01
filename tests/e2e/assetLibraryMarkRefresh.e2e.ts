import { describe, expect } from 'vitest';
import { test } from './fixture';
import { writeEvidence } from './diagnostics';
import { openCatalogue } from './library';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * Design "Asset library overview" §5.4, amended 2026-09-29: a DRAWN row keeps its mark while the
 * mark is re-read, and the answer replaces it in one step. The flash this pins against was caught
 * by the Browse 3 pixel guard on Linux CI (E2E runs 36345605529 and 36476196536) — a row put back
 * to §3.4's *not yet read* by a late re-read. The library refuses to mount on mobile, so the case
 * is desktop only.
 */
const desktop = mobileEmulation ? test.skip : test;

const GEOMETRY = 'Renovation/Library/Geometry';

/**
 * Every class the row's mark takes from here on, into `window.rpMarkClasses`: each class
 * attribute's value BEFORE a change (so a state drawn for a single frame is still recorded) and
 * the mark's class after every batch of changes anywhere in the library, so a re-created row is
 * seen too.
 */
const recordMarkClasses = (browser: NativeBrowser, selector: string) =>
	browser.execute((sel) => {
		const seen: string[] = [];
		(window as unknown as { rpMarkClasses: string[] }).rpMarkClasses = seen;
		const now = () => {
			const drawn = document.querySelector(sel)?.getAttribute('class');
			if (drawn) seen.push(drawn);
		};
		new MutationObserver((records) => {
			for (const record of records) {
				if (record.target instanceof Element && record.target.matches(sel) && record.oldValue) seen.push(record.oldValue);
			}
			now();
		}).observe(document.querySelector('.workspace-leaf.mod-active .renovation-asset-library') as Node, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['class'],
			attributeOldValue: true,
		});
		now();
	}, selector);

describe('Browse the asset library, a drawn mark re-read in the real Obsidian host', () => {
	desktop('keeps a drawn row\'s mark while it is re-read, never drawing "not yet read" in between', async ({
		native: { browser, page, ui, directory },
	}) => {
		const lib = await openCatalogue(browser, page, ui, { designed: true, layout: 'List' });
		for (const head of await lib.library().$$('button.rp-al-shelf__head[aria-expanded="false"]')) await head.click();
		const toilet = await browser.executeObsidian(({ app }, folder) => {
			const sidecar = app.vault.getFiles().find((file) => file.parent?.path === folder && file.extension === 'rpgeo');
			if (!sidecar) throw new Error('No designed toilet.');
			return sidecar.basename;
		}, GEOMETRY);
		const mark = `.workspace-leaf.mod-active .rp-al-row[data-asset-id="${toilet}"] .rp-al-mark`;
		const classOf = () => browser.$(mark).getAttribute('class');
		await expect.poll(classOf).toBe('rp-al-mark rp-al-mark--measured');

		await recordMarkClasses(browser, mark);
		// Re-announced the way sync delivers a sidecar, and to a different state, so "the re-read
		// landed" is a class to wait for: the footprint becomes a trace awaiting its scale.
		await browser.executeObsidian(async ({ app }, file) => {
			const sidecar = app.vault.getFileByPath(file);
			if (!sidecar) throw new Error(`No sidecar at ${file}.`);
			const document = JSON.parse(await app.vault.read(sidecar)) as { shape: object };
			await app.vault.modify(sidecar, JSON.stringify({ ...document, shape: { ...document.shape, footprintOrigin: 'traced', footprintPending: true } }));
		}, `${GEOMETRY}/${toilet}.rpgeo`);
		await expect.poll(classOf).toBe('rp-al-mark rp-al-mark--unscaled');

		const seen = await browser.execute(() => (window as unknown as { rpMarkClasses: string[] }).rpMarkClasses);
		await writeEvidence(directory, 'mark-refresh', { seen });
		// The instrument saw both ends of the change, so a pass is not a recorder that saw nothing.
		expect(new Set(seen)).toEqual(new Set(['rp-al-mark rp-al-mark--measured', 'rp-al-mark rp-al-mark--unscaled']));
	});
});

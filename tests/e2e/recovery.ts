import { existsSync } from 'node:fs';
import { expect } from 'vitest';
import type { DesignerPage, Sidecar } from './designer';
import type { NativeBrowser } from './session';

/**
 * What the second pass over `Recover an asset design rather than lose it.md` shares between its
 * cases: the two sentences a fault produces, the fault edits themselves, and the few readings of
 * the designer the page object does not already offer.
 */
export const STALE = 'This asset could not be re-read after the last change; what you see may be out of date.';
export const VALIDATION = 'This data is not in the expected form.';
export const FIXTURE_PNG = 'editor-background-png-test.png';

/**
 * Fault 2b's overflow needle, copied from `getAssetDesign.test.ts`'s "refuses a clearance whose
 * span overflows rather than reporting Infinity": a finite area and an x-span no double holds.
 * The vertex order is load-bearing — that test's docblock says why.
 */
export const NEEDLE = [
	[0, 1e-300],
	[1e308, 0],
	[-1e308, 0],
];

export const setSchema = (version: number) => (text: string) => text.replace(/"schemaVersion": \d+/, `"schemaVersion": ${version}`);

/** Replace the clearance's vertex list, keeping everything else in the document as it was. */
export const withClearance = (points: number[][]) => (text: string) => {
	const data = JSON.parse(text) as Sidecar;
	if (!data.shape?.clearance) throw new Error('This sidecar has no clearance to replace.');
	data.shape.clearance.points = points;
	return JSON.stringify(data, null, '\t');
};

export const vaultSidecar = (assetId: string) => `Renovation/Library/Geometry/${assetId}.rpgeo`;

/** The stale notice's paragraph and its sibling Try again, in the active designer. */
export const staleNotice = (designer: DesignerPage) => designer.designer().$('.rp-designer-notice');
export const retryButton = (designer: DesignerPage) => designer.designer().$('.rp-designer-retry');

/** How many images the designer's Konva stages draw with a size — the reference sheet, when there is one. */
export const drawnImages = (browser: NativeBrowser) =>
	browser.execute(() => {
		const konva = (window as unknown as { Konva: { stages: { find(sel: string): { width(): number; height(): number }[] }[] } }).Konva;
		return konva.stages.flatMap((stage) => stage.find('Image')).filter((image) => image.width() * image.height() > 0).length;
	});

/** The asset note's background, from Obsidian's own metadata cache. */
export const noteBackground = (browser: NativeBrowser, name: string) =>
	browser.executeObsidian(({ app }, file) => {
		const note = app.vault.getFileByPath(`Renovation/Library/Assets/${file}.md`);
		return (note && app.metadataCache.getFileCache(note)?.frontmatter?.['background-path']) ?? null;
	}, name);

/** An edit made outside Obsidian, reconciled the way its watcher would, landing as the stale notice. */
export const staleAfter = async (designer: DesignerPage, assetId: string, edit: (text: string) => string): Promise<void> => {
	designer.editSidecar(assetId, edit);
	await designer.reconcile(vaultSidecar(assetId));
	await expect.poll(() => staleNotice(designer).getText()).toBe(STALE);
};

/** A repair made the same way, and the notice it retires without a press. */
export const healedAfter = async (designer: DesignerPage, assetId: string, edit: (text: string) => string): Promise<void> => {
	designer.editSidecar(assetId, edit);
	await designer.reconcile(vaultSidecar(assetId));
	await expect.poll(() => staleNotice(designer).isExisting()).toBe(false);
};

/** The Reference panel's Remove reference, waited for on disk at the revision it should write. */
export const removeReference = async (designer: DesignerPage, assetId: string, revision: number): Promise<void> => {
	await designer.referenceTab();
	await designer.designer().$('button[name="remove-reference"]').click();
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(revision);
};

/** A calibrated sheet behind the asset the designer has open: choose the fixture, then scale it. */
export const referenceSheet = async (designer: DesignerPage, assetId: string): Promise<number> => {
	const before = existsSync(designer.sidecarPath(assetId)) ? designer.readSidecar(assetId).revision : 0;
	await designer.chooseBackground(FIXTURE_PNG);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(before + 1);
	await designer.calibrate(1000);
	await expect.poll(() => designer.readSidecar(assetId).revision).toBe(before + 2);
	expect(designer.readSidecar(assetId).calibration).not.toBeNull();
	return before + 2;
};

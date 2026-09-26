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

/** The active designer leaf, as the page's own selector — the one `ui.leaf` resolves. */
const ACTIVE_DESIGNER = '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]';

/**
 * What the active designer shows, as three lists a comparison can hold equal: every drawn Konva
 * shape by id and screen box, the part rows pressed (the selection), and every Inspector field.
 */
export const designerPicture = (browser: NativeBrowser) =>
	browser.execute((host) => {
		const leaf = document.querySelector(host);
		const konva = (window as unknown as { Konva: { stages: { container(): HTMLElement; find(sel: string): { id(): string; getClientRect(): Record<'x' | 'y' | 'width' | 'height', number> }[] }[] } }).Konva;
		const stage = konva.stages.find((candidate) => leaf?.contains(candidate.container()));
		const shapes = (stage?.find('Shape') ?? []).map((shape) => {
			const box = shape.getClientRect();
			return `${shape.id()}@${[box.x, box.y, box.width, box.height].map((value) => Math.round(value)).join(',')}`;
		});
		const pressed = [...(leaf?.querySelectorAll('.rp-designer-part-row[aria-pressed="true"]') ?? [])].map((row) => row.getAttribute('name'));
		const inspector = [...(leaf?.querySelectorAll<HTMLInputElement>('.rp-designer-inspector input') ?? [])].map((field) => `${field.name}=${field.value}`);
		return { shapes, pressed, inspector };
	}, ACTIVE_DESIGNER);

/** Every leaf in the workspace, of every view type, with the state Obsidian would persist for it. */
export const allLeaves = (browser: NativeBrowser) =>
	browser.executeObsidian(({ app }) => {
		const found: { type: string; state: unknown }[] = [];
		// A block body: `iterateAllLeaves` stops at the first callback returning a truthy value,
		// and `push` returns the new length — measured, the arrow form listed one leaf per split.
		app.workspace.iterateAllLeaves((leaf) => {
			found.push({ type: leaf.getViewState().type, state: leaf.getViewState().state });
		});
		return found;
	});

/** Close the active designer's tab the way a user does: the tab header's own close button. */
export const closeTabByHand = (browser: NativeBrowser) =>
	browser.$('.workspace-tab-header.is-active[data-type="renovation-asset-designer"] .workspace-tab-header-inner-close-button').click();

/**
 * Record everything raised in front of the user from now on — a toast, a modal, a plugin dialog —
 * however briefly it stays, since a toast that timed out before an assertion read the page would
 * otherwise read as one never raised.
 */
export const recordInterruptions = (browser: NativeBrowser) =>
	browser.execute(() => {
		const raised = '.notice, .modal-container, .rp-dialog';
		const seen: string[] = [];
		(window as unknown as { rpInterruptions: string[] }).rpInterruptions = seen;
		new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (node instanceof HTMLElement && (node.matches(raised) || node.querySelector(raised))) seen.push(node.className);
				}
			}
		}).observe(document.body, { childList: true, subtree: true });
	});

export const interruptionsSeen = (browser: NativeBrowser) => browser.execute(() => (window as unknown as { rpInterruptions: string[] }).rpInterruptions);

/**
 * Hold Obsidian's own file watcher for the vault, so an edit made outside it reaches the plugin
 * only through what the test does next. Returns the release. `onFileChange` is what both of the
 * desktop watcher's handlers call (app.js 1.13.7: `fs.watch` → `onFileChange` → `reconcileFile`).
 */
export const holdHostWatcher = async (browser: NativeBrowser): Promise<() => Promise<void>> => {
	await browser.executeObsidian(({ app }) => {
		const adapter = app.vault.adapter as unknown as { onFileChange(path: string): void; rpHeld?: (path: string) => void };
		adapter.rpHeld = adapter.onFileChange.bind(adapter);
		adapter.onFileChange = () => undefined;
	});
	return async () => {
		await browser.executeObsidian(({ app }) => {
			const adapter = app.vault.adapter as unknown as { onFileChange(path: string): void; rpHeld?: (path: string) => void };
			if (adapter.rpHeld) adapter.onFileChange = adapter.rpHeld;
		});
	};
};

/**
 * Record, after every batch of child or text changes in the active designer (attributes are not
 * watched), the three widgets that report a stale read — the notice, its Try again, and the header's
 * `refresh needed` — so "together" is a fact about each intermediate state the DOM passed through
 * rather than about the one a poll happened to land on.
 */
export const recordStaleTriple = (browser: NativeBrowser) =>
	browser.execute((host) => {
		const leaf = document.querySelector(host) as Node;
		const seen: string[] = [];
		const read = () => {
			const scope = leaf as ParentNode;
			const triple = [
				scope.querySelector('.rp-designer-notice') !== null,
				scope.querySelector('.rp-designer-retry') !== null,
				scope.querySelector('.rp-save-state-label')?.textContent?.includes('refresh needed') ?? false,
			].join(',');
			if (seen.at(-1) !== triple) seen.push(triple);
		};
		read();
		new MutationObserver(read).observe(leaf, { childList: true, subtree: true, characterData: true });
		(window as unknown as { rpTriples: string[] }).rpTriples = seen;
	}, ACTIVE_DESIGNER);

export const staleTriples = (browser: NativeBrowser) => browser.execute(() => (window as unknown as { rpTriples: string[] }).rpTriples);

/**
 * Installed through CDP BEFORE the page's own scripts, so it is watching when Obsidian restores its
 * leaves — which is before `onLayoutReady` and so before anything `executeObsidian` could install.
 * A MutationObserver on the whole document counts each batch of changes after which a designer's
 * failure panel exists, and a `requestAnimationFrame` loop counts the frames it was present in. A
 * panel inserted and removed inside one batch is seen by neither — and is never painted either.
 */
const FAILURE_SAMPLER = `(() => {
	const leaf = '.workspace-leaf-content[data-type="renovation-asset-designer"]';
	const s = { atStart: document.querySelector(leaf) !== null, frames: 0, panelFrames: 0, panelMutations: 0, drawnFrames: 0 };
	window.rpSampler = s;
	const frame = () => {
		s.frames += 1;
		if (document.querySelector(leaf + ' .rp-view-failure')) s.panelFrames += 1;
		if (document.querySelector(leaf + ' .rp-plan-canvas')) s.drawnFrames += 1;
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
	new MutationObserver(() => {
		if (document.querySelector(leaf + ' .rp-view-failure')) s.panelMutations += 1;
	}).observe(document, { childList: true, subtree: true });
})();`;

/**
 * Reload the renderer with the failure sampler watching from the first script. `app:reload` is
 * `window.location.reload()` (app.js 1.13.7), so this is that command. The layout is saved first:
 * Obsidian otherwise saves it on a one-second debounce, which a reload 50 ms later would race.
 */
export const reloadWatchingForFailure = async (browser: NativeBrowser): Promise<void> => {
	await browser.executeObsidian(async ({ app }) => {
		// Not in the public typings; `requestSaveLayout` debounces into exactly this call.
		await (app.workspace as unknown as { saveLayout(): Promise<void> }).saveLayout();
	});
	await browser.sendCommandAndGetResult('Page.addScriptToEvaluateOnNewDocument', { source: FAILURE_SAMPLER });
	await browser.execute(() => {
		(window as unknown as { rpOldPage: boolean }).rpOldPage = true;
		setTimeout(() => {
			window.location.reload();
		}, 50);
	});
	await browser.waitUntil(
		() =>
			browser
				// The new page, its driver helper loaded, and its workspace past `onLayoutReady`.
				.execute(() => {
					const w = window as unknown as { rpOldPage?: boolean; wdioObsidianService?: unknown; app?: { workspace?: { layoutReady?: boolean } } };
					return w.rpOldPage !== true && w.wdioObsidianService !== undefined && w.app?.workspace?.layoutReady === true;
				})
				.catch(() => false),
		{ timeout: 60_000 },
	);
};

/** What the sampler has seen since the reload began. */
export const failureSample = (browser: NativeBrowser) => browser.execute(() => (window as unknown as { rpSampler: Record<'frames' | 'panelFrames' | 'panelMutations' | 'drawnFrames', number> & { atStart: boolean } }).rpSampler);

/** An edit outside Obsidian that moves one detail's outline `dx` along x, keeping the document valid. */
export const withDetailShifted = (detailId: string, dx: number) => (text: string) => {
	const data = JSON.parse(text) as Sidecar;
	const detail = data.shape?.details.find((candidate) => candidate.id === detailId);
	if (!detail) throw new Error(`This sidecar has no detail ${detailId}.`);
	detail.outline.points = detail.outline.points.map(([x = 0, y = 0]) => [x + dx, y]);
	return JSON.stringify(data, null, '\t');
};

/** What the file explorer does to an asset note: move it to `to`, or send it to the trash. */
export const fileExplorer = (browser: NativeBrowser, from: string, to: string | 'trash') =>
	browser.executeObsidian(
		async ({ app }, source, target) => {
			const note = app.vault.getFileByPath(source);
			if (note === null) throw new Error(`No note at ${source}.`);
			await (target === 'trash' ? app.fileManager.trashFile(note) : app.fileManager.renameFile(note, target));
		},
		from,
		to,
	);

/** The host's `modify` times for one sidecar, and each time the active designer's stale notice came or went. */
interface HostLog {
	modify: number[];
	notice: [boolean, number][];
}

const hostLog = (browser: NativeBrowser) => browser.execute(() => (window as unknown as { rpHostLog: HostLog }).rpHostLog);

/** Start the log `noticeAfterEdit` reads: install once per case, after the designer is open. */
export const recordHostAndNotice = (browser: NativeBrowser, assetId: string) =>
	browser.executeObsidian(
		({ app }, target, host) => {
			const log: HostLog = { modify: [], notice: [] };
			(window as unknown as { rpHostLog: HostLog }).rpHostLog = log;
			app.vault.on('modify', (file) => {
				if (file.path === target) log.modify.push(Date.now());
			});
			let shown = document.querySelector(`${host} .rp-designer-notice`) !== null;
			new MutationObserver(() => {
				const now = document.querySelector(`${host} .rp-designer-notice`) !== null;
				if (now !== shown) log.notice.push([now, Date.now()]);
				shown = now;
			}).observe(document.body, { childList: true, subtree: true });
		},
		vaultSidecar(assetId),
		ACTIVE_DESIGNER,
	);

/**
 * An edit outside Obsidian, reaching the plugin the way the sibling cases take it: the host's own
 * reconcile when it comes within `patience`, the watcher's call made by hand when it does not. What
 * this returns separates the two halves: `hostMs` is how long the HOST took to raise `modify` (null
 * when it never did — data, not a verdict), and `pluginMs` is how long the PLUGIN took from that
 * `modify` to the stale notice reaching `shown`.
 */
export const noticeAfterEdit = async (
	designer: DesignerPage,
	browser: NativeBrowser,
	assetId: string,
	edit: (text: string) => string,
	shown: boolean,
	patience = 5000,
): Promise<{ hostMs: number | null; pluginMs: number }> => {
	const seen = (await hostLog(browser)).modify.length;
	const edited = Date.now();
	designer.editSidecar(assetId, edit);
	const unprompted = await browser
		.waitUntil(async () => (await hostLog(browser)).modify.length > seen, { timeout: patience })
		.then(() => true, () => false);
	if (!unprompted) await designer.reconcile(vaultSidecar(assetId));
	let answer: { hostMs: number | null; pluginMs: number } | null = null;
	await expect
		.poll(async () => {
			const log = await hostLog(browser);
			const modified = log.modify[seen];
			const changed = log.notice.find(([state, at]) => state === shown && modified !== undefined && at >= modified);
			if (modified !== undefined && changed) answer = { hostMs: unprompted ? modified - edited : null, pluginMs: changed[1] - modified };
			return answer !== null;
		})
		.toBe(true);
	if (answer === null) throw new Error('The notice never changed.');
	return answer;
};

import { expect } from 'vitest';
import type { NativeBrowser } from './session';
import type { DesignerPage, Sidecar } from './designer';
import { createCanvasPage } from './designerCanvas';

export interface ScreenBox { x: number; y: number; width: number; height: number }
export interface Extent { minX: number; maxX: number; minY: number; maxY: number; width: number; depth: number }

/** The world extent of an outline's VERTICES — a curve bowing past them is not in it. */
export function extentOf(points: readonly number[][]): Extent {
	const xs = points.map((point) => point[0]);
	const ys = points.map((point) => point[1]);
	const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	return { minX, maxX, minY, maxY, width: maxX - minX, depth: maxY - minY };
}

/** One part's outline as the sidecar on disk stores it, by the key its Parts row carries. */
export function outlineOn(sidecar: Sidecar, key: string): number[][] {
	const shape = sidecar.shape;
	if (!shape) throw new Error('The sidecar has no shape.');
	if (key === 'footprint') return shape.footprint.points;
	if (key === 'clearance') {
		if (!shape.clearance) throw new Error('The sidecar has no clearance.');
		return shape.clearance.points;
	}
	const detail = shape.details.find((candidate) => `detail:${candidate.id}` === key);
	if (!detail) throw new Error(`No detail ${key} on disk.`);
	return detail.outline.points;
}

/** An outline moved so its extent starts at the origin, so two outlines compare by SHAPE alone. */
export function normalised(points: readonly number[][]): number[][] {
	const { minX, minY } = extentOf(points);
	return points.map(([x, y]) => [x - minX, y - minY]);
}

/**
 * The follow-up rounds' gestures on top of `createDesignerPage`: handles and labels read as SCREEN
 * boxes through Konva's own stage registry and the overlay's DOM, a handle dragged by one pointer
 * chain, the View menu's toggle, the window's own size and the history chords.
 */
export function createFollowupsPage(browser: NativeBrowser, designer: DesignerPage) {
	/** Every Konva node named `name` on the ACTIVE designer's stage, as a viewport box around its centre. */
	const konvaPage = createCanvasPage(browser, designer);
	const nodes = async (name: string): Promise<ScreenBox[]> =>
		(await konvaPage.shapeBoxes(name)).map((box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height }));

	/** Box handle `index`, clockwise from the top-left (`boxHandlePoint`'s order): 1 top-middle, 3 right-middle, 4 bottom-right. */
	const handle = async (index: number): Promise<ScreenBox> => {
		const all = await nodes('asset-selection-handle');
		const found = all[index];
		if (!found) throw new Error(`No box handle ${String(index)} is drawn (${String(all.length)} are).`);
		return found;
	};

	/** One press, a travel and a release, in ONE chain — a second chain starts a fresh pointer at (0, 0). */
	const dragPoint = (from: { x: number; y: number }, to: { x: number; y: number }) =>
		browser
			.action('pointer')
			.move({ x: Math.round(from.x), y: Math.round(from.y), origin: 'viewport' })
			.down()
			.move({ x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2), duration: 150, origin: 'viewport' })
			.move({ x: Math.round(to.x), y: Math.round(to.y), duration: 150, origin: 'viewport' })
			.pause(150)
			.up()
			.perform();

	/** A box handle dragged by a screen offset, waited for on disk; answers where the pointer was released. */
	const dragHandle = async (assetId: string, index: number, dx: number, dy = 0): Promise<{ x: number; y: number }> => {
		const before = designer.readSidecar(assetId).revision;
		const from = await handle(index);
		const to = { x: Math.round(from.x + dx), y: Math.round(from.y + dy) };
		await dragPoint(from, to);
		await expect.poll(() => designer.readSidecar(assetId).revision).toBe(before + 1);
		return to;
	};

	/** A tool by its accessible name, on the toolbar or among the Add rail's shape tiles. */
	const tool = (label: string) => designer.designer().$(`button[aria-label="${label}"]`).click();

	/** The View menu's `All dimensions`, set to `on` and the menu closed again. */
	const allDimensions = async (on: boolean): Promise<void> => {
		const menu = designer.designer().$('.rp-view-menu');
		await menu.$('summary').click();
		const box = menu.$('input[data-rp-view="all-dimensions"]');
		// By KEYBOARD: at a 1280 window the open menu reaches left past the leaf and the file
		// explorer takes a pointer's click there (measured), so a pointer cannot tick it.
		if ((await box.isSelected()) !== on) {
			await browser.execute((input: HTMLElement) => {
				input.focus();
			}, await box.getElement());
			await browser.keys('Space');
		}
		await expect.poll(() => box.isSelected()).toBe(on);
		await browser.keys('Escape');
	};

	/** Every dimension label the active designer draws, by name. */
	const dimensionNames = (): Promise<string[]> =>
		browser.execute(() =>
			[...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active [data-rp-dimension]')].map((label) => label.dataset.rpDimension ?? ''),
		);
	const dimension = (name: string) => designer.designer().$(`[data-rp-dimension="${name}"]`);

	/** Open a figure's inline field — by a click, or by focusing its button and pressing Enter — type a number and commit it. */
	const typeFigure = async (name: string, value: number, open: 'click' | 'keyboard' = 'click'): Promise<void> => {
		if (open === 'click') await dimension(name).click();
		else {
			await browser.execute((button: HTMLElement) => {
				button.focus();
			}, await dimension(name).getElement());
			await browser.keys('Enter');
		}
		const field = designer.designer().$(`.rp-designer-dimension__form input[name="${name}"]`);
		await expect.poll(() => field.isFocused()).toBe(true);
		await field.setValue(String(value));
		await browser.keys('Enter');
		await expect.poll(() => field.isExisting()).toBe(false);
	};

	/** Type into an Inspector number field and commit it the way a user does, with Enter. */
	const typeField = async (name: string, value: number): Promise<void> => {
		const field = designer.inspectorField(name);
		await field.click();
		await field.setValue(String(value));
		await browser.keys('Enter');
	};

	/** An Inspector number field's value as a number. */
	const fieldNumber = async (name: string): Promise<number> => Number(await designer.inspectorField(name).getValue());

	/** The active designer canvas's viewport box. */
	const canvasBox = (): Promise<DOMRect> =>
		browser.execute(() => {
			const canvas = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"] .rp-plan-canvas');
			if (!canvas) throw new Error('No designer canvas.');
			return canvas.getBoundingClientRect().toJSON() as DOMRect;
		});

	/** The Obsidian window's own size, through Electron — WebDriver's `window/rect` is refused by this host. */
	const setWindowSize = async (width: number, height: number): Promise<void> => {
		await browser.executeObsidian(({ require: load }, w, h) => {
			const electron = (load as (id: string) => { remote: { getCurrentWindow(): { setSize(a: number, b: number): void } } })('electron');
			electron.remote.getCurrentWindow().setSize(w, h);
		}, width, height);
		// Until the canvas has stopped moving: the stage resizes a frame or more after the window does,
		// and a handle read before then is somewhere the next press will not find it.
		let last = '';
		await expect
			.poll(async () => {
				await browser.pause(250);
				const now = JSON.stringify(await canvasBox());
				const settled = now === last;
				last = now;
				return settled;
			})
			.toBe(true);
	};

	return { nodes, handle, dragPoint, dragHandle, tool, allDimensions, dimensionNames, dimension, typeFigure, typeField, fieldNumber, setWindowSize, canvasBox };
}

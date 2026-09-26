import { expect } from 'vitest';
import type { NativeBrowser } from './session';
import { createDesignerPage, type DesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';

/** A designer on a newly created asset, and the canvas page over it. */
export async function newDesign(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string) {
	const designer = createDesignerPage(browser, page, ui);
	const canvas = createCanvasPage(browser, designer);
	return { designer, canvas, assetId: await designer.createAsset(name) };
}

/** The ACTIVE designer leaf's content, the one a user is looking at. */
const ACTIVE = '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]';

export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}
/** One dimension button as drawn: its figure name, its text, and where it paints. */
interface Label {
	name: string;
	text: string;
	box: Box;
}

/** What the page showed part-way through a held drag: the dimension labels, and the top ruler's band. */
interface Snapshot {
	labels: { name: string; text: string }[];
	band: number | null;
}

/** Whether two boxes share any area at all — a touching edge is not a share. */
export const overlaps = (one: Box, other: Box): boolean =>
	one.left < other.left + other.width && other.left < one.left + one.width && one.top < other.top + other.height && other.top < one.top + one.height;

/** A coordinate kept 10 px inside the span `[low, high]`. */
const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low + 10), high - 10);

export const centreOf =(box: Box): { x: number; y: number } => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/**
 * The designer's canvas as geometry: where its Konva shapes and its DOM overlay land on screen,
 * pointer clicks at a fraction of it, and the leaf narrowed the way a user drags a sidebar's edge.
 * Every reading is taken from the ACTIVE leaf, so a second designer never answers for the first.
 */
export function createCanvasPage(browser: NativeBrowser, designer: DesignerPage) {
	const canvasBox = (): Promise<Box> =>
		browser.execute((sel) => {
			const canvas = document.querySelector(`${sel} .rp-plan-canvas`);
			if (!canvas) throw new Error('No designer canvas.');
			return canvas.getBoundingClientRect().toJSON() as Box;
		}, ACTIVE);

	const clickAt = (x: number, y: number) =>
		browser.action('pointer').move({ x: Math.round(x), y: Math.round(y), origin: 'viewport' }).down().up().perform();

	const clickCanvas = async (fx: number, fy: number): Promise<void> => {
		const c = await canvasBox();
		await clickAt(c.left + c.width * fx, c.top + c.height * fy);
	};

	/** A toolbar button by its accessible name — every one is icon-only. */
	const tool = (label: string) => designer.designer().$(`.rp-designer-tools [aria-label="${label}"]`).click();

	/** A closed outline, clicked a beat apart at canvas fractions and closed on its first point. */
	const trace = async (label: string, points: readonly (readonly [number, number])[]): Promise<void> => {
		await tool(label);
		for (const [fx, fy] of [...points, points[0]]) {
			await clickCanvas(fx, fy);
			await browser.pause(300);
		}
	};

	/** Every dimension button in the active leaf, in DOM order. */
	const labels = (): Promise<Label[]> =>
		browser.execute(
			(sel) =>
				[...document.querySelectorAll(`${sel} [data-rp-dimension]`)].map((button) => ({
					name: button.getAttribute('data-rp-dimension') ?? '',
					text: button.textContent?.trim() ?? '',
					box: button.getBoundingClientRect().toJSON() as Box,
				})),
			ACTIVE,
		);
	const label = async (name: string): Promise<Label> => {
		const found = (await labels()).find((candidate) => candidate.name === name);
		if (!found) throw new Error(`No dimension label ${name}.`);
		return found;
	};

	/** The on-screen boxes of every Konva shape carrying `name` on the active designer's stage. */
	const shapeBoxes = (name: string): Promise<Box[]> =>
		browser.execute(
			(sel, wanted) => {
				const konva = (window as unknown as { Konva: { stages: { find(s: string): { getClientRect(): { x: number; y: number; width: number; height: number } }[]; container(): HTMLElement }[] } }).Konva;
				const host = document.querySelector(sel);
				const stage = konva.stages.find((candidate) => host?.contains(candidate.container()));
				if (!stage) return [];
				const c = stage.container().getBoundingClientRect();
				return stage.find(`.${wanted}`).map((shape) => {
					const r = shape.getClientRect();
					return { left: c.left + r.x, top: c.top + r.y, width: r.width, height: r.height };
				});
			},
			ACTIVE,
			name,
		);

	/** One row of the View menu, ticked or unticked by a click, and the menu closed again. */
	const viewToggle = async (key: string): Promise<void> => {
		const menu = designer.designer().$('.rp-view-menu');
		await menu.$('summary').click();
		await menu.$(`input[data-rp-view="${key}"]`).click();
		await menu.$('summary').click();
	};
	const viewTicked = async (key: string): Promise<boolean> => {
		const menu = designer.designer().$('.rp-view-menu');
		await menu.$('summary').click();
		const ticked = await menu.$(`input[data-rp-view="${key}"]`).isSelected();
		await menu.$('summary').click();
		return ticked;
	};

	/**
	 * The active leaf narrowed to `width` px by widening the LEFT sidebar — what dragging its edge
	 * does. The window itself cannot be resized: Obsidian's Chromedriver refuses `window/rect`.
	 */
	const leafWidth = async (width: number): Promise<number> => {
		await browser.executeObsidian(({ app }, sel, wanted) => {
			const leaf = document.querySelector(sel);
			const split = app.workspace.leftSplit as unknown as { size: number; setSize(n: number): void; expand(): void };
			if (!leaf) throw new Error('No active designer leaf.');
			split.expand();
			split.setSize(split.size + leaf.getBoundingClientRect().width - wanted);
		}, ACTIVE, width);
		let measured = 0;
		await expect
			.poll(async () => {
				measured = await browser.execute((sel) => document.querySelector(sel)?.getBoundingClientRect().width ?? 0, ACTIVE);
				return Math.abs(measured - width);
			})
			.toBeLessThan(2);
		// One frame for the canvas's own ResizeObserver to hand the stage its new size.
		await browser.pause(300);
		return measured;
	};

	/** The toolbar's zoom readout, whole percent. */
	const zoom = async (): Promise<number> => Number.parseInt(await designer.designer().$('.rp-designer-zoom output').getText(), 10);
	/** One press of a zoom cluster button — `zoom-in`, `zoom-out` or `zoom-fit` — `times` over. */
	const zoomBy = async (button: 'zoom-in' | 'zoom-out' | 'zoom-fit', times = 1): Promise<void> => {
		for (let press = 0; press < times; press += 1) {
			await designer.designer().$(`[data-rp-view="${button}"]`).click();
			await browser.pause(120);
		}
	};

	/**
	 * A drag held in ONE action chain — pressed at `(x, y)`, moved by `(dx, dy)`, held, and released
	 * where it was held — with the dimension labels and the ruler extents read by an in-page timer
	 * part-way through the hold. WebDriver serialises its commands, so a read issued from here during
	 * a chain runs after it; and a release sent as a chain of its own starts a fresh pointer at
	 * (0, 0), which drags the part to the viewport's corner before letting go (measured).
	 */
	const holdSnapshot = async (x: number, y: number, dx: number, dy = 0): Promise<Snapshot> => {
		await browser.execute((sel) => {
			const store = window as unknown as { rpHeld?: unknown };
			store.rpHeld = null;
			setTimeout(() => {
				const leaf = document.querySelector(sel);
				store.rpHeld = {
					labels: [...(leaf?.querySelectorAll('[data-rp-dimension]') ?? [])].map((button) => ({ name: button.getAttribute('data-rp-dimension') ?? '', text: button.textContent?.trim() ?? '' })),
					band: (leaf?.querySelector('.rp-designer-ruler--top .rp-designer-ruler__extent')?.getBoundingClientRect().left) ?? null,
				};
			}, 900);
		}, ACTIVE);
		await browser
			.action('pointer')
			.move({ x: Math.round(x), y: Math.round(y), origin: 'viewport' })
			.down()
			.move({ x: Math.round(x + dx), y: Math.round(y + dy), duration: 200, origin: 'viewport' })
			.pause(1500)
			.up()
			.perform();
		const held = await browser.execute(() => (window as unknown as { rpHeld: Snapshot | null }).rpHeld);
		if (!held) throw new Error('The in-page read never ran during the hold.');
		return held;
	};

	/**
	 * A real camera drag with the Pan tool, then back to Select. It starts half the travel back
	 * from the canvas's centre, clamped inside the canvas, so both ends stay on screen.
	 */
	const pan = async (dx: number, dy: number): Promise<void> => {
		await tool('Pan');
		const c = await canvasBox();
		const x = Math.round(clamp(c.left + c.width / 2 - dx / 2, c.left, c.left + c.width));
		const y = Math.round(clamp(c.top + c.height / 2 - dy / 2, c.top, c.top + c.height));
		await browser
			.action('pointer')
			.move({ x, y, origin: 'viewport' })
			.down()
			.move({ x: x + Math.round(dx), y: y + Math.round(dy), duration: 300, origin: 'viewport' })
			.up()
			.perform();
		await tool('Select');
	};

	/**
	 * The background sheet as DRAWN, or `null` before it has loaded (a caller polls).
	 *
	 * The node is the `Image` on the `asset-background` layer (`BACKGROUND_LAYER`). Each `[fx, fy]`
	 * fraction of the unmirrored raster is placed from that node's own box (`x`, `y`, `width`,
	 * `height`) through its LAYER's absolute transform — never the node's own, which a flip of the
	 * node would carry along; the node's own rotation and crop are ignored, and a sheet with neither
	 * (step 7's) is what this reads. Each sample carries the mean RGBA of a 3×3 patch of the layer's
	 * canvas and its point on SCREEN (the canvas box plus the transformed point), because the layer
	 * transform includes the camera and the stage, so a flip THERE would carry the samples along
	 * too — only the screen order of two samples can see it. What neither can see is a CSS
	 * transform on the canvas or an ancestor, which moves pixels without moving the box:
	 * `cssMirrors` names every element in that chain whose computed transform mirrors an axis.
	 * `size` is the node's box in WORLD units, which the calibration decides and the camera does not.
	 */
	const drawnSheet = (fractions: readonly (readonly [number, number])[]) =>
		browser.execute(
			(sel, wanted) => {
				type Node = { x(): number; y(): number; width(): number; height(): number; name(): string; find(s: string): Node[] };
				type Layer = Node & { getAbsoluteTransform(): { point(p: { x: number; y: number }): { x: number; y: number } }; getCanvas(): { getPixelRatio(): number }; getNativeCanvasElement(): HTMLCanvasElement };
				const konva = (window as unknown as { Konva: { stages: { find(s: string): Layer[]; container(): HTMLElement }[] } }).Konva;
				const host = document.querySelector(sel);
				const layer = konva.stages.find((stage) => host?.contains(stage.container()))?.find('Layer').find((candidate) => candidate.name() === 'asset-background');
				const image = layer?.find('Image')[0];
				if (!layer || !image) return null;
				const ratio = layer.getCanvas().getPixelRatio();
				const canvas = layer.getNativeCanvasElement();
				const context = canvas.getContext('2d');
				if (!context) throw new Error('No sheet context.');
				const box = canvas.getBoundingClientRect();
				const cssMirrors: string[] = [];
				for (let el: Element | null = canvas; el; el = el.parentElement) {
					const transform = getComputedStyle(el).transform;
					const matrix = transform === 'none' ? null : new DOMMatrix(transform);
					if (matrix && (matrix.a < 0 || matrix.d < 0)) cssMirrors.push(`${el.tagName}.${el.className}:${transform}`);
				}
				const samples = wanted.map(([fx, fy]) => {
					const at = layer.getAbsoluteTransform().point({ x: image.x() + image.width() * fx, y: image.y() + image.height() * fy });
					const [px, py] = [Math.round(at.x * ratio), Math.round(at.y * ratio)];
					const data = context.getImageData(px - 1, py - 1, 3, 3).data;
					const rgba = [0, 1, 2, 3].map((channel) => Math.round(data.filter((_, index) => index % 4 === channel).reduce((sum, value) => sum + value, 0) / 9));
					return { inside: px > 0 && py > 0 && px < canvas.width - 1 && py < canvas.height - 1, rgba, screen: { x: box.left + at.x, y: box.top + at.y } };
				});
				return { size: { width: image.width(), height: image.height() }, cssMirrors, samples };
			},
			ACTIVE,
			fractions,
		);

	return { canvasBox, clickAt, clickCanvas, tool, trace, labels, label, shapeBoxes, viewToggle, viewTicked, leafWidth, zoom, zoomBy, holdSnapshot, pan, drawnSheet };
}

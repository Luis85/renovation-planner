import { expect } from 'vitest';
import type { DesignerPage } from './designer';
import type { NativeBrowser } from './session';

/** What the n-th designer's Konva stage is drawing right now, read through Konva's own registry. */
interface StageProbe {
	/** The clearance layer's `visible` — what `Show clearance` binds. */
	clearanceVisible: boolean;
	/** The clearance outline's box on screen, measured whether or not its layer is visible. */
	clearanceBox: { x: number; y: number; width: number; height: number } | null;
	/** How many shapes the selection layer draws — the outline, its handles, its rotate stem. */
	selectionShapes: number;
	/** The background layer's drawn raster, by its natural size; `null` when nothing is drawn. */
	backgroundImage: { width: number; height: number } | null;
	/** The camera, as the footprint layer's own transform. */
	camera: number[];
}

/**
 * Four corners `half` of the canvas either side of a centre, as fractions of it. The default centre
 * is the middle of the reference sheet as an opened asset frames it — its upper right.
 */
export const square = (half: number, cx = 0.55, cy = 0.22): [number, number][] => [
	[cx - half, cy - half],
	[cx + half, cy - half],
	[cx + half, cy + half],
	[cx - half, cy + half],
];

/**
 * The asset designer's reference and clearance surfaces, over `createDesignerPage`: the Inspector's
 * two tabs read by SECTION rather than by the first `dl` that matches — the Object tab's Source &
 * scale block uses the same class the Reference tab does, and comes first in the DOM.
 */
export function createClearancePage(browser: NativeBrowser, designer: DesignerPage) {
	const leafEl = () => designer.designer();

	const probe = (leafIndex = 0): Promise<StageProbe> =>
		browser.execute((which) => {
			interface Node {
				visible(): boolean;
				getClientRect(options?: { skipTransform?: boolean }): { x: number; y: number; width: number; height: number };
				getChildren(): Node[];
				find(selector: string): Node[];
				getAbsoluteTransform(): { m: number[] };
				image?(): { width: number; height: number } | undefined;
			}
			interface Stage { container(): HTMLElement; findOne(selector: string): Node | undefined }
			const konva = (window as unknown as { Konva: { stages: Stage[] } }).Konva;
			const host = document.querySelectorAll('.workspace-leaf-content[data-type="renovation-asset-designer"]')[which];
			const stage = konva.stages.find((each) => host?.contains(each.container()));
			if (!stage) throw new Error('No designer stage.');
			const c = stage.container().getBoundingClientRect();
			const clearance = stage.findOne('.asset-clearance');
			const outline = clearance?.getChildren()[0];
			const box = outline ? outline.getClientRect() : null;
			const image = stage.findOne('.asset-background')?.find('Image')[0]?.image?.();
			return {
				clearanceVisible: clearance?.visible() ?? false,
				clearanceBox: box ? { x: c.left + box.x, y: c.top + box.y, width: box.width, height: box.height } : null,
				selectionShapes: stage.findOne('.asset-selection')?.find('Shape').length ?? 0,
				backgroundImage: image ? { width: image.width, height: image.height } : null,
				camera: stage.findOne('.asset-footprint')?.getAbsoluteTransform().m ?? [],
			};
		}, leafIndex);

	/** The Inspector's `Show clearance` switch, drawn only while the design has a clearance. */
	const showSwitch = () => leafEl().$('input[name="show-clearance"]');
	const switchOn = () => showSwitch().isSelected();
	const setSwitch = async (on: boolean): Promise<void> => {
		if ((await showSwitch().isSelected()) !== on) await showSwitch().click();
		await expect.poll(switchOn).toBe(on);
	};

	const tool = (label: string) => leafEl().$(`.rp-designer-tools [aria-label="${label}"]`);
	const toolActive = async (label: string): Promise<boolean> => (await tool(label).getAttribute('aria-pressed')) === 'true';

	const { canvasPoint } = designer;
	const clickAt = async (point: { x: number; y: number }, button: 0 | 2 = 0): Promise<void> => {
		await browser.action('pointer').move({ ...point, origin: 'viewport' }).down({ button }).up({ button }).perform();
	};

	/**
	 * A polygon traced with the given tool, one click a beat apart, closed by clicking its first
	 * corner again — Enter finishes no trace tool (`finishesOnEnter` names none of the designer's).
	 */
	const trace = async (label: string, corners: [number, number][]): Promise<void> => {
		await tool(label).click();
		for (const [fx, fy] of [...corners, corners[0] ?? [0.5, 0.5]]) {
			await clickAt(await canvasPoint(fx, fy));
			await browser.pause(300);
		}
	};

	/** A row's value inside one Inspector section, by the section's class and the row's label. */
	const row = (section: string, label: string) =>
		leafEl().$(`.${section} .rp-designer-reference-fields`).$(`.//*[normalize-space(.)="${label}"]/following-sibling::*[1]`);
	const referenceRow = (label: string) => row('rp-designer-reference', label);
	const sourceRow = (label: string) => row('rp-designer-source', label);
	const pendingLines = () => leafEl().$$('.rp-designer-reference .rp-designer-unscaled').map((line) => line.getText());

	const objectTab = () => leafEl().$('.rp-designer-tab[data-rp-tab="object"]').click();
	const menu = () => leafEl().$('.rp-canvas-context-menu');
	const rulerBands = () => leafEl().$$('.rp-designer-ruler__extent').length;
	const inspectorDelete = () => leafEl().$('.rp-designer-inspector button[name="delete"]');
	const confirmDialog = async (): Promise<void> => {
		const confirm = browser.$('.rp-dialog [data-rp-action="confirm"]');
		await expect.poll(() => confirm.isDisplayed()).toBe(true);
		await confirm.click();
	};

	/** The sidecar's shape as raw JSON: the anchor, the facing and every pending flag. */
	const shapeOnDisk = (assetId: string) => designer.readSidecar(assetId).shape as unknown as Record<string, unknown> & {
		anchor: { x: number; y: number };
		clearance: { points: number[][] } | null;
		footprintOrigin: string;
	};

	return {
		probe,
		showSwitch,
		switchOn,
		setSwitch,
		tool,
		toolActive,
		canvasPoint,
		clickAt,
		trace,
		referenceRow,
		sourceRow,
		pendingLines,
		objectTab,
		menu,
		rulerBands,
		inspectorDelete,
		confirmDialog,
		shapeOnDisk,
	};
}

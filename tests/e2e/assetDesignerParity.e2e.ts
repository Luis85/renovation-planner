import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { createParityPage, type Camera } from './designerParity';
import { mobileEmulation } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the parity round (AD18-R16) — the header's library door,
 * the Add rail, the zoom cluster, the legend and its scale bar, the asset card and the save
 * indicator — driven in a real Obsidian at the default width AND at a leaf resized through the
 * host window, since every narrow rule here is a container query no other tier renders. The menus
 * and chords are `assetDesignerParityMenu.e2e.ts`; the corner radius is `assetDesignerParityRadius.e2e.ts`.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The world point under the canvas centre: what a zoom about the centre leaves where it was. */
const underCentre = (c: Camera) => ({ x: (c.centre.x - c.x) / c.scale, y: (c.centre.y - c.y) / c.scale });

describe('Design an Asset, the parity round, in the real Obsidian host', () => {
	// Steps 72, 77, 78, 79 and 80.
	desktop('labels the library door and zooms in 25% steps about the centre, with Fit returning the opening camera', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createAsset('Parity toilet');
		await designer.applyPreset('toilet');
		// Reopened, so the camera read below is the one the designer OPENS with (step 79).
		await parity.closeDesigner();
		await designer.openDesignerFor('Parity toilet');
		const view = designer.designer();

		// Step 72: the door's words and its arrow-left icon.
		const back = view.$('.rp-designer-open-library');
		expect(await back.getText()).toBe('Back to library');
		expect(await back.$('svg').getAttribute('class')).toContain('lucide-arrow-left');

		// Step 77: a named Zoom group after the history pair and before the View menu.
		const toolbarOrder = await browser.execute(
			(el: HTMLElement) => [...el.children].map((child) => child.className.split(' ')[0]),
			await view.$('.rp-designer-tools').getElement(),
		);
		expect(toolbarOrder.slice(-3)).toEqual(['rp-designer-history', 'rp-designer-zoom', 'rp-view-menu']);
		const zoomGroup = view.$('.rp-designer-zoom');
		expect(await zoomGroup.getAttribute('role')).toBe('group');
		expect(await zoomGroup.getAttribute('aria-label')).toBe('Zoom');
		const cluster = await browser.execute(
			(el: HTMLElement) => [...el.children].map((child) => `${child.getAttribute('aria-label')}:${child.querySelector('svg')?.getAttribute('class')?.match(/lucide-[\w-]+/u)?.[0] ?? 'text'}`),
			await zoomGroup.getElement(),
		);
		expect(cluster).toEqual(['Zoom out:lucide-zoom-out', 'Zoom:text', 'Zoom in:lucide-zoom-in', 'Fit design:lucide-maximize']);

		// Step 78: 25% steps about the canvas centre — the world point under it does not move.
		const readout = async () => Number.parseInt((await zoomGroup.$('output').getText()).replace('%', ''), 10);
		const opening = await parity.camera();
		const openingPercent = await readout();
		const zoomIn = zoomGroup.$('[data-rp-view="zoom-in"]');
		for (const step of [1, 2, 3]) {
			await zoomIn.click();
			await expect.poll(async () => (await parity.camera()).scale / opening.scale).toBeCloseTo(1.25 ** step, 5);
			expect(Math.abs((await readout()) - openingPercent * 1.25 ** step)).toBeLessThanOrEqual(1);
		}
		await zoomGroup.$('[data-rp-view="zoom-out"]').click();
		await expect.poll(async () => (await parity.camera()).scale / opening.scale).toBeCloseTo(1.25 ** 2, 5);
		const zoomed = await parity.camera();
		expect(underCentre(zoomed).x).toBeCloseTo(underCentre(opening).x, 3);
		expect(underCentre(zoomed).y).toBeCloseTo(underCentre(opening).y, 3);
		expect(Math.abs((await readout()) - openingPercent * 1.25 ** 2)).toBeLessThanOrEqual(1);

		// Step 79: Fit is the opening camera, exactly, and the readout follows it.
		await zoomGroup.$('[data-rp-view="zoom-fit"]').click();
		await expect.poll(readout).toBe(openingPercent);
		const fitted = await parity.camera();
		expect(fitted.scale).toBeCloseTo(opening.scale, 6);
		expect(fitted.x).toBeCloseTo(opening.x, 3);
		expect(fitted.y).toBeCloseTo(opening.y, 3);

		// Step 80: the status bar states no percentage.
		expect(await view.$('.rp-designer-status').getText()).not.toMatch(/\d\s*%/u);
	});

	// Steps 73, 74, 75 and 76.
	desktop('draws the Add rail as labelled tiles and clips the library label at a sidebar width', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createToilet('Railed toilet');
		const view = designer.designer();
		const rail = view.$('.rp-designer-add');
		const railOrder = await browser.execute(
			(el: HTMLElement) => [...el.children].map((child) => `${child.tagName.toLowerCase()}:${child.textContent?.trim() ?? ''}`),
			await rail.getElement(),
		);
		expect(railOrder.slice(0, 3)).toEqual(['h2:Add', 'button:Start from preset', 'h3:Basic shapes']);
		const tiles = async () =>
			browser.execute((el: HTMLElement) => {
				return [...el.querySelectorAll<HTMLElement>('.rp-designer-add-shapes .rp-designer-tool-button')].map((tile) => {
					const icon = (tile.querySelector('svg') as SVGElement).getBoundingClientRect();
					const label = tile.querySelector('.rp-designer-tool-label') as HTMLElement;
					return { name: tile.getAttribute('aria-label'), text: label.textContent?.trim(), left: Math.round(tile.getBoundingClientRect().left), iconAbove: icon.bottom <= label.getBoundingClientRect().top + 1 };
				});
			}, await rail.getElement());
		const columns = async () => new Set((await tiles()).map((tile) => tile.left)).size;

		// Step 76, and a finding: Obsidian's DEFAULT 1024 px window gives this leaf 679 px and the
		// rail 120 px — already under 9rem, so the tiles are ONE column before anything is narrowed.
		expect(await parity.leafWidth()).toBe(679);
		expect(await rail.getSize('width')).toBeLessThan(144);
		expect(await columns()).toBe(1);

		// Steps 74 and 75, at a leaf wide enough for the rail to reach 9rem.
		await parity.setLeafWidth(1100);
		expect(await rail.getSize('width')).toBeGreaterThanOrEqual(144);
		const wide = await tiles();
		expect(wide.map((tile) => tile.text)).toEqual(['Rectangle', 'Rounded rectangle', 'Circle', 'Line']);
		expect(wide.map((tile) => tile.name)).toEqual(['Draw rectangle', 'Draw rounded rectangle', 'Draw circle', 'Draw line']);
		expect(wide.every((tile) => tile.iconAbove)).toBe(true);
		expect(await columns()).toBe(2);

		// Step 73: below a sidebar width the label is CLIPPED, and the name survives it.
		const back = view.$('.rp-designer-open-library');
		await parity.setLeafWidth(460);
		const label = await browser.execute((el: HTMLElement) => {
			const text = el.querySelector('.rp-designer-open-library-label') as HTMLElement;
			return {
				width: text.getBoundingClientRect().width,
				rendered: text.getClientRects().length > 0,
				text: text.textContent,
				icon: (el.querySelector('svg') as SVGElement).getBoundingClientRect().width,
			};
		}, await back.getElement());
		// Clipped to a 1 px box, and still RENDERED — `display: none` would have no box at all.
		expect(label).toMatchObject({ text: 'Back to library', rendered: true });
		expect(label.width).toBeLessThanOrEqual(1);
		expect(label.icon).toBeGreaterThan(8);
		expect(await back.getAttribute('aria-label')).toBe('Back to library');
		// A finding, pinned: below 35rem the rail stacks at the leaf's full width, so the grid is TWO
		// columns again — step 76's "very narrow" is a band between two breakpoints, not an end state.
		expect(await columns()).toBe(2);
	});

	// Steps 81, 82, 83, 84 and 85.
	desktop('lists the legend rows the design has, keeps the scale bar outside the toggle, and forgets the toggle on reopen', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		const view = () => designer.designer();
		const legend = () => view().$('.rp-designer-legend');
		const scaleBar = () => view().$('.rp-designer-scale-bar');

		// Step 82 first: Asset Z, a typed footprint and nothing else.
		await designer.createAsset('Typed box');
		await designer.editDimensions(600, 400);
		await expect.poll(parity.legendRows).toEqual(['footprint:Footprint', 'placement:Placement point (centre)', 'facing:Front direction']);
		expect(await scaleBar().isDisplayed()).toBe(true);
		await parity.closeDesigner();

		// Step 81: a rectangle with a uniform 300 mm clearance and one drawn detail — the one shape
		// whose Clearance row can carry a figure (`uniformSetback` refuses a curved footprint).
		const assetId = await designer.createAsset('Legend box');
		await designer.editDimensions(800, 600);
		await parity.settle(assetId, 1);
		await parity.generateClearance(300);
		await parity.settle(assetId, 2);
		await parity.drawBox('Draw rectangle', [0.45, 0.45], [0.55, 0.55]);
		await parity.settle(assetId, 3);
		await expect.poll(parity.legendRows).toEqual([
			'clearance:Clearance (300 mm)',
			'footprint:Footprint',
			'details:Details',
			'placement:Placement point (centre)',
			'facing:Front direction',
		]);
		const bar = await parity.scaleBarText();
		expect(bar).toMatch(/^0 (\d+) (\d+) mm$/u);
		const [, middle, end] = /^0 (\d+) (\d+) mm$/u.exec(bar) ?? [];
		expect(Number(end)).toBe(2 * Number(middle));

		// Step 83: View ▸ Legend hides the rows and leaves the scale bar.
		await view().$('.rp-view-menu summary').click();
		await view().$('input[data-rp-view="legend"]').click();
		await expect.poll(() => legend().isExisting()).toBe(false);
		expect(await scaleBar().isDisplayed()).toBe(true);

		// Step 84: default ON and not persisted.
		await parity.closeDesigner();
		await designer.openDesignerFor('Legend box');
		await expect.poll(() => legend().isDisplayed()).toBe(true);
		await view().$('.rp-view-menu summary').click();
		expect(await view().$('input[data-rp-view="legend"]').isSelected()).toBe(true);
		await browser.keys('Escape');

		// Step 85: below a sidebar width the legend goes and the scale bar stays, inside the canvas.
		await parity.setLeafWidth(460);
		await expect.poll(() => legend().isDisplayed()).toBe(false);
		expect(await scaleBar().isDisplayed()).toBe(true);
		const canvas = await view().$('.rp-plan-canvas').getSize('width');
		expect(await scaleBar().getSize('width')).toBeLessThanOrEqual(canvas);
	});

	// Step 85a.
	desktop("reads the Clearance row from the drag's preview, before the release writes anything", async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		const assetId = await designer.createAsset('Dragged clearance');
		await designer.editDimensions(800, 600);
		await parity.generateClearance(300);
		await parity.settle(assetId, 2);
		await designer.selectPart('clearance');
		await expect.poll(parity.legendRows).toContain('clearance:Clearance (300 mm)');

		// The right-middle box handle, held 40 px outward: one side's setback grows, so the
		// boundary stops being uniform and the row must stop claiming its figure WHILE held.
		const from = await parity.handle('right');
		const held = await parity.sampleMidDrag(from, { x: from.x + 40, y: from.y }, parity.sidecarFile(assetId));
		expect(held.revision).toBe(2);
		expect(held.legend[0]).toBe('Clearance');
		await parity.settle(assetId, 3);
		expect((await parity.legendRows())[0]).toBe('clearance:Clearance');
	});

	// Steps 86, 87 and 88.
	desktop('orders Height beside Dimensions and draws the asset card with a visible thumbnail, or none for a shapeless asset', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		const panel = () => designer.designer().$('.rp-designer-tabpanel');

		// Step 88 first: Asset W, no shape at all — the chip and no thumbnail.
		await designer.createAsset('Shapeless W');
		// The New asset form's default category, which the chip names: Material.
		await expect.poll(() => panel().$('.rp-designer-asset-category').getText()).toBe('Material');
		expect(Object.values(await ui.notesOfType('renovation-asset'))[0]).toMatchObject({ category: 'material' });
		expect(await panel().$('.rp-designer-asset-thumbnail').isExisting()).toBe(false);
		await parity.closeDesigner();

		await designer.createAsset('Carded toilet');
		await designer.applyPreset('toilet');
		// A finding about the section's own precondition: Asset Y's round-fronted footprint is not a
		// rectangle, so its Clearance row carries no figure (step 81's `(300 mm)` needs a box).
		await expect.poll(async () => (await parity.legendRows())[0]).toBe('clearance:Clearance');

		const layout = await browser.execute((el: HTMLElement) => {
			const dimensions = el.querySelector('.rp-designer-inspector-fields') as HTMLElement;
			const height = el.querySelector('input[name="height"]') as HTMLElement;
			const edit = el.querySelector('.rp-designer-edit-dimensions') as HTMLElement;
			const card = el.querySelector('.rp-designer-asset-card') as HTMLElement;
			const heightBlock = [...el.children].find((child) => child.contains(height)) ?? null;
			const path = card.querySelector('path') as SVGPathElement;
			const style = getComputedStyle(path);
			const scale = path.getScreenCTM()?.a ?? 1;
			return {
				afterDimensions: dimensions.nextElementSibling === heightBlock,
				afterHeight: heightBlock?.nextElementSibling?.className ?? 'none',
				afterCard: `${card.nextElementSibling?.tagName ?? 'none'}:${card.nextElementSibling?.textContent?.trim() ?? ''}`,
				cardText: card.textContent?.trim(),
				strokePx: style.vectorEffect === 'non-scaling-stroke' ? Number.parseFloat(style.strokeWidth) : Number.parseFloat(style.strokeWidth) * scale,
				editAfterHeight: Boolean(heightBlock && heightBlock.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING),
			};
		}, await panel().getElement());

		// Step 86: Dimensions, then Height, then Edit dimensions.
		expect(layout).toMatchObject({ afterDimensions: true, afterHeight: 'rp-designer-edit-dimensions', editAfterHeight: true });
		// Step 87: the card sits above the Asset heading, carries the chip and no name, and its
		// outline strokes at least one SCREEN pixel rather than a millimetre shrunk to a hairline.
		expect(layout.afterCard).toBe('H3:Asset');
		expect(layout.cardText).toBe('Material');
		expect(layout.strokePx).toBeGreaterThanOrEqual(1);
		expect(await panel().$('.rp-designer-asset-thumbnail').isDisplayed()).toBe(true);
		expect(await panel().getText()).not.toContain('Carded toilet');
	});

	// Steps 88a, 88b's structural half, and 88c.
	desktop('reads Saved just now after an edit, in no live region, and names the day once the clock passes midnight', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		// The renderer's clock, made movable BEFORE the save: `Date.now` gains an offset the case sets
		// later, and the indicator's one-minute tick runs every 200 ms — the host-side equivalent of
		// moving the system clock and waiting for the next tick, with the real component reading it.
		await browser.execute(() => {
			const holder = window as unknown as { rpClockOffset: number };
			holder.rpClockOffset = 0;
			const realNow = Date.now.bind(Date);
			Date.now = () => realNow() + holder.rpClockOffset;
			const realInterval = window.setInterval.bind(window);
			window.setInterval = ((handler: TimerHandler, ms?: number) => realInterval(handler, ms === 60_000 ? 200 : ms)) as typeof window.setInterval;
		});
		const assetId = await designer.createToilet('Saved toilet');
		await designer.nudgeTo(assetId, 2);
		await expect.poll(designer.header).toBe('Saved just now');
		const live = await browser.execute((el: HTMLElement) => {
			const found: string[] = [];
			for (let node: HTMLElement | null = el; node; node = node.parentElement) {
				if (node.hasAttribute('aria-live') || node.getAttribute('role') === 'status') found.push(node.className);
			}
			return found;
		}, await designer.designer().$('.rp-save-state-label').getElement());
		expect(live).toEqual([]);

		// Step 88c: 25 hours later, the save names its own day.
		const savedDay = await browser.execute(() => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(Date.now()));
		await browser.execute(() => {
			(window as unknown as { rpClockOffset: number }).rpClockOffset = 25 * 3_600_000;
		});
		await expect.poll(designer.header).toMatch(new RegExp(`^Saved ${savedDay} at \\d{1,2}:\\d{2}\\s?[AP]M$`, 'u'));
	});
});

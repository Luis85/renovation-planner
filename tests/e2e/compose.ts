import type { ChainablePromiseElement } from 'webdriverio';
import { expect } from 'vitest';
import type { NativeBrowser } from './session';
import { createDesignerPage, type ObsidianPage } from './designer';
import type { PlannerPage } from './helpers';

/** What a keydown did once every listener had its turn, read back from a capture listener on `window`. */
interface KeyRecord {
	key: string;
	prevented: boolean;
}

interface Rect { x: number; y: number; width: number; height: number }

/** A right-click on an element, through WebDriver's own pointer, which Chromium turns into a `contextmenu`. */
const rightClick = (element: ChainablePromiseElement) => element.click({ button: 'right' });

/**
 * `docs/tests/cases/Compose an asset from parts.md`'s Parts panel, keys and context menu as a user
 * reaches them, over `createDesignerPage`. Konva's stage registry is the instrument for what the
 * canvas DRAWS: a hidden graphic's config is dropped (`detailOutlines`), and the selection's marks
 * are shapes named `asset-selection-*`.
 */
export function createComposer(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage) {
	const designer = createDesignerPage(browser, page, ui);
	const pane = designer.designer;
	const row = (id: string) => pane().$(`.rp-designer-part-row[name="detail:${id}"]`);
	const control = (id: string, name: string) => pane().$(`li[data-key="detail:${id}"] .rp-designer-part-action[name="${name}"]`);
	const menu = () => pane().$('.rp-canvas-context-menu');
	const tool = (label: string) => pane().$(`.rp-designer-tools [aria-label="${label}"]`);
	const details = (assetId: string) => designer.readSidecar(assetId).shape?.details ?? [];

	/** Every Konva shape on the designer's stage whose NAME is one of `names`, as `{ id, rect }` relative to the viewport. */
	const shapes = (names: string[]) =>
		browser.execute((wanted) => {
			const konva = (window as unknown as { Konva: { stages: { find(sel: string): { id(): string; name(): string; getClientRect(): Rect }[]; container(): HTMLElement }[] } }).Konva;
			const host = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]');
			return konva.stages
				.filter((stage) => host?.contains(stage.container()) === true)
				.flatMap((stage) => {
					const c = stage.container().getBoundingClientRect();
					return stage.find('Shape').filter((shape) => wanted.includes(shape.name())).map((shape) => {
						const r = shape.getClientRect();
						return { id: shape.id(), name: shape.name(), rect: { x: c.left + r.x, y: c.top + r.y, width: r.width, height: r.height } };
					});
				});
		}, names);

	/** The graphic ids the canvas draws right now. */
	const drawn = async (): Promise<string[]> => (await shapes(['asset-detail'])).map((shape) => shape.id).toSorted();
	/** How many selection marks — outline, handles, the rotate stem — the canvas draws right now. */
	const marks = async (): Promise<number> => (await shapes(['asset-selection-outline', 'asset-selection-handle', 'asset-rotate-stem'])).length;

	/**
	 * A point on a drawn graphic where the stage's own `<canvas>` is what the pointer would hit. The
	 * selection's dimension labels float over the canvas (measured: under Pan one sat on the
	 * quarter-point), and a press there is the label's, not the part's. Never the centre: asset A's
	 * middle rectangle straddles the footprint's centre, where the anchor sits and wins the hit.
	 */
	const pointOn = async (id: string): Promise<{ x: number; y: number }> => {
		const found = (await shapes(['asset-detail'])).find((shape) => shape.id === id);
		if (!found) throw new Error(`No drawn graphic ${id}.`);
		const { rect } = found;
		for (const [fx, fy] of [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25]] as const) {
			const point = { x: Math.round(rect.x + rect.width * fx), y: Math.round(rect.y + rect.height * fy) };
			if (await browser.execute((x, y) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point.x, point.y)) return point;
		}
		throw new Error(`Every point on ${id} is under an overlay.`);
	};

	/** One primary drag across the canvas from one screen point to another, in one action chain. */
	const dragBetween = (from: { x: number; y: number }, to: { x: number; y: number }) =>
		browser
			.action('pointer')
			.move({ ...from, origin: 'viewport' })
			.down()
			.move({ ...to, duration: 200, origin: 'viewport' })
			.up()
			.perform();

	/** A chord on the focused canvas. `browser.keys` releases every source after, which is safe with no pointer held. */
	const onCanvas = async (keys: string | string[]): Promise<void> => {
		await designer.focusCanvas();
		await browser.keys(keys);
	};

	const footprintWidth = async (): Promise<number> => (await shapes(['asset-footprint-outline']))[0]?.rect.width ?? 0;

	/**
	 * Asset A of the case's preconditions: a new asset, Set dimensions 800 by 400, then THREE
	 * rectangles drawn by hand with Draw rectangle inside the footprint, clear of one another. Answers
	 * the asset id and the three graphic ids in draw order.
	 */
	const createAssetA = async (name: string): Promise<{ assetId: string; ids: string[] }> => {
		const assetId = await designer.createAsset(name);
		await designer.editDimensions(800, 400);
		await expect.poll(async () => (await shapes(['asset-footprint-outline'])).length).toBe(1);
		// Opened at 10% before it had a shape, so the footprint is a few pixels wide: frame it first.
		const small = await footprintWidth();
		await onCanvas(['Shift', '1']);
		await expect.poll(footprintWidth).toBeGreaterThan(small * 2);
		const [footprint] = await shapes(['asset-footprint-outline']);
		const box = (footprint as { rect: Rect }).rect;
		for (const [index, left] of [0.1, 0.4, 0.7].entries()) {
			const draw = pane().$('.rp-designer-add-shapes [aria-label="Draw rectangle"]');
			await draw.click();
			// A drag sent before the tool is armed is a press on empty canvas (measured once, under load).
			await expect.poll(() => draw.getAttribute('aria-pressed')).toBe('true');
			const at = (fx: number, fy: number) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
			// From the bottom-right corner: the rectangle drawn before stays selected, and its floating
			// dimension labels sit along its top and right edges, where a top-left start could land.
			const from = at(left + 0.2, 0.7);
			expect(await browser.execute((x, y) => document.elementFromPoint(x, y)?.tagName, from.x, from.y)).toBe('CANVAS');
			await dragBetween(from, at(left, 0.3));
			await expect.poll(() => details(assetId).length).toBe(index + 1);
		}
		return { assetId, ids: details(assetId).map((detail) => detail.id) };
	};

	/**
	 * A click with Shift held: a key source and a pointer source in ONE actions call, tick by tick.
	 * A key held across a separate `element.click()` does not reach it — that is the classic click
	 * endpoint, which carries no modifier (measured: the row replaced the selection).
	 */
	const shiftClick = async (element: ChainablePromiseElement): Promise<void> => {
		const at = await element.getLocation();
		const size = await element.getSize();
		const x = Math.round(at.x + size.width / 2), y = Math.round(at.y + size.height / 2);
		await browser.actions([
			browser.action('key').down('').pause(10).pause(10).pause(10).up(''),
			browser.action('pointer').pause(10).move({ x, y, origin: 'viewport' }).down().up().pause(10),
		]);
	};

	/** A right-click at a screen point. */
	const rightClickAt = (point: { x: number; y: number }) =>
		browser.action('pointer').move({ ...point, origin: 'viewport' }).down({ button: 2 }).up({ button: 2 }).perform();

	/** Every item of the open designer menu, as `{ id, disabled }`. */
	const menuItems = () =>
		menu().$$('[role="menuitem"]').map(async (item) => ({
			id: (await item.getAttribute('data-rp-context-action')) ?? '',
			disabled: (await item.getAttribute('aria-disabled')) === 'true',
		}));

	/** The row keys that read as pressed, in list order. */
	const pressedRows = () =>
		pane().$$('.rp-designer-part-row[aria-pressed="true"]').map((each) => each.getAttribute('name'));

	/** Where keyboard focus is, as the nearest landmark a case can name. */
	const focusTarget = () =>
		browser.execute(() => {
			const active = document.activeElement;
			if (active === null || active === document.body) return 'body';
			if (active.matches('.rp-plan-canvas')) return 'canvas';
			if (active.matches('.rp-designer-part-row')) return `row ${active.getAttribute('name') ?? ''}`;
			if (active.closest('.rp-designer-part-controls') !== null) return 'row controls';
			if (active.closest('.rp-group-row, [data-kind="group"]') !== null) return 'group row';
			return `${active.tagName.toLowerCase()}.${active.className}`;
		});

	/** Start recording every keydown's `defaultPrevented`, as it stands once every listener has run. */
	const recordKeys = () =>
		browser.execute(() => {
			const log: KeyRecord[] = [];
			(window as unknown as { rpKeyLog: typeof log }).rpKeyLog = log;
			window.addEventListener('keydown', (event) => {
				setTimeout(() => log.push({ key: event.key, prevented: event.defaultPrevented }), 0);
			}, { capture: true });
		});
	const keyLog = () => browser.execute(() => (window as unknown as { rpKeyLog: KeyRecord[] }).rpKeyLog.splice(0));

	/** Start recording every command Obsidian itself runs, by id — what its hotkey manager fires. */
	const recordCommands = () =>
		browser.executeObsidian(({ app }) => {
			const commands = (app as unknown as { commands: { executeCommand(command: { id: string }): boolean } }).commands;
			const log: string[] = [];
			(window as unknown as { rpCommandLog: string[] }).rpCommandLog = log;
			const original = commands.executeCommand.bind(commands);
			commands.executeCommand = (command) => {
				log.push(command.id);
				return original(command);
			};
		});
	const commandLog = () => browser.execute(() => (window as unknown as { rpCommandLog: string[] }).rpCommandLog.splice(0));

	/** The camera, as the top ruler's tiling offset and step — both move with any pan or zoom. */
	const camera = () => pane().$('.rp-designer-ruler--top').getAttribute('style');
	const rulerBands = () => pane().$$('.rp-designer-ruler__extent').length;

	/**
	 * Whether a chord dispatched AT the canvas reaches a listener on the canvas itself — the target
	 * phase, where the designer's own `@keydown` sits — and which Obsidian commands it ran instead.
	 * Synthetic, so it isolates the host's handling from anything WebDriver's input does.
	 */
	const reachesCanvas = (init: KeyboardEventInit) =>
		browser.execute((options) => {
			const canvas = document.querySelector('.workspace-leaf.mod-active .rp-plan-canvas') as HTMLElement;
			canvas.focus();
			let reached = false;
			const mark = (): void => {
				reached = true;
			};
			canvas.addEventListener('keydown', mark);
			canvas.dispatchEvent(new KeyboardEvent('keydown', { ...options, bubbles: true, cancelable: true }));
			canvas.removeEventListener('keydown', mark);
			return reached;
		}, init);

	/** One Undo, waited for on disk until the graphics are `ids` again. */
	const undoTo = async (assetId: string, ids: string[]): Promise<void> => {
		await designer.undoButton().click();
		await expect.poll(() => details(assetId).map((detail) => detail.id)).toEqual(ids);
	};

	return {
		...designer,
		undoTo,
		reachesCanvas,
		arrangeGroup: () => pane().$('.rp-designer-arrange button[name="group"]'),
		row,
		control,
		menu,
		tool,
		details,
		drawn,
		marks,
		pointOn,
		dragBetween,
		createAssetA,
		rightClick,
		shiftClick,
		rightClickAt,
		menuItems,
		pressedRows,
		focusTarget,
		recordKeys,
		keyLog,
		recordCommands,
		commandLog,
		camera,
		rulerBands,
		onCanvas,
		marksOf: (id: string) => pane().$$(`li[data-key="detail:${id}"] .rp-designer-part-mark`).map((mark) => mark.getText()),
		allMarks: () => pane().$$('.rp-designer-part-mark').map((mark) => mark.getText()),
		groups: (assetId: string) => (designer.readSidecar(assetId).shape as unknown as { groups?: { id: string; members: string[] }[] } | null)?.groups ?? [],
	};
}

import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { createParityPage } from './designerParity';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md` step 92, as AD18-R32 rewords it: a right-click on the
 * footprint's outline, the anchor dot or the facing arrow opens NOTHING — no designer menu, and no
 * Obsidian menu, native or DOM — with Obsidian's `nativeMenus` preference on and off.
 *
 * **A DISCHARGE under AD18-R32**, which reworded the clause into this and ruled it built as one case
 * — not an AD18-R30 guard: "nothing opens" is the whole clause, with no "reads as" left over. Three
 * hooks, all reached from the renderer and all removed in a `finally`: the main process's
 * `webContents` `context-menu` event (through `@electron/remote`), which fires only when the page left
 * the right-click unclaimed (probe Q2: the designer's own menu suppresses it) and is what makes
 * "nothing" non-vacuous — a right-click that never reached the host would open nothing too — and whose
 * `isEditable`/`selectionText` are what the host's own main-process handler builds a native menu for;
 * Electron's `Menu.buildFromTemplate`, the door an Obsidian `Menu` goes through when it is native; and
 * Obsidian's own `Menu.showAtMouseEvent` / `showAtPosition`. Beside them, the DOM: no `.menu` (a
 * non-native Obsidian menu) and no `.rp-canvas-context-menu` (the designer's).
 *
 * **What it cannot see**: a menu the main process builds on some route other than that handler's
 * `isEditable || selectionText` branch — which is probe Q2's reading of the 1.13.7 bundle, not a hook,
 * so a host that changed the condition would pass here while opening something. The case row stays
 * the tripwire for that. macOS is not run (AD18-R31: no macOS leg); both preference values are, and
 * macOS's default is only the `true` one.
 *
 * **The footprint point is placed, not assumed.** Probe Q2 saw the designer claim an outline point
 * 11 px from a SELECTED part, the selection's own handle tolerance. So the selection is cleared
 * first (no `asset-selection-handle` drawn, no Parts row pressed), and each point is checked in the
 * run: the footprint's outside every drawn detail's box, each at least the grab radius from the
 * anchor or facing mark it is not aimed at, and all clear of the canvas's 40 px edge-scroll band.
 * The anchor dot and the facing arrow sit over the bowl on this preset, measured, which the hit
 * order resolves in their favour — see the placement block.
 */
const desktop = mobileEmulation ? test.skip : test;

/** `EDGE_SCROLL_ZONE_PX` (`src/presentation/editor/surface/edgeScroll.ts`). */
const EDGE_BAND_PX = 40;
/** `VERTEX_GRAB_RADIUS_PX` (`src/presentation/editor/handleMetrics.ts`), the anchor's and facing tip's hit radius. */
const GRAB_PX = 8;

interface Box { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
/** What one right-click left behind. */
interface Outcome { contextMenuEvents: string[]; hostMenuCalls: string[]; domMenus: number; designerMenus: number }

/**
 * One `context-menu` event, on neither an editable element nor a text selection — the two things
 * Obsidian 1.13.7's main-process handler builds its own native menu for (probe Q2, read from the bundle).
 */
const NOTHING: Outcome = { contextMenuEvents: ['editable=false selection=""'], hostMenuCalls: [], domMenus: 0, designerMenus: 0 };

type Hooked = Window & { require(id: string): unknown; rpNoMenu?: { events: string[]; calls: string[]; restore(): number } };
interface Remote { Menu: { buildFromTemplate(template: unknown[]): unknown }; getCurrentWebContents(): { on(e: string, f: Listener): void; removeListener(e: string, f: Listener): void; listenerCount(e: string): number } }
type Listener = (event: unknown, params: { isEditable: boolean; selectionText: string }) => void;

/** The three hooks, recording into `window.rpNoMenu`; its `restore` takes every one of them off again. */
const install = (browser: NativeBrowser) =>
	browser.executeObsidian(({ obsidian }) => {
		const w = window as unknown as Hooked;
		const remote = w.require('@electron/remote') as Remote;
		type Method = (...args: unknown[]) => unknown;
		const proto = obsidian.Menu.prototype as unknown as Record<string, Method>;
		const shows = ['showAtMouseEvent', 'showAtPosition'].map((name) => [name, proto[name] as Method] as const);
		const build = remote.Menu.buildFromTemplate;
		const events: string[] = [], calls: string[] = [];
		const listener: Listener = (_event, params) => {
			events.push(`editable=${String(params.isEditable)} selection=${JSON.stringify(params.selectionText)}`);
		};
		w.rpNoMenu = {
			events,
			calls,
			restore: () => {
				for (const [name, original] of shows) proto[name] = original;
				remote.Menu.buildFromTemplate = build;
				remote.getCurrentWebContents().removeListener('context-menu', listener);
				return remote.getCurrentWebContents().listenerCount('context-menu');
			},
		};
		for (const [name, original] of shows) {
			proto[name] = function (this: unknown, ...args: unknown[]) {
				calls.push(`Menu.${name}`);
				return original.apply(this, args);
			};
		}
		remote.Menu.buildFromTemplate = (template: unknown[]) => {
			calls.push('buildFromTemplate');
			return build.call(remote.Menu, template);
		};
		const before = remote.getCurrentWebContents().listenerCount('context-menu');
		remote.getCurrentWebContents().on('context-menu', listener);
		return before;
	});

const uninstall = (browser: NativeBrowser) =>
	browser.execute(() => {
		const w = window as unknown as Hooked;
		const left = w.rpNoMenu?.restore();
		delete w.rpNoMenu;
		return left;
	});

/** Everything recorded since the last read, which it clears, and what the DOM holds now. */
const outcome = (browser: NativeBrowser): Promise<Outcome> =>
	browser.execute(() => {
		const record = (window as unknown as Hooked).rpNoMenu;
		if (!record) throw new Error('The menu hooks are not installed.');
		return { contextMenuEvents: record.events.splice(0), hostMenuCalls: record.calls.splice(0), domMenus: document.querySelectorAll('.menu').length, designerMenus: document.querySelectorAll('.rp-canvas-context-menu').length };
	});

const readNativeMenus = (browser: NativeBrowser) =>
	browser.executeObsidian(({ app }) => (app.vault as unknown as { getConfig(key: string): unknown }).getConfig('nativeMenus'));

const setNativeMenus = (browser: NativeBrowser, value: unknown) =>
	browser.executeObsidian(({ app }, on) => (app.vault as unknown as { setConfig(key: string, value: unknown): void }).setConfig('nativeMenus', on), value);

const centre = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const inside = (point: Point, box: Box, margin = 0): boolean =>
	point.x >= box.x - margin && point.x <= box.x + box.width + margin && point.y >= box.y - margin && point.y <= box.y + box.height + margin;

describe('Design an Asset step 92, in the real Obsidian host', () => {
	desktop('opens nothing, designer or Obsidian, native or DOM, on the footprint outline, the anchor dot and the facing arrow', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createAsset('Menuless toilet');
		await designer.applyPreset('toilet');

		// The selection cleared: no part row pressed, and so no handle drawn to widen any hit.
		expect(await designer.designer().$$('.rp-designer-part-row[aria-pressed="true"]').length).toBe(0);
		expect(await parity.marks('asset-selection-handle')).toEqual([]);

		const [footprint] = await parity.marks('asset-footprint-outline');
		const [anchor] = await parity.marks('asset-anchor-mark');
		const [facing] = await parity.marks('asset-facing-head');
		const details = await parity.marks('asset-detail');
		if (!footprint || !anchor || !facing) throw new Error('A non-graphic part is not drawn.');
		expect(details).toHaveLength(2);
		// Each point, and what it must stay clear of for the hit to be the part it names. A closed detail is
		// hit by its interior alone, so its box needs no margin; the anchor and the facing tip claim a press
		// within the grab radius. The anchor and the facing arrow are drawn OVER the bowl by design, and the
		// hit order asks them first — so a regression there would hand the press to the bowl and open ITS
		// menu, which the comparison below would show.
		const targets: [string, Point, { details: Box[]; marks: Box[] }][] = [
			// On the outline's left edge, 3 px in, halfway down its STRAIGHT side: `roundFront` rounds the front
			// with a half-circle of the width, so the side runs straight for `height - width / 2` from the back.
			['footprint outline', { x: footprint.x + 3, y: footprint.y + (footprint.height - footprint.width / 2) / 2 }, { details, marks: [anchor, facing] }],
			['anchor dot', centre(anchor), { details: [], marks: [facing] }],
			['facing arrow', centre(facing), { details: [], marks: [anchor] }],
		];
		const canvas = await browser.execute(() => document.querySelector('.workspace-leaf.mod-active .rp-plan-canvas')?.getBoundingClientRect().toJSON() as Box);
		const band = { x: canvas.x + EDGE_BAND_PX, y: canvas.y + EDGE_BAND_PX, width: canvas.width - 2 * EDGE_BAND_PX, height: canvas.height - 2 * EDGE_BAND_PX };
		for (const [label, point, clearOf] of targets) {
			const placed = {
				label,
				clearOfBand: inside(point, band),
				clearOfDetails: clearOf.details.every((box) => !inside(point, box)),
				clearOfOtherMarks: clearOf.marks.every((box) => !inside(point, box, GRAB_PX)),
			};
			expect(placed).toEqual({ label, clearOfBand: true, clearOfDetails: true, clearOfOtherMarks: true });
		}

		const preference = await readNativeMenus(browser);
		let listenersBefore: number | undefined, listenersAfter: number | undefined;
		try {
			listenersBefore = await install(browser);
			for (const native of [false, true]) {
				await setNativeMenus(browser, native);
				for (const [label, point] of targets) {
					await outcome(browser);
					await parity.rightClick(point);
					// The main process's event arrives over IPC: wait for it, bounded, then a beat for anything
					// slower to draw. A timeout is not thrown — the comparison below shows what was missing.
					await browser
						.waitUntil(async () => (await browser.execute(() => (window as unknown as Hooked).rpNoMenu?.events.length ?? 0)) > 0, { timeout: 5000 })
						.catch(() => undefined);
					await browser.pause(400);
					// Soft, so one run reports all six right-clicks rather than stopping at the first.
					expect.soft({ native, label, ...(await outcome(browser)) }).toEqual({ native, label, ...NOTHING });
					await browser.keys('Escape');
				}
			}
		} finally {
			try {
				listenersAfter = await uninstall(browser);
			} finally {
				await setNativeMenus(browser, preference);
			}
		}
		// Every hook came off: Obsidian's own `context-menu` listener is all that is left.
		expect(listenersAfter).toBe(listenersBefore);
		// And the preference is back to what the vault had.
		expect(await readNativeMenus(browser)).toBe(preference);
	});
});

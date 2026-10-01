import type Konva from 'konva';
import { expect } from 'vitest';
import { EDITOR, type reloadPlugin } from './planner';
import { PLUGIN_ID, type NativeBrowser } from './session';

/**
 * The Plan Editor's canvas as a pointer reaches it, and the geometry sidecar a room's outline is
 * stored in — the first pointer gestures on the Konva stage in this suite.
 *
 * **Every screen point is computed at use**, from the live stage: the `zone` layer carries the
 * viewport transform (`ZoneLayer.vue`), so its absolute transform maps a world point to the
 * stage's own pixels, and the stage container's client rect puts those on the viewport WebDriver
 * addresses. A framed selection, a resize or a pan moves the camera, so a point read before one
 * is a point on the wrong spot.
 */

export interface WorldPoint {
	x: number;
	y: number;
}
/** How a sidecar stores a corner (`planGeometry.ts`, `SpatialObjectGeometrySchemaV1`). */
export type StoredPoint = [number, number];
interface StoredObject {
	id: string;
	points: StoredPoint[];
	bulges?: number[];
}

/**
 * Clear of `EDGE_SCROLL_ZONE_PX` (40, `edgeScroll.ts`) with a little room to spare, and inside the
 * 48 px a framed room is padded by (`EditorStore.fitTo`): a gesture that comes that close to the
 * stage's edge scrolls the camera under the pointer, and the drop lands elsewhere.
 */
const EDGE_MARGIN_PX = 44;

interface ScreenPoint {
	x: number;
	y: number;
	/** A press here lands on the stage's own canvas, not on anything drawn over it. */
	onStage: boolean;
	/** Inside the stage and clear of its edge-scroll band. */
	inside: boolean;
	/** The zone layer's transform and the stage's rect: equal twice running means the camera has stopped. */
	camera: string;
}

const canvasPoint = (browser: NativeBrowser, world: WorldPoint): Promise<ScreenPoint> =>
	browser.execute(
		(editor: string, at: WorldPoint, margin: number) => {
			const stages = (window as unknown as { Konva?: typeof Konva }).Konva?.stages ?? [];
			const stage = stages.find((candidate) => candidate.container().closest(editor) !== null);
			const layer = stage?.findOne<Konva.Layer>('.zone');
			if (!stage || !layer) throw new Error('No Plan Editor stage with a zone layer is drawn.');
			const transform = layer.getAbsoluteTransform();
			const local = transform.point(at);
			const rect = stage.container().getBoundingClientRect();
			const x = Math.round(rect.left + local.x);
			const y = Math.round(rect.top + local.y);
			const hit = document.elementFromPoint(x, y);
			return {
				x,
				y,
				onStage: hit instanceof HTMLCanvasElement && stage.container().contains(hit),
				inside: x >= rect.left + margin && x <= rect.right - margin && y >= rect.top + margin && y <= rect.bottom - margin,
				camera: JSON.stringify([transform.getMatrix(), rect.left, rect.top, rect.width, rect.height]),
			};
		},
		EDITOR,
		world,
		EDGE_MARGIN_PX,
	);

/** Wait until the camera stops moving — a list selection frames it, and a framing may animate. */
export async function settleCamera(browser: NativeBrowser): Promise<void> {
	let previous = '';
	await expect
		.poll(async () => {
			const { camera } = await canvasPoint(browser, { x: 0, y: 0 });
			const still = camera === previous;
			previous = camera;
			return still;
		}, { interval: 200 })
		.toBe(true);
}

/**
 * Press on the corner at `from`, drag through a midpoint, release at `to`. Refused here when anything
 * but the stage sits under the press — a missed press would otherwise read as a refused drag — or
 * when either end sits in the edge-scroll band. `EditorSurface` captures the pointer on press, so
 * the moves and the release reach the stage whatever is drawn where they land.
 */
export async function dragCorner(browser: NativeBrowser, from: WorldPoint, to: WorldPoint): Promise<void> {
	const start = await canvasPoint(browser, from);
	const end = await canvasPoint(browser, to);
	expect({ from, to, start, end }).toMatchObject({ start: { onStage: true, inside: true }, end: { inside: true } });
	await browser
		.action('pointer', { parameters: { pointerType: 'mouse' } })
		.move({ x: start.x, y: start.y, origin: 'viewport' })
		.down({ button: 0 })
		.move({ x: Math.round((start.x + end.x) / 2), y: Math.round((start.y + end.y) / 2), duration: 100, origin: 'viewport' })
		.move({ x: end.x, y: end.y, duration: 100, origin: 'viewport' })
		.up({ button: 0 })
		.perform();
}

/** The one geometry sidecar in the vault; the sample project writes exactly one. */
export async function sidecarPath(browser: NativeBrowser): Promise<string> {
	const paths = await browser.executeObsidian(({ app }) =>
		app.vault
			.getFiles()
			.filter((file) => file.extension === 'rpgeo')
			.map((file) => file.path),
	);
	expect(paths).toHaveLength(1);
	return paths[0];
}

// `executeObsidian` types its result as a promise of the callback's own return, which is already a
// promise here; the `await` unwraps both.
export const readSidecar = async (browser: NativeBrowser, path: string): Promise<string> =>
	await browser.executeObsidian(({ app }, file) => app.vault.adapter.read(file), path);

export async function outlineOf(browser: NativeBrowser, path: string, zoneId: string): Promise<StoredPoint[]> {
	const stored = JSON.parse(await readSidecar(browser, path)) as { objects: StoredObject[] };
	const found = stored.objects.find((object) => object.id === zoneId);
	if (!found) throw new Error(`${path} stores no outline for ${zoneId}`);
	return found.points;
}

/**
 * The case's "outside Obsidian" hand edit: the plugin off, one room's outline rewritten in the
 * sidecar by the vault adapter, the plugin on again to read it fresh. A straight outline carries
 * no bulges, and one left behind would be a count per edge the new outline no longer has.
 */
export async function rewriteOutline(browser: NativeBrowser, page: Parameters<typeof reloadPlugin>[0], zoneId: string, points: StoredPoint[]): Promise<void> {
	const path = await sidecarPath(browser);
	await page.disablePlugin(PLUGIN_ID);
	await browser.executeObsidian(
		async ({ app }, file, id, next) => {
			const stored = JSON.parse(await app.vault.adapter.read(file)) as { objects: StoredObject[] };
			const object = stored.objects.find((candidate) => candidate.id === id);
			if (!object) throw new Error(`${file} stores no outline for ${id}`);
			object.points = next;
			delete object.bulges;
			await app.vault.adapter.write(file, JSON.stringify(stored, null, '\t'));
		},
		path,
		zoneId,
		points,
	);
	await page.enablePlugin(PLUGIN_ID);
}

/**
 * Record every state the save indicator (`SaveStateIndicator.vue`, `rp-save-state-<state>`) takes
 * from now on, through a `MutationObserver` over the whole editor leaf — so a label Vue replaces
 * rather than patches is seen too. Replaces the previous log.
 */
export async function recordSaveStates(browser: NativeBrowser): Promise<void> {
	await browser.execute((editor: string) => {
		const held = window as unknown as { __rpSaveLog?: string[]; __rpSaveObserver?: MutationObserver };
		const root = document.querySelector(editor);
		if (root === null) throw new Error('No Plan Editor leaf to observe.');
		const log: string[] = [];
		const read = (): void => {
			for (const label of root.querySelectorAll('.rp-save-state-label')) {
				log.push([...label.classList].find((name) => name !== 'rp-save-state-label') ?? '');
			}
		};
		read();
		held.__rpSaveObserver?.disconnect();
		held.__rpSaveObserver = new MutationObserver(read);
		held.__rpSaveObserver.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
		held.__rpSaveLog = log;
	}, EDITOR);
}

export const saveStates = (browser: NativeBrowser): Promise<string[]> =>
	browser.execute(() => (window as unknown as { __rpSaveLog?: string[] }).__rpSaveLog ?? []);

/**
 * The indicator as it reads now: its state class and its word as a screen reader gets it — the text
 * with every `aria-hidden` descendant left out. Once a write has landed `SaveStateIndicator.vue`
 * draws a visually-hidden `Saved` beside an `aria-hidden` relative time, so the whole `textContent`
 * is `SavedSaved just now`; this reads `Saved` in both shapes, and goes on reading it as the minute
 * tick moves the visible phrase.
 */
export const saveLabel = (browser: NativeBrowser): Promise<{ state: string; text: string }> =>
	browser.execute((editor: string) => {
		const label = document.querySelector(`${editor} .rp-save-state-label`);
		const spoken = label?.cloneNode(true) as Element | undefined;
		for (const hidden of spoken?.querySelectorAll('[aria-hidden="true"]') ?? []) hidden.remove();
		return {
			state: label ? ([...label.classList].find((name) => name !== 'rp-save-state-label') ?? '') : 'absent',
			text: spoken?.textContent?.trim() ?? '',
		};
	}, EDITOR);

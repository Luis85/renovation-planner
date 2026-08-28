/**
 * @vitest-environment jsdom
 *
 * Camera NAVIGATION on the Plan Canvas, driven through the real mounted editor: the pan
 * override (space held, middle button), the wheel gestures, and zoom-to-fit.
 *
 * These belong at the canvas rather than beside `PanOverride`'s own node tests because what
 * they assert is the ROUTING — that a gesture claimed by the camera does not also reach the
 * active tool, and that a tool interrupted by one keeps everything it was holding. The
 * machine can be correct in isolation and the canvas can still hand the same press to both.
 *
 * What jsdom cannot see here, and what therefore has a manual case instead
 * (`docs/tests/cases/Canvas Navigation.md`): the cursor actually changing, since jsdom
 * resolves no styles; and Obsidian's own keymap getting the space bar or `Shift+1` before
 * this canvas does, since jsdom models no host keymap at all.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';

const PLAN = 'plan-e2e' as never;

/** The mounted editor plus the camera store behind it, which is what every case reads. */
async function editor() {
	const built = await rig();
	const canvas = built.harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return { ...built, canvas, camera: useEditorStore(built.harness.pinia) };
}

function key(canvas: HTMLElement, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
	canvas.dispatchEvent(event);
	return event;
}

/**
 * Only the CLASS is assertable — jsdom resolves no styles, so nothing in this suite can see
 * that `.rp-plan-canvas-armed` means `cursor: grab`. What the cases below DO hold is the
 * precedence, which is decided in the component precisely so that it can be: expressed as
 * source order in a stylesheet it would be a correct rule that no gate reads.
 */
function cursorClasses(canvas: HTMLElement): string[] {
	return [...canvas.classList].filter((name) => name.startsWith('rp-plan-canvas-'));
}

function wheel(canvas: HTMLElement, init: WheelEventInit): void {
	canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }));
}

describe('holding space to pan', () => {
	it('pans the camera on drag while the Select tool is active', async () => {
		// The gesture the whole change exists for: the user is in a selection mode and needs
		// the view moved without leaving it.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = camera.viewport.pan;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 380, 340);
		pointer(canvas, 'pointerup', 380, 340);
		await settle();

		expect(camera.viewport.pan.x).toBeCloseTo(before.x - 80 / camera.viewport.zoom, 6);
		expect(camera.viewport.pan.y).toBeCloseTo(before.y - 40 / camera.viewport.zoom, 6);
		harness.unmount();
	});

	it('does not also move the zone under the pointer', async () => {
		// The routing half. A canvas that panned AND forwarded would drag the zone by the
		// same delta it just moved the camera by, which reads as the plan tearing apart.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300); // inside zone-a's footprint
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points).toEqual(before);
		harness.unmount();
	});

	it('preserves a half-drawn polygon, which is what makes this an override and not a tool', async () => {
		// The load-bearing case for the whole design. Routing this through
		// `ToolManager.setActiveTool` would run `DrawPolygonTool.deactivate()` and discard the
		// vertices already placed — and the user reaches for the pan precisely BECAUSE the
		// shape they are drawing runs off the pane.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 400, 400);
		pointer(canvas, 'pointermove', 420, 420);
		pointer(canvas, 'pointerup', 420, 420);
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// The buffer survived: the third vertex and the close land on the ORIGINAL two — at
		// their new SCREEN positions, since the pan moved the world 20 px right and down and
		// the buffered vertices moved with it. That offset is the proof the pan really
		// happened; a canvas that had ignored the gesture would need the original pixels here.
		click(canvas, 620, 220);
		click(canvas, 520, 120);
		await settle();

		const listed = expectOk(await zonesRepo.listByPlan(PLAN));
		expect(listed).toHaveLength(2);
		const drawn = listed.find((loaded) => loaded.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('stops the pane scrolling away under the plan', async () => {
		// A canvas is inside a scrollable leaf and space is the page-down key. Without a
		// `preventDefault` the first pan scrolls the editor out of its own view.
		const { harness, canvas } = await editor();

		expect(key(canvas, 'keydown', { key: ' ' }).defaultPrevented).toBe(true);
		harness.unmount();
	});

	it('releasing space mid-drag lets the pan finish rather than stranding the pointer', async () => {
		const { harness, canvas, camera } = await editor();
		// With a tool ACTIVE, so the pan can only have come from the override — in camera
		// mode a bare primary drag already pans and this case would pass against no change
		// at all.
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = camera.viewport.pan;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 350, 300);
		key(canvas, 'keyup', { key: ' ' });
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(camera.viewport.pan.x).toBeCloseTo(before.x - 100 / camera.viewport.zoom, 6);
		harness.unmount();
	});

	it('losing focus drops the held key, so the canvas does not come back stuck in pan mode', async () => {
		// The canvas hears keys only while focused, so a user who alt-tabs mid-hold releases
		// space somewhere it will never hear. Focus leaving IS the notice.
		const { harness, canvas, camera } = await editor();
		// Again with a tool active: the point is that the primary drag goes back to the TOOL,
		// which in camera mode would be indistinguishable from the override still working.
		toolbarButton(harness, 'Select').click();
		await settle();
		key(canvas, 'keydown', { key: ' ' });
		canvas.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
		const before = camera.viewport.pan;

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(camera.viewport.pan).toEqual(before);
		harness.unmount();
	});
});

describe('the middle button', () => {
	it('pans with no modifier while a tool is active', async () => {
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = camera.viewport.pan;

		pointer(canvas, 'pointerdown', 300, 300, 1);
		pointer(canvas, 'pointermove', 360, 300, 1);
		pointer(canvas, 'pointerup', 360, 300, 1);
		await settle();

		expect(camera.viewport.pan.x).toBeCloseTo(before.x - 60 / camera.viewport.zoom, 6);
		harness.unmount();
	});

	it('is refused while a tool gesture is already running', async () => {
		// The primary button is down and `SelectTool` is mid-drag. Panning under it would
		// move the world beneath a drag the tool still believes in, and the eventual primary
		// release would commit at a position the user never chose.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		const before = camera.viewport.pan;
		pointer(canvas, 'pointerdown', 340, 300, 1);
		pointer(canvas, 'pointermove', 500, 300, 1);
		await settle();

		expect(camera.viewport.pan).toEqual(before);
		harness.unmount();
	});
});

describe('the wheel', () => {
	it('still zooms when unmodified — this is a plan editor, not a document', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.zoom;

		wheel(canvas, { deltaY: -120 });
		await settle();

		expect(camera.viewport.zoom).toBeGreaterThan(before);
		harness.unmount();
	});

	it('pans horizontally with shift, and does not zoom while doing it', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		wheel(canvas, { deltaY: 120, shiftKey: true });
		await settle();

		expect(camera.viewport.zoom).toBe(before.zoom);
		expect(camera.viewport.pan.x).not.toBe(before.pan.x);
		expect(camera.viewport.pan.y).toBe(before.pan.y);
		harness.unmount();
	});

	it('reads a shift-wheel that the browser already turned into a horizontal delta', async () => {
		// Chrome on Windows and Linux converts shift+wheel into `deltaX` itself; macOS and
		// a trackpad's own horizontal swipe arrive the same way. Reading only `deltaY` would
		// make this gesture a silent no-op on the platforms that do the conversion.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaX: 120, deltaY: 0, shiftKey: true });
		await settle();

		expect(camera.viewport.pan.x).not.toBe(before);
		harness.unmount();
	});
});

describe('zoom to fit', () => {
	it('Shift+1 frames the plan’s zones', async () => {
		const { harness, canvas, camera } = await editor();

		key(canvas, 'keydown', { key: '!', shiftKey: true });
		await settle();

		// The fixture zone spans (198,198)-(488,388) on screen at the default camera, so a
		// fit must zoom IN on it rather than leave the opening view alone.
		expect(camera.viewport.zoom).toBeGreaterThan(0.1);
		harness.unmount();
	});

	it('Shift+2 frames the selection', async () => {
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '@', shiftKey: true });
		await settle();

		expect(camera.viewport).not.toEqual(before);
		harness.unmount();
	});

	it('Shift+2 with nothing selected leaves the camera alone', async () => {
		// A jump to nowhere is worse than no response: the user loses the view they had and
		// nothing tells them why.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '@', shiftKey: true });
		await settle();

		expect(camera.viewport).toEqual(before);
		harness.unmount();
	});
});

describe('what the cursor says the pointer will do', () => {
	it('says nothing at rest', async () => {
		const { harness, canvas } = await editor();

		expect(cursorClasses(canvas)).toEqual([]);
		harness.unmount();
	});

	it('offers the camera while space is held', async () => {
		const { harness, canvas } = await editor();

		key(canvas, 'keydown', { key: ' ' });
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});

	it('changes while the drag is actually running', async () => {
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });

		pointer(canvas, 'pointerdown', 300, 300);
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-panning']);
		harness.unmount();
	});

	it('is precise while a drawing tool is active', async () => {
		const { harness, canvas } = await editor();

		toolbarButton(harness, 'Draw zone').click();
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-precise']);
		harness.unmount();
	});

	it('lets the camera outrank the drawing tool, matching what the routing does', async () => {
		// The precedence that matters: space held DURING a draw pans, so the cursor must
		// promise a pan and not a vertex. The routing already behaves this way; a cursor
		// that disagreed with it would be the only thing telling the user otherwise.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});
});

describe('keys the canvas deliberately does not act on', () => {
	it('ignores the autorepeat of a held space bar', async () => {
		// A held key repeats at the OS rate. Every repeat still has to be `preventDefault`ed —
		// the pane would otherwise page down through the whole hold — but only the first one
		// is a new arming.
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });

		const repeated = key(canvas, 'keydown', { key: ' ', repeat: true });
		await settle();

		expect(repeated.defaultPrevented).toBe(true);
		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});

	it('leaves the camera alone when another key comes up', async () => {
		// `keyup` is bound for the space bar, and every other key reaches the same handler.
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		const before = camera.viewport;

		key(canvas, 'keyup', { key: 'a' });
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		expect(camera.viewport).toEqual(before);
		harness.unmount();
	});

	it('still zooms on shift+= rather than treating every shifted key as a fit', async () => {
		// The fit shortcuts test `shiftKey` first, so a shifted key that is NOT 1 or 2 has to
		// fall through to the zoom step rather than being swallowed by that branch.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.zoom;

		key(canvas, 'keydown', { key: '+', shiftKey: true });
		await settle();

		expect(camera.viewport.zoom).toBeGreaterThan(before);
		harness.unmount();
	});
});

describe('a pan the pointer walks out of', () => {
	it('hands the active tool its input back, instead of swallowing every later release', async () => {
		// `pointerleave` ended the camera's own drag and left the override still believing it
		// owned the gesture — two values modelling one thing, disagreeing. The camera itself
		// then looked fine, because `continuePan` no-ops without a drag state; what broke was
		// the ROUTING. Every later `pointerup` was consumed as the end of that phantom pan, so
		// `SelectTool` got presses it never got releases for and no drag ever committed again.
		//
		// Pointer capture means a real browser should not deliver this mid-drag at all. That
		// is a reason for the two to agree anyway, not a reason to leave the gap.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// An ordinary select-and-drag, as the very NEXT interaction. It has to be the next one:
		// the phantom pan swallows exactly one release and is cleared by doing so, so any
		// click in between absorbs the damage and this case would pass against the defect.
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x).not.toBe(before);
		harness.unmount();
	});

	it('goes back to ARMED, so the held space bar is not thrown away with it', async () => {
		// `pointerUp` rather than `cancel`: the user never released the key, and disarming
		// would make them press it again for a gesture they are still in the middle of asking
		// for.
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});
});

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
 * **Which gestures exist**, is the scope here. WHOSE a running gesture is — one owner, one at
 * a time, and every other input refused while it runs — is `canvasGestureOwnership.test.ts`,
 * split out when this file crossed the suite's 450-line cap. Its header carries the three
 * shapes that concern keeps taking.
 *
 * What jsdom cannot see here, and what therefore has a manual case instead
 * (`docs/tests/cases/Canvas Navigation.md`): the cursor actually changing, since jsdom
 * resolves no styles; and Obsidian's own keymap getting the space bar or `Shift+1` before
 * this canvas does, since jsdom models no host keymap at all.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { actionButton, activateTool, click, pointer, rig } from '../../helpers/planEditorRig';
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
/** One press of an arbitrary button, cancelable, so `defaultPrevented` means what it says. */
function pressButton(canvas: HTMLElement, button: number): PointerEvent {
	const event = new PointerEvent('pointerdown', {
		button,
		buttons: 1 << button,
		pointerId: 1,
		clientX: 300,
		clientY: 300,
		bubbles: true,
		cancelable: true,
	});
	canvas.dispatchEvent(event);
	return event;
}

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
		actionButton(harness, 'Select').click();
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
		actionButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300); // inside zone-a's footprint
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points).toEqual(before);
		harness.unmount();
	});

	it('preserves a half-drawn polygon, which is what makes this an override and not a tool', async () => {
		// The load-bearing case for the whole design. Routing this through
		// `ToolManager.setActiveTool` would run `DrawPolygonTool.deactivate()` and discard the
		// vertices already placed — and the user reaches for the pan precisely BECAUSE the
		// shape they are drawing runs off the pane.
		const { harness, canvas, zonesRepo } = await editor();
		activateTool(harness, 'draw-polygon');
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

		const listed = expectOk(await zonesRepo.listByPlan(PLAN)).loaded;
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
		actionButton(harness, 'Select').click();
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
		actionButton(harness, 'Select').click();
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
		actionButton(harness, 'Select').click();
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
		//
		// **A SECOND FINGER is what drives it, and that is a correction rather than a
		// preference.** This case used to press the middle button mid-drag, which cannot
		// produce a `pointerdown` at all: one mouse shares a `pointerId` across every button,
		// and Pointer Events sends a chorded press as a `pointermove`. So the override was
		// never asked and the refusal under test was never reached — the camera stayed put for
		// a reason the case did not name. A finger has its own pointer id and its own press,
		// which is the one input that reaches `pointerDown` while a gesture is in flight.
		const { harness, canvas, camera } = await editor();
		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();

		// Finger A drags the zone; space is pressed mid-drag, which ARMS the override without
		// claiming anything; finger B then presses, and that press is the one the guard has to
		// refuse. Space comes after A's press deliberately: armed first, and A's own press
		// would have claimed the pan instead of starting the tool gesture under test.
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 340, 300, 0, 11);
		key(canvas, 'keydown', { key: ' ' });
		await settle();
		const before = { ...camera.viewport.pan };

		pointer(canvas, 'pointerdown', 340, 300, 0, 12);
		pointer(canvas, 'pointermove', 500, 300, 0, 12);
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

		// A real event carries BOTH; these two cases used to send only `key`, which no browser
		// does — a fake thinner than the real thing, and it is why they went on passing while
		// the shortcut was dead for every non-US layout.
		key(canvas, 'keydown', { key: '!', code: 'Digit1', shiftKey: true });
		await settle();

		// The fixture zone spans (198,198)-(488,388) on screen at the default camera, so a
		// fit must zoom IN on it rather than leave the opening view alone.
		expect(camera.viewport.zoom).toBeGreaterThan(0.1);
		harness.unmount();
	});

	it('Shift+2 frames the selection', async () => {
		const { harness, canvas, camera } = await editor();
		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '@', code: 'Digit2', shiftKey: true });
		await settle();

		expect(camera.viewport).not.toEqual(before);
		harness.unmount();
	});

	it('Shift+2 with nothing selected leaves the camera alone', async () => {
		// A jump to nowhere is worse than no response: the user loses the view they had and
		// nothing tells them why.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '@', code: 'Digit2', shiftKey: true });
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

		activateTool(harness, 'draw-polygon');
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-precise']);
		harness.unmount();
	});

	it('lets the camera outrank the drawing tool, matching what the routing does', async () => {
		// The precedence that matters: space held DURING a draw pans, so the cursor must
		// promise a pan and not a vertex. The routing already behaves this way; a cursor
		// that disagreed with it would be the only thing telling the user otherwise.
		const { harness, canvas } = await editor();
		activateTool(harness, 'draw-polygon');
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});

	it('promises what a Select click would take, and a running pan still outranks it', async () => {
		// `resolveSelectionTarget` predicts through `SelectTool.pointerMove` — task 11 — so
		// hovering zone-a's body promises the same thing a click there would take.
		const { harness, canvas } = await editor();
		actionButton(harness, 'Select').click();
		await settle();

		// Screen footprint (198,198)-(488,388) is zone-a's, at the default camera.
		pointer(canvas, 'pointermove', 300, 300);
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-target']);

		// The camera outranks the tool, exactly as it does for the drawing tool above: a
		// middle-button pan claims the canvas out from under the same hover.
		pointer(canvas, 'pointerdown', 300, 300, 1);
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-panning']);
		harness.unmount();
	});

	it('says grab over a vertex handle of the selected room and pointer over its body', async () => {
		// Spec §6.2 distinguishes the two: a body promises a SELECTION, a vertex handle of an
		// already-selected room promises a DRAG of that vertex. `resolveSelectionTarget` has
		// always answered which, and the hover used to keep only the id — so the most precise
		// target on the canvas was announced as an ordinary body hit.
		const { harness, canvas } = await editor();
		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300); // select zone-a; handles only exist on a selected record
		await settle();

		pointer(canvas, 'pointermove', 199, 199); // within the grab radius of the (198,198) vertex
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-grab']);

		pointer(canvas, 'pointermove', 300, 300); // the body of the same room
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-target']);

		pointer(canvas, 'pointermove', 900, 900); // off every body: back to the resting cursor
		await settle();

		expect(cursorClasses(canvas)).toEqual([]);
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

describe('the fit shortcuts on a non-US keyboard', () => {
	/**
	 * `event.key` is what the layout PRODUCES; `event.code` is which physical key was struck.
	 * Shift+2 gives `@` on a US layout and `"` on the German and UK ones — and this plugin
	 * ships a German locale, so a German keyboard is not an edge case here. Matching on `key`
	 * made both advertised shortcuts silently dead for those users, which is the worst
	 * failure a shortcut has: nothing happens and nothing says why.
	 */
	it('frames the plan on the physical 1 key, whatever character the layout gives it', async () => {
		const { harness, canvas, camera } = await editor();

		key(canvas, 'keydown', { key: '!', code: 'Digit1', shiftKey: true });
		await settle();

		expect(camera.viewport.zoom).toBeGreaterThan(0.1);
		harness.unmount();
	});

	it('frames the selection on the physical 2 key, on a German layout', async () => {
		// Shift+2 on a German keyboard reports `key: '"'` — neither `'@'` nor `'2'`.
		const { harness, canvas, camera } = await editor();
		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '"', code: 'Digit2', shiftKey: true });
		await settle();

		expect(camera.viewport).not.toEqual(before);
		harness.unmount();
	});

	it('still needs the shift, so an unshifted digit does not jump the camera', async () => {
		// `code` alone would fire on a bare `1`, which is a key a user presses for all sorts of
		// reasons — and one a future tool hotkey would plausibly want.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		key(canvas, 'keydown', { key: '1', code: 'Digit1' });
		await settle();

		expect(camera.viewport).toEqual(before);
		harness.unmount();
	});
});

describe('wheel deltas that are not pixels', () => {
	/**
	 * `WheelEvent.deltaMode` says what the numbers MEAN: pixels (0), lines (1) or pages (2).
	 * A line-mode notch reports `deltaY: 3`, so reading it as pixels pans three of them — a
	 * gesture that looks broken rather than absent.
	 *
	 * Where this actually bites is worth being exact about, because Obsidian is Electron and
	 * Chromium reports pixel mode: it is `npm run harness`, which a designer may open in
	 * Firefox, where line mode is the historical default. The plugin itself is unlikely to
	 * see it — which is a reason to keep the conversion cheap and tested, not a reason to
	 * assume a host will never change its mind.
	 */
	it('converts a line-mode notch instead of panning three pixels', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaY: 3, deltaMode: 1, shiftKey: true });
		await settle();

		// Three LINES, not three pixels: far more than a pixel-mode 3 would have moved.
		const moved = Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom;
		expect(moved).toBeGreaterThan(20);
		harness.unmount();
	});

	it('converts a page-mode notch too, rather than falling through as pixels', async () => {
		// The third `deltaMode`. Rare, but the arm exists either way, and an untested one is
		// how a fall-through reads as deliberate.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaY: 1, deltaMode: 2, shiftKey: true });
		await settle();

		expect(Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom).toBeGreaterThan(100);
		harness.unmount();
	});

	it('leaves a pixel-mode notch exactly as it arrived', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaY: 48, deltaMode: 0, shiftKey: true });
		await settle();

		expect(Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom).toBeCloseTo(48, 6);
		harness.unmount();
	});
});

describe('a trackpad’s own horizontal swipe', () => {
	/**
	 * A two-finger sideways swipe arrives as a nonzero `deltaX` with NO modifier. Gated on
	 * `shiftKey`, that fell through to the zoom branch, which reads only `deltaY` — so with
	 * `deltaY: 0` the gesture did nothing whatsoever.
	 *
	 * Two things had already promised otherwise, which is what makes this worse than a gap:
	 * the comment inside the shift branch described trackpad swipes arriving "on every
	 * platform" from a branch that could not see them, and step 8 of
	 * `docs/tests/cases/Canvas Navigation.md` tells a tester to expect it to work.
	 */
	it('pans with no modifier held', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaX: 60, deltaY: 0 });
		await settle();

		expect(Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom).toBeCloseTo(60, 6);
		harness.unmount();
	});

	it('does not steal a vertical swipe that drifts sideways', async () => {
		// Trackpads emit a little `deltaX` during a mostly-vertical swipe. Routing on "any
		// horizontal delta at all" would turn hand tremor into a mode switch, so the larger
		// axis wins — which for this event is the vertical one, and vertical is zoom.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		wheel(canvas, { deltaX: 3, deltaY: -90 });
		await settle();

		expect(camera.viewport.zoom).toBeGreaterThan(before.zoom);
		// And it did not ALSO pan: jsdom reports a zero-sized rect, so the zoom anchors at the
		// stage origin and leaves `pan` exactly where it was — which makes an untouched `pan`
		// the sharpest available evidence that the horizontal branch was not taken.
		expect(camera.viewport.pan).toEqual(before.pan);
		harness.unmount();
	});

	it('still lets shift+wheel pan when the browser reports no horizontal delta at all', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport;

		wheel(canvas, { deltaX: 0, deltaY: 60, shiftKey: true });
		await settle();

		expect(camera.viewport.zoom).toBe(before.zoom);
		expect(camera.viewport.pan.x).not.toBe(before.pan.x);
		harness.unmount();
	});
});

describe('which axis a horizontal wheel gesture reads', () => {
	it('takes the DOMINANT delta, not merely a nonzero horizontal one', async () => {
		// Shift held over a mostly-vertical trackpad swipe: `deltaX: 1, deltaY: 100`. Picking
		// any nonzero `deltaX` in preference to `deltaY` panned one pixel for a gesture the
		// user made at full travel, which reads as the shortcut being broken rather than as a
		// scale being wrong.
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaX: 1, deltaY: 100, shiftKey: true });
		await settle();

		expect(Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom).toBeCloseTo(100, 6);
		harness.unmount();
	});

	it('still takes a dominant horizontal delta the browser produced itself', async () => {
		const { harness, canvas, camera } = await editor();
		const before = camera.viewport.pan.x;

		wheel(canvas, { deltaX: 80, deltaY: 2, shiftKey: true });
		await settle();

		expect(Math.abs(camera.viewport.pan.x - before) * camera.viewport.zoom).toBeCloseTo(80, 6);
		harness.unmount();
	});
});

describe('a button the camera does not claim', () => {
	/**
	 * `PointerEvent.button` runs past the three everyone remembers: **3 is a mouse's Back, 4
	 * its Forward, and 5 a pen's ERASER** — all of them real hardware, none of them a pan.
	 * The mapping answered `primary` for every value it did not recognise, so with space armed
	 * each of them claimed the camera and took the pointer capture with it.
	 *
	 * Only 0 and 1 can ever claim: the middle button always, the primary one while space is
	 * held. Everything else is declined at the door.
	 */
	/**
	 * **Asserted on the CLAIM, not on the camera**, and the difference is measured rather than
	 * chosen. A pan claimed by button 3 ends on its own very next move — `pointerMove` sees the
	 * primary bit absent from `buttons` and treats it as a chorded release — so the viewport
	 * never actually shifts and a case watching `pan` passes with the defect fully present.
	 * What survives that self-healing is the press itself: captured, and its default
	 * suppressed, which on a Back button is the browser's navigation.
	 */
	it.each([
		['a mouse Back button', 3],
		['a mouse Forward button', 4],
		['a pen eraser', 5],
	])('does not claim a space pan for %s', async (_label, button) => {
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		await settle();

		const event = pressButton(canvas, button);
		await settle();

		expect(event.defaultPrevented).toBe(false);
		expect([...canvas.classList]).not.toContain('rp-plan-canvas-panning');
		harness.unmount();
	});

	it('still claims one for the PRIMARY button, which is the button space is for', async () => {
		// The other direction, so the guard cannot degrade into refusing everything.
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		await settle();

		const event = pressButton(canvas, 0);
		await settle();

		expect(event.defaultPrevented).toBe(true);
		expect([...canvas.classList]).toContain('rp-plan-canvas-panning');
		harness.unmount();
	});
});

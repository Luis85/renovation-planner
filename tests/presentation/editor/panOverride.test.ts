/**
 * The pan OVERRIDE — the spring-loaded camera that outranks whichever `EditorTool` is
 * active, without going through `ToolManager` at all.
 *
 * Node, not jsdom: the machine holds no DOM and no Vue, which is the whole reason it is a
 * module rather than a handful of refs inside `PlanCanvas.vue`. What the canvas contributes
 * is translating events into these calls; what is decided here is decidable without a
 * browser, so it is decided here.
 *
 * Every rule below came out of the pattern research (`docs/tests/cases/Canvas Navigation.md`)
 * rather than from taste: holding space to pan and releasing it mid-drag without the drag
 * dying is what Photoshop, Figma and Obsidian's own Canvas all do, and a machine that
 * disarmed on keyup would strand the user's pointer halfway through a pan.
 */
import { describe, expect, it } from 'vitest';
import { PanOverride } from '../../../src/presentation/editor/viewport/pan-override';

/** A tool gesture is NOT in flight — the ordinary case, spelled once so the cases read. */
const IDLE_TOOL = { toolGestureInFlight: false };

describe('the pan override', () => {
	it('starts idle, so routing is untouched until something asks for it', () => {
		expect(new PanOverride().phase).toBe('idle');
	});

	it('a primary press with nothing armed is not a pan — the active tool still gets it', () => {
		const override = new PanOverride();

		expect(override.pointerDown('primary', IDLE_TOOL)).toBe(false);
		expect(override.phase).toBe('idle');
	});

	describe('holding space', () => {
		it('arms the camera without panning — nothing moves until the pointer goes down', () => {
			const override = new PanOverride();

			override.armSpace();

			expect(override.phase).toBe('armed');
		});

		it('turns the next primary press into a pan instead of a tool gesture', () => {
			const override = new PanOverride();
			override.armSpace();

			expect(override.pointerDown('primary', IDLE_TOOL)).toBe(true);
			expect(override.phase).toBe('panning');
		});

		it('returns to armed on release, so a second drag needs no second keypress', () => {
			const override = new PanOverride();
			override.armSpace();
			override.pointerDown('primary', IDLE_TOOL);

			expect(override.pointerUp()).toBe(true);
			expect(override.phase).toBe('armed');
		});

		it('disarms on keyup when no drag is running', () => {
			const override = new PanOverride();
			override.armSpace();

			override.disarmSpace();

			expect(override.phase).toBe('idle');
		});

		it('key REPEAT does not disturb a pan already running', () => {
			// A held key autorepeats keydown at the OS rate. The canvas filters `event.repeat`,
			// but a machine that re-armed itself out of `panning` would drop the drag on the
			// first repeat and the canvas filter would be the only thing standing between the
			// user and a broken gesture.
			const override = new PanOverride();
			override.armSpace();
			override.pointerDown('primary', IDLE_TOOL);

			override.armSpace();

			expect(override.phase).toBe('panning');
		});
	});

	describe('the gesture outliving the modifier', () => {
		it('keeps panning when space is released mid-drag', () => {
			// Releasing space with the button still down must not strand the pointer: the
			// gesture belongs to the drag, and the modifier only started it.
			const override = new PanOverride();
			override.armSpace();
			override.pointerDown('primary', IDLE_TOOL);

			override.disarmSpace();

			expect(override.phase).toBe('panning');
		});

		it('lands idle rather than armed when that drag finally ends', () => {
			const override = new PanOverride();
			override.armSpace();
			override.pointerDown('primary', IDLE_TOOL);
			override.disarmSpace();

			override.pointerUp();

			expect(override.phase).toBe('idle');
		});
	});

	describe('the middle button', () => {
		it('pans with no modifier at all — Obsidian Canvas’s own documented gesture', () => {
			const override = new PanOverride();

			expect(override.pointerDown('auxiliary', IDLE_TOOL)).toBe(true);
			expect(override.phase).toBe('panning');
		});

		it('ends idle on release, having armed nothing', () => {
			const override = new PanOverride();
			override.pointerDown('auxiliary', IDLE_TOOL);

			override.pointerUp();

			expect(override.phase).toBe('idle');
		});

		it('is refused while a tool gesture is in flight', () => {
			// The primary button is already down and a tool is mid-drag. Starting a pan under
			// it would leave that tool holding a gesture the camera is moving beneath, and the
			// eventual primary release would commit at a position the user never chose.
			const override = new PanOverride();

			expect(override.pointerDown('auxiliary', { toolGestureInFlight: true })).toBe(false);
			expect(override.phase).toBe('idle');
		});

		it('returns to ARMED on release when space is still held', () => {
			const override = new PanOverride();
			override.armSpace();

			override.pointerDown('auxiliary', IDLE_TOOL);
			override.pointerUp();

			expect(override.phase).toBe('armed');
		});
	});

	describe('cancelling', () => {
		it('abandons a running pan', () => {
			// `pointercancel`: the OS took the pointer and no `pointerup` will ever arrive.
			const override = new PanOverride();
			override.pointerDown('auxiliary', IDLE_TOOL);

			override.cancel();

			expect(override.phase).toBe('idle');
		});

		it('drops a held space, so alt-tabbing away does not leave the canvas stuck in pan mode', () => {
			// There is no global keyup listener — the canvas hears keys only while focused — so
			// focus leaving IS the only notice that a held space has ended.
			const override = new PanOverride();
			override.armSpace();

			override.cancel();

			expect(override.phase).toBe('idle');
		});
	});

	it('refuses a second button pressed during a pan, rather than switching triggers mid-gesture', () => {
		// A mouse shares one `pointerId` across its buttons, so this is an ordinary input: the
		// user is space-dragging and reflexively presses the middle button. Re-claiming would
		// rewrite which trigger owns the gesture, and the FIRST release would then end a pan
		// the still-held second button ought to be continuing.
		const override = new PanOverride();
		override.armSpace();
		override.pointerDown('primary', IDLE_TOOL);

		expect(override.pointerDown('auxiliary', IDLE_TOOL)).toBe(false);
		expect(override.phase).toBe('panning');
	});

	it('reports a pointerup it did not consume, so the active tool still gets its release', () => {
		expect(new PanOverride().pointerUp()).toBe(false);
	});
});

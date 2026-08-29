/**
 * @vitest-environment jsdom
 *
 * How the Plan Canvas ROUTES pointer input to the active tool, driven through the real
 * mounted editor (`tests/helpers/planEditorRig.ts`).
 *
 * Both cases here are event streams a real input device produces and a naive rig does not:
 * a release from a button that never pressed, and a pointer taken away with no release at
 * all. Each shipped as a defect — a right-click mid-drag committing the move at the
 * half-finished position, and a cancelled gesture staying live so the user's next click
 * anywhere moved the zone — and neither is visible from a tool's own unit test, because
 * the routing that produces them lives in the canvas.
 */
import { describe, expect, it } from 'vitest';
import { settle, settleUntil as until } from '../../helpers/editor';
import { chord, click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';

describe('the Plan Canvas pointer routing', () => {

	it('a reflexive right-click mid-drag does not commit the move; the primary release still does', async () => {
		// The canvas filtered `pointerdown` to button 0 and forwarded EVERY `pointerup`, so a
		// reflexive right-click during a drag reached `SelectTool` as a release with no
		// matching press — and it obligingly wrote the zone at the half-finished position,
		// leaving the real release a silent no-op. Both ends are filtered now.
		//
		// **The right-click is spelled as two CHORDS**, which is the only shape it can have
		// while the primary button is down: Pointer Events fires no `pointerdown` for a second
		// button and no `pointerup` until the last one comes up. This case used to send a bare
		// `pointerup` naming button 2 with the primary still held — a stream no mouse produces,
		// and one that made the case a proof about an input rather than about this canvas.
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');
		const before = expectOk(await zonesRepo.listByPlan('plan-e2e' as never))[0];

		toolbarButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300); // select zone-a — inside its (198,198)-(488,388) footprint
		await settle();

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		chord(canvas, 400, 300, 2, 3); // the right button pressed mid-drag…
		chord(canvas, 400, 300, 2, 1); // …and released, the primary still down
		await settle();

		const midDrag = expectOk(await zonesRepo.listByPlan('plan-e2e' as never))[0];
		expect(midDrag.entity.geometry.points).toEqual(before.entity.geometry.points);

		// The gesture is still live: the genuine primary release commits it.
		pointer(canvas, 'pointerup', 400, 300);
		await until(
			async () =>
				(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)))[0].entity.geometry
					.points[0].x !== before.entity.geometry.points[0].x,
			'the primary release to commit the move',
		);

		harness.unmount();
	});

	it('a pointercancel abandons the gesture instead of leaving it live for the next click', async () => {
		// No `pointerup` ever arrives when the browser claims a touch gesture for scrolling
		// or the OS grabs the pointer. Without a handler `SelectTool.gesture` stayed set, and
		// the user's NEXT click anywhere committed a move by the delta between the abandoned
		// start and that unrelated click.
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');
		const before = expectOk(await zonesRepo.listByPlan('plan-e2e' as never))[0];

		toolbarButton(harness, 'Select').click();
		await settle();
		click(canvas, 300, 300);
		await settle();

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		// **The id is named, and has to be.** This event carried none until the cancel door
		// learned to ask whose pointer was taken — `PointerEvent`'s default is `0`, while the
		// press above is the rig's default `1`, so the stream said "some OTHER pointer was
		// cancelled" and no device sends that. The case is about the gesture's OWN pointer
		// being taken away; identity simply did not matter when it was written, and a default
		// stood in for a fact. Same shape as the `buttons` correction this suite already paid
		// for: a fake thinner than the real thing is evidence about a different program.
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		await settle();

		// A later, unrelated click far away moves nothing.
		click(canvas, 900, 500);
		await settle();

		const after = expectOk(await zonesRepo.listByPlan('plan-e2e' as never))[0];
		expect(after.entity.geometry.points).toEqual(before.entity.geometry.points);
		expect(harness.wrapper.text()).not.toContain('NaN');

		harness.unmount();
	});
});

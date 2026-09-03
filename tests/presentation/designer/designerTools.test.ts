/**
 * @vitest-environment jsdom
 *
 * Design slice B5's tools, driven through the MOUNTED designer against a real geometry sidecar.
 *
 * Every case here activates a tool the way a user does — by pressing its toolbar button — and
 * then makes the gesture with pointer events obeying the real device's grammar, and asserts on
 * what ended up in the sidecar. Nothing constructs a tool, a `ToolManager` or an
 * `EditorContext` directly, and that is the point rather than a convenience: a tool proven in
 * isolation and reachable by nothing is precisely design slice 7's `CalibrateTool`, which
 * shipped that way for two slices with all four gates green.
 *
 * `designerToolbar.test.ts` is the other half — it is about the CONTROL and the registration;
 * this file is about what each gesture writes.
 *
 * **What is NOT here, and why, because its absence looks like a gap.** The tools' own button
 * guards, their `cancel`/`abandonGesture` behaviour and their preview writes cannot be reached
 * through this path at all: `EditorSurface` filters `pointerdown` and `pointerup` by button
 * before it forwards anything, and nothing on this canvas draws a preview. Measured rather than
 * assumed — deleting `SetAnchorTool`'s own primary-button guard left every case in this file
 * green — so those live in `tools/designerToolUnits.test.ts`, which drives the tools directly
 * and says at each case why the mounted path could not.
 */
import { describe, expect, it } from 'vitest';
// Mock-only surface, imported BY NAME: `Notice` carries statics (`shown`, `constructed`) the
// real `obsidian` module does not declare, so reaching them through the `'obsidian'` specifier
// would type-check against a surface that has no such thing. The vitest alias points that
// specifier at this very file, so this is the SAME class and the same statics.
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { footprintFromDimensions } from '../../../src/domain/asset/AssetShape';
import type { Point } from '../../../src/core/geometry/Point';
import { expectOk } from '../../helpers/domain';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, tracePolygon, type DesignerRig } from '../../helpers/designerRig';

/** A shape somebody has already typed, so the anchor and facing cases have a design to edit. */
const TYPED = {
	footprint: expectOk(footprintFromDimensions(1200, 800)),
	footprintOrigin: 'typed' as const,
	footprintPending: false,
	clearance: null,
	clearancePending: false,
	anchor: { x: 0, y: 0 },
	anchorPending: false,
	facing: 0,
};

/**
 * A triangle whose vertices are 100 screen pixels apart at the default camera, so no click can
 * land inside the close target of another vertex by accident — the close rule is stated in
 * screen pixels, and a fixture that ignored that would close the shape somewhere the case did
 * not intend.
 */
const TRIANGLE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 1000, y: 0 },
	{ x: 1000, y: 1000 },
];

const WIDER: readonly Point[] = [
	{ x: -500, y: -500 },
	{ x: 1500, y: -500 },
	{ x: 1500, y: 1500 },
];

async function activate(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

describe('tracing an outline', () => {
	/**
	 * TWO tools out of one `DrawPolygonTool` class, and the assertion is that each closed shape
	 * reaches the command its own button names. Both halves in one case, because a build that
	 * routed everything to the footprint would satisfy the first assertion perfectly.
	 */
	it('sends a traced footprint to the footprint and a traced clearance to the clearance', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();
		const afterFootprint = await rig.document();

		await activate(rig, 'designer.toolbar.trace-clearance');
		tracePolygon(rig, WIDER);
		await settle();
		const afterClearance = await rig.document();

		expect(afterFootprint.shape?.footprint.points).toHaveLength(3);
		expect(afterFootprint.shape?.clearance).toBeNull();
		expect(afterClearance.shape?.clearance?.points).toHaveLength(3);
		// The footprint is untouched by the clearance trace: two tools, two fields.
		expect(afterClearance.shape?.footprint.points).toEqual(afterFootprint.shape?.footprint.points);
		rig.unmount();
	});

	/**
	 * A traced footprint is `'traced'` and PENDING a scale, which is what the whole calibration
	 * story rests on (Task B6 converts exactly the groups whose flag is set). Asserted here
	 * rather than left to the command's own suite, because it is the first thing in this plugin
	 * that produces a traced outline at all.
	 */
	/**
	 * A traced CLEARANCE is undoable too, and it is asserted separately from the footprint's.
	 * The two traces are two `DrawPolygonTool` instances over two different reversible
	 * adapters, so "undo works" proven on one says nothing about the other — a completion wired
	 * to a plain command rather than an adapter would leave that tool's gestures off the stack
	 * with nothing erroring anywhere.
	 */
	it('puts a traced clearance on the undo stack too, not just the footprint', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.trace-clearance');
		tracePolygon(rig, TRIANGLE);
		await settle();
		expect((await rig.document()).shape?.clearance).not.toBeNull();

		rig.toolbarButton(t('en', 'designer.toolbar.undo')).click();
		await settle();

		expect((await rig.document()).shape?.clearance).toBeNull();
		rig.unmount();
	});

	it('records a traced footprint as traced and awaiting a scale', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();

		const shape = (await rig.document()).shape;
		expect(shape?.footprintOrigin).toBe('traced');
		expect(shape?.footprintPending).toBe(true);
		rig.unmount();
	});

	/**
	 * Two clicks are not a polygon, and the tool must write nothing for them — the close rule
	 * refuses under three vertices, so a third click back on the first is an ordinary vertex.
	 * A build that closed on two would have written a degenerate outline the domain then has to
	 * refuse, which is the wrong place for that argument to be had.
	 */
	it('writes nothing for a gesture that never closes', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		click(rig, TRIANGLE[0] as Point);
		click(rig, TRIANGLE[1] as Point);
		await settle();

		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});

	/**
	 * Task 10 gave `DrawPolygonTool` a required `onCompleted`, which the Plan Editor binds to
	 * `returnToSelect`. The designer registers no `select` tool at all (see the FIVE-tools note
	 * on `DESIGNER_TOOL_LABELS`), so both traces bind it to camera mode instead — the same
	 * substitution `DesignerCanvas.vue`'s `routeEscape` wiring already makes for its
	 * `returned-to-select` arm.
	 */
	it('a closed footprint leaves no active tool, since this surface has no Select to return to', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		expect(rig.activeToolId()).toBe('trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();

		expect(rig.activeToolId()).toBeNull();
		rig.unmount();
	});
});

/**
 * Camera mode, and the click it takes without writing anything.
 *
 * This used to be the Select tool's case: Select hit-tested an EMPTY candidate list, because
 * nothing on this canvas was selectable until Task B8, so a click through it wrote nothing and
 * selected nothing. The review-fixes plan's Task 6 withdrew that tool — a live control that did
 * nothing but stop a primary-button pan, which slice 14's amendment refuses — so this canvas now
 * rests in camera mode whenever no design tool is active, which is the state Select's own click
 * used to reach anyway for everything except the pan it blocked. The claim that survives the
 * tool's removal is the one this case pins: a click on this canvas, with nothing active to
 * receive it, writes nothing.
 */
describe('camera mode', () => {
	it('writes nothing for a click, because no tool is active to receive it', async () => {
		const rig = await designerRig({ shape: TYPED });
		const before = await rig.document();

		// No `activate(...)` call: camera mode is what the designer opens in.
		// Inside the typed 1200 x 800 footprint, which is drawn but has nothing to hit.
		click(rig, { x: 0, y: 0 });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});
});

describe('placing the anchor', () => {
	it('places the anchor with one click and writes it', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-anchor');
		click(rig, { x: 120, y: 40 });
		await settle();

		const anchor = (await rig.document()).shape?.anchor;
		expect(anchor?.x).toBeCloseTo(120, 6);
		expect(anchor?.y).toBeCloseTo(40, 6);
		rig.unmount();
	});

	/**
	 * **This case asserted the defect, end to end, and is the reported one inverted.** It read
	 * "records the placed anchor as awaiting a scale" and passed: `TYPED` is a 1200 x 800
	 * rectangle in true millimetres and this rig's asset has no spec sheet, so the click is a
	 * click in millimetres — and `!calibrated` flagged it, after which the calibration that
	 * follows multiplies the anchor out of the object it was placed inside, permanently, with
	 * the flag now down and nothing marking it. Reachable entirely through the shipped UI:
	 * create an asset with Width and Depth typed, Set anchor, click, pick a background,
	 * Calibrate.
	 *
	 * Its old docblock said "a point picked over an uncalibrated BACKGROUND", which is the
	 * right rule and was not the fixture: there was no background to pick over. The sibling
	 * case below is that sentence with a fixture that means it.
	 */
	it('leaves an anchor placed on a typed footprint with no spec sheet already in millimetres', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-anchor');
		click(rig, { x: 120, y: 40 });
		await settle();

		expect((await rig.document()).shape?.anchorPending).toBe(false);
		rig.unmount();
	});

	/**
	 * And the pair: a point picked over an UNCALIBRATED SPEC SHEET is in that sheet's
	 * placeholder coordinates and awaits a scale, whatever the footprint beside it is. Both
	 * halves, because a fix that never flagged an anchor on a typed footprint would pass the
	 * case above and silently stop converting a real trace.
	 */
	it('records an anchor placed over an unscaled spec sheet as awaiting a scale', async () => {
		const rig = await designerRig({ shape: TYPED, background: true });

		await activate(rig, 'designer.toolbar.set-anchor');
		click(rig, { x: 120, y: 40 });
		await settle();

		expect((await rig.document()).shape?.anchorPending).toBe(true);
		rig.unmount();
	});

});

describe('setting the facing', () => {
	/**
	 * **The DIRECTION of the drag, not where it ended** — the case the plan names, and the
	 * reason this gesture is a drag at all. Two drags from the same origin along the same
	 * bearing but of different lengths must set the SAME facing; a build that measured an angle
	 * from the anchor, or that used the release point's own position, answers two different
	 * numbers here.
	 */
	it('sets the facing from the direction of a drag, not from where it ended', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-facing');
		drag(rig, { x: 0, y: 0 }, { x: 0, y: 1000 });
		await settle();
		const shortDrag = (await rig.document()).shape?.facing;

		drag(rig, { x: 0, y: 0 }, { x: 0, y: 3000 });
		await settle();
		const longDrag = (await rig.document()).shape?.facing;

		expect(shortDrag).toBeCloseTo(Math.PI / 2, 6);
		expect(longDrag).toBeCloseTo(Math.PI / 2, 6);
		rig.unmount();
	});

	/**
	 * The origin is where the button went DOWN, so a drag that starts somewhere else names the
	 * same direction. Without this, "the direction of the drag" could still be read as "the
	 * bearing of the release point from the origin of the world".
	 */
	it('measures the direction from where the drag started, wherever that is', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-facing');
		drag(rig, { x: 900, y: 900 }, { x: 1900, y: 900 });
		await settle();

		// Due +x from an origin nowhere near the world origin.
		expect((await rig.document()).shape?.facing).toBeCloseTo(0, 6);
		rig.unmount();
	});

	/**
	 * SHIFT constrains to a whole 15 degrees, through the same `SnapService` and the same step
	 * the Plan Editor's drawing tools take. A drag 4 degrees off the axis lands ON the axis;
	 * the identical drag without Shift does not, which is what makes this a case about the
	 * modifier rather than about a fixture that happened to be axis-aligned.
	 */
	it('constrains the drag to a whole angle while shift is held', async () => {
		const rig = await designerRig({ shape: TYPED });
		// atan2(70, 1000) is about 4 degrees — inside half of a 15 degree step, so it snaps to 0.
		const from = { x: 0, y: 0 };
		const to = { x: 1000, y: 70 };

		await activate(rig, 'designer.toolbar.set-facing');
		drag(rig, from, to, { shiftKey: true });
		await settle();
		const constrained = (await rig.document()).shape?.facing;

		drag(rig, from, to);
		await settle();
		const free = (await rig.document()).shape?.facing;

		expect(constrained).toBeCloseTo(0, 9);
		expect(free).toBeCloseTo(Math.atan2(70, 1000), 6);
		rig.unmount();
	});

	/**
	 * And it snaps to the EDITOR's OWN step, not to some other whole angle.
	 *
	 * The case above cannot tell 15 degrees from 45: a 4 degree drag lands on zero under either.
	 * A drag at about 20 degrees discriminates them — 15 under this editor's step, 0 under a
	 * coarser one — which is what makes this a case about `EDITOR_SNAP_SERVICE` being the SAME
	 * instance the Plan Editor's tools take rather than a second service composed beside it.
	 */
	it('snaps to the editor’s own 15 degree step, not to some other whole angle', async () => {
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-facing');
		// atan2(364, 1000) is about 20 degrees: past half of a 15 degree step and well inside
		// half of a 45 degree one.
		drag(rig, { x: 0, y: 0 }, { x: 1000, y: 364 }, { shiftKey: true });
		await settle();

		expect((await rig.document()).shape?.facing).toBeCloseTo(Math.PI / 12, 9);
		rig.unmount();
	});

	/**
	 * A click names no direction, and `Math.atan2(0, 0)` answers a perfectly finite `0` — due
	 * east, a bearing the user never indicated. The tool refuses below a screen-pixel threshold
	 * rather than dispatching that.
	 */
	it('writes nothing for a click, which names no direction', async () => {
		const rig = await designerRig({ shape: { ...TYPED, facing: Math.PI } });

		await activate(rig, 'designer.toolbar.set-facing');
		click(rig, { x: 500, y: 500 });
		await settle();

		expect((await rig.document()).shape?.facing).toBeCloseTo(Math.PI, 6);
		rig.unmount();
	});
});

/**
 * A session whose settings could not be recovered composed no persistence at all, so every
 * design command it hands the designer REFUSES. The leaf still mounts, the toolbar still
 * offers its tools, and a gesture fails through the same path any other refused write takes —
 * which is what `unavailableAssetDesignerCommands` is for, and what makes it a total bundle
 * rather than a nullable one that every consumer would have to branch on.
 *
 * Driven rather than asserted at the bundle, because what is in question is the whole chain: a
 * refusing bundle whose adapters threw on the way past would take the tool with it, and the
 * user would get a dead canvas instead of a reported failure.
 */
describe('a gesture in a session with no persistence', () => {
	it('refuses rather than throwing, and writes nothing', async () => {
		const rig = await designerRig({ shape: null, unrecoveredSettings: true });

		await activate(rig, 'designer.toolbar.trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();

		// The read is the REAL one — only the write side refuses — so the sidecar is still
		// readable and still holds exactly what it held before the gesture.
		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});
});

/**
 * A PEER's write reaches this leaf, and that is a property of the BUS rather than of any
 * gesture — the one thing in this rig that the post-command refresh cannot stand in for.
 *
 * Measured rather than assumed: with no case like this, replacing the whole
 * `createAssetDesignChangeSource` subscription with `() => () => undefined` left every other
 * case in this file green, because a leaf re-reads after its OWN dispatch whatever the bus is
 * doing. A rig whose dispatching bus nothing depends on is a rig that would not notice losing
 * it.
 */
/**
 * A vault FAULT under a gesture — a THROW, which SDD §65 reserves for exactly this and which is
 * a different channel from the refusal the case above drives.
 *
 * The designer's half of a class defect: `EditorContext.commandDispatcher.run` is what all five
 * tools on both surfaces dispatch through, `withStateRefresh` re-throws on rejection by design,
 * and every tool launches its dispatch DETACHED — so a fault below the boundary was an unhandled
 * rejection that reached nobody. Only `undo()`/`redo()` were ever wrapped, and no tool calls
 * those.
 *
 * Both surfaces have this case, because the claim is a CATEGORY one and a single surface's case
 * would prove only that one composition remembered. `editorFaults.test.ts` is the other half.
 */
describe('a vault fault under a gesture', () => {
	it('reaches the user as a notice rather than an unhandled rejection, and the leaf goes on working', async () => {
		// The queue is inert until something activates it, which `onload` does in production —
		// and it is done per TEST because the queue dedups an identical sentence into a `(×N)`
		// suffix rather than constructing a second `Notice`.
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig({ shape: TYPED });

		await activate(rig, 'designer.toolbar.set-anchor');
		rig.faultNextGeometryRead();
		click(rig, { x: 120, y: 40 });
		await settle();

		expect(Notice.shown).toHaveLength(1);
		// Nothing landed: the fault is BEFORE the write, which is what makes the notice the only
		// channel — a pre-write failure leaves the save indicator neutral.
		expect((await rig.document()).shape?.anchor).toEqual({ x: 0, y: 0 });

		// And the leaf still works, which is the half a swallowed rejection also destroys: the
		// button stopped responding for the rest of the session.
		click(rig, { x: 120, y: 40 });
		await settle();

		expect((await rig.document()).shape?.anchor?.x).toBeCloseTo(120, 6);
		rig.unmount();
	});
});

describe('a change made outside this leaf', () => {
	it('re-reads the design when a peer writes it, through the subscription and not a dispatch', async () => {
		const rig = await designerRig({ shape: TYPED });
		const store = useAssetDesignStore(rig.pinia);
		expect(store.design?.shape?.facing).toBe(0);

		// A PLAIN command, dispatched by nobody in this leaf — a second designer pane, or a
		// command palette. It publishes `AssetDesignChanged` like any other write.
		expectOk(await rig.peer.setFacing.execute({ assetId: rig.assetId, facing: Math.PI / 2 }));
		await settle();

		expect(store.design?.shape?.facing).toBeCloseTo(Math.PI / 2, 6);
		rig.unmount();
	});
});

/**
 * Undo is what the reversible adapters exist for, and the toolbar has advertised it since Task
 * B3a. Driven through the real button so the whole chain is exercised: a gesture that dispatched
 * a PLAIN command rather than a reversible adapter would leave that button doing nothing, with
 * nothing erroring anywhere.
 */
describe('undoing a gesture', () => {
	it('puts a traced footprint on the undo stack, and takes it back off the sidecar', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();
		expect((await rig.document()).shape).not.toBeNull();

		rig.toolbarButton(t('en', 'designer.toolbar.undo')).click();
		await settle();
		const undone = (await rig.document()).shape;

		rig.toolbarButton(t('en', 'designer.toolbar.redo')).click();
		await settle();

		expect(undone).toBeNull();
		// And REDO puts it back, which is the half that proves the adapter kept an inverse of its
		// inverse rather than merely erasing: a build whose undo deleted the shape outright would
		// satisfy the assertion above and have nothing to re-apply here.
		expect((await rig.document()).shape?.footprint.points).toHaveLength(3);
		rig.unmount();
	});
});

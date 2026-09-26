/**
 * The wired asset designer, mounted for real — real Vue, real Pinia, real Konva, the real
 * toolbar/canvas/tool wiring — against the in-memory vault, so a traced footprint is genuinely
 * written to a geometry sidecar and the refresh genuinely re-reads what was written.
 *
 * `planEditorRig.ts`'s shape for the second editing surface, and deliberately with the two
 * properties that file had to be CORRECTED into rather than a fresh derivation of them:
 *
 * - **a DISPATCHING `EventBus`, with the same subscription the composition root makes.**
 *   `RecordingEventBus.subscribe` discards its handler, so a rig built on one has no cross-leaf
 *   refresh at all and every figure it draws is as stale as the day the fixture was written,
 *   with no assertion able to see it. `createAssetDesignChangeSource` is what the root binds
 *   `AssetDesignerDeps.onDesignChanged` to, and it is what this binds. `peer` below is what
 *   makes that observable rather than merely faithful — measured, because the first version of
 *   this rig had the dispatching bus and NO case that depended on it: replacing the whole
 *   subscription with `() => () => undefined` left every case green, since a leaf's own
 *   dispatch is re-read by `withStateRefresh` whatever the bus does.
 * - **pointer streams obeying the REAL DEVICE's grammar.** A click is down+up on the same
 *   button; a drag is down/move…/up; every move carries `buttons`; a chorded press fires no
 *   second `pointerdown`. A test that drives an impossible input is not weak evidence, it is
 *   evidence about a different program — and it stays green through every fix and every
 *   regression alike. The three gesture helpers below are the whole vocabulary, and none of
 *   them can send a press without its release.
 *
 *   **What no case here currently DEPENDS on is the intermediate move**, and that is measured
 *   rather than assumed: deleting both `pointermove`s from `drag()` leaves every case green,
 *   because both of this surface's drag-shaped gestures compute from the press and the release
 *   and use the moves only for a preview nothing on this canvas draws. The moves stay because
 *   the rule is prophylactic — the next tool to grow move-dependent behaviour must be driven by
 *   a stream a hand can produce, and a rig that had quietly stopped sending them would be the
 *   fake this bullet exists to refuse. `tests/presentation/designer/tools/
 *   designerToolUnits.test.ts` is where a move is load-bearing today.
 *
 * **The `SnapService` is the REAL one**, not a stand-in: this rig mounts the real designer,
 * which builds its context through `createEditorSnapService` — the same configuration and the
 * same 15 degree step the Plan Editor's tools take. A subclass would only be needed where a case
 * has to observe a snap call, and nothing here does; what matters is that the constraint a case
 * asserts is the one production applies.
 *
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480 per
 * axis at the default camera — which an opened asset does NOT keep (`DesignerCanvas` frames it), so
 * `options.camera` puts it back unless a case asks otherwise. `at()` below derives the screen point
 * from the LIVE viewport through the same `worldToScreen` the surface uses in reverse, so a case
 * names world millimetres and never a pixel.
 */
import Konva from 'konva';
import { createPinia, type Pinia } from 'pinia';
import VueKonva from 'vue-konva';
import { mount, type VueWrapper } from '@vue/test-utils';
import AssetDesignerRoot from '../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import type { SetAssetFacingCommand } from '../../src/application/commands/asset/SetAssetFacing';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryDocument } from '../../src/application/ports/AssetGeometrySidecar';
import type { Point } from '../../src/core/geometry/Point';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import { DEFAULT_VIEWPORT, STAGE_PIXELS, worldToScreen } from '../../src/presentation/editor/viewport/Viewport';
import { t } from '../../src/presentation/i18n/strings';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { composeDesigner } from './designerComposition';
import { expectOk } from './domain';
import { recorder } from './logger';
import { installCanvas } from './canvas';
import { installObsidianDom } from './dom';
import { installResizeObserver, placeAt, resizeTo } from './layout';
import { settle } from './editor';
import { unwiredPlanUsage } from './designerQueries';
import { editableShape } from './assetShapes';
import { accessibleName } from './accessibleName';

/**
 * The `PointerEvent.buttons` bit each `button` number stands for, per the DOM's own table —
 * including the three beyond the familiar ones, because a mouse's Back and Forward buttons and
 * a pen's eraser are real inputs a canvas has to decline rather than mishandle.
 */
const BUTTONS_BIT: Record<number, number> = { 0: 1, 1: 4, 2: 2, 3: 8, 4: 16, 5: 32 };

/**
 * One pointer event, with `buttons` DERIVED rather than left at jsdom's zero.
 *
 * A real device never sends a move with no bit set while a button is held, and the surface
 * reads exactly that bitmask to notice a button released inside a chord — so a rig that left
 * `buttons` at its default would be a fake KINDER than the real thing at the one field the
 * routing depends on. The default is what the named button implies: the bit for a press or a
 * move, nothing for a release, which is what the spec says a `pointerup` reports.
 *
 * `buttons` is a parameter as well, because a CHORD is exactly the case the default cannot
 * express: pressing a second button while the first is held arrives as a `pointermove` naming
 * the button that CHANGED and carrying every bit still down.
 */
function pointer(
	element: HTMLElement,
	type: string,
	x: number,
	y: number,
	options: { button?: number; pointerId?: number; shiftKey?: boolean; buttons?: number } = {},
): void {
	const button = options.button ?? 0;
	const buttons =
		options.buttons
		?? (type === 'pointerup' || type === 'pointercancel' ? 0 : (BUTTONS_BIT[button] ?? 0));
	element.dispatchEvent(
		new PointerEvent(type, {
			button,
			buttons,
			pointerId: options.pointerId ?? 1,
			clientX: x,
			clientY: y,
			shiftKey: options.shiftKey ?? false,
			bubbles: true,
		}),
	);
}

export interface DesignerRig {
	readonly wrapper: VueWrapper;
	readonly pinia: Pinia;
	readonly canvasEl: HTMLElement;
	readonly stage: Konva.Stage;
	readonly assetId: AssetId;
	/** The sidecar document as it stands on "disk" — what a gesture actually wrote. */
	document(): Promise<AssetGeometryDocument>;
	/** The stage pixel a world point sits at under the LIVE camera. */
	at(world: Point): { x: number; y: number };
	/**
	 * A tool button by its ACCESSIBLE name (`aria-label`), from the toolbar OR the `Add` rail —
	 * the four drawing tools live in the second since AD18-R3. Throws rather than answering
	 * `undefined`.
	 */
	toolbarButton(label: string): HTMLButtonElement;
	/** Which tool the leaf's manager has active, through the mirror `setTool` writes. */
	activeToolId(): string | null;
	/**
	 * A PEER's gesture: the plain command a second designer leaf, or a command palette, would
	 * dispatch. It publishes `AssetDesignChanged` on the shared bus like any other write, so
	 * this is what drives the cross-leaf refresh the mounted leaf subscribes to — and it is the
	 * only thing in this rig that can, since the leaf's own dispatches are re-read by the
	 * refresh decorator regardless of the bus.
	 */
	readonly peer: { setFacing: SetAssetFacingCommand };
	/**
	 * Arm the geometry sidecar to THROW on its next read — a vault fault below the boundary,
	 * which SDD §65 reserves throws for, rather than a refusal any command returns.
	 *
	 * A method rather than a construction option because a rig armed at build time would fault
	 * the mount's own read and never reach a gesture at all; the interesting moment is one
	 * gesture in, with a design already on screen. `editorFaults.test.ts`'s `ThrowingRead` is the
	 * same instrument on the Plan Editor's zone repository.
	 */
	faultNextGeometryRead(): void;
	/**
	 * Obsidian's `css-change`, delivered to this leaf through the same context member the
	 * composition root binds — so a case changes the palette on `document.body` and then fires
	 * this, which is the pair a real theme switch is.
	 *
	 * A door rather than a construction option because the interesting moment is a flip with a
	 * leaf already on screen and, for the gesture cases, a button already held; a rig that fired
	 * at build time could reach neither. It is the only thing here that can re-resolve the
	 * palette: `useThemeTokens` subscribes ONCE, at setup, and resolves again only when this is
	 * called, so a case that changes a variable without calling it asserts about the old tokens.
	 */
	fireThemeChange(): void;
	unmount(): void;
}

export interface DesignerRigOptions {
	/** The shape the sidecar starts with. `null` is an asset nobody has drawn on. */
	readonly shape?: AssetShape | null;
	/**
	 * Give the asset a spec sheet.
	 *
	 * It changes what a CAPTURE records, which is why it is a knob rather than a constant:
	 * `captureAwaitsScale` reads an unscaled background as the frame a click lands in, so the
	 * same gesture over the same typed footprint answers `pending` with a sheet and
	 * `already in millimetres` without one. Nothing here draws it — the rig's vault holds no
	 * such file, so the layer answers `unavailable` and the canvas is blank behind the shape.
	 */
	readonly background?: boolean;
	/**
	 * Compose the leaf with the bundle a session whose settings could not be recovered gets —
	 * `unavailableAssetDesignerCommands()`, every door refusing `settings.unrecovered`.
	 *
	 * A knob rather than a second rig, because what is being varied is ONE of the context's
	 * members and everything else about the leaf must stay real: the same canvas, the same
	 * toolbar, the same gestures. What a case built on it asks is whether a gesture in that
	 * session REFUSES rather than throwing through a tool that assumed a working vault.
	 */
	readonly unrecoveredSettings?: boolean;
	/**
	 * The camera a case starts at. An asset OPENS framed (`DesignerCanvas`), which moves the camera the
	 * moment the canvas is sized; `'default'` — the default — puts `DEFAULT_VIEWPORT` back after that,
	 * because the geometry every case here reasons in (10 mm per pixel, an 80 mm grab radius, the header's
	 * `world = 10 × screen − 480`) is arithmetic at that camera, and a user reaches it by zooming out.
	 * `'opened'` keeps what opening did, for the cases about the opening fit itself.
	 */
	readonly camera?: 'default' | 'opened';
	/** The device slot the View menu's choices are seeded from and written to. Default: none bound. */
	readonly viewPreferences?: AssetDesignerContext['viewPreferences'];
}

/**
 * The real sidecar, with one door that can be made to THROW.
 *
 * Subclassed rather than hand-written, for this repository's fake-too-thin rule: every other
 * door stays the production one, so a case armed with this is still driving the real read,
 * write and version handling everywhere it did not arm.
 *
 * `read` is the door because it is the first thing every design command does — see
 * `SetAssetAnchorCommand` — so arming it faults a gesture BEFORE anything is written, which is
 * the case a save indicator cannot carry and a toast therefore has to.
 */
class FaultingSidecar extends ObsidianAssetGeometrySidecar {
	throwNext = false;

	override read(assetId: AssetId): ReturnType<ObsidianAssetGeometrySidecar['read']> {
		if (this.throwNext) {
			this.throwNext = false;
			throw new Error('the vault went away mid-gesture');
		}
		return super.read(assetId);
	}
}

/**
 * The real designer over the real in-memory persistence stack.
 *
 * Everything below the view is `composeDesigner`'s (`./designerComposition`, whose header says what
 * it builds), shared with the browser harness's `&writable` knob. What is faked is the vault and
 * Obsidian's DOM, which is the line every other harness here draws.
 */
export async function designerRig(options: DesignerRigOptions = {}): Promise<DesignerRig> {
	installObsidianDom();
	installCanvas();
	installResizeObserver();

	/** The listeners a real `css-change` subscription holds, so `fireThemeChange` can fire them. */
	const themeListeners = new Set<() => void>();
	// The usage scope refuses here: this rig's stack is the ASSET side, and AD13-R1's scope walks
	// the project and plan repositories, which nothing in a canvas-and-gestures rig seeds.
	// `unwiredPlanUsage` says *I could not find out* rather than *no plan places this*, which is
	// what an unwired bundle actually knows — see its own docblock.
	const composed = await composeDesigner({
		shape: options.shape ?? null,
		background: options.background,
		sidecar: (store) => new FaultingSidecar(store),
		usage: unwiredPlanUsage,
	});
	const { assetId, sidecar } = composed;

	const context: AssetDesignerContext = {
		assetId,
		queries: composed.queries,
		commands: options.unrecoveredSettings === true ? unavailableAssetDesignerCommands() : composed.commands,
		logger: recorder,
		// This rig is about the canvas, the toolbar and the gestures — nothing here asserts on
		// the empty-state picker, so `null` is simply "unused by this rig", never a claim about
		// production, which binds a real `ObsidianBackgroundPicker` unconditionally.
		picker: null,
		// The stack's OWN fake vault, not an inert triple: the designer's background layer reads
		// through this, and a rig whose vault answered nothing would be a fake thinner than the
		// one every other read in this file goes through.
		vault: composed.vault,
		// The SAME source the composition root binds, over a bus that really dispatches: a
		// committed write publishes `AssetDesignChanged` and this leaf re-reads because of it,
		// rather than because a fixture said so.
		onDesignChanged: (listener) => composed.onDesignChanged(assetId, listener),
		// The real subscription shape, so `fireThemeChange` below delivers through the member the
		// composition root binds rather than past it — and so the unsubscribe a leaf makes on
		// unmount is a real one.
		onThemeChange: (listener) => {
			themeListeners.add(listener);
			return () => themeListeners.delete(listener);
		},
		// A source that never fires, rather than one omitted: the member is required precisely so
		// no surface can forget to answer the question, and this suite's cases are not about a file
		// moving under the surface. `backgroundInEditor.test.ts` is where that door is driven.
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		// Records nothing here: these cases are not about the dangling state. `assetDesignerRoot.test.ts`
		// is where the tree is asked whether it CALLS this, and `assetDesignerView.test.ts` whether
		// calling it detaches the leaf.
		closeLeaf: () => undefined,
		viewPreferences: options.viewPreferences,
	};

	// Attached to the document, because Konva measures its container and `getComputedStyle`
	// answers about a detached element differently — the theme resolver reads through it.
	const host = document.createElement('div');
	document.body.appendChild(host);

	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		attachTo: host,
		global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
	});
	await settle();

	const found = wrapper.find('.rp-plan-canvas');
	if (!found.exists()) throw new Error('the designer mounted no canvas; the read must have refused');
	const canvasEl = found.element as HTMLElement;
	// jsdom lays nothing out, so the stage would be 0x0 and every gesture would land at the
	// same point. Placed at the origin, so a client coordinate IS a stage coordinate.
	placeAt(canvasEl, 0, 0, 800, 600);
	resizeTo(canvasEl, 800, 600);
	await settle();

	const editor = useEditorStore(pinia);
	if (options.camera !== 'opened') editor.viewport = DEFAULT_VIEWPORT;

	return {
		wrapper,
		pinia,
		canvasEl,
		// Taken only after the canvas is proven present: `Konva.stages` is process-global, so
		// the last entry would otherwise be some previous test file's stage.
		stage: Konva.stages.at(-1) as Konva.Stage,
		assetId,
		document: async () => expectOk(await sidecar.read(assetId)).document,
		at: (world) => {
			const screen = worldToScreen(world, editor.viewport, STAGE_PIXELS);
			return { x: screen.x, y: screen.y };
		},
		toolbarButton: (label) => {
			// BOTH homes of a tool button, because AD18-R3 gave the four drawing tools a second one.
			// The name is kept, and the reason is a measurement: `grep -rn "toolbarButton(" tests/`
			// prints 47 lines in 18 files at this commit (`grep -rln`), THREE of them in this file —
			// the declaration, the `select` press in `selecting()` below, and this sentence, whose
			// own text contains the string it is counting. So every caller asks for a control by its
			// LABEL, which is the thing that did not move. What the name now MEANS
			// is "the button that activates this tool, wherever the shell draws it":
			// `.rp-designer-tools` for the ten the toolbar kept, `.rp-designer-add` for the four
			// the `Add` rail took. A caller that asked for a
			// shape by label went on compiling and started throwing when the button moved, which is
			// a SELECTOR failure dressed as a missing label.
			//
			// Resolved against `./accessibleName` rather than `.text()` alone since Task 3's fix round
			// — that module's own docblock carries why: the rail's tile now shows a shorter visible
			// label than its accessible name, so `.text()` stopped equalling the string every caller
			// here passes for a shape button specifically. Shared with `tests/harness/assetDesigner.ts`'s
			// `pressTool`, which resolves the identical two homes by the identical rule — one
			// definition rather than a second copy that broke the same way a fix round later.
			const found2 = wrapper.findAll('.rp-designer-tools button, .rp-designer-add button').find((button) => accessibleName(button.element) === label);
			if (found2 === undefined) throw new Error(`no designer toolbar button labelled ${label}`);
			return found2.element as HTMLButtonElement;
		},
		activeToolId: () => editor.activeToolId,
		peer: { setFacing: composed.setFacing },
		faultNextGeometryRead: () => {
			sidecar.throwNext = true;
		},
		fireThemeChange: () => {
			for (const listener of themeListeners) listener();
		},
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
}

/**
 * A real CLICK: down AND up at the same pixel, on the same button.
 *
 * The rig deliberately never sends a bare `pointerdown` without its `pointerup` — a real mouse
 * cannot do it, and this repository has already certified an Escape behaviour with exactly that
 * impossible sequence. A drag is `drag()` below; everything else is clicks.
 */
export function click(rig: DesignerRig, world: Point, options: { shiftKey?: boolean } = {}): void {
	const at = rig.at(world);
	pointer(rig.canvasEl, 'pointerdown', at.x, at.y, options);
	pointer(rig.canvasEl, 'pointerup', at.x, at.y, options);
}

/** A hover: a move with NO button held, which is the input a rubber band follows. */
export function move(rig: DesignerRig, world: Point): void {
	const at = rig.at(world);
	pointer(rig.canvasEl, 'pointermove', at.x, at.y, { buttons: 0 });
}

/**
 * A real DRAG: down, at least one move, up — with `buttons` carrying the held bit on the moves
 * and nothing on the release, which is what the spec says a device sends.
 *
 * The intermediate move is not decoration: a tool that only ever saw down-then-up would be
 * driven by a stream no hand produces, and every rubber band this repository draws is written
 * on a move.
 */
export function drag(
	rig: DesignerRig,
	from: Point,
	to: Point,
	options: { shiftKey?: boolean } = {},
): void {
	const start = rig.at(from);
	const end = rig.at(to);
	pointer(rig.canvasEl, 'pointerdown', start.x, start.y, options);
	pointer(rig.canvasEl, 'pointermove', (start.x + end.x) / 2, (start.y + end.y) / 2, options);
	pointer(rig.canvasEl, 'pointermove', end.x, end.y, options);
	pointer(rig.canvasEl, 'pointerup', end.x, end.y, options);
}

/**
 * A closed polygon, drawn the way a user draws one: a click per vertex, then a click back on
 * the FIRST vertex, which is what `DrawPolygonTool` treats as the close.
 *
 * The closing click is a real click at the first vertex's own coordinates rather than a
 * synthetic "close" call, so the close target's screen-pixel rule is exercised rather than
 * bypassed.
 */
export function tracePolygon(rig: DesignerRig, vertices: readonly Point[]): void {
	for (const vertex of vertices) click(rig, vertex);
	const first = vertices.at(0);
	if (first === undefined) throw new Error('a polygon needs at least one vertex to close onto');
	click(rig, first);
}

/**
 * **The Select tool's shared vocabulary for the cases that MOUNT the designer**: the tool reached
 * the way a user reaches it, the two empty-canvas corners a sweep runs between, the band it draws,
 * and the one event helper that can leave a press unreleased.
 *
 * **Not "every case whose subject is a sweep"**, which is what this sentence said first and which a
 * grep falsifies: `grep -rn "from '.*designerRig'" tests/presentation/designer/` prints NINETEEN
 * files, and three sweep-subject ones are not among them. `tools/designerSelectMarquee.test.ts` and
 * `tools/designerSelectTool.test.ts` drive `selectToolRig` — the tool against a harness context,
 * with no Vue, no Konva stage and no DOM event — so none of this reaches them; and
 * `selection/marquee.test.ts` drives neither rig, asking the pure `swept` function directly. The
 * vocabulary below is the MOUNTED surface's, and a case under `tools/` or `selection/` that looks
 * like it should share it is usually a case that has no canvas to share it with.
 *
 * They live HERE rather than in each file that needs them for a reason narrower than "duplication is
 * bad": fallow's duplication check does not read a `*.test.ts` file at all — its run prints `skipped
 * N files matching default duplicates ignores`, and N has equalled the count of test files at both
 * values it has been measured at. So a clone between two test files is invisible to every gate this
 * repository has, permanently, while `tests/helpers/` is scanned. Moving them makes them one
 * definition AND a definition something can see go wrong.
 */

/**
 * One pointer event with `buttons` as a device sets it, for the cases that assert BETWEEN a move and
 * its release — the only helper here that can send a press without one, which is exactly what an
 * interruption case needs and what `click` and `drag` deliberately refuse.
 *
 * It routes through `pointer` rather than dispatching a `PointerEvent` of its own. Two answers to
 * "send a pointer event" is how one of them quietly stops deriving `buttons` the way this file's
 * header requires; `pointer` already takes `buttons` as an option for the chord case, so this is
 * that door opened to a caller rather than a second door beside it.
 *
 * The point is a WORLD point, like every other gesture helper here, so a case names millimetres and
 * the live camera decides the pixel.
 */
export function held(rig: DesignerRig, type: string, world: Point, buttons: number): void {
	const at = rig.at(world);
	pointer(rig.canvasEl, type, at.x, at.y, { buttons });
}

/** The rubber band on the Konva stage, or `undefined` once the sweep has taken it away. */
export function band(rig: DesignerRig): Konva.Node | undefined {
	return rig.stage.findOne('.selection-marquee');
}

/**
 * Two corners of EMPTY canvas for `editableShape()`, whose clearance reaches x 700 by y 700 — so a
 * press at either is a marquee rather than a press on the clearance band, and the rectangle between
 * them meets both graphics.
 */
export const FROM: Point = { x: 1000, y: 1000 };
export const TO: Point = { x: -1000, y: -1000 };

/**
 * A SHORT sweep's far corner: ten screen pixels from `FROM` at the rig's default camera, past the
 * four-pixel threshold that makes a press a sweep and nowhere near the pane's edge — so no edge
 * scroll moves the camera under the rectangle while an assertion is being made. `TO` is the long
 * sweep and its rectangle is deliberately unpinnable for that reason.
 */
export const SHORT: Point = { x: 900, y: 900 };

/**
 * The designer with Select reached the way a user reaches it: by pressing its toolbar button.
 *
 * The shape defaults to `editableShape()` rather than to a constant shared across files: the fixture
 * is a factory and every rig gets its own instance, which is what keeps one file's gesture from
 * reaching another file's object.
 */
export async function selecting(shape: AssetShape = editableShape()): Promise<DesignerRig> {
	const rig = await designerRig({ shape });
	rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
	await settle();
	return rig;
}

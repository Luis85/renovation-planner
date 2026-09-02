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
 * which builds its context from `EDITOR_SNAP_SERVICE` — the same instance and the same 15
 * degree step the Plan Editor's tools take. A subclass would only be needed where a case has
 * to observe a snap call, and nothing here does; what matters is that the constraint a case
 * asserts is the one production applies.
 *
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480 per
 * axis at the default camera. `at()` below derives the screen point from the LIVE viewport
 * through the same `worldToScreen` the surface uses in reverse, so a case names world
 * millimetres and never a pixel.
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
import {
	createAssetDesignerCommands,
	unavailableAssetDesignerCommands,
} from '../../src/presentation/designer/designerCommands';
import { createAssetDesignerQueries } from '../../src/presentation/read-models/assetDesignerQueries';
import { GetAssetDesignQuery } from '../../src/application/queries/GetAssetDesign';
import { createAssetDesignChangeSource } from '../../src/application/events/assetDesignChangeSource';
import { SetAssetAnchorCommand } from '../../src/application/commands/asset/SetAssetAnchor';
import { SetAssetClearanceCommand } from '../../src/application/commands/asset/SetAssetClearance';
import { SetAssetFacingCommand } from '../../src/application/commands/asset/SetAssetFacing';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
} from '../../src/application/commands/asset/SetAssetFootprint';
import { SetAssetHeightCommand } from '../../src/application/commands/asset/SetAssetHeight';
import { CalibrateAssetCommand } from '../../src/application/commands/asset/CalibrateAsset';
import { SetAssetBackgroundCommand } from '../../src/application/commands/asset/SetAssetBackground';
import type { VaultFileProbe } from '../../src/application/ports/VaultFileProbe';
import type { AssetDesignCommandBundle } from '../../src/application/editor/asset/ReversibleAssetDesignCommands';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryDocument } from '../../src/application/ports/AssetGeometrySidecar';
import { createEventBus } from '../../src/core/events/EventBus';
import type { Point } from '../../src/core/geometry/Point';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import { STAGE_PIXELS, worldToScreen } from '../../src/presentation/editor/viewport/Viewport';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { createRepositoryStack } from './vault';
import { makeAsset } from './entities';
import { expectOk } from './domain';
import { recorder } from './logger';
import { installCanvas } from './canvas';
import { installObsidianDom } from './dom';
import { installResizeObserver, placeAt, resizeTo } from './layout';
import { settle } from './editor';

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
	/** A toolbar button by its rendered label. Throws rather than answering `undefined`. */
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
 * `SetAssetBackground`'s file probe, over the paths the cases driving this rig pick as spec
 * sheets. A LIST rather than the real probe over the fake vault, because the probe answers a
 * question those entries cannot: a spec sheet is a PNG or a PDF, and this fake vault holds note
 * text. A case that invents a fourth path is refused at the file check, loudly, which is the
 * failure this list is allowed to have.
 */
const SPEC_SHEETS: readonly string[] = ['Specs/oven.pdf', 'Specs/other.png', 'Specs/a.png'];
const specSheetProbe: VaultFileProbe = { fileExists: (path) => SPEC_SHEETS.includes(path) };

/**
 * The real designer over the real in-memory persistence stack.
 *
 * Everything below the view is genuine: `ObsidianAssetGeometrySidecar` over the fake vault's
 * bytes, `ObsidianAssetRepository` for the note, the six real design commands, the real
 * reversible adapters minted per leaf, and `GetAssetDesignQuery` joining the two back for the
 * read. What is faked is the vault and Obsidian's DOM, which is the line every other harness
 * here draws.
 */
export async function designerRig(options: DesignerRigOptions = {}): Promise<DesignerRig> {
	installObsidianDom();
	installCanvas();
	installResizeObserver();

	const stack = createRepositoryStack();
	const events = createEventBus();
	const sidecar = new FaultingSidecar(stack.assetGeometry);
	const written = expectOk(
		await stack.assets.save(
			makeAsset({
				height: 700,
				...(options.background === true
					? { background: { path: 'Specs/oven.png', kind: 'image' as const, page: null } }
					: {}),
			}),
			'absent',
		),
	);
	const assetId = written.entity.id;
	expectOk(await sidecar.write(assetId, { calibration: null, shape: options.shape ?? null }));

	const commandDeps = { sidecar, assets: stack.assets, events };
	// Held as a CONCRETE instance beside the annotated bundle below, for `assetDesignHarness`'s
	// reason: the bundle's members are `VersionedDesignCommand`s, which is the door the
	// reversible adapters take, while a PEER's gesture dispatches the plain `execute` a user's
	// own would. Naming only the bundle would leave `execute` unreachable and turn every peer
	// into a second versioned dispatcher, which is not the input being modelled.
	const setFacingCommand = new SetAssetFacingCommand(commandDeps);
	// The REAL bundle, every door of it, so a gesture that reaches a command reaches the one
	// production reaches. Annotated as the bundle rather than inferred, so a seventh design
	// command is a build error here rather than a door this rig silently lacks.
	const bundle: AssetDesignCommandBundle = {
		setFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand(commandDeps),
		setFootprint: new SetAssetFootprintCommand(commandDeps),
		setClearance: new SetAssetClearanceCommand(commandDeps),
		setAnchor: new SetAssetAnchorCommand(commandDeps),
		setFacing: setFacingCommand,
		setHeight: new SetAssetHeightCommand(stack.assets, events),
		calibrate: new CalibrateAssetCommand(commandDeps),
		setBackground: new SetAssetBackgroundCommand(commandDeps, specSheetProbe),
	};

	const context: AssetDesignerContext = {
		assetId,
		queries: createAssetDesignerQueries({ get: new GetAssetDesignQuery(stack.assets, sidecar) }),
		commands: options.unrecoveredSettings === true
			? unavailableAssetDesignerCommands()
			: createAssetDesignerCommands(commandDeps, bundle),
		logger: recorder,
		// This rig is about the canvas, the toolbar and the gestures — nothing here asserts on
		// the empty-state picker, so `null` is simply "unused by this rig", never a claim about
		// production, which binds a real `ObsidianBackgroundPicker` unconditionally.
		picker: null,
		// The stack's OWN fake vault, not an inert triple: the designer's background layer reads
		// through this, and a rig whose vault answered nothing would be a fake thinner than the
		// one every other read in this file goes through.
		vault: stack.vault,
		// The SAME source the composition root binds, over a bus that really dispatches: a
		// committed write publishes `AssetDesignChanged` and this leaf re-reads because of it,
		// rather than because a fixture said so.
		onDesignChanged: (listener) => createAssetDesignChangeSource(events)(assetId, listener),
		onThemeChange: () => () => undefined,
		indexScanCompleted: () => true,
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
			const found2 = wrapper.findAll('.rp-designer-tools button').find((button) => button.text() === label);
			if (found2 === undefined) throw new Error(`no designer toolbar button labelled ${label}`);
			return found2.element as HTMLButtonElement;
		},
		activeToolId: () => editor.activeToolId,
		peer: { setFacing: setFacingCommand },
		faultNextGeometryRead: () => {
			sidecar.throwNext = true;
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

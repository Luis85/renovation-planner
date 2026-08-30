import type { EntityId } from '../../src/core/identity/EntityId';
import type { Point } from '../../src/core/geometry/Point';
import { RenderState } from '../../src/presentation/editor/tools/render-state';
import { SnapService, type SnapCandidates } from '../../src/presentation/editor/snapping/snap-service';
import type { EditorContext } from '../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import type { EditorPointerEvent } from '../../src/presentation/editor/tools/editor-tool';
import { screenPoint } from '../../src/presentation/editor/viewport/Viewport';

/**
 * The `EditorContext` double every tool test needs, in ONE place.
 *
 * Three tool suites had built it from scratch — a character-identical `selection` fake, a
 * character-identical identity viewport, the same `activePlan` literal, the same eight-round
 * `flush()` — and two more files carried a fourth and fifth `stubViewport()`. Adding a
 * member to `EditorContext` therefore meant the same edit in five files, and `tests/**` is
 * not type-checked, so missing one leaves that suite exercising the old shape with nothing
 * to say so. `worldPerScreenPixel` was exactly that member.
 *
 * The camera is a REAL scale rather than an identity projection: `worldPerScreenPixel`
 * defaults to 1 (one world millimetre per pixel) and every suite can hand a different one,
 * because a tolerance bug at a non-unit camera is the class of defect these tools have now
 * shipped twice and identity stubs cannot see.
 */
export interface ToolContextHarness {
	readonly context: EditorContext;
	/** Every command the tool dispatched, in order. */
	// `UndoableCommand[]`, which is what this actually holds. It said
	// `{ execute(): Promise<Result<void, AppError>> }[]` — the shape `execute` returned before
	// slice 13 gave every dispatch a `DispatchOutcome` to report, so the array type had been
	// describing a signature that no longer exists.
	readonly dispatched: UndoableCommand[];
	/** Every message the tool sent to its rejection seam. */
	readonly rejections: string[];
}

export interface ToolContextOptions {
	/** World millimetres per screen pixel, i.e. the inverse of zoom. Default 1. */
	readonly worldPerScreenPixel?: number;
	/** Replaces the dispatcher entirely when a suite needs to fail, gate or count. */
	readonly commandDispatcher?: EditorContext['commandDispatcher'];
	/** Replaces the identity snap, for the suites that assert snapping. */
	readonly snapPoint?: (point: Point) => Point;
	readonly activePlan?: EditorContext['activePlan'];
}

/** A selection store double narrowed to `SelectionStore`'s four members, and nothing else. */
function selectionDouble(): EditorContext['selection'] {
	let ids: readonly EntityId<string>[] = [];
	return {
		get selectedIds() {
			return ids;
		},
		select(next) {
			ids = [...next];
		},
		clear() {
			ids = [];
		},
		isSelected(id) {
			return ids.includes(id);
		},
	};
}

/**
 * The REAL `SnapService`, composed with the editor's own configuration, with `snapPoint`
 * optionally replaced for the suites that assert snapping.
 *
 * A hand-written literal stood here — `{ snapPoint: … }` behind an `as never` — and it was a
 * fake thinner than the thing it stood for: the moment `snapDirection` existed, every tool
 * test drove a service that answered `undefined` for it, and the cast is what let that
 * compile. Subclassing keeps every method the real one has, so the next addition to
 * `SnapService` is present here the day it is written rather than the day someone notices.
 *
 * The angle step is the editor's, 15 degrees (`runtime.ts`'s `SNAP_SERVICE`), because a
 * constraint test that passed under a quarter-turn step and failed in the app would be worse
 * than no test.
 */
class HarnessSnapService extends SnapService {
	constructor(private readonly overridePoint?: (point: Point) => Point) {
		super({ gridSpacingMm: 100, toleranceMm: 8, angleStepRadians: Math.PI / 12 });
	}

	override snapPoint(point: Point, candidates: SnapCandidates): Point {
		return this.overridePoint === undefined ? super.snapPoint(point, candidates) : this.overridePoint(point);
	}
}

export function harnessSnapService(overridePoint?: (point: Point) => Point): SnapService {
	return new HarnessSnapService(overridePoint);
}

export function toolContext(options: ToolContextOptions = {}): ToolContextHarness {
	const dispatched: ToolContextHarness['dispatched'] = [];
	const rejections: string[] = [];
	const scale = options.worldPerScreenPixel ?? 1;

	const context: EditorContext = {
		viewport: {
			worldToScreen: (point) => screenPoint(point.x / scale, point.y / scale),
			screenToWorld: (point) => ({ x: point.x * scale, y: point.y * scale }),
			worldPerScreenPixel: () => scale,
			setPan: () => undefined,
			setZoom: () => undefined,
		},
		selection: selectionDouble(),
		snapService: harnessSnapService(options.snapPoint),
		commandDispatcher: options.commandDispatcher ?? {
			run: (command) => {
				dispatched.push(command);
				return command.execute();
			},
		},
		writeLedger: {} as never,
		renderState: new RenderState(),
		activePlan: options.activePlan ?? { id: 'plan-1' as never, calibration: null },
	};

	return { context, dispatched, rejections };
}

/**
 * One pointer event at a world position.
 *
 * `button` defaults to `'primary'` because that is the only button `PlanCanvas` routes to a
 * tool — a suite that wants a secondary release passes one deliberately, which is what the
 * guard against committing a drag on a stray right-click is asserted with.
 */
export function pointerAt(
	worldX: number,
	worldY: number,
	button: EditorPointerEvent['button'] = 'primary',
): EditorPointerEvent {
	return {
		worldPoint: { x: worldX, y: worldY },
		screenPoint: screenPoint(worldX, worldY),
		button,
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
}

/** The same event with Shift held — the angle constraint both drawing tools offer. */
export function shiftPointerAt(
	worldX: number,
	worldY: number,
	button: EditorPointerEvent['button'] = 'primary',
): EditorPointerEvent {
	const event = pointerAt(worldX, worldY, button);
	return { ...event, modifiers: { ...event.modifiers, shift: true } };
}

/** Drains a gesture's microtask chain before its dispatch result is asserted. */
export async function flushGesture(): Promise<void> {
	for (let round = 0; round < 8; round += 1) await Promise.resolve();
}

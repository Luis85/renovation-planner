import type { SessionWriteLedger } from '../../../application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { useProjectStore } from '../../stores/ProjectStore';
import type { useDialogStore } from '../../dialogs/dialog-store';
import type { ToolManager } from './tool-manager';
import { CalibrateTool } from './calibrate-tool';
import { DrawPolygonTool } from './draw-polygon-tool';
import { createPolygon } from '../../../core/geometry/Polygon';
import { areaOutline } from '../add/areaOutline';
import { DrawRoomTool } from './draw-room-tool';
import { SelectTool } from './select-tool';
import { ReversibleMoveZoneCommand } from './reversible-move-zone-command';
import type { RoomDraftStore } from '../add/room-draft-store';
import { knownDistanceSupplier } from '../shell/knownDistance';
import { tr } from '../../i18n/strings';
import { notifyOperationFailure } from '../../notices/notify';
import { reportDispatchFailure } from '../report-failure';
import type { PlanEditorContext } from '../PlanEditorContext';

/**
 * What the concrete tools of this leaf are built from.
 *
 * A bundle rather than a sixth positional parameter: adding `planId` took the argument list
 * past `max-params`, and five positional arguments of which three are stores was already at
 * that budget for a reason. `planId` is passed rather than re-derived from `context.planId`,
 * so the one cast that turns Obsidian's opaque per-leaf string into a branded id stays a
 * single site — see `subject` below, which is built from the same value.
 */
export interface EditorToolDeps {
	readonly onAreaCompleted: () => void;
	readonly context: PlanEditorContext;
	readonly planId: PlanId;
	readonly projectStore: ReturnType<typeof useProjectStore>;
	readonly ledger: SessionWriteLedger;
	readonly dialogs: ReturnType<typeof useDialogStore>;
	/**
	 * The draw-polygon tool's `onCompleted`: creation is temporary (design spec §7.3), so a
	 * closed polygon hands control straight back to Select rather than staying armed for a
	 * vertex the user did not mean.
	 */
	readonly returnToSelect: () => void;
	/** `DrawRoomTool`'s one collaborator (Task 2): the rectangle a drag or two typed lengths write. */
	readonly roomDraft: RoomDraftStore;
	/** The room tool's counted name — "Room 2", never "Zone 2" (this task's own rename). */
	readonly defaultRoomName: () => string;
}

/** The concrete tools of this slice, registered against one shared context factory. */
export function registerEditorTools(toolManager: ToolManager, deps: EditorToolDeps): void {
	const { context, planId, projectStore, ledger, dialogs, returnToSelect, roomDraft, defaultRoomName } = deps;
	toolManager.register(
		new SelectTool({
			spatialObjects: () =>
				[...projectStore.zones.values()].map((zone) => ({ id: zone.id, points: zone.points })),
			// Body drags AND vertex drags produce the same command: a vertex drag is a
			// whole-geometry replacement in which one point differs, so there is one adapter
			// and only forward/inverse change.
			createMoveGesture: (zoneId, forward, inverse) =>
				new ReversibleMoveZoneCommand(context.commands.moveObject, ledger, zoneId, forward, inverse),
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
	// Preserve the legacy free-shape Room completion; Area has its own semantic identity.
	const polygonEntries = [
		{ id: 'draw-polygon', zoneType: 'Room', defaultName: defaultRoomName, onCompleted: returnToSelect, validateOutline: createPolygon },
		{ id: 'draw-area', zoneType: 'Custom', defaultName: () => tr('editor.area.default-name', { n: String(projectStore.zones.size + 1) }), onCompleted: deps.onAreaCompleted, validateOutline: areaOutline },
	] as const;
	for (const entry of polygonEntries) {
		toolManager.register(
			new DrawPolygonTool({
				id: entry.id,
				validateOutline: entry.validateOutline,
				// What a closed polygon MEANS in the Plan Editor: a new Zone on this plan. The tool
				// itself names none of it — see `PolygonCompletion`, which the designer supplies a
				// footprint version of. The zone's default name is counted from what the editor has
				// hydrated, until a creation form asks instead.
				completion: {
					commandFor: (geometry) => {
						const command = new ReversibleCreateZoneCommand(
							context.commands.createZone,
							context.commands.deleteZone,
							ledger,
							{
								planId,
								name: entry.defaultName(),
								zoneType: entry.zoneType,
								geometry,
							},
							{
								zones: context.commands.zones,
								events: context.commands.events,
								requirements: context.commands.requirementEdits.requirements,
								logger: context.commands.logger,
							},
						);
						// An adapter rather than the command itself: `createdZoneId` is the
						// application layer's own word for this and is named by its tests and by
						// design slice 8's document, so the translation into the tool's
						// subject-agnostic `createdId` happens here, where the Zone is already known.
						return {
							execute: () => command.execute(),
							undo: () => command.undo(),
							get createdId() {
								return command.createdZoneId;
							},
						};
					},
				},
				reportRejected: reportDispatchFailure,
				reportInvalidInput: notifyOperationFailure,
				onCompleted: entry.onCompleted,
			}),
		);
	}
	toolManager.register(new DrawRoomTool({ draft: roomDraft, defaultName: defaultRoomName }));
	toolManager.register(
		new CalibrateTool({
			// The two dialogs this gesture may open, in the order it opens them. Both go
			// through the leaf's OWN store, so a calibration in one split pane cannot trap
			// the other — `DialogHost` is per view for exactly that reason.
			hasGeometryToRescale: () => projectStore.zones.size > 0,
			confirmRecalibration: async () =>
				(await dialogs.openDialog({
					kind: 'confirm',
					title: tr('editor.calibrate.recalibrate.title'),
					message: tr('editor.calibrate.recalibrate.message'),
					danger: true,
				})) === 'confirm',
			supplyKnownDistance: knownDistanceSupplier(dialogs),
			// The PLAN is bound here, in the one place this leaf's branded id already lives.
			// `CalibrateTool` serves two subjects since design slice B6 and can produce neither
			// brand — `EditorContext.subject.id` is a bare `EntityId<string>` for exactly that
			// reason — so it hands back the measurement and the caller that knows which plan
			// this is builds the input.
			createCommand: (measurement) => {
				const command = context.commands.calibratePlan();
				return {
					execute: () => command.execute({ planId, ...measurement }),
					undo: () => command.undo(),
				};
			},
			reportRejected: reportDispatchFailure,
			reportInvalidInput: notifyOperationFailure,
		}),
	);
}

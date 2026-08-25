import { err, type Result } from '../../core/result/Result';
import type {
	GeometryError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../core/errors/AppError';
import type { Command } from '../../application/commands/Command';
import type { Query } from '../../application/queries/Query';
import type { CreateZoneInput } from '../../application/commands/zone/CreateZone';
import type { MoveSpatialObjectInput } from '../../application/commands/zone/MoveSpatialObject';
import type { DeleteZoneInput } from '../../application/commands/zone/DeleteZone';
import type { GetZoneInspectorInput, ZoneInspectorFields } from '../../application/queries/GetZoneInspector';
import type { Loaded } from '../../application/ports/versioning';
import type { ZoneRepository } from '../../application/ports/ZoneRepository';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';

/**
 * The write side (and the Inspector's read side) of the Plan Editor, as slice 8 consumes
 * them. The mirror of `PlanEditorQueryServices`: application-layer interfaces handed to
 * presentation, composed at the root, never a repository the view built.
 *
 * The reversible ADAPTERS (`ReversibleCreateZoneCommand` & co.) are deliberately absent:
 * each holds one transaction's snapshot, so tools construct one PER GESTURE out of these
 * shared, stateless collaborators plus their history's `WriteLedger`. What crosses this
 * boundary is exactly what has no per-transaction state.
 */
export interface PlanEditorCommandServices {
	readonly createZone: Command<
		CreateZoneInput,
		Result<{ zone: Loaded<Zone> }, ValidationError | ReferenceError | GeometryError | PersistenceError>
	>;
	readonly moveObject: Command<
		MoveSpatialObjectInput,
		Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | ValidationError | PersistenceError>
	>;
	readonly deleteZone: Command<
		DeleteZoneInput,
		Result<{ zoneId: ZoneId }, ReferenceError | ValidationError | PersistenceError>
	>;
	/**
	 * The repository PORT, not a concrete type — the two restore halves of the create and
	 * delete adapters read their snapshots through it and write their restores back into
	 * it. Presentation holding a port is the same bargain `PlanEditorQueryServices` makes;
	 * only `infrastructure/` knows what stands behind it.
	 */
	readonly zones: ZoneRepository;
	/** The Inspector query (SDD §59), beside the commands it shares a selection with. */
	readonly zoneInspector: Query<
		GetZoneInspectorInput,
		Result<ZoneInspectorFields | null, PersistenceError | GeometryError>
	>;
}

type CreateZoneResult = Awaited<ReturnType<PlanEditorCommandServices['createZone']['execute']>>;
type MoveObjectResult = Awaited<ReturnType<PlanEditorCommandServices['moveObject']['execute']>>;
type DeleteZoneResult = Awaited<ReturnType<PlanEditorCommandServices['deleteZone']['execute']>>;
type ZoneInspectorResult = Awaited<ReturnType<PlanEditorCommandServices['zoneInspector']['execute']>>;

/**
 * The write side for a session whose settings could not be recovered — the same refusal
 * shape `unavailablePlanEditorQueries` gives the read side. Every gesture resolves a
 * failed `Result` rather than throwing where the caller checks one, so the editor stays
 * mounted and its failure surfaces through the same path any other failed write takes.
 */
function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

export function unavailablePlanEditorCommands(): PlanEditorCommandServices {
	return {
		createZone: {
			execute(): Promise<CreateZoneResult> {
				return Promise.resolve(err(persistenceFailure()) as CreateZoneResult);
			},
		},
		moveObject: {
			execute(): Promise<MoveObjectResult> {
				return Promise.resolve(err(persistenceFailure()) as MoveObjectResult);
			},
		},
		deleteZone: {
			execute(): Promise<DeleteZoneResult> {
				return Promise.resolve(err(persistenceFailure()) as DeleteZoneResult);
			},
		},
		zones: {
			getById() {
				return Promise.resolve(err(persistenceFailure()));
			},
			save() {
				return Promise.resolve(err(persistenceFailure()));
			},
			delete() {
				return Promise.resolve(err(persistenceFailure()));
			},
			listByProject() {
				return Promise.resolve(err(persistenceFailure()));
			},
			listByPlan() {
				return Promise.resolve(err(persistenceFailure()));
			},
		},
		zoneInspector: {
			execute(): Promise<ZoneInspectorResult> {
				return Promise.resolve(err(persistenceFailure()) as ZoneInspectorResult);
			},
		},
	};
}

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { isErr, type Result } from '../../../core/result/Result';
import type { AppError, GeometryError, PersistenceError } from '../../../core/errors/AppError';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneInspectorFields } from '../../../application/queries/GetZoneInspector';
import type { UndoableCommand } from '../tools/undoable-command';

/**
 * The Inspector's read model (SDD §59, design slice 6): "Selection → Inspector Query →
 * Inspector DTO → Vue UI → edit → Command". This slice builds everything up to and
 * including "edit → Command"; the Vue UI that binds a form to `dto` and calls `commit`
 * arrives with slice 8's editing commands.
 *
 * Multi-selection is deliberately shape-only here — `{ kind: 'multiple', ids }` carries
 * nothing to render a common-fields form from, and the actual bulk-edit UX is left to
 * whichever slice needs it (see the spec's Design → Inspector section).
 */
// Exported per the spec's Interfaces & Contracts block, and consumed inside this module
// (the `dto` ref, `hydrateFrom`, `refresh` further down) — but nothing outside it imports
// the type yet, since the Vue UI that binds a form to `dto` arrives with slice 8.
// Suppressed here rather than deleted, matching Zone.perimeter()'s own reasoning: deleting
// a declared capability is how it rots before its first real consumer shows up.
// fallow-ignore-next-line unused-type
export type InspectorDto =
	| { readonly kind: 'empty' }
	| { readonly kind: 'zone'; readonly id: ZoneId; readonly name: string; readonly areaMm2: number }
	| { readonly kind: 'multiple'; readonly ids: readonly EntityId<string>[] };

/**
 * What the composition root hands `createInspectorStoreDefinition`.
 *
 * **The query-input-shape resolution.** The task brief declares `GetZoneInspector` as
 * `implements Query<{ id: ZoneId }, …>` (an object input, mirroring `GetZone`'s
 * `{ zoneId }`) but sketches this port's `execute` as taking a bare `id: EntityId<string>`
 * — the two do not agree, and the brief leaves resolving that to this file. Resolved here
 * as: **the port takes the same object shape the query does.** `GetZoneInspector` already
 * takes `{ id: ZoneId }` (see that file), so this port matches it exactly rather than
 * inventing an adapter at some future composition root to paper over a difference that
 * does not need to exist. The alternative — a bare-id port with an adapter wrapping
 * `GetZoneInspector` — would add a translation this slice cannot test (no composition root
 * wiring lands until a later slice), for no benefit: nothing else consumes this port's
 * shape, so there is no second caller for a bare id to serve.
 */
export interface InspectorDeps {
	readonly query: {
		execute(input: { id: ZoneId }): Promise<Result<ZoneInspectorFields | null, PersistenceError | GeometryError>>;
	};
	readonly dispatcher: { run(command: UndoableCommand): Promise<Result<void, AppError>> };
	toCommand(edit: Record<string, unknown>): UndoableCommand;
}

function zoneDto(fields: ZoneInspectorFields): InspectorDto {
	return { kind: 'zone', id: fields.id, name: fields.name, areaMm2: fields.areaMm2 };
}

/**
 * Builds the Pinia store definition for one set of deps.
 *
 * **On calling this twice against one active Pinia instance.** `defineStore('inspector', …)`
 * registers under the fixed string id `'inspector'`; Pinia keys a running instance's store
 * registry by that id, not by which call to `defineStore` produced it. So a second call to
 * `createInspectorStoreDefinition(otherDeps)` against the SAME active Pinia instance does
 * not rebind anything — the store Pinia already has under `'inspector'` is what every
 * caller gets back, still closed over the FIRST deps. This mirrors ordinary Pinia usage
 * (`useSelectionStore()` returns the same singleton on every call for one active instance)
 * rather than being a bug in this store specifically; the surprising part is only that
 * `deps` looks like a constructor argument and is not one after the first registration.
 * The intended lifecycle is: the composition root calls this exactly once, at startup,
 * with the real deps for that Plan Editor's Pinia instance. A test that wants a second,
 * independently-bound store must call `setActivePinia(createPinia())` first, matching this
 * suite's `beforeEach` and the sibling `selectionStore`/`editorContext` tests' convention —
 * never call this factory twice against one active instance expecting two stores.
 */
export function createInspectorStoreDefinition(deps: InspectorDeps) {
	return defineStore('inspector', () => {
		const dto = ref<InspectorDto>({ kind: 'empty' });
		// What the current `dto` was hydrated from — `InspectorDeps` hands over no
		// `SelectionStore`, so this is the only way `refresh()` can re-read for the
		// CURRENT selection rather than re-selecting (see that function below).
		const lastSelection = ref<readonly EntityId<string>[]>([]);

		/** Re-runs the query for a single id, answering `null` on "not found" or a failed
		 * read alike — both cases where this function has nothing to build a fresh DTO
		 * from, and the two callers below decide differently what to do with `null`. */
		async function queryZone(id: ZoneId): Promise<InspectorDto | null> {
			const result = await deps.query.execute({ id });
			if (isErr(result) || result.value === null) return null;
			return zoneDto(result.value);
		}

		/** Selection → DTO (SDD §59's first arrow). A single id queries and answers a zone
		 * DTO; several ids answer `multiple` without ever calling the query (DoD 10); an
		 * empty selection answers `empty`, also without calling the query. A single id the
		 * query cannot resolve — not found, or a failed read — falls back to `empty`: unlike
		 * `refresh()` below, there is no PREVIOUS dto worth keeping here, since the selection
		 * itself just changed and any prior dto belongs to a different entity. */
		async function hydrateFrom(selectedIds: readonly EntityId<string>[]): Promise<void> {
			lastSelection.value = [...selectedIds];
			if (selectedIds.length === 0) {
				dto.value = { kind: 'empty' };
				return;
			}
			if (selectedIds.length > 1) {
				dto.value = { kind: 'multiple', ids: [...selectedIds] };
				return;
			}
			dto.value = (await queryZone(selectedIds[0] as ZoneId)) ?? { kind: 'empty' };
		}

		/** Edit → Command (SDD §59's last arrow), through the same single choke point tools
		 * use — the Inspector gets no separate dispatch path. One `commit` call means
		 * exactly one `toCommand` call and one `dispatcher.run` call; keystroke-coalescing
		 * on blur/enter is the future Vue UI's job, not this store's. */
		function commit(edit: Record<string, unknown>): Promise<Result<void, AppError>> {
			return deps.dispatcher.run(deps.toCommand(edit));
		}

		/**
		 * The cached read's invalidation. `dto` holds what the query resolved when the
		 * selection last changed — not a live view — so every command that mutates the
		 * selected entity leaves it stale; this re-runs the query for the selection
		 * `hydrateFrom` last recorded and replaces `dto` with the answer. A no-op — zero
		 * query calls — when that selection is not exactly one id, since neither `empty`
		 * nor `multiple` was ever sourced from the query in the first place. On a failed
		 * or not-found re-read, the previous `dto` is kept rather than blanked: a refresh
		 * that cannot confirm a change is not evidence the entity is gone, and blanking the
		 * panel on every transient read failure would be a worse UI than a one-edit-stale
		 * DTO. Never mutates what is selected — it holds no reference to a `SelectionStore`
		 * at all, so there is nothing here that could. Its caller is slice 8's post-command
		 * funnel, not each edit site; this slice declares and tests the operation only.
		 */
		async function refresh(): Promise<void> {
			if (lastSelection.value.length !== 1) return;
			const fresh = await queryZone(lastSelection.value[0] as ZoneId);
			if (fresh !== null) dto.value = fresh;
		}

		return { dto, hydrateFrom, commit, refresh };
	});
}

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { isErr, ok, type Result } from '../../../core/result/Result';
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
// (the `dto` ref, `hydrateFrom`, `refresh` further down) — slice 8's runtime imports the
// type for its own `inspectorDto` slot.
export type InspectorDto =
	| { readonly kind: 'empty' }
	| { readonly kind: 'zone'; readonly id: ZoneId; readonly name: string; readonly areaMm2: number }
	| { readonly kind: 'multiple'; readonly ids: readonly EntityId<string>[] };

/**
 * What the composition root hands `createInspectorStoreDefinition`.
 *
 * **The query-input-shape resolution.** The task brief declares `GetZoneInspector` as
 * `implements Query<{ id: ZoneId }, …>` (an object input) but sketches this port's
 * `execute` as taking a bare `id: EntityId<string>` — the two do not agree, and the brief
 * leaves resolving that to this file. Resolved here as: **the port takes the same object
 * shape the query does**, so this port matches it exactly rather than inventing an adapter
 * at some future composition root to paper over a difference that does not need to exist.
 * The key is `zoneId`, not the brief's `id`: every other query in
 * `application/queries/` names its input key after the entity (`GetZone`'s `zoneId`,
 * `GetPlan`'s `planId`, `GetProject`'s `projectId`), and a query reading "the odd one out"
 * is a difference a reader has to stop and check. The alternative — a bare-id port with an
 * adapter wrapping `GetZoneInspector` — would add a translation this slice cannot test (no
 * composition root wiring lands until a later slice), for no benefit: nothing else consumes
 * this port's shape, so there is no second caller for a bare id to serve.
 */
export interface InspectorDeps {
	readonly query: {
		execute(input: { zoneId: ZoneId }): Promise<Result<ZoneInspectorFields | null, PersistenceError | GeometryError>>;
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
		/**
		 * The stale-response guard. Every operation that can end up assigning `dto` takes a
		 * ticket from this counter BEFORE it awaits, and assigns only while its ticket is
		 * still the newest one issued.
		 *
		 * Two rapid selection changes — click, click; the ordinary case, not a contrived one
		 * — start two queries, and nothing makes a repository, a vault read or an Obsidian
		 * `MetadataCache` resolve them in the order they were asked. Without this, the
		 * SLOWER of the two wins `dto` while `lastSelection` names the other entity, and the
		 * panel shows one zone's name and area under another zone's selection with no error
		 * anywhere to notice. `refresh()` interleaving with `hydrateFrom` is the same hazard
		 * from the other direction. This is the same class of defect `CommandHistory`'s
		 * serialization queue exists for, and it is answered more cheaply here because a
		 * superseded read has nothing to preserve: the newest request's answer is the only
		 * one anybody wants, so a loser is simply dropped rather than ordered.
		 *
		 * The counter is bumped by the SYNCHRONOUS branches of `hydrateFrom` too (`empty`,
		 * `multiple`), which is load-bearing rather than tidy: selecting two zones while a
		 * single-zone query is still in flight must invalidate that query, or its late answer
		 * replaces `multiple` with one zone's DTO.
		 */
		let latestRequest = 0;

		/**
		 * Re-runs the query for a single id, preserving — not collapsing — the distinction
		 * `GetZoneInspector` (mirroring `GetZone`) states as its own contract: `ok(null)` is
		 * a DEFINITIVE "no such zone", never an error; `err(...)` is a transient read
		 * failure that says nothing about whether the zone still exists. Folding both into
		 * one `null` (an earlier version of this function did) erases exactly the signal
		 * `refresh()` below needs to tell "the entity is genuinely gone" apart from "this
		 * read didn't land" — so this returns the query's own `Result` shape, mapping only
		 * the success value onto a DTO, and lets each caller decide what its own two
		 * failure cases mean.
		 */
		async function queryZone(zoneId: ZoneId): Promise<Result<InspectorDto | null, PersistenceError | GeometryError>> {
			const result = await deps.query.execute({ zoneId });
			if (isErr(result)) return result;
			return ok(result.value === null ? null : zoneDto(result.value));
		}

		/**
		 * Selection → DTO (SDD §59's first arrow). A single id queries and answers a zone
		 * DTO; several ids answer `multiple` without ever calling the query (DoD 10); an
		 * empty selection answers `empty`, also without calling the query. A single id that
		 * the query cannot resolve — not found, or a failed read — falls back to `empty`
		 * either way: unlike `refresh()` below, there is no PREVIOUS dto worth keeping here,
		 * since the selection itself just changed and any prior dto belongs to a different
		 * entity.
		 *
		 * **Known gap, not fixed here:** a genuine "no such zone" and a transient read
		 * failure both land on `{ kind: 'empty' }` — `InspectorDto` has no error variant for
		 * a fresh selection to fall back to, and this slice does not get to widen a union
		 * the spec fixes the shape of. A real read failure on a fresh selection is therefore
		 * silently indistinguishable from an empty selection, with no signal surfaced
		 * anywhere in this layer. Left for whichever later slice adds error signalling to
		 * `InspectorDto`, or surfaces it elsewhere (e.g. a toast, a log).
		 */
		async function hydrateFrom(selectedIds: readonly EntityId<string>[]): Promise<void> {
			const request = ++latestRequest;
			lastSelection.value = [...selectedIds];
			if (selectedIds.length === 0) {
				dto.value = { kind: 'empty' };
				return;
			}
			if (selectedIds.length > 1) {
				dto.value = { kind: 'multiple', ids: [...selectedIds] };
				return;
			}
			const result = await queryZone(selectedIds[0] as ZoneId);
			if (request !== latestRequest) return; // a newer selection has superseded this read
			dto.value = !isErr(result) && result.value !== null ? result.value : { kind: 'empty' };
		}

		/** Edit → Command (SDD §59's last arrow), through the same single choke point tools
		 * use — the Inspector gets no separate dispatch path. One `commit` call means
		 * exactly one `toCommand` call and one `dispatcher.run` call, dispatching the exact
		 * command `toCommand` built; keystroke-coalescing on blur/enter is the future Vue
		 * UI's job, not this store's. */
		function commit(edit: Record<string, unknown>): Promise<Result<void, AppError>> {
			return deps.dispatcher.run(deps.toCommand(edit));
		}

		/**
		 * The cached read's invalidation. `dto` holds what the query resolved when the
		 * selection last changed — not a live view — so every command that mutates the
		 * selected entity leaves it stale; this re-runs the query for the selection
		 * `hydrateFrom` last recorded and replaces `dto` with the answer. A no-op — zero
		 * query calls — when that selection is not exactly one id, since neither `empty`
		 * nor `multiple` was ever sourced from the query in the first place.
		 *
		 * The re-read's two failure shapes are handled differently, and the difference is
		 * the whole point of keeping them apart in `queryZone`:
		 * - **A transient read failure (`err(...)`)** says nothing about whether the entity
		 *   still exists, so the previous `dto` is kept rather than blanked — a refresh that
		 *   cannot confirm a change is not evidence the entity is gone.
		 * - **A genuine not-found (`ok(null)`)** is exactly that evidence — `GetZoneInspector`
		 *   states `ok(null)` as DEFINITIVE "no such zone" — so `dto` transitions to
		 *   `{ kind: 'empty' }` rather than going on showing a deleted zone's stale name and
		 *   area forever, which is the same "silently wrong panel" defect the spec's whole
		 *   cached-read argument exists to prevent, reintroduced one branch over.
		 *
		 * Like `hydrateFrom`, it takes a ticket from `latestRequest` before awaiting and
		 * assigns nothing if a newer request was issued meanwhile — a re-read of the
		 * selection the user has already moved off is exactly as stale as an out-of-order
		 * hydrate, and the "keep the previous dto" rule above is about a failed read, not
		 * about a superseded one.
		 *
		 * Never mutates what is selected — it holds no reference to a `SelectionStore` at
		 * all, so there is nothing here that could. Its caller is slice 8's post-command
		 * funnel, not each edit site; this slice declares and tests the operation only.
		 */
		async function refresh(): Promise<void> {
			if (lastSelection.value.length !== 1) return;
			const request = ++latestRequest;
			const result = await queryZone(lastSelection.value[0] as ZoneId);
			if (request !== latestRequest) return; // a newer selection has superseded this read
			if (isErr(result)) return;
			dto.value = result.value ?? { kind: 'empty' };
		}

		return { dto, hydrateFrom, commit, refresh };
	});
}

/**
 * The shared rig behind `assetDesignerUsePlan`'s cases (`src/plugin/renovationProjectOpenSeams.ts`):
 * a two-plan, one-project index, the seam wired over a real `FakeWorkspace`, the picker a case
 * opened, and the seam's own detached-flush.
 *
 * Extracted from `assetDesignerUsePlanChoice.test.ts`, which duplicated `assetDesignerUsePlan.test.ts`'s
 * `index`/`wired`/`pickerAt`/`flush` (and the four fixture ids) byte-for-byte — a clone between two
 * `*.test.ts` files that fallow's duplication check never sees (CLAUDE.md: it skips every file
 * matching `tests/**\/*.test.ts`), so `tests/helpers/` is what turns it into one definition and a
 * scanned one.
 */
import { FuzzySuggestModal } from './obsidian-mock';
import { assetDesignerUsePlan } from '../../src/plugin/renovationProjectOpenSeams';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { recorder } from './logger';
import { FakeWorkspace } from './workspace';
import { createEntityId } from '../../src/core/identity/generateId';
import type { ProjectIndex, ProjectIndexEntry } from '../../src/application/ports/ProjectIndex';
import type { ContinueContext } from '../../src/application/continueContext';

export const GROUND = createEntityId('plan');
export const FIRST = createEntityId('plan');
export const PROJECT = createEntityId('project');
/** The asset every press through this rig carries. */
export const ASSET = createEntityId('asset');

/**
 * An index holding two plans and a project, so the picker's own type filter is asked to reject
 * something: an unfiltered `entries()` would satisfy every assertion about a plan row.
 *
 * `GROUND` carries a `projectId` and `FIRST` deliberately does not. `ProjectIndexEntry.projectId`
 * is optional, and the Continue arm some cases drive is guarded on it — so an index where every
 * plan had one would leave that guard's other branch undriven and the seam free to drop the check.
 */
function index(): ProjectIndex {
	const built = new InMemoryProjectIndex();
	built.upsert({ id: PROJECT, type: 'renovation-project', path: 'Renovation/Flat.md' });
	built.upsert({ id: GROUND, type: 'renovation-plan', path: 'Renovation/Plans/Ground floor.md', projectId: PROJECT });
	built.upsert({ id: FIRST, type: 'renovation-plan', path: 'Renovation/Plans/First floor.md' });
	return built;
}

/**
 * The seam wired over a `FakeWorkspace` (real unless `options.workspace` overrides it) and
 * `index()` (real unless `options.index` overrides it — `undefined` is a vault with no index
 * composed at all, a separate case from an index that holds nothing).
 */
export function wired(options: { readonly index?: ProjectIndex | undefined; readonly workspace?: unknown } = {}): {
	readonly workspace: FakeWorkspace;
	readonly usePlan: () => void;
	readonly remembered: ContinueContext[];
} {
	// Cast for the same reason `planEditorCommands.test.ts` casts its own override: a workspace
	// planted to FAULT models only the two members the reveal path reaches, and the cases that
	// use the real fake still want its recorders.
	const workspace = (options.workspace ?? new FakeWorkspace()) as FakeWorkspace;
	const remembered: ContinueContext[] = [];
	// ANNOTATED at the signature ICR 1-H gives this seam, not at the one it has. `() => void` is
	// assignable to `(assetId: string) => void`, so this line compiles on both sides of that
	// change and the extra argument is simply dropped by today's build. Every case presses through
	// the wrapper, so the widening needs no edit to any of them.
	const send: (assetId: string) => void = assetDesignerUsePlan(
		{ workspace } as never,
		'index' in options ? options.index : index(),
		recorder,
		(context) => remembered.push(context),
	);
	return { workspace, usePlan: () => { send(ASSET); }, remembered };
}

/** The picker this call opened, typed to the two members these cases drive. */
export function pickerAt(position: number): FuzzySuggestModal<ProjectIndexEntry> {
	const picker = FuzzySuggestModal.opened[position];
	if (picker === undefined) throw new Error(`no picker was opened at position ${String(position)}`);
	return picker as FuzzySuggestModal<ProjectIndexEntry>;
}

/**
 * The seam dispatches through a promise chain it deliberately does not return — every door here
 * is detached — so a macrotask hop rather than a counted number of `await`s, for
 * `assetDesignerCommands.test.ts`'s own reason: the chain's length is an implementation detail.
 */
export function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

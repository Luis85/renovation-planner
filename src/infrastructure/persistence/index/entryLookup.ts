/**
 * "Which ENTRY carries this id" — the one question `ProjectIndex` does not answer.
 *
 * The port hands back a PATH (`getPath`) and three lists of ids, and neither shape carries an
 * entry's own `type`, which is what every caller of this actually wants. So this is a scan over
 * `entries()`, written once.
 *
 * **Once, because it was twice and the docblock that argued for keeping it narrow was the thing
 * that went false.** `VaultChangeAdapter.findById` carried the argument against widening the
 * port — *"a `getById` would be the smaller change and a wider surface — this pipeline is the
 * only caller"* — and stayed word for word correct while
 * `ReconcilingProjectIndex.demoteDisplaced` hand-spelled the identical `entries().find(…)` in a
 * different module. No
 * edit made that sentence false; a second caller did, which is the failure mode a caller LIST
 * has and a function does not.
 *
 * So this file states no caller list of its own — deliberately, since a grep quoted HERE would
 * match its own quotation, `src/` being the tree it would have to search. Today the callers are
 * the pipeline's `findById` and the reconciling index's `demoteDisplaced`, each of which names
 * this function where it calls it; a third one costs nothing here and makes nothing here false.
 *
 * Still not a port method, and now for a reason that survives a third caller: `ProjectIndex` is
 * implemented twice (`InMemoryProjectIndex` and the `ReconcilingProjectIndex` wrapper over it),
 * so a `getById` is two implementations and a decorator hop to answer what a caller can ask of
 * `entries()` — and every caller here already holds the index it means. What a port method WOULD
 * buy is an O(1) answer; that is a change to `InMemoryProjectIndex`'s own storage, and the day
 * this scan is measured to cost something is the day to make it, with a benchmark rather than
 * with this comment.
 *
 * **Its cost is real and is stated where it is paid rather than here**: `entries()` materialises
 * the whole index into a fresh array, so `demoteDisplaced` asks the O(1) `getPath` FIRST and
 * reaches this only for a genuine collision. A caller that can rule the question out cheaply
 * should.
 */
import type { EntityId } from '../../../core/identity/EntityId';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';

export function entryById(
	index: ProjectIndex,
	id: EntityId<string>,
): ProjectIndexEntry | undefined {
	return index.entries().find((entry) => entry.id === id);
}

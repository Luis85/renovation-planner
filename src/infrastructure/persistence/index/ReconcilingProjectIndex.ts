import { TFile, type MetadataCache, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type {
	EntityType,
	ExcludedNote,
	ProjectIndex,
	ProjectIndexEntry,
} from '../../../application/ports/ProjectIndex';
import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EventBus } from '../../../core/events/EventBus';
import {
	projectIndexEntryChanged,
	projectIndexExclusionChanged,
} from '../../../application/events/projectIndex.events';
import { entityRefOf, stringField } from './buildProjectIndexEntries';
import { promotedSidecarMapping } from './sidecarMapping';
import type { EchoWindow } from './EchoWindow';
import { frontmatterOf } from '../../obsidian/repositories/noteIo';

/**
 * The `ProjectIndex` the composition root hands out: an inner index that stores, wrapped in
 * the one rule neither the store nor any writer can keep on its own — **a `duplicate-id`
 * exclusion is relative to a WINNER, so taking an id demotes whoever held it and vacating an
 * id re-opens the question for every note still claiming it** (§5.1a).
 *
 * **Why the index rather than the pipeline, which is where this rule was born.** Promotion
 * shipped inside `VaultChangeAdapter`, so it held for the doors a user reaches from OUTSIDE
 * the app — the file explorer, a sync, a hand edit — and for no other. Five repositories
 * mutate the index themselves on their own writes (SDD §42), and two of those mutations are
 * the ordinary in-app resolution of a collision:
 *
 * - `trashNoteBackedEntity` removes the entry AFTER awaiting `trashFile`, so a duplicate
 *   winner deleted through a command either had the vault event's promotion undone by that
 *   removal or never triggered one. The surviving note stayed unindexed — and unselectable,
 *   every read here resolving through the index — until the next full rebuild.
 * - the same function's ROLLBACK puts the winner's entry back when `alsoRemove` refuses, and
 *   the entry it displaces is the loser the vault event had just promoted. Through the raw
 *   port that loser left the entries and gained no descriptor: in NEITHER collection, so the
 *   repair strip could not even name the file.
 *
 * **Why not an observer the pipeline registers on the index**, which was the other shape
 * offered. An observer is a second mechanism to wire and a second thing a composition can
 * forget, and it would still leave the port's own `upsert`/`remove` able to break the
 * invariant for anyone holding the inner index. Wrapping answers every writer INCLUDING ones
 * not yet written, because there is one object and no writer can hold anything else — which
 * is this repository's own "a question worth asking at one door is a function" applied to a
 * rule that had been kept at one door out of six.
 *
 * **Promotion needs the vault and the metadata cache, which is why it cannot live in
 * `InMemoryProjectIndex`**: re-opening the question means reading the frontmatter of every
 * note still holding a `duplicate-id` descriptor, and `ProjectIndex` is a pure port with
 * neither collaborator. That is the whole reason this is a wrapper in `infrastructure/`
 * rather than a change to the store.
 *
 * **What it announces, and what it deliberately does not.** It publishes the changes it makes
 * on its OWN initiative — the descriptor a demotion adds, the descriptor a promotion drops,
 * and the entry a promotion creates — because nothing else knows they happened. It does NOT
 * announce the caller's own `upsert`/`remove`: `VaultChangeAdapter` announces those for the
 * out-of-band doors, and a repository's own write is already reported by the domain event its
 * command publishes. Announcing there too would fire a second refresh per save and make the
 * index, rather than the domain, the thing views listen to — which is the reason the pipeline's
 * echo check exists at all. In a vault with no collision this wrapper therefore announces
 * nothing on any repository write, because every one of its three doors is guarded.
 */
export class ReconcilingProjectIndex implements ProjectIndex {
	constructor(
		private readonly inner: ProjectIndex,
		private readonly deps: {
			vault: Vault;
			metadataCache: MetadataCache;
			echo: EchoWindow;
			events: EventBus;
			logger: Logger;
		},
	) {}

	getPath(id: EntityId<string>): string | undefined {
		return this.inner.getPath(id);
	}

	getGeometrySidecarPath(entityId: EntityId<string>): string | undefined {
		return this.inner.getGeometrySidecarPath(entityId);
	}

	getIdsByType(type: EntityType): EntityId<string>[] {
		return this.inner.getIdsByType(type);
	}

	getIdsByProject(projectId: ProjectId): EntityId<string>[] {
		return this.inner.getIdsByProject(projectId);
	}

	getSpatialObjectIdsByPlan(planId: PlanId): EntityId<string>[] {
		return this.inner.getSpatialObjectIdsByPlan(planId);
	}

	listExclusions(): readonly ExcludedNote[] {
		return this.inner.listExclusions();
	}

	entries(): readonly ProjectIndexEntry[] {
		return this.inner.entries();
	}

	/**
	 * A rebuild replaces both collections in one call, from a scan that has already applied
	 * last-writer-wins across the whole vault — so there is nothing left to reconcile and
	 * re-opening the question here would ask it of the answer.
	 */
	rebuild(entries: readonly ProjectIndexEntry[], exclusions: readonly ExcludedNote[]): void {
		this.inner.rebuild(entries, exclusions);
	}

	/**
	 * Taking an id: any descriptor naming this PATH is spent, and whatever different note held
	 * this ID is demoted in the same step.
	 *
	 * Both were the pipeline's, three lines above its own `applyUpsert`, and both are properties
	 * of the upsert rather than of the door that asked for one — which is what the ROLLBACK door
	 * proved by not having them.
	 */
	upsert(entry: ProjectIndexEntry): void {
		this.removeExclusion(entry.path);
		this.demoteDisplaced(entry);
		this.inner.upsert(entry);
	}

	/**
	 * Vacating an id re-opens the question for the notes still claiming it.
	 *
	 * No guard on the entry having existed: `promote` asks the EXCLUSIONS, and an id nothing
	 * held has no contenders to find, so the branch a `findById` would add here is one nothing
	 * could ever discriminate.
	 */
	remove(id: EntityId<string>): void {
		this.inner.remove(id);
		this.promote(id);
	}

	addExclusion(note: ExcludedNote): void {
		const previous = this.inner.listExclusions().find((excluded) => excluded.path === note.path);
		this.inner.addExclusion(note);
		// **A retype announces TWICE, one event per type.** A descriptor is keyed by path, so a
		// no-id `renovation-asset` edited into a no-id `renovation-project` REPLACES it — and
		// consumers filter on `entityType`, which is the whole reason the payload carries one.
		// Announcing only what it became tells every subscriber except the one that needed
		// telling: the asset library never hears that its broken note left, and keeps a repair
		// row for a note that is now somebody else's problem.
		if (previous !== undefined && previous.entityType !== note.entityType) {
			this.announceExclusion(previous);
		}
		this.announceExclusion(note);
	}

	/**
	 * The removal LOOKS UP the descriptor before dropping it, because the announcement carries
	 * the excluded note's type and after the removal there is nothing left to ask. It is also
	 * what keeps this quiet: a path with no descriptor is the ordinary case at every door that
	 * calls it — every deleted path, every note edit, every repository save — and announcing
	 * there would fire an exclusion event for all of them.
	 */
	removeExclusion(path: string): void {
		const note = this.inner.listExclusions().find((excluded) => excluded.path === path);
		if (note === undefined) return;
		this.inner.removeExclusion(path);
		this.announceExclusion(note);
	}

	/**
	 * The note that just lost its id says so, instead of leaving the index silently.
	 *
	 * `upsert` is keyed by id, so without this the displaced note's path is in neither
	 * `entries()` nor `listExclusions()` — not reported as unreadable and not in the catalogue,
	 * gone from every surface at once, which is worse than being classified wrongly because a
	 * repair list cannot even name the file.
	 *
	 * The descriptor takes the DISPLACED entry's own type: this index is one global id
	 * namespace, so the arriving note may not be the same kind of thing at all.
	 *
	 * The existence check is what keeps this from crying wolf on a MOVE or a RENAME. A sync
	 * that relocates a note without a `rename` event arrives as a create at the new path while
	 * the index still points at the old one, which looks identical to a duplicate until you ask
	 * whether a file is still sitting there — and the pipeline's own rename re-points an entry
	 * to a new path whose old one is a duplicate of nothing.
	 */
	private demoteDisplaced(entry: ProjectIndexEntry): void {
		const displaced = this.inner.entries().find((held) => held.id === entry.id);
		if (displaced === undefined || displaced.path === entry.path) return;
		if (!(this.deps.vault.getAbstractFileByPath(displaced.path) instanceof TFile)) return;

		this.deps.logger.warn('persistence.pipeline.duplicate-id', {
			id: entry.id,
			path: entry.path,
			otherPath: displaced.path,
			reason: 'another note already declares this id; it is no longer reachable',
		});
		this.addExclusion({ path: displaced.path, entityType: displaced.type, reason: 'duplicate-id' });
	}

	/**
	 * Exactly ONE of the notes still claiming a vacated id becomes the entry — never only when
	 * exactly one is left.
	 *
	 * **"When exactly one remains" was the first version of this rule and it is wrong for three
	 * notes.** With three sharing an id, deleting the winner leaves two contenders, so a
	 * sole-survivor condition promotes neither and the id leaves every surface entirely — worse
	 * than the collision being resolved, and a state the SCAN cannot produce: `collectNotes` is
	 * last-writer-wins over an id-keyed map, so a rebuild ends with exactly one winner however
	 * many notes collide. A door that can reach a state its own full rebuild cannot is a door
	 * that disagrees with the thing it is an increment of.
	 *
	 * **Which one is not a free choice either.** `contendersFor` hands them back in the vault's
	 * own enumeration order and this takes the LAST — which is what last-writer-wins picks, so
	 * the promotion an event makes and the one the next reload makes name the same file.
	 *
	 * The promotion goes through this class's own `upsert`, so the descriptor it drops and the
	 * demotion it cannot need are one rule rather than two spellings of it.
	 */
	private promote(vacated: EntityId<string>): void {
		const promoted = this.contendersFor(vacated).at(-1);
		if (promoted === undefined) return;

		const entry = { ...promoted, geometrySidecarPath: promotedSidecarMapping({ ...this.deps, index: this.inner }, promoted) };
		this.upsert(entry);
		void this.deps.events.publish(projectIndexEntryChanged({ entityId: entry.id, entityType: entry.type }));
	}

	/**
	 * The notes still claiming an id, in the order a FULL REBUILD would reach them.
	 *
	 * The vault walk is guarded on there being any such descriptor at all, which in a healthy
	 * vault is none — so an ordinary delete pays a `listExclusions()` filter and stops.
	 *
	 * Each candidate's frontmatter is re-read rather than trusted, because a descriptor records
	 * what was true when it was made: a vault edited while Obsidian was closed can have left the
	 * loser declaring another id, or nothing of ours at all.
	 */
	private contendersFor(id: EntityId<string>): ProjectIndexEntry[] {
		const excluded = new Set(
			this.inner
				.listExclusions()
				.filter((note) => note.reason === 'duplicate-id')
				.map((note) => note.path),
		);
		if (excluded.size === 0) return [];

		const contenders: ProjectIndexEntry[] = [];
		for (const file of this.deps.vault.getMarkdownFiles()) {
			if (!excluded.has(file.path)) continue;
			const frontmatter = frontmatterOf(this.deps, file);
			const ref = entityRefOf(frontmatter);
			if (ref.kind !== 'ours' || ref.id !== id) continue;
			contenders.push({
				id: ref.id as ProjectIndexEntry['id'],
				type: ref.type,
				path: file.path,
				projectId: stringField(frontmatter['project']) as ProjectIndexEntry['projectId'],
				planId: stringField(frontmatter['plan']) as ProjectIndexEntry['planId'],
			});
		}
		return contenders;
	}

	/**
	 * Fire-and-forget, which this repository normally treats as a defect and here is safe for a
	 * reason worth stating: `createEventBus.publish` NEVER rejects — a throwing handler is
	 * isolated per subscriber and handed to the bus's own `onError`. It has to be
	 * fire-and-forget either way, since a repository's synchronous index upsert sits inside an
	 * awaited write and a vault callback is synchronous.
	 */
	private announceExclusion(note: ExcludedNote): void {
		void this.deps.events.publish(projectIndexExclusionChanged({ path: note.path, entityType: note.entityType }));
	}
}

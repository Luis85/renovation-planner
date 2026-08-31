import { TFile, type MetadataCache, type TFile as TFileType, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { EventBus } from '../../../core/events/EventBus';
import { projectIndexEntryChanged } from '../../../application/events/projectIndex.events';
import { entityRefOf, sidecarMappingFor, stringField } from './buildProjectIndexEntries';
import type { EchoWindow } from './EchoWindow';
import { observeFrontmatter } from '../../obsidian/repositories/digest';
import { frontmatterOf } from '../../obsidian/repositories/noteIo';

/**
 * The vault-change pipeline (SDD §46): Obsidian's create/modify/rename/delete events,
 * debounced per path, resolved ("is this file one of ours?"), validated against the
 * cached frontmatter, and applied to the Project Index incrementally.
 *
 * The repositories update the index synchronously on their own writes; this pipeline is
 * the SOLE path for everything else — hand edits, sync, another device. A `modify` whose
 * freshly computed digest still matches what this plugin last wrote is an ECHO of the
 * plugin's own write and is dropped (`EchoWindow`); anything else is real and updates
 * the index. A malformed note is excluded with a diagnostic rather than aborting the
 * rest of the scan — one broken file must not take down the vault's data.
 */
export class VaultChangeAdapter {
	private readonly pending = new Set<string>();
	private timer: number | null = null;

	constructor(
		private readonly deps: {
			vault: Vault;
			metadataCache: MetadataCache;
			index: ProjectIndex;
			echo: EchoWindow;
			events: EventBus;
			logger: Logger;
			/** Tests flush synchronously by passing 0. */
			debounceMs?: number;
		},
	) {}

	/** The four handlers a plugin registers its vault events with. */
	onCreate(file: TFileType): void {
		this.enqueue(file.path);
	}

	onModify(file: TFileType): void {
		this.enqueue(file.path);
	}

	onDelete(file: TFileType): void {
		// Renames and deletes apply immediately, in order against pending writes.
		this.pending.delete(file.path);
		this.processPath(file.path);
	}

	onRename(file: TFileType, oldPath: string): void {
		// A rename moves an EXISTING entry regardless of content echoes — the bytes did
		// not change, so the digest still matches and a debounced re-add would drop the
		// entry entirely. Re-point it here, carry the echo token to the new path, then
		// re-evaluate content at the new path: a foreign edit that raced the rename is
		// applied there (echo suppression only skips UNCHANGED bytes), with the entry —
		// and any sidecar mapping — carried through.
		const existing = this.findByPath(oldPath);
		if (!existing) {
			this.pending.delete(oldPath);
			this.processPath(oldPath);
			this.enqueue(file.path);
			return;
		}
		this.applyUpsert({ ...existing, path: file.path });
		this.deps.echo.move(oldPath, file.path);
		this.pending.delete(oldPath);
		this.enqueue(file.path);
	}

	flush(): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		for (const path of Array.from(this.pending)) {
			this.pending.delete(path);
			this.processPath(path);
		}
	}

	private enqueue(path: string): void {
		// A zero debounce means "process synchronously" — what tests use, and what keeps
		// this module free of timer APIs when it runs outside a browser window.
		if ((this.deps.debounceMs ?? 500) <= 0) {
			this.processPath(path);
			return;
		}
		this.pending.add(path);
		if (this.timer === null) {
			this.timer = window.setTimeout(() => this.flush(), this.deps.debounceMs);
		}
	}

	private processPath(path: string): void {
		if (path.endsWith('.rpgeo')) {
			this.processSidecar(path);
			return;
		}
		const abstractFile = this.deps.vault.getAbstractFileByPath(path);
		const existing = this.findByPath(path);

		if (!(abstractFile instanceof TFile)) {
			// Deleted (or replaced by something that is not a note).
			if (existing) {
				this.applyRemove(existing);
				this.deps.echo.forget(path);
			}
			return;
		}
		this.processNote(abstractFile, existing);
	}

	private processNote(file: TFile, existing: ProjectIndexEntry | undefined): void {
		const path = file.path;
		// Through `frontmatterOf`, and this one is a RACE rather than a nicety: Obsidian
		// raises `create` for this plugin's own writes, and if that event is processed
		// before Obsidian has parsed the new file, a direct cache read answers nothing —
		// so a note we had just indexed would be read as "not ours" and REMOVED from the
		// index below, with no future event to put it back.
		const frontmatter = frontmatterOf(this.deps, file);

		const ref = entityRefOf(frontmatter);
		if (ref.kind !== 'ours') {
			// The narrowing above is `!== 'ours'`, so a NEW arm of `EntityRef` reaches here and
			// is excluded correctly with no diagnostic and no compile error — measured when
			// `bad-id` briefly existed: adding it failed the build at the scan and said nothing
			// here. The scan's branches are compiler-enforced; this door's are not, so a third
			// excluded kind must be spelled out rather than left to a default.
			if (ref.kind === 'no-id') {
				this.deps.logger.warn('persistence.pipeline.note-excluded', {
					path,
					reason: 'a note of this plugin must declare a non-empty id',
				});
			}
			// Not ours — but if it USED to be, it changed into something we cannot index.
			if (existing) {
				this.applyRemove(existing);
				this.deps.echo.forget(path);
			}
			return;
		}

		// Echo suppression: the digest of what sits on disk now vs. what this plugin last
		// wrote there. Equal means our own write echoed back through Obsidian's events.
		if (this.deps.echo.matches(path, observeFrontmatter(frontmatter))) return;

		this.warnOnDuplicateId(ref.id, path);

		this.applyUpsert({
			id: ref.id as ProjectIndexEntry['id'],
			type: ref.type,
			path,
			projectId: stringField(frontmatter['project']) as ProjectIndexEntry['projectId'],
			planId: stringField(frontmatter['plan']) as ProjectIndexEntry['planId'],
			// Preserve a sidecar mapping an out-of-band note edit cannot have moved —
			// the sidecar path lives only here and in the Plan repository's writers.
			geometrySidecarPath:
				ref.type === 'renovation-plan'
					? (existing?.geometrySidecarPath ?? this.deps.index.getGeometrySidecarPath(ref.id as never))
					: undefined,
		});
	}

	private processSidecar(path: string): void {
		// The plan id is the sidecar's basename (ADR-011), which is what `joinSidecars`
		// reads too. It used to be recovered by slicing a configured prefix off the front,
		// and that is the same bound the scan just lost: a sidecar under a second root
		// answered no plan at all.
		const planId = path.slice(path.lastIndexOf('/') + 1).replace(/\.rpgeo$/, '');
		const planEntry = this.findByPath(this.deps.index.getPath(planId as never) ?? '');

		// A sidecar DELETED out of band (file explorer, sync) clears the mapping instead
		// of re-affirming a path that no longer exists — leaving it would break every
		// Zone read on this Plan with no future event to repair it. Ahead of every other
		// question, including whether a plan claims it: a delete needs no plan entry to be
		// handled, and an unindexed plan is not a reason to leave a stale mapping behind.
		const file = this.deps.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			this.deps.echo.forget(path);
			if (planEntry?.geometrySidecarPath === path) {
				this.applyUpsert({ ...planEntry, geometrySidecarPath: undefined });
			}
			return;
		}

		// Echo suppression, which `processNote` has always had and this path had NONE of —
		// the asymmetry that made a correct save log a warning. `insertNew` writes the
		// sidecar, THEN the note, THEN upserts the index, so between the first write and the
		// last step the plan is not indexed yet; a debounce landing in that window found our
		// own sidecar and reported "no indexed plan carries this id" on a save that was
		// working perfectly. The writer owns the mapping in that case, so there is nothing
		// here to do and nothing to say.
		//
		// COARSER than the note path's check, and the sentence has to admit it: notes
		// compare a digest of what is on disk against what was written, while this asks only
		// whether this plugin has written here at all — computing a sidecar's digest means
		// READING the file, and this pipeline is synchronous. What the coarseness costs is
		// one idempotent `upsert` skipped when someone edits a sidecar we wrote earlier in
		// the session; the mapping it would have re-affirmed is already the one it holds.
		if (this.deps.echo.knows(path)) return;

		if (!planEntry || planEntry.type !== 'renovation-plan') {
			this.deps.logger.warn('persistence.pipeline.sidecar-skipped', {
				path,
				reason: 'no indexed plan carries this id',
			});
			return;
		}

		// A sidecar appearing or changing never moves the note entry itself — only the
		// mapping this index exists to hold, and it only moves that when the arriving file
		// is the one the project folder DERIVES. This used to be an unconditional repoint,
		// which is how an in-vault backup of a project folder silently sent the live plan's
		// geometry writes into the copy: `sidecarMappingFor` carries the whole argument, and
		// carries it for the full scan too, so the two doors cannot answer differently.
		this.applyUpsert({
			...planEntry,
			geometrySidecarPath: sidecarMappingFor({
				logger: this.deps.logger,
				event: 'persistence.pipeline.sidecar-duplicate',
				planEntry,
				incoming: path,
				projectPathOf: (projectId) => this.deps.index.getPath(projectId),
			}),
		});
	}

	/**
	 * The incremental half of the builder's duplicate-id diagnostic: a note arriving with an
	 * id another note already holds takes the index entry over, and the loser then never
	 * opens with nothing saying why. Semantics are untouched — last writer still wins.
	 *
	 * The existence check is what keeps this from crying wolf on a MOVE: a sync that
	 * relocates a note without a `rename` event arrives as a create at the new path while
	 * the index still points at the old one, which looks identical to a duplicate until you
	 * ask whether a file is still sitting there.
	 */
	private warnOnDuplicateId(id: string, path: string): void {
		const indexed = this.deps.index.getPath(id as never);
		if (indexed === undefined || indexed === path) return;
		if (!(this.deps.vault.getAbstractFileByPath(indexed) instanceof TFile)) return;

		this.deps.logger.warn('persistence.pipeline.duplicate-id', {
			id,
			path,
			otherPath: indexed,
			reason: 'another note already declares this id; it is no longer reachable',
		});
	}

	/**
	 * Every index mutation this pipeline makes goes through this pair, and that is a CATEGORY
	 * rather than a habit: the announcement's whole value is that a view can trust it to mean
	 * "the index changed under you", which a list of remembered call sites cannot promise. Six
	 * sites called `index.upsert`/`index.remove` directly before these existed, across four
	 * handlers and the sidecar path.
	 *
	 * The removal reads the entry's `type` BEFORE dropping it, because after `index.remove`
	 * there is nothing left to ask — which is why both take the whole entry rather than an id.
	 * The upsert reads for the same reason and did not, which is the defect below.
	 */

	/**
	 * An upsert is keyed on the ID, so it REPLACES the whole entry — and when the arriving
	 * note declares a different `type`, the entry it replaces leaves one `getIdsByType` bucket
	 * as it enters another. Announcing only what it BECAME tells every source except the one
	 * that needed telling: `createProjectListChangeSource` matches `renovation-project`, so a
	 * project note hand-edited into a plan published nothing that source could hear. The
	 * mounted list kept the row, and the row's click resolves through `getPath(id)` — which
	 * still answers that path — so it opened the retyped note. Reported in review.
	 *
	 * The displaced entry is read from the INDEX rather than passed down from the four call
	 * sites, and that is the rule this file has already paid for at four pointer doors: a
	 * question worth asking at one door is a function, and the moment it is spelled longhand
	 * the count of places it is missing is unknowable. `warnOnDuplicateId` documents a second
	 * producer the callers cannot see — a note arriving with an id another note already holds
	 * takes that entry over — and asking the index covers it without anyone remembering to.
	 *
	 * Two announcements and not one, because they are two facts and a subscriber filters on
	 * exactly one of them: the project list must hear "no longer a project", and a future
	 * plan-side source must hear "now a plan". A single announcement of either type is a
	 * refresh withheld from the other.
	 */
	private applyUpsert(entry: ProjectIndexEntry): void {
		const displaced = this.findById(entry.id);
		this.deps.index.upsert(entry);
		if (displaced !== undefined && displaced.type !== entry.type) {
			this.announce(displaced.id, displaced.type);
		}
		this.announce(entry.id, entry.type);
	}

	private applyRemove(entry: ProjectIndexEntry): void {
		this.deps.index.remove(entry.id);
		this.announce(entry.id, entry.type);
	}

	/**
	 * Fire-and-forget, which this repository normally treats as a defect and here is safe for a
	 * reason worth stating rather than assuming: `createEventBus.publish` NEVER rejects — a
	 * throwing handler is isolated per subscriber and handed to the bus's own `onError`, which
	 * the composition root binds to the logger. So there is no rejection to reach nobody. It has
	 * to be fire-and-forget either way: every caller here is one of Obsidian's synchronous vault
	 * callbacks, and awaiting a subscriber inside one would put a view's re-read on the vault
	 * event loop's critical path.
	 */
	private announce(id: ProjectIndexEntry['id'], type: ProjectIndexEntry['type']): void {
		void this.deps.events.publish(projectIndexEntryChanged({ entityId: id, entityType: type }));
	}

	private findByPath(path: string): ProjectIndexEntry | undefined {
		return this.deps.index.entries().find((entry) => entry.path === path);
	}

	/**
	 * The by-id sibling of `findByPath`, over the same scan and for the same reason there is no
	 * port method for either: `ProjectIndex` answers `getPath` and the three bucket queries, and
	 * none of them hands back an ENTRY. A `getById` would be the smaller change and a wider
	 * surface — this pipeline is the only caller, and it already pays this scan once per
	 * processed path.
	 */
	private findById(id: ProjectIndexEntry['id']): ProjectIndexEntry | undefined {
		return this.deps.index.entries().find((entry) => entry.id === id);
	}
}

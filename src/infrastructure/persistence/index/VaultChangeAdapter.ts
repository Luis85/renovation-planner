import { TFile, type MetadataCache, type TFile as TFileType, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ExcludedNote, ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { EventBus } from '../../../core/events/EventBus';
import {
	geometrySidecarChanged,
	projectIndexEntryChanged,
	projectIndexExclusionChanged,
} from '../../../application/events/projectIndex.events';
import {
	acceptsSidecar,
	derivedPlanSidecarPath,
	entityRefOf,
	sidecarMappingFor,
	sidecarsNaming,
	stringField,
} from './buildProjectIndexEntries';
import type { EchoWindow } from './EchoWindow';
import { observeFrontmatter } from '../../obsidian/repositories/digest';
import { fileStatToken, frontmatterOf } from '../../obsidian/repositories/noteIo';

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
 *
 * **Excluded is a place in the index now, not a return statement.** A note of ours this door
 * cannot index gets a descriptor beside the entries and its own announcement, because the
 * surfaces that list what a user has to repair are fed by the index and this door is the sole
 * writer for every change the plugin did not make itself. One of the two reasons — a
 * `duplicate-id` collision — is also the one thing here that is NOT path-local: its cause
 * lives in another file, so an entry leaving has to re-open the question for notes no event
 * will ever name (`promoteContender`).
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
			// Deleted (or replaced by something that is not a note). A note that was EXCLUDED has
			// no entry to remove and still has a descriptor naming it, so a repair surface would
			// go on listing a file the user has already dealt with by deleting it.
			this.dropExclusion(path);
			// **Forgotten for every deleted path, not only for one that had an ENTRY**, which is
			// where this line used to sit. The full scan marks the echo of every note it reads
			// (`collectNotes` → `markFrontmatter`), a duplicate-id LOSER included — it is marked
			// on the way in and displaced afterwards — so an excluded note leaves a record here
			// with no entry to carry it out. Delete that note and restore it with the same bytes
			// and `echo.matches` answered TRUE, so `processNote` returned before re-excluding it:
			// the collision was gone from the repair list until the next full rebuild, having
			// been suppressed as this plugin's own write. The file is gone; nothing about it can
			// be our echo.
			this.deps.echo.forget(path);
			if (existing) this.applyRemove(existing);
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
			// excluded kind must be spelled out rather than left to a default. It reaches the
			// `else` below and DROPS any descriptor for the path, which is right for a note that
			// stopped being ours and wrong for a fourth kind of exclusion — the same sentence,
			// one collection further on.
			if (ref.kind === 'no-id') {
				this.deps.logger.warn('persistence.pipeline.note-excluded', {
					path,
					reason: 'a note of this plugin must declare a non-empty id',
				});
				// The half this door used to be missing entirely: it logged and returned, so a note
				// that lost its id after load reached the index as a removal and reached a repair
				// surface as nothing at all, until the next full rebuild — which happens at
				// layout-ready and on a settings save and nowhere else.
				this.addExclusion({ path, entityType: ref.type, reason: 'no-id' });
			} else {
				// It is not ours at all now, so whatever it was excluded FOR has stopped being
				// true — a `no-id` note whose `type` was corrected away, or a duplicate loser
				// that is no longer one of our notes.
				this.dropExclusion(path);
			}
			// Not ours — but if it USED to be, it changed into something we cannot index. The
			// echo goes for the same reason the deleted arm above forgets unconditionally: this
			// path has stopped being one whose bytes we could have written, and an excluded note
			// reaching here has a record and no entry to carry it out.
			this.deps.echo.forget(path);
			if (existing) this.applyRemove(existing);
			return;
		}

		// Echo suppression: the digest of what sits on disk now vs. what this plugin last
		// wrote there. Equal means our own write echoed back through Obsidian's events.
		if (this.deps.echo.matches(path, observeFrontmatter(frontmatter))) return;

		// The note is still ours and has become a DIFFERENT entity — a hand-edited `id`. Without
		// this, the upsert below adds the new id and the old one's entry goes on pointing at
		// this same file, so every read that resolves through the index served this note under
		// an id it no longer declares. `existing` is found by PATH, which is what makes the
		// comparison possible here and impossible inside `applyUpsert` (that one displaces by
		// ID, for the different case of one id changing TYPE).
		//
		// The `!== 'ours'` arm above has removed such an entry since this pipeline was written;
		// the case it does not cover is a note that stayed ours. `echo.forget` is deliberately
		// NOT called with it — that arm forgets because the path stops being one of ours, and
		// this one is about to re-index the very same path.
		//
		// It is the SECOND remedy, never a substitute for `noteIdMismatch` at the read door:
		// this fires one vault event late, not at all for an edit made while Obsidian is
		// closed, and only the read guard fails closed. What it buys is that the refusal is
		// transient — once the pipeline has seen the edit, the old id is absent rather than
		// refusing for the life of the session.
		if (existing && existing.id !== ref.id) this.applyRemove(existing);

		// This note is about to BE the entry for its id, so any descriptor naming it is spent:
		// the `no-id` it arrived with has been corrected, or the collision it lost has just been
		// won by it (last-writer-wins, below).
		this.dropExclusion(path);
		this.demoteDisplacedDuplicate(ref.id, path);

		this.applyUpsert({
			id: ref.id as ProjectIndexEntry['id'],
			type: ref.type,
			path,
			projectId: stringField(frontmatter['project']) as ProjectIndexEntry['projectId'],
			planId: stringField(frontmatter['plan']) as ProjectIndexEntry['planId'],
			// Preserve a sidecar mapping an out-of-band note edit cannot have moved — the sidecar
			// path lives only in this index and in the writers that record it. ASSETS as well as
			// plans since asset paths became index-backed: this door used to answer `undefined`
			// for everything but a plan, so one synced or hand-edited asset note dropped the
			// mapping and the asset went shapeless.
			geometrySidecarPath: existing?.geometrySidecarPath ?? this.deps.index.getGeometrySidecarPath(ref.id as ProjectIndexEntry['id']),
		});
	}

	private processSidecar(path: string): void {
		// The entity id is the sidecar's basename (ADR-011 for a plan, ADR-0014 for an asset),
		// which is what `joinSidecars` reads too. It used to be recovered by slicing a
		// configured prefix off the front, and that is the same bound the scan just lost: a
		// sidecar under a second root answered no plan at all.
		const entityId = path.slice(path.lastIndexOf('/') + 1).replace(/\.rpgeo$/, '');
		const entry = this.findByPath(this.deps.index.getPath(entityId as never) ?? '');

		// A sidecar DELETED out of band (file explorer, sync) clears the mapping instead
		// of re-affirming a path that no longer exists — leaving it would break every
		// Zone read on this Plan with no future event to repair it. Ahead of every other
		// question, including whether a plan claims it: a delete needs no plan entry to be
		// handled, and an unindexed plan is not a reason to leave a stale mapping behind.
		const file = this.deps.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			this.deps.echo.forget(path);
			if (entry?.geometrySidecarPath === path) {
				this.applyUpsert({ ...entry, geometrySidecarPath: undefined });
			}
			// AFTER the mapping is settled, so a subscriber's re-read sees the index this event
			// is telling it about rather than the one it is replacing.
			//
			// **Deliberately NOT behind the echo check below, and that is a measurement rather
			// than an oversight.** Both sidecar stores call `echo.forget` on their own delete, so
			// by the time a plugin-owned delete reaches this door the window has usually let go
			// of the path already — and "usually" is the whole problem: `trashFile` is awaited, so
			// Obsidian may raise the event before that line runs. An echo test here would decide
			// nondeterministically, which reads as protection and is not. So a delete this plugin
			// made announces too, and costs the leaf one redundant re-read beside the domain event
			// its command published. The alternative — silence — is a sidecar deleted out of band
			// reaching nobody, which is the defect this event exists for.
			this.announceSidecar(entry);
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
		// COARSER than the note path's check, and the sentence has to say exactly how: notes
		// compare a DIGEST of the bytes on disk against the bytes written, while this compares
		// the file's `mtime:size` against the reading taken immediately after our own write.
		// Computing a sidecar's digest means READING the file and this pipeline is synchronous,
		// so `mtime:size` is the whole of what a file states about itself here. What that costs
		// is `EchoWindow.wroteFile`'s residue: an external write landing within the clock's
		// granularity of ours AND leaving the byte count alone is taken for our own echo.
		//
		// **It used to ask `echo.knows(path)` — "have we written here at all" — and the comment
		// in this place priced that at one skipped idempotent `upsert`.** That price was honest
		// while an upsert was the only thing behind the guard, and the announcement below made
		// it false in the same edit that added it: nothing but a delete forgets a path, so the
		// first local write silenced every later sync and hand edit of that file for the session
		// — which is every plan whose zones have been dragged and every asset anyone has
		// designed. A comment stating what a guard costs is a claim about EVERYTHING behind that
		// guard, so read this one against the two things now below it before adding a third.
		//
		// A path with no recorded stat — one marked by a writer that could not take a reading —
		// answers `false` and announces. That is the safe direction here: over-announcing costs
		// the leaf one redundant re-read, under-announcing is the silence above.
		if (this.deps.echo.wroteFile(path, fileStatToken(file))) return;

		// Everything past the echo check is a change this plugin did not make, whoever the
		// sidecar belongs to — so the announcement goes here, ABOVE the asset return below and
		// above the plan bookkeeping, rather than being spelled once per branch.
		this.announceSidecar(entry);

		// An ASSET's sidecar, which this door used to call an orphan. The id lookup above
		// SUCCEEDS for one — it is a real catalogue entry — so the type test below reported
		// "no indexed plan carries this id", which is false twice over: an indexed asset
		// carries it, and nothing about the file is wrong. Every hand move, every sync and
		// every restore of an asset sidecar produced that line.
		//
		// Nothing left to DO, rather than nothing to say — and the two used to be conflated
		// here, which was the defect: ADR-0014 gives an asset's sidecar one derived home under
		// `<libraryFolder>/Geometry/`, so this index stores no mapping for it and none can go
		// stale, but a designer showing that asset still has to hear that its shape moved. The
		// announcement above is what says so; this return is only about the mapping.
		//
		// **The mapping is recorded for an asset too, since the sidecar-mapping increment.** This
		// door used to return here, and the reason it gave — that an asset's sidecar has one
		// derived home so no mapping can go stale — was the defect stated as a design: a user
		// who moved the `.rpgeo` left the asset reading as SHAPELESS, because `pathFor` derived
		// the old location, and the next design write minted a second file beside the orphan.
		// ADR-0014 asked for this resolution all along.
		//
		// What an asset still cannot answer is which of TWO competing files is the derived one:
		// that path comes from the `libraryFolder` SETTING and this pipeline is not given it.
		// `derivedPath: undefined` is that answer, and `sidecarMappingFor` then keeps the
		// mapping it holds and says so, rather than guessing.
		if (!entry || !acceptsSidecar(entry)) {
			this.deps.logger.warn('persistence.pipeline.sidecar-skipped', {
				path,
				reason: 'no indexed plan or asset carries this id',
			});
			return;
		}

		// A sidecar appearing or changing never moves the note entry itself — only the
		// mapping this index exists to hold, and it only moves that when the arriving file
		// is the one the project folder DERIVES. This used to be an unconditional repoint,
		// which is how an in-vault backup of a project folder silently sent the live plan's
		// geometry writes into the copy: `sidecarMappingFor` carries the whole argument, and
		// carries it for the full scan too, so the two doors cannot answer differently.
		this.applyUpsert({ ...entry, geometrySidecarPath: this.sidecarMappingOf(entry, path) });
	}

	/**
	 * Which sidecar an entry's mapping keeps when this file is offered to it — `sidecarMappingFor`
	 * with this door's own event name and this door's answer to "where would it sit".
	 *
	 * One spelling rather than two: the sidecar door above and `promotedSidecarMapping` below ask
	 * the identical question, and the derived-path arm is the part that would drift — an asset
	 * answers `undefined` because its home comes from the `libraryFolder` SETTING and this
	 * pipeline is not given it (ADR-0014), which is a sentence one of the two copies would
	 * eventually stop carrying.
	 */
	private sidecarMappingOf(entry: ProjectIndexEntry, incoming: string): string {
		return sidecarMappingFor({
			logger: this.deps.logger,
			event: 'persistence.pipeline.sidecar-duplicate',
			entry,
			incoming,
			derivedPath:
				entry.type === 'renovation-plan'
					? derivedPlanSidecarPath(entry, (projectId) => this.deps.index.getPath(projectId))
					: undefined,
		});
	}

	/**
	 * The sidecar mapping a full rebuild would give a note just promoted into the index —
	 * RESOLVED from the vault, never inherited from the entry it replaces.
	 *
	 * Inheriting was the first version and it disagreed with the rebuild in both directions, for
	 * one reason: `joinSidecars` joins by BASENAME to whatever entry holds the id, so the vacated
	 * entry's own value says nothing about the promoted one. A requirement note colliding with a
	 * plan id carries no mapping, so promoting the displaced plan behind it inherited `undefined`
	 * and every zone read on that plan answered `plan-geometry.path-unresolved` until the next
	 * rebuild — which would have joined the `.rpgeo` perfectly well. The mirror image is worse
	 * for being quieter: promote a REQUIREMENT out from behind a plan and it inherited the plan's
	 * `.rpgeo`, an entry holding a mapping a rebuild refuses to give it (`sidecar-skipped`).
	 *
	 * That is rule 3's own disagreement arriving in the sidecar dimension rather than the
	 * identity one, three lines under a docblock saying a door which can reach a state its own
	 * rebuild cannot is a door that disagrees with what it is an increment of — this repository's
	 * oldest recurring shape, and the comment naming the invariant was again the best available
	 * description of the bug.
	 */
	private promotedSidecarMapping(entry: ProjectIndexEntry): string | undefined {
		if (!acceptsSidecar(entry)) return undefined;

		let mapping: string | undefined;
		// Folded rather than taken from the first match, because two `.rpgeo` files CAN name one
		// id — a copied project folder — and `sidecarMappingFor` is what adjudicates that. Offered
		// them in the vault's own order, which is the order the scan offers them in, so the two
		// doors cannot pick differently.
		for (const file of sidecarsNaming(this.deps.vault, entry.id)) {
			mapping = this.sidecarMappingOf({ ...entry, geometrySidecarPath: mapping }, file.path);
		}
		return mapping;
	}

	/**
	 * The incremental half of the builder's duplicate-id diagnostic: a note arriving with an
	 * id another note already holds takes the index entry over, and the loser then never
	 * opens with nothing saying why. Semantics are untouched — last writer still wins.
	 *
	 * **The DEMOTION is the other half of the promotion rule below, and it happens in the same
	 * step as the arrival takes the id.** `applyUpsert` is keyed by id, so the displaced note's
	 * path simply leaves the index: it is in neither `entries()` nor `listExclusions()`, so it
	 * has not been reported as unreadable and it is not in the catalogue — gone from every
	 * surface at once, which is worse than being classified wrongly, because a repair list
	 * cannot even name the file. Demoting it here rather than from `applyUpsert` is what keeps
	 * a RENAME out of it: that path calls the upsert with the same entry under a new path, and
	 * the old path is a duplicate of nothing.
	 *
	 * The descriptor takes the DISPLACED entry's own type — this index is one global id
	 * namespace, so the arriving note's type may not be the same kind of thing at all.
	 *
	 * The existence check is what keeps this from crying wolf on a MOVE: a sync that
	 * relocates a note without a `rename` event arrives as a create at the new path while
	 * the index still points at the old one, which looks identical to a duplicate until you
	 * ask whether a file is still sitting there. It bounds the demotion as well as the warn —
	 * a moved note's old path is not a note anybody can repair.
	 */
	private demoteDisplacedDuplicate(id: string, path: string): void {
		const displaced = this.findById(id as ProjectIndexEntry['id']);
		if (displaced === undefined || displaced.path === path) return;
		if (!(this.deps.vault.getAbstractFileByPath(displaced.path) instanceof TFile)) return;

		this.deps.logger.warn('persistence.pipeline.duplicate-id', {
			id,
			path,
			otherPath: displaced.path,
			reason: 'another note already declares this id; it is no longer reachable',
		});
		this.addExclusion({ path: displaced.path, entityType: displaced.type, reason: 'duplicate-id' });
	}

	/**
	 * The notes still claiming an id, in the order a FULL REBUILD would reach them.
	 *
	 * A `duplicate-id` exclusion is the one kind whose cause lives in a DIFFERENT file, so it
	 * is the one kind this path-local door has to re-open when something else changes: the
	 * loser's own file is untouched by the winner's deletion, no event names it, and nothing
	 * else will ask again until the next full rebuild.
	 *
	 * The vault walk is guarded on there being any such descriptor at all, which in a healthy
	 * vault is none — so an ordinary delete pays a `listExclusions()` filter and stops.
	 *
	 * Each candidate's frontmatter is re-read rather than trusted, because a descriptor
	 * records what was true when it was made: a vault edited while Obsidian was closed can
	 * have left the loser declaring another id, or nothing of ours at all.
	 */
	private contendersFor(id: string): ProjectIndexEntry[] {
		const excluded = new Set(
			this.deps.index
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
	 * An id has just been vacated, so exactly ONE of the notes still claiming it becomes the
	 * entry — never only when exactly one is left.
	 *
	 * Without any promotion, a user resolves a collision precisely as instructed — delete the
	 * copy, or give it its own id — and the note that was excluded stays excluded until the
	 * next full rebuild, which is a reload away.
	 *
	 * **"When exactly one remains" was the first version of this rule and it is wrong for
	 * three notes.** With three sharing an id, deleting the winner leaves two contenders, so a
	 * sole-survivor condition promotes neither and the id leaves every surface entirely —
	 * worse than the collision being resolved, and a state the SCAN cannot produce:
	 * `collectNotes` is last-writer-wins over an id-keyed map, so a rebuild ends with exactly
	 * one winner however many notes collide. A door that can reach a state its own full
	 * rebuild cannot is a door that disagrees with the thing it is an increment of.
	 *
	 * **Which one is not a free choice either.** `contendersFor` hands them back in the vault's
	 * own enumeration order and this takes the LAST — which is what last-writer-wins picks, so
	 * the promotion an event makes and the one the next reload makes name the same file. Any
	 * other pick is a note that silently stops being the asset when Obsidian restarts.
	 *
	 * The promoted entry's sidecar mapping is RESOLVED from the vault rather than carried across
	 * from the entry it replaces — `promotedSidecarMapping` carries why, and it is this same
	 * disagreement-with-the-rebuild rule in a second dimension.
	 */
	private promoteContender(vacated: ProjectIndexEntry): void {
		const promoted = this.contendersFor(vacated.id).at(-1);
		if (promoted === undefined) return;

		this.dropExclusion(promoted.path);
		this.applyUpsert({ ...promoted, geometrySidecarPath: this.promotedSidecarMapping(promoted) });
	}

	/**
	 * Every ENTRY mutation this pipeline makes goes through this pair, and that is a CATEGORY
	 * rather than a habit: the announcement's whole value is that a view can trust it to mean
	 * "the index changed under you", which a list of remembered call sites cannot promise. Six
	 * sites called `index.upsert`/`index.remove` directly before these existed, across four
	 * handlers and the sidecar path.
	 *
	 * **ENTRY, narrowly.** The index holds a second collection since it learned to keep the
	 * notes it could not index, and `addExclusion`/`dropExclusion` below are that collection's
	 * own pair, under their own event. Writing "every index mutation" here would be a category
	 * claim two functions no longer keep.
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

	/**
	 * Removing an entry frees its id, and freeing an id is the question a `duplicate-id`
	 * exclusion was answered relative to — so the re-evaluation belongs here rather than at the
	 * three call sites, which are a delete, a note that stopped being ours, and a note that was
	 * hand-edited to declare a different id. All three are "removing or re-identifying an
	 * entry", and a rule kept at the call sites is a rule the fourth one will not follow.
	 */
	private applyRemove(entry: ProjectIndexEntry): void {
		this.deps.index.remove(entry.id);
		this.announce(entry.id, entry.type);
		this.promoteContender(entry);
	}

	/**
	 * The exclusion pair, beside the entry pair above and for the same reason: a subscriber
	 * trusts the announcement to mean "the notes you cannot open changed", which only holds
	 * while nothing mutates that collection past these two.
	 *
	 * The removal LOOKS UP the descriptor before dropping it, because the announcement carries
	 * the excluded note's type and after the removal there is nothing left to ask — the same
	 * sentence `applyRemove` has always carried. It is also what keeps this quiet: a path with
	 * no descriptor is the ordinary case at every door that calls it, and announcing there
	 * would fire an exclusion event for every note edit in the vault.
	 */
	private addExclusion(note: ExcludedNote): void {
		const previous = this.deps.index.listExclusions().find((excluded) => excluded.path === note.path);
		this.deps.index.addExclusion(note);
		// **A retype announces TWICE, one event per type, and that is `applyUpsert`'s own shape
		// rather than a second one.** A descriptor is keyed by path, so a no-id `renovation-asset`
		// edited into a no-id `renovation-project` REPLACES it — and consumers of this event
		// filter on `entityType`, which is the whole reason the payload carries one. Announcing
		// only what it became tells every subscriber except the one that needed telling: the
		// asset library never hears that its broken note left, and keeps a repair row for a note
		// that is now somebody else's problem. Two facts, and each source filters on one.
		if (previous !== undefined && previous.entityType !== note.entityType) {
			this.announceExclusion(previous);
		}
		this.announceExclusion(note);
	}

	private dropExclusion(path: string): void {
		const note = this.deps.index.listExclusions().find((excluded) => excluded.path === path);
		if (note === undefined) return;
		this.deps.index.removeExclusion(path);
		this.announceExclusion(note);
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

	/**
	 * The sidecar counterpart of `announce`, and a SEPARATE event rather than a second caller of
	 * that one — `applyUpsert`/`applyRemove`'s docblock makes a category claim ("every index
	 * mutation goes through this pair"), and a sidecar change need mutate nothing at all: an
	 * asset's sidecar has no index mapping to move, so reusing `ProjectIndexEntryChanged` to buy
	 * a designer its refresh would make that sentence only mostly true.
	 *
	 * A sidecar whose basename resolves to no indexed entity announces NOTHING — a stray or
	 * copied `.rpgeo` names no subject, so there is no leaf it could be about, and publishing
	 * with an unresolved id would be an event every filter has to reject on the id alone.
	 *
	 * Fire-and-forget for the reasons `announce` states, which apply unchanged.
	 */
	private announceSidecar(entry: ProjectIndexEntry | undefined): void {
		if (entry === undefined) return;
		void this.deps.events.publish(
			geometrySidecarChanged({ entityId: entry.id, entityType: entry.type }),
		);
	}

	/**
	 * The exclusion counterpart of `announce`, and a THIRD event rather than a second caller of
	 * that one: `ProjectIndexEntryChangedPayload` declares `entityId`, required, and the note
	 * this is about may have no id at all — that is what excluded it.
	 *
	 * Fire-and-forget for the reasons `announce` states, which apply unchanged.
	 */
	private announceExclusion(note: ExcludedNote): void {
		void this.deps.events.publish(
			projectIndexExclusionChanged({ path: note.path, entityType: note.entityType }),
		);
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

import { TFile, type MetadataCache, type TFile as TFileType, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import { entityRefOf, stringField } from './buildProjectIndexEntries';
import type { EchoWindow } from './EchoWindow';
import { observeFrontmatter } from '../../obsidian/repositories/digest';
import { frontmatterOf } from '../../obsidian/repositories/noteIo';
import { GEOMETRY_FOLDER, normalizeFolder } from '../../obsidian/repositories/paths';

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
			logger: Logger;
			projectFolder: string;
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
		this.deps.index.upsert({ ...existing, path: file.path });
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
		const folder = normalizeFolder(this.deps.projectFolder);
		if (!path.startsWith(`${folder}/`)) return;

		const abstractFile = this.deps.vault.getAbstractFileByPath(path);
		const existing = this.findByPath(path);

		if (!(abstractFile instanceof TFile)) {
			// Deleted (or replaced by something that is not a note).
			if (existing) {
				this.deps.index.remove(existing.id);
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
			if (ref.kind === 'no-id') {
				this.deps.logger.warn('persistence.pipeline.note-excluded', {
					path,
					reason: 'a note of this plugin must declare a non-empty id',
				});
			}
			// Not ours — but if it USED to be, it changed into something we cannot index.
			if (existing) {
				this.deps.index.remove(existing.id);
				this.deps.echo.forget(path);
			}
			return;
		}

		// Echo suppression: the digest of what sits on disk now vs. what this plugin last
		// wrote there. Equal means our own write echoed back through Obsidian's events.
		if (this.deps.echo.matches(path, observeFrontmatter(frontmatter))) return;

		this.warnOnDuplicateId(ref.id, path);

		this.deps.index.upsert({
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
		const geometryPrefix = `${normalizeFolder(this.deps.projectFolder)}/${GEOMETRY_FOLDER}/`;
		if (!path.startsWith(geometryPrefix)) return;

		const planId = path.slice(geometryPrefix.length).replace(/\.rpgeo$/, '');
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
				this.deps.index.upsert({ ...planEntry, geometrySidecarPath: undefined });
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
		// mapping this index exists to hold.
		this.deps.index.upsert({ ...planEntry, geometrySidecarPath: path });
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

	private findByPath(path: string): ProjectIndexEntry | undefined {
		return this.deps.index.entries().find((entry) => entry.path === path);
	}
}

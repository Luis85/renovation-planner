import type { MetadataCache, TFile, Vault } from 'obsidian';
import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { ENTITY_TYPES, type EntityType, type ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { Logger } from '../../../application/ports/Logger';
import { frontmatterOf } from '../../obsidian/repositories/noteIo';
import { parentOf, sidecarPathFor } from '../../obsidian/repositories/paths';
import type { EchoWindow } from './EchoWindow';

function listSidecars(vault: Vault): TFile[] {
	return vault.getFiles().filter((file) => file.path.endsWith('.rpgeo'));
}

/**
 * A frontmatter value usable as an id reference: a non-empty string, or nothing.
 * Exported because the vault-change pipeline asks the same question of the same keys —
 * one answer, so the full scan and the incremental run cannot disagree about a note.
 */
export function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * What a note DECLARES itself to be — the one answer both the full scan and the
 * incremental pipeline resolve, so the two cannot disagree about a note. Same reason
 * `stringField` above is exported, one level up.
 *
 * Three answers rather than two, because the callers need three: `not-ours` is silent
 * and correct, while `no-id` is a note of ours that cannot be indexed and is therefore a
 * diagnostic. The two used to be told apart by each caller re-spelling the whole test.
 */
export type EntityRef =
	| { kind: 'ours'; type: EntityType; id: string }
	| { kind: 'no-id' }
	| { kind: 'not-ours' };

export function entityRefOf(frontmatter: Record<string, unknown>): EntityRef {
	const type = frontmatter['type'];
	if (typeof type !== 'string' || !ENTITY_TYPES.includes(type as EntityType)) {
		return { kind: 'not-ours' };
	}
	const id = stringField(frontmatter['id']);
	return id === undefined ? { kind: 'no-id' } : { kind: 'ours', type: type as EntityType, id };
}

/** What both passes need: the vault surface, the diagnostics sink, and the echo window. */
interface ScanInput {
	vault: Vault;
	metadataCache: MetadataCache;
	echo: EchoWindow;
	logger: Logger;
}

/**
 * Two notes CAN carry one id — Obsidian's own "Duplicate file" command produces exactly
 * that, and so does a sync conflict copy. The index is keyed by id, so one of them is
 * unreachable no matter what; last-writer-wins is kept deliberately, because changing it
 * would make which note wins depend on scan order — arbitrary AND invisible instead of
 * merely arbitrary. What was missing is the diagnostic: without it the losing note simply
 * never opens and nothing says why.
 */
function warnOnDuplicate(logger: Logger, previous: ProjectIndexEntry | undefined, id: string, path: string): void {
	if (!previous || previous.path === path) return;
	logger.warn('persistence.index.duplicate-id', {
		id,
		path,
		otherPath: previous.path,
		reason: 'two notes declare this id; only the last one scanned is reachable',
	});
}

/** Pass one: every note of ours in the vault, keyed by its declared id. */
function collectNotes(input: ScanInput, entries: Map<string, ProjectIndexEntry>): void {
	for (const file of input.vault.getMarkdownFiles()) {
		// Through `frontmatterOf`, so a note whose cache entry Obsidian has not produced yet
		// is still scanned from what this plugin last wrote there. At `onLayoutReady` the
		// echo is empty and this is exactly the cache read it always was; it earns its keep
		// on the RE-scan `saveSettings` triggers mid-session, where notes written moments
		// ago would otherwise be dropped from the index they had just been added to.
		const frontmatter = frontmatterOf(input, file);

		const ref = entityRefOf(frontmatter);
		if (ref.kind === 'not-ours') continue;
		if (ref.kind === 'no-id') {
			input.logger.warn('persistence.index.note-excluded', {
				path: file.path,
				reason: 'a note of this plugin must declare a non-empty id',
			});
			continue;
		}

		warnOnDuplicate(input.logger, entries.get(ref.id), ref.id, file.path);
		entries.set(ref.id, {
			id: ref.id as EntityId<string>,
			type: ref.type,
			path: file.path,
			projectId: stringField(frontmatter['project']) as ProjectId | undefined,
			planId: stringField(frontmatter['plan']) as PlanId | undefined,
		});
		input.echo.markFrontmatter(file.path, frontmatter);
	}
}

/**
 * Which sidecar path a Plan's mapping keeps when a second `.rpgeo` names the same plan id.
 * The one answer BOTH doors take — this scan and `VaultChangeAdapter`'s incremental pass —
 * for the reason `entityRefOf` above is shared: two hand-spelled copies of one rule are two
 * rules, and the pair already disagreed once. That is this function's whole existence.
 *
 * Two `.rpgeo` files CAN name one plan id: a user copying a whole project folder as an
 * in-vault backup — the "moves, backs up and deletes as one unit" property ADR-0013
 * celebrates — produces exactly that, and neither door has a folder prefix left to keep the
 * two apart. A warning alone does not cover it. The mapping is what every geometry WRITE
 * resolves through (`ProjectIndex.getGeometrySidecarPath`), so repointing it at the copy
 * sends the live plan's zones into the backup and freezes the file the user is editing,
 * with the note entry still pointing at the live project — an index that disagrees with
 * itself, and the deletion of the backup then clears the mapping outright.
 *
 * So the DERIVED path wins: project folder + `Geometry/` + plan id (ADR-0011 — "derivability
 * is a repair path for a damaged index, not a second lookup mechanism for normal reads",
 * and adjudicating a duplicate is repair, never a read). An arriving path that is not the
 * derived one does not displace a mapping that already exists; it warns and is dropped.
 *
 * **This replaces the scan's own warn-only rule, deliberately, rather than the pipeline
 * copying it.** That rule kept last-writer-wins on the argument that refusing would make the
 * winner depend on scan order — true of a coin toss between two files, and not true here: the
 * derived path is the same answer whichever order the two are reached in, so the objection
 * the old rule rested on is what deriving dissolves. Leaving the scan warn-only would also
 * have defeated the pipeline's guard on the next restart, which is the practical half: a
 * backup made with Obsidian open is guarded by the pipeline and then re-adjudicated by the
 * full scan at the following `onLayoutReady`.
 *
 * When nothing can derive a path — a plan declaring no project, or one whose project note is
 * not indexed — an existing mapping still stands and the duplicate is still reported. Which
 * of the two won is then arbitrary, exactly as it was before; what is no longer available is
 * a silent repoint of a mapping this index already holds.
 *
 * **What this does NOT reach, said plainly, because it was measured rather than assumed.**
 * Copying a project folder duplicates the NOTES too, and which project note the index holds
 * is still note-level last-writer-wins (`warnOnDuplicate`) — a rule slice 18 kept
 * deliberately and this does not touch. In the SCAN the two halves therefore still agree:
 * every note is resolved before a single sidecar is joined, so the mapping follows whichever
 * project note won. In the live PIPELINE they can part company for a while, and which way
 * round depends on an event order nothing promises: with `Geometry/` sorting ahead of the
 * note beside it — what the test drives, and what a directory walk produces — the copy's
 * sidecar is refused here and the copy's note then takes the entry over, carrying the
 * original mapping with it (`processNote` preserves a mapping a note edit cannot have
 * moved). That is a stale index
 * until the next `onLayoutReady` rescan reconciles it. What it is not is the failure this
 * replaced: the mapping still names the sidecar this plan's geometry has been living in, and
 * deleting the copy leaves it untouched — where an unconditional repoint aimed the live plan
 * at the copy, froze the file the user was editing, and then unresolved the plan's geometry
 * altogether the moment the backup was deleted.
 */
export function sidecarMappingFor(input: {
	logger: Logger;
	/** One event per door, so a log line says which pass adjudicated (slice 11's rule). */
	event: 'persistence.index.sidecar-duplicate' | 'persistence.pipeline.sidecar-duplicate';
	planEntry: ProjectIndexEntry;
	incoming: string;
	/** Where the owning project's note sits: the index for the pipeline, the in-flight map for the scan. */
	projectPathOf: (projectId: ProjectId) => string | undefined;
}): string {
	const current = input.planEntry.geometrySidecarPath;
	const projectPath =
		input.planEntry.projectId === undefined ? undefined : input.projectPathOf(input.planEntry.projectId);
	const derived = projectPath === undefined ? undefined : sidecarPathFor(parentOf(projectPath), input.planEntry.id);
	if (current === undefined || input.incoming === derived) return input.incoming;

	input.logger.warn(input.event, {
		planId: input.planEntry.id,
		path: input.incoming,
		otherPath: current,
		derivedPath: derived,
		reason: 'another sidecar already maps this plan id; the mapping is unchanged',
	});
	return current;
}

/** Pass two: join each sidecar to its Plan entry by filename (see the header on why). */
function joinSidecars(input: ScanInput, entries: Map<string, ProjectIndexEntry>): void {
	for (const file of listSidecars(input.vault)) {
		const planId = file.basename;
		const planEntry = entries.get(planId);
		if (!planEntry || planEntry.type !== 'renovation-plan') {
			input.logger.warn('persistence.index.sidecar-skipped', {
				path: file.path,
				reason: 'no indexed plan carries this id',
			});
			continue;
		}
		entries.set(planId, {
			...planEntry,
			geometrySidecarPath: sidecarMappingFor({
				logger: input.logger,
				event: 'persistence.index.sidecar-duplicate',
				planEntry,
				incoming: file.path,
				projectPathOf: (projectId) => entries.get(projectId)?.path,
			}),
		});
	}
}

/**
 * The full scan that populates the Project Index (SDD §47). Runs from
 * `onLayoutReady` — NOT `onload`: a vault-wide scan there competes with workspace
 * restoration on the main thread, and `MetadataCache` is incomplete until layout-ready,
 * so an earlier scan would build a partial index that looks complete.
 *
 * **The scan is bounded by what a note DECLARES, not by where it sits.** Every note this
 * plugin owns carries `type` and `id`, and every child entity carries `project:` — the
 * frontmatter is what makes the index correct, and the path prefix this used to filter on
 * never was. A prefix also could not see a second root at all, which is why slice 4
 * recorded a library outside the scanned folder as invisible to both this scan and the
 * vault-change pipeline. Nothing is registered, so nothing has to be.
 *
 * **What that costs, stated rather than discovered:** `frontmatterOf` is called for every
 * markdown file in the vault, not for the handful under one folder. It is a
 * `MetadataCache` map lookup plus an `EchoWindow` digest check — not a file read and not a
 * parse. PRD §102 names "project indexing time" as a category needing a budget and sets no
 * figure for it, so this is a description of the cost rather than a claim that it clears
 * one — there is nothing written down yet to clear. It is NOT, as slice 18's document first
 * claimed, "the same set either way": the prefix used to be tested before this call, and a
 * 10,000-note vault with twenty notes under `Renovation/` cost twenty calls and now costs
 * ten thousand lookups.
 *
 * Notes are read through `MetadataCache`, never by parsing files; sidecars are joined to
 * their Plan entries by FILENAME — the fast path — because reading and schema-parsing
 * every `.rpgeo` would be hundreds of whole-file reads at the one moment startup is
 * most expensive. The filename join is VERIFIED later, on the first read of that
 * sidecar (`PlanGeometryStore.read` compares the document's own `planId`). A file whose
 * name is not a plan ID is skipped with a diagnostic rather than guessed at.
 *
 * A hand-written note carrying one of our types anywhere in the vault is therefore
 * indexed. That is the intended behaviour of a declared bound; a template note carrying a
 * literal id becomes a duplicate-id finding, which `warnOnDuplicate` already reports. A
 * third consequence follows the same shape one level down: a `.rpgeo` file has no folder
 * prefix left to bound it either, so a project folder copied wholesale as a backup carries
 * a second sidecar naming the same plan id. That one is NOT merely reported —
 * `sidecarMappingFor` keeps the derived path and drops the copy, because a repointed
 * mapping is where the live plan's geometry writes go.
 *
 * Two named passes rather than one body: the sidecar join can only run once every note
 * entry exists, so the ORDER here is the contract, and it is worth being able to read.
 */
export function buildProjectIndexEntries(input: ScanInput): ProjectIndexEntry[] {
	const entries = new Map<string, ProjectIndexEntry>();

	collectNotes(input, entries);
	joinSidecars(input, entries);

	// §67's `info` — a notable state transition, content-free: the index was REBUILT and
	// this is how many entities it now knows. The warns above are per-note problems; this
	// is the one-line summary a developer reads first.
	input.logger.info('persistence.index.rebuilt', { entries: entries.size });

	return [...entries.values()];
}

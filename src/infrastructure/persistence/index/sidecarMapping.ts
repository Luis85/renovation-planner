import type { Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import {
	acceptsSidecar,
	derivedPlanSidecarPath,
	sidecarMappingFor,
	sidecarsNaming,
} from './buildProjectIndexEntries';

/**
 * `sidecarMappingFor` with the incremental doors' own event name and their answer to "where
 * would it sit" — extracted here because TWO doors ask it and they must not answer
 * differently: `VaultChangeAdapter.processSidecar`, when a `.rpgeo` arrives, and
 * `promotedSidecarMapping` below, when a note is promoted into the index.
 *
 * The derived-path arm is the part that would drift if each kept its own copy: an ASSET
 * answers `undefined` because its home comes from the `libraryFolder` SETTING and neither door
 * is given it (ADR-0014), so `sidecarMappingFor` keeps the mapping it holds and says so rather
 * than guessing. A plan's is derivable from the project it names.
 */
export function incrementalSidecarMapping(
	deps: { logger: Logger; index: ProjectIndex },
	entry: ProjectIndexEntry,
	incoming: string,
): string {
	return sidecarMappingFor({
		logger: deps.logger,
		event: 'persistence.pipeline.sidecar-duplicate',
		entry,
		incoming,
		derivedPath:
			entry.type === 'renovation-plan'
				? derivedPlanSidecarPath(entry, (projectId) => deps.index.getPath(projectId))
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
 * rebuild — which would have joined the `.rpgeo` perfectly well. The mirror image is worse for
 * being quieter: promote a REQUIREMENT out from behind a plan and it inherited the plan's
 * `.rpgeo`, an entry holding a mapping a rebuild refuses to give it (`sidecar-skipped`).
 *
 * That is the promotion rule's own disagreement-with-the-rebuild argument arriving in the
 * sidecar dimension rather than the identity one.
 */
export function promotedSidecarMapping(
	deps: { logger: Logger; index: ProjectIndex; vault: Vault },
	entry: ProjectIndexEntry,
): string | undefined {
	if (!acceptsSidecar(entry)) return undefined;

	let mapping: string | undefined;
	// Folded rather than taken from the first match, because two `.rpgeo` files CAN name one
	// id — a copied project folder — and `sidecarMappingFor` is what adjudicates that. Offered
	// them in the vault's own order, which is the order the scan offers them in, so the two
	// doors cannot pick differently.
	for (const file of sidecarsNaming(deps.vault, entry.id)) {
		mapping = incrementalSidecarMapping(deps, { ...entry, geometrySidecarPath: mapping }, file.path);
	}
	return mapping;
}

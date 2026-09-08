import type { EntityVersion } from '../../../application/ports/versioning';
import type { SpatialObjectGeometryDTO } from '../../persistence/dto/planGeometry';
import { observeZone } from './digest';
import { versionOfFrontmatter } from './versionCheck';

/** A Zone version spans its note's owned facts and its own geometry entry, never its neighbours. */
export function zoneVersion(frontmatter: Record<string, unknown>, entry: SpatialObjectGeometryDTO | undefined): EntityVersion {
	return { revision: versionOfFrontmatter(frontmatter).revision, observed: observeZone(frontmatter, entry) };
}

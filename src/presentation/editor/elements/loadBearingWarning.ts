import type { SpatialElement, SpatialElementMetadata } from '../../../domain/spatial/SpatialElement';
import { tr } from '../../i18n/strings';

/**
 * The one sentence both element deletion doors — `elementActions.remove` and `spatialRemoval` — append when a
 * removal takes a load-bearing post or beam; empty otherwise. Deleting stays possible (structural posts and beams design §7).
 */
export function loadBearingWarning(ids: readonly string[], elements: readonly SpatialElement[] = [], metadata: readonly SpatialElementMetadata[] = []): string {
	const names = elements.filter(element => element.loadBearing === true && ids.includes(element.id)).map(element => metadata.find(item => item.id === element.id)?.name ?? element.id);
	return names.length ? ' ' + tr('editor.structural.delete-warning', { names: names.join(', ') }) : '';
}

import type { AppError } from '../../../core/errors/AppError';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
const errors = ['numeric', 'pending', 'wall-dimensions', 'wall-side-extents', 'wall-side-curve-radius', 'wall-side-curved-junction', 'intersection', 'host-missing', 'opening-containment', 'opening-overlap', 'opening-split', 'opening-swing', 'boundary', 'room-missing', 'duplicate-id', 'color-invalid', 'unavailable'] as const;
export function spatialMessage(error: AppError): string {
	const key = errors.find(candidate => error.code === `spatial.${candidate}`);
	return key ? tr(`editor.structure.error.${key}`) : trError(error);
}

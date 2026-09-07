import type { AppError } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { tr } from '../../i18n/strings';
import { spatialMessage } from '../structure/spatialMessage';
export function renovationMessage(error: AppError): string {
	if (error.code === 'renovation.trade-missing') return tr('trade.missing');
	if (error.code.startsWith('spatial.')) return spatialMessage(error);
	if (error.code === 'renovation.cycle') return tr('renovation.error.cycle');
	if (error.code === 'undo.superseded' || WRITE_BOUNDARY_CODES.some(code => error.code.endsWith(code))) return tr('renovation.error.conflict');
	return tr(error.category === 'Persistence' ? 'renovation.error.persistence' : 'renovation.error');
}

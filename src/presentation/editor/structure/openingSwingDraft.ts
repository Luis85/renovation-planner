import type { Opening, OpeningSwing } from '../../../domain/spatial/Structure';
import { openingSwing } from '../../../domain/spatial/openingSwing';
import { parseRotationDegrees } from '../elements/objectRotation';

export interface OpeningSwingDraft { hinge: 'start' | 'end'; side: 'left' | 'right'; angle: string }
export function swingDraft(opening: Opening): OpeningSwingDraft {
	const value = openingSwing(opening) ?? { hinge: 'start', side: 'left', angle: 0 };
	return { ...value, angle: String(value.angle) };
}
export function parseSwingDraft(draft: OpeningSwingDraft): OpeningSwing | null {
	const angle = parseRotationDegrees(draft.angle);
	return angle === null || angle < 0 || angle > 180 ? null : { hinge: draft.hinge, side: draft.side, angle };
}

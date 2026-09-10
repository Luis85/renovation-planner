import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import type { Point } from '../../../core/geometry/Point';
import { orderEvidenceByDate } from './evidenceOrder';
import { computed } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useRenovationSession } from '../renovation/renovationSession';
import { inRenovationScope } from '../renovation/renovationSummary';
import { roomPinPosition } from './roomPinPosition';

export interface EvidencePin extends Evidence, Point { readonly number: number }

/** The same filtered, numbered world positions serve pin rendering and caption clearance. */
export function useEvidencePins(readEvidence: () => readonly Evidence[]) {
	const project = useProjectStore(), session = useRenovationSession();
	return computed<EvidencePin[]>(() => {
		if (!['documents', 'photos', 'notes'].includes(session.mode) || session.perspective !== 'renovate') return [];
		const type = session.mode === 'photos' ? 'photo' : session.mode === 'notes' ? 'note' : 'document';
		const rows = orderEvidenceByDate(readEvidence().filter(item => inRenovationScope(item, session.roomId, session.targetId) && item.type === type && (!session.evidencePhase || item.phase === session.evidencePhase)));
		return rows.flatMap((item, index) => {
			const room = project.zones.get(item.roomId);
			if (!item.pin || !room?.points.length) return [];
			const position = roomPinPosition(room, item.pin);
			return position ? [{ ...item, number: index + 1, ...position }] : [];
		});
	});
}

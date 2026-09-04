import { describe, expect, it } from 'vitest';
import {
	PROJECT_STATUS_STAGE_COUNT,
	projectStatusStage,
} from '../../../src/presentation/views/projectStatusStage';
import { PROJECT_STATUSES } from '../../../src/domain/project/ProjectStatus';

describe('projectStatusStage', () => {
	it('places every lifecycle member at its own position in the arc', () => {
		// Derived from the enum rather than transcribed: a table copied out of the domain
		// would agree with a reordering of it, which is the one change this must notice.
		expect(PROJECT_STATUSES.map((status) => projectStatusStage(status))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('reports the strip’s own length from the enum', () => {
		expect(PROJECT_STATUS_STAGE_COUNT).toBe(PROJECT_STATUSES.length);
	});

	it('answers null for a status this build does not recognise', () => {
		// `ProjectSummaryDto.status` is `string`, and a project note this build cannot make
		// sense of still gets a row. It gets the raw word and NO strip — a strip drawn at
		// stage 0 would be a claim about a lifecycle position nobody established.
		expect(projectStatusStage('PLANNING')).toBeNull();
	});
});

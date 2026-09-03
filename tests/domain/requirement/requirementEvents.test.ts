import { describe, expect, it } from 'vitest';
import {
	requirementDeleted,
	requirementRestored,
} from '../../../src/domain/requirement/Requirement.events';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';

const requirementId = 'requirement-01JAAA' as RequirementId;
const projectId = 'project-01JAAA' as ProjectId;

describe('the two events this increment mints', () => {
	it('names a deleted requirement and the project that must refresh', () => {
		expect(requirementDeleted({ requirementId, projectId })).toEqual({
			type: 'RequirementDeleted',
			payload: { requirementId, projectId },
		});
	});

	// The projectId is the whole point: a restore reached through a ZONE event carries the
	// ZONE's project, and a requirement in another project is exactly the row that event
	// cannot reach. This payload is what makes the cross-project case addressable.
	it('names a restored requirement and its OWN project', () => {
		expect(requirementRestored({ requirementId, projectId })).toEqual({
			type: 'RequirementRestored',
			payload: { requirementId, projectId },
		});
	});
});

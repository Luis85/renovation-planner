// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectWorkRow from '../../../../src/presentation/views/work/ProjectWorkRow.vue';
import type { PlanId } from '../../../../src/domain/plan/PlanId';

it('shows No room for a Work item with no room (ADR-0030)', () => {
	const work = { id: 'work-border', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
	const wrapper = mount(ProjectWorkRow, { props: { row: { planId: 'plan-a' as PlanId, floor: 'Ground floor', rooms: [], work, blocking: [] }, blocked: false } });
	expect(wrapper.text()).toContain('Ground floor · No room');
	wrapper.unmount();
});

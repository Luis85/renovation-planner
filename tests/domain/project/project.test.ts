import { describe, expect, it } from 'vitest';
import type { Money } from '../../../src/core/money/Money';
import { createMoney } from '../../../src/core/money/Money';
import { Project } from '../../../src/domain/project/Project';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';

const budget = (): Money => expectOk(createMoney('50000', 'EUR'));

describe('Project.create', () => {
	it('constructs with defaults: status IDEA, unset fields null', () => {
		const project = expectOk(Project.create({ id: createProjectId(), name: ' Attic ' }));
		expect(project.name).toBe('Attic');
		expect(project.status).toBe('IDEA');
		expect(project.description).toBeNull();
		expect(project.start).toBeNull();
		expect(project.targetCompletion).toBeNull();
		expect(project.budget).toBeNull();
		expect(project.contingency).toBeNull();
		expect(project.locationDescription).toBeNull();
	});

	it('keeps every provided optional field', () => {
		const start = new Date('2026-09-01');
		const target = new Date('2026-12-01');
		const project = expectOk(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen',
				description: 'Full refit',
				status: 'DESIGN',
				start,
				targetCompletion: target,
				budget: budget(),
				contingency: budget(),
				locationDescription: 'Ground floor',
			}),
		);
		expect(project.description).toBe('Full refit');
		expect(project.status).toBe('DESIGN');
		expect(project.start).toBe(start);
		expect(project.targetCompletion).toBe(target);
		expect(project.budget?.amount).toBe('50000');
		expect(project.contingency).not.toBeNull();
		expect(project.locationDescription).toBe('Ground floor');
	});

	it('rejects an empty or whitespace-only name', () => {
		for (const name of ['', '   ']) {
			const error = expectErr(Project.create({ id: createProjectId(), name }));
			expect(error.code).toBe('project.empty-name');
		}
	});

	it('rejects a targetCompletion before start', () => {
		const error = expectErr(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen',
				start: new Date('2026-09-01'),
				targetCompletion: new Date('2026-08-01'),
			}),
		);
		expect(error.code).toBe('project.target-before-start');
	});

	it('accepts a targetCompletion equal to start', () => {
		const day = new Date('2026-09-01');
		const project = expectOk(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen',
				start: day,
				targetCompletion: day,
			}),
		);
		expect(project.targetCompletion).toBe(day);
	});

	it('refuses a status outside the lifecycle vocabulary', () => {
		const error = expectErr(
			Project.create({ id: createProjectId(), name: 'Kitchen', status: 'PAUSED' as never }),
		);
		expect(error.code).toBe('project.unknown-status');
	});
});

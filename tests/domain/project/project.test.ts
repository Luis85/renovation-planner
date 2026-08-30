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

	it('rejects a NEGATIVE budget or contingency, naming which field it refused', () => {
		// `Money` is signed — a variance legitimately goes below zero — so the entity that
		// owns these two fields is what refuses one here. This is the boundary every path
		// into a Project passes through: `CreateProjectCommand` and the persistence mapper
		// both construct through `Project.create`.
		const negative = expectOk(createMoney('-1', 'EUR'));
		const budgetError = expectErr(
			Project.create({ id: createProjectId(), name: 'Kitchen', budget: negative }),
		);
		expect(budgetError.category).toBe('Validation');
		expect(budgetError.code).toBe('project.negative-amount');
		expect(budgetError.message).toContain('budget');

		const contingencyError = expectErr(
			Project.create({ id: createProjectId(), name: 'Kitchen', contingency: negative }),
		);
		expect(contingencyError.code).toBe('project.negative-amount');
		expect(contingencyError.message).toContain('contingency');
	});

	it('accepts a ZERO budget, which is a stated budget of nothing rather than an absent one', () => {
		const project = expectOk(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen',
				budget: expectOk(createMoney('0', 'EUR')),
			}),
		);
		expect(project.budget?.amount).toBe('0');
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

	it.each([
		['start', { start: new Date('nonsense') }],
		['targetCompletion', { targetCompletion: new Date(NaN) }],
	])('refuses a %s that is not a real date', (_field, dates) => {
		const error = expectErr(Project.create({ id: createProjectId(), name: 'Kitchen', ...dates }));
		expect(error.code).toBe('project.invalid-date');
	});

	// The ordering rule cannot catch this one and must not be relied on to: every comparison
	// against `NaN` is false, so a pair whose target precedes its start would ALSO have been
	// accepted here had the finiteness check not run first.
	it('refuses an unreal date before comparing the pair', () => {
		const error = expectErr(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen',
				start: new Date(NaN),
				targetCompletion: new Date('2026-08-01'),
			}),
		);
		expect(error.code).toBe('project.invalid-date');
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

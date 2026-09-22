/**
 * `ListPlansUsingAsset` (AD13 item 3, C11) — which plans place one catalogue definition.
 *
 * Driven over the REAL `ObsidianProjectRepository`, the REAL `ObsidianPlanRepository` and the
 * REAL `ObsidianPlanGeometrySidecar` of `createRepositoryStack`, because the question this query
 * answers is a fact about notes and sidecars on disk. Only the REFUSAL cases wrap a port, and each
 * wraps it to produce an answer the port's own contract promises — a coded refusal, or the
 * `{ loaded, refused }` listing whose `refused` half is the tolerant skip the real repositories
 * perform for an unparseable note.
 */
import { describe, expect, it } from 'vitest';
import { ListPlansUsingAsset } from '../../../src/application/queries/ListPlansUsingAsset';
import type { PlanGeometrySidecar } from '../../../src/application/ports/PlanGeometrySidecar';
import type { PlanRepository } from '../../../src/application/ports/PlanRepository';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { placementPoints } from '../../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { expectErr, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';
import { createRepositoryStack } from '../../helpers/vault';

const OVEN = 'asset-oven' as AssetId;
const SINK = 'asset-sink' as AssetId;

const VAULT_FAULT = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the note would not load',
} as const;

function placement(id: string, assetId: AssetId, x: number): SpatialElement {
	return { id, kind: 'asset', assetId, points: placementPoints({ x, y: 0 }, 0) };
}

const CABINET: SpatialElement = {
	id: 'element-cabinet',
	kind: 'object',
	points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }],
};

const EMPTY_STRUCTURE = { walls: [], openings: [], boundaries: [] } as const;

async function vault() {
	const stack = createRepositoryStack();
	const project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const geometry = new ObsidianPlanGeometrySidecar(stack.store);

	return {
		stack,
		projectId: project.id,
		geometry,
		/**
		 * A second project note, saved the same way the first one is.
		 *
		 * Here rather than in a case, because the rig owns the vault and a project saved past it
		 * would be one `projectId` the rig could not name.
		 */
		async project(name: string): Promise<ProjectId> {
			const other = makeProject({ name });
			expectOk(await stack.projects.save(other, 'absent'));
			return other.id;
		},
		/**
		 * A plan note plus, where given, the elements its sidecar holds in each structure.
		 *
		 * `inProject` defaults to the project the rig opened with, so every case whose subject is
		 * not the project boundary reads exactly as it did before this parameter existed.
		 */
		async plan(
			name: string,
			elements: { current?: readonly SpatialElement[]; intended?: readonly SpatialElement[] } = {},
			inProject: ProjectId = project.id,
		): Promise<PlanId> {
			const plan = makePlan({ projectId: inProject, name });
			expectOk(await stack.plans.save(plan, 'absent'));
			if (elements.current === undefined && elements.intended === undefined) return plan.id;
			const baseline = expectOk(await geometry.read(plan.id));
			expectOk(
				await geometry.write(
					plan.id,
					{
						...baseline.document,
						structure: { ...EMPTY_STRUCTURE, elements: elements.current ?? [] },
						...(elements.intended === undefined
							? {}
							: { intended: { ...EMPTY_STRUCTURE, elements: elements.intended } }),
					},
					baseline.version,
				),
			);
			return plan.id;
		},
		query(overrides: {
			projects?: ProjectRepository;
			plans?: PlanRepository;
			geometry?: PlanGeometrySidecar;
		} = {}) {
			return new ListPlansUsingAsset(
				overrides.projects ?? stack.projects,
				overrides.plans ?? stack.plans,
				overrides.geometry ?? geometry,
			);
		},
		/** The plan repository with `listByProject` answering what a case wants. */
		planListing(answer: Awaited<ReturnType<PlanRepository['listByProject']>>): PlanRepository {
			return {
				getById: (id) => stack.plans.getById(id),
				save: (plan, expected) => stack.plans.save(plan, expected),
				delete: (id, expected) => stack.plans.delete(id, expected),
				listByProject: () => Promise.resolve(answer),
			};
		},
	};
}

describe('ListPlansUsingAsset', () => {
	it('names only the plans that place the asset, with a count of its placements', async () => {
		const rig = await vault();
		const kitchen = await rig.plan('Kitchen', {
			current: [placement('element-1', OVEN, 0), placement('element-2', OVEN, 900), CABINET],
		});
		await rig.plan('Bathroom', { current: [placement('element-3', SINK, 0), CABINET] });
		await rig.plan('Loft');

		const usage = expectOk(await rig.query().execute(OVEN));

		expect(usage).toEqual({
			plans: [{ planId: kitchen, planName: 'Kitchen', projectId: rig.projectId, placements: 2 }],
			unreadable: 0,
		});
	});

	it('counts a placement held in both the current and the proposed structure once', async () => {
		// `assetShapeLoader.ts` already unions the two when it collects the asset ids a plan
		// draws; counting them separately would report one placement as two, and reading only the
		// current structure would miss a plan whose PROPOSAL places the asset.
		const rig = await vault();
		const both = placement('element-1', OVEN, 0);
		const proposalOnly = placement('element-9', OVEN, 1800);
		const kitchen = await rig.plan('Kitchen', { current: [both], intended: [both, proposalOnly] });

		const usage = expectOk(await rig.query().execute(OVEN));

		expect(usage.plans).toEqual([
			{ planId: kitchen, planName: 'Kitchen', projectId: rig.projectId, placements: 2 },
		]);
	});

	it('names the plans of EVERY project that places the asset, each row carrying its own project', async () => {
		// F10's two-project half. The catalogue is vault-level since design slice 19 — an `Asset`
		// has no project field — so one definition is placeable from plans belonging to different
		// projects, and the scope a user consults before an impactful change has to name all of
		// them. Every other case in this file lives inside the single project `vault()` opens
		// with, where a walk that answered from the FIRST project only would look exactly like a
		// walk that answered from all of them.
		//
		// `Garage` is here to keep the length assertion honest: it belongs to the second project
		// and places nothing, so a query that reached that project by listing its plans but never
		// read their geometry would still fail this.
		const rig = await vault();
		const kitchen = await rig.plan('Kitchen', { current: [placement('element-1', OVEN, 0)] });
		const annexe = await rig.project('Annexe conversion');
		const loft = await rig.plan(
			'Loft',
			{ current: [placement('element-2', OVEN, 0), placement('element-3', OVEN, 900)] },
			annexe,
		);
		await rig.plan('Garage', { current: [CABINET] }, annexe);

		const usage = expectOk(await rig.query().execute(OVEN));

		// `arrayContaining` plus a length, the shape `listProjects.test.ts` uses for the same
		// question: which rows are in the scope is the claim, and the order `listAll` walks the
		// projects in is not one this query promises.
		expect(usage.plans).toEqual(
			expect.arrayContaining([
				{ planId: kitchen, planName: 'Kitchen', projectId: rig.projectId, placements: 1 },
				{ planId: loft, planName: 'Loft', projectId: annexe, placements: 2 },
			]),
		);
		expect(usage.plans).toHaveLength(2);
		expect(usage.unreadable).toBe(0);
	});

	it('REFUSES rather than answering an empty scope when the project list cannot be read', async () => {
		// The defect `tests/plugin/guardCategory.test.ts` caught in the first version of this query,
		// which enumerated plans from `index.getIdsByType` itself: a vault nobody could read
		// answered "no plan places this asset" — a false absence at the one surface whose job is to
		// state a blast radius. What this case pins is the REFUSING arm of that, and only it: a
		// listing that fails is propagated.
		//
		// It does NOT pin the pre-scan arm, and the comment that used to stand here implied it did.
		// Both repositories this query walks enumerate `index.getIdsByType` themselves, so an EMPTY
		// index over a healthy vault still answers an empty scope from here — which no query can
		// tell from an empty vault. That gate is `AssetUsageScope.vue`'s ask on
		// `indexScanCompleted()`, and its case lives with the component.
		const rig = await vault();
		await rig.plan('Kitchen', { current: [placement('element-1', OVEN, 0)] });
		const projects: ProjectRepository = {
			...rig.stack.projects,
			getById: (id) => rig.stack.projects.getById(id),
			save: (project, expected) => rig.stack.projects.save(project, expected),
			delete: (id, expected) => rig.stack.projects.delete(id, expected),
			listAll: () => Promise.resolve(err(VAULT_FAULT)),
		};

		expect(expectErr(await rig.query({ projects }).execute(OVEN)).code).toBe('vault.unexpected-failure');
	});

	it('refuses rather than half-answering when one project plan listing refuses', async () => {
		// `ListRequirementsReferencing`'s own rule for the read this section sits beside: one
		// unreadable project NOTE is a gap in the scope (counted below), and an unreadable project
		// plan LIST is not a scope at all.
		const rig = await vault();
		await rig.plan('Kitchen', { current: [placement('element-1', OVEN, 0)] });

		const refusal = expectErr(
			await rig.query({ plans: rig.planListing(err(VAULT_FAULT)) }).execute(OVEN),
		);

		expect(refusal.code).toBe('vault.unexpected-failure');
	});

	it('counts the notes each listing skipped, so a partial scope says it is partial', async () => {
		// C08: a failed read is not an absence. Both tolerant halves are counted — the projects
		// `listAll` skipped and the plans `listByProject` skipped.
		const rig = await vault();
		const kitchen = await rig.plan('Kitchen', { current: [placement('element-1', OVEN, 0)] });
		const listing = expectOk(await rig.stack.plans.listByProject(rig.projectId));

		const usage = expectOk(
			await rig.query({ plans: rig.planListing(ok({ ...listing, refused: 2 })) }).execute(OVEN),
		);

		expect(usage.plans.map((row) => row.planId)).toEqual([kitchen]);
		expect(usage.unreadable).toBe(2);
	});

	it('counts a plan whose geometry sidecar refuses as unreadable', async () => {
		const rig = await vault();
		const broken = await rig.plan('Bathroom', { current: [placement('element-2', OVEN, 0)] });
		const geometry: PlanGeometrySidecar = {
			read: (id) => (id === broken ? Promise.resolve(err(VAULT_FAULT)) : rig.geometry.read(id)),
			write: (id, document, expected) => rig.geometry.write(id, document, expected),
		};

		expect(expectOk(await rig.query({ geometry }).execute(OVEN))).toEqual({ plans: [], unreadable: 1 });
	});

	it('answers an empty scope for a readable vault holding no plans at all', async () => {
		const rig = await vault();

		expect(expectOk(await rig.query().execute(OVEN))).toEqual({ plans: [], unreadable: 0 });
	});
});

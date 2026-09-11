# Detail Plans From a Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click a zone → **New detail plan** creates a plan named after the zone, linked to it, and opens it; the zone's menu lists **Open {name}** for each detail plan; the detail plan's breadcrumb walks back up (`Project › Site › House › Ground floor`) and its canvas shows the parent zone's outline as a guide.

**Architecture:** `Plan` gains an immutable optional `parent: { planId, zoneId }`, persisted as `parent-plan`/`parent-zone` in plan frontmatter schema v9 (written only for a detail plan). `CreatePlanCommand` validates the parent. One read, `readPlanHierarchy`, answers ancestry, the plan's detail plans and the parent zone outline from `GetPlan` + `ListPlansByProject` + `FindZonesByPlan`; a per-leaf `PlanHierarchyStore` holds it. The context bar, property panel, canvas context menu and a guide inside the background layer all read that store. Navigation reuses `revealPlanEditor` through a new optional `EditorNavigation.plan`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, vue-konva, zod 4, vitest (+ jsdom, @vue/test-utils).

**Spec:** `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md`, Part 2 (§4). Part 1 has its own plan, `docs/superpowers/plans/2026-09-10-zone-lock.md`; the two touch no common file except `CHANGELOG.md`, `persistence-wiring.test.ts` and `digest.ts`/`digest.test.ts` (different rows), so either can land first.

**Two refinements of the spec, recorded in Task 7:**
- §4.2 says a v9 note missing either key fails the SCHEMA. Every plan is lifted to v9 in memory by the discriminator migration, so both keys must be optional in the schema; the both-or-neither rule is enforced in the mapper instead (`plan.frontmatter-invalid`).
- §4.4 lists three query members. They are one optional member, `hierarchy(planId)`, because all three answers come from the same two reads, and optional because a dozen editor test doubles implement `PlanEditorQueryServices`.

## Global Constraints

- Work in the worktree `C:\Projects\renovation-planner\.worktrees\zone-lock-detail-plans` on branch `feat/zone-lock-and-detail-plans`. Run `npm ci` there first if `node_modules` is missing. Never edit the main checkout.
- `npm run check` must pass before every commit; use `npm run check:fast -- <test paths>` between edits; never run two full gates at once.
- Layers: `presentation → application → domain → core`; nothing outside `infrastructure/` writes to the vault; registering with Obsidian stays in `src/plugin/`.
- Every user-visible string goes through `tr`/`t` with entries in BOTH `en` and `de` locale modules; sentence case.
- `lib` is ES2021: no `toSorted`, no `Object.hasOwn`.
- `max-lines` 400 per `src/` file; `max-lines-per-function` 100; `max-params` 5.
- A local assigned inside a callback narrows to its initialiser at later reads: declare `let created = null as string | null;`.
- View types and command ids are data; none are renamed.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Out of scope: warnings in the zone delete dialog, a tree in the project plan list, inheriting the parent's background, any `Site`/`Building`/`Floor` entity.

---

### Task 1: A plan carries its parent zone

**Files:**
- Modify: `src/domain/plan/Plan.ts`
- Modify: `src/infrastructure/persistence/dto/planFrontmatter.ts`
- Modify: `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts`
- Modify: `src/infrastructure/persistence/mappers/planMapper.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` (the retired-key list at the `processFrontMatter` call)
- Modify: `src/infrastructure/obsidian/repositories/digest.ts` (`SCHEMAS` row)
- Modify: `src/presentation/read-models/PlanDto.ts` (`PlanDto`, `toPlanDto`)
- Modify: `tests/domain/plan/plan.test.ts` (append)
- Create: `tests/infrastructure/persistence/planParentPersistence.test.ts`
- Modify: `tests/infrastructure/persistence/referencePlanMigration.test.ts`
- Modify: `tests/infrastructure/obsidian/repositories/digest.test.ts`
- Modify: `tests/plugin/persistence-wiring.test.ts` (`plan: 8` → `plan: 9`)

**Interfaces:**
- Produces: `interface PlanParent { readonly planId: PlanId; readonly zoneId: ZoneId }` exported from `src/domain/plan/Plan.ts`; `Plan.parent: PlanParent | null`; `CreatePlanProps.parent?: PlanParent | null`; validation code `plan.parent-is-self`; `PlanFrontmatterSchemaV9`; `PlanDto.parent?: { readonly planId: string; readonly zoneId: string }`.

- [ ] **Step 1: Write the failing domain test**

Append to `tests/domain/plan/plan.test.ts`:

```ts
describe('Plan parent', () => {
	it('carries an optional parent through every with-method, and refuses itself as parent', () => {
		const id = createPlanId();
		const parent = { planId: createPlanId(), zoneId: 'zone-house' as never };
		const plan = expectOk(Plan.create({ id, projectId: projectId(), name: 'House', parent }));
		expect(plan.parent).toEqual(parent);
		expect(expectOk(plan.withBackground(null)).parent).toEqual(parent);
		expect(expectOk(plan.withCalibration(null)).parent).toEqual(parent);
		expect(expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site' })).parent).toBeNull();
		expect(expectErr(Plan.create({ id, projectId: projectId(), name: 'Loop', parent: { ...parent, planId: id } })).code).toBe('plan.parent-is-self');
	});
});
```

- [ ] **Step 2: Write the failing persistence test**

Create `tests/infrastructure/persistence/planParentPersistence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { createRepositoryStack } from '../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

const HOUSE_ZONE = 'zone-house' as ZoneId;

describe('plan parent persistence (ADR-0028)', () => {
	it('writes v9 with both parent keys only for a detail plan, and reads them back', () => {
		const project = makeProject();
		const site = makePlan({ projectId: project.id, name: 'Site' });
		const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: HOUSE_ZONE } });
		const raw = planToPersistence(house, 1);
		expect(raw).toMatchObject({ 'schema-version': 9, 'parent-plan': site.id, 'parent-zone': HOUSE_ZONE });
		expect(planToPersistence(site, 1)['schema-version']).toBe(1);
		expect('parent-plan' in planToPersistence(site, 1)).toBe(false);
		expect(expectOk(planFromPersistence(raw, null)).parent).toEqual({ planId: site.id, zoneId: HOUSE_ZONE });
		expect(toPlanDto(house).parent).toEqual({ planId: site.id, zoneId: HOUSE_ZONE });
		expect('parent' in toPlanDto(site)).toBe(false);
	});

	it('refuses a note carrying only one half of the link', () => {
		const house = makePlan({ projectId: makeProject().id, parent: { planId: createPlanId(), zoneId: HOUSE_ZONE } });
		const raw = { ...planToPersistence(house, 1) };
		delete raw['parent-zone'];
		expect(expectErr(planFromPersistence(raw, null)).code).toBe('plan.frontmatter-invalid');
	});

	it('round-trips through the Obsidian repository', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const site = makePlan({ projectId: project.id, name: 'Site' });
		expectOk(await stack.plans.save(site, 'absent'));
		const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: HOUSE_ZONE } });
		expectOk(await stack.plans.save(house, 'absent'));
		expect(expectFound(await stack.plans.getById(house.id)).entity.parent).toEqual(house.parent);
	});
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npm run check:fast -- tests/domain/plan/plan.test.ts tests/infrastructure/persistence/planParentPersistence.test.ts`
Expected: FAIL — `'parent' does not exist in type 'CreatePlanProps'`.

- [ ] **Step 4: Add the parent to the entity**

In `src/domain/plan/Plan.ts`:

Add after the existing imports:

```ts
import type { ZoneId } from '../zone/ZoneId';

/** The zone of another plan this plan details (ADR-0028). Set once at creation and never moved. */
export interface PlanParent {
	readonly planId: PlanId;
	readonly zoneId: ZoneId;
}
```

Add to `CreatePlanProps` after `readonly layers?: readonly string[];`:

```ts
	readonly parent?: PlanParent | null;
```

Add to `PlanFields` after `readonly layers: readonly string[];`:

```ts
	readonly parent: PlanParent | null;
```

Add the class field after `readonly layers: readonly string[];` and the constructor assignment after `this.layers = fields.layers;`:

```ts
	readonly parent: PlanParent | null;
```

```ts
		this.parent = fields.parent;
```

In `create`, add directly before `const name = props.name.trim();`:

```ts
		if (props.parent && props.parent.planId === props.id) {
			return err(planError('parent-is-self', 'A plan cannot detail a zone of itself.'));
		}
```

and add to the `new Plan({ ... })` literal after `layers: [...layers],`:

```ts
					parent: props.parent ? { planId: props.parent.planId, zoneId: props.parent.zoneId } : null,
```

Add to `fields()` after `layers: this.layers,`:

```ts
			parent: this.parent,
```

(`withPlanRenovation` and `withPlanSpatialElements` spread the entity into `Plan.create`, so they carry `parent` with no change.)

- [ ] **Step 5: Add schema v9 and the 8 → 9 migration**

In `src/infrastructure/persistence/dto/planFrontmatter.ts`, change `export const PlanFrontmatterSchemaV8` to `const PlanFrontmatterSchemaV8` (its only other importer, `digest.test.ts`, moves to V9 in Step 7), then replace the last two lines (`PlanFrontmatterSchema` and `PlanFrontmatterDTO`) with:

```ts
/**
 * A detail plan's link to the zone it details (ADR-0028). Both keys are optional in the schema
 * because the discriminator migration lifts every older note to 9 in memory; the mapper refuses a
 * note carrying only one of them. Written only for a plan that has a parent.
 */
export const PlanFrontmatterSchemaV9 = PlanFrontmatterSchemaV8.extend({
	'schema-version': z.literal(9),
	'parent-plan': z.string().min(1).optional(),
	'parent-zone': z.string().min(1).optional(),
});
export const PlanFrontmatterSchema = z.union([PlanFrontmatterSchemaV1, PlanFrontmatterSchemaV2, PlanFrontmatterSchemaV3, PlanFrontmatterSchemaV4, PlanFrontmatterSchemaV5, PlanFrontmatterSchemaV6, PlanFrontmatterSchemaV7, PlanFrontmatterSchemaV8, PlanFrontmatterSchemaV9]);
export type PlanFrontmatterDTO = z.infer<typeof PlanFrontmatterSchemaV9>;
```

In `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts`, change the array to:

```ts
export const PLAN_MIGRATIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(version => discriminatorMigration(version, version + 1));
```

- [ ] **Step 6: Map the parent both ways**

In `src/infrastructure/persistence/mappers/planMapper.ts`:

Change `import type { Result } from '../../../core/result/Result';` to:

```ts
import { err, type Result } from '../../../core/result/Result';
import { planError } from '../../../domain/plan/Plan.errors';
import type { ZoneId } from '../../../domain/zone/ZoneId';
```

Make `planSchemaVersion`'s first line:

```ts
	if (plan.parent) return 9;
```

Add to `planToPersistence`'s literal after the `reference-appearance` spread:

```ts
		...(plan.parent ? { 'parent-plan': plan.parent.planId, 'parent-zone': plan.parent.zoneId } : {}),
```

In `fromDto`, add before `const constructed = Plan.create({`:

```ts
	const parentPlan = dto['parent-plan'], parentZone = dto['parent-zone'];
	if ((parentPlan === undefined) !== (parentZone === undefined)) {
		// `planError` prefixes `plan.`, so this is the same `plan.frontmatter-invalid` a schema refusal carries.
		return err(planError('frontmatter-invalid', 'parent-plan and parent-zone must be set together.'));
	}
```

and add to that `Plan.create({ ... })` literal after `layers: dto.layers,`:

```ts
		parent: parentPlan !== undefined && parentZone !== undefined ? { planId: parentPlan as Plan['id'], zoneId: parentZone as ZoneId } : null,
```

In `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts`, extend the retired-key list inside `processFrontMatter` to:

```ts
				for (const key of ['reference-appearance', 'renovation', 'spatial-elements', 'parent-plan', 'parent-zone']) if (!(key in dto)) delete frontmatter[key];
```

In `src/presentation/read-models/PlanDto.ts`, add to `PlanDto` after `readonly layers: readonly string[];`:

```ts
	/** Present only for a detail plan (ADR-0028). */
	readonly parent?: { readonly planId: string; readonly zoneId: string };
```

and add to `toPlanDto`'s literal after `layers: plan.layers,`:

```ts
		...(plan.parent ? { parent: { planId: plan.parent.planId, zoneId: plan.parent.zoneId } } : {}),
```

- [ ] **Step 7: Move the version-pinned tests to 9**

In `src/infrastructure/obsidian/repositories/digest.ts`, change the import `PLAN_TYPE, PlanFrontmatterSchemaV8` to `PLAN_TYPE, PlanFrontmatterSchemaV9` and the row `[PLAN_TYPE, PlanFrontmatterSchemaV8],` to `[PLAN_TYPE, PlanFrontmatterSchemaV9],`.

In `tests/infrastructure/obsidian/repositories/digest.test.ts`, change the import on line 6 to `PlanFrontmatterSchemaV9` and `[PLAN_TYPE]: PlanFrontmatterSchemaV8,` to `[PLAN_TYPE]: PlanFrontmatterSchemaV9,`.

In `tests/plugin/persistence-wiring.test.ts`, change `plan: 8,` to `plan: 9,` (leave `'plan-geometry': 8`).

In `tests/infrastructure/persistence/referencePlanMigration.test.ts`, first case: change `'schema-version': 8` to `'schema-version': 9`, `migrateToLatest('plan', latest, 8)` to `migrateToLatest('plan', latest, 9)`, and `'plan: 7 -> 8'` to `'plan: 8 -> 9'`. Third case: change `migrateToLatest('plan', raw, 9)` to `migrateToLatest('plan', raw, 10)`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/domain/plan tests/infrastructure tests/plugin/persistence-wiring.test.ts tests/presentation/read-models`
Expected: PASS.

- [ ] **Step 9: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/domain/plan/Plan.ts src/infrastructure/persistence/dto/planFrontmatter.ts src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts src/infrastructure/persistence/mappers/planMapper.ts src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts src/infrastructure/obsidian/repositories/digest.ts src/presentation/read-models/PlanDto.ts tests/domain/plan/plan.test.ts tests/infrastructure/persistence/planParentPersistence.test.ts tests/infrastructure/persistence/referencePlanMigration.test.ts tests/infrastructure/obsidian/repositories/digest.test.ts tests/plugin/persistence-wiring.test.ts
git commit -m "Persist a plan's parent zone as plan schema v9

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: CreatePlanCommand validates a parent

**Files:**
- Modify: `src/application/commands/plan/CreatePlan.ts`
- Modify: `src/plugin/composition-root.ts` (the `createPlan:` line in the guarded bundle)
- Modify: `tests/application/commands/plan/createPlan.test.ts`
- Modify: `tests/application/domain-loop.test.ts`, `tests/application/errors/guardAgainstThrowing.test.ts`, `tests/helpers/makeRenovationProjectView.ts`, `tests/plugin/sampleProject.test.ts` (constructor call sites)

**Interfaces:**
- Consumes: `PlanParent`, `Plan.parent` (Task 1); `ZoneRepository.getById(id): Promise<Result<Loaded<Zone> | null, RepositoryError>>`.
- Produces: `new CreatePlanCommand(plans, projects, zones, events)` — `zones` is the new THIRD argument. `CreatePlanInput.parent?: PlanParent`. Refusal codes (`ReferenceError`): `plan.parent-plan-not-found`, `plan.parent-project-mismatch`, `plan.parent-zone-not-found`.

- [ ] **Step 1: Write the failing tests**

In `tests/application/commands/plan/createPlan.test.ts`:

Add imports:

```ts
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
```

(replacing the existing `makeProject` import). Add `const zones = new InMemoryZoneRepository();` to `wired()` and return it: `return { projects, plans, zones, events, seed };`. Replace every `new CreatePlanCommand(X, Y, events)` in the file with `new CreatePlanCommand(X, Y, zones, events)`, destructuring `zones` from `wired()` in each case that does not already (the `FailingRead` and `FailingSave` cases: `const { plans, zones, events } = wired();` and `const { projects, zones, events, seed } = wired();`).

Append inside `describe('CreatePlanCommand', ...)`:

```ts
	async function parentScene() {
		const r = wired();
		const project = await r.seed();
		const site = makePlan({ projectId: project.id, name: 'Site' });
		expectOk(await r.plans.save(site, 'absent'));
		const house = makeZone({ projectId: project.id, planId: site.id, name: 'House', zoneType: 'Custom' });
		expectOk(await r.zones.save(house, 'absent'));
		const command = new CreatePlanCommand(r.plans, r.projects, r.zones, r.events);
		return { ...r, project, site, house, command };
	}

	it('creates a detail plan of a zone on another plan of the same project', async () => {
		const s = await parentScene();
		const { plan } = expectOk(await s.command.execute({ projectId: s.project.id, name: 'House', parent: { planId: s.site.id, zoneId: s.house.id } }));
		expect(plan.entity.parent).toEqual({ planId: s.site.id, zoneId: s.house.id });
		expect(s.events.published.map((event) => event.type)).toEqual(['PlanCreated']);
	});

	it('refuses a parent plan or zone that does not resolve, or that belongs elsewhere, and writes nothing', async () => {
		const s = await parentScene();
		const otherProject = makeProject();
		expectOk(await s.projects.save(otherProject, 'absent'));
		const foreignPlan = makePlan({ projectId: otherProject.id, name: 'Elsewhere' });
		expectOk(await s.plans.save(foreignPlan, 'absent'));
		const strayZone = makeZone({ projectId: s.project.id, planId: foreignPlan.id, name: 'Stray' });
		expectOk(await s.zones.save(strayZone, 'absent'));
		const cases: readonly [{ planId: never; zoneId: never }, string][] = [
			[{ planId: 'plan-missing' as never, zoneId: s.house.id as never }, 'plan.parent-plan-not-found'],
			[{ planId: foreignPlan.id as never, zoneId: s.house.id as never }, 'plan.parent-project-mismatch'],
			[{ planId: s.site.id as never, zoneId: 'zone-missing' as never }, 'plan.parent-zone-not-found'],
			[{ planId: s.site.id as never, zoneId: strayZone.id as never }, 'plan.parent-zone-not-found'],
		];
		for (const [parent, code] of cases) {
			expect(expectErr(await s.command.execute({ projectId: s.project.id, name: 'House', parent }))).toMatchObject({ category: 'Reference', code });
		}
		expect(expectOk(await s.plans.listByProject(s.project.id)).loaded.map((loaded) => loaded.entity.name)).toEqual(['Site']);
		expect(s.events.published).toHaveLength(0);
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/application/commands/plan/createPlan.test.ts`
Expected: FAIL — `Expected 3 arguments, but got 4`.

- [ ] **Step 3: Implement the validation**

Replace `src/application/commands/plan/CreatePlan.ts` with:

```ts
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { Plan, type PlanParent } from '../../../domain/plan/Plan';
import { createPlanId } from '../../../domain/plan/PlanId';
import type { PlanBackgroundRef } from '../../../domain/plan/PlanBackgroundRef';
import { planCreated } from '../../../domain/plan/Plan.events';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';

export interface CreatePlanInput {
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background?: PlanBackgroundRef | null;
	readonly layers?: readonly string[];
	/** Makes the new plan a detail plan of this zone (ADR-0028). */
	readonly parent?: PlanParent;
}

export type CreatePlanError = ReferenceError | RepositoryError;

export class CreatePlanCommand
	implements
		Command<
			CreatePlanInput,
			Result<{ plan: Loaded<Plan> }, CreatePlanError>
		>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly projects: ProjectRepository,
		private readonly zones: ZoneRepository,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred, for the reason `SetPlanBackground` states
	// at length: inference produces a union of `Result`s — one arm per error type the body
	// returns — which is not the same type as one `Result` over a union of errors, and the
	// difference only shows up in a caller. This command had no production caller until the
	// sample-project seed became one, and `isErr` could not narrow the union it got.
	async execute(
		input: CreatePlanInput,
	): Promise<Result<{ plan: Loaded<Plan> }, CreatePlanError>> {
		const found = await this.projects.getById(input.projectId);
		if (isErr(found)) {
			return found;
		}
		if (found.value === null) {
			return err(referenceError('plan.project-not-found', `Project ${input.projectId} not found.`));
		}
		if (input.parent) {
			const refused = await this.refuseParent(input.projectId, input.parent);
			if (refused !== null) return err(refused);
		}
		const created = Plan.create({ ...input, id: createPlanId() });
		if (isErr(created)) {
			return created;
		}
		const saved = await this.plans.save(created.value, 'absent');
		if (isErr(saved)) {
			return saved;
		}
		await this.events.publish(
			planCreated({ planId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
		);
		return ok({ plan: saved.value });
	}

	/** The parent plan exists in THIS project and the zone sits on that plan, or the reason it does not. */
	private async refuseParent(projectId: ProjectId, parent: PlanParent): Promise<CreatePlanError | null> {
		const plan = await this.plans.getById(parent.planId);
		if (isErr(plan)) return plan.error;
		if (plan.value === null) return referenceError('plan.parent-plan-not-found', `Plan ${parent.planId} not found.`);
		if (plan.value.entity.projectId !== projectId) {
			return referenceError('plan.parent-project-mismatch', `Plan ${parent.planId} belongs to another project.`);
		}
		const zone = await this.zones.getById(parent.zoneId);
		if (isErr(zone)) return zone.error;
		if (zone.value === null || zone.value.entity.planId !== parent.planId) {
			return referenceError('plan.parent-zone-not-found', `Zone ${parent.zoneId} is not on plan ${parent.planId}.`);
		}
		return null;
	}
}
```

- [ ] **Step 4: Update every other constructor call**

- `src/plugin/composition-root.ts`: `new CreatePlanCommand(plans, projects, eventBus)` → `new CreatePlanCommand(plans, projects, zones, eventBus)` (`zones` is already in scope; the next line builds `CreateZoneCommand(zones, ...)`).
- `tests/application/domain-loop.test.ts`: `new CreatePlanCommand(plans, projects, events)` → `new CreatePlanCommand(plans, projects, zones, events)` (`zones` is declared above it).
- `tests/application/errors/guardAgainstThrowing.test.ts`: `new CreatePlanCommand(plans, projects, events)` → `new CreatePlanCommand(plans, projects, new InMemoryZoneRepository(), events)`, adding `import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';` if the file does not already import it.
- `tests/helpers/makeRenovationProjectView.ts`: same as above, with the import path `'../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository'` unless a `zones` repository is already in scope there, in which case pass that.
- `tests/plugin/sampleProject.test.ts`: `new CreatePlanCommand(plans, projects, events)` → `new CreatePlanCommand(plans, projects, refusing.zones ?? stack.zones, events)`.

Run: `grep -rn "new CreatePlanCommand(" src tests`
Expected: every hit has four arguments.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/application tests/plugin/sampleProject.test.ts tests/presentation/views`
Expected: PASS.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/application/commands/plan/CreatePlan.ts src/plugin/composition-root.ts tests/application/commands/plan/createPlan.test.ts tests/application/domain-loop.test.ts tests/application/errors/guardAgainstThrowing.test.ts tests/helpers/makeRenovationProjectView.ts tests/plugin/sampleProject.test.ts
git commit -m "Validate a detail plan's parent zone when creating a plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: One read answers a plan's hierarchy

**Files:**
- Create: `src/presentation/read-models/planHierarchy.ts`
- Modify: `src/presentation/read-models/planEditorQueries.ts` (`PlanEditorQueryServices`, `createPlanEditorQueries`)
- Modify: `src/plugin/guardedServices.ts` (the `queries:` object in the returned bundle)
- Create: `tests/presentation/read-models/planHierarchy.test.ts`

**Interfaces:**
- Consumes: `Plan.parent` (Task 1); `GetPlan(plans)`, `ListPlansByProject(plans)`, `FindZonesByPlan(zones)`.
- Produces (exported from `planHierarchy.ts`):
  - `interface DetailPlanDto { readonly id: string; readonly name: string; readonly parentZoneId: string }`
  - `interface ParentZoneOutlineDto { readonly name: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }`
  - `interface PlanHierarchyDto { readonly ancestry: readonly PlanSummaryDto[]; readonly detailPlans: readonly DetailPlanDto[]; readonly parentZone: ParentZoneOutlineDto | null; readonly parentZoneMissing: boolean }`
  - `const NO_HIERARCHY: PlanHierarchyDto`
  - `function readPlanHierarchy(queries: HierarchyQueries, planId: string): Promise<Result<PlanHierarchyDto, RepositoryError>>`
  - `PlanEditorQueryServices.hierarchy?(planId: string): Promise<Result<PlanHierarchyDto, RepositoryError>>`

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/read-models/planHierarchy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { NO_HIERARCHY, readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

async function scene() {
	const plans = new InMemoryPlanRepository(), zones = new InMemoryZoneRepository(), project = makeProject();
	const site = makePlan({ projectId: project.id, name: 'Site' });
	const houseZone = makeZone({ projectId: project.id, planId: site.id, name: 'House', zoneType: 'Custom', geometry: squareAt(30000, 12000) });
	const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: houseZone.id } });
	const groundZone = makeZone({ projectId: project.id, planId: house.id, name: 'Footprint', zoneType: 'Custom' });
	const ground = makePlan({ projectId: project.id, name: 'Ground floor', parent: { planId: house.id, zoneId: groundZone.id } });
	const upper = makePlan({ projectId: project.id, name: 'Attic', parent: { planId: house.id, zoneId: groundZone.id } });
	const unrelated = makePlan({ projectId: makeProject().id, name: 'Elsewhere', parent: { planId: house.id, zoneId: groundZone.id } });
	for (const plan of [site, house, ground, upper, unrelated]) expectOk(await plans.save(plan, 'absent'));
	for (const zone of [houseZone, groundZone]) expectOk(await zones.save(zone, 'absent'));
	const queries = { getPlan: new GetPlan(plans), listPlans: new ListPlansByProject(plans), findZonesByPlan: new FindZonesByPlan(zones) };
	return { plans, zones, site, house, ground, upper, houseZone, groundZone, queries };
}

describe('readPlanHierarchy', () => {
	it('answers ancestry root first, this plan’s detail plans by name, and the parent zone outline', async () => {
		const s = await scene();
		const ground = expectOk(await readPlanHierarchy(s.queries, s.ground.id));
		expect(ground.ancestry).toEqual([{ id: s.site.id, name: 'Site' }, { id: s.house.id, name: 'House' }]);
		expect(ground.parentZone?.name).toBe('Footprint');
		expect(ground.parentZoneMissing).toBe(false);
		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house.detailPlans).toEqual([
			{ id: s.upper.id, name: 'Attic', parentZoneId: s.groundZone.id },
			{ id: s.ground.id, name: 'Ground floor', parentZoneId: s.groundZone.id },
		]);
		expect(house.parentZone?.points).toEqual(s.houseZone.geometry.points);
		const site = expectOk(await readPlanHierarchy(s.queries, s.site.id));
		expect(site.ancestry).toEqual([]);
		expect(site.parentZone).toBeNull();
		expect(site.detailPlans.map((plan) => plan.name)).toEqual(['House']);
	});

	it('reports a deleted parent zone, ends the chain at a missing ancestor, and stops at a cycle', async () => {
		const s = await scene();
		expectOk(await s.zones.delete(s.houseZone.id, expectFound(await s.zones.getById(s.houseZone.id)).version));
		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house).toMatchObject({ parentZone: null, parentZoneMissing: true, ancestry: [{ id: s.site.id, name: 'Site' }] });

		expectOk(await s.plans.delete(s.site.id, expectFound(await s.plans.getById(s.site.id)).version));
		expect(expectOk(await readPlanHierarchy(s.queries, s.house.id)).ancestry).toEqual([]);

		expect(expectOk(await readPlanHierarchy(s.queries, 'plan-missing'))).toEqual(NO_HIERARCHY);
	});
});
```

For the cycle half of the second case, add a pure test of `ancestryOf` (exported for exactly this, because a cycle cannot be produced through `Plan.create` for a plan and its own child without a hand-edited note):

```ts
import { ancestryOf } from '../../../src/presentation/read-models/planHierarchy';
import { createPlanId } from '../../../src/domain/plan/PlanId';

describe('ancestryOf', () => {
	it('stops at a cycle a hand-edited note could create', () => {
		const project = makeProject(), a = createPlanId(), b = createPlanId();
		const planA = makePlan({ id: a, projectId: project.id, name: 'A', parent: { planId: b, zoneId: 'zone-x' as never } });
		const planB = makePlan({ id: b, projectId: project.id, name: 'B', parent: { planId: a, zoneId: 'zone-y' as never } });
		expect(ancestryOf(planA, [planA, planB])).toEqual([{ id: b, name: 'B' }]);
	});
});
```

(Place the two extra imports with the others at the top of the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/read-models/planHierarchy.test.ts`
Expected: FAIL — `Cannot find module '.../planHierarchy'`.

- [ ] **Step 3: Implement the read**

Create `src/presentation/read-models/planHierarchy.ts`:

```ts
import type { Point } from '../../core/geometry/Point';
import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { ZoneListing } from '../../application/ports/ZoneRepository';
import type { Query } from '../../application/queries/Query';
import type { GetPlanInput } from '../../application/queries/GetPlan';
import type { FindZonesByPlanInput } from '../../application/queries/FindZonesByPlan';
import type { ListPlansByProjectInput, PlanListResult } from '../../application/queries/ListPlansByProject';
import type { Plan } from '../../domain/plan/Plan';
import type { PlanId } from '../../domain/plan/PlanId';
import type { PlanSummaryDto } from './PlanDto';

/** A plan that details one zone of the plan being shown (ADR-0028). */
export interface DetailPlanDto extends PlanSummaryDto {
	readonly parentZoneId: string;
}

/** The parent zone, as the detail plan draws it for a guide. World millimetres of the PARENT plan. */
export interface ParentZoneOutlineDto {
	readonly name: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}

export interface PlanHierarchyDto {
	/** Root first, ending at this plan's parent; empty for a plan with no parent. */
	readonly ancestry: readonly PlanSummaryDto[];
	/** Plans detailing a zone of THIS plan, sorted by name. */
	readonly detailPlans: readonly DetailPlanDto[];
	readonly parentZone: ParentZoneOutlineDto | null;
	/** This plan names a parent zone that no longer resolves. */
	readonly parentZoneMissing: boolean;
}

export const NO_HIERARCHY: PlanHierarchyDto = { ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false };

interface HierarchyQueries {
	readonly getPlan: Query<GetPlanInput, Result<Loaded<Plan> | null, RepositoryError>>;
	readonly listPlans: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;
	readonly findZonesByPlan: Query<FindZonesByPlanInput, Result<ZoneListing, RepositoryError>>;
}

/**
 * Walks `parent` links through plans already listed, root first. A missing ancestor ends the
 * chain there, and a repeated id — only a hand-edited note can make one — stops it.
 */
export function ancestryOf(plan: Plan, plans: readonly Plan[]): PlanSummaryDto[] {
	const byId = new Map(plans.map((item) => [String(item.id), item]));
	const seen = new Set<string>([String(plan.id)]);
	const chain: PlanSummaryDto[] = [];
	let parentId = plan.parent === null ? undefined : String(plan.parent.planId);
	while (parentId !== undefined && !seen.has(parentId)) {
		const parent = byId.get(parentId);
		if (parent === undefined) break;
		seen.add(parentId);
		chain.unshift({ id: parent.id, name: parent.name });
		parentId = parent.parent === null ? undefined : String(parent.parent.planId);
	}
	return chain;
}

function detailPlansOf(plan: Plan, plans: readonly Plan[]): DetailPlanDto[] {
	return plans
		.flatMap((item) => (item.parent !== null && item.parent.planId === plan.id ? [{ id: item.id, name: item.name, parentZoneId: item.parent.zoneId }] : []))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The editor's one hierarchy read (ADR-0028): two reads for any plan, three for a detail plan.
 * `ok(NO_HIERARCHY)` for a plan that no longer exists — `ProjectStore`'s own read already draws
 * that state, so a second answer here would only repeat it.
 */
export async function readPlanHierarchy(queries: HierarchyQueries, planId: string): Promise<Result<PlanHierarchyDto, RepositoryError>> {
	const found = await queries.getPlan.execute({ planId: planId as PlanId });
	if (isErr(found)) return found;
	if (found.value === null) return ok(NO_HIERARCHY);
	const plan = found.value.entity;
	const listed = await queries.listPlans.execute({ projectId: plan.projectId });
	if (isErr(listed)) return listed;
	const detailPlans = detailPlansOf(plan, listed.value.plans);
	if (plan.parent === null) return ok({ ...NO_HIERARCHY, detailPlans });
	const parent = plan.parent;
	const zones = await queries.findZonesByPlan.execute({ planId: parent.planId });
	if (isErr(zones)) return zones;
	const zone = zones.value.loaded.find((loaded) => loaded.entity.id === parent.zoneId)?.entity;
	return ok({
		ancestry: ancestryOf(plan, listed.value.plans),
		detailPlans,
		parentZone: zone === undefined ? null : { name: zone.name, points: [...zone.geometry.points], ...(zone.geometry.bulges ? { bulges: [...zone.geometry.bulges] } : {}) },
		parentZoneMissing: zone === undefined,
	});
}
```

- [ ] **Step 4: Expose it on the editor's query services**

In `src/presentation/read-models/planEditorQueries.ts`:

Add imports:

```ts
import type { ListPlansByProjectInput, PlanListResult } from '../../application/queries/ListPlansByProject';
import { readPlanHierarchy, type PlanHierarchyDto } from './planHierarchy';
```

Add to `PlanEditorQueryServices` after `listReassignmentTargets(...)`:

```ts
	/**
	 * Ancestry, detail plans and the parent zone outline (ADR-0028). OPTIONAL: a composition
	 * that supplies no plan listing simply draws no hierarchy, which is what every editor test
	 * double that predates it already means.
	 */
	hierarchy?(planId: string): Promise<Result<PlanHierarchyDto, RepositoryError>>;
```

Add to the `createPlanEditorQueries` parameter type after `readonly listReassignmentTargets?: ...;`:

```ts
	readonly listPlansByProject?: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;
```

Change the start of the function body from `return {` to:

```ts
	const listPlans = queries.listPlansByProject;
	return {
		...(listPlans === undefined
			? {}
			: { hierarchy: (planId: string) => readPlanHierarchy({ getPlan: queries.getPlan, listPlans, findZonesByPlan: queries.findZonesByPlan }, planId) }),
```

- [ ] **Step 5: Wire the guarded listing into the editor's queries**

In `src/plugin/guardedServices.ts`, in the returned bundle, change

```ts
		queries: { getProject, getPlan, getZone, findZonesByPlan, diagnostics },
```

to

```ts
		queries: { getProject, getPlan, getZone, findZonesByPlan, diagnostics, listPlansByProject },
```

`composition-root.ts` already spreads `...guarded.queries` into `createPlanEditorQueries`, so the editor receives it with no edit there. If `vue-tsc` reports that the declared type of `queries` on the guarded interface has no `listPlansByProject`, add to that interface's `queries` member: `readonly listPlansByProject: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/read-models tests/plugin/guardCategory.test.ts tests/plugin/persistence-wiring.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/presentation/read-models/planHierarchy.ts src/presentation/read-models/planEditorQueries.ts src/plugin/guardedServices.ts tests/presentation/read-models/planHierarchy.test.ts
git commit -m "Read a plan's ancestry, detail plans and parent zone in one query

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Hierarchy store, plan navigation and breadcrumb

**Files:**
- Create: `src/presentation/stores/PlanHierarchyStore.ts`
- Modify: `src/presentation/editor/PlanEditorRoot.vue` (`hydrate`)
- Modify: `src/presentation/editor/PlanEditorContext.ts` (`EditorNavigation`)
- Modify: `src/plugin/editorWorkspaceNavigation.ts`
- Modify: `src/presentation/editor/shell/EditorContextBar.vue`
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Modify: `src/presentation/i18n/locales/en/input.ts`, `src/presentation/i18n/locales/de/input.ts`
- Modify: `tests/plugin/editorWorkspaceNavigation.test.ts` (append)
- Modify: `tests/presentation/editor/shell/editorContextBar.test.ts` (append)

**Interfaces:**
- Consumes: `PlanEditorQueryServices.hierarchy` and `PlanHierarchyDto`/`NO_HIERARCHY` (Task 3); `renovationProjectOpenPlan(workspace, logger)` from `src/plugin/renovationProjectOpenSeams.ts`.
- Produces: `usePlanHierarchyStore()` with `hierarchy: Ref<PlanHierarchyDto>` and `load(queries: PlanEditorQueryServices, planId: string): Promise<void>`; `EditorNavigation.plan?(planId: string): Promise<void>`; crumb buttons `[data-rp-open-plan="<planId>"]`; string key `editor.input.parent-zone-missing`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('editor host navigation composition', ...)` in `tests/plugin/editorWorkspaceNavigation.test.ts`:

```ts
	it('opens a detail plan in its own editor leaf, reuses that leaf, and leaves the originating editor alone', async () => {
		const workspace = new FakeWorkspace();
		const origin = workspace.withOpen('renovation-plan-editor', { planId: 'plan-site' });
		const originalState = origin.state;
		const open = expectDefined(editorWorkspaceNavigation(workspace as never, recorder).plan, 'plan navigation');
		await open('plan-house');
		await open('plan-house');
		expect(workspace.leaves.filter((leaf) => leaf.state?.type === 'renovation-plan-editor').map((leaf) => (leaf.state?.state as { planId?: string } | undefined)?.planId))
			.toEqual(['plan-site', 'plan-house']);
		expect(origin.state).toBe(originalState);
	});
```

Append inside `describe('EditorContextBar', ...)` in `tests/presentation/editor/shell/editorContextBar.test.ts`, adding imports `import { ok } from '../../../../src/core/result/Result';`, `import { settle } from '../../../helpers/editor';` (merge into the existing `helpers/editor` import) and `import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../../helpers/planFixtures';`:

```ts
	it('puts the plan ancestry between the project and the floor, each crumb opening its plan', async () => {
		const opened: string[] = [];
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: (id) => { opened.push(id); return Promise.resolve(); } },
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site' }, { id: 'plan-house', name: 'House' }], detailPlans: [], parentZone: null, parentZoneMissing: true })),
			},
		});
		await settle();
		expect(harness.wrapper.findAll('.rp-context-bar__crumb').map((crumb) => crumb.text())).toEqual(['Willow House', 'Site', 'House', 'Ground floor']);
		await harness.wrapper.get('.rp-context-bar [data-rp-open-plan="plan-site"]').trigger('click');
		expect(opened).toEqual(['plan-site']);
		expect(harness.wrapper.text()).toContain(t('en', 'editor.input.parent-zone-missing'));
	});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run check:fast -- tests/plugin/editorWorkspaceNavigation.test.ts tests/presentation/editor/shell/editorContextBar.test.ts`
Expected: FAIL — `plan navigation` is undefined, and `'plan' does not exist in type 'EditorNavigation'`.

- [ ] **Step 3: Add the store**

Create `src/presentation/stores/PlanHierarchyStore.ts`:

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import { NO_HIERARCHY, type PlanHierarchyDto } from '../read-models/planHierarchy';

/**
 * One Plan Editor leaf's plan hierarchy (ADR-0028), rebuildable from `queries.hierarchy` like
 * every store here. A slower earlier read never lands over a later one.
 */
export const usePlanHierarchyStore = defineStore('plan-hierarchy', () => {
	const hierarchy = ref<PlanHierarchyDto>(NO_HIERARCHY);
	let latest = 0;

	async function load(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		if (queries.hierarchy === undefined) return;
		const request = ++latest;
		const found = await queries.hierarchy(planId);
		// ponytail: a failed hierarchy read keeps the last answer silently — the breadcrumb and guide
		// are additive, and the plan's own read already reports a vault fault. Surface it if a user
		// ever reports a missing crumb with no other error on screen.
		if (request === latest && found.ok) hierarchy.value = found.value;
	}

	return { hierarchy, load };
});
```

- [ ] **Step 4: Load it with the plan**

In `src/presentation/editor/PlanEditorRoot.vue`, add the import `import { usePlanHierarchyStore } from '../stores/PlanHierarchyStore';` beside the other store imports, add `const planHierarchy = usePlanHierarchyStore();` beside the other `use*Store()` calls in `<script setup>`, and replace `hydrate` with:

```ts
function hydrate(): void {
	void runtime.refreshProjection().catch(cause => { if (root.value) notifyFault(cause, context.commands.logger, 'editor.refresh.failed'); });
	void planHierarchy.load(context.queries, context.planId).catch(cause => { if (root.value) notifyFault(cause, context.commands.logger, 'editor.hierarchy.failed'); });
}
```

- [ ] **Step 5: Add plan navigation**

In `src/presentation/editor/PlanEditorContext.ts`, add to `EditorNavigation` after `project(projectId: string): Promise<void>;`:

```ts
	/** Open another plan in its own editor leaf (ADR-0028); optional so older doubles still type. */
	plan?(planId: string): Promise<void>;
```

In `src/plugin/editorWorkspaceNavigation.ts`, change the seams import to `import { renovationProjectOpenAssetLibrary, renovationProjectOpenPlan } from './renovationProjectOpenSeams';` and add to the returned object after `library: ...,`:

```ts
		// The SAME `revealPlanEditor` binding the project view opens plans through, so a plan open in
		// another leaf is revealed rather than duplicated. Its fault is reported inside the seam.
		plan: async planId => { await renovationProjectOpenPlan(workspace, logger)(planId); },
```

- [ ] **Step 6: Add the string**

In `src/presentation/i18n/locales/en/input.ts`, add before `} as const;`:

```ts
	'editor.input.parent-zone-missing': 'The zone this plan details no longer exists',
```

In `src/presentation/i18n/locales/de/input.ts`, add before `};`:

```ts
	'editor.input.parent-zone-missing': 'Die Zone, die dieser Plan detailliert, existiert nicht mehr',
```

- [ ] **Step 7: Draw the ancestry in the context bar**

In `src/presentation/editor/shell/EditorContextBar.vue`, add `import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';` and `const { hierarchy } = storeToRefs(usePlanHierarchyStore());`, then insert between the project crumb's `<span v-else-if ...>` and the plan crumb `<span v-if="plan?.name" ...>`:

```vue
			<template
				v-for="ancestor in hierarchy.ancestry"
				:key="ancestor.id"
			>
				<button
					v-if="context.navigation?.plan"
					type="button"
					class="rp-context-bar__crumb rp-context-bar__button"
					:data-rp-open-plan="ancestor.id"
					@click="context.navigation.plan(ancestor.id)"
				>
					{{ ancestor.name }}
				</button>
				<span
					v-else
					class="rp-context-bar__crumb"
				>{{ ancestor.name }}</span>
			</template>
```

- [ ] **Step 8: Draw it in the property panel**

In `src/presentation/editor/shell/PropertyLayerPanel.vue`, add `import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';` and `const { hierarchy } = storeToRefs(usePlanHierarchyStore());`, then insert between the project `<p v-else-if="project" ...>` and the floor `<p class="rp-property-context__floor" ...>`:

```vue
			<template
				v-for="ancestor in hierarchy.ancestry"
				:key="ancestor.id"
			>
				<button
					v-if="context.navigation?.plan"
					type="button"
					class="rp-property-context__project"
					:data-rp-open-plan="ancestor.id"
					@click="context.navigation.plan(ancestor.id)"
				>
					<HostIcon name="grid-2x-2" />{{ ancestor.name }}
				</button>
				<p
					v-else
					class="rp-property-context__project"
				>
					<HostIcon name="grid-2x-2" />{{ ancestor.name }}
				</p>
			</template>
```

and insert after the floor `</p>`:

```vue
			<p
				v-if="hierarchy.parentZoneMissing"
				class="rp-editor-inspector-empty"
			>
				{{ tr('editor.input.parent-zone-missing') }}
			</p>
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/plugin/editorWorkspaceNavigation.test.ts tests/presentation/editor/shell tests/presentation/editor/editorWorkspaceNavigation.test.ts tests/harness/accessibility.test.ts tests/presentation/i18n`
Expected: PASS.

- [ ] **Step 10: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/presentation/stores/PlanHierarchyStore.ts src/presentation/editor/PlanEditorRoot.vue src/presentation/editor/PlanEditorContext.ts src/plugin/editorWorkspaceNavigation.ts src/presentation/editor/shell/EditorContextBar.vue src/presentation/editor/shell/PropertyLayerPanel.vue src/presentation/i18n/locales/en/input.ts src/presentation/i18n/locales/de/input.ts tests/plugin/editorWorkspaceNavigation.test.ts tests/presentation/editor/shell/editorContextBar.test.ts
git commit -m "Walk a detail plan's ancestry from the breadcrumb

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Create and open detail plans from the zone context menu

**Files:**
- Create: `src/presentation/editor/hierarchy/detailPlanActions.ts`
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts`
- Modify: `src/presentation/editor/selection/CanvasContextMenu.vue` (menu item label)
- Modify: `src/presentation/editor/planEditorCommands.ts` (`PlanEditorCommandServices`)
- Modify: `src/plugin/planEditorDeps.ts`
- Modify: `src/presentation/views/NewPlanForm.vue` (props, `INITIAL`)
- Modify: `src/presentation/i18n/locales/en/input.ts`, `src/presentation/i18n/locales/de/input.ts`
- Create: `tests/presentation/editor/detailPlans.e2e.test.ts`

**Interfaces:**
- Consumes: `CreatePlanCommand` with `parent` (Task 2); `readPlanHierarchy` (Task 3); `usePlanHierarchyStore`, `EditorNavigation.plan` (Task 4).
- Produces: `PlanEditorCommandServices.createPlan?: Command<CreatePlanInput, Result<{ plan: Loaded<Plan> }, CreatePlanError>>`; `CanvasMenuAction.params?: Readonly<Record<string, string>>`; menu action ids `detail-plan-new` and `detail-plan-open:<planId>`; `NewPlanForm` props `initialName?: string` and `parent?: PlanParent`; string keys `editor.input.detail-plan-new`, `editor.input.detail-plan-open`.

- [ ] **Step 1: Write the failing end-to-end test**

Create `tests/presentation/editor/detailPlans.e2e.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { mountPlanEditorCanvas, runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { CreatePlanCommand } from '../../../src/application/commands/plan/CreatePlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';

const unmounts: (() => void)[] = [];
afterEach(() => { for (const unmount of unmounts.splice(0)) unmount(); });

async function rig() {
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN);
	await workspace.ready;
	const { stack } = workspace, opened: string[] = [];
	const hierarchy = (planId: string) => readPlanHierarchy({ getPlan: new GetPlan(stack.plans), listPlans: new ListPlansByProject(stack.plans), findZonesByPlan: new FindZonesByPlan(stack.zones) }, planId);
	const harness = await mountPlanEditorCanvas({
		plan: HARNESS_PLAN,
		vault: workspace.deps.vault,
		queries: { ...workspace.deps.queries, hierarchy },
		commands: { ...workspace.deps.commands, createPlan: new CreatePlanCommand(stack.plans, stack.projects, stack.zones, stack.events) },
		navigation: { project: () => Promise.resolve(), library: () => undefined, plan: (id) => { opened.push(id); return Promise.resolve(); } },
	});
	unmounts.push(() => harness.unmount());
	const runtime = runtimeOf(harness), selection = useSelectionStore(harness.pinia), dialogs = useDialogStore(harness.pinia);
	const menu = async () => { harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); };
	return { workspace, stack, harness, runtime, selection, dialogs, opened, menu };
}

it('creates a detail plan named after the zone, opens it, and then lists it under that zone', async () => {
	const r = await rig();
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: HARNESS_PLAN.id, name: 'House', zoneType: 'Custom', geometry: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	await r.menu();
	await r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]').trigger('click');
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');
	const form = r.harness.wrapper.get('.rp-dialog-form');
	expect((form.get('[data-field="name"]').element as HTMLInputElement).value).toBe('House');
	await form.trigger('submit');
	await settleUntil(() => r.opened.length === 1, 'detail plan opened');

	const created = expectFound(await r.stack.plans.getById(r.opened[0] as never)).entity;
	expect(created).toMatchObject({ name: 'House', parent: { planId: HARNESS_PLAN.id, zoneId: house.id } });

	await r.menu();
	await r.harness.wrapper.get(`[data-rp-context-action="detail-plan-open:${created.id}"]`).trigger('click');
	await settle();
	expect(r.opened).toEqual([created.id, created.id]);
});

it('offers no detail-plan action for a multi-selection', async () => {
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const a = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: HARNESS_PLAN.id, name: 'A', zoneType: 'Custom', geometry: { points } })).zone.entity;
	const b = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: HARNESS_PLAN.id, name: 'B', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([a.id, b.id]);
	await r.menu();
	expect(r.harness.wrapper.find('[data-rp-context-action="detail-plan-new"]').exists()).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/detailPlans.e2e.test.ts`
Expected: FAIL — `'createPlan' does not exist in type 'PlanEditorCommandServices'`.

- [ ] **Step 3: Add the strings**

In `src/presentation/i18n/locales/en/input.ts`, add before `} as const;`:

```ts
	'editor.input.detail-plan-new': 'New detail plan',
	'editor.input.detail-plan-open': 'Open {name}',
```

In `src/presentation/i18n/locales/de/input.ts`, add before `};`:

```ts
	'editor.input.detail-plan-new': 'Neuer Detailplan',
	'editor.input.detail-plan-open': '{name} öffnen',
```

- [ ] **Step 4: Put the command on the editor's services**

In `src/presentation/editor/planEditorCommands.ts`, add imports:

```ts
import type { CreatePlanError, CreatePlanInput } from '../../application/commands/plan/CreatePlan';
import type { Plan } from '../../domain/plan/Plan';
```

and add to `PlanEditorCommandServices` after `readonly createZone: ...;`:

```ts
	/**
	 * Creating a detail plan from a zone (ADR-0028). OPTIONAL: `unavailablePlanEditorCommands`
	 * and the editor test doubles omit it, and the context menu offers no detail-plan action then.
	 */
	readonly createPlan?: Command<CreatePlanInput, Result<{ plan: Loaded<Plan> }, CreatePlanError>>;
```

In `src/plugin/planEditorDeps.ts`, add after `createZone: persistence.createZone,`:

```ts
						createPlan: persistence.createPlan,
```

- [ ] **Step 5: Let the new-plan form start from a zone**

In `src/presentation/views/NewPlanForm.vue`:

Add to the imports: `import type { PlanParent } from '../../domain/plan/Plan';`

Add to `defineProps<{ ... }>` after `logger: Logger;`:

```ts
	/** Prefills the name when a detail plan is created from a zone (ADR-0028). */
	initialName?: string;
	/** Makes the created plan a detail plan of this zone. */
	parent?: PlanParent;
```

Replace `const INITIAL: CreatePlanInput = { projectId: props.projectId as ProjectId, name: '' };` with:

```ts
const INITIAL: CreatePlanInput = {
	projectId: props.projectId as ProjectId,
	name: props.initialName ?? '',
	...(props.parent ? { parent: props.parent } : {}),
};
```

- [ ] **Step 6: Build the actions**

Create `src/presentation/editor/hierarchy/detailPlanActions.ts`:

```ts
import { storeToRefs } from 'pinia';
import type { CreatePlanInput } from '../../../application/commands/plan/CreatePlan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { useProjectStore } from '../../stores/ProjectStore';
import NewPlanForm from '../../views/NewPlanForm.vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import type { CanvasMenuAction } from '../selection/useCanvasMenuActions';

/**
 * One zone's detail-plan menu entries (ADR-0028): New detail plan, then Open for each plan that
 * already details it. Nothing at all when this composition cannot create or open a plan.
 */
export function useDetailPlanActions() {
	const context = usePlanEditorContext(), project = useProjectStore(), dialogs = useDialogStore(), store = usePlanHierarchyStore();
	const { hierarchy } = storeToRefs(store);

	async function create(zoneId: string, name: string): Promise<void> {
		const createPlan = context.commands.createPlan, open = context.navigation?.plan, plan = project.plan;
		if (createPlan === undefined || open === undefined || plan === null || dialogs.current !== null) return;
		let created = null as string | null;
		const result = await dialogs.openDialog({
			kind: 'form',
			title: tr('form.new-plan.title'),
			component: NewPlanForm,
			props: {
				projectId: plan.projectId,
				initialName: name,
				parent: { planId: plan.id as PlanId, zoneId: zoneId as ZoneId },
				logger: context.commands.logger,
				dispatch: async (input: CreatePlanInput) => {
					const saved = await createPlan.execute(input);
					if (saved.ok) created = saved.value.plan.entity.id;
					return saved;
				},
			},
		});
		if (result === 'cancel' || created === null) return;
		await store.load(context.queries, context.planId);
		await open(created);
	}

	return (zoneId: string, name: string, blocked: boolean): CanvasMenuAction[] => {
		const open = context.navigation?.plan;
		if (context.commands.createPlan === undefined || open === undefined) return [];
		return [
			{ id: 'detail-plan-new', label: 'editor.input.detail-plan-new', disabled: blocked, run: () => create(zoneId, name) },
			...hierarchy.value.detailPlans
				.filter((detail) => detail.parentZoneId === zoneId)
				.map((detail): CanvasMenuAction => ({ id: `detail-plan-open:${detail.id}`, label: 'editor.input.detail-plan-open', params: { name: detail.name }, run: () => open(detail.id) })),
		];
	};
}
```

- [ ] **Step 7: Add them to the zone's menu**

In `src/presentation/editor/selection/useCanvasMenuActions.ts`:

Add `import { useDetailPlanActions } from '../hierarchy/detailPlanActions';`.

Change the `CanvasMenuAction` interface to:

```ts
export interface CanvasMenuAction { readonly id: string; readonly label: StringKey; readonly params?: Readonly<Record<string, string>>; readonly disabled?: boolean; run(): void | Promise<void> }
```

Add `const detailPlans = useDetailPlanActions();` after `const frame = usePlanFrame(), groups = useCanvasGroupActions(), session = useRenovationSession();`.

In `singleActions`, after the zone's `result.push({ id: 'delete', ... })` line, add:

```ts
				result.push(...detailPlans(id, zone.name, blocked));
```

In `src/presentation/editor/selection/CanvasContextMenu.vue`, change `{{ tr(action.label) }}` to `{{ tr(action.label, action.params) }}`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/editor/detailPlans.e2e.test.ts tests/presentation/editor/contextMenuActions.test.ts tests/presentation/editor/contextMenuLifecycle.test.ts tests/presentation/views tests/presentation/i18n`
Expected: PASS. If `settleUntil(... 'detail plan opened')` times out with the dialog still open, read `.rp-dialog-form`'s banner text: a Reference code there means the harness project or plan was not saved in `workspace.stack` before the zone was created.

- [ ] **Step 9: Run the gate and commit**

Run: `npm run check`
Expected: green. If ESLint refuses the `presentation/editor → presentation/views` import in `detailPlanActions.ts`, stop and report the rule name rather than moving or copying `NewPlanForm.vue`: spec §4.6 depends on reusing that one form.

```bash
git add src/presentation/editor/hierarchy/detailPlanActions.ts src/presentation/editor/selection/useCanvasMenuActions.ts src/presentation/editor/selection/CanvasContextMenu.vue src/presentation/editor/planEditorCommands.ts src/plugin/planEditorDeps.ts src/presentation/views/NewPlanForm.vue src/presentation/i18n/locales/en/input.ts src/presentation/i18n/locales/de/input.ts tests/presentation/editor/detailPlans.e2e.test.ts
git commit -m "Create and open detail plans from a zone's context menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The parent zone outline as a guide

**Files:**
- Create: `src/presentation/editor/hierarchy/parentZoneGuide.ts`
- Create: `src/presentation/editor/hierarchy/ParentZoneGuide.vue`
- Modify: `src/presentation/editor/layers/background/BackgroundLayer.vue` (template)
- Modify: `src/presentation/editor/PlanCanvas.vue` (the `<BackgroundLayer>` element and imports)
- Create: `tests/presentation/editor/parentZoneGuide.test.ts`

**Interfaces:**
- Consumes: `ParentZoneOutlineDto`, `NO_HIERARCHY` (Task 3); `usePlanHierarchyStore` (Task 4).
- Produces: `guideOutline(zone: ParentZoneOutlineDto): ParentZoneOutlineDto`; a Konva `Line` named `parent-zone-guide` inside the `background` layer.

- [ ] **Step 1: Write the failing tests**

Create `tests/presentation/editor/parentZoneGuide.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { ok } from '../../../src/core/result/Result';
import { guideOutline } from '../../../src/presentation/editor/hierarchy/parentZoneGuide';
import { NO_HIERARCHY } from '../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, layerNames, mountPlanEditorCanvas, settle } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

const HOUSE = { name: 'House', points: [{ x: 30000, y: 12000 }, { x: 40000, y: 12000 }, { x: 40000, y: 20000 }, { x: 30000, y: 20000 }] };

describe('guideOutline', () => {
	it('moves the zone so its bounding box top-left corner is world origin, keeping its shape', () => {
		expect(guideOutline(HOUSE).points).toEqual([{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 8000 }, { x: 0, y: 8000 }]);
		expect(guideOutline({ name: 'Empty', points: [] }).points).toEqual([]);
	});
});

describe('the parent zone guide on a detail plan', () => {
	it('draws inside the background layer, at origin, and listens to nothing', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, parentZone: HOUSE })) },
		});
		await settle();
		const guide = harness.stage.findOne<Konva.Line>('.parent-zone-guide');
		expect(guide?.getLayer()?.name()).toBe('background');
		expect(guide?.points().slice(0, 2)).toEqual([0, 0]);
		expect(guide?.listening()).toBe(false);
		expect(layerNames(harness.stage)).toHaveLength(7);
	});

	it('draws nothing for a plan without a parent zone', async () => {
		const harness = await mountPlanEditorCanvas();
		await settle();
		expect(harness.stage.findOne('.parent-zone-guide')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts`
Expected: FAIL — `Cannot find module '.../parentZoneGuide'`.

- [ ] **Step 3: Implement the placement**

Create `src/presentation/editor/hierarchy/parentZoneGuide.ts`:

```ts
import type { ParentZoneOutlineDto } from '../../read-models/planHierarchy';

/**
 * The parent zone moved so its bounding box's top-left corner is world origin (ADR-0028). A new
 * reference image's crop corner is pinned at world origin with no free offset (ADR-0019), so
 * cropping a drawing at the matching corner lines the two up. Bulges are translation-invariant.
 *
 * ponytail: vertex bounds, not curve bounds — a bulging first edge can sit a little above or left
 * of origin. Use `boundsOfZones` if a curved parent zone is ever reported misaligned.
 */
export function guideOutline(zone: ParentZoneOutlineDto): ParentZoneOutlineDto {
	if (zone.points.length === 0) return zone;
	const minX = Math.min(...zone.points.map((point) => point.x));
	const minY = Math.min(...zone.points.map((point) => point.y));
	return { ...zone, points: zone.points.map((point) => ({ x: point.x - minX, y: point.y - minY })) };
}
```

- [ ] **Step 4: Draw it**

Create `src/presentation/editor/hierarchy/ParentZoneGuide.vue`:

```vue
<script setup lang="ts">
/**
 * The parent zone's outline on a detail plan (ADR-0028): dashed, labelled, never a hit candidate,
 * never listed, never saved into this plan, and derived from the parent on every hierarchy read,
 * so recalibrating this plan does not move it. Mounted inside the background layer, so it hides
 * with the reference and adds no eighth layer to §17's seven.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import type { ThemeTokens } from '../theme/themeTokens';
import { guideOutline } from './parentZoneGuide';

const props = defineProps<{ tokens: ThemeTokens; zoom: number }>();
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const CAPTION_PX = 14;

const outline = computed(() => (hierarchy.value.parentZone === null ? null : guideOutline(hierarchy.value.parentZone)));
const line = computed(() => outline.value === null ? null : {
	name: 'parent-zone-guide',
	points: polygonPolyline(outline.value, 0.25 / props.zoom).flatMap((point) => [point.x, point.y]),
	closed: true,
	stroke: props.tokens.zoneStroke,
	strokeWidth: 1.5,
	dash: [8, 6],
	strokeScaleEnabled: false,
	listening: false,
});
const caption = computed(() => outline.value === null ? null : {
	name: 'parent-zone-guide-caption',
	x: 0,
	y: 0,
	offsetY: CAPTION_PX * 1.4,
	scaleX: 1 / props.zoom,
	scaleY: 1 / props.zoom,
	text: outline.value.name,
	fontSize: CAPTION_PX,
	fill: props.tokens.zoneCaption,
	listening: false,
});
</script>

<template>
	<VGroup :config="{ name: 'parent-zone-guide-group', listening: false }">
		<VLine
			v-if="line"
			:config="line"
		/>
		<VText
			v-if="caption"
			:config="caption"
		/>
	</VGroup>
</template>
```

In `src/presentation/editor/layers/background/BackgroundLayer.vue`, add a default slot after the `<VImage ... />` element, inside `</VLayer>`:

```vue
		<!-- A surface's own non-listening overlays that belong with the reference (ADR-0028's guide). -->
		<slot />
```

In `src/presentation/editor/PlanCanvas.vue`, add `import ParentZoneGuide from './hierarchy/ParentZoneGuide.vue';` beside the layer imports, and change the self-closing `<BackgroundLayer ... />` into an open element that contains the guide:

```vue
				<BackgroundLayer
					name="background"
					:reference="background"
					:vault="context.vault"
					:transform="transform"
					:visible="layerVisibility.background"
					:pixels-per-world-unit="pixelsPerWorldUnit"
					:file-changes="context.onVaultFileChanged"
					@status="(status) => emit('backgroundStatus', status)"
					@reference-points="onReferencePoints"
				>
					<ParentZoneGuide
						:tokens="props.tokens"
						:zoom="viewport.zoom"
					/>
				</BackgroundLayer>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts tests/presentation/editor/scene.test.ts tests/presentation/designer tests/presentation/editor/layers`
Expected: PASS (the designer suites prove the empty slot changes nothing there).

- [ ] **Step 6: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/presentation/editor/hierarchy/parentZoneGuide.ts src/presentation/editor/hierarchy/ParentZoneGuide.vue src/presentation/editor/layers/background/BackgroundLayer.vue src/presentation/editor/PlanCanvas.vue tests/presentation/editor/parentZoneGuide.test.ts
git commit -m "Draw the parent zone outline as a guide on a detail plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Record the decision, the backlog item and the manual case

**Files:**
- Create: `docs/development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md`
- Modify: `docs/development/adrs/0017-plan-presents-as-floor.md` (append amendment)
- Create (through the `adding-backlog-items` skill): a PBI `Create a detail plan from a zone and move between levels`
- Modify: `docs/requirements/Navigate property, building and floor context in the editor.md` (append amendment)
- Create: `docs/tests/cases/Build detail plans from site to floor.md`
- Modify: `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md` (§4.2, §4.4)
- Modify: `docs/using-plan-editor.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write ADR-0028**

Create `docs/development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md`:

```markdown
---
adr: 28
title: A plan may detail a zone of another plan
status: Accepted
date: 2026-09-10
area: domain
---

# ADR-0028: A plan may detail a zone of another plan

## Context

A renovator builds a property top-down: a site plan with a garden zone and a house zone, a plan
for the house, and floor plans inside it. ADR-0017 kept `Plan` flat with no persisted hierarchy
and named "two plans aligned as floors of one building" as its revisit trigger. This is that
trigger, met by a lighter structure than the Floor identity ADR-0017 anticipated.

## Decision

- `Plan.parent: { planId, zoneId } | null`, set only at creation by `CreatePlanCommand`, which
  refuses a parent plan that is missing or in another project and a zone that is missing or not
  on that plan. No command changes it afterwards. A plan cannot be its own parent.
- Persisted as `parent-plan` and `parent-zone` in plan frontmatter schema v9, written only for a
  plan with a parent. Both keys are optional in the schema (every older note is lifted to 9 in
  memory); the mapper refuses a note carrying only one. Both ids are stored so the up-link
  survives the zone's deletion.
- One read (`readPlanHierarchy`) answers ancestry, the plan's detail plans and the parent zone
  outline from `GetPlan`, `ListPlansByProject` and `FindZonesByPlan`; a per-leaf Pinia store
  holds it.
- The parent zone outline is drawn on the detail plan as a non-listening guide, translated so its
  vertex bounding box's top-left corner is world origin, because ADR-0019 pins a reference crop's
  corner at world origin with no free translation.
- No `Site`, `Building` or `Floor` entity. `Plan` still presents as Floor (ADR-0017).

## Alternatives

- **Store detail plan ids on the zone.** Two writers per creation, and deleting a zone would have
  to rewrite or orphan a list.
- **A `Site`/`Building` entity.** A second identity and a migration for a hierarchy the parent
  link already expresses.
- **An unlinked "new plan named after the zone".** No navigation, no guide, and the relationship
  lives only in the user's head.

## Consequences

- ADR-0017's "no persisted hierarchy" is amended to one optional, immutable link.
- A vault opened in an older build refuses detail plan notes.
- Deleting a zone leaves its detail plans; they lose the guide and say so.
- A detail plan created in one leaf appears in another leaf of the same parent on that leaf's next
  hydrate, not immediately.

## Revisit when

Plans must align across different origins or scales, a zone delete must account for its detail
plans, or ADR-0019 gains a free reference translation (the guide's placement depends on it).
```

Append to `docs/development/adrs/0017-plan-presents-as-floor.md`:

```markdown

## Amendment — 2026-09-10

Its revisit trigger was met and answered by
[ADR-0028](0028-a-plan-may-detail-a-zone-of-another-plan.md): a plan may carry one optional,
immutable link to a zone of another plan. "No persisted hierarchy" now reads "no hierarchy beyond
that link"; there is still no `Floor`, `Building` or `Property` entity.
```

- [ ] **Step 2: Add the backlog item**

Invoke the `adding-backlog-items` skill with: a PBI titled `Create a detail plan from a zone and move between levels`, actor Private renovator, decision [ADR-0028](../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md), acceptance criteria copied from spec §4.6–§4.9 (create from a zone's context menu with the zone name prefilled; open existing detail plans from the same menu; breadcrumb and property panel walk the ancestry; parent zone outline drawn as a non-listening guide at origin; the three missing-parent behaviours), status `Done`, and a closing-evidence line naming `tests/presentation/editor/detailPlans.e2e.test.ts`, `tests/presentation/read-models/planHierarchy.test.ts`, `tests/presentation/editor/parentZoneGuide.test.ts` and `tests/application/commands/plan/createPlan.test.ts`. Let the skill choose the parent Feature and file location.

Append to `docs/requirements/Navigate property, building and floor context in the editor.md`:

```markdown

## Amendments

**2026-09-10** — [ADR-0028](../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md)
adds a plan-to-zone parent link. The context bar and Property panel now show a detail plan's
ancestry as `Project › Site › House › Ground floor`, each crumb opening its plan through the
editor's plan reveal. The out-of-scope line about persisting hierarchy is narrowed accordingly;
Building and Floor entities remain out of scope.
```

- [ ] **Step 3: Write the manual case**

Create `docs/tests/cases/Build detail plans from site to floor.md`:

```markdown
# Build detail plans from site to floor

Contract: [ADR-0028](../../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md),
[ADR-0027](../../development/adrs/0027-zone-lock-is-canonical-click-through.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin.

1. Open a project with a site plan that has a background image and a large site zone containing a
   House zone.
2. Lock the site zone from **Rooms and areas**. Click inside the House zone on the canvas: House is
   selected, not the site. Right-click inside it: the menu is House's.
3. Choose **New detail plan**. The name reads `House`. Create it: a new editor tab opens on
   `House`, the breadcrumb reads `Project › Site plan › House`, and a dashed `House` outline sits
   at the top-left of the empty canvas.
4. Set up a reference image for `House` cropped at the building's top-left corner and calibrate
   it. The dashed outline and the drawing line up.
5. In `House`, draw a Footprint zone and create **New detail plan** `Ground floor` from it. The
   breadcrumb reads `Project › Site plan › House › Ground floor`. Click `Site plan` in it: the
   site tab comes forward rather than a second one opening.
6. Back on the site plan, right-click House: **Open House** is listed and brings that tab forward.
7. Close and reopen Obsidian. The site zone is still locked; every breadcrumb and guide is intact.
8. Delete the Footprint zone in `House`. Reopen `Ground floor`: no guide, and the Property panel
   says the zone it details no longer exists.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |
```

- [ ] **Step 4: Amend the spec**

In `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md`, replace the §4.2 bullet `- A v9 note missing either key fails the schema like any other malformed note.` with:

```markdown
- Both keys are optional in the v9 schema, because the discriminator migration lifts every older
  note to 9 in memory. The mapper refuses a note carrying only one of them with
  `plan.frontmatter-invalid` (implementation plan, 2026-09-10).
```

and append to §4.4:

```markdown

**Implementation refinement (2026-09-10):** the three answers are one optional member,
`hierarchy(planId)`, returning `{ ancestry, detailPlans, parentZone, parentZoneMissing }`, because
they come from the same two reads and a dozen editor test doubles implement this interface.
```

- [ ] **Step 5: Document it for users**

In `docs/using-plan-editor.md`, insert before `## Group and enclose a room` (after the lock section if Part 1 has landed):

```markdown
## Build detail plans from a zone

Right-click a zone such as House or Garden and choose **New detail plan**. The new plan is named
after the zone, opens in its own tab and shows that zone's outline as a dashed guide in its top-left
corner; crop its reference image at the same corner and calibrate it, and the drawing lines up with
the guide. A zone can have several detail plans, for example one per floor, and its right-click
menu lists **Open** for each. On a detail plan, the breadcrumb and the Property panel show every
plan above it, and each name opens that plan.
```

- [ ] **Step 6: Changelog**

In `CHANGELOG.md`, add under `## [Unreleased]` → `### Added`:

```markdown
- Plan editor: create a detail plan from a zone's context menu, open existing detail plans from the same menu, walk back up through the breadcrumb, and trace inside the parent zone's outline guide. Detail plan notes are saved as plan schema 9, which older builds refuse.
```

- [ ] **Step 7: Run the gate and commit**

Run: `npm run check`
Expected: green.

```bash
git add docs/development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md docs/development/adrs/0017-plan-presents-as-floor.md "docs/requirements/Navigate property, building and floor context in the editor.md" "docs/tests/cases/Build detail plans from site to floor.md" docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md docs/using-plan-editor.md CHANGELOG.md docs/requirements docs/tasks
git commit -m "Record detail plans from a zone as ADR-0028

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

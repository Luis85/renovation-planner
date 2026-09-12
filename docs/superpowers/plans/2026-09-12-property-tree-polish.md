# Property Tree Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Plan editor's sidebar Property tree draws every plan of the project nested by its parent link, with a persisted kind per plan driving its icon, siblings reorderable by drag, menu and keyboard, and an indent that costs 16px per level.

**Architecture:** Two new persisted fields on `Plan` (`kind`, `order`, frontmatter schema v10) written by one new `UpdatePlanDetailsCommand`; the existing hierarchy read model gains a whole-project `tree`; `PropertyTree.vue` becomes a recursive `role="tree"` with one reorder composable that every input (drop, menu, Alt+arrows) calls. Nothing changes how a plan gets its parent.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Zod frontmatter schemas, Vitest + jsdom, ESLint/oxlint gates, Playwright harness shots.

**Spec:** `docs/superpowers/specs/2026-09-12-property-tree-polish-design.md`

**Deviations from the spec, decided while reading the code (each is smaller than what the spec said):**

1. `UpdatePlanDetailsCommand` takes no `expectedVersion`: `ListPlansByProject` answers entities without versions, so the command loads the plan itself and saves on the version it read, exactly as `SetPlanBackgroundCommand` does. `PropertyTreeNode` therefore carries no `version`.
2. `ReorderPlansCommand` is not a class of its own; `usePlanReorder` dispatches `UpdatePlanDetails` once per changed sibling in sequence and stops at the first failure. Same behaviour, one fewer command to wire and guard.
3. The tree's context menu is a small component of its own (`PropertyTreeMenu.vue`) that reuses `CanvasContextMenu`'s CSS class and `role="menu"` markup rather than the component — that component is bound to the canvas, its selection store and the tool manager.
4. The frontmatter schema accepts any string for `kind` and any number for `order`; `Plan.create` is the ONE place that refuses (`plan.unknown-kind`, `plan.invalid-order`), so the read path and the create path give one answer.

## Global Constraints

- Every user-visible string goes through `tr(...)` with an `en` AND a `de` entry; a literal in `.setText`, `text:`, `addCommand` `name` or `addRibbonIcon` fails lint.
- No hard-coded colours in `styles/`; Obsidian CSS variables only. Partials stay under 400 lines.
- `src/**` files stay under 400 non-blank lines, functions under 100, cyclomatic complexity under 16.
- Layer rule: `presentation → application → domain → core`; `infrastructure → application ports → domain → core`; only `src/plugin/` composes. `vue`, `pinia`, `konva`, `obsidian` never appear in `core/`, `domain/`, `application/`.
- Nothing writes to the vault outside `infrastructure/`.
- A view type and a command id are data; do not rename either.
- Inner loop: `npm run check:fast -- <paths>`. Before the final commit: `npm run check` once (≈200s; never two gates at once).
- The edit hook lints each edited file; answer its findings before moving on.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Tests mirror `src/`; a jsdom test starts with `// @vitest-environment jsdom`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/domain/plan/PlanKind.ts` (new) | The kind vocabulary, its default, `childKindOf`. |
| `src/domain/plan/Plan.ts` | `kind`, `order`, `withDetails`, validation. |
| `src/domain/plan/Plan.events.ts` | `PlanDetailsChanged` event. |
| `src/application/commands/plan/CreatePlan.ts` | Accepts `kind`/`order`; assigns last order among siblings. |
| `src/application/commands/plan/UpdatePlanDetails.ts` (new) | The one write for an existing plan's kind/order. |
| `src/application/events/planChangeSource.ts` | Re-hydrate on `PlanDetailsChanged`. |
| `src/infrastructure/persistence/dto/planFrontmatter.ts` | Schema v10. |
| `src/infrastructure/persistence/mappers/planMapper.ts` | Read defaults, write-only-when-set, version 10. |
| `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts` | Lift 9 → 10. |
| `src/infrastructure/obsidian/repositories/digest.ts` | Owned keys from V10. |
| `src/presentation/read-models/PlanDto.ts` | `kind`/`order` on `PlanDto`, `kind` on `PlanSummaryDto`. |
| `src/presentation/read-models/planHierarchy.ts` | `PropertyTreeNode`, `propertyTreeOf`, `tree` on the DTO. |
| `src/presentation/editor/planEditorCommands.ts` | Optional `updatePlanDetails` on the command bundle. |
| `src/plugin/composition-root.ts`, `src/plugin/planEditorDeps.ts` | Construct, guard and hand over the command. |
| `src/presentation/editor/editorIcons.ts` | `PLAN_KIND_ICONS`. |
| `src/presentation/i18n/locales/{en,de}/editorShell.ts`, `{en,de}.ts` | Kind labels, menu labels, tree label, form label. |
| `src/presentation/editor/shell/PropertyTree.vue` | The `role="tree"` root, roving focus, keyboard. |
| `src/presentation/editor/shell/PropertyTreeNode.vue` (new) | One recursive node: row, drag handlers, children. |
| `src/presentation/editor/shell/PropertyTreeMenu.vue` (new) | Move up/down and Kind entries. |
| `src/presentation/editor/shell/usePlanReorder.ts` (new) | Sibling arithmetic and the one dispatch door. |
| `src/presentation/editor/shell/PropertyTreeRow.vue` | Deleted (replaced by `PropertyTreeNode.vue`). |
| `styles/editor-shell-fidelity.css` | Tree indent, row, drop indicator. |
| `src/presentation/views/NewPlanForm.vue` | Kind select, `parentKind` prop. |
| `src/presentation/editor/hierarchy/detailPlanActions.ts` | Passes `parentKind`. |
| `src/presentation/editor/shell/FloorInspector.vue` | Kind select. |
| `src/presentation/editor/shell/EditorContextBar.vue`, `EditorContextCrumb.vue` | Kind icon on crumbs. |
| `tests/harness/page.ts`, `tests/harness/planEditor.ts` | `?tree` knob. |
| `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` | `plan-editor-tree*` shots. |
| `docs/development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md` (new) | The record. |
| `docs/tests/cases/Reorder plans in the Property tree.md` (new) | Manual drag case. |

---

### Task 1: `PlanKind` and `Plan.kind` / `Plan.order`

**Files:**
- Create: `src/domain/plan/PlanKind.ts`
- Modify: `src/domain/plan/Plan.ts`
- Test: `tests/domain/plan/plan.test.ts`

**Interfaces:**
- Produces: `PLAN_KINDS`, `PlanKind`, `DEFAULT_PLAN_KIND`, `isPlanKind(value: unknown): value is PlanKind`, `childKindOf(parent: PlanKind): PlanKind`; `Plan.kind: PlanKind`, `Plan.order: number`, `Plan.withDetails(details: PlanDetails): Result<Plan, ValidationError>` with `export interface PlanDetails { readonly kind?: PlanKind; readonly order?: number }`; `CreatePlanProps.kind?`, `CreatePlanProps.order?`; error codes `plan.unknown-kind`, `plan.invalid-order`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/plan/plan.test.ts`:

```ts
import { childKindOf, DEFAULT_PLAN_KIND, isPlanKind, PLAN_KINDS } from '../../../src/domain/plan/PlanKind';

describe('Plan kind and order', () => {
	it('defaults to floor and order 0, and carries both through every with-method', () => {
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site' }));
		expect(plan.kind).toBe('floor');
		expect(plan.order).toBe(0);
		const site = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site', kind: 'site', order: 3 }));
		expect(expectOk(site.withBackground(null))).toMatchObject({ kind: 'site', order: 3 });
		expect(expectOk(site.withCalibration(null))).toMatchObject({ kind: 'site', order: 3 });
	});

	it('withDetails re-validates and leaves the parent alone', () => {
		const parent = { planId: createPlanId(), zoneId: 'zone-house' as never };
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'House', parent }));
		const moved = expectOk(plan.withDetails({ kind: 'building', order: 2 }));
		expect(moved).toMatchObject({ kind: 'building', order: 2, parent });
		expect(expectOk(moved.withDetails({ order: 5 }))).toMatchObject({ kind: 'building', order: 5 });
		expect(expectErr(plan.withDetails({ kind: 'attic' as never })).code).toBe('plan.unknown-kind');
		expect(expectErr(plan.withDetails({ order: -1 })).code).toBe('plan.invalid-order');
		expect(expectErr(plan.withDetails({ order: 1.5 })).code).toBe('plan.invalid-order');
	});

	it('refuses a kind outside the vocabulary and a bad order at creation', () => {
		expect(expectErr(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'X', kind: 'attic' as never })).code).toBe('plan.unknown-kind');
		expect(expectErr(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'X', order: Number.NaN })).code).toBe('plan.invalid-order');
	});

	it('PlanKind helpers: vocabulary, guard, and one step down', () => {
		expect(PLAN_KINDS).toEqual(['site', 'building', 'floor', 'room']);
		expect(DEFAULT_PLAN_KIND).toBe('floor');
		expect(isPlanKind('room')).toBe(true);
		expect(isPlanKind('attic')).toBe(false);
		expect(isPlanKind(3)).toBe(false);
		expect(childKindOf('site')).toBe('building');
		expect(childKindOf('building')).toBe('floor');
		expect(childKindOf('floor')).toBe('room');
		expect(childKindOf('room')).toBe('room');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/domain/plan/plan.test.ts`
Expected: FAIL — `Cannot find module '../../../src/domain/plan/PlanKind'`.

- [ ] **Step 3: Create `src/domain/plan/PlanKind.ts`**

```ts
/**
 * What a plan IS in the property, as a LABEL (ADR-0029): it drives the Property tree's icon and
 * level label and nothing else reads it. Not an entity — no Site, Building or Floor identity
 * arrives with it, and ADR-0017's "a Plan presents as Floor" is the default rather than the rule.
 */
export const PLAN_KINDS = ['site', 'building', 'floor', 'room'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const DEFAULT_PLAN_KIND: PlanKind = 'floor';

export function isPlanKind(value: unknown): value is PlanKind {
	return typeof value === 'string' && (PLAN_KINDS as readonly string[]).includes(value);
}

/** The kind a detail plan defaults to under a parent of `parent`'s kind: one step down, and a room's child is a room. */
export function childKindOf(parent: PlanKind): PlanKind {
	const index = PLAN_KINDS.indexOf(parent);
	return PLAN_KINDS[Math.min(index + 1, PLAN_KINDS.length - 1)];
}
```

- [ ] **Step 4: Add the fields to `src/domain/plan/Plan.ts`**

Add the import at the top:

```ts
import { DEFAULT_PLAN_KIND, isPlanKind, type PlanKind } from './PlanKind';
```

Add after `PlanParent`:

```ts
/** The two label fields `UpdatePlanDetailsCommand` writes (ADR-0029). */
export interface PlanDetails {
	readonly kind?: PlanKind;
	readonly order?: number;
}

function validateDetails(kind: PlanKind, order: number): Result<void, ValidationError> {
	if (!isPlanKind(kind)) {
		return err(planError('unknown-kind', `"${String(kind)}" is not a plan kind.`));
	}
	if (!Number.isInteger(order) || order < 0) {
		return err(planError('invalid-order', `A plan order must be a non-negative integer; got ${order}.`));
	}
	return ok(undefined);
}
```

Add `readonly kind?: PlanKind; readonly order?: number;` to `CreatePlanProps`, and `readonly kind: PlanKind; readonly order: number;` to `PlanFields` and to the class's field list. In the constructor add `this.kind = fields.kind; this.order = fields.order;`.

In `create`, after the `parent-is-self` check and before the name check:

```ts
		const kind = props.kind ?? DEFAULT_PLAN_KIND, order = props.order ?? 0;
		const checkedDetails = validateDetails(kind, order);
		if (!checkedDetails.ok) {
			return checkedDetails;
		}
```

and pass `kind, order,` into the `new Plan({...})` literal. Add `kind: this.kind, order: this.order,` to `fields()`.

Add the method after `withCalibration`:

```ts
	/**
	 * The label fields, re-validated (ADR-0029). `parent` is untouched: reparenting is not a
	 * thing this entity offers, and this is the only mutator that could have been mistaken for it.
	 */
	withDetails(details: PlanDetails): Result<Plan, ValidationError> {
		const kind = details.kind ?? this.kind, order = details.order ?? this.order;
		const checked = validateDetails(kind, order);
		if (!checked.ok) {
			return checked;
		}
		return ok(new Plan({ ...this.fields(), kind, order }));
	}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run check:fast -- tests/domain/plan`
Expected: PASS. `vue-tsc` will now report every `PlanDto` literal missing nothing yet (the DTO changes in Task 3), so only the domain suite is asserted here.

- [ ] **Step 6: Commit**

```bash
git add src/domain/plan/PlanKind.ts src/domain/plan/Plan.ts tests/domain/plan/plan.test.ts
git commit -m "Give a plan a kind label and a sibling order

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Frontmatter schema v10

**Files:**
- Modify: `src/infrastructure/persistence/dto/planFrontmatter.ts`
- Modify: `src/infrastructure/persistence/mappers/planMapper.ts`
- Modify: `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/digest.ts` (`PlanFrontmatterSchemaV9` → `V10`, both the import and the `SCHEMAS` row)
- Modify: `tests/infrastructure/persistence/referencePlanMigration.test.ts:17-18` (`9` → `10`)
- Modify: `tests/infrastructure/obsidian/repositories/digest.test.ts:6,108` (`V9` → `V10`)
- Create: `tests/infrastructure/persistence/planKindOrderPersistence.test.ts`

**Interfaces:**
- Consumes: `Plan.kind`, `Plan.order`, `DEFAULT_PLAN_KIND` (Task 1).
- Produces: `PlanFrontmatterSchemaV10` (exported), `PlanFrontmatterDTO` = its inference; frontmatter keys `kind`, `order`.

- [ ] **Step 1: Write the failing test**

Create `tests/infrastructure/persistence/planKindOrderPersistence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { createRepositoryStack } from '../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

describe('plan kind and order persistence (ADR-0029)', () => {
	it('writes v10 with kind and order only when they are not the defaults', () => {
		const project = makeProject();
		const site = makePlan({ projectId: project.id, name: 'Site', kind: 'site', order: 2 });
		expect(planToPersistence(site, 1)).toMatchObject({ 'schema-version': 10, kind: 'site', order: 2 });
		const plain = planToPersistence(makePlan({ projectId: project.id }), 1);
		expect(plain['schema-version']).toBe(1);
		expect('kind' in plain).toBe(false);
		expect('order' in plain).toBe(false);
		const ordered = planToPersistence(makePlan({ projectId: project.id, order: 1 }), 1);
		expect(ordered).toMatchObject({ 'schema-version': 10, order: 1 });
		expect('kind' in ordered).toBe(false);
	});

	it('reads a note without the keys as floor / 0, and refuses a wrong value rather than guessing', () => {
		const raw = planToPersistence(makePlan({ projectId: makeProject().id }), 1);
		expect(expectOk(planFromPersistence(raw, null))).toMatchObject({ kind: 'floor', order: 0 });
		expect(expectOk(planFromPersistence({ ...raw, 'schema-version': 10, kind: 'room', order: 4 }, null))).toMatchObject({ kind: 'room', order: 4 });
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 10, kind: 'attic' }, null)).code).toBe('plan.unknown-kind');
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 10, order: -1 }, null)).code).toBe('plan.invalid-order');
		expect(expectErr(planFromPersistence({ ...raw, 'schema-version': 10, order: 'first' }, null)).code).toBe('plan.frontmatter-invalid');
	});

	it('round-trips through the Obsidian repository', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const room = makePlan({ projectId: project.id, name: 'Kitchen', kind: 'room', order: 7 });
		expectOk(await stack.plans.save(room, 'absent'));
		expect(expectFound(await stack.plans.getById(room.id)).entity).toMatchObject({ kind: 'room', order: 7 });
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/infrastructure/persistence/planKindOrderPersistence.test.ts`
Expected: FAIL — `'schema-version'` is `1` where `10` is expected; `kind` is dropped on read.

- [ ] **Step 3: Add the schema**

In `src/infrastructure/persistence/dto/planFrontmatter.ts`, after `PlanFrontmatterSchemaV9`:

```ts
/**
 * A plan's kind label and sibling order (ADR-0029). Both optional: every older note lifts to 10 in
 * memory and reads as `floor` / `0`. `kind` is any string here and `order` any number, because
 * `Plan.create` is the ONE place that refuses a value outside the vocabulary (`plan.unknown-kind`,
 * `plan.invalid-order`) — a second vocabulary in this schema would be a second answer.
 */
export const PlanFrontmatterSchemaV10 = PlanFrontmatterSchemaV9.extend({
	'schema-version': z.literal(10),
	kind: z.string().optional(),
	order: z.number().optional(),
});
```

Add `PlanFrontmatterSchemaV10` to the `z.union([...])` and change the DTO line to `export type PlanFrontmatterDTO = z.infer<typeof PlanFrontmatterSchemaV10>;`.

- [ ] **Step 4: Mapper, migrations, digest**

`src/infrastructure/persistence/mappers/planMapper.ts`:

```ts
import { DEFAULT_PLAN_KIND, type PlanKind } from '../../../domain/plan/PlanKind';
```

First line of `planSchemaVersion`:

```ts
	if (plan.kind !== DEFAULT_PLAN_KIND || plan.order !== 0) return 10;
```

In `planToPersistence`'s literal, after the `parent` spread:

```ts
		...(plan.kind !== DEFAULT_PLAN_KIND ? { kind: plan.kind } : {}),
		...(plan.order !== 0 ? { order: plan.order } : {}),
```

In `fromDto`'s `Plan.create({...})` add:

```ts
		...(dto.kind !== undefined ? { kind: dto.kind as PlanKind } : {}),
		...(dto.order !== undefined ? { order: dto.order } : {}),
```

(The cast is the trust boundary: `Plan.create` refuses a wrong string, which is the test's `plan.unknown-kind` arm.)

`plan.migrations.ts`: `[1, 2, 3, 4, 5, 6, 7, 8, 9].map(...)`.

`digest.ts`: import and use `PlanFrontmatterSchemaV10`.

Tests: `referencePlanMigration.test.ts` lines 17–18 expect `10` (`'schema-version': 10` and `migrateToLatest('plan', latest, 10)`); `digest.test.ts` imports and lists `PlanFrontmatterSchemaV10`.

- [ ] **Step 5: Run the persistence suites**

Run: `npm run check:fast -- tests/infrastructure`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure tests/infrastructure
git commit -m "Persist plan kind and order as frontmatter schema v10

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: DTOs and the whole-project tree read model

**Files:**
- Modify: `src/presentation/read-models/PlanDto.ts`
- Modify: `src/presentation/read-models/planHierarchy.ts`
- Modify (fixtures gain `kind: 'floor', order: 0`): `tests/helpers/planFixtures.ts` (`FIXTURE_PLAN`), `tests/harness/planEditor.ts` (`HARNESS_PLAN`), `tests/helpers/planEditorRig.ts`, `tests/presentation/editor/tools/calibrateWiring.test.ts`, `tests/presentation/emptyStates/selectors.test.ts`, `tests/presentation/stores/projectStore.test.ts`
- Modify (hierarchy literals gain `tree: []`, ancestry entries gain `kind: 'floor'`): `tests/presentation/editor/shell/editorContextBar.test.ts`, `tests/presentation/stores/planHierarchyStore.test.ts`, `tests/presentation/editor/shell/propertyTree.test.ts` (rewritten in Task 7; add `tree: []` now so it compiles), `tests/infrastructure/persistence/planParentPersistence.test.ts` (no change needed — `toMatchObject`)
- Test: `tests/presentation/read-models/planHierarchy.test.ts`

**Interfaces:**
- Produces: `PlanDto.kind: PlanKind`, `PlanDto.order: number`, `PlanSummaryDto.kind: PlanKind`; `export interface PropertyTreeNode { readonly id: string; readonly name: string; readonly kind: PlanKind; readonly parentId: string | null; readonly children: readonly PropertyTreeNode[] }`; `propertyTreeOf(plans: readonly Plan[]): PropertyTreeNode[]`; `PlanHierarchyDto.tree: readonly PropertyTreeNode[]`; `NO_HIERARCHY.tree = []`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/read-models/planHierarchy.test.ts` (import `propertyTreeOf` from the module alongside `ancestryOf`):

```ts
describe('propertyTreeOf', () => {
	it('nests every plan under its parent, siblings by order then name, and marks kinds', async () => {
		const s = await scene();
		const tree = propertyTreeOf([s.upper, s.ground, s.house, s.site]);
		expect(tree).toEqual([
			{ id: s.site.id, name: 'Site', kind: 'floor', parentId: null, children: [
				{ id: s.house.id, name: 'House', kind: 'floor', parentId: s.site.id, children: [
					{ id: s.upper.id, name: 'Attic', kind: 'floor', parentId: s.house.id, children: [] },
					{ id: s.ground.id, name: 'Ground floor', kind: 'floor', parentId: s.house.id, children: [] },
				] },
			] },
		]);
	});

	it('orders siblings by order before name', () => {
		const project = makeProject();
		const b = makePlan({ projectId: project.id, name: 'B', order: 0 });
		const a = makePlan({ projectId: project.id, name: 'A', order: 1 });
		const c = makePlan({ projectId: project.id, name: 'C', order: 0 });
		expect(propertyTreeOf([a, b, c]).map((node) => node.name)).toEqual(['B', 'C', 'A']);
	});

	it('draws an orphan at the root and breaks a cycle at the root', () => {
		const project = makeProject();
		const orphan = makePlan({ projectId: project.id, name: 'Orphan', parent: { planId: createPlanId(), zoneId: 'zone-x' as never } });
		const loopA = makePlan({ projectId: project.id, name: 'Loop A' });
		const loopB = makePlan({ projectId: project.id, name: 'Loop B', parent: { planId: loopA.id, zoneId: 'zone-y' as never } });
		const loopAWithParent = expectOk(Plan.create({ ...loopA, parent: { planId: loopB.id, zoneId: 'zone-z' as never } }));
		const tree = propertyTreeOf([orphan, loopAWithParent, loopB]);
		expect(tree.map((node) => node.name).toSorted()).toEqual(['Loop A', 'Loop B', 'Orphan']);
		expect(tree.every((node) => node.children.length === 0)).toBe(true);
	});

	it('readPlanHierarchy carries the whole tree for any plan', async () => {
		const s = await scene();
		const ground = expectOk(await readPlanHierarchy(s.queries, s.ground.id));
		expect(ground.tree.map((node) => node.id)).toEqual([s.site.id]);
		expect(ground.tree[0].children[0].children.map((node) => node.name)).toEqual(['Attic', 'Ground floor']);
		expect(NO_HIERARCHY.tree).toEqual([]);
	});
});
```

Add `import { Plan } from '../../../src/domain/plan/Plan';` to that file's imports. Also change the existing `ancestry` assertion in the first case to `[{ id: s.site.id, name: 'Site', kind: 'floor' }, { id: s.house.id, name: 'House', kind: 'floor' }]` and the second case's `ancestry: [{ id: s.site.id, name: 'Site', kind: 'floor' }]`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/read-models/planHierarchy.test.ts`
Expected: FAIL — `propertyTreeOf` is not exported.

- [ ] **Step 3: DTOs**

`src/presentation/read-models/PlanDto.ts`: add `import type { PlanKind } from '../../domain/plan/PlanKind';` (a type import from `domain/` is allowed by the layer rule). Add `readonly kind: PlanKind; readonly order: number;` to `PlanDto` after `name`, and `readonly kind: PlanKind;` to `PlanSummaryDto`. In `toPlanDto` add `kind: plan.kind, order: plan.order,` after `name`; `toPlanSummaryDto` returns `{ id: plan.id, name: plan.name, kind: plan.kind }`.

- [ ] **Step 4: The tree builder**

In `src/presentation/read-models/planHierarchy.ts` add `import type { PlanKind } from '../../domain/plan/PlanKind';` and:

```ts
/** One plan in the project's Property tree; `children` sorted by `order`, then name. */
export interface PropertyTreeNode {
	readonly id: string;
	readonly name: string;
	readonly kind: PlanKind;
	readonly parentId: string | null;
	readonly children: readonly PropertyTreeNode[];
}

/**
 * The whole project nested by parent link, root first. A plan whose parent is not listed
 * (deleted, unreadable) draws at the root rather than vanishing — the requirement's "the chain
 * simply stops one level early", applied to the tree. A cycle (hand-edited notes only) has no
 * root to hang from, so every plan on it draws at the root too, childless: `attach` visits a
 * node at most once, so the second arrival at a cycle member finds it already placed.
 */
export function propertyTreeOf(plans: readonly Plan[]): PropertyTreeNode[] {
	const byId = new Map(plans.map((plan) => [String(plan.id), plan]));
	const childrenOf = new Map<string | null, Plan[]>();
	for (const plan of plans) {
		const parentId = plan.parent !== null && byId.has(String(plan.parent.planId)) ? String(plan.parent.planId) : null;
		childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), plan]);
	}
	const placed = new Set<string>();
	function build(parentId: string | null): PropertyTreeNode[] {
		const siblings = [...(childrenOf.get(parentId) ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
		return siblings.flatMap((plan) => {
			if (placed.has(String(plan.id))) return [];
			placed.add(String(plan.id));
			return [{ id: plan.id, name: plan.name, kind: plan.kind, parentId, children: build(String(plan.id)) }];
		});
	}
	const roots = build(null);
	// Cycle members reach nobody from the root; list them flat so nothing disappears.
	const stranded = plans.filter((plan) => !placed.has(String(plan.id))).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
	return [...roots, ...stranded.map((plan) => ({ id: plan.id, name: plan.name, kind: plan.kind, parentId: null, children: [] }))];
}
```

Add `readonly tree: readonly PropertyTreeNode[];` to `PlanHierarchyDto` (with the doc line `/** Every plan of the project, nested by parent link, root first. */`), `tree: []` to `NO_HIERARCHY`, and in `ancestryOf` push `{ id: parent.id, name: parent.name, kind: parent.kind }`. In `readPlanHierarchy`, after `detailPlans` is computed: `const tree = propertyTreeOf(listed.value.plans);` and include `tree` in both return literals (`{ ...NO_HIERARCHY, detailPlans, tree }` and `{ ...parentHierarchy.value, detailPlans, tree }`).

`detailPlansOf` also builds summaries: add `kind: item.kind` to its literal since `DetailPlanDto extends PlanSummaryDto`.

- [ ] **Step 5: Fixtures and literals**

Add `kind: 'floor', order: 0,` after `name` in each `PlanDto` literal listed in **Files**. Add `tree: []` to every `{ ancestry: …, detailPlans: [], parentZone: …, parentZoneMissing: … }` literal in the three test files listed, and `kind: 'floor'` to each `{ id, name }` ancestry entry there.

- [ ] **Step 6: Run the affected suites and the type-check**

Run: `npm run check:fast -- tests/presentation/read-models tests/presentation/stores tests/presentation/editor/shell tests/infrastructure/persistence`
Expected: PASS, and `vue-tsc` clean.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/read-models tests
git commit -m "Build the whole-project Property tree in the hierarchy read model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `CreatePlan` order assignment and `UpdatePlanDetailsCommand`

**Files:**
- Modify: `src/application/commands/plan/CreatePlan.ts`
- Create: `src/application/commands/plan/UpdatePlanDetails.ts`
- Modify: `src/domain/plan/Plan.events.ts`
- Modify: `src/application/events/planChangeSource.ts:26-34` (add `'PlanDetailsChanged'` to `PLAN_CHANGE_EVENTS`)
- Test: `tests/application/commands/plan/createPlan.test.ts`, `tests/application/commands/plan/updatePlanDetails.test.ts` (new)

**Interfaces:**
- Consumes: `Plan.withDetails`, `PlanDetails`, `PlanKind` (Task 1); `loadPlan`, `savePlan` (existing).
- Produces: `CreatePlanInput.kind?: PlanKind`, `CreatePlanInput.order?: number`; `export interface UpdatePlanDetailsInput extends PlanDetails { readonly planId: PlanId }`; `export type UpdatePlanDetailsError = ReferenceError | RepositoryError | ValidationError`; `class UpdatePlanDetailsCommand implements Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>>` constructed as `new UpdatePlanDetailsCommand(plans, events)`; event `planDetailsChanged(payload)` of type `'PlanDetailsChanged'`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/application/commands/plan/createPlan.test.ts`:

```ts
	it('assigns a new plan the order after its siblings, and takes an explicit kind and order', async () => {
		const { projects, plans, zones, events, seed } = wired();
		const project = await seed();
		const command = new CreatePlanCommand(plans, projects, zones, events);
		const first = expectOk(await command.execute({ projectId: project.id, name: 'Site', kind: 'site' }));
		expect(first.plan.entity).toMatchObject({ kind: 'site', order: 0 });
		const second = expectOk(await command.execute({ projectId: project.id, name: 'Garden' }));
		expect(second.plan.entity).toMatchObject({ kind: 'floor', order: 1 });
		const zone = makeZone({ projectId: project.id, planId: first.plan.entity.id });
		await zones.save(zone, 'absent');
		const child = expectOk(await command.execute({ projectId: project.id, name: 'House', parent: { planId: first.plan.entity.id, zoneId: zone.id }, kind: 'building' }));
		// Siblings are counted under the PARENT, so the first child is 0 even with two roots.
		expect(child.plan.entity).toMatchObject({ kind: 'building', order: 0 });
		const explicit = expectOk(await command.execute({ projectId: project.id, name: 'Shed', order: 9 }));
		expect(explicit.plan.entity.order).toBe(9);
	});
```

Create `tests/application/commands/plan/updatePlanDetails.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UpdatePlanDetailsCommand } from '../../../../src/application/commands/plan/UpdatePlanDetails';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { expectErr, expectFound, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makePlan, makeProject } from '../../../helpers/entities';

describe('UpdatePlanDetailsCommand', () => {
	it('writes kind and order on the version it read and publishes PlanDetailsChanged', async () => {
		const plans = new InMemoryPlanRepository(), events = new RecordingEventBus();
		const plan = makePlan({ projectId: makeProject().id, name: 'House' });
		expectOk(await plans.save(plan, 'absent'));
		const result = expectOk(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: plan.id, kind: 'building', order: 2 }));
		expect(result.plan.entity).toMatchObject({ kind: 'building', order: 2 });
		expect(expectFound(await plans.getById(plan.id)).entity).toMatchObject({ kind: 'building', order: 2 });
		expect(events.published).toEqual([{ type: 'PlanDetailsChanged', payload: { planId: plan.id, projectId: plan.projectId } }]);
	});

	it('refuses a missing plan and a bad value, writing and publishing nothing', async () => {
		const plans = new InMemoryPlanRepository(), events = new RecordingEventBus();
		expect(expectErr(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: createPlanId(), kind: 'room' })).code).toBe('plan.plan-not-found');
		const plan = makePlan({ projectId: makeProject().id });
		expectOk(await plans.save(plan, 'absent'));
		expect(expectErr(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: plan.id, order: -3 })).code).toBe('plan.invalid-order');
		expect(expectFound(await plans.getById(plan.id)).entity.order).toBe(0);
		expect(events.published).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/application/commands/plan`
Expected: FAIL — `UpdatePlanDetails` module missing; `order` is `0` for the second root.

- [ ] **Step 3: The event**

In `src/domain/plan/Plan.events.ts`:

```ts
/** A Plan's kind or sibling order changed (ADR-0029) — what `UpdatePlanDetailsCommand` publishes. */
export interface PlanDetailsChanged extends DomainEvent<'PlanDetailsChanged'> {
	readonly payload: PlanEventPayload;
}

export function planDetailsChanged(payload: PlanEventPayload): PlanDetailsChanged {
	return { type: 'PlanDetailsChanged', payload };
}
```

Add `'PlanDetailsChanged',` to `PLAN_CHANGE_EVENTS` in `planChangeSource.ts`, after `'PlanCalibrated'`.

- [ ] **Step 4: `CreatePlan`**

Add to `CreatePlanInput`:

```ts
	/** The kind label (ADR-0029); `floor` when omitted. */
	readonly kind?: PlanKind;
	/** Rank among siblings; one past the highest sibling when omitted, so a new plan lands last. */
	readonly order?: number;
```

with `import type { PlanKind } from '../../../domain/plan/PlanKind';`. In `execute`, replace the `Plan.create` line with (`input.order` is a number and `nextOrder` answers a `Result`, so the two shapes stay apart):

```ts
		let order = input.order;
		if (order === undefined) {
			const next = await this.nextOrder(input.projectId, input.parent?.planId ?? null);
			if (isErr(next)) return next;
			order = next.value;
		}
		const created = Plan.create({ ...input, order, id: createPlanId() });
```

and the method:

```ts
	/** One past the highest order among the plans sharing this parent (or the roots), so creation appends. */
	private async nextOrder(projectId: ProjectId, parentId: PlanId | null): Promise<Result<number, RepositoryError>> {
		const listed = await this.plans.listByProject(projectId);
		if (isErr(listed)) return listed;
		const siblings = listed.value.loaded.filter((loaded) => (loaded.entity.parent?.planId ?? null) === parentId);
		return ok(siblings.length === 0 ? 0 : Math.max(...siblings.map((loaded) => loaded.entity.order)) + 1);
	}
```

(`import type { PlanId } from '../../../domain/plan/PlanId';`.)

- [ ] **Step 5: The command**

Create `src/application/commands/plan/UpdatePlanDetails.ts`:

```ts
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Plan, PlanDetails } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planDetailsChanged } from '../../../domain/plan/Plan.events';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';
import { loadPlan } from './loadPlan';
import { savePlan } from './savePlan';

export interface UpdatePlanDetailsInput extends PlanDetails {
	readonly planId: PlanId;
}

export type UpdatePlanDetailsError = ReferenceError | RepositoryError | ValidationError;

/**
 * The one write for an existing plan's LABEL fields — kind and sibling order (ADR-0029). Loads,
 * applies `withDetails` (the domain's own validation, so a plan is updated under the rules it was
 * constructed under), and saves on the version it read, exactly as `SetPlanBackgroundCommand`
 * does. Frontmatter only: no sidecar, no geometry lock.
 *
 * A reorder is several of these in sequence (`usePlanReorder`), deliberately NOT one transaction:
 * two notes cannot be written atomically here, and a half-applied swap is a visible order the
 * user can redo, not data loss.
 */
export class UpdatePlanDetailsCommand implements Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>> {
	constructor(
		private readonly plans: PlanRepository,
		private readonly events: EventBus,
	) {}

	async execute(input: UpdatePlanDetailsInput): Promise<Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>> {
		const found = await loadPlan(this.plans, input.planId);
		if (isErr(found)) return found;
		const updated = found.value.entity.withDetails({ kind: input.kind, order: input.order });
		if (isErr(updated)) return updated;
		const saved = await savePlan(this.plans, this.events, updated.value, found.value.version, planDetailsChanged);
		if (isErr(saved)) return saved;
		return ok({ plan: saved.value });
	}
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run check:fast -- tests/application`
Expected: PASS (including `planChangeSource.test.ts` if it enumerates the event list — if it pins the list, add `'PlanDetailsChanged'` to its expectation).

- [ ] **Step 7: Commit**

```bash
git add src/application src/domain/plan/Plan.events.ts tests/application
git commit -m "Add UpdatePlanDetails and append a new plan after its siblings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Wire the command into the editor leaf

**Files:**
- Modify: `src/presentation/editor/planEditorCommands.ts:87` (after `createPlan`)
- Modify: `src/plugin/composition-root.ts:275,432` and `src/plugin/planEditorDeps.ts:78`
- Test: `tests/plugin/compositionRoot.test.ts` if it lists the persistence bundle's members (run `grep -n "createPlan" tests/plugin/*.test.ts` and add `updatePlanDetails` beside each `createPlan` expectation it finds)

**Interfaces:**
- Produces: `PlanEditorCommandServices.updatePlanDetails?: Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError | PersistenceError>>`; `PersistenceServices.updatePlanDetails` (guarded, event `'command.updatePlanDetails.failed'`).

- [ ] **Step 1: Declare on the bundle**

In `planEditorCommands.ts`, after `createPlan`:

```ts
	/**
	 * A plan's kind and sibling order (ADR-0029). OPTIONAL like `createPlan`: without it the
	 * Property tree offers no menu and no drag, and the Floor inspector's Kind select is absent.
	 */
	readonly updatePlanDetails?: Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>>;
```

with `import type { UpdatePlanDetailsError, UpdatePlanDetailsInput } from '../../application/commands/plan/UpdatePlanDetails';`.

- [ ] **Step 2: Construct and hand over**

`composition-root.ts`: beside the `createPlan` declaration add
`readonly updatePlanDetails: Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>>;`
and beside its construction
`updatePlanDetails: guardCommand(new UpdatePlanDetailsCommand(plans, eventBus), 'command.updatePlanDetails.failed', logger, map),`
(imports: `UpdatePlanDetailsCommand`, and the two types). Update the docblock sentence above `createPlan` to add: "`updatePlanDetails` by the Plan editor's Property tree and Floor inspector."

`planEditorDeps.ts:78`: `updatePlanDetails: persistence.updatePlanDetails,` under `createPlan`.

- [ ] **Step 3: Type-check and the plugin suites**

Run: `npm run check:fast -- tests/plugin`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/presentation/editor/planEditorCommands.ts src/plugin tests/plugin
git commit -m "Hand the Plan editor leaf the UpdatePlanDetails command

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Kind icons, strings and the `building` fixture

**Files:**
- Modify: `src/presentation/editor/editorIcons.ts`
- Modify: `src/presentation/i18n/locales/en/editorShell.ts`, `src/presentation/i18n/locales/de/editorShell.ts`
- Modify: `src/presentation/i18n/locales/en.ts:483`, `src/presentation/i18n/locales/de.ts:383` (form label)
- Create: `tests/fixtures/editor-icons/building.svg`
- Modify: `tests/helpers/editorIconNodes.ts`
- Test: `tests/presentation/editor/editorIcons.test.ts` (new)

**Interfaces:**
- Produces: `PLAN_KIND_ICONS: Readonly<Record<PlanKind, string>>`; string keys `editor.shell.kind.site|building|floor|room`, `editor.shell.tree`, `editor.shell.move-up`, `editor.shell.move-down`, `editor.shell.kind-menu`, `editor.shell.row-menu`, `form.new-plan.kind`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/editorIcons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAN_KINDS } from '../../../src/domain/plan/PlanKind';
import { PLAN_KIND_ICONS } from '../../../src/presentation/editor/editorIcons';
import { editorIconNodes } from '../../helpers/editorIconNodes';

describe('PLAN_KIND_ICONS', () => {
	it('names one distinct harness-drawable icon per kind', () => {
		const icons = PLAN_KINDS.map((kind) => PLAN_KIND_ICONS[kind]);
		expect(new Set(icons).size).toBe(PLAN_KINDS.length);
		for (const icon of icons) expect(editorIconNodes[icon], icon).toBeDefined();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/editorIcons.test.ts`
Expected: FAIL — `PLAN_KIND_ICONS` not exported.

- [ ] **Step 3: Icons**

Append to `editorIcons.ts`:

```ts
import type { PlanKind } from '../../domain/plan/PlanKind';

/** The Property tree's and the context bar's icon per plan kind (ADR-0029). The project row keeps `house`. */
export const PLAN_KIND_ICONS: Readonly<Record<PlanKind, string>> = {
	site: 'land-plot', building: 'building', floor: 'grid-2x-2', room: 'door-open',
};
/** The localised name of each kind — the tree's level label, the menu's and the form's option text. */
export const PLAN_KIND_LABELS: Readonly<Record<PlanKind, StringKey>> = {
	site: 'editor.shell.kind.site', building: 'editor.shell.kind.building', floor: 'editor.shell.kind.floor', room: 'editor.shell.kind.room',
};
```

with `import type { StringKey } from '../i18n/locales/en';` — the keys land in Step 4 of this task, so add the strings BEFORE running the type-check.

Create `tests/fixtures/editor-icons/building.svg` from Lucide revision `2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860` (`icons/building.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
```

Add to `editorIconNodes.ts`, in alphabetical position:

```ts
  "building": [{"tag":"rect","attributes":{"width":"16","height":"20","x":"4","y":"2","rx":"2","ry":"2"}},{"tag":"path","attributes":{"d":"M9 22v-4h6v4"}},{"tag":"path","attributes":{"d":"M8 6h.01"}},{"tag":"path","attributes":{"d":"M16 6h.01"}},{"tag":"path","attributes":{"d":"M12 6h.01"}},{"tag":"path","attributes":{"d":"M12 10h.01"}},{"tag":"path","attributes":{"d":"M12 14h.01"}},{"tag":"path","attributes":{"d":"M16 10h.01"}},{"tag":"path","attributes":{"d":"M16 14h.01"}},{"tag":"path","attributes":{"d":"M8 10h.01"}},{"tag":"path","attributes":{"d":"M8 14h.01"}}],
```

- [ ] **Step 4: Strings**

`en/editorShell.ts`, add:

```ts
	'editor.shell.tree': 'Property tree',
	'editor.shell.kind.site': 'Site',
	'editor.shell.kind.building': 'Building',
	'editor.shell.kind.floor': 'Floor',
	'editor.shell.kind.room': 'Room',
	'editor.shell.move-up': 'Move up',
	'editor.shell.move-down': 'Move down',
	'editor.shell.kind-menu': 'Mark as {kind}',
	'editor.shell.row-menu': 'Options for {name}',
```

`de/editorShell.ts`:

```ts
	'editor.shell.tree': 'Grundstücksbaum',
	'editor.shell.kind.site': 'Grundstück',
	'editor.shell.kind.building': 'Gebäude',
	'editor.shell.kind.floor': 'Etage',
	'editor.shell.kind.room': 'Raum',
	'editor.shell.move-up': 'Nach oben',
	'editor.shell.move-down': 'Nach unten',
	'editor.shell.kind-menu': 'Als {kind} markieren',
	'editor.shell.row-menu': 'Optionen für {name}',
```

`en.ts` after `'form.new-plan.name'`: `'form.new-plan.kind': 'Kind',`; `de.ts`: `'form.new-plan.kind': 'Art',`.

- [ ] **Step 5: Run the icon test and the locale gates**

Run: `npm run check:fast -- tests/presentation/editor/editorIcons.test.ts tests/build/localeModuleSentenceCase.test.ts tests/presentation/i18n`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/editorIcons.ts src/presentation/i18n tests/fixtures/editor-icons/building.svg tests/helpers/editorIconNodes.ts tests/presentation/editor/editorIcons.test.ts
git commit -m "Name an icon and a label per plan kind

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The recursive `role="tree"` with keyboard roving and the indent

**Files:**
- Rewrite: `src/presentation/editor/shell/PropertyTree.vue`
- Create: `src/presentation/editor/shell/PropertyTreeNode.vue`
- Delete: `src/presentation/editor/shell/PropertyTreeRow.vue`
- Modify: `styles/editor-shell-fidelity.css:15-32`
- Rewrite: `tests/presentation/editor/shell/propertyTree.test.ts`

**Interfaces:**
- Consumes: `hierarchy.tree` (Task 3), `PLAN_KIND_ICONS` (Task 6), `EditorNavigation.plan`.
- Produces: markup — `.rp-property-tree` › `.rp-property-tree__project` (button or `<p>`) › `ul.rp-property-tree__list[role=tree]` › `li[role=treeitem][aria-level][data-rp-plan-id]` › `.rp-property-tree__row` (button `[data-rp-open-plan]` when navigable, `<span aria-current="page">` for the open plan) › `ul.rp-property-tree__group[role=group]`. `PropertyTreeNode` props: `{ node: PropertyTreeNode; level: number; currentId: string; navigate?: (planId: string) => void }`. Drag and the menu are Task 8; this task leaves `data-rp-plan-id` and `data-rp-parent-id` on each `li` for it.

- [ ] **Step 1: Write the failing tests**

Replace `tests/presentation/editor/shell/propertyTree.test.ts` with:

```ts
// @vitest-environment jsdom
/**
 * The Property tree (ADR-0029): the project row, then EVERY plan of the project nested by parent
 * link as a `role="tree"`, the open plan marked `aria-current`, rows opening through the ONE
 * `navigation.plan` door and drawn as text without it. Keyboard: roving tabindex, arrows.
 */
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';

const leaf = (id: string, name: string, parentId: string | null, kind: PropertyTreeNode['kind'] = 'floor'): PropertyTreeNode => ({ id, name, kind, parentId, children: [] });
/** Site › House › { Ground floor (open), Attic } plus a second root, Garden. */
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-site', 'Site', null, 'site'), children: [
		{ ...leaf('plan-house', 'House', 'plan-site', 'building'), children: [leaf('plan-ground', 'Ground floor', 'plan-house'), leaf('plan-attic', 'Attic', 'plan-house')] },
	] },
	leaf('plan-garden', 'Garden', null, 'site'),
];
const hierarchy = (tree: PropertyTreeNode[] = TREE, parentZoneMissing = false): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing, tree });
const queries = (tree = TREE) => ({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy(tree))) });
const navigation = (plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve())) => ({ project: () => Promise.resolve(), library: () => undefined, plan });

describe('PropertyTree', () => {
	it('draws the project row, then every plan nested under its parent with its level', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		const tree = harness.wrapper.get('.rp-property-tree');
		expect(tree.get('.rp-property-tree__project').text()).toContain(FIXTURE_PROJECT.name);
		const items = tree.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('data-rp-plan-id'))).toEqual(['plan-site', 'plan-house', 'plan-ground', 'plan-attic', 'plan-garden']);
		expect(items.map((item) => item.attributes('aria-level'))).toEqual(['1', '2', '3', '3', '1']);
		expect(tree.get('[role="tree"]').attributes('aria-label')).toBe(t('en', 'editor.shell.tree'));
	});

	it('marks the open plan current and draws it as text, the rest as buttons when navigable', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation() });
		await settle();
		const tree = harness.wrapper.get('.rp-property-tree');
		expect(tree.get('[data-rp-plan-id="plan-ground"] .rp-property-tree__row').attributes('aria-current')).toBe('page');
		expect(tree.get('[data-rp-plan-id="plan-ground"] .rp-property-tree__row').element.tagName).toBe('SPAN');
		expect(tree.findAll('button.rp-property-tree__row')).toHaveLength(4);
	});

	it('opens another plan through navigation.plan, and draws rows as text without one', async () => {
		const plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const withNav = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation(plan) });
		await settle();
		await withNav.wrapper.get('[data-rp-open-plan="plan-attic"]').trigger('click');
		expect(plan).toHaveBeenCalledWith('plan-attic');
		const without = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		expect(without.wrapper.findAll('button.rp-property-tree__row')).toHaveLength(0);
		expect(without.wrapper.findAll('[role="treeitem"]')).toHaveLength(5);
	});

	it('labels each row with its kind and draws the kind icon', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		const row = harness.wrapper.get('[data-rp-plan-id="plan-house"] .rp-property-tree__row');
		expect(row.attributes('aria-description')).toBe(t('en', 'editor.shell.kind.building'));
		expect(row.find('.rp-host-icon[data-icon-request="building"]').exists()).toBe(true);
	});

	it('roves focus with the arrow keys and opens with Enter', async () => {
		const plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({ queries: queries(), navigation: navigation(plan) });
		await settle();
		const items = harness.wrapper.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1']);
		(items[2].element as HTMLElement).focus();
		await items[2].trigger('keydown', { key: 'ArrowDown' });
		expect(document.activeElement).toBe(items[3].element);
		await items[3].trigger('keydown', { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(items[1].element);
		await items[1].trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(items[2].element);
		await items[2].trigger('keydown', { key: 'End' });
		expect(document.activeElement).toBe(items[4].element);
		await items[4].trigger('keydown', { key: 'Home' });
		expect(document.activeElement).toBe(items[0].element);
		await items[0].trigger('keydown', { key: 'Enter' });
		expect(plan).toHaveBeenCalledWith('plan-site');
		harness.unmount();
	});

	it('shows the missing-parent line only when the hierarchy reports one', async () => {
		const missing = await mountPlanEditorCanvas({ queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy(TREE, true))) } });
		await settle();
		expect(missing.wrapper.get('.rp-property-tree').text()).toContain(t('en', 'editor.input.parent-zone-missing'));
		const present = await mountPlanEditorCanvas({ queries: queries() });
		await settle();
		expect(present.wrapper.get('.rp-property-tree').text()).not.toContain(t('en', 'editor.input.parent-zone-missing'));
	});

	it('draws the open plan alone when the leaf answers no hierarchy', async () => {
		const harness = await mountPlanEditorCanvas({ queries: fakeQueries(FIXTURE_PLAN) });
		await settle();
		const items = harness.wrapper.findAll('[role="treeitem"]');
		expect(items.map((item) => item.attributes('data-rp-plan-id'))).toEqual([FIXTURE_PLAN.id]);
		expect(items[0].get('.rp-property-tree__row').attributes('aria-current')).toBe('page');
	});

	it('falls back to the floor label for an unnamed plan', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries([leaf('plan-ground', '', null)]) });
		await settle();
		expect(harness.wrapper.get('[data-rp-plan-id="plan-ground"]').text()).toContain(t('en', 'editor.floor'));
	});
});
```

`mountPlanEditorCanvas` attaches to `document.body` itself (Konva measures its container), so `focus()` moves `document.activeElement`; every case here unmounts to keep the body clean for the next.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/propertyTree.test.ts`
Expected: FAIL — no `[role="treeitem"]`.

- [ ] **Step 3: `PropertyTreeNode.vue`**

```vue
<script setup lang="ts">
/**
 * One plan in the Property tree (ADR-0029) and, recursively, its children. A row is a button
 * when `navigate` is given and this is not the open plan; the open plan is a `<span
 * aria-current="page">`, and with no navigation every row is text — a button that does nothing
 * is the live-control-that-does-nothing shape slice 14 refused.
 *
 * `tabindex` is the roving one `PropertyTree` manages: `0` on the open plan, `-1` elsewhere.
 * The `<li>` carries the treeitem role so its whole subtree is its accessible content, and
 * `data-rp-plan-id`/`data-rp-parent-id` are what the reorder composable and the drag handlers
 * (Task 8) key on.
 */
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { PLAN_KIND_ICONS, PLAN_KIND_LABELS } from '../editorIcons';
import type { PropertyTreeNode as Node } from '../../read-models/planHierarchy';

const props = defineProps<{
	readonly node: Node;
	readonly level: number;
	readonly currentId: string;
	readonly navigate?: (planId: string) => void;
}>();
</script>

<template>
	<li
		role="treeitem"
		:aria-level="props.level"
		:aria-expanded="props.node.children.length > 0 ? true : undefined"
		:tabindex="props.node.id === props.currentId ? 0 : -1"
		:data-rp-plan-id="props.node.id"
		:data-rp-parent-id="props.node.parentId ?? undefined"
	>
		<button
			v-if="props.navigate && props.node.id !== props.currentId"
			type="button"
			class="rp-property-tree__row"
			:data-rp-open-plan="props.node.id"
			:aria-description="tr(PLAN_KIND_LABELS[props.node.kind])"
			tabindex="-1"
			@click="props.navigate(props.node.id)"
		>
			<HostIcon :name="PLAN_KIND_ICONS[props.node.kind]" />{{ props.node.name || tr('editor.floor') }}
		</button>
		<span
			v-else
			class="rp-property-tree__row"
			:aria-current="props.node.id === props.currentId ? 'page' : undefined"
			:aria-description="tr(PLAN_KIND_LABELS[props.node.kind])"
		>
			<HostIcon :name="PLAN_KIND_ICONS[props.node.kind]" />{{ props.node.name || tr('editor.floor') }}
		</span>
		<ul
			v-if="props.node.children.length > 0"
			role="group"
			class="rp-property-tree__group"
		>
			<PropertyTreeNode
				v-for="child in props.node.children"
				:key="child.id"
				:node="child"
				:level="props.level + 1"
				:current-id="props.currentId"
				:navigate="props.navigate"
			/>
		</ul>
	</li>
</template>
```

(A `<script setup>` SFC can reference itself by its file name; if `vue-tsc` refuses the self-reference, add `defineOptions({ name: 'PropertyTreeNode' })`.) The inner `button` is `tabindex="-1"` because the `li` is the focus stop; Enter/Space on the `li` is handled by the tree.

- [ ] **Step 4: `PropertyTree.vue`**

```vue
<script setup lang="ts">
/**
 * The Property tree (ADR-0029): the project row, then every plan of the project as one
 * `role="tree"` nested by parent link — `hierarchy.tree`, built once per hydrate from the same
 * `listPlans` read the ancestry uses. Full tree semantics with a roving tabindex: ↑/↓ walk the
 * visible rows, Home/End jump, ←/→ go to the parent / the first child (every node is expanded,
 * so → on a leaf does nothing), Enter or Space opens the focused plan through the ONE
 * `navigation.plan` door. This is the "arrives with a third level" deferral of the 2026-09-10
 * sidebar polish, and the third level is here.
 *
 * Reordering and the row menu are `usePlanReorder` / `PropertyTreeMenu` (Task 8), mounted here
 * so this file's template stays one list.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import PropertyTreeNode from './PropertyTreeNode.vue';

const { project, plan } = storeToRefs(useProjectStore());
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const context = usePlanEditorContext();
const treeEl = ref<HTMLElement | null>(null);
const navigate = computed(() => {
	const openPlan = context.navigation?.plan;
	return openPlan ? (planId: string) => { void openPlan(planId); } : undefined;
});
/**
 * A leaf whose query bundle answers no `hierarchy` (the harness index, the older editor rigs)
 * draws the open plan alone rather than an empty tree: the open plan is always a floor.
 */
const tree = computed(() =>
	hierarchy.value.tree.length > 0
		? hierarchy.value.tree
		: plan.value
			? [{ id: plan.value.id, name: plan.value.name, kind: plan.value.kind, parentId: null, children: [] }]
			: [],
);

function items(): HTMLElement[] {
	return [...(treeEl.value?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
}
function focusItem(target: HTMLElement | undefined): void {
	if (target) target.focus();
}
function onKeydown(event: KeyboardEvent): void {
	const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
	if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
	const all = items(), index = all.indexOf(item);
	const moves: Record<string, () => HTMLElement | undefined> = {
		ArrowDown: () => all[index + 1],
		ArrowUp: () => all[index - 1],
		Home: () => all[0],
		End: () => all.at(-1),
		ArrowRight: () => item.querySelector<HTMLElement>('[role="treeitem"]') ?? undefined,
		ArrowLeft: () => item.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? undefined,
	};
	const move = moves[event.key];
	if (move) { event.preventDefault(); focusItem(move()); return; }
	if ((event.key === 'Enter' || event.key === ' ') && navigate.value) {
		const id = item.dataset.rpPlanId;
		if (id && id !== context.planId) { event.preventDefault(); navigate.value(id); }
	}
}
</script>

<template>
	<div class="rp-property-tree">
		<button
			v-if="project && context.navigation"
			type="button"
			class="rp-property-tree__project"
			@click="context.navigation.project(project.id)"
		>
			<HostIcon name="house" />{{ project.name }}
		</button>
		<p
			v-else-if="project"
			class="rp-property-tree__project"
		>
			<HostIcon name="house" />{{ project.name }}
		</p>
		<ul
			ref="treeEl"
			role="tree"
			class="rp-property-tree__list"
			:aria-label="tr('editor.shell.tree')"
			@keydown="onKeydown"
		>
			<PropertyTreeNode
				v-for="node in tree"
				:key="node.id"
				:node="node"
				:level="1"
				:current-id="context.planId"
				:navigate="navigate"
			/>
		</ul>
		<p
			v-if="hierarchy.parentZoneMissing"
			class="rp-editor-inspector-empty"
		>
			{{ tr('editor.input.parent-zone-missing') }}
		</p>
	</div>
</template>
```

Delete `PropertyTreeRow.vue` (`git rm`). Grep `PropertyTreeRow` across `src/` and `tests/` to confirm nothing else imports it.

- [ ] **Step 5: Styles**

Replace lines 15–32 of `styles/editor-shell-fidelity.css` (the `.rp-property-tree__*` block) with:

```css
.renovation-plan-editor .rp-property-tree__project,
.renovation-plan-editor .rp-property-tree__row {
	display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px;
	margin: 0; padding: 4px 8px; height: auto; white-space: normal; text-align: start;
	color: var(--text-normal); background: transparent; border: 1px solid transparent; box-shadow: none; border-radius: var(--radius-s);
}
.renovation-plan-editor .rp-property-tree__list,
.renovation-plan-editor .rp-property-tree__group { list-style: none; margin: 0; padding: 0; }
/* The nesting IS the indent: 16px per level, the guide line on the group's own edge. */
.renovation-plan-editor .rp-property-tree__group { padding-inline-start: 16px; border-inline-start: 1px solid var(--background-modifier-border); }
.renovation-plan-editor [role="treeitem"] { outline: none; }
.renovation-plan-editor [role="treeitem"]:focus-visible > .rp-property-tree__row { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }
.renovation-plan-editor .rp-property-tree__row[aria-current="page"] {
	background: var(--background-modifier-active-hover); border-color: var(--background-modifier-border);
	font-weight: var(--font-semibold);
}
.renovation-plan-editor button.rp-property-tree__project:hover,
.renovation-plan-editor button.rp-property-tree__row:hover { background: var(--background-modifier-hover); }
.renovation-plan-editor button.rp-property-tree__project:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
```

- [ ] **Step 6: Run the tree suite, the context-bar suite and the accessibility suite**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/harness/accessibility.test.ts`
Expected: PASS. If axe reports `aria-description` as unsupported on `role="treeitem"` children, move the attribute onto the `<li>` and update the test selector accordingly.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell styles/editor-shell-fidelity.css tests/presentation/editor/shell/propertyTree.test.ts
git commit -m "Draw the whole property as a keyboard-navigable tree

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Reordering — composable, menu, drag and drop, Alt+arrows

**Files:**
- Create: `src/presentation/editor/shell/usePlanReorder.ts`
- Create: `src/presentation/editor/shell/PropertyTreeMenu.vue`
- Modify: `src/presentation/editor/shell/PropertyTree.vue`, `src/presentation/editor/shell/PropertyTreeNode.vue`
- Modify: `styles/editor-shell-fidelity.css` (drop indicator)
- Test: `tests/presentation/editor/shell/usePlanReorder.test.ts` (new), `tests/presentation/editor/shell/propertyTreeReorder.test.ts` (new)

**Interfaces:**
- Consumes: `PlanEditorCommandServices.updatePlanDetails` (Task 5), `hierarchy.tree`, `PlanHierarchyStore.load`, `reportDispatchFailure`, `runtime.writesBlocked`, `session.perspective`.
- Produces: `usePlanReorder(): { available: ComputedRef<boolean>; siblingsOf(id: string): readonly PropertyTreeNode[]; moveUp(id: string): Promise<void>; moveDown(id: string): Promise<void>; moveTo(id: string, index: number): Promise<void>; setKind(id: string, kind: PlanKind): Promise<void> }`; `plannedWrites(siblings: readonly PropertyTreeNode[], id: string, index: number): { planId: string; order: number }[]` (pure, exported for the unit test). `PropertyTreeMenu` props `{ planId: string; name: string; kind: PlanKind; x: number; y: number }`, emits `close`.

- [ ] **Step 1: Write the failing unit test for the arithmetic**

Create `tests/presentation/editor/shell/usePlanReorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { plannedWrites } from '../../../../src/presentation/editor/shell/usePlanReorder';
import type { PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';

const node = (id: string): PropertyTreeNode => ({ id, name: id, kind: 'floor', parentId: null, children: [] });
const SIBLINGS = [node('a'), node('b'), node('c'), node('d')];

describe('plannedWrites', () => {
	it('renumbers 0..n-1 after the move and writes only what changed', () => {
		expect(plannedWrites(SIBLINGS, 'c', 0)).toEqual([{ planId: 'c', order: 0 }, { planId: 'a', order: 1 }, { planId: 'b', order: 2 }]);
		expect(plannedWrites(SIBLINGS, 'a', 3)).toEqual([{ planId: 'b', order: 0 }, { planId: 'c', order: 1 }, { planId: 'd', order: 2 }, { planId: 'a', order: 3 }]);
	});

	it('writes nothing for a move to the same place, an unknown id or an index off the end', () => {
		expect(plannedWrites(SIBLINGS, 'b', 1)).toEqual([]);
		expect(plannedWrites(SIBLINGS, 'zz', 0)).toEqual([]);
		expect(plannedWrites(SIBLINGS, 'a', 9)).toEqual([{ planId: 'b', order: 0 }, { planId: 'c', order: 1 }, { planId: 'd', order: 2 }, { planId: 'a', order: 3 }]);
	});
});
```

(The last expectation pins that an index past the end clamps to last; `plannedWrites` writes every sibling whose position changed, compared against its INDEX in the sorted list — the tree is already sorted by order, so "position" is the order the vault will hold.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/usePlanReorder.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: `usePlanReorder.ts`**

```ts
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanKind } from '../../../domain/plan/PlanKind';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { reportDispatchFailure } from '../report-failure';
import type { PropertyTreeNode } from '../../read-models/planHierarchy';

/**
 * The writes a move needs: the siblings renumbered 0..n-1 with `id` at `index` (clamped), minus
 * every plan already at that position. Pure, so the arithmetic is tested without a store.
 */
export function plannedWrites(siblings: readonly PropertyTreeNode[], id: string, index: number): { planId: string; order: number }[] {
	const from = siblings.findIndex((node) => node.id === id);
	if (from < 0) return [];
	const to = Math.max(0, Math.min(index, siblings.length - 1));
	const moved = [...siblings];
	const [node] = moved.splice(from, 1);
	moved.splice(to, 0, node);
	return moved.flatMap((item, order) => (item === siblings[order] ? [] : [{ planId: item.id, order }]));
}

function siblingsIn(tree: readonly PropertyTreeNode[], parentId: string | null): readonly PropertyTreeNode[] {
	if (parentId === null) return tree;
	for (const node of tree) {
		if (node.id === parentId) return node.children;
		const found = siblingsIn(node.children, parentId);
		if (found.length > 0) return found;
	}
	return [];
}

function findNode(tree: readonly PropertyTreeNode[], id: string): PropertyTreeNode | undefined {
	for (const node of tree) {
		if (node.id === id) return node;
		const found = findNode(node.children, id);
		if (found) return found;
	}
	return undefined;
}

/**
 * The ONE door every reorder input goes through — the row menu, Alt+↑/↓ and a drop all call
 * `moveUp`/`moveDown`/`moveTo`, never `updatePlanDetails` directly (CLAUDE.md: one action,
 * every input). A move is one `UpdatePlanDetails` per changed sibling, in sequence, stopping at
 * the first refusal; not a transaction, and `UpdatePlanDetails`'s docblock says why. After the
 * writes the hierarchy is re-read from the vault rather than reordered locally, so the tree
 * shows what was actually saved — including a half-applied move.
 *
 * `available` is false with no command (the harness index mounts this panel with none), in
 * review perspective, and while writes are blocked by a stale projection.
 */
export function usePlanReorder() {
	const context = usePlanEditorContext(), runtime = useEditorRuntime(), session = useRenovationSession(), store = usePlanHierarchyStore();
	const { hierarchy } = storeToRefs(store);
	const command = context.commands.updatePlanDetails;
	const available = computed(() => command !== undefined && session.perspective !== 'review' && !runtime.writesBlocked.value);

	async function write(writes: readonly { planId: string; kind?: PlanKind; order?: number }[]): Promise<void> {
		if (command === undefined || writes.length === 0) return;
		for (const entry of writes) {
			const result = await command.execute({ ...entry, planId: entry.planId as PlanId });
			if (!result.ok) { reportDispatchFailure(result.error); break; }
		}
		await store.load(context.queries, context.planId);
	}
	function siblingsOf(id: string): readonly PropertyTreeNode[] {
		const node = findNode(hierarchy.value.tree, id);
		return node ? siblingsIn(hierarchy.value.tree, node.parentId) : [];
	}
	function moveTo(id: string, index: number): Promise<void> {
		return write(plannedWrites(siblingsOf(id), id, index));
	}
	function moveBy(id: string, delta: number): Promise<void> {
		const index = siblingsOf(id).findIndex((node) => node.id === id);
		return index < 0 ? Promise.resolve() : moveTo(id, index + delta);
	}
	return {
		available,
		siblingsOf,
		moveUp: (id: string) => moveBy(id, -1),
		moveDown: (id: string) => moveBy(id, 1),
		moveTo,
		setKind: (id: string, kind: PlanKind) => write([{ planId: id, kind }]),
	};
}
```

- [ ] **Step 4: `PropertyTreeMenu.vue`**

```vue
<script setup lang="ts">
/**
 * The Property tree row's context menu (ADR-0029): Move up, Move down, then one "Mark as …"
 * entry per kind with the current one checked. Same `rp-canvas-context-menu` chrome and
 * `role="menu"` keyboard contract as `CanvasContextMenu`, deliberately NOT that component: it is
 * bound to the canvas, the selection store and the tool manager, none of which a tree row has.
 * Positioned inside `.renovation-plan-editor` exactly as that menu is, and closed by Escape,
 * Tab, an outside pointer or a run action; focus returns to the row that opened it.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { PLAN_KINDS, type PlanKind } from '../../../domain/plan/PlanKind';
import { PLAN_KIND_ICONS, PLAN_KIND_LABELS } from '../editorIcons';
import { usePlanReorder } from './usePlanReorder';

const props = defineProps<{ readonly planId: string; readonly name: string; readonly kind: PlanKind; readonly x: number; readonly y: number; readonly first: boolean; readonly last: boolean }>();
const emit = defineEmits<{ close: [] }>();
const reorder = usePlanReorder();
const menu = ref<HTMLElement | null>(null);

function run(action: () => Promise<void>): void { emit('close'); void action(); }
function navigation(event: KeyboardEvent): void {
	if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); emit('close'); return; }
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')];
	const index = items.indexOf(document.activeElement as HTMLElement);
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[next]?.focus();
}
function outside(event: PointerEvent): void { if (!menu.value?.contains(event.target as Node)) emit('close'); }
onMounted(async () => {
	document.addEventListener('pointerdown', outside, true);
	await nextTick();
	menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true));
</script>

<template>
	<div
		ref="menu"
		class="rp-canvas-context-menu rp-property-tree__menu"
		role="menu"
		:aria-label="tr('editor.shell.row-menu', { name: props.name })"
		:style="{ left: `${props.x}px`, top: `${props.y}px` }"
		@keydown="navigation"
	>
		<button
			type="button"
			role="menuitem"
			tabindex="-1"
			data-rp-tree-action="move-up"
			:aria-disabled="props.first || undefined"
			@click="props.first ? undefined : run(() => reorder.moveUp(props.planId))"
		>
			<HostIcon name="chevron-up" />{{ tr('editor.shell.move-up') }}
		</button>
		<button
			type="button"
			role="menuitem"
			tabindex="-1"
			data-rp-tree-action="move-down"
			:aria-disabled="props.last || undefined"
			@click="props.last ? undefined : run(() => reorder.moveDown(props.planId))"
		>
			<HostIcon name="chevron-down" />{{ tr('editor.shell.move-down') }}
		</button>
		<button
			v-for="kind in PLAN_KINDS"
			:key="kind"
			type="button"
			role="menuitemradio"
			tabindex="-1"
			:aria-checked="kind === props.kind"
			:data-rp-tree-action="`kind:${kind}`"
			@click="run(() => reorder.setKind(props.planId, kind))"
		>
			<HostIcon :name="PLAN_KIND_ICONS[kind]" />{{ tr('editor.shell.kind-menu', { kind: tr(PLAN_KIND_LABELS[kind]) }) }}
		</button>
	</div>
</template>
```

`:style` with a computed position is the same binding `CanvasContextMenu` uses (`:style="position"`), so it passes the same lint.

- [ ] **Step 5: Wire menu, drag and Alt+arrows into the tree**

`PropertyTree.vue` additions (script):

```ts
import PropertyTreeMenu from './PropertyTreeMenu.vue';
import { usePlanReorder } from './usePlanReorder';
import { findNode } from './usePlanReorder'; // export findNode from usePlanReorder.ts

const reorder = usePlanReorder();
const menuFor = ref<{ planId: string; x: number; y: number } | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const menuNode = computed(() => (menuFor.value ? findNode(tree.value, menuFor.value.planId) : undefined));
const menuPosition = computed(() => {
	if (!menuFor.value || !menuNode.value) return null;
	const siblings = reorder.siblingsOf(menuNode.value.id), index = siblings.findIndex((node) => node.id === menuNode.value?.id);
	return { ...menuFor.value, first: index <= 0, last: index >= siblings.length - 1 };
});
let opener: HTMLElement | null = null;
function openMenu(item: HTMLElement, x: number, y: number): void {
	if (!reorder.available.value) return;
	const id = item.dataset.rpPlanId;
	if (!id) return;
	const host = rootEl.value?.closest<HTMLElement>('.renovation-plan-editor')?.getBoundingClientRect();
	opener = item;
	menuFor.value = { planId: id, x: Math.max(8, x - (host?.left ?? 0)), y: Math.max(8, y - (host?.top ?? 0)) };
}
function closeMenu(): void { menuFor.value = null; opener?.focus(); }
function onContextMenu(event: MouseEvent): void {
	const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
	if (!item) return;
	event.preventDefault(); event.stopPropagation();
	openMenu(item, event.clientX, event.clientY);
}
```

Extend `onKeydown` before the `moves` lookup:

```ts
	if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && reorder.available.value) {
		event.preventDefault();
		const id = item.dataset.rpPlanId ?? '';
		void (event.key === 'ArrowUp' ? reorder.moveUp(id) : reorder.moveDown(id));
		return;
	}
	if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
		event.preventDefault();
		const rect = item.getBoundingClientRect();
		openMenu(item, rect.left + 24, rect.top + rect.height / 2);
		return;
	}
```

(Move the `event.altKey` early-return so it runs AFTER the Alt block: `if (!item || event.ctrlKey || event.metaKey) return;` then the Alt block, then `if (event.altKey) return;`.)

Drag state and handlers, in the same script:

```ts
/** The row being dragged, and its parent — a drop is legal only on a row with the SAME parent. */
const dragging = ref<{ planId: string; parentId: string | null } | null>(null);
const dropAt = ref<{ planId: string; edge: 'before' | 'after' } | null>(null);
function itemOf(event: DragEvent): HTMLElement | null { return (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]'); }
function onDragStart(event: DragEvent): void {
	const item = itemOf(event);
	if (!item || !reorder.available.value) { event.preventDefault(); return; }
	dragging.value = { planId: item.dataset.rpPlanId ?? '', parentId: item.dataset.rpParentId ?? null };
	event.dataTransfer?.setData('text/plain', '');
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
function onDragOver(event: DragEvent): void {
	const item = itemOf(event);
	if (!item || !dragging.value || (item.dataset.rpParentId ?? null) !== dragging.value.parentId || item.dataset.rpPlanId === dragging.value.planId) { dropAt.value = null; return; }
	event.preventDefault();
	const row = item.querySelector<HTMLElement>('.rp-property-tree__row'), rect = row?.getBoundingClientRect();
	dropAt.value = { planId: item.dataset.rpPlanId ?? '', edge: rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before' };
}
function onDrop(event: DragEvent): void {
	const target = dropAt.value, source = dragging.value;
	dragging.value = null; dropAt.value = null;
	if (!target || !source) return;
	event.preventDefault();
	const siblings = reorder.siblingsOf(source.planId);
	const from = siblings.findIndex((node) => node.id === source.planId), over = siblings.findIndex((node) => node.id === target.planId);
	if (from < 0 || over < 0) return;
	let index = target.edge === 'after' ? over + 1 : over;
	if (from < index) index -= 1;
	void reorder.moveTo(source.planId, index);
}
function onDragEnd(): void { dragging.value = null; dropAt.value = null; }
```

Template: on the `<ul role="tree">` add `@contextmenu="onContextMenu" @dragstart="onDragStart" @dragover="onDragOver" @drop="onDrop" @dragend="onDragEnd"`, wrap the whole `.rp-property-tree` `div` with `ref="rootEl"`, pass `:draggable="reorder.available.value"` and `:drop-edge="dropAt?.planId === node.id ? dropAt.edge : undefined"` down to `PropertyTreeNode` (add both as optional props there — `draggable?: boolean`, `dropEdge?: 'before' | 'after'` — and render `:draggable="props.draggable || undefined"` and `:data-rp-drop="props.dropEdge"` on the `<li>`, forwarding both to the recursive children; the drop edge prop is per node so pass `dropAt` itself down and let each node compare, which keeps the parent's template to one prop: `:drop-at="dropAt"` with prop `dropAt?: { planId: string; edge: 'before' | 'after' } | null` and `:data-rp-drop="props.dropAt?.planId === props.node.id ? props.dropAt.edge : undefined"`). After the `</ul>` add:

```vue
		<Teleport
			v-if="menuPosition && menuNode"
			:to="rootEl?.closest('.renovation-plan-editor') ?? 'body'"
		>
			<PropertyTreeMenu
				:plan-id="menuNode.id"
				:name="menuNode.name || tr('editor.floor')"
				:kind="menuNode.kind"
				:x="menuPosition.x"
				:y="menuPosition.y"
				:first="menuPosition.first"
				:last="menuPosition.last"
				@close="closeMenu"
			/>
		</Teleport>
```

`usePlanReorder.ts`: change `function findNode` to `export function findNode`.

CSS, append to the tree block in `styles/editor-shell-fidelity.css`:

```css
.renovation-plan-editor [role="treeitem"][data-rp-drop="before"] > .rp-property-tree__row { box-shadow: inset 0 2px 0 var(--interactive-accent); }
.renovation-plan-editor [role="treeitem"][data-rp-drop="after"] > .rp-property-tree__row { box-shadow: inset 0 -2px 0 var(--interactive-accent); }
.renovation-plan-editor [role="treeitem"][draggable="true"] > .rp-property-tree__row { cursor: grab; }
```

If `PropertyTree.vue` passes 400 lines or the `<script>` function budget, move the drag handlers into `src/presentation/editor/shell/useTreeDrag.ts` exporting `useTreeDrag(reorder: ReturnType<typeof usePlanReorder>)` returning `{ dropAt, onDragStart, onDragOver, onDrop, onDragEnd }`.

- [ ] **Step 6: Write the failing component tests**

Create `tests/presentation/editor/shell/propertyTreeReorder.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * Reordering in the Property tree (ADR-0029): the row menu, Alt+arrows and a drop all reach ONE
 * door (`usePlanReorder`) and one command (`updatePlanDetails`), a drop across parents does
 * nothing, and with no command there is no menu and no drag.
 */
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import type { PlanHierarchyDto, PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { unavailablePlanEditorCommands } from '../../../../src/presentation/editor/planEditorCommands';

const leaf = (id: string, name: string, parentId: string | null): PropertyTreeNode => ({ id, name, kind: 'floor', parentId, children: [] });
const TREE: PropertyTreeNode[] = [
	{ ...leaf('plan-house', 'House', null), children: [leaf('plan-ground', 'Ground floor', 'plan-house'), leaf('plan-first', 'First floor', 'plan-house'), leaf('plan-attic', 'Attic', 'plan-house')] },
	leaf('plan-garden', 'Garden', null),
];
const hierarchy = (): PlanHierarchyDto => ({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: TREE });
function rig() {
	const execute = vi.fn((input: { planId: string; order?: number; kind?: string }) => Promise.resolve(ok({ plan: { entity: { ...FIXTURE_PLAN, ...input }, version: { revision: 1 } } })));
	const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: vi.fn(() => Promise.resolve(ok(hierarchy()))) };
	const commands = { ...unavailablePlanEditorCommands(), updatePlanDetails: { execute } };
	return { execute, queries, commands: commands as never };
}
const item = (harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>, id: string) => harness.wrapper.get(`[data-rp-plan-id="${id}"]`);

describe('PropertyTree reordering', () => {
	it('Move down from the menu writes the two changed siblings in order and re-reads the hierarchy', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		await harness.wrapper.get('[data-rp-tree-action="move-down"]').trigger('click');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-first', order: 0 }, { planId: 'plan-ground', order: 1 }]);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		harness.unmount();
	});

	it('Alt+ArrowUp moves the focused row up and the menu marks the first and last rows', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }, { planId: 'plan-first', order: 2 }]);
		await item(harness, 'plan-ground').trigger('keydown', { key: 'F10', shiftKey: true });
		expect(harness.wrapper.get('[data-rp-tree-action="move-up"]').attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.get('[data-rp-tree-action="move-down"]').attributes('aria-disabled')).toBeUndefined();
		harness.unmount();
	});

	it('Mark as building writes the kind alone', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		await item(harness, 'plan-house').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.get('[data-rp-tree-action="kind:floor"]').attributes('aria-checked')).toBe('true');
		await harness.wrapper.get('[data-rp-tree-action="kind:building"]').trigger('click');
		await settle();
		expect(execute).toHaveBeenCalledWith({ planId: 'plan-house', kind: 'building' });
		harness.unmount();
	});

	it('a drop on a sibling reorders, a drop on another parent does nothing', async () => {
		const { execute, queries, commands } = rig();
		const harness = await mountPlanEditorCanvas({ queries, commands });
		await settle();
		const dataTransfer = { setData: () => undefined, effectAllowed: '' };
		await item(harness, 'plan-attic').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-garden').trigger('dragover', { dataTransfer, clientY: 0 });
		await item(harness, 'plan-garden').trigger('drop', { dataTransfer });
		await settle();
		expect(execute).not.toHaveBeenCalled();
		await item(harness, 'plan-attic').trigger('dragstart', { dataTransfer });
		await item(harness, 'plan-ground').trigger('dragover', { dataTransfer, clientY: 0 });
		expect(item(harness, 'plan-ground').attributes('data-rp-drop')).toBe('before');
		await item(harness, 'plan-ground').trigger('drop', { dataTransfer });
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 0 }, { planId: 'plan-ground', order: 1 }, { planId: 'plan-first', order: 2 }]);
		harness.unmount();
	});

	it('offers no menu and no drag without the command', async () => {
		const queries = { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(hierarchy())) };
		const harness = await mountPlanEditorCanvas({ queries });
		await settle();
		await item(harness, 'plan-ground').trigger('contextmenu', { clientX: 20, clientY: 20 });
		expect(harness.wrapper.find('.rp-property-tree__menu').exists()).toBe(false);
		expect(item(harness, 'plan-ground').attributes('draggable')).toBeUndefined();
		harness.unmount();
	});

	it('stops at the first refused write and still re-reads the hierarchy', async () => {
		const { queries, commands } = rig();
		const execute = vi.fn()
			.mockResolvedValueOnce({ ok: false, error: { category: 'Persistence', code: 'vault.write-failed', message: 'x' } })
			.mockResolvedValue(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } }));
		const harness = await mountPlanEditorCanvas({ queries, commands: { ...(commands as object), updatePlanDetails: { execute } } as never });
		await settle();
		await item(harness, 'plan-ground').trigger('keydown', { key: 'ArrowDown', altKey: true });
		await settle();
		expect(execute).toHaveBeenCalledTimes(1);
		expect(queries.hierarchy).toHaveBeenCalledTimes(2);
		harness.unmount();
	});
});
```

`unavailablePlanEditorCommands()` is the refusing bundle every editor test mounts by default; `jsdom` has no `DragEvent`, so `trigger('dragstart', …)` dispatches a plain `Event` carrying the given fields — that is why the handlers read `event.dataTransfer?.` optionally and never construct a `DragEvent`. The refused-write case relies on `reportDispatchFailure` reaching the notice sinks; if the test environment throws on a missing `Notice`, install the same DOM helpers the inspector fault tests use (`tests/presentation/editor/shell/inspectorFaults.test.ts` shows the setup).

- [ ] **Step 7: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/shell`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/shell styles/editor-shell-fidelity.css tests/presentation/editor/shell
git commit -m "Reorder sibling plans by menu, keyboard and drag through one door

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Kind in the New plan form, from a zone and from the project view

**Files:**
- Modify: `src/presentation/views/NewPlanForm.vue`
- Modify: `src/presentation/editor/hierarchy/detailPlanActions.ts:39-41`
- Test: `tests/presentation/views/newPlanForm.test.ts`, `tests/presentation/editor/hierarchy/detailPlanActions.test.ts`

**Interfaces:**
- Consumes: `PLAN_KINDS`, `DEFAULT_PLAN_KIND`, `childKindOf` (Task 1), `CreatePlanInput.kind` (Task 4), `project.plan.kind` (Task 3).
- Produces: `NewPlanForm` prop `parentKind?: PlanKind`; a `<select data-field="kind">`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/views/newPlanForm.test.ts` (reuse that file's existing mount helper and `dispatch` spy pattern — read its first case and copy its setup):

```ts
	it('offers a Kind select defaulting to floor, or one step below the parent kind, and sends it', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const root = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });
		expect((root.get('select[data-field="kind"]').element as HTMLSelectElement).value).toBe('floor');
		const detail = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder, parentKind: 'site', parent: { planId: 'plan-site' as never, zoneId: 'zone-house' as never } } });
		const select = detail.get('select[data-field="kind"]');
		expect((select.element as HTMLSelectElement).value).toBe('building');
		await select.setValue('room');
		await detail.get('input[data-field="name"]').setValue('Kitchen');
		await detail.get('form').trigger('submit');
		await flushPromises();
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kitchen', kind: 'room' }));
	});
```

(`Dispatch`, `created`, `recorder`, `PROJECT_ID`, `mount` and `flushPromises` are that file's own names.)

Both existing `expect(dispatch.mock.calls[0][0]).toEqual({ projectId: PROJECT_ID, name: 'Ground floor' })` lines in `newPlanForm.test.ts` (lines 72 and 344) become `toEqual({ projectId: PROJECT_ID, name: 'Ground floor', kind: 'floor' })`, since `INITIAL` now carries the default kind.

In `tests/presentation/editor/hierarchy/detailPlanActions.test.ts`, find the case that asserts the dialog's `props` (`initialName`, `parent`) and add `parentKind: 'floor'` to its expectation (the fixture plan's kind), or if it opens with a plan of kind `site`, `'site'`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/views/newPlanForm.test.ts tests/presentation/editor/hierarchy`
Expected: FAIL — no `select[data-field="kind"]`.

- [ ] **Step 3: The form**

`NewPlanForm.vue` script: add `import { childKindOf, DEFAULT_PLAN_KIND, PLAN_KINDS, type PlanKind } from '../../domain/plan/PlanKind';` and `import { PLAN_KIND_LABELS } from '../editor/editorIcons';`; add the prop

```ts
	/** The parent plan's kind, so a detail plan starts one step below it (ADR-0029). */
	parentKind?: PlanKind;
```

`INITIAL` gains `kind: props.parentKind ? childKindOf(props.parentKind) : DEFAULT_PLAN_KIND,`. Add:

```ts
function onKindChange(event: Event): void {
	const control = event.target as HTMLSelectElement;
	if (refuseWhileSubmitting(control, form.values.value.kind ?? DEFAULT_PLAN_KIND)) return;
	form.setField('kind', control.value as PlanKind);
}
```

Template, after the name `FieldError` block:

```vue
		<label class="rp-dialog-field">
			{{ tr('form.new-plan.kind') }}
			<select
				data-field="kind"
				:value="form.values.value.kind"
				:disabled="form.submitting.value"
				@change="onKindChange"
			>
				<option
					v-for="kind in PLAN_KINDS"
					:key="kind"
					:value="kind"
				>
					{{ tr(PLAN_KIND_LABELS[kind]) }}
				</option>
			</select>
		</label>
```

Check `refuseWhileSubmitting`'s signature in `useDialogFormBusy` — if it takes `HTMLInputElement` only, widen it to `HTMLInputElement | HTMLSelectElement` (it only reads `.value`).

`detailPlanActions.ts` `props:` gains `parentKind: plan.kind,`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/views tests/presentation/editor/hierarchy tests/presentation/dialogs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/views/NewPlanForm.vue src/presentation/editor/hierarchy/detailPlanActions.ts src/presentation/composables tests/presentation
git commit -m "Choose a plan's kind in the New plan form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Kind select in the Floor inspector, kind icons on the crumbs

**Files:**
- Modify: `src/presentation/editor/shell/FloorInspector.vue`
- Modify: `src/presentation/editor/shell/EditorContextBar.vue:66-71`, `src/presentation/editor/shell/EditorContextCrumb.vue`
- Test: `tests/presentation/editor/shell/floorInspector.test.ts`, `tests/presentation/editor/shell/editorContextBar.test.ts`

**Interfaces:**
- Consumes: `usePlanReorder().setKind` and `.available` (Task 8), `PLAN_KIND_ICONS`, `PlanSummaryDto.kind`, `PlanDto.kind`.
- Produces: `EditorContextCrumb` prop `icon?: string`; `<select data-rp-field="plan-kind">` in the floor inspector.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/shell/floorInspector.test.ts` (match its mount helper):

```ts
	it('offers a Kind select bound to the plan and writes through updatePlanDetails', async () => {
		const execute = vi.fn(() => Promise.resolve(ok({ plan: { entity: { ...FIXTURE_PLAN, kind: 'room' }, version: { revision: 1 } } })));
		const harness = await mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, kind: 'room' }, commands: { ...unavailablePlanEditorCommands(), updatePlanDetails: { execute } } as never });
		await settle();
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		expect((select.element as HTMLSelectElement).value).toBe('room');
		await select.setValue('floor');
		await settle();
		expect(execute).toHaveBeenCalledWith({ planId: FIXTURE_PLAN.id, kind: 'floor' });
	});

	it('draws no Kind select without the command', async () => {
		const harness = await mountPlanEditorCanvas({});
		await settle();
		expect(harness.wrapper.find('select[data-rp-field="plan-kind"]').exists()).toBe(false);
	});
```

Append to `tests/presentation/editor/shell/editorContextBar.test.ts`:

```ts
	it('draws each ancestor crumb with its kind icon', async () => {
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: () => Promise.resolve() },
			queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site', kind: 'site' }], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: [] })) },
		});
		await settle();
		expect(harness.wrapper.get('[data-rp-open-plan="plan-site"]').find('.rp-host-icon[data-icon-request="land-plot"]').exists()).toBe(true);
	});
```

(`tests/helpers/obsidianIcons.ts`'s `setIcon` writes the requested name to `data-icon-request` on the `.rp-host-icon` element, which is what both new cases select on.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/floorInspector.test.ts tests/presentation/editor/shell/editorContextBar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Floor inspector**

`FloorInspector.vue` script adds:

```ts
import { PLAN_KINDS, type PlanKind } from '../../../domain/plan/PlanKind';
import { PLAN_KIND_LABELS } from '../editorIcons';
import { usePlanReorder } from './usePlanReorder';
const reorder = usePlanReorder();
function onKindChange(event: Event): void {
	const plan = project.plan;
	if (!plan) return;
	void reorder.setKind(plan.id, (event.target as HTMLSelectElement).value as PlanKind);
}
```

Template, right after `<h3>{{ summary.floor.name }}</h3>`:

```vue
		<div
			v-if="reorder.available.value && project.plan"
			class="rp-editor-requirement-assign"
		>
			<label for="rp-plan-kind">{{ tr('form.new-plan.kind') }}</label>
			<select
				id="rp-plan-kind"
				data-rp-field="plan-kind"
				:value="project.plan.kind"
				@change="onKindChange"
			>
				<option
					v-for="kind in PLAN_KINDS"
					:key="kind"
					:value="kind"
				>
					{{ tr(PLAN_KIND_LABELS[kind]) }}
				</option>
			</select>
		</div>
```

(`rp-editor-requirement-assign` is the class the room inspector's own label-plus-select pair carries, reused so no new CSS is needed. The `id` is fixed because a leaf draws one floor inspector.)


- [ ] **Step 4: Crumbs**

`EditorContextCrumb.vue`: add prop `readonly icon?: string;`, import `HostIcon`, and render `<HostIcon v-if="props.icon" :name="props.icon" />` before `{{ props.name }}` in both branches. `EditorContextBar.vue` passes `:icon="PLAN_KIND_ICONS[ancestor.kind]"` (import from `../editorIcons`).

- [ ] **Step 5: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/shell tests/presentation/views`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation tests/presentation
git commit -m "Edit a plan's kind from the Floor inspector and show it on the crumbs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Harness `?tree` knob, shots, and the axe scan

**Files:**
- Modify: `tests/harness/planEditor.ts` (options + queries), `tests/harness/page.ts:207-217`
- Modify: `scripts/harness-shot.mjs:204-`, `tests/build/harness-shot.test.ts` (pinned names)
- Modify: `tests/harness/accessibility.test.ts`

**Interfaces:**
- Produces: `?view=plan-editor&tree` mounts a four-plan hierarchy (Site › House › { Ground floor (open), Attic }); shots `plan-editor-tree-dark`, `plan-editor-tree-light`, `plan-editor-tree-narrow` (460px).

- [ ] **Step 1: The knob**

`tests/harness/planEditor.ts` options interface gains:

```ts
	/** Answers a four-plan property (Site › House › { Ground floor, Attic }) so the Property tree draws three levels. */
	readonly tree?: boolean;
```

Beside `HARNESS_PLAN` define:

```ts
const HARNESS_TREE: PropertyTreeNode[] = [
	{ id: 'harness-site', name: 'Site', kind: 'site', parentId: null, children: [
		{ id: 'harness-house', name: 'House', kind: 'building', parentId: 'harness-site', children: [
			{ id: HARNESS_PLAN.id, name: HARNESS_PLAN.name, kind: 'floor', parentId: 'harness-house', children: [] },
			{ id: 'harness-attic', name: 'Attic', kind: 'floor', parentId: 'harness-house', children: [] },
		] },
	] },
];
```

and in the queries literal, after `listPlans`:

```ts
			...(options.tree === true
				? { hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'harness-site', name: 'Site', kind: 'site' }, { id: 'harness-house', name: 'House', kind: 'building' }], detailPlans: [], parentZone: null, parentZoneMissing: false, tree: structuredClone(HARNESS_TREE) })) }
				: {}),
```

(`options` must be in scope where the queries are built — follow how `stale` reaches `harnessDeps` at line 718 and thread `tree` the same way.) `page.ts` adds `tree: params.has('tree'),` to the `mountPlanEditorHarness` call.

- [ ] **Step 2: Shots**

In `scripts/harness-shot.mjs` `SHOTS`, after the `plan-editor-area-*` entries:

```js
	{ name: 'plan-editor-tree-dark', query: '?view=plan-editor&tree', selector: '[role="tree"] [aria-level="3"]' },
	{ name: 'plan-editor-tree-light', query: '?view=plan-editor&tree&theme=light', selector: '[role="tree"] [aria-level="3"]' },
	{ name: 'plan-editor-tree-narrow', query: '?view=plan-editor&tree', selector: '[role="tree"] [aria-level="3"]', width: 460 },
```

Add the three names, alphabetically, to the pinned list in `tests/build/harness-shot.test.ts`.

- [ ] **Step 3: The axe case**

Append to the plan-editor block of `tests/harness/accessibility.test.ts`, following the `reports no semantic violations on the plan editor` case's shape:

```ts
	it('reports no semantic violations on a three-level Property tree with its row menu open', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor({ queries: treeQueries(), commands: treeCommands() });
			await settle();
			const root = mounted.wrapper.element as HTMLElement;
			expect(root.querySelectorAll('[role="treeitem"]').length).toBe(4);
			await mounted.wrapper.get('[data-rp-plan-id="harness-attic"]').trigger('keydown', { key: 'F10', shiftKey: true });
			expect(root.querySelector('.rp-property-tree__menu')).not.toBeNull();
			const results = await axe.run(root, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});
```

where `treeQueries()` returns `fakeQueries(FIXTURE_PLAN)` plus a `hierarchy` answering the same four-node tree as `HARNESS_TREE` (ids `plan-site`, `plan-house`, `FIXTURE_PLAN.id`, `plan-attic`; define it locally in the test file), and `treeCommands()` is the refusing bundle plus `updatePlanDetails: { execute: () => Promise.resolve(ok({ plan: { entity: FIXTURE_PLAN, version: { revision: 1 } } })) }`. If the file is over its line budget, put the case in `tests/harness/accessibilityPropertyTree.test.ts` importing `runOptions` from `./axeOptions`, as the other `accessibility*.test.ts` files do.

- [ ] **Step 4: Run the build pin, the harness suites and the shots**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/harness`
Expected: PASS.

Run: `npm run harness-shot`
Expected: `harness-shots/plan-editor-tree-{dark,light,narrow}.png` written. Open the narrow one: three levels indented 16px each, rows 32px tall, no wrapped icon, the open plan highlighted. If the pinned Chromium is absent the command names `RP_CHROMIUM_EXECUTABLE`; set it and note the substitute in the commit body.

- [ ] **Step 5: Commit**

```bash
git add tests/harness scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "Photograph and axe-scan the three-level Property tree

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Documents

**Files:**
- Create: `docs/development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md`
- Create: `docs/tests/cases/Reorder plans in the Property tree.md`
- Modify: `docs/requirements/Navigate property, building and floor context in the editor.md` (Amendments)
- Modify: `docs/requirements/Create a detail plan from a zone and move between levels.md` (Amendments)
- Modify: `src/plugin/sampleProject.ts` (docblock line: the seeded plan is a `floor`, the default)

- [ ] **Step 1: ADR-0029**

```markdown
---
adr: 29
title: A plan carries a kind label and a sibling order
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0029: A plan carries a kind label and a sibling order

## Context

ADR-0028 gave a plan a parent zone, so a project can be a site, a house on it and floors in the
house. The Property tree that draws that chain showed only the open plan's siblings, every plan
with one icon, in name order. A renovator building a whole site and one building a single floor
both need the tree to say what each plan IS and to hold the order they gave it.

## Decision

- `Plan.kind: 'site' | 'building' | 'floor' | 'room'`, default `floor` (ADR-0017's "presents as
  Floor" is now the default rather than the rule), and `Plan.order: number`, a non-negative
  integer ranking a plan among the plans sharing its parent. Both set at creation and changed
  afterwards only by `UpdatePlanDetailsCommand`.
- Frontmatter `kind` and `order`, schema v10, both optional and written only when not the
  default, so an untouched note is byte-identical after its next save. A value outside the
  vocabulary refuses the note; nothing is guessed at.
- `readPlanHierarchy` answers the whole project as a tree, siblings by `order` then name; a plan
  whose parent is missing draws at the root.
- A reorder is one `UpdatePlanDetails` per changed sibling in sequence, not a transaction.
- No `Site`, `Building`, `Floor` or `Room` entity. The kind is a LABEL: it drives an icon and a
  level label, and nothing constrains what a plan of a kind may contain.

## Alternatives

- **Derive the kind from depth.** A single-floor project's root is a floor, not a site.
- **Order by name only.** The user's mental order (ground, first, attic) is not alphabetical.
- **A `Site`/`Building` entity.** A second identity and a migration for a label.

## Consequences

- ADR-0017's Floor identity is deferred once more; the label covers what the tree needs.
- A vault opened in an older build refuses a note carrying `kind` or `order`.
- A half-applied reorder is a visible order the user can redo, never data loss.

## Revisit when

A kind must constrain contents (a room may not hold a building), order must be shared across
parents, or a reorder must be atomic.
```

- [ ] **Step 2: Manual case**

`docs/tests/cases/Reorder plans in the Property tree.md`:

```markdown
# Reorder plans in the Property tree

Contract: [ADR-0029](../../development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin.

1. Open a project with a site plan, a house detail plan under it, and three floors under the
   house (see *Build detail plans from site to floor*). Open the ground floor.
2. The sidebar's **Property** section shows the project, then Site › House › the three floors,
   each level indented one step, the open floor highlighted, a site icon on Site and a building
   icon on House.
3. Drag **Attic** above **Ground floor** and drop it. The list redraws in the new order. Reload
   Obsidian: the order holds.
4. Drag **Attic** onto **Site**. No indicator appears and nothing changes.
5. Right-click **First floor** › **Move down**. It swaps with the floor below. Focus a row, press
   Alt+↑: it moves up. Shift+F10 on a row opens the same menu; Escape closes it and focus returns
   to the row.
6. Right-click **Site** › **Mark as site** is checked; choose **Mark as building**: the icon
   changes, and `Site.md`'s frontmatter now carries `kind: building`.
7. Open Obsidian's *Read view* on a floor's note: no `kind` and no `order` key on a plan that
   was never reordered or re-labelled.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |
```

- [ ] **Step 3: Requirement amendments**

Append under `## Amendments` in *Navigate property, building and floor context in the editor.md*:

```markdown
**2026-09-12** — [ADR-0029](../development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md).
The Property tree draws EVERY plan of the project nested by its parent link as a `role="tree"`
with arrow-key navigation (closing extension 4a's deferral); each plan carries a persisted kind
(site, building, floor, room) that drives its icon and level label; siblings are reorderable by
drag, by a row menu and by Alt+↑/↓, and the order is persisted. Assumption 3's "singular
presentation-only Building grouping" is superseded by the kind label.
```

Append under `## Amendments` in *Create a detail plan from a zone and move between levels.md*:

```markdown
**2026-09-12** — The editor's Property tree now nests detail plans under their parents
([ADR-0029](../development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md)). The
out-of-scope line about the PROJECT view's plan list still holds; only the editor's tree changed.
`NewPlanForm` opened from a zone now defaults the new plan's kind to one step below its parent's.
```

- [ ] **Step 4: Sample project docblock**

In `src/plugin/sampleProject.ts`'s header, after the sentence listing the three commands, add: "The seeded plan takes the default kind, `floor`, and order `0` (ADR-0029) — stated so the scaffold's docblock does not lie by omission."

- [ ] **Step 5: Commit**

```bash
git add docs src/plugin/sampleProject.ts
git commit -m "Record ADR-0029 and the Property tree manual case

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: The gate, coverage read, and the branch

**Files:** none new.

- [ ] **Step 1: Run the whole gate once**

Run: `npm run check`
Expected: build, lint, coverage-thresholded tests and fallow all green. If `fallow` reports `PropertyTreeRow.vue` or a new export as unused, delete the export.

- [ ] **Step 2: Read the changed files' arms**

Run (Git Bash):

```bash
node -e "const c=require('./coverage/coverage-final.json');for(const [f,d] of Object.entries(c)){if(!/PlanKind|Plan\.ts|UpdatePlanDetails|planHierarchy|usePlanReorder|PropertyTree|planMapper|CreatePlan\.ts/.test(f))continue;const b=Object.entries(d.b).filter(([,v])=>v.some(n=>n===0));const s=Object.entries(d.s).filter(([,v])=>v===0);console.log(f,'uncovered branches',b.map(([k])=>d.branchMap[k].loc.start.line),'statements',s.map(([k])=>d.statementMap[k].start.line));}"
```

Expected: every listed file prints empty arrays. For any uncovered line, add the case to the file's own test (Task 1–8 test files) rather than widening a fixture.

- [ ] **Step 3: Increment history entry**

Append to `docs/development/agent-guide-increment-history.md`, under the newest entry, a paragraph headed `**Property tree polish (2026-09-12, ADR-0029)**` recording: what landed (kind, order, v10, `UpdatePlanDetails`, the whole-project tree, `role="tree"`, reorder through one door, the indent), the four spec deviations named at the top of this plan, and the harness shot names. Commit with the message `Record the Property tree polish increment`.

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`: push `claude/property-nav-sidebar-polish-d5073f`, open a pull request against `main` whose description lists the manual case as written-not-run and links the spec, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

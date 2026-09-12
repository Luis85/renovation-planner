# Wall Context Records and Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let renovation records (facts, Work, decisions, notes, photos, costs, materials) live on walls, openings and elements that bound no room and on Areas; offer them from an Add › submenu in the canvas context menu; give walls and openings a catalogue material with a plan pattern and an automatic quantity entry; and rename `slice10Composition.ts` to what it composes.

**Architecture:** `roomId` becomes optional on every renovation record and a record's *context* is `contextOf(item) = item.roomId ?? item.targetId`. `spatialContexts` reports the primary link with that context, so the presentation projections that already compare links keep working. Requirements gain a `plan` origin. A subject's Existing/Planned facts carry an optional `assetId`. A `ConstructionMaterialCommand` wraps `RenovationCommand` and `MaterialCommand` into one history entry. The canvas draws a `wall-pattern` pass.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, vue-konva, Zod, Vitest (node + jsdom), Obsidian plugin API 1.13.

**Spec:** `docs/superpowers/specs/2026-09-12-wall-context-records-and-materials-design.md`. Read it before Task 1. The rename (Task 14) was added by the user after the spec was approved.

## Global Constraints

- One pull request. Commit after every task, in task order.
- Inner loop: `npm run check:fast -- <paths>`. Never run two gates at once; CI runs `npm run check`. Before pushing, run `npx fallow` once (check:fast misses fallow and `max-lines`).
- Max 400 counted lines per `src/` file; complexity ≤ 16; max 5 params.
- Every user-visible string goes through `tr` with a key in BOTH `src/presentation/i18n/locales/en…` and `…/de…`; English is sentence case.
- No literal colours in `src/` or `styles/`; canvas colours come from `ThemeTokens`.
- Layer rule: `presentation → application → domain → core`; nothing writes to the vault outside `infrastructure/`.
- A comment that states an invariant gets a test watched failing first.
- `exactOptionalPropertyTypes` is off: `roomId: undefined` is assignable to `roomId?: string`, but never write `roomId: ''` — the empty string is refused as an identity.
- Plan note latest schema becomes `11`. Requirement note latest schema becomes `5`. Asset note stays `1`. Geometry sidecar stays `9`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Spec §6.7 said the pattern pass strokes the centre-line with a `CanvasPattern`; this plan FILLS the wall's body polygon with Konva's `fillPatternImage` instead, because Konva offers no stroke pattern and a fill scales with `fillPatternScale` without a custom `sceneFunc`. The per-wall mitre gap is unchanged.
- Spec §8's Visual row is met by Browser-pane screenshots of `npm run harness` (Task 13), not by new `SHOTS` entries: an open context menu needs a right-click, which the fixed-shot table cannot express.

## Prerequisite

- [ ] **Install dependencies in this worktree** (a Claude worktree starts with an empty `node_modules`).

```bash
npm ci
```

Expected: exits 0; `node_modules/.bin/vitest` exists.

---

### Task 1: Optional room context (domain)

**Files:**
- Modify: `src/domain/renovation/SharedLinks.ts`, `src/domain/renovation/Renovation.ts`, `src/domain/renovation/PlanningDepth.ts`, `src/domain/renovation/validatePlanningDepth.ts`, `src/domain/renovation/renovationTargets.ts`, `src/domain/renovation/sameRenovation.ts`
- Create: `tests/domain/roomlessRenovation.test.ts`

**Interfaces:**
- Produces:
  - `interface PrimaryContext { readonly roomId?: string; readonly targetId: string }`
  - `SharedSpatialContext extends PrimaryContext { links? }`; `SpatialLink` unchanged (`roomId: string`)
  - `type RoomContext = Pick<SharedSpatialContext, 'roomId' | 'targetId' | 'links'>`
  - `contextOf(item: PrimaryContext): string`
  - `spatialContexts(item)` — primary link is `{ roomId: contextOf(item), targetId }`
  - `hasRoomContext(item: RoomContext | undefined, context: string | undefined): boolean` — second argument is a CONTEXT id
  - `roomId?: string` on `RenovationSubject`, `WorkPackage`, `RenovationDecision`, `ReadinessFinding`, `ContextLink`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/roomlessRenovation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_RENOVATION, reviewRenovation, validateRenovation, type Renovation, type RenovationSubject, type WorkPackage } from '../../src/domain/renovation/Renovation';
import { renovationReferents, validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';
import { contextOf, hasRoomContext, spatialContexts } from '../../src/domain/renovation/SharedLinks';
import { EMPTY_DEPTH, type CostRecord, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import { of } from '../../src/core/money/Money';
import { WALL_LOOP } from '../helpers/structure';

const room = 'room-a';
const context = { roomIds: [room], structure: WALL_LOOP };
const subject: RenovationSubject = { id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Rendered brick', condition: 'good' }, planned: { change: 'modify', description: 'Repointed brick' } };
const work: WorkPackage = { id: 'work-wall', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [subject.id], dependencies: [] };
const cost: CostRecord = { id: 'cost-wall', targetId: 'wall-a', workId: work.id, title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false };
const photo: Evidence = { id: 'photo-wall', targetId: 'wall-a', workId: work.id, description: 'Before', type: 'photo', phase: 'before', path: 'wall.jpg', subpath: '', recordId: subject.id, pin: null };
const value: Renovation = { subjects: [subject], work: [work], decisions: [{ id: 'decision-wall', subjectId: subject.id, question: 'Lime or cement?', resolution: '', resolved: false }], depth: { ...EMPTY_DEPTH, costs: [cost], evidence: [photo] } };
const withDepth = (patch: Partial<Evidence> | Partial<CostRecord>, kind: 'evidence' | 'costs'): Renovation => ({ ...value, depth: { ...EMPTY_DEPTH, costs: kind === 'costs' ? [{ ...cost, ...patch } as CostRecord] : [cost], evidence: kind === 'evidence' ? [{ ...photo, ...patch } as Evidence] : [photo] } });

describe('renovation records without a room (ADR-0029)', () => {
	it('names a context by its room, or by its own target when it has none', () => {
		expect(contextOf({ roomId: room, targetId: 'wall-a' })).toBe(room);
		expect(contextOf({ targetId: 'wall-a' })).toBe('wall-a');
		expect(spatialContexts({ ...work, links: [{ roomId: room, targetId: room }] })).toEqual([{ roomId: 'wall-a', targetId: 'wall-a' }, { roomId: room, targetId: room }]);
		expect(hasRoomContext(work, 'wall-a')).toBe(true);
		expect(hasRoomContext(work, room)).toBe(false);
	});
	it('accepts every record kind on a wall that bounds no room', () => {
		expect(validateRenovation(value).ok).toBe(true);
		expect(validateRenovationTargets(value, context).ok).toBe(true);
		expect(reviewRenovation(value)[0]).toEqual({ kind: 'decision', roomId: undefined, recordId: 'decision-wall', causes: ['Lime or cement?'] });
	});
	it('refuses an empty room id, a room-less record on a zone, and a room-less record on nothing', () => {
		expect(validateRenovation({ ...value, subjects: [{ ...subject, roomId: '' }] }).ok).toBe(false);
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [{ ...subject, id: 'detail-room', targetId: room, kind: 'floor' }] }, context)).toMatchObject({ ok: false, error: { code: 'renovation.room-missing' } });
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, work: [{ ...work, targetId: 'wall-gone', outcomes: [] }] }, context).ok).toBe(false);
	});
	it('refuses a pin on a photo with no room, because a pin is a fraction of a room box', () => {
		expect(validateRenovation(withDepth({ pin: { x: 0.5, y: 0.5 } }, 'evidence')).ok).toBe(false);
	});
	it('links costs and photos to a room-less Work item or subject on the same target only', () => {
		expect(validateRenovation(withDepth({ targetId: 'wall-b' }, 'costs')).ok).toBe(false);
		expect(validateRenovation(withDepth({ targetId: 'wall-b' }, 'evidence')).ok).toBe(false);
		expect(validateRenovation({ ...value, decisions: [{ ...value.decisions[0], subjectId: 'missing' }] }).ok).toBe(false);
	});
	it('still requires a secondary link to name a present room', () => {
		expect(validateRenovationTargets({ ...value, work: [{ ...work, links: [{ roomId: room, targetId: room }] }] }, context).ok).toBe(true);
		expect(validateRenovationTargets({ ...value, work: [{ ...work, links: [{ roomId: 'wall-b', targetId: 'wall-b' }] }] }, context).ok).toBe(false);
	});
	it('lists room-less records when their wall is about to be deleted', () => {
		expect(renovationReferents(value, 'wall-a')).toEqual(expect.arrayContaining(['Mortar', 'Before', 'Rendered brick', 'Repoint']));
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/domain/roomlessRenovation.test.ts`
Expected: FAIL — `contextOf is not a function`, and the room-less fixtures refused as `renovation.identity`.

- [ ] **Step 3: Replace `src/domain/renovation/SharedLinks.ts`**

```ts
/** A secondary Room context of one Work/Evidence record. A secondary link always names a zone (ADR-0021). */
export interface SpatialLink { readonly roomId: string; readonly targetId: string }
/** A record's primary context: a Room or Area when it has one, and always its stable spatial target (ADR-0029). */
export interface PrimaryContext { readonly roomId?: string; readonly targetId: string }
export interface SharedSpatialContext extends PrimaryContext { readonly links?: readonly SpatialLink[] }
export type RoomContext = Pick<SharedSpatialContext, 'roomId' | 'targetId' | 'links'>;

/** A record's context: its Room, or — when it has none — its own spatial target (ADR-0029). */
export function contextOf(item: PrimaryContext): string {
	return item.roomId ?? item.targetId;
}
/** Every context a record serves. The primary link's `roomId` is `contextOf(item)`, so a room-less record's is its own target. */
export function spatialContexts(item: SharedSpatialContext): readonly SpatialLink[] {
	return [{ roomId: contextOf(item), targetId: item.targetId }, ...item.links ?? []];
}
/** Whether `item` serves the context `context`: its primary context, or a Room it is explicitly linked to. */
export function hasRoomContext(item: RoomContext | undefined, context: string | undefined): boolean {
	return !!item && !!context && spatialContexts(item).some(link => link.roomId === context);
}
export function validSharedLinks(item: SharedSpatialContext): boolean {
	const links = spatialContexts(item);
	return links.every(link => !!link.roomId && !!link.targetId)
		&& new Set(links.map(link => JSON.stringify([link.roomId, link.targetId]))).size === links.length;
}
export function linksContent(item: SharedSpatialContext): readonly (readonly string[])[] {
	return (item.links ?? []).map(link => [link.roomId, link.targetId]);
}
```

- [ ] **Step 4: Make `roomId` optional and compare contexts in `Renovation.ts`**

- In `RenovationSubject`, `WorkPackage`, `RenovationDecision` and `ReadinessFinding`: `readonly roomId: string;` → `readonly roomId?: string;`.
- Import `contextOf` beside `hasRoomContext` from `./SharedLinks`.
- In `validateRecords`, replace the identity line and the decisions line:

```ts
	if (all.some(item => !item.id.trim() || item.roomId?.trim() === '') || new Set(all.map(item => item.id)).size !== all.length) return err(renovationError('identity'));
```

```ts
	if (value.decisions.some(item => !validDecision(item, subjects))) return err(renovationError('decision'));
```

and add below `validSubject`:

```ts
/** A missing subject is refused outright: with an optional `roomId`, `undefined === undefined` would otherwise pass it. */
function validDecision(item: RenovationDecision, subjects: ReadonlyMap<string, RenovationSubject>): boolean {
	const subject = subjects.get(item.subjectId);
	return !!subject && !!item.question.trim() && (!item.resolved || !!item.resolution.trim()) && subject.roomId === item.roomId;
}
```

- In `validateWorkRecords`, the outcome line becomes:

```ts
		if (new Set(item.outcomes).size !== item.outcomes.length || item.outcomes.some(id => { const subject = subjects.get(id); return !subject?.planned || !hasRoomContext(item, contextOf(subject)); })) return err(renovationError('outcome'));
```

- [ ] **Step 5: `PlanningDepth.ts` and `validatePlanningDepth.ts`**

In `PlanningDepth.ts`, `ContextLink.roomId: string` → `readonly roomId?: string;`, and the `pin` comment becomes `/** Fraction of Room bounding box; always null for a record with no room (ADR-0029). */`.

In `validatePlanningDepth.ts` import `contextOf` and replace lines 13 and 20–21:

```ts
	if (all.some(item => !item.id || item.roomId === '' || !item.targetId || (item.workId && !hasRoomContext(work.get(item.workId), contextOf(item))))) return err(depthError());
```

```ts
	const subjects = new Map(renovation.subjects.map(item => [item.id, item]));
	// A Decision is located through its subject, so its context is the subject's target when it has no room.
	const decisions = renovation.decisions.map(item => ({ id: item.id, roomId: item.roomId, targetId: subjects.get(item.subjectId)?.targetId ?? '' }));
	const linked = new Map<string, RoomContext>([...renovation.subjects, ...renovation.work, ...decisions, ...value.costs].map(item => [item.id, item]));
	if (!value.evidence.every(evidence => validEvidence(evidence, linked))) return err(depthError());
```

In `validEvidence`, replace the record-link line and add the pin rule:

```ts
	if (evidence.recordId && linked.has(evidence.recordId) && !hasRoomContext(linked.get(evidence.recordId), contextOf(evidence))) return false;
	if (evidence.roomId === undefined && evidence.pin) return false;
```

- [ ] **Step 6: Replace `validateRenovationTargets` in `renovationTargets.ts`**

```ts
import type { PrimaryContext, SharedSpatialContext } from './SharedLinks';
```

```ts
/** A room it names must be present; a record with none must target a wall, opening or element, never a zone (ADR-0029). */
function validPrimaryRoom(item: PrimaryContext, rooms: ReadonlySet<string>): boolean {
	return item.roomId === undefined ? !rooms.has(item.targetId) : rooms.has(item.roomId);
}
function missingContext(item: SharedSpatialContext, rooms: ReadonlySet<string>, present: (id: string) => boolean): boolean {
	return !validPrimaryRoom(item, rooms) || !present(item.targetId) || (item.links ?? []).some(link => !rooms.has(link.roomId) || !present(link.targetId));
}

export function validateRenovationTargets(value: Renovation, context: RenovationSpatialContext): Result<void, ValidationError> {
	const linked = value.subjects.filter(item => item.targetId !== item.roomId).map(item => item.targetId);
	if (new Set(linked).size !== linked.length) return err(renovationError('target-owner'));
	const rooms = new Set(context.roomIds);
	const current = spatialIds(context.structure, context.roomIds);
	const intended = spatialIds(context.intended ?? context.structure, context.roomIds);
	for (const subject of value.subjects) {
		if (!validPrimaryRoom(subject, rooms)) return err(renovationError('room-missing'));
		if (subject.existing && !current.has(subject.targetId)) return err(renovationError('source-missing'));
		if (subject.planned && subject.planned.change !== 'remove' && !intended.has(subject.targetId)) return err(renovationError('target-missing'));
	}
	const present = (id: string) => current.has(id) || intended.has(id);
	if ([...depthRecords(value.depth ?? EMPTY_DEPTH), ...value.work].some(item => missingContext(item, rooms, present))) return err(renovationError('target-missing'));
	return ok(undefined);
}
```

`renovationReferents` is unchanged; drop the now-unused `spatialContexts` import only if lint reports it unused (it is still used there).

- [ ] **Step 7: `sameRenovation.ts`**

Change the `context` helper's parameter type to `{ id: string; roomId?: string; targetId: string; workId: string }`. Nothing else changes: `JSON.stringify` writes an absent `roomId` as `null`, and `''` stays distinct.

- [ ] **Step 8: Run the domain tests**

Run: `npx vitest run tests/domain/roomlessRenovation.test.ts tests/domain/renovation.test.ts tests/domain/planningDepth.test.ts`
Expected: PASS. Then `npx vue-tsc --noEmit` — it reports errors in `application/`, `infrastructure/` and `presentation/`; those are Task 2 and Task 3. Record the list; do not fix them here.

- [ ] **Step 9: Commit**

```bash
git add src/domain/renovation tests/domain/roomlessRenovation.test.ts
git commit -m "domain: let a renovation record have no room context"
```

(Type errors outside `domain/` remain until Task 3; the PR is reviewed as a whole and CI runs on the finished branch.)

---

### Task 2: Plan note schema 11 (persistence)

**Files:**
- Modify: `src/infrastructure/persistence/dto/renovation.ts`, `src/infrastructure/persistence/dto/planningDepth.ts`, `src/infrastructure/persistence/dto/planFrontmatter.ts`, `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts`, `src/infrastructure/persistence/mappers/planMapper.ts`
- Create: `tests/infrastructure/persistence/roomlessPlanVersions.test.ts`

**Interfaces:**
- Consumes: Task 1's optional `roomId`.
- Produces: `PlanFrontmatterSchemaV11`; `planSchemaVersion` returns `11` when any record has no room; helper `writesPlanV11(renovation: Plan['renovation']): boolean` (Task 9 extends it).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { planToPersistence, planFromPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { of } from '../../../src/core/money/Money';

const roomless: Renovation = {
	subjects: [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good' }, planned: { change: 'modify', description: 'Rendered brick' } }],
	work: [{ id: 'work-wall', targetId: 'wall-a', title: 'Render', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-wall'], dependencies: [] }],
	decisions: [{ id: 'decision-wall', subjectId: 'detail-wall', question: 'Which render?', resolution: '', resolved: false }],
	depth: { ...EMPTY_DEPTH,
		costs: [{ id: 'cost-wall', targetId: 'wall-a', workId: 'work-wall', title: 'Render', category: 'other', requirementId: '', planned: of('90', 'EUR'), facts: [], cancelled: false }],
		evidence: [{ id: 'photo-wall', targetId: 'wall-a', workId: '', description: 'Before', type: 'photo', phase: 'before', path: 'wall.jpg', subpath: '', recordId: '', pin: null }],
		procurement: [{ id: 'buy-wall', targetId: 'wall-a', workId: '', requirementId: 'requirement-render', unit: 'm2', purchased: '0', reserved: '0' }] },
};

describe('plan note schema 11 keeps records without a room from older writers', () => {
	it('round-trips every room-less record kind at schema 11', () => {
		const plan = makePlan({ projectId: makeProject().id, renovation: roomless });
		const dto = planToPersistence(plan, 3);
		expect(dto['schema-version']).toBe(11);
		expect(expectOk(planFromPersistence(dto, null)).renovation).toEqual(roomless);
	});
	it('writes what it wrote before when every record has a room', () => {
		const roomId = createZoneId();
		const plan = makePlan({ projectId: makeProject().id, renovation: { subjects: [{ id: 'detail', roomId, targetId: roomId, kind: 'floor', existing: { description: 'Tiles', condition: 'good' }, planned: null }], work: [], decisions: [] } });
		expect(planToPersistence(plan, 3)['schema-version']).toBe(3);
	});
	it('is refused by a schema-10 reader as newer, not as corrupt', () => {
		const dto = planToPersistence(makePlan({ projectId: makeProject().id, renovation: roomless }), 3);
		const old = new MigrationRunner(); old.registerAll('plan', PLAN_MIGRATIONS.filter(step => step.toVersion <= 10));
		expect(() => old.migrateToLatest('plan', dto, 11)).toThrow('newer than this build supports');
	});
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/infrastructure/persistence/roomlessPlanVersions.test.ts`
Expected: FAIL — `schema-version` is `4`, and the round-trip refuses `roomId`.

- [ ] **Step 3: DTOs**

`dto/renovation.ts`: in `subjects`, `work` and `decisions`, `roomId: id` → `roomId: id.optional()`.
`dto/planningDepth.ts`: `const context = { id, roomId: id.optional(), targetId: id, workId: z.string() };` (`SharedLinksSchema` unchanged).

- [ ] **Step 4: Schema 11 and its migration**

In `planFrontmatter.ts`, after V10:

```ts
/**
 * A renovation record with no room (ADR-0029) — and, from Task 9, a subject naming a catalogue
 * material (ADR-0030). The shared `RenovationSchema` accepts both at every version, as it
 * accepts v5's shared links: the version exists to make an older WRITER refuse the note, not
 * to gate this reader.
 */
export const PlanFrontmatterSchemaV11 = PlanFrontmatterSchemaV10.extend({ 'schema-version': z.literal(11) });
```

Add `PlanFrontmatterSchemaV11` to the union and change `PlanFrontmatterDTO` to `z.infer<typeof PlanFrontmatterSchemaV11>`.
In `plan.migrations.ts`: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(...)`.

- [ ] **Step 5: `planMapper.ts`**

Import `depthRecords` from `../../../domain/renovation/PlanningDepth` beside `EMPTY_DEPTH`, then:

```ts
function planSchemaVersion(plan: Plan): number {
	if (writesPlanV11(plan.renovation)) return 11;
	if (plan.north !== undefined) return 10;
	return plan.parent ? 9 : renovationSchemaVersion(plan);
}

/** A record an older build would refuse as corrupt, so it must refuse the whole note as newer instead (ADR-0029). */
function writesPlanV11(renovation: Plan['renovation']): boolean {
	if (!renovation) return false;
	return [...renovation.subjects, ...renovation.work, ...renovation.decisions, ...depthRecords(renovation.depth ?? EMPTY_DEPTH)].some(item => item.roomId === undefined);
}
```

- [ ] **Step 6: Run the persistence tests**

Run: `npx vitest run tests/infrastructure/persistence/roomlessPlanVersions.test.ts tests/infrastructure/persistence/elementVersions.test.ts tests/infrastructure/persistence/planNorthPersistence.test.ts tests/infrastructure/persistence/mappers`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence tests/infrastructure/persistence/roomlessPlanVersions.test.ts
git commit -m "persistence: write plan notes with room-less records at schema 11"
```

---

### Task 3: Consumers of an optional room (application + presentation)

**Files:**
- Modify (application): `src/application/queries/schedule/ProjectWork.ts`, `src/application/commands/renovation/planningLinks.ts`
- Modify (presentation): `src/presentation/editor/planning/planningProjection.ts`, `src/presentation/editor/renovation/renovationCostSummary.ts`, `src/presentation/editor/planning/recordChoices.ts`, `src/presentation/editor/planning/planningDraft.ts`, `src/presentation/editor/planning/PlanningContextFields.vue`, `src/presentation/editor/planning/MaterialFields.vue`, `src/presentation/editor/planning/EvidenceInspector.vue`, `src/presentation/editor/planning/EvidenceMetadataFields.vue`, `src/presentation/editor/planning/EvidenceFields.vue`, `src/presentation/editor/renovation/renovationActions.ts`, `src/presentation/editor/renovation/renovationDraft.ts`, `src/presentation/editor/renovation/WorkFields.vue`, `src/presentation/editor/renovation/DecisionFields.vue`, `src/presentation/editor/renovation/RenovationForm.vue`, `src/presentation/editor/renovation/RenovationLinkedSummary.vue`, `src/presentation/editor/renovation/useReviewPresentation.ts`, `src/presentation/editor/renovation/ReviewInspector.vue`, `src/presentation/editor/renovation/RenovationLayer.vue`, `src/presentation/editor/renovation/editorArrival.ts`, `src/presentation/views/work/projectWorkActions.ts`, `src/presentation/views/work/ProjectWorkRow.vue`, the locales `en/renovation.ts` and `de/renovation.ts`, plus every `focus(item.roomId…)` / `edit(…, item.roomId…)` call site `vue-tsc` reports (`SubjectRow.vue`, `WorkRow.vue`, `DecisionList.vue`, `EvidenceGallery.vue`, `EvidencePins.vue`, `evidencePins.ts`)
- Create: `tests/presentation/editor/roomlessRecords.test.ts`, `tests/application/queries/projectWorkRoomless.test.ts`

**Interfaces:**
- Consumes: `contextOf`, `hasRoomContext(item, contextId)` (Task 1).
- Produces:
  - `costContexts(baseline: PlanningBaseline): readonly string[]` and `costRows(baseline, contextId, prepared?)` in `planningProjection.ts`
  - `recordChoices(baseline, context: string)` — takes a CONTEXT id
  - `renovationActions.focus(roomId, mode, id)` — `roomId` may be `''`; after it, `session.roomId` is always a zone id or `''`
  - `renovationActions.edit(kind, roomId, id)` — accepts any present zone, or `''` while a wall/opening/element is the session target
  - Locale key `renovation.target.none` ("No room" / "Kein Raum")

**The rule for every call site the compiler reports:** a *session* or *draft* `roomId` is a zone id or `''`; a *record* `roomId` is a zone id or absent. Pass `item.roomId ?? ''` where a session room is expected. Where a comparison asks "same context", compare `contextOf(record)` with `session.roomId || session.targetId` (or `draft.roomId || draft.targetId`). Never write `roomId: ''` into a record: spread `...(roomId ? { roomId } : {})`.

- [ ] **Step 1: Write the failing tests**

`tests/presentation/editor/roomlessRecords.test.ts` (the `renovationEditor` rig's `WALL_LOOP` has `boundaries: []`, so `wall-a` bounds no room):

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { of } from '../../../src/core/money/Money';
import { renovationCostSummary } from '../../../src/presentation/editor/renovation/renovationCostSummary';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
type Rig = Awaited<ReturnType<typeof setup>>;
const border: Renovation = { subjects: [], decisions: [],
	work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint the border wall', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }],
	depth: { ...EMPTY_DEPTH, costs: [{ id: 'cost-border', targetId: 'wall-a', workId: 'work-border', title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false }] } };
async function saveBorder(rig: Rig) {
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: border, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await settle();
}

it('saves Work and a cost on a wall that bounds no room and counts that cost once on the floor', async () => {
	const rig = await setup(); await saveBorder(rig);
	const baseline = expectOk(await expectDefined(rig.deps.commands.planning, 'planning services').read(rig.plan.id));
	expect(renovationCostSummary(baseline).count).toBe(1);
	expect(renovationCostSummary(baseline, '', 'wall-a').count).toBe(1);
	expect(renovationCostSummary(baseline, rig.room.id).count).toBe(0);
	expect(renovationCostSummary(baseline).totals).not.toBeNull();
});

it('focuses a room-less record with no room in the session and its wall selected', async () => {
	const rig = await setup(); await saveBorder(rig);
	rig.runtime.renovation.focus('', 'work', 'work-border'); await settle();
	expect(rig.session.roomId).toBe(''); expect(rig.session.targetId).toBe('wall-a');
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
});
```

`tests/application/queries/projectWorkRoomless.test.ts`:

```ts
import { expect, it } from 'vitest';
import { createRepositoryStack } from '../../helpers/vault';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { readProjectWork } from '../../../src/application/queries/schedule/ProjectWork';

it('lists a Work item with no room with an empty room list rather than an unnamed room', async () => {
	const stack = createRepositoryStack(), project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const plan = makePlan({ projectId: project.id, renovation: { subjects: [], decisions: [], work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }] } });
	expectOk(await stack.plans.save(plan, 'absent'));
	const read = expectOk(await readProjectWork({ projects: stack.projects, plans: stack.plans, zones: stack.zones }, project.id));
	expect(read.rows.map(row => row.rooms)).toEqual([[]]);
});
```

If vitest reports `document is not defined` for the second file, add `// @vitest-environment jsdom` as its first line.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/presentation/editor/roomlessRecords.test.ts tests/application/queries/projectWorkRoomless.test.ts`
Expected: FAIL — the floor count is `0` (costs are gathered per zone only), the session `roomId` is `'wall-a'`, and the project row is `[{ id: undefined, name: null }]`.

- [ ] **Step 3: Application**

`ProjectWork.ts` `planWorkRows`:

```ts
  const roomIds = new Set([work.roomId, ...work.links?.map(link => link.roomId) ?? []].filter((id): id is string => id !== undefined));
  for (const id of work.outcomes) { const room = subjects.get(id)?.roomId; if (room) roomIds.add(room); }
```

`ProjectWorkRow.vue` line 17: print `tr('renovation.target.none')` when `row.rooms` is empty, the joined list otherwise. Add `"renovation.target.none": "No room"` to `en/renovation.ts` and `"renovation.target.none": "Kein Raum"` to `de/renovation.ts`.

`planningLinks.ts` (import `contextOf`):

```ts
		records.set(material.entity.id, { roomId: material.entity.origin.zoneId, targetId: material.entity.source?.targetId ?? material.entity.origin.zoneId });
```

```ts
	if (depthRecords(depth).some(item => item.roomId !== undefined && !rooms.has(item.roomId))) return err(depthError());
```

```ts
	if (depth.evidence.some(item => item.recordId && !hasRoomContext(records.get(item.recordId), contextOf(item)))) return err(depthError());
```

- [ ] **Step 4: Costs by context**

`planningProjection.ts` (import `contextOf`): replace `costRows` and `roomCosts` with:

```ts
export function costRows(baseline: PlanningBaseline, contextId: string, prepared = materialRows(baseline)) {
	return contextCosts(baseline, contextId, prepared);
}
/** Every cost context on the floor: each zone, and each target a room-less cost is kept on (ADR-0029). */
export function costContexts(baseline: PlanningBaseline): readonly string[] {
	const roomless = (baseline.plan.entity.renovation?.depth ?? EMPTY_DEPTH).costs.filter(item => item.roomId === undefined).map(item => item.targetId);
	return [...new Set([...baseline.geometry.document.objects.map(item => item.id), ...roomless])];
}
function contextCosts(baseline: PlanningBaseline, contextId: string, allMaterials: ReturnType<typeof materialRows>) {
	const materials = allMaterials.filter(item => item.entity.origin.zoneId === contextId);
	const saved = (baseline.plan.entity.renovation?.depth ?? EMPTY_DEPTH).costs.filter(item => contextOf(item) === contextId);
	const room = baseline.geometry.document.objects.some(item => item.id === contextId) ? { roomId: contextId } : {};
	const derived: CostRecord[] = materials.filter(item => !saved.some(cost => cost.requirementId === item.entity.id && !cost.cancelled)).map(item => ({
		id: `estimate:${item.entity.id}`, ...room, targetId: item.source.targetId, workId: item.source.workId, title: item.name, category: 'material', requirementId: item.entity.id,
		planned: null, facts: [], cancelled: false }));
	return [...saved, ...derived].map(record => {
		const material = materials.find(item => item.entity.id === record.requirementId);
		return { record, stale: !record.planned && !!material?.stale, totals: reconcileCosts(record, material?.cost ?? null, baseline.currency) };
	});
}
```

`financialFindings` iterates `costContexts(baseline)` (calling `contextCosts`) and reports `roomId: row.record.roomId ?? ''`; `evidenceFindings` reports `roomId: item.roomId ?? ''`.

`renovationCostSummary.ts`:

```ts
import { aggregateCosts, costContexts, costRows, materialRows } from '../planning/planningProjection';

/** Reuse reconciliation, including derived material estimates and its stale/mixed-currency refusal. */
export function renovationCostSummary(baseline: PlanningBaseline, roomId = '', targetId = '') {
	const scoped = roomId !== '' || targetId !== '';
	const contexts = roomId && (!targetId || targetId === roomId) ? [roomId] : costContexts(baseline);
	const prepared = materialRows(baseline);
	const rows = contexts.flatMap(id => costRows(baseline, id, prepared)).filter(row => !scoped || inRenovationScope(row.record, roomId, targetId));
	return { rows, count: rows.filter(row => !row.record.cancelled).length, totals: aggregateCosts(rows, baseline.currency) };
}
```

- [ ] **Step 5: Choices and drafts compare contexts**

`recordChoices.ts`:

```ts
export function recordChoices(baseline: PlanningBaseline, context: string) {
 const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
 const subjectContext = new Map(renovation.subjects.map(item => [item.id, contextOf(item)]));
 return [
  ...baseline.materials.filter(item => item.entity.origin.zoneId === context).map(({ entity }) => ({ id: entity.id, label: baseline.catalogue.find(item => item.asset.id === entity.assetId)?.asset.name ?? entity.id })),
  ...renovation.work.filter(item => hasRoomContext(item, context)).map(item => ({ id: item.id, label: item.title })),
  ...renovation.subjects.filter(item => contextOf(item) === context).map(item => ({ id: item.id, label: subjectLabel(item) })),
  ...renovation.decisions.filter(item => (item.roomId ?? subjectContext.get(item.subjectId)) === context).map(item => ({ id: item.id, label: item.question })),
  ...renovation.depth?.costs.filter(item => contextOf(item) === context).map(item => ({ id: item.id, label: item.title })) ?? [],
 ];
}
```

Callers: `EvidenceInspector.vue` → `recordChoices(props.baseline, session.roomId || session.targetId)`; `EvidenceMetadataFields.vue` → `recordChoices(baseline, draft.roomId || draft.targetId)`.

`planningDraft.ts`:
- `recordDraft`: `roomId: cost.roomId ?? ''` and `roomId: evidence.roomId ?? ''`.
- `planningInput`: `const link = { id: draft.id, ...(draft.roomId ? { roomId: draft.roomId } : {}), targetId: draft.targetId, workId: draft.workId };`

Single-line edits:
- `PlanningContextFields.vue` line 10: `...(draft.value.roomId ? [draft.value.roomId] : [])` in place of the bare `draft.value.roomId`; line 29: `hasRoomContext(item, draft.roomId || draft.targetId)`.
- `MaterialFields.vue` line 89: `.filter(item => contextOf(item) === (draft.roomId || draft.targetId) && item.planned)` (import `contextOf`).
- `EvidenceFields.vue` line 31: `{ room: draft.value.roomId || draft.value.targetId }`.
- `WorkFields.vue` line 51: `hasRoomContext(draft.work, contextOf(subject))`.
- `DecisionFields.vue`: name the props (`const props = defineProps<…>()`), add `const current = computed(() => props.value.subjects.find(item => item.id === draft.value.decision.subjectId));` and filter subjects with `contextOf(subject) === (current.value ? contextOf(current.value) : draft.decision.roomId)`.
- `RenovationForm.vue` line 38: `...(draft.value.subject.roomId ? [{ id: draft.value.subject.roomId, label: tr('renovation.room-target') }] : []),`.

`renovationDraft.ts`: add `const room = (roomId: string) => roomId ? { roomId } : {};`; in `subjectDraft` and in `renovationDraft`'s Work and Decision defaults replace `roomId,` with `...room(roomId),`; in `renovationTargetDraft` use `linked.roomId ?? ''`.

- [ ] **Step 6: Navigation keeps the session room a zone**

`renovationActions.ts`:

```ts
function navigationTarget(records: NavigationRecords, roomId: string, id: string, current: Parameters<typeof recordNavigationContext>[3], mode: RenovationMode) {
 const destination = id ? recordNavigationContext(records, id, roomId, current, mode) : null;
 return destination ?? (current?.roomId === roomId ? current : { roomId, targetId: roomId || (current?.targetId ?? '') });
}
```

In `currentContext`: `const room = project.zones.has(targetId) ? targetId : null;`.

In `focus`, the lines after `const target = navigationTarget(…)` become:

```ts
  // A link's roomId is a CONTEXT (spatialContexts); the session holds a zone or nothing.
  Object.assign(session, { roomId: project.zones.has(target.roomId) ? target.roomId : '', targetId: target.targetId }, { mode, focusedId: id, perspective: 'renovate' });
  revealEvidence(id, session, planning);
  revealRecord(id, workspace);
  if (target.targetId && (selection.selectedIds.length !== 1 || selection.selectedIds[0] !== target.targetId)) selection.select([target.targetId as EntityId<string>]);
```

`edit`'s guard becomes `if (blocked.value || dialogs.current || !editableContext(roomId)) return;`, with inside `createRenovationActions`:

```ts
	/** Any present zone; or no room while the session target is a wall, opening or element (ADR-0029). */
	function editableContext(roomId: string): boolean {
		if (roomId) return project.zones.has(roomId);
		const target = session.targetId, structure = project.structure;
		return [...structure.walls, ...structure.openings, ...structure.elements ?? []].some(item => item.id === target);
	}
```

- [ ] **Step 7: Review, arrival and the remaining call sites**

- `useReviewPresentation.ts` line 27: `roomLabel: project.zones.get(item.roomId ?? '')?.name ?? item.roomId ?? tr('renovation.target.none')`.
- `ReviewInspector.vue`: `focus(item.roomId ?? '', …)`, `edit('decision', item.roomId ?? '', …)`; in `renovationLines`, `project.zones.get(item.roomId ?? '')?.name ?? item.roomId ?? tr('renovation.target.none')`.
- `RenovationLayer.vue` markers: `const room = project.zones.get(item.roomId ?? '');`, key the `rows` map with `contextOf(item)`, and `focus(item.roomId ?? '', item.id)`.
- `evidencePins.ts`: `project.zones.get(item.roomId ?? '')`.
- `SubjectRow.vue`, `WorkRow.vue`, `DecisionList.vue`, `EvidenceGallery.vue`, `EvidenceInspector.vue` line 93, `EvidencePins.vue`: `item.roomId` → `item.roomId ?? ''` in every `focus(`/`edit(` call.
- `RenovationLinkedSummary.vue` `links`: `const roomId = props.roomId ?? ''; if (!baseline || (!roomId && !props.targetId)) return [];`.
- `editorArrival.ts` `reveal`:

```ts
 function reveal(origin: ProjectOrigin): boolean {
  const record = recordFor(origin);
  const roomId = origin.roomId ?? record?.roomId, target = roomId ?? record?.targetId;
  if (!target || (roomId !== undefined && !project.zones.has(roomId)) || ((origin.costId || origin.workId) && !record)) {
   notifyWarning(tr('schedule.return-missing')); return false;
  }
  runtime.returnToSelect();
  selection.select([target as EntityId<string>]);
  runtime.renovation.focus(roomId ?? '', origin.costId ? 'costs' : origin.workId ? 'work' : 'overview', record?.id ?? '');
  return true;
 }
```

- `projectWorkActions.ts`: `renovationDraft('work', row.work.roomId ?? '', …)` and `{ planId: row.planId, ...(row.work.roomId ? { roomId: row.work.roomId } : {}), workId: row.work.id }`.

- [ ] **Step 8: Compile, then run the affected suites**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Any remaining one is a call site of the same shape; apply the rule at the top of this task.

Run: `npm run check:fast -- tests/presentation/editor tests/application tests/plugin/projectWork.test.ts tests/domain`
Expected: PASS, including both new files.

- [ ] **Step 9: Commit**

```bash
git add src tests/presentation/editor/roomlessRecords.test.ts tests/application/queries/projectWorkRoomless.test.ts
git commit -m "editor: read, total and navigate renovation records that have no room"
```

---

### Task 4: Inspector for walls without a room and for Areas

**Files:**
- Create: `src/presentation/editor/renovation/defaultRenovationContext.ts`, `tests/presentation/editor/renovation/defaultRenovationContext.test.ts`
- Rename: `src/presentation/editor/renovation/RoomRenovationDetails.vue` → `RenovationDetails.vue` (`git mv`)
- Modify: `src/presentation/editor/renovation/RenovationInspector.vue`, `src/presentation/editor/structure/StructureRenovationEntry.vue`, `src/presentation/editor/renovation/RoomContextSelect.vue`, `src/presentation/editor/renovation/BatchActionList.vue`, `src/presentation/editor/renovation/RenovationEntry.vue`, `src/presentation/editor/add/noteCreation.ts`, locales `en/renovation.ts`, `de/renovation.ts`
- Modify: `tests/presentation/editor/roomlessRecords.test.ts`, `tests/presentation/editor/renovationOverview.test.ts` (the wall case at "keeps a wall selected while capturing its own finish")

**Interfaces:**
- Produces:
  - `interface ContextSource { readonly zoneIds: ReadonlySet<string>; readonly structure: Structure; readonly renovation: Renovation }`
  - `defaultRenovationContext(source: ContextSource, targetId: string, remembered: string): string`
  - `RenovationDetails.vue` props `{ room?: ZoneDto }`
  - `RoomContextSelect.vue` props `{ rooms: readonly { id: string; name: string; zoneType: string }[]; disabled?: boolean; required?: boolean }`
  - Locale keys `renovation.target.rooms`, `renovation.target.areas`; `renovation.target.choose` removed

- [ ] **Step 1: Write the failing node test**

```ts
import { describe, expect, it } from 'vitest';
import { defaultRenovationContext, type ContextSource } from '../../../../src/presentation/editor/renovation/defaultRenovationContext';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';
import { WALL_LOOP } from '../../../helpers/structure';

const source = (patch: Partial<ContextSource> = {}): ContextSource => ({ zoneIds: new Set(['room-a', 'garden']), structure: WALL_LOOP, renovation: EMPTY_RENOVATION, ...patch });

describe('the room a new record starts in', () => {
	it('is the selected zone itself, of any zone type', () => {
		expect(defaultRenovationContext(source(), 'garden', '')).toBe('garden');
	});
	it('is the room an existing subject, then Work item, on the target already names', () => {
		const renovation = { ...EMPTY_RENOVATION, work: [{ id: 'w', roomId: 'garden', targetId: 'wall-a', title: 'x', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] }] };
		expect(defaultRenovationContext(source({ renovation }), 'wall-a', '')).toBe('garden');
	});
	it('is the first room whose boundary holds the wall, or the host wall of an opening', () => {
		const structure = { ...WALL_LOOP, openings: [{ id: 'door', kind: 'door' as const, hostId: 'wall-b', offset: 100, width: 900, height: 2000, sill: 0 }], boundaries: [{ roomId: 'room-a', wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
		expect(defaultRenovationContext(source({ structure }), 'wall-a', '')).toBe('room-a');
		expect(defaultRenovationContext(source({ structure }), 'door', '')).toBe('room-a');
	});
	it('keeps a remembered room that still exists, and otherwise has none', () => {
		expect(defaultRenovationContext(source(), 'wall-a', 'room-a')).toBe('room-a');
		expect(defaultRenovationContext(source(), 'wall-a', 'deleted-room')).toBe('');
		expect(defaultRenovationContext(source(), 'wall-a', '')).toBe('');
		expect(defaultRenovationContext(source(), '', 'room-a')).toBe('');
	});
});
```

Append to `tests/presentation/editor/roomlessRecords.test.ts`:

```ts
it('gives a wall that bounds no room its details, New buttons and a No room choice', async () => {
	const rig = await setup(); rig.selection.select(['wall-a' as never]); await settle();
	const entry = rig.wrapper.get('.rp-structure-renovation-entry');
	expect(entry.get<HTMLSelectElement>('select').element.value).toBe('');
	expect(entry.get('option[value=""]').text()).toBe('No room');
	expect(entry.text()).not.toContain('Choose a room');
	rig.runtime.renovation.focus('', 'work'); await settle();
	await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-form="renovation"] input[name="title"]').setValue('Repoint the border wall');
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.trigger('submit'); await form.trigger('submit'); await settle();
	const saved = expectDefined(rig.project.plan?.renovation?.work[0], 'saved Work');
	expect(saved).toMatchObject({ targetId: 'wall-a', title: 'Repoint the border wall' });
	expect(saved.roomId).toBeUndefined();
});

it('gives an Area the same renovation details a Room gets', async () => {
	const rig = await setup();
	const garden = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Garden', zoneType: 'Garden', geometry: { points: [{ x: 5000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 2000 }, { x: 5000, y: 2000 }] } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.selection.select([garden.id]); await settle();
	expect(rig.session.roomId).toBe(garden.id);
	expect(rig.wrapper.find('[data-rp-mode="existing"]').exists()).toBe(true);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/presentation/editor/renovation/defaultRenovationContext.test.ts tests/presentation/editor/roomlessRecords.test.ts`
Expected: FAIL — module not found; "Choose a room to connect renovation details to this element." present; the Area session `roomId` is `''`.

- [ ] **Step 3: `defaultRenovationContext.ts`**

```ts
import type { Renovation } from '../../../domain/renovation/Renovation';
import type { Structure } from '../../../domain/spatial/Structure';

export interface ContextSource {
	readonly zoneIds: ReadonlySet<string>;
	readonly structure: Structure;
	readonly renovation: Renovation;
}

/**
 * The Room context a new record on `targetId` starts in; '' for none (spec §4.1). The one answer
 * `RenovationInspector`, `StructureRenovationEntry`, the Add submenu and Add › Note share — two
 * watchers used to disagree about it.
 */
export function defaultRenovationContext(source: ContextSource, targetId: string, remembered: string): string {
	if (!targetId) return '';
	if (source.zoneIds.has(targetId)) return targetId;
	const recorded = source.renovation.subjects.find(item => item.targetId === targetId)?.roomId
		?? source.renovation.work.find(item => item.targetId === targetId)?.roomId;
	if (recorded) return recorded;
	const host = source.structure.openings.find(item => item.id === targetId)?.hostId ?? targetId;
	const bounded = source.structure.boundaries.find(item => item.wallIds.includes(host))?.roomId;
	if (bounded) return bounded;
	return source.zoneIds.has(remembered) ? remembered : '';
}
```

- [ ] **Step 4: Both watchers call it**

`RenovationInspector.vue` script — replace the watcher and the `standaloneZone` computed:

```ts
watch(() => selection.selectedIds, ids => {
	const target = ids[0] ?? '', remembered = session.targetId === target ? session.roomId : '';
	session.targetId = target;
	session.roomId = defaultRenovationContext({ zoneIds: new Set(project.zones.keys()), structure: project.structure, renovation: value.value }, target, remembered);
}, { immediate: true });
```

```ts
const standaloneZone = computed(() => selectedZone.value?.zoneType !== 'Room' ? selectedZone.value : undefined);
```

Template: `<RoomRenovationDetails v-if="room" :room="room" />` → `<RenovationDetails v-if="room || element || generic" :room="room" />` (import renamed).

`StructureRenovationEntry.vue` script:

```ts
const zones = computed(() => [...project.zones.values()].map(item => ({ id: item.id, name: item.name, zoneType: item.zoneType })));
watch(() => selection.selectedIds[0], id => {
	const target = id ?? '', remembered = session.targetId === target ? session.roomId : '';
	session.targetId = target;
	session.roomId = defaultRenovationContext({ zoneIds: new Set(project.zones.keys()), structure: project.structure, renovation: project.plan?.renovation ?? EMPTY_RENOVATION }, target, remembered);
}, { immediate: true });
```

Template: `:rooms="zones"`; delete the `<p v-if="!session.roomId">` paragraph; the Overview button's `v-if` becomes `session.perspective === 'plan'`.

- [ ] **Step 5: `RoomContextSelect.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
const props = defineProps<{ rooms: readonly { id: string; name: string; zoneType: string }[]; disabled?: boolean; required?: boolean }>();
const roomId = defineModel<string>({ required: true });
const groups = computed(() => [
	{ key: 'rooms', label: tr('renovation.target.rooms'), items: props.rooms.filter(item => item.zoneType === 'Room') },
	{ key: 'areas', label: tr('renovation.target.areas'), items: props.rooms.filter(item => item.zoneType !== 'Room') },
].filter(group => group.items.length));
</script>
<template>
	<label>{{ tr('renovation.target.room') }}
		<select
			v-model="roomId"
			:disabled="disabled"
		>
			<option value="">{{ tr(required ? 'renovation.select-room' : 'renovation.target.none') }}</option>
			<optgroup
				v-for="group in groups"
				:key="group.key"
				:label="group.label"
			>
				<option
					v-for="room in group.items"
					:key="room.id"
					:value="room.id"
				>{{ room.name }}</option>
			</optgroup>
		</select>
	</label>
</template>
```

`BatchActionList.vue`: a batch still needs a room (spec §11), so pass `required` and map its rooms to include `zoneType`.

Locales: `en/renovation.ts` add `"renovation.target.rooms": "Rooms"`, `"renovation.target.areas": "Areas"`, delete `"renovation.target.choose"`; `de/renovation.ts` add `"renovation.target.rooms": "Räume"`, `"renovation.target.areas": "Bereiche"`, delete `"renovation.target.choose"`.

- [ ] **Step 6: `RenovationDetails.vue` and `RenovationEntry.vue`**

After `git mv src/presentation/editor/renovation/RoomRenovationDetails.vue src/presentation/editor/renovation/RenovationDetails.vue`:

```ts
const props = defineProps<{ room?: ZoneDto }>();
const contextLabel = useRenovationContextLabel();
const contextId = computed(() => props.room?.id ?? '');
const targetName = computed(() => contextLabel({ roomId: session.targetId, targetId: session.targetId }));
const roomMetadataVisible = computed(() => !!props.room && session.mode === 'overview' && (!session.targetId || session.targetId === props.room.id));
```

In the template every `room.id` becomes `contextId`; the area line reads `props.room` inside its `v-if`; `RenovationEntry` gets `:room-id="contextId" :target-name="targetName"`; the New button calls `actions.edit(…, contextId)`; `<RoomRenovationActions :room="room" />` becomes `<RoomRenovationActions v-if="room?.zoneType === 'Room'" :room="room" />`. (The file already declares `contextLabel`; keep one declaration.)

`RenovationEntry.vue`: `defineProps<{ roomId: string; targetName?: string }>()` and `const roomName = computed(() => project.zones.get(props.roomId)?.name ?? props.targetName ?? tr('renovation.select-room'));`.

- [ ] **Step 7: `noteCreation.ts`**

```ts
 const roomId = computed<string | null>(() => {
  if (selection.selectedIds.length !== 1) return null;
  const id = selection.selectedIds[0];
  if (project.zones.has(id)) return id;
  const element = [...project.structure.walls, ...project.structure.openings, ...project.structure.elements ?? []].some(item => item.id === id);
  return element && session.targetId === id ? session.roomId : null;
 });
 const available = computed(() => roomId.value !== null && !!planning.files && !!planning.context.commands.planning
  && runtime.renovation.available && !planning.blocked.value);
 function activate(): void {
  if (!available.value) return;
  const id = roomId.value ?? '', focusedId = session.roomId === id ? session.focusedId : '';
  runtime.returnToSelect(); runtime.renovation.focus(id, 'notes', focusedId);
  void planning.edit('evidence').catch(cause => notifyFault(cause, planning.context.commands.logger, 'editor.add-note.failed'));
 }
```

- [ ] **Step 8: Update the wall case in `renovationOverview.test.ts`**

In "keeps a wall selected while capturing its own finish…", the select now starts at `''` (No room) instead of refusing: keep `setValue(rig.room.id)` — it still exercises choosing a room — and add `expect(rig.wrapper.get<HTMLSelectElement>('.rp-structure-renovation-entry select').element.value).toBe('')` before it.

- [ ] **Step 9: Run**

Run: `npm run check:fast -- tests/presentation/editor`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "editor: show renovation details for walls with no room and for areas"
```

---

### Task 5: Add › submenu in the canvas context menu

**Files:**
- Create: `src/presentation/editor/selection/submenuPlacement.ts`, `src/presentation/editor/selection/recordMenuActions.ts`, `src/presentation/editor/selection/CanvasMenuList.vue`
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts`, `src/presentation/editor/selection/CanvasContextMenu.vue`, `src/presentation/editor/planning/planningContext.ts`, `styles/editor-context-menu.css`, locales `en/input.ts`, `de/input.ts`
- Create: `tests/presentation/editor/selection/submenuPlacement.test.ts`, `tests/presentation/editor/contextMenuSubmenu.test.ts`
- Modify: `tests/presentation/editor/wallContextActions.test.ts`, `tests/presentation/editor/contextMenuActions.test.ts`

**Interfaces:**
- Consumes: `defaultRenovationContext` (Task 4); `runtime.renovation.focus/edit` (Task 3).
- Produces:
  - `CanvasMenuGroup` gains `'records'` (ordered after `'create'`)
  - `interface CanvasMenuSubmenu { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly children: readonly CanvasMenuAction[]; readonly disabled?: boolean; readonly reason?: StringKey }`
  - `type CanvasMenuItem = CanvasMenuAction | CanvasMenuSubmenu`; `useCanvasMenuActions` returns `ComputedRef<readonly CanvasMenuItem[]>`
  - `isSubmenu(item: CanvasMenuItem): item is CanvasMenuSubmenu`
  - `submenuPlacement(parent: Box, submenu: { width: number; height: number }, host: Box, gap?: number): { left: number; top: number }`, `interface Box { left; top; width; height }`
  - `useRecordMenuActions(): (targetId: string, blocked: boolean) => CanvasMenuAction[]`
  - `usePlanningContextIfProvided(): ReturnType<typeof providePlanningContext> | null`
  - Item ids: parent `add-menu`; children `add-door`, `add-window`, `add-opening`, `new-wall`, `add-work`, `add-note`, `add-photo`
  - Locale keys `editor.input.add`, `editor.input.add.door`, `editor.input.add.window`, `editor.input.add.opening`, `editor.input.add.wall-here`, `editor.input.add.work`, `editor.input.add.note`, `editor.input.add.photo`, `editor.input.records-unavailable`; removed `editor.input.new-wall-here`, `editor.input.add-door`, `editor.input.add-window`, `editor.input.add-opening`

- [ ] **Step 1: Placement test (node)**

```ts
import { expect, it } from 'vitest';
import { submenuPlacement } from '../../../../src/presentation/editor/selection/submenuPlacement';

const host = { left: 0, top: 0, width: 800, height: 600 }, size = { width: 160, height: 120 };
it('opens right of its parent item', () => {
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, size, host)).toEqual({ left: 282, top: 50 });
});
it('flips left where it would cross the editor edge, never past the left edge', () => {
	expect(submenuPlacement({ left: 600, top: 50, width: 180, height: 28 }, size, host)).toEqual({ left: 438, top: 50 });
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, { width: 700, height: 120 }, host).left).toBe(0);
});
it('stays inside the editor vertically', () => {
	expect(submenuPlacement({ left: 100, top: 560, width: 180, height: 28 }, size, host).top).toBe(480);
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, size, { ...host, top: 100 }).top).toBe(100);
});
```

- [ ] **Step 2: Submenu behaviour test (jsdom)**

`tests/presentation/editor/contextMenuSubmenu.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import axe from 'axe-core';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { runOptions } from '../../harness/axeOptions';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function menuFor(rig: Rig, id: string) { rig.selection.select([id as never]); await settle(); rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
const ids = (rig: Rig, selector: string) => rig.wrapper.findAll(`${selector} [data-rp-context-action], ${selector} [role="separator"]`).map(item => item.attributes('data-rp-context-action') ?? '|');
const parent = (rig: Rig) => rig.wrapper.get('[data-rp-context-action="add-menu"]');
async function key(target: ReturnType<Rig['wrapper']['get']>, name: string) { await target.trigger('keydown', { key: name }); await settle(); }

it('puts a wall\'s geometry and record creations in one Add submenu, separated', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-haspopup')).toBe('menu');
	expect(parent(rig).attributes('aria-expanded')).toBe('false');
	expect(rig.wrapper.find('[data-rp-context-action="add-door"]').exists()).toBe(false);
	await parent(rig).trigger('click'); await settle();
	expect(parent(rig).attributes('aria-expanded')).toBe('true');
	expect(ids(rig, '.rp-canvas-context-menu--nested')).toEqual(['add-door', 'add-window', 'add-opening', 'new-wall', '|', 'add-work', 'add-note', 'add-photo']);
});

it('offers only record creations for a room, an area and an opening, and no submenu for several items or in Review', async () => {
	const rig = await setup();
	for (const id of [rig.room.id]) {
		await menuFor(rig, id); await parent(rig).trigger('click'); await settle();
		expect(ids(rig, '.rp-canvas-context-menu--nested')).toEqual(['add-work', 'add-note', 'add-photo']);
		await key(parent(rig), 'Escape'); await key(parent(rig), 'Escape');
	}
	rig.selection.select(['wall-a', 'wall-b'] as never[]); await settle();
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	expect(rig.wrapper.find('[data-rp-context-action="add-menu"]').exists()).toBe(false);
	await rig.runtime.renovation.perspective('review'); await menuFor(rig, 'wall-a');
	expect(rig.wrapper.find('[data-rp-context-action="add-menu"]').exists()).toBe(false);
});

it('opens with ArrowRight, returns with ArrowLeft or Escape, and closes everything on a second Escape or Tab', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	parent(rig).element.focus(); await key(parent(rig), 'ArrowRight');
	const first = rig.wrapper.get('[data-rp-context-action="add-door"]');
	expect(document.activeElement).toBe(first.element);
	await key(first, 'ArrowDown'); expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-context-action="add-window"]').element);
	await key(rig.wrapper.get('[data-rp-context-action="add-window"]'), 'ArrowLeft');
	expect(document.activeElement).toBe(parent(rig).element); expect(parent(rig).attributes('aria-expanded')).toBe('false');
	await key(parent(rig), 'Enter'); await key(rig.wrapper.get('[data-rp-context-action="add-door"]'), 'Escape');
	expect(document.activeElement).toBe(parent(rig).element);
	await key(parent(rig), 'Escape');
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	await menuFor(rig, 'wall-a'); await parent(rig).trigger('click'); await settle();
	await key(rig.wrapper.get('[data-rp-context-action="add-note"]'), 'Tab');
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
});

it('opens on hover and closes when the pointer moves to another item', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	await parent(rig).trigger('pointerenter'); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested').exists()).toBe(true);
	await rig.wrapper.get('[data-rp-context-action="measure"]').trigger('pointerenter'); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested').exists()).toBe(false);
});

it('greys children with their reason, and greys the parent only when every child is greyed', async () => {
	const rig = await setup(); rig.project.stale = true; await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-disabled')).toBe('true');
	expect(parent(rig).attributes('title')).toBe('Editing is paused until the floor is re-read.');
	rig.project.stale = false; await key(parent(rig), 'Escape'); await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-disabled')).toBeUndefined();
});

it('creates a Work item with no room from the submenu of a wall that bounds none', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	await parent(rig).trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-context-action="add-work"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Work form open');
	await rig.wrapper.get('[data-rp-form="renovation"] input[name="title"]').setValue('Repoint');
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(() => (rig.project.plan?.renovation?.work.length ?? 0) === 1, 'Work saved');
	const work = expectDefined(rig.project.plan?.renovation?.work[0], 'Work');
	expect(work.targetId).toBe('wall-a'); expect(work.roomId).toBeUndefined();
	expectOk(await rig.renovation.read(rig.plan.id));
});

it('has no axe violations with the submenu open', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a'); await parent(rig).trigger('click'); await settle();
	expect((await axe.run(rig.wrapper.element as HTMLElement, runOptions)).violations).toEqual([]);
}, 30_000);
```

- [ ] **Step 3: Run and watch them fail**

Run: `npx vitest run tests/presentation/editor/selection/submenuPlacement.test.ts tests/presentation/editor/contextMenuSubmenu.test.ts`
Expected: FAIL — module not found; no `add-menu` item.

- [ ] **Step 4: `submenuPlacement.ts`**

```ts
export interface Box { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/**
 * Where a submenu opens, in viewport pixels: right of its parent item, flipped left where it would
 * cross the editor's right edge, clamped inside the editor vertically. Pure because jsdom measures
 * no layout; the component feeds it `getBoundingClientRect()`.
 */
export function submenuPlacement(parent: Box, submenu: { readonly width: number; readonly height: number }, host: Box, gap = 2): { left: number; top: number } {
	const right = parent.left + parent.width + gap;
	const left = right + submenu.width > host.left + host.width ? Math.max(host.left, parent.left - gap - submenu.width) : right;
	const top = Math.max(host.top, Math.min(parent.top, host.top + host.height - submenu.height));
	return { left, top };
}
```

- [ ] **Step 5: Optional planning context**

In `planningContext.ts`, beside `usePlanningContext`:

```ts
/** For a surface that also mounts outside the editor (`canvasContextMenuStandalone.test.ts`): no provider is an answer, not a fault. */
export function usePlanningContextIfProvided(): ReturnType<typeof providePlanningContext> | null { return inject(KEY, null); }
```

- [ ] **Step 6: `recordMenuActions.ts`**

```ts
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { defaultRenovationContext } from '../renovation/defaultRenovationContext';
import { usePlanningContextIfProvided } from '../planning/planningContext';
import { EDITOR_MODE_ICONS } from '../editorIcons';
import type { CanvasMenuAction } from './useCanvasMenuActions';

/** Add › Work item, Note and Photo: the existing forms, opened on the right-clicked target in its default room (spec §5.3). */
export function useRecordMenuActions(): (targetId: string, blocked: boolean) => CanvasMenuAction[] {
	const runtime = useEditorRuntime(), project = useProjectStore(), session = useRenovationSession(), planning = usePlanningContextIfProvided();
	function context(targetId: string): string {
		return defaultRenovationContext({ zoneIds: new Set(project.zones.keys()), structure: project.structure, renovation: project.plan?.renovation ?? EMPTY_RENOVATION }, targetId, session.targetId === targetId ? session.roomId : '');
	}
	async function evidence(targetId: string, mode: 'notes' | 'photos'): Promise<void> {
		runtime.renovation.focus(context(targetId), mode);
		await planning?.edit('evidence');
	}
	return (targetId, blocked) => {
		const records = !runtime.renovation.available, files = records || !planning?.files || !planning.context.commands.planning;
		const reason = (off: boolean) => off ? 'editor.input.records-unavailable' as const : undefined;
		return [
			{ id: 'add-work', label: 'editor.input.add.work', group: 'records', icon: EDITOR_MODE_ICONS.work, disabled: blocked || records, reason: reason(records),
				run: async () => { const room = context(targetId); runtime.renovation.focus(room, 'work'); await runtime.renovation.edit('work', room); } },
			{ id: 'add-note', label: 'editor.input.add.note', group: 'records', icon: EDITOR_MODE_ICONS.notes, disabled: blocked || files, reason: reason(files), run: () => evidence(targetId, 'notes') },
			{ id: 'add-photo', label: 'editor.input.add.photo', group: 'records', icon: EDITOR_MODE_ICONS.photos, disabled: blocked || files, reason: reason(files), run: () => evidence(targetId, 'photos') },
		];
	};
}
```

(`EDITOR_MODE_ICONS` is `hammer`, `sticky-note`, `image` — all pinned harness fixtures.)

- [ ] **Step 7: `useCanvasMenuActions.ts`**

- Types: add `'records'` to `CanvasMenuGroup` and to `GROUP_ORDER` right after `'create'`; add `CanvasMenuSubmenu`, `CanvasMenuItem` and:

```ts
export function isSubmenu(item: CanvasMenuItem): item is CanvasMenuSubmenu { return 'children' in item; }
```

- `ordered` takes and returns `CanvasMenuItem[]`; for a submenu it orders `children` by `GROUP_ORDER`, fills each child's reason, and sets `disabled`/`reason` from its children:

```ts
	function orderActions(result: readonly CanvasMenuAction[]): CanvasMenuAction[] {
		return GROUP_ORDER.flatMap(group => result.filter(action => action.group === group)).map(action => ({ ...action, reason: action.reason ?? reason(action.disabled === true) }));
	}
	function ordered(result: readonly CanvasMenuItem[]): CanvasMenuItem[] {
		return GROUP_ORDER.flatMap(group => result.filter(item => item.group === group)).map(item => {
			if (!isSubmenu(item)) return orderActions([item])[0];
			const children = orderActions(item.children), disabled = children.every(child => child.disabled);
			return { ...item, children, disabled, reason: disabled ? children[0]?.reason : undefined };
		});
	}
```

- `wallActions` keeps ids, `run`, icons and reasons; labels become `editor.input.add.wall-here`, `editor.input.add.door`, `editor.input.add.window`, `editor.input.add.opening`, and the order is door, window, opening, wall-here.
- `singleActions` no longer pushes `wallActions`; the computed pushes the submenu for a single selection outside Review:

```ts
	const records = useRecordMenuActions();
	function addSubmenu(id: string, blocked: boolean): CanvasMenuSubmenu[] {
		const children = [...wallActions(id, blocked), ...records(id, blocked)];
		return children.length ? [{ id: 'add-menu', label: 'editor.input.add', group: 'create', icon: 'plus', children }] : [];
	}
```

and in the computed, `if (ids.length === 1) result.push(...singleActions(id, blocked), ...addSubmenu(id, blocked));` (`result` typed `CanvasMenuItem[]`). `records` only applies to a zone or a structure item: return `[]` from `addSubmenu` when `id` is neither `project.zones.has(id)` nor in `structureCandidates(project.structure)`.

- [ ] **Step 8: `CanvasMenuList.vue`**

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { isSubmenu, type CanvasMenuAction, type CanvasMenuItem, type CanvasMenuSubmenu } from './useCanvasMenuActions';
import { submenuPlacement } from './submenuPlacement';

defineOptions({ name: 'CanvasMenuList' });
const props = defineProps<{ items: readonly CanvasMenuItem[]; label: string; title?: string | null; host: HTMLElement | null; nested?: boolean; position?: { left: string; top: string } }>();
const emit = defineEmits<{ run: [action: CanvasMenuAction]; close: [restore: boolean]; back: [] }>();
const menu = ref<HTMLElement | null>(null), open = ref<string | null>(null), placement = ref({ left: '0px', top: '0px' });
const LEVEL = ':scope > [role="menuitem"], :scope > [role="none"] > [role="menuitem"]';
defineExpose({ menu });
watch(() => props.items, () => { open.value = null; });
function levelItems(): HTMLElement[] { return [...menu.value?.querySelectorAll<HTMLElement>(LEVEL) ?? []]; }
async function expand(item: CanvasMenuSubmenu, opener: HTMLElement, focusFirst: boolean): Promise<void> {
	if (item.disabled) return;
	open.value = item.id;
	await nextTick();
	const child = opener.parentElement?.querySelector<HTMLElement>(':scope > [role="menu"]');
	if (child && props.host) {
		const at = submenuPlacement(opener.getBoundingClientRect(), { width: child.offsetWidth, height: child.offsetHeight }, props.host.getBoundingClientRect());
		placement.value = { left: `${at.left}px`, top: `${at.top}px` };
	}
	if (focusFirst) child?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
}
function collapse(): void {
	const id = open.value; open.value = null;
	if (id) menu.value?.querySelector<HTMLElement>(`[data-rp-context-action="${id}"]`)?.focus();
}
function activate(item: CanvasMenuItem, event: Event, focusFirst: boolean): void {
	if (isSubmenu(item)) { if (open.value === item.id && !focusFirst) open.value = null; else void expand(item, event.currentTarget as HTMLElement, focusFirst); return; }
	if (!item.disabled) emit('run', item);
}
function hover(item: CanvasMenuItem, event: Event): void {
	if (isSubmenu(item)) void expand(item, event.currentTarget as HTMLElement, false); else open.value = null;
}
function move(event: KeyboardEvent): void {
	const items = levelItems(), index = items.indexOf(document.activeElement as HTMLElement);
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[next]?.focus();
}
function keydown(event: KeyboardEvent, item?: CanvasMenuItem): void {
	const handled = ['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key);
	if (!handled) return;
	event.preventDefault(); event.stopPropagation();
	if (event.key === 'Tab') emit('close', true);
	else if (event.key === 'Escape' || event.key === 'ArrowLeft') { if (props.nested) emit('back'); else if (event.key === 'Escape') emit('close', true); }
	else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) move(event);
	else if (item && (event.key !== 'ArrowRight' || isSubmenu(item))) activate(item, event, true);
}
</script>
<template>
	<div
		ref="menu"
		class="rp-canvas-context-menu"
		:class="{ 'rp-canvas-context-menu--nested': nested }"
		role="menu"
		:aria-label="label"
		:style="nested ? placement : position"
		@keydown="keydown($event)"
	>
		<div
			v-if="title"
			class="rp-canvas-context-menu-title"
			role="presentation"
		>
			{{ title }}
		</div>
		<template
			v-for="(item, index) in items"
			:key="item.id"
		>
			<div
				v-if="index > 0 && item.group !== items[index - 1].group"
				class="rp-canvas-context-menu-separator"
				role="separator"
			/>
			<div
				v-if="isSubmenu(item)"
				class="rp-canvas-context-submenu-anchor"
				role="none"
			>
				<button
					type="button"
					role="menuitem"
					tabindex="-1"
					aria-haspopup="menu"
					:aria-expanded="open === item.id"
					:aria-disabled="item.disabled || undefined"
					:title="item.disabled && item.reason ? tr(item.reason) : undefined"
					:data-rp-context-action="item.id"
					@click="activate(item, $event, false)"
					@pointerenter="hover(item, $event)"
					@keydown="keydown($event, item)"
				>
					<HostIcon :name="item.icon" />{{ tr(item.label) }}<HostIcon
						class="rp-canvas-context-menu-chevron"
						name="chevron-right"
					/>
				</button>
				<CanvasMenuList
					v-if="open === item.id"
					:items="item.children"
					:label="tr(item.label)"
					:host="host"
					nested
					@run="emit('run', $event)"
					@close="emit('close', $event)"
					@back="collapse"
				/>
			</div>
			<button
				v-else
				type="button"
				role="menuitem"
				tabindex="-1"
				:aria-disabled="item.disabled || undefined"
				:title="item.disabled && item.reason ? tr(item.reason) : undefined"
				:data-rp-context-action="item.id"
				@click="activate(item, $event, false)"
				@pointerenter="hover(item, $event)"
				@keydown="keydown($event, item)"
			>
				<HostIcon :name="item.icon" />{{ tr(item.label, item.params) }}
			</button>
		</template>
	</div>
</template>
```

A nested `CanvasMenuList`'s own `keydown` handler stops propagation, so the parent level only sees keys from its own items. Split `keydown` further if `eslint`'s complexity budget reports it.

- [ ] **Step 9: `CanvasContextMenu.vue` delegates the list**

- Replace the teleported `<div ref="menu" …>…</div>` with:

```vue
				<CanvasMenuList
					ref="list"
					:items="actions"
					:label="tr('editor.input.context')"
					:title="title"
					:host="root"
					:position="position"
					@run="run"
					@close="close"
				/>
```

- `const list = ref<InstanceType<typeof CanvasMenuList> | null>(null); const menu = computed(() => list.value?.menu ?? null);` replaces the `menu` ref (every existing `menu.value` read keeps working).
- Delete `navigation` (the list owns the keys).
- `deleteKey`: `const action = actions.value.find((item): item is CanvasMenuAction => item.id === 'delete' && !isSubmenu(item) && !item.disabled);`.

- [ ] **Step 10: Styles and copy**

Append to `styles/editor-context-menu.css`:

```css
/* The Add submenu (spec §5.4): the anchor is layout-neutral, the nested menu is fixed so the parent's scroll box cannot clip it. */
.renovation-plan-editor .rp-canvas-context-submenu-anchor { display: contents; }
.renovation-plan-editor .rp-canvas-context-menu--nested { position: fixed; z-index: 41; max-height: none; }
.renovation-plan-editor .rp-canvas-context-menu button .rp-canvas-context-menu-chevron { margin-inline-start: auto; }
.renovation-plan-editor .rp-canvas-context-menu button[aria-expanded='true'] { background: var(--background-modifier-hover); }
```

`en/input.ts`: remove `editor.input.new-wall-here`, `editor.input.add-door`, `editor.input.add-window`, `editor.input.add-opening`; add

```ts
	'editor.input.add': 'Add',
	'editor.input.add.door': 'Door',
	'editor.input.add.window': 'Window',
	'editor.input.add.opening': 'Opening',
	'editor.input.add.wall-here': 'Wall from here',
	'editor.input.add.work': 'Work item',
	'editor.input.add.note': 'Note',
	'editor.input.add.photo': 'Photo',
	'editor.input.records-unavailable': 'Renovation records are not available in this view.',
```

`de/input.ts`: the same four removals, and

```ts
	'editor.input.add': 'Hinzufügen',
	'editor.input.add.door': 'Tür',
	'editor.input.add.window': 'Fenster',
	'editor.input.add.opening': 'Öffnung',
	'editor.input.add.wall-here': 'Wand von hier',
	'editor.input.add.work': 'Arbeit',
	'editor.input.add.note': 'Notiz',
	'editor.input.add.photo': 'Foto',
	'editor.input.records-unavailable': 'Renovierungseinträge sind in dieser Ansicht nicht verfügbar.',
```

- [ ] **Step 11: Existing tests now reach the wall creations through the submenu**

`wallContextActions.test.ts`: add `async function add(rig: Rig, id: string) { await item(rig, 'add-menu').trigger('click'); await settle(); await item(rig, id).trigger('click'); }`; line 33 expects `menuIds(rig).slice(0, 4)` to equal `['edit', 'rotate', 'add-menu', 'measure']`; every `item(rig, 'add-window'|'add-door'|'add-opening'|'new-wall').trigger('click')` becomes `add(rig, …)`; in the greyed New-wall case open `add-menu` before reading `new-wall`'s attributes.

`contextMenuActions.test.ts` line 150: the Room menu is `['edit', 'rename', 'rotate', '|', 'add-menu', 'measure', '|', 'copy', '|', 'enclose', '|', 'fit', 'pan', '|', 'delete']`.

- [ ] **Step 12: Run**

Run: `npm run check:fast -- tests/presentation/editor tests/harness/accessibility.test.ts`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src styles tests
git commit -m "editor: group creations under an Add submenu in the canvas context menu"
```

---

### Task 6: `wall-volume` rule, construction marker, requirement schema 5

**Files:**
- Modify: `src/domain/requirement/RequirementSource.ts`, `src/infrastructure/persistence/dto/planningDepth.ts`, `src/infrastructure/persistence/dto/requirementFrontmatter.ts`, `src/infrastructure/persistence/mappers/requirementMapper.ts`, `src/infrastructure/persistence/migration/entities/requirement/requirement.migrations.ts`, locales `en/planning.ts`, `de/planning.ts`
- Modify: `tests/domain/planningDepth.test.ts`, `tests/infrastructure/persistence/elementVersions.test.ts`

**Interfaces:**
- Produces:
  - `QUANTITY_RULES` includes `'wall-volume'` (after `'wall-length'`); measures `wallLength × height × thickness` mm³ in unit `m3`
  - `RequirementSource.construction?: true` — marks THE construction entry of a subject (ADR-0030)
  - `RequirementFrontmatterSchemaV5`; `requirementSchemaVersion(requirement: Requirement): 1 | 2 | 3 | 4 | 5` (takes the whole requirement, so Task 7 can read its origin)

- [ ] **Step 1: Failing tests**

In `tests/domain/planningDepth.test.ts`, add to the `it.each` table of `measures %s without deriving a Room outline from walls`:

```ts
 ['wall-volume', 'wall-a', 'm3', 1440000000],
```

and a case in the same describe:

```ts
 it('accepts only `true` as a construction marker', () => {
  expect(validRequirementSource({ ...source, construction: true })).toBe(true);
  expect(validRequirementSource({ ...source, construction: false } as unknown as RequirementSource)).toBe(false);
 });
```

In `tests/infrastructure/persistence/elementVersions.test.ts` add:

```ts
	it.each([{ rule: 'wall-volume' as const }, { rule: 'wall-net' as const, construction: true as const }])('writes %j at schema 5 and refuses it to a schema-4 reader as newer', patch => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'zone', zoneId: createZoneId() },
			source: { planId: 'plan', targetId: 'wall-a', workId: '', outcomeId: '', state: 'intended', manual: '0', coverage: '1', lot: '', minimum: '', ...patch } });
		const dto = requirementToPersistence(requirement, 2);
		expect(dto['schema-version']).toBe(5); expect(expectOk(requirementFromPersistence(dto)).source).toEqual(requirement.source);
		const old = new MigrationRunner(); old.registerAll('requirement', REQUIREMENT_MIGRATIONS.filter(step => step.toVersion <= 4));
		expect(() => old.migrateToLatest('requirement', dto, 5)).toThrow('newer than this build supports');
	});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/domain/planningDepth.test.ts tests/infrastructure/persistence/elementVersions.test.ts`
Expected: FAIL — `wall-volume` is not a rule; schema version `2`.

- [ ] **Step 3: Domain**

`RequirementSource.ts`:

```ts
export const QUANTITY_RULES = ['room-area', 'room-perimeter', 'wall-gross', 'wall-net', 'wall-length', 'wall-volume', 'opening-area', 'element-length', 'object-area', 'count', 'placement-count', 'manual'] as const;
```

Add to the interface `/** Marks the one entry a subject's planned material produces (ADR-0030); absent on every other requirement. */ readonly construction?: true;`. In `validRequirementSource` append `&& (source.construction === undefined || source.construction === true)`. In `wallMeasurement`, after the `wall-length` line:

```ts
 if (source.rule === 'wall-volume') return { raw: length * wall.height * wall.thickness, unit: 'm3' };
```

- [ ] **Step 4: Persistence**

`dto/planningDepth.ts` `RequirementSourceSchema`: add `construction: z.literal(true).optional()`.

`dto/requirementFrontmatter.ts`:

```ts
/** `wall-volume`, the construction marker (Task 6) and the `plan` origin (Task 7): an older writer would strip or refuse each. */
export const RequirementFrontmatterSchemaV5 = RequirementFrontmatterSchemaV4.extend({ 'schema-version': z.literal(5) });
export const RequirementFrontmatterSchema = z.union([RequirementFrontmatterSchemaV1, RequirementFrontmatterSchemaV2, RequirementFrontmatterSchemaV3, RequirementFrontmatterSchemaV4, RequirementFrontmatterSchemaV5]);
```

`requirement.migrations.ts`: `[1, 2, 3, 4].map(...)`.

`requirementMapper.ts`:

```ts
/** The lowest schema that holds this requirement: an older build refuses what it does not know as newer, never as corrupt. */
function requirementSchemaVersion(requirement: Requirement): 1 | 2 | 3 | 4 | 5 {
	const source = requirement.source;
	if (source?.rule === 'wall-volume' || source?.construction) return 5;
	if (!source) return 1;
	if (source.rule === 'placement-count') return 4;
	return source.rule === 'element-length' || source.rule === 'object-area' ? 3 : 2;
}
```

and the call site `'schema-version': requirementSchemaVersion(requirement),`.

Locales: `"planning.rule.wall-volume": "Wall volume"` in `en/planning.ts`, `"planning.rule.wall-volume": "Wandvolumen"` in `de/planning.ts`, both after `wall-length`.

- [ ] **Step 5: Run**

Run: `npm run check:fast -- tests/domain tests/infrastructure/persistence tests/presentation/editor/planningForms.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "requirements: measure a wall's volume and mark a construction entry"
```

---

### Task 7: Plan-origin requirements (materials without a room)

**Files:**
- Modify: `src/domain/requirement/RequirementOrigin.ts`, `src/domain/requirement/Requirement.ts`, `src/domain/requirement/RequirementSource.ts` (`sourceMeasurement` signature), `src/infrastructure/persistence/dto/requirementFrontmatter.ts`, `src/infrastructure/persistence/mappers/requirementMapper.ts`, `src/application/ports/RequirementRepository.ts`, `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts`, `src/infrastructure/persistence/in-memory/InMemoryRequirementRepository.ts`, `src/infrastructure/obsidian/repositories/planningReferentialGuard.ts`, `src/application/commands/renovation/materialPlanning.ts`, `src/application/commands/renovation/MaterialCommand.ts`, `src/application/commands/renovation/planningLinks.ts`, `src/application/event-handlers/requirement/onPlanningChanged.ts`, `src/application/commands/requirement/contextualFigures.ts`, `src/application/commands/requirement/RecalculateRequirement.ts`, `src/application/queries/buildRequirementRow.ts`, and the presentation readers listed in Step 6
- Modify: `tests/contracts/requirement-repository.contract.ts`, `tests/infrastructure/persistence/elementVersions.test.ts`, `tests/application/domainValidation.test.ts` (its `Pick<RequirementRepository, 'listByZone'>` fake still compiles; leave it)
- Create: `tests/domain/requirement/planOrigin.test.ts`

**Interfaces:**
- Produces:
  - `RequirementOrigin = { kind: 'zone'; zoneId: ZoneId } | { kind: 'plan'; planId: PlanId }`
  - `originRoomId(origin: RequirementOrigin): ZoneId | undefined`
  - `requirementContext(requirement: { origin: RequirementOrigin; source?: RequirementSource }): SpatialLink` — `roomId` is the CONTEXT (`zoneId`, or the source target for a plan origin)
  - `RequirementRepository.listByPlanOrigin(planId: PlanId): Promise<Result<Loaded<Requirement>[], RepositoryError>>` — strict, like `listByZone`
  - `MaterialInput.roomId?: string` — absent means plan origin
  - `sourceMeasurement(source, roomId: string | undefined, geometry, unit, assetId?)`
  - Frontmatter `origin-kind: zone | plan`, `origin-zone?`, `origin-plan?` at schema 5

- [ ] **Step 1: Failing domain test**

`tests/domain/requirement/planOrigin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeAsset, makeProject, makeRequirement } from '../../helpers/entities';
import { Requirement } from '../../../src/domain/requirement/Requirement';
import { originRoomId, requirementContext } from '../../../src/domain/requirement/RequirementOrigin';
import type { RequirementSource } from '../../../src/domain/requirement/RequirementSource';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';

const planId = 'plan-border' as PlanId;
const source: RequirementSource = { planId, targetId: 'wall-a', workId: '', outcomeId: '', state: 'intended', rule: 'wall-net', manual: '0', coverage: '1', lot: '', minimum: '' };

describe('a requirement whose origin is a plan (ADR-0030)', () => {
	it('names its context by its source target and has no room', () => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'plan', planId }, source });
		expect(originRoomId(requirement.origin)).toBeUndefined();
		expect(requirementContext(requirement)).toEqual({ roomId: 'wall-a', targetId: 'wall-a' });
		const zoneId = createZoneId();
		expect(requirementContext({ origin: { kind: 'zone', zoneId }, source })).toEqual({ roomId: zoneId, targetId: 'wall-a' });
	});
	it('needs a source on the same plan', () => {
		const base = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'plan', planId }, source });
		const props = { id: base.id, projectId: base.projectId, assetId: base.assetId, unit: base.unit, wasteFactor: base.wasteFactor, quantity: base.quantity, estimatedCost: base.estimatedCost, calculatedFrom: base.calculatedFrom };
		expect(Requirement.create({ ...props, origin: { kind: 'plan', planId } }).ok).toBe(false);
		expect(Requirement.create({ ...props, origin: { kind: 'plan', planId }, source: { ...source, planId: 'other' } }).ok).toBe(false);
	});
});
```

Add to `elementVersions.test.ts`:

```ts
	it('writes a plan origin at schema 5 and reads it back', () => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'plan', planId: 'plan' as never },
			source: { planId: 'plan', targetId: 'wall-a', workId: '', outcomeId: '', state: 'intended', rule: 'wall-net', manual: '0', coverage: '1', lot: '', minimum: '' } });
		const dto = requirementToPersistence(requirement, 1);
		expect(dto).toMatchObject({ 'schema-version': 5, 'origin-kind': 'plan', 'origin-plan': 'plan' });
		expect(dto).not.toHaveProperty('origin-zone');
		expect(expectOk(requirementFromPersistence(dto)).origin).toEqual({ kind: 'plan', planId: 'plan' });
		expect(requirementFromPersistence({ ...dto, 'origin-plan': undefined }).ok).toBe(false);
	});
```

Add to the contract's `listByZone and listByAsset…` block a sibling:

```ts
		it('listByPlanOrigin returns only that plan\'s plan-origin requirements', async () => {
			const f = make();
			const project = f.otherProject();
			const source = (planId: string) => ({ planId, targetId: 'wall-a', workId: '', outcomeId: '', state: 'intended' as const, rule: 'wall-net' as const, manual: '0', coverage: '1', lot: '', minimum: '' });
			const onPlan = makeRequirement({ projectId: project, assetId: f.newAsset(), origin: { kind: 'plan', planId: 'plan-a' as never }, source: source('plan-a') });
			const otherPlan = makeRequirement({ projectId: project, assetId: f.newAsset(), origin: { kind: 'plan', planId: 'plan-b' as never }, source: source('plan-b') });
			const zoned = makeRequirement({ projectId: project, assetId: f.newAsset(), origin: { kind: 'zone', zoneId: f.newZone() }, source: source('plan-a') });
			for (const r of [onPlan, otherPlan, zoned]) expectOk(await f.repository.save(r, 'absent'));
			expect(expectOk(await f.repository.listByPlanOrigin('plan-a' as never)).map((r) => r.entity.id)).toEqual([onPlan.id]);
		});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/domain/requirement/planOrigin.test.ts tests/infrastructure/persistence/elementVersions.test.ts tests/infrastructure/persistence/in-memory tests/infrastructure/obsidian/repositories/contract.test.ts`
Expected: FAIL — `originRoomId` missing; `unknown-origin-kind`; `listByPlanOrigin is not a function`.

- [ ] **Step 3: Domain**

`RequirementOrigin.ts`:

```ts
import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from '../zone/ZoneId';
import type { SpatialLink } from '../renovation/SharedLinks';
import type { RequirementSource } from './RequirementSource';

/**
 * Where a Requirement's figures come FROM — a reference, never a copy of geometry (SDD §3.6).
 * `plan` is a contextual material on a wall, opening or element with no room (ADR-0030): its
 * source names the target, so the origin only has to name the plan.
 */
export type RequirementOrigin =
	| { readonly kind: 'zone'; readonly zoneId: ZoneId }
	| { readonly kind: 'plan'; readonly planId: PlanId };

export function originRoomId(origin: RequirementOrigin): ZoneId | undefined {
	return origin.kind === 'zone' ? origin.zoneId : undefined;
}
/** A requirement's context in `spatialContexts`' terms: its Room, or its source target when it has none (ADR-0029). */
export function requirementContext(requirement: { readonly origin: RequirementOrigin; readonly source?: RequirementSource }): SpatialLink {
	const room = originRoomId(requirement.origin), targetId = requirement.source?.targetId ?? room ?? '';
	return { roomId: room ?? targetId, targetId };
}
```

`Requirement.ts` `create`:

```ts
		if (props.origin.kind !== 'zone' && props.origin.kind !== 'plan') {
			return err(requirementError('unknown-origin-kind', `"${String((props.origin as { kind: unknown }).kind)}" is not a requirement origin kind.`));
		}
		if (props.origin.kind === 'plan' && props.source?.planId !== props.origin.planId) {
			return err(requirementError('source-invalid', 'A plan-origin requirement needs a quantity source on the same plan.'));
		}
```

`repointedTo`: `if (this.source && originRoomId(origin) !== originRoomId(this.origin)) return err(…)` (import `originRoomId`).

`RequirementSource.ts`: `sourceMeasurement`, `measurement`, `roomMeasurement`, `placementCount`, `placementCountMeasurement` take `roomId: string | undefined`; `roomMeasurement` and `placementCount` start with `if (!roomId) return null;`.

- [ ] **Step 4: Persistence and repositories**

`requirementFrontmatter.ts`, V5 becomes:

```ts
export const RequirementFrontmatterSchemaV5 = RequirementFrontmatterSchemaV4.extend({
	'schema-version': z.literal(5),
	'origin-kind': z.enum(['zone', 'plan']),
	'origin-zone': z.string().min(1).optional(),
	'origin-plan': z.string().min(1).optional(),
});
```

`requirementMapper.ts`: `requirementSchemaVersion` first line becomes `if (requirement.origin.kind === 'plan' || source?.rule === 'wall-volume' || source?.construction) return 5;`. In `requirementToPersistence` replace the `'origin-zone'` line with

```ts
		...(requirement.origin.kind === 'zone' ? { 'origin-zone': String(requirement.origin.zoneId) } : { 'origin-plan': String(requirement.origin.planId) }),
```

In `requirementFromPersistence`, before `Requirement.create`:

```ts
	const origin = originOf(dto);
	if (!origin) return err(requirementError('frontmatter-invalid', 'A requirement note must name the zone or plan it comes from.'));
```

pass `origin` to `create`, and add

```ts
function originOf(dto: z.infer<typeof RequirementFrontmatterSchema>): RequirementOrigin | null {
	if (dto['origin-kind'] === 'plan') return 'origin-plan' in dto && dto['origin-plan'] ? { kind: 'plan', planId: dto['origin-plan'] as PlanId } : null;
	return dto['origin-zone'] ? { kind: 'zone', zoneId: dto['origin-zone'] as ZoneId } : null;
}
```

(imports: `err`, `z` type from `zod`, `requirementError`, `PlanId`).

Port: add below `listByZone`

```ts
	/** STRICT, for `listByZone`'s reason: `readPlanning` must not present a partial material list as the plan's. */
	listByPlanOrigin(planId: PlanId): Promise<Result<Loaded<Requirement>[], RepositoryError>>;
```

`ObsidianRequirementRepository.ts`:

```ts
	listByPlanOrigin(planId: PlanId): Promise<Result<Loaded<Requirement>[], RepositoryError>> {
		const ids = this.deps.index.getIdsByType('renovation-requirement') as RequirementId[];
		return this.filterLoaded(ids, (r) => r.origin.kind === 'plan' && r.origin.planId === planId);
	}
```

`InMemoryRequirementRepository.ts`:

```ts
	listByPlanOrigin(planId: PlanId): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((r) => r.entity.origin.kind === 'plan' && r.entity.origin.planId === planId)));
	}
```

`planningReferentialGuard.ts` `guardMaterialGeometry`:

```ts
		const roomId = originRoomId(requirement.origin);
		if (roomId !== undefined && !after.objects.some(item => item.id === roomId)) return err(depthError());
```

(the two `sourceMeasurement` calls keep `roomId`).

- [ ] **Step 5: Application**

- `materialPlanning.ts`: `MaterialInput.roomId?: string`; in `readPlanning` after the zone loop:

```ts
	const planned = await deps.requirements.listByPlanOrigin(baseline.value.plan.entity.id);
	if (!planned.ok) return planned;
	materials.push(...planned.value);
```

  In `prepareMaterial`: `origin: input.roomId ? { kind: 'zone', zoneId: input.roomId as ZoneId } : { kind: 'plan', planId: baseline.plan.entity.id }`.
- `MaterialCommand.ts` locks: `const room = 'deleteId' in this.input ? (this.before ? originRoomId(this.before.entity.origin) : undefined) : this.input.roomId; const asset = 'deleteId' in this.input ? this.before?.entity.assetId : this.input.assetId;` then `acquire([this.baseline.plan.entity.id, ...(room ? [room] : []), ...(asset ? [asset] : [])], [this.id])`.
- `planningLinks.ts` `validateMaterialLinks`:

```ts
	const room = originRoomId(requirement.origin), context = requirementContext(requirement).roomId;
	if (source.planId !== baseline.plan.entity.id || (room !== undefined && !baseline.geometry.document.objects.some(item => item.id === room))) return err(depthError());
	if (source.workId && !renovation.work.some(item => item.id === source.workId && hasRoomContext(item, context))) return err(depthError());
	if (source.outcomeId && !renovation.subjects.some(item => item.id === source.outcomeId && item.planned && contextOf(item) === context)) return err(depthError());
	if (!sourceMeasurement(source, room, baseline.geometry.document, requirement.unit, requirement.assetId).ok) return err(depthError());
```

  In `validateDepthLinks`: `records.set(material.entity.id, requirementContext(material.entity));`; the cost line becomes `if (item.requirementId && (!requirement || requirementContext(requirement).roomId !== contextOf(item))) return err(depthError());`; `validProcurementLinks` compares `requirementContext(requirement).roomId === contextOf(item)`.
- `onPlanningChanged.ts`, `contextualFigures.ts`, `buildRequirementRow.ts` `measuredSource`: the `origin.zoneId` argument becomes `originRoomId(entity.origin)` / `originRoomId(requirement.origin)`.
- `RecalculateRequirement.ts`: a sourced requirement never needs the zone's area, so before the `origin.kind !== 'zone'` refusal add a sourced branch that skips the zone load — restructure as: `if (!requirement.source && requirement.origin.kind !== 'zone') return err(…unsupported-origin…)`; load the zone only when `!requirement.source`; compute `area` only in that branch. Keep the asset, project and unit-cost reads shared. Split the method with a private helper if the complexity budget reports it.

- [ ] **Step 6: Presentation readers**

Each `origin.zoneId` read becomes one of the two helpers (import from `domain/requirement/RequirementOrigin`):

| File | Replacement |
| --- | --- |
| `planning/removalSources.ts:9` | `ids.includes(originRoomId(entity.origin) ?? '')` |
| `planning/CostFields.vue:34` | `requirementContext(item.entity).roomId === (draft.roomId \|\| draft.targetId)` |
| `planning/recordChoices.ts` materials | `requirementContext(item.entity).roomId === context` |
| `planning/planningProjection.ts` `sourceOf` | `targetId: originRoomId(requirement.origin) ?? ''` |
| `planningProjection.ts` `materialRows` | `...(originRoomId(entity.origin) ? { roomId: originRoomId(entity.origin) } : {})` in the `prepareMaterial` input |
| `planningProjection.ts` `contextCosts` | `requirementContext(item.entity).roomId === contextId` |
| `planningProjection.ts` `costContexts` | add `...baseline.materials.filter(m => m.entity.origin.kind === 'plan').map(m => requirementContext(m.entity).targetId)` |
| `planningProjection.ts` stale finding | `roomId: originRoomId(item.entity.origin) ?? ''` |
| `planningProjection.ts` shopping line | `[[rp-id:${requirementContext(item.entity).roomId}]]` |
| `planning/planningSelectionContext.ts:10` | `...(originRoomId(entity.origin) ? { roomId: originRoomId(entity.origin) } : {})` in place of `roomId: entity.origin.zoneId` |
| `planning/MaterialsInspector.vue:15` | `inRenovationScope(requirementContext(item.entity), session.roomId, session.targetId)` |
| `planning/planningDraft.ts:23,26` | `inRenovationScope(requirementContext(item.entity), roomId, targetId)`; `roomId: originRoomId(material.origin) ?? ''` |
| `planningDraft.ts` `materialInput` | `...(draft.roomId ? { roomId: draft.roomId } : {})` |
| `planning/MaterialMarkers.vue:20,23,29` | `requirementContext(entity)` for scope and `targetId`; `roomId: originRoomId(entity.origin) ?? ''` |
| `renovation/recordNavigationContext.ts:19` | `return requirementContext(material);` |
| `renovation/RenovationLinkedSummary.vue:21` | `inRenovationScope(requirementContext(entity), roomId, props.targetId)` |
| `elements/AssetPlacementDetails.vue:28` | `originRoomId(entity.origin) === room.value?.id` |

- [ ] **Step 7: A material on a wall with no room, end to end**

Append to `tests/presentation/editor/roomlessRecords.test.ts`:

```ts
it('adds a material to a wall that bounds no room as a plan-origin requirement', async () => {
	const rig = await setup();
	const asset = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Render', unit: 'm2' }), 'absent')).entity;
	rig.selection.select(['wall-a' as never]); await settle();
	rig.runtime.renovation.focus('', 'materials'); await rig.runtime.refreshProjection(); await settle();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === asset.id) === true, 'catalogue read');
	await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="planning"]');
	await form.get('select[name="asset"]').setValue(asset.id); await form.get('select[name="rule"]').setValue('wall-net');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(async () => expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id)).length === 1, 'material saved');
	const saved = expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id))[0].entity;
	expect(saved.origin).toEqual({ kind: 'plan', planId: rig.plan.id }); expect(saved.source?.targetId).toBe('wall-a');
});
```

(imports: `makeAsset` from `../../helpers/entities`, `settleUntil` from `../../helpers/editor`.) If the planning form submits in one step rather than preview-then-apply, drop the second `submit`; `planningWorkflow.test.ts` shows the form's own sequence.

- [ ] **Step 8: Run**

Run: `npx vue-tsc --noEmit`, then `npm run check:fast -- tests/domain tests/application tests/infrastructure tests/presentation/editor`
Expected: no type errors; PASS.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "requirements: let a material belong to a plan when its wall has no room"
```

---

### Task 8: A plan pattern on assets

**Files:**
- Create: `src/domain/asset/PlanPattern.ts`, `tests/domain/asset/planPattern.test.ts`
- Modify: `src/domain/asset/Asset.ts`, `src/infrastructure/persistence/dto/assetFrontmatter.ts`, `src/infrastructure/persistence/mappers/assetMapper.ts`, `src/application/queries/ListCatalogueEntries.ts`, `src/application/commands/asset/UpdateAsset.ts`, `src/presentation/views/assetLabels.ts`, `src/presentation/library/definitionDraft.ts`, `src/presentation/library/AssetInspectorFields.vue`, locales `en-assetLibrary.ts`, `de-assetLibrary.ts`, and every `CatalogueEntryDto` literal `vue-tsc` reports (add `planPattern: null`)
- Modify: `tests/infrastructure/persistence/mappers/slice10Mappers.test.ts`, `tests/presentation/library/definitionDraft.test.ts`

**Interfaces:**
- Produces:
  - `type PlanPattern = 'brick' | 'stone' | 'concrete' | 'timber' | 'insulation' | 'drywall' | 'glass'`, `PLAN_PATTERNS`, `isPlanPattern(value: unknown): value is PlanPattern`
  - `Asset.planPattern: PlanPattern | null`; `CreateAssetProps.planPattern?: PlanPattern | null`
  - Frontmatter key `plan-pattern` (nullable, `.catch(null)`, no schema bump)
  - `CatalogueEntryDto.planPattern: PlanPattern | null`; `UpdateAssetInput['changes'].planPattern`
  - `PLAN_PATTERN_LABELS: Record<PlanPattern, StringKey>`; `DefinitionDraft.planPattern: string` (`''` = none)

- [ ] **Step 1: Failing tests**

`tests/domain/asset/planPattern.test.ts`:

```ts
import { expect, it } from 'vitest';
import { makeAsset } from '../../helpers/entities';
import { Asset } from '../../../src/domain/asset/Asset';
import { PLAN_PATTERNS, isPlanPattern } from '../../../src/domain/asset/PlanPattern';

it('keeps a plan pattern from the fixed list and edits it independently', () => {
	expect(PLAN_PATTERNS).toEqual(['brick', 'stone', 'concrete', 'timber', 'insulation', 'drywall', 'glass']);
	expect(isPlanPattern('brick')).toBe(true); expect(isPlanPattern('marble')).toBe(false);
	const asset = makeAsset({ planPattern: 'brick' });
	expect(asset.planPattern).toBe('brick');
	expect(asset.withChanges({ name: 'Renamed' })).toMatchObject({ ok: true, value: { planPattern: 'brick' } });
	expect(asset.withChanges({ planPattern: null })).toMatchObject({ ok: true, value: { planPattern: null } });
	expect(makeAsset().planPattern).toBeNull();
});

it('refuses a pattern outside the list', () => {
	const asset = makeAsset();
	expect(Asset.create({ id: asset.id, name: 'x', category: 'material', unit: 'm2', unitCost: asset.unitCost, planPattern: 'marble' as never })).toMatchObject({ ok: false, error: { code: 'asset.unknown-plan-pattern' } });
});
```

In `slice10Mappers.test.ts`, inside `describe('asset height persistence', …)` add:

```ts
	it('writes a plan pattern, reads a garbage one as none, and stays at schema 1', () => {
		const dto = assetToPersistence(makeAsset({ planPattern: 'stone' }), 1);
		expect(dto['plan-pattern']).toBe('stone'); expect(dto['schema-version']).toBe(1);
		expect(expectOk(assetFromPersistence({ ...dto })).planPattern).toBe('stone');
		expect(expectOk(assetFromPersistence({ ...dto, 'plan-pattern': 'marble' })).planPattern).toBeNull();
		const { 'plan-pattern': _omitted, ...older } = dto;
		expect(expectOk(assetFromPersistence(older)).planPattern).toBeNull();
	});
```

In `definitionDraft.test.ts` → `describe('definitionChanges', …)`:

```ts
	it('diffs a plan pattern, with an empty choice meaning none', () => {
		const baseline = { ...anEntry(), planPattern: 'brick' as const };
		expect(definitionChanges({ ...definitionDraft(baseline), planPattern: '' }, baseline)).toEqual({ planPattern: null });
		expect(definitionChanges({ ...definitionDraft(baseline), planPattern: 'glass' }, baseline)).toEqual({ planPattern: 'glass' });
	});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/domain/asset/planPattern.test.ts tests/infrastructure/persistence/mappers/slice10Mappers.test.ts tests/presentation/library/definitionDraft.test.ts`
Expected: FAIL — module not found; `plan-pattern` undefined.

- [ ] **Step 3: Domain**

`PlanPattern.ts`:

```ts
/** How an asset draws when it is a wall's material (ADR-0030) — a closed list drawn in theme colours, never a colour. */
export type PlanPattern = 'brick' | 'stone' | 'concrete' | 'timber' | 'insulation' | 'drywall' | 'glass';

export const PLAN_PATTERNS: readonly PlanPattern[] = ['brick', 'stone', 'concrete', 'timber', 'insulation', 'drywall', 'glass'];

export function isPlanPattern(value: unknown): value is PlanPattern {
	return typeof value === 'string' && (PLAN_PATTERNS as readonly string[]).includes(value);
}
```

`Asset.ts`: add `readonly planPattern?: PlanPattern | null;` to `CreateAssetProps` (after `height`) and `readonly planPattern: PlanPattern | null;` to `AssetFields` and the class (with a docblock: "How this asset draws as a wall material; `null` draws plain. Not an input to any quantity or cost."); assign in the constructor; in `create`, before the waste check:

```ts
		const planPattern = props.planPattern ?? null;
		if (planPattern !== null && !isPlanPattern(planPattern)) {
			return err(assetError('unknown-plan-pattern', `"${String(planPattern)}" is not a plan pattern.`));
		}
```

pass `planPattern` into `new Asset`, and in `withChanges`: `planPattern: 'planPattern' in changes ? (changes.planPattern ?? null) : this.planPattern,`.

- [ ] **Step 4: Persistence and read model**

`assetFrontmatter.ts`, after `height`:

```ts
	/** Additive, like `height`: an absent or unknown value reads as a plain wall, and no schema bump is owed (ADR-0030 names the older-writer trade). */
	'plan-pattern': z.custom<PlanPattern>(isPlanPattern).nullable().catch(null),
```

`assetMapper.ts`: `'plan-pattern': asset.planPattern,` in `assetToPersistence`; `planPattern: dto['plan-pattern'],` in `Asset.create`.
`ListCatalogueEntries.ts`: `planPattern: PlanPattern | null;` in `CatalogueEntryDto` and `planPattern: entity.planPattern,` in `toCatalogueEntryDto`.
`UpdateAsset.ts`: `planPattern: PlanPattern | null;` in `changes`; beside the height comparison, `if (candidate.height !== current.height || candidate.planPattern !== current.planPattern)` publishes `assetDesignChanged` (a pattern is appearance, like height).

- [ ] **Step 5: The Asset library inspector**

`assetLabels.ts`:

```ts
export const PLAN_PATTERN_LABELS: Record<PlanPattern, StringKey> = {
	brick: 'view.asset-library.pattern.brick', stone: 'view.asset-library.pattern.stone', concrete: 'view.asset-library.pattern.concrete',
	timber: 'view.asset-library.pattern.timber', insulation: 'view.asset-library.pattern.insulation', drywall: 'view.asset-library.pattern.drywall',
	glass: 'view.asset-library.pattern.glass',
};
```

`definitionDraft.ts`: add `planPattern: string;` to `DefinitionDraft`, `planPattern: 'view.asset-library.plan-pattern'` to `DEFINITION_LABELS`, `planPattern: entry.planPattern ?? ''` to `definitionDraft`, and in `definitionChanges`:

```ts
	if (draft.planPattern !== before.planPattern) changes.planPattern = isPlanPattern(draft.planPattern) ? draft.planPattern : null;
```

`AssetInspectorFields.vue`:

```ts
const selectFields = new Set<keyof DefinitionDraft>(['category', 'unit', 'planPattern']);
function declaredOptions(key: keyof DefinitionDraft): readonly string[] {
	return key === 'category' ? ASSET_CATEGORIES : key === 'planPattern' ? ['', ...PLAN_PATTERNS] : Object.keys(UNIT_KIND);
}
function options(key: keyof DefinitionDraft): readonly string[] {
	const declared = declaredOptions(key);
	const own = key === 'planPattern' ? props.entry.planPattern ?? '' : props.entry[key === 'category' ? 'category' : 'unit'];
	return isDeclared(key, own) ? declared : [own, ...declared];
}
function optionLabel(key: keyof DefinitionDraft, option: string): string {
	if (!isDeclared(key, option)) return option;
	if (key === 'planPattern') return tr(isPlanPattern(option) ? PLAN_PATTERN_LABELS[option] : 'view.asset-library.pattern.none');
	return key === 'category' ? tr(ASSET_CATEGORY_LABELS[option as AssetCategory]) : tr(MEASUREMENT_UNIT_LABELS[option as MeasurementUnit]);
}
```

Locales — `en-assetLibrary.ts`: `'view.asset-library.plan-pattern': 'Plan pattern'`, `'view.asset-library.pattern.none': 'None'`, `…brick: 'Brick'`, `…stone: 'Stone'`, `…concrete: 'Concrete'`, `…timber: 'Timber'`, `…insulation: 'Insulation'`, `…drywall: 'Drywall'`, `…glass: 'Glass'`. `de-assetLibrary.ts`: `'Planmuster'`, `'Keines'`, `'Ziegel'`, `'Naturstein'`, `'Beton'`, `'Holz'`, `'Dämmung'`, `'Trockenbau'`, `'Glas'`.

- [ ] **Step 6: Run**

Run: `npx vue-tsc --noEmit`, then `npm run check:fast -- tests/domain/asset tests/infrastructure/persistence tests/presentation/library tests/application/commands/asset`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "assets: give a catalogue asset a plan pattern"
```

---

### Task 9: A material on a wall's or opening's Existing and Planned facts

**Files:**
- Create: `src/domain/requirement/constructionRule.ts`, `src/application/commands/renovation/renovationLinkCheck.ts`, `src/presentation/editor/renovation/materialChoices.ts`, `tests/domain/subjectMaterials.test.ts`, `tests/presentation/editor/renovation/materialChoices.test.ts`
- Modify: `src/domain/renovation/Renovation.ts`, `src/domain/renovation/renovationTargets.ts`, `src/domain/renovation/sameRenovation.ts`, `src/infrastructure/persistence/dto/renovation.ts`, `src/infrastructure/persistence/mappers/planMapper.ts`, `src/plugin/planningEditorServices.ts`, `tests/harness/planningWorkspace.ts`, `tests/helpers/planning.ts`, `src/presentation/editor/renovation/ExistingFields.vue`, `src/presentation/editor/renovation/PlannedFields.vue`, `src/presentation/editor/renovation/RenovationForm.vue`, `src/presentation/editor/renovation/renovationActions.ts`, `src/presentation/editor/renovation/renovationMessage.ts`, `src/presentation/editor/structure/StructureInspector.vue`, `src/presentation/editor/structure/StructureFacts.vue`, locales `en/renovation.ts`, `de/renovation.ts`, `en/structure.ts`, `de/structure.ts`
- Modify: `tests/infrastructure/persistence/roomlessPlanVersions.test.ts`, `tests/presentation/editor/roomlessRecords.test.ts`

**Interfaces:**
- Produces:
  - `ExistingFacts.assetId?: string`, `PlannedFacts.assetId?: string`
  - `constructionRule(target: 'wall' | 'opening', unit: MeasurementUnit): 'wall-net' | 'wall-length' | 'wall-volume' | 'count' | 'opening-area' | null`
  - `renovationLinkCheck(deps: PlanningDeps): (plan: Plan, document: PlanGeometryDocument) => Promise<Result<void, AppError>>` — the ONE link check the plugin and the harness share
  - `introducedUnknownMaterials(proposed: Renovation, current: Renovation, known: ReadonlySet<string>): readonly string[]`
  - `interface MaterialChoice { readonly id: string; readonly name: string; readonly category: string; readonly unit: MeasurementUnit }`; `materialChoices(catalogue, kind)`; `applyMaterial(facts, id, catalogue)`
  - Error codes `renovation.material-target` (targets) and `renovation.material-missing` (link check); a material on the wrong subject kind fails as the existing `renovation.state`

- [ ] **Step 1: Failing domain and choice tests**

`tests/domain/subjectMaterials.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_RENOVATION, validateRenovation, type RenovationSubject } from '../../src/domain/renovation/Renovation';
import { validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';
import { constructionRule } from '../../src/domain/requirement/constructionRule';
import { WALL_LOOP } from '../helpers/structure';

const wall: RenovationSubject = { id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'asset-brick' }, planned: { change: 'modify', description: 'Drywall', assetId: 'asset-drywall' } };
const valid = (subject: RenovationSubject) => validateRenovation({ ...EMPTY_RENOVATION, subjects: [subject] }).ok;
const structure = { ...WALL_LOOP, openings: [{ id: 'door', kind: 'door' as const, hostId: 'wall-a', offset: 100, width: 900, height: 2000, sill: 0 }] };

describe('a wall or opening material (ADR-0030)', () => {
	it('is allowed on wall, door and window subjects only, and never empty', () => {
		expect(valid(wall)).toBe(true);
		expect(valid({ ...wall, kind: 'floor' })).toBe(false);
		expect(valid({ ...wall, existing: { ...wall.existing!, assetId: '' } })).toBe(false);
	});
	it('stays the same under an unchanged plan and is dropped by a removal', () => {
		expect(valid({ ...wall, planned: { change: 'unchanged', description: 'Brick', assetId: 'asset-brick' } })).toBe(true);
		expect(valid({ ...wall, planned: { change: 'unchanged', description: 'Brick', assetId: 'asset-drywall' } })).toBe(false);
		expect(valid({ ...wall, planned: { change: 'remove', description: '', assetId: 'asset-brick' } })).toBe(false);
	});
	it('needs a wall subject on a wall and a door or window subject on an opening', () => {
		const targets = (subject: RenovationSubject) => validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [subject] }, { roomIds: [], structure });
		expect(targets(wall).ok).toBe(true);
		expect(targets({ ...wall, targetId: 'door' })).toMatchObject({ ok: false, error: { code: 'renovation.material-target' } });
		expect(targets({ ...wall, id: 'detail-door', kind: 'door', targetId: 'door' }).ok).toBe(true);
	});
	it.each([['wall', 'm2', 'wall-net'], ['wall', 'm', 'wall-length'], ['wall', 'm3', 'wall-volume'], ['wall', 'piece', null], ['opening', 'piece', 'count'], ['opening', 'm2', 'opening-area'], ['opening', 'm', null]] as const)('measures a %s material priced per %s with %s', (target, unit, rule) => {
		expect(constructionRule(target, unit)).toBe(rule);
	});
});
```

`tests/presentation/editor/renovation/materialChoices.test.ts`:

```ts
import { expect, it } from 'vitest';
import { applyMaterial, materialChoices } from '../../../../src/presentation/editor/renovation/materialChoices';
import { introducedUnknownMaterials } from '../../../../src/application/commands/renovation/renovationLinkCheck';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';

const catalogue = [{ id: 'brick', name: 'Clinker brick', category: 'material', unit: 'm2' as const }, { id: 'window', name: 'Timber window', category: 'building-element', unit: 'piece' as const }, { id: 'tap', name: 'Tap', category: 'fixture', unit: 'piece' as const }];

it('lists materials and building elements for walls, and building elements and fixtures for openings', () => {
	expect(materialChoices(catalogue, 'wall').map(item => item.id)).toEqual(['brick', 'window']);
	expect(materialChoices(catalogue, 'window').map(item => item.id)).toEqual(['window', 'tap']);
	expect(materialChoices(catalogue, 'floor')).toEqual([]);
});

it('fills an empty description with the material name, keeps a written one, and clears on none', () => {
	const facts: { description: string; assetId?: string } = { description: '' };
	applyMaterial(facts, 'brick', catalogue); expect(facts).toEqual({ description: 'Clinker brick', assetId: 'brick' });
	facts.description = 'Old brick'; applyMaterial(facts, 'window', catalogue); expect(facts.description).toBe('Old brick');
	applyMaterial(facts, '', catalogue); expect(facts).toEqual({ description: 'Old brick' });
});

it('refuses only a material the proposal introduces, never one a note already names', () => {
	const subject = { id: 's', targetId: 'wall-a', kind: 'wall' as const, existing: { description: 'x', condition: 'good' as const, assetId: 'gone' }, planned: null };
	const proposed = { ...EMPTY_RENOVATION, subjects: [{ ...subject, planned: { change: 'modify' as const, description: 'y', assetId: 'also-gone' } }] };
	expect(introducedUnknownMaterials(proposed, { ...EMPTY_RENOVATION, subjects: [subject] }, new Set(['brick']))).toEqual(['also-gone']);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/domain/subjectMaterials.test.ts tests/presentation/editor/renovation/materialChoices.test.ts`
Expected: FAIL — modules not found; `floor` with an asset accepted.

- [ ] **Step 3: Domain**

`Renovation.ts`: `readonly assetId?: string;` on `ExistingFacts` and `PlannedFacts`; add

```ts
/** A catalogue material names what a wall is built of, or which product a door or window is (ADR-0030). */
const MATERIAL_KINDS: readonly RenovationSubject['kind'][] = ['wall', 'door', 'window'];
function validMaterials(subject: RenovationSubject): boolean {
	const { existing, planned } = subject, named = [existing?.assetId, planned?.assetId].filter((id): id is string => id !== undefined);
	if (named.some(id => !id.trim()) || (named.length > 0 && !MATERIAL_KINDS.includes(subject.kind))) return false;
	if (planned?.change === 'remove') return planned.assetId === undefined;
	return planned?.change !== 'unchanged' || planned.assetId === existing?.assetId;
}
```

and the first line of `validSubject` becomes `if (!validMaterials(subject)) return false;` (after destructuring). A subject refused here fails as `renovation.state`.

`constructionRule.ts`:

```ts
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { QUANTITY_RULES } from './RequirementSource';

export type ConstructionTarget = 'wall' | 'opening';

/** How a construction material is measured from its target, by the asset's own unit (ADR-0030); null where no rule measures that unit. */
export function constructionRule(target: ConstructionTarget, unit: MeasurementUnit): typeof QUANTITY_RULES[number] | null {
	if (target === 'wall') return unit === 'm2' ? 'wall-net' : unit === 'm' ? 'wall-length' : unit === 'm3' ? 'wall-volume' : null;
	return unit === 'piece' ? 'count' : unit === 'm2' ? 'opening-area' : null;
}
```

`renovationTargets.ts` (import `Structure`), inside the subject loop after `room-missing`:

```ts
		if (!materialTargetFits(subject, [context.structure ?? EMPTY_STRUCTURE, context.intended ?? context.structure ?? EMPTY_STRUCTURE])) return err(renovationError('material-target'));
```

```ts
function materialTargetFits(subject: RenovationSubject, structures: readonly Structure[]): boolean {
	if (subject.existing?.assetId === undefined && subject.planned?.assetId === undefined) return true;
	const ids = structures.flatMap(item => subject.kind === 'wall' ? item.walls.map(wall => wall.id) : item.openings.map(opening => opening.id));
	return ids.includes(subject.targetId);
}
```

`sameRenovation.ts`: the subject tuple adds `s.existing.assetId` and `s.planned.assetId` inside their arrays.

- [ ] **Step 4: Persistence**

`dto/renovation.ts`: `existing: z.object({ description: z.string(), condition: z.enum(CONDITIONS), assetId: id.optional() }).nullable()`, `planned: z.object({ change: z.enum(CHANGES), description: z.string(), assetId: id.optional() }).nullable()`.

`planMapper.ts` `writesPlanV11`, final line:

```ts
	return [...renovation.subjects, ...renovation.work, ...renovation.decisions, ...depthRecords(renovation.depth ?? EMPTY_DEPTH)].some(item => item.roomId === undefined)
		|| renovation.subjects.some(item => item.existing?.assetId !== undefined || item.planned?.assetId !== undefined);
```

Add to `roomlessPlanVersions.test.ts`:

```ts
	it('writes a subject material at schema 11 even when the subject has a room', () => {
		const roomId = createZoneId();
		const plan = makePlan({ projectId: makeProject().id, renovation: { subjects: [{ id: 'detail', roomId, targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'asset-brick' }, planned: null }], work: [], decisions: [] } });
		const dto = planToPersistence(plan, 3);
		expect(dto['schema-version']).toBe(11);
		expect(expectOk(planFromPersistence(dto, null)).renovation?.subjects[0].existing?.assetId).toBe('asset-brick');
	});
```

- [ ] **Step 5: One link check for plugin and harness**

`renovationLinkCheck.ts`:

```ts
import { err, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { Plan } from '../../../domain/plan/Plan';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject } from '../../../domain/renovation/Renovation';
import type { PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import { referenceError } from '../../errors';
import { readPlanning, type PlanningDeps } from './materialPlanning';
import { validateDepthLinks } from './planningLinks';

const materialIds = (subject: RenovationSubject): string[] => [subject.existing?.assetId, subject.planned?.assetId].filter((id): id is string => !!id);

/** Only a material the proposal ADDS must exist: a note naming a since-deleted asset stays editable (spec §6.1). */
export function introducedUnknownMaterials(proposed: Renovation, current: Renovation, known: ReadonlySet<string>): readonly string[] {
	const before = new Set(current.subjects.flatMap(materialIds));
	return [...new Set(proposed.subjects.flatMap(materialIds))].filter(id => !known.has(id) && !before.has(id));
}

/** The renovation write's link check, against a fresh planning read of the same plan. */
export function renovationLinkCheck(deps: PlanningDeps) {
	return async (plan: Plan, document: PlanGeometryDocument): Promise<Result<void, AppError>> => {
		const fresh = await readPlanning(deps, plan.id);
		if (!fresh.ok) return fresh;
		const proposed = plan.renovation ?? EMPTY_RENOVATION;
		const unknown = introducedUnknownMaterials(proposed, fresh.value.plan.entity.renovation ?? EMPTY_RENOVATION, new Set(fresh.value.catalogue.map(item => item.asset.id as string)));
		if (unknown.length) return err(referenceError('renovation.material-missing', `No catalogue asset ${unknown.join(', ')}.`));
		const links = validateDepthLinks(proposed, { ...fresh.value, geometry: { ...fresh.value.geometry, document } });
		return links.ok ? ok(undefined) : links;
	};
}
```

`planningEditorServices.ts`: the `renovationServices(…)` callback runs the trade check, then `return renovationLinkCheck(deps)(plan, document);` (read the fresh planning once: keep the trade check's own `readPlanning` if extracting it costs a second read — the budget prefers one read; pass `fresh` through by computing trades inside `renovationLinkCheck` only if both fit; otherwise two reads are acceptable).
`tests/harness/planningWorkspace.ts` and `tests/helpers/planning.ts`: replace their inline `validateDepthLinks` callbacks with `renovationLinkCheck({ ...stack, geometry, overrides, locks })` (build the deps object once and pass it to both `planningServices` and `renovationLinkCheck`).
`renovationMessage.ts`: `if (error.code === 'renovation.material-missing') return tr('renovation.material.missing');` and `if (error.code === 'renovation.material-target') return tr('renovation.material.wrong-target');`.

- [ ] **Step 6: Forms**

`materialChoices.ts`:

```ts
import type { MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { RenovationSubject } from '../../../domain/renovation/Renovation';

export interface MaterialChoice { readonly id: string; readonly name: string; readonly category: string; readonly unit: MeasurementUnit }
const CATEGORIES: Partial<Record<RenovationSubject['kind'], readonly string[]>> = { wall: ['material', 'building-element'], door: ['building-element', 'fixture'], window: ['building-element', 'fixture'] };

export function materialChoices(catalogue: readonly MaterialChoice[], kind: RenovationSubject['kind']): readonly MaterialChoice[] {
	const categories = CATEGORIES[kind] ?? [];
	return catalogue.filter(item => categories.includes(item.category));
}
/** '' clears; a chosen material fills an EMPTY description with its name, so the non-empty description rule is kept, not relaxed. */
export function applyMaterial(facts: { description: string; assetId?: string }, id: string, catalogue: readonly MaterialChoice[]): void {
	if (!id) { delete facts.assetId; return; }
	facts.assetId = id;
	if (!facts.description.trim()) facts.description = catalogue.find(item => item.id === id)?.name ?? '';
}
```

`renovationActions.ts` `edit`: add to the form's props `catalogue: planning.baseline?.catalogue.map(({ asset }) => ({ id: asset.id, name: asset.name, category: asset.category, unit: asset.unit })) ?? []`.
`RenovationForm.vue`: prop `catalogue?: readonly MaterialChoice[]`; pass `:catalogue="catalogue ?? []"` to `ExistingFields` and `PlannedFields`; in `proposal()`, the `unchanged` rewrite carries the material: `planned: { change: 'unchanged', description: editing.subject.existing?.description ?? '', ...(editing.subject.existing?.assetId ? { assetId: editing.subject.existing.assetId } : {}) }`.

`ExistingFields.vue` (script additions):

```ts
const props = defineProps<{ value: Renovation; targets: readonly { id: string; label: string }[]; frozen: boolean; catalogue: readonly MaterialChoice[] }>();
const choices = computed(() => materialChoices(props.catalogue, draft.value.subject.kind));
const material = computed({
	get: () => draft.value.subject.existing?.assetId ?? '',
	set: (id: string) => { if (draft.value.subject.existing) applyMaterial(draft.value.subject.existing, id, props.catalogue); },
});
```

template, after the condition label:

```vue
		<label v-if="['wall', 'door', 'window'].includes(draft.subject.kind)">{{ tr(draft.subject.kind === 'wall' ? 'renovation.material' : 'renovation.product') }}
			<select
				v-model="material"
				name="material"
				:aria-disabled="frozen"
				@change.capture="restoreInoperativeChoice($event, material)"
			>
				<option value="">{{ tr('renovation.material.none') }}</option>
				<option
					v-for="item in choices"
					:key="item.id"
					:value="item.id"
				>{{ item.name }}</option>
			</select>
		</label>
```

`PlannedFields.vue`: the same select bound to `planned.assetId` through `applyMaterial(planned, id, props.catalogue)`, shown when `(planned.change === 'modify' || planned.change === 'add') && ['wall', 'door', 'window'].includes(draft.subject.kind)`, followed by

```vue
		<p v-if="unmeasured">
			{{ tr('renovation.material.no-quantity', { unit: unmeasured }) }}
		</p>
```

with `const unmeasured = computed(() => { const unit = props.catalogue.find(item => item.id === planned.value?.assetId)?.unit; const target = draft.value.subject.kind === 'wall' ? 'wall' : 'opening'; return unit && !constructionRule(target, unit) ? unit : ''; });`.

- [ ] **Step 7: The Inspector shows and sets it**

`StructureInspector.vue`:

```ts
const session = useRenovationSession();
const subject = computed(() => project.plan?.renovation?.subjects.find(item => item.targetId === id.value));
const catalogue = computed(() => runtime.planning.baseline.value?.catalogue);
const materialName = (assetId: string | undefined) => assetId === undefined ? undefined : catalogue.value?.find(item => item.asset.id === assetId)?.asset.name ?? tr('renovation.material.unknown');
const materials = computed(() => catalogue.value ? { existing: materialName(subject.value?.existing?.assetId), planned: subject.value?.planned?.assetId !== subject.value?.existing?.assetId ? materialName(subject.value?.planned?.assetId) : undefined } : null);
async function setMaterial(): Promise<void> {
	const planned = session.perspective === 'renovate' && session.mode === 'planned';
	runtime.renovation.focus(session.roomId, planned ? 'planned' : 'existing');
	await runtime.renovation.edit(planned ? 'planned' : 'existing', session.roomId, subject.value?.id ?? '');
}
```

Pass `:materials="materials"` to `StructureFacts`; after the Edit button add

```vue
		<button
			v-if="runtime.renovation.available && materials"
			type="button"
			:aria-disabled="runtime.renovation.blocked.value"
			data-rp-action="set-material"
			@click="setMaterial"
		>
			{{ tr('editor.structure.set-material') }}
		</button>
```

`StructureFacts.vue`: prop `materials?: { existing?: string; planned?: string } | null`; inside both the wall and the opening branches:

```vue
			<template v-if="materials">
				<dt>{{ tr(wall ? 'renovation.material' : 'renovation.product') }}</dt><dd>{{ materials.existing ?? tr('renovation.material.none') }}</dd>
				<template v-if="materials.planned">
					<dt>{{ tr('editor.structure.planned-material') }}</dt><dd>{{ materials.planned }}</dd>
				</template>
			</template>
```

Locales. `en/renovation.ts`: `"renovation.material": "Material"`, `"renovation.product": "Product"`, `"renovation.material.none": "None"`, `"renovation.material.unknown": "Unknown material"`, `"renovation.material.no-quantity": "Quantity isn't calculated for materials priced per {unit}."`, `"renovation.material.missing": "That material is no longer in the asset library. Choose another."`, `"renovation.material.wrong-target": "A wall material belongs on a wall, and a product on a door or window."`. `de/renovation.ts`: `"Material"`, `"Produkt"`, `"Keines"`, `"Unbekanntes Material"`, `"Für Materialien mit der Einheit {unit} wird keine Menge berechnet."`, `"Dieses Material ist nicht mehr in der Asset-Bibliothek. Ein anderes wählen."`, `"Ein Wandmaterial gehört an eine Wand, ein Produkt an eine Tür oder ein Fenster."`. `en/structure.ts`: `'editor.structure.set-material': 'Set material…'`, `'editor.structure.planned-material': 'Planned material'`; `de/structure.ts`: `'Material festlegen…'`, `'Geplantes Material'`.

- [ ] **Step 8: End to end**

Append to `tests/presentation/editor/roomlessRecords.test.ts`:

```ts
it('sets a wall material from the Inspector and shows its name', async () => {
	const rig = await setup();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Clinker brick', unit: 'm2', category: 'material' }), 'absent')).entity;
	await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	rig.selection.select(['wall-a' as never]); await settle();
	await rig.wrapper.get('[data-rp-action="set-material"]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.get('select[name="material"]').setValue(brick.id);
	expect(form.get<HTMLTextAreaElement>('textarea[name="description"]').element.value).toBe('Clinker brick');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(() => rig.project.plan?.renovation?.subjects[0]?.existing?.assetId === brick.id, 'material saved');
	expect(rig.wrapper.get('.rp-structure-inspector').text()).toContain('Clinker brick');
});
```

- [ ] **Step 9: Run**

Run: `npx vue-tsc --noEmit`, then `npm run check:fast -- tests/domain tests/infrastructure/persistence tests/presentation/editor tests/plugin/planningEditorServices.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "renovation: record a catalogue material on a wall or opening"
```

---

### Task 10: The construction entry, saved with its subject

**Files:**
- Create: `src/application/commands/renovation/constructionEntries.ts`, `src/application/commands/renovation/ConstructionMaterialCommand.ts`, `tests/application/commands/constructionMaterial.test.ts`
- Modify: `src/plugin/planningEditorServices.ts`, `tests/harness/planningWorkspace.ts`, `src/presentation/editor/renovation/renovationMessage.ts`, locales `en/renovation.ts`, `de/renovation.ts`

**Interfaces:**
- Consumes: `constructionRule` (Task 9), `RequirementSource.construction` (Task 6), `MaterialCommand`, `readPlanning`, `renovationServices`.
- Produces:
  - `constructionAsset(subject: RenovationSubject): string | undefined`
  - `type ConstructionStep = { readonly kind: 'save'; readonly input: MaterialInput } | { readonly kind: 'delete'; readonly id: string }`
  - `constructionSteps(baseline: PlanningBaseline, proposed: Renovation): readonly ConstructionStep[]`
  - `constructionAwareRenovation(base: RenovationServices, deps: PlanningDeps): RenovationServices`
  - Error code `renovation.construction-referenced`

- [ ] **Step 1: Failing tests**

`tests/application/commands/constructionMaterial.test.ts` (jsdom rig; its harness gets the wrapper in Step 5):

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject } from '../../../src/domain/renovation/Renovation';
import { constructionAsset } from '../../../src/application/commands/renovation/constructionEntries';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const wall = (planned: RenovationSubject['planned'], existing: RenovationSubject['existing'] = { description: 'Brick', condition: 'good' }): RenovationSubject => ({ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing, planned });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const render = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Render', unit: 'm2', category: 'material' }), 'absent')).entity;
	const lime = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Lime render', unit: 'm2', category: 'material' }), 'absent')).entity;
	return { rig, render, lime };
}
async function write(rig: Rig, renovation: Renovation) {
	return rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation, intended: undefined }, rig.runtime.structureTask.ledger));
}
const entries = async (rig: Rig) => expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id)).filter(item => item.entity.source?.construction);

describe('the construction entry (ADR-0030)', () => {
	it('exists only for a new wall or a planned material that differs from the existing one', () => {
		expect(constructionAsset(wall({ change: 'modify', description: 'Rendered', assetId: 'render' }))).toBe('render');
		expect(constructionAsset(wall({ change: 'add', description: 'New', assetId: 'render' }, null))).toBe('render');
		expect(constructionAsset(wall({ change: 'modify', description: 'Painted', assetId: 'render' }, { description: 'Render', condition: 'good', assetId: 'render' }))).toBeUndefined();
		expect(constructionAsset(wall({ change: 'unchanged', description: 'Brick' }))).toBeUndefined();
		expect(constructionAsset(wall(null))).toBeUndefined();
	});

	it('creates, repoints and removes one entry with the planned material, each one undoable', async () => {
		const { rig, render, lime } = await setup();
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] }));
		const [created] = await entries(rig);
		expect(created.entity).toMatchObject({ assetId: render.id, origin: { kind: 'plan', planId: rig.plan.id } });
		expect(created.entity.source).toMatchObject({ targetId: 'wall-a', outcomeId: 'detail-wall', state: 'intended', rule: 'wall-net', construction: true });
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: lime.id })] }));
		expect((await entries(rig)).map(item => [item.entity.id, item.entity.assetId])).toEqual([[created.entity.id, lime.id]]);
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'unchanged', description: 'Brick' })] }));
		expect(await entries(rig)).toEqual([]);
		await rig.runtime.undo(); await settle();
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([lime.id]);
		await rig.runtime.undo(); await settle();
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		await rig.runtime.undo(); await settle();
		expect(await entries(rig)).toEqual([]);
		expect(rig.project.plan?.renovation?.subjects ?? []).toEqual([]);
	});

	it('refuses to clear a material whose entry a cost still uses, and writes nothing', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] }));
		const [entry] = await entries(rig);
		const withCost: Renovation = { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })],
			depth: { procurement: [], evidence: [], costs: [{ id: 'cost-render', targetId: 'wall-a', workId: '', title: 'Render', category: 'material', requirementId: entry.entity.id, planned: null, facts: [], cancelled: false }] } };
		expectOk(await write(rig, withCost));
		const before = [...rig.stack.vault.entries];
		expect(await write(rig, { ...withCost, subjects: [wall({ change: 'unchanged', description: 'Brick' })] })).toMatchObject({ ok: false, error: { code: 'renovation.construction-referenced' } });
		expect([...rig.stack.vault.entries]).toEqual(before);
	});

	it('restores the subject when the entry cannot be written', async () => {
		const { rig, render } = await setup();
		const save = rig.stack.requirements.save.bind(rig.stack.requirements);
		rig.stack.requirements.save = () => Promise.resolve({ ok: false, error: { category: 'Persistence', code: 'test.injected', message: 'Injected.' } } as never);
		expect((await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] })).ok).toBe(false);
		rig.stack.requirements.save = save;
		expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.subjects ?? []).toEqual([]);
	});
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/application/commands/constructionMaterial.test.ts`
Expected: FAIL — module not found; then no entry written.

- [ ] **Step 3: `constructionEntries.ts`**

```ts
import { createRequirementId } from '../../../domain/requirement/RequirementId';
import { originRoomId } from '../../../domain/requirement/RequirementOrigin';
import { constructionRule } from '../../../domain/requirement/constructionRule';
import type { Renovation, RenovationSubject } from '../../../domain/renovation/Renovation';
import type { MaterialInput, PlanningBaseline } from './materialPlanning';

export type ConstructionStep = { readonly kind: 'save'; readonly input: MaterialInput } | { readonly kind: 'delete'; readonly id: string };

/** The planned material that produces an entry: a new target, or a material that differs from the existing one (spec §6.5). */
export function constructionAsset(subject: RenovationSubject): string | undefined {
	const planned = subject.planned;
	if (!planned?.assetId) return undefined;
	if (planned.change === 'add') return planned.assetId;
	return planned.change === 'modify' && planned.assetId !== subject.existing?.assetId ? planned.assetId : undefined;
}

function wanted(subject: RenovationSubject | undefined, baseline: PlanningBaseline): Omit<MaterialInput, 'id' | 'override'> | null {
	const assetId = subject && constructionAsset(subject);
	const asset = baseline.catalogue.find(item => item.asset.id === assetId)?.asset;
	const target = subject?.kind === 'wall' ? 'wall' : subject?.kind === 'door' || subject?.kind === 'window' ? 'opening' : null;
	const rule = asset && target ? constructionRule(target, asset.unit) : null;
	if (!subject || !asset || !rule) return null;
	return { ...(subject.roomId ? { roomId: subject.roomId } : {}), assetId: asset.id, waste: asset.wasteFactorDefault.toString(),
		source: { planId: baseline.plan.entity.id, targetId: subject.targetId, workId: '', outcomeId: subject.id, state: 'intended', rule, manual: '0', coverage: '1', lot: '', minimum: '', construction: true } };
}

/** The entry writes that make the saved construction entries match `proposed`'s subjects; deletions first. */
export function constructionSteps(baseline: PlanningBaseline, proposed: Renovation): readonly ConstructionStep[] {
	const entries = new Map(baseline.materials.filter(item => item.entity.source?.construction).map(item => [item.entity.source?.outcomeId ?? '', item.entity]));
	const subjects = new Map(proposed.subjects.map(item => [item.id, item]));
	const deletes = [...entries].filter(([subjectId]) => !wanted(subjects.get(subjectId), baseline)).map(([, entry]): ConstructionStep => ({ kind: 'delete', id: entry.id }));
	const saves = proposed.subjects.flatMap((subject): ConstructionStep[] => {
		const input = wanted(subject, baseline), entry = entries.get(subject.id);
		if (!input) return [];
		const same = entry && entry.assetId === input.assetId && originRoomId(entry.origin) === input.roomId && entry.source?.rule === input.source.rule && entry.source.targetId === input.source.targetId;
		if (same) return [];
		const keep = entry && entry.unit === baseline.catalogue.find(item => item.asset.id === input.assetId)?.asset.unit;
		return [{ kind: 'save', input: { ...input, id: entry?.id ?? createRequirementId(), override: keep ? entry.quantity.override?.value.toString() ?? '' : '' } }];
	});
	return [...deletes, ...saves];
}
```

- [ ] **Step 4: `ConstructionMaterialCommand.ts`**

```ts
import { err, ok } from '../../../core/result/Result';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { sameRenovation } from '../../../domain/renovation/sameRenovation';
import type { PlanId } from '../../../domain/plan/PlanId';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { referenceError } from '../../errors';
import { sameGeometryDocument } from '../spatial/sameGeometryDocument';
import { MaterialCommand } from './MaterialCommand';
import { materialReferents } from './planningLinks';
import { readPlanning, type PlanningDeps } from './materialPlanning';
import { constructionSteps, type ConstructionStep } from './constructionEntries';
import type { RenovationBaseline, RenovationInput, RenovationServices } from './RenovationCommand';

type Step = { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };

/**
 * A renovation write and the construction entries it implies, as ONE history entry (ADR-0030, M1).
 * Each step is built from a fresh read, because every step's own write moves a version the next
 * step's compare-and-swap checks; a later failure undoes the earlier steps in reverse.
 */
class ConstructionMaterialCommand {
	private done: Step[] = [];
	private retired = false;
	constructor(private readonly deps: PlanningDeps, private readonly base: RenovationServices, private readonly baseline: RenovationBaseline, private readonly input: RenovationInput, private readonly ledger: WriteLedger) {}

	private get planId(): PlanId { return this.baseline.plan.entity.id; }

	async execute(): Promise<DispatchResult> {
		if (this.retired) return err(markUncompensated(undoSuperseded(this.planId)));
		if (this.done.length) return this.replay(this.done, step => step.execute());
		const planning = await readPlanning(this.deps, this.planId);
		if (!planning.ok) return planning;
		const steps = constructionSteps(planning.value, this.input.renovation ?? EMPTY_RENOVATION);
		const referents = steps.flatMap(step => step.kind === 'delete' ? materialReferents(planning.value.plan.entity.renovation?.depth, step.id) : []);
		if (referents.length) return err(referenceError('renovation.construction-referenced', `Still used by ${referents.join(', ')}.`));
		for (const step of steps.filter(item => item.kind === 'delete')) { const result = await this.material(step); if (!result.ok) return result; }
		const renovation = await this.renovation();
		if (!renovation.ok) return renovation;
		for (const step of steps.filter(item => item.kind === 'save')) { const result = await this.material(step); if (!result.ok) return result; }
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		if (this.retired) return err(markUncompensated(undoSuperseded(this.planId)));
		return this.replay([...this.done].reverse(), step => step.undo());
	}

	private async replay(steps: readonly Step[], run: (step: Step) => Promise<DispatchResult>): Promise<DispatchResult> {
		for (const step of steps) { const result = await run(step); if (!result.ok) { this.retired = true; return err(markUncompensated(result.error)); } }
		return ok('wrote');
	}

	/** Runs one step; on failure undoes every earlier step, newest first. */
	private async run(step: Step): Promise<DispatchResult> {
		const result = await step.execute();
		if (result.ok) { this.done.push(step); return result; }
		for (const earlier of [...this.done].reverse()) {
			const undone = await earlier.undo();
			if (!undone.ok) { this.retired = true; return err(markUncompensated(result.error)); }
		}
		this.done = [];
		return result;
	}

	private async material(step: ConstructionStep): Promise<DispatchResult> {
		const fresh = await readPlanning(this.deps, this.planId);
		if (!fresh.ok) return fresh;
		const command = new MaterialCommand(this.deps, fresh.value, step.kind === 'delete' ? { deleteId: step.id } : step.input, this.ledger);
		return this.run({ execute: () => command.run(true), undo: () => command.run(false) });
	}

	/** Rebased onto a fresh read when an earlier step moved the sidecar version, refusing if the content moved too. */
	private async renovation(): Promise<DispatchResult> {
		let baseline = this.baseline;
		if (this.done.length) {
			const read = await this.base.read(this.planId);
			if (!read.ok) return read;
			if (!sameRenovation(read.value.plan.entity.renovation, baseline.plan.entity.renovation) || !sameGeometryDocument(read.value.geometry.document, baseline.geometry.document)) return err(undoSuperseded(this.planId));
			baseline = read.value;
		}
		return this.run(this.base.command(baseline, this.input, this.ledger));
	}
}

/** The renovation services every editor surface uses, with construction entries kept in step (spec §6.5). */
export function constructionAwareRenovation(base: RenovationServices, deps: PlanningDeps): RenovationServices {
	return {
		read: id => base.read(id),
		command: (baseline, input, ledger) => {
			const named = [...baseline.plan.entity.renovation?.subjects ?? [], ...input.renovation?.subjects ?? []].some(item => item.planned?.assetId);
			return named ? new ConstructionMaterialCommand(deps, base, baseline, input, ledger) : base.command(baseline, input, ledger);
		},
	};
}
```

A plan with no planned material anywhere takes the plain `RenovationCommand` and pays no extra planning read.

- [ ] **Step 5: Wire it everywhere `renovationServices` is composed with planning**

- `planningEditorServices.ts`: `renovation: guardedRenovation(constructionAwareRenovation(renovationServices(…), deps), root.logger)`.
- `tests/harness/planningWorkspace.ts`: `renovation: constructionAwareRenovation(renovationServices(stack.plans, geometry, stack.events, renovationLinkCheck(deps)), deps)` with the shared `deps` from Task 9.
- `renovationMessage.ts`: `if (error.code === 'renovation.construction-referenced') return tr('renovation.material.referenced');`.
- Locales: `en/renovation.ts` `"renovation.material.referenced": "A cost or order still uses this material's quantity. Remove it before changing the material."`; `de/renovation.ts` `"Eine Kostenposition oder Bestellung nutzt noch die Menge dieses Materials. Zuerst diese entfernen."`.

- [ ] **Step 6: Run**

Run: `npm run check:fast -- tests/application tests/presentation/editor tests/plugin`
Expected: PASS. If the undo sequence reports `undo.superseded`, the ledger generation of one command was observed by another's write: log `this.done` and each step's result, fix the order (never loosen a version check), and keep the test as written.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "renovation: save a wall's material entry together with its planned material"
```

---

### Task 11: Wall patterns on the canvas

**Files:**
- Create: `src/presentation/editor/structure/patternTile.ts`, `src/presentation/editor/structure/wallPatterns.ts`, `src/presentation/editor/structure/wallBody.ts`
- Modify: `src/presentation/editor/theme/themeTokens.ts`, `src/presentation/editor/structure/StructureLayer.vue`
- Create: `tests/presentation/editor/structure/wallPatterns.test.ts`, `tests/presentation/editor/structure/patternTile.test.ts`, `tests/presentation/editor/structure/wallPatternPass.test.ts`

**Interfaces:**
- Consumes: `Asset.planPattern` (Task 8), subject `assetId` (Task 9).
- Produces:
  - `THEME_TOKENS.wallPattern = '--text-muted'`
  - `wallPatterns(renovation: Renovation, catalogue: readonly { readonly asset: { readonly id: string; readonly planPattern: PlanPattern | null } }[], planned: boolean): ReadonlyMap<string, PlanPattern>`
  - `wallBodyPolygon(wall: Wall, tolerance: number): readonly Point[]`
  - `TILE_PX = 12`; `patternTile(pattern: PlanPattern, ink: string, ground: string, doc?: Document): HTMLCanvasElement | null`
  - Konva node name `wall-pattern`, drawn after every `wall-body` and before `OpeningSymbols`

- [ ] **Step 1: Failing pure tests (node)**

`tests/presentation/editor/structure/wallPatterns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { wallPatterns } from '../../../../src/presentation/editor/structure/wallPatterns';
import { wallBodyPolygon } from '../../../../src/presentation/editor/structure/wallBody';
import { EMPTY_RENOVATION, type RenovationSubject } from '../../../../src/domain/renovation/Renovation';

const catalogue = [{ asset: { id: 'brick', planPattern: 'brick' as const } }, { asset: { id: 'board', planPattern: 'drywall' as const } }, { asset: { id: 'plain', planPattern: null } }];
const subject = (patch: Partial<RenovationSubject>): RenovationSubject => ({ id: 'd', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'brick' }, planned: null, ...patch });
const on = (subjects: RenovationSubject[], planned: boolean) => Object.fromEntries(wallPatterns({ ...EMPTY_RENOVATION, subjects }, catalogue, planned));

describe('which pattern a wall shows (spec §6.7)', () => {
	it('shows the existing material everywhere but the Planned mode', () => {
		expect(on([subject({ planned: { change: 'modify', description: 'Board', assetId: 'board' } })], false)).toEqual({ 'wall-a': 'brick' });
		expect(on([subject({ planned: { change: 'modify', description: 'Board', assetId: 'board' } })], true)).toEqual({ 'wall-a': 'drywall' });
	});
	it('keeps the existing pattern when unchanged, and shows none when removed, patternless or not a wall', () => {
		expect(on([subject({ planned: { change: 'unchanged', description: 'Brick', assetId: 'brick' } })], true)).toEqual({ 'wall-a': 'brick' });
		expect(on([subject({ planned: { change: 'remove', description: '' } })], true)).toEqual({});
		expect(on([subject({ existing: { description: 'x', condition: 'good', assetId: 'plain' } })], false)).toEqual({});
		expect(on([subject({ kind: 'door', targetId: 'door' })], false)).toEqual({});
	});
});

describe('a wall body outline', () => {
	it('is the four corners of a straight wall, thickness wide', () => {
		expect(wallBodyPolygon({ id: 'w', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200, height: 2400 }, 1)).toEqual([{ x: 0, y: -100 }, { x: 4000, y: -100 }, { x: 4000, y: 100 }, { x: 0, y: 100 }]);
	});
	it('follows a curved wall on both faces', () => {
		const points = wallBodyPolygon({ id: 'w', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200, height: 2400, bulge: 0.5 }, 10);
		expect(points.length).toBeGreaterThan(8);
		expect(points.length % 2).toBe(0);
	});
});
```

(If the straight-wall sign convention comes out mirrored — offset `+100` first — fix the expected order to what `arcPolyline`'s left normal gives, and keep the four-corner shape.)

- [ ] **Step 2: Failing pixel test (jsdom)**

`tests/presentation/editor/structure/patternTile.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { backingCanvas, installCanvas } from '../../../helpers/canvas';
import { PLAN_PATTERNS } from '../../../../src/domain/asset/PlanPattern';
import { patternTile, TILE_PX } from '../../../../src/presentation/editor/structure/patternTile';

beforeAll(() => { installCanvas(); });
const pixels = (canvas: HTMLCanvasElement) => [...(backingCanvas(canvas)?.getContext('2d').getImageData(0, 0, TILE_PX, TILE_PX).data ?? [])];

it('draws every pattern in the ink over the ground it is given, each one different', () => {
	const tiles = PLAN_PATTERNS.map(pattern => pixels(patternTile(pattern, 'rgb(10, 20, 30)', 'rgb(200, 200, 200)') as HTMLCanvasElement));
	for (const data of tiles) {
		expect(data.some((value, index) => index % 4 === 0 && value < 100)).toBe(true);
		expect(data.some((value, index) => index % 4 === 0 && value > 150)).toBe(true);
	}
	expect(new Set(tiles.map(data => data.join(','))).size).toBe(PLAN_PATTERNS.length);
});
```

- [ ] **Step 3: Failing layer test (jsdom)**

`tests/presentation/editor/structure/wallPatternPass.test.ts`:

```ts
// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('draws a patterned wall after every wall body, at a constant screen density', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Brick', unit: 'm2', planPattern: 'brick' }), 'absent')).entity;
	const subjects = [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall' as const, existing: { description: 'Brick', condition: 'good' as const, assetId: brick.id }, planned: { change: 'remove' as const, description: '' } }];
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: { ...EMPTY_RENOVATION, subjects }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => layer.find('.wall-pattern').length === 1, 'pattern pass drawn');
	const lines = layer.find<Konva.Shape>('Line'), pattern = layer.findOne<Konva.Line>('.wall-pattern') as Konva.Line;
	expect(lines.indexOf(pattern)).toBeGreaterThan(Math.max(...layer.find('.wall-body').map(node => lines.indexOf(node as Konva.Shape))));
	expect(pattern.fillPatternScaleX()).toBeCloseTo(1 / useEditorStore(rig.pinia).viewport.zoom);
	rig.runtime.renovation.focus('', 'planned'); await settle();
	expect(layer.find('.wall-pattern')).toHaveLength(0);
});
```

- [ ] **Step 4: Run and watch them fail**

Run: `npx vitest run tests/presentation/editor/structure`
Expected: FAIL — modules not found; no `.wall-pattern` node.

- [ ] **Step 5: Pure modules**

`wallPatterns.ts`:

```ts
import type { PlanPattern } from '../../../domain/asset/PlanPattern';
import type { Renovation, RenovationSubject } from '../../../domain/renovation/Renovation';

function shownAsset(subject: RenovationSubject, planned: boolean): string | undefined {
	if (!planned || !subject.planned) return subject.existing?.assetId;
	if (subject.planned.change === 'remove') return undefined;
	return subject.planned.change === 'unchanged' ? subject.existing?.assetId : subject.planned.assetId;
}

/** The plan pattern each wall shows: its planned material in the Planned mode, its existing one elsewhere (spec §6.7). */
export function wallPatterns(renovation: Renovation, catalogue: readonly { readonly asset: { readonly id: string; readonly planPattern: PlanPattern | null } }[], planned: boolean): ReadonlyMap<string, PlanPattern> {
	const patterns = new Map(catalogue.flatMap(({ asset }) => asset.planPattern ? [[asset.id, asset.planPattern] as const] : []));
	const result = new Map<string, PlanPattern>();
	for (const subject of renovation.subjects) {
		const assetId = subject.kind === 'wall' ? shownAsset(subject, planned) : undefined;
		const pattern = assetId ? patterns.get(assetId) : undefined;
		if (pattern) result.set(subject.targetId, pattern);
	}
	return result;
}
```

`wallBody.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import type { Wall } from '../../../domain/spatial/Structure';

/** One face, then the other reversed: the closed outline a wall's body covers, for a fill that a stroke cannot carry. */
export function wallBodyPolygon(wall: Wall, tolerance: number): readonly Point[] {
	const line = arcPolyline({ ...wall, bulge: wall.bulge ?? 0 }, tolerance), half = wall.thickness / 2;
	const normal = (index: number): Point => {
		const a = line[Math.max(0, index - 1)], b = line[Math.min(line.length - 1, index + 1)];
		const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
	};
	const face = (sign: number) => line.map((point, index) => { const n = normal(index); return { x: point.x + sign * n.x * half, y: point.y + sign * n.y * half }; });
	return [...face(-1), ...face(1).reverse()];
}
```

`patternTile.ts`:

```ts
import type { PlanPattern } from '../../../domain/asset/PlanPattern';

export const TILE_PX = 12;
type Segment = readonly [number, number, number, number];
/** Each pattern as tile-space segments; distinct shapes, never colours (SDD §84). */
const SEGMENTS: Record<PlanPattern, readonly Segment[]> = {
	brick: [[0, 0.5, 12, 0.5], [0, 6.5, 12, 6.5], [0.5, 0, 0.5, 6], [6.5, 6, 6.5, 12]],
	stone: [[0, 12, 12, 0], [0, 0, 12, 12]],
	concrete: [[2, 3, 3, 3], [8, 7, 9, 7], [5, 10, 6, 10]],
	timber: [[0, 12, 12, 0]],
	insulation: [[0, 9, 3, 3], [3, 3, 6, 9], [6, 9, 9, 3], [9, 3, 12, 9]],
	drywall: [[0, 0, 12, 12]],
	glass: [[3.5, 0, 3.5, 12], [8.5, 0, 8.5, 12]],
};

/** One repeat of a plan pattern in theme colours on an offscreen canvas; null where the host cannot draw one. */
export function patternTile(pattern: PlanPattern, ink: string, ground: string, doc: Document = document): HTMLCanvasElement | null {
	const canvas = doc.createElement('canvas');
	canvas.width = TILE_PX; canvas.height = TILE_PX;
	const context = canvas.getContext('2d');
	if (!context) return null;
	context.fillStyle = ground; context.fillRect(0, 0, TILE_PX, TILE_PX);
	context.strokeStyle = ink; context.lineWidth = 1;
	context.beginPath();
	for (const [x1, y1, x2, y2] of SEGMENTS[pattern]) { context.moveTo(x1, y1); context.lineTo(x2, y2); }
	context.stroke();
	return canvas;
}
```

`themeTokens.ts`, after `wallFill`: `/** The hatch of a wall's material pattern (ADR-0030) — ink, drawn over wallFill. */ wallPattern: '--text-muted',`.

- [ ] **Step 6: The pass in `StructureLayer.vue`**

Script additions:

```ts
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { wallPatterns } from './wallPatterns';
import { wallBodyPolygon } from './wallBody';
import { patternTile } from './patternTile';
import type { PlanPattern } from '../../../domain/asset/PlanPattern';

const patterns = computed(() => wallPatterns(project.plan?.renovation ?? EMPTY_RENOVATION, runtime.planning.baseline.value?.catalogue ?? [], renovationSession.perspective === 'renovate' && renovationSession.mode === 'planned'));
const tiles = computed(() => new Map([...new Set(patterns.value.values())].map((pattern): [PlanPattern, HTMLCanvasElement | null] => [pattern, patternTile(pattern, props.tokens.wallPattern, props.tokens.wallFill)])));
const patterned = computed(() => structure.value.walls.flatMap(wall => {
	const pattern = patterns.value.get(wall.id), tile = pattern ? tiles.value.get(pattern) : null;
	return tile ? [{ id: wall.id, tile, points: wallBodyPolygon(wall, 0.25 / props.zoom).flatMap(point => [point.x, point.y]) }] : [];
}));
```

Template, right after the `wall-body` `VLine`:

```vue
		<VLine
			v-for="item in patterned"
			:key="'pattern-' + item.id"
			:config="{ name: 'wall-pattern', points: item.points, closed: true, listening: false, fillPatternImage: item.tile, fillPatternRepeat: 'repeat', fillPatternScale: { x: 1 / zoom, y: 1 / zoom } }"
		/>
```

Add to the template comment block above the passes: "A third, per-WALL pass fills a patterned wall's body with its material's hatch (ADR-0030). Per wall rather than per run, so the mitre wedge where two differently patterned walls meet stays plain — the spec's named gap."

If Konva's pattern path throws for a missing `DOMMatrix` under jsdom, look in `tests/helpers/canvas.ts`'s `installCanvas` for where `@napi-rs/canvas` globals are installed and install its `DOMMatrix` there (that module exports one); do not stub it.

- [ ] **Step 7: Run**

Run: `npm run check:fast -- tests/presentation/editor/structure tests/presentation/editor/structureLayerPasses.test.ts tests/presentation/editor/renderModels.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "editor: draw a wall's material pattern on the plan"
```

---

### Task 12: Refuse deleting an asset a wall or opening is made of

**Files:**
- Modify: `src/application/commands/asset/DeleteAsset.ts`, `src/infrastructure/obsidian/repositories/planningReferentialGuard.ts`, `src/plugin/slice10Composition.ts` (renamed in Task 14), `src/plugin/composition-root.ts`, `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `tests/application/reference/deleteAssetRefusals.test.ts`

**Interfaces:**
- Produces:
  - `DeleteAssetDeps.materialUsers?: (assetId: AssetId) => Promise<Result<readonly string[], RepositoryError>>` — names of readable plans whose subjects name the asset
  - `planMaterialUsers(deps: { vault: Vault; index: ProjectIndex }, assetId: string): Promise<Result<readonly string[], RepositoryError>>`
  - Error code `asset.material-in-use` (`Reference`)

- [ ] **Step 1: Failing test** — in `deleteAssetRefusals.test.ts`, inside `describe('DeleteAssetCommand closure refusals', …)`:

```ts
	it('refuses to delete an asset a plan names as a wall or opening material, before touching anything', async () => {
		const w = await wiredAssetWithLink();
		const command = new DeleteAssetCommand({ ...assetSequenceCollaborators(), assets: w.assets, requirements: w.requirements, recalculate: w.recalculate, events: w.events, locks: w.locks, logger: silentLogger(), overrides: w.overrides,
			materialUsers: () => Promise.resolve({ ok: true, value: ['Ground floor'] }) });
		expect(expectErr(await command.execute({ assetId: w.assetId, resolution: 'delete-anyway' })).code).toBe('asset.material-in-use');
		expect(expectOk(await w.assets.getById(w.assetId))).not.toBeNull();
	});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/application/reference/deleteAssetRefusals.test.ts`
Expected: FAIL — the asset is deleted.

- [ ] **Step 3: Implement**

`DeleteAsset.ts`: add the dep (docblock: "Plans whose Existing/Planned facts name this asset (ADR-0030). A subject material is not a Requirement, so the resolution options do not cover it: it refuses."), include `'materialUsers'` in `ops`' `Pick`, and right after `loadAsset`:

```ts
		const users = await this.ops.materialUsers?.(input.assetId);
		if (users && !users.ok) return users;
		if (users?.value.length) return err(referenceError('asset.material-in-use', `Asset ${input.assetId} is a wall or opening material on ${users.value.join(', ')}.`));
```

`planningReferentialGuard.ts`:

```ts
/** Plans whose renovation subjects name `assetId` as a material; an unreadable plan note is skipped, as `guardMaterialRemoval` does not. */
export async function planMaterialUsers(deps: { vault: Vault; index: ProjectIndex }, assetId: string) {
	const names: string[] = [];
	for (const id of deps.index.getIdsByType('renovation-plan')) {
		const raw = await frontmatter(deps.vault, deps.index.getPath(id));
		const parsed = raw?.renovation ? RenovationSchema.safeParse(raw.renovation) : null;
		if (parsed?.success && parsed.data.subjects.some(item => item.existing?.assetId === assetId || item.planned?.assetId === assetId)) names.push(typeof raw?.name === 'string' ? raw.name : id);
	}
	return ok<readonly string[]>(names);
}
```

`slice10Composition.ts`: `Slice10Wiring.materialUsers?: DeleteAssetDeps['materialUsers']`, passed into `new DeleteAssetCommand({ …, materialUsers: wiring.materialUsers })`. `composition-root.ts` `composeSlice10Wiring`: the `session` parameter gains `materialUsers?`, copied into `wiring`; the call at line ~509 passes `materialUsers: assetId => planMaterialUsers({ vault: vault.vault, index }, assetId)`.

Locales: `en.ts` `'asset.material-in-use': 'A wall or opening on a plan is made of this asset. Change that material before deleting it.'`; `de.ts` `'asset.material-in-use': 'Eine Wand oder Öffnung in einem Plan besteht aus diesem Asset. Zuerst dieses Material ändern, dann löschen.'`.

- [ ] **Step 4: Run**

Run: `npm run check:fast -- tests/application/reference tests/application/commands/asset tests/plugin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "assets: refuse deleting an asset a wall or opening is made of"
```

---

### Task 13: ADRs, requirement docs, manual case, visual check

**Files:**
- Create: `docs/development/adrs/0029-a-renovation-record-may-have-no-room.md`, `docs/development/adrs/0030-construction-materials-and-plan-patterns.md`, `docs/tests/cases/Record work, a photo and a material on a property-border wall.md`
- Modify: `docs/development/adrs/0020-connected-walls-and-hosted-openings.md` (line 17), `docs/development/adrs/0021-existing-planned-work-and-record-links.md` (lines 19 and 116), `docs/development/adrs/0022-material-quantities-cost-facts-and-vault-evidence.md` (after line 16), `docs/requirements/Edit a selected wall precisely.md` (line 48)

- [ ] **Step 1: ADR-0029**

```markdown
---
adr: 29
title: A renovation record may have no room
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0029: A renovation record may have no room

## Context

ADR-0021 gave every record "one Room context". A wall on a property border, a garden wall or a
free-standing partition bounds no room, so nothing could be recorded about it, and Areas got no
renovation details at all.

## Decision

- The PRIMARY `roomId` of subjects, Work, decisions, costs, evidence and procurement is optional.
  A record's context is `contextOf(item) = item.roomId ?? item.targetId`, and every "same room?"
  comparison asks "same context?". `spatialContexts` reports the primary link with that context.
- A record with a room names a present zone of any type. A record with none targets a wall,
  opening or element — never a zone. `''` is refused.
- Secondary shared links (ADR-0021 "Editor completion") still name a present zone.
- Evidence with no room has no pin: a pin is a fraction of a room's bounding box.
- A plan note holding such a record is written at schema 11 (pure 10 → 11 migration), so an older
  build refuses the note as newer instead of refusing its records as corrupt.
- A room-less wall that later encloses a room keeps its records room-less.

## Alternatives

- **A placeholder "floor" key.** A fabricated key every zone lookup silently misses.
- **Require an Area.** Needs an "outside" area drawn around the property first.
- **Store the target id in `roomId`.** A field named for rooms holding wall ids.
```

- [ ] **Step 2: ADR-0030**

```markdown
---
adr: 30
title: Construction materials, plan-origin requirements and plan patterns
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0030: Construction materials, plan-origin requirements and plan patterns

## Decision

- A wall's or opening's Existing and Planned facts carry an optional catalogue `assetId`: one core
  material for a wall, one product for a door or window. `unchanged` keeps the existing material;
  `remove` carries none. Only a material a write introduces must exist; a note naming a deleted
  asset reads and stays editable. Written at plan schema 11.
- An asset has an optional `planPattern` from a fixed list drawn in theme colours. It is an
  additive `.catch(null)` key with no schema bump — the `height` trade: an older build that saves
  the asset drops it.
- A subject whose planned material is new, or differs from its existing one, owns ONE construction
  Requirement (`source.construction: true`, `outcomeId` = the subject, `state: intended`), measured
  by the asset's unit: wall `m2` → `wall-net`, `m` → `wall-length`, `m3` → `wall-volume`; opening
  `piece` → `count`, `m2` → `opening-area`; any other unit produces none.
- `ConstructionMaterialCommand` saves the subject and its entry as one history entry: entry
  deletions, then the renovation write, then entry saves, each from a fresh read; a failure undoes
  the earlier steps; clearing a material whose entry a cost or order uses is refused.
- `RequirementOrigin` gains `{ kind: 'plan', planId }` for a material with no room; its source names
  the target. Requirement schema 5 holds the plan origin, `wall-volume` and the marker.
- Deleting an asset a plan subject names is refused; the resolution options do not cover it.

## Alternatives

- **Computed until touched (M2).** Budget, procurement and quotes read saved requirements and would undercount.
- **Layered build-ups; frame and glazing fields; custom colours; material on the sidecar wall.** More UI, theme clashes, and ADR-0021 gives the sidecar coordinates only.

## Amends

ADR-0020's deferral of "wall construction text"; ADR-0022's room-only requirement origin;
*Edit a selected wall precisely*'s out-of-scope construction line.
```

- [ ] **Step 3: Pointers back**

- ADR-0021 line 19, after "one Room context,": append ` (optional since [ADR-0029](0029-a-renovation-record-may-have-no-room.md))`; line 116, after "refer to a present Room context": append ` (a secondary link still does; a primary context may be none — ADR-0029)`.
- ADR-0020 line 17: after "wall construction text" append ` (a catalogue material since [ADR-0030](0030-construction-materials-and-plan-patterns.md))`.
- ADR-0022 after line 16 add: `A Requirement may also originate from a plan when its wall has no room ([ADR-0030](0030-construction-materials-and-plan-patterns.md)).`
- `Edit a selected wall precisely.md` line 48 becomes `- Changing Wall finish or renovation state here. (A wall's construction material is set from its Inspector since ADR-0030.)`

- [ ] **Step 4: Manual test case**

`docs/tests/cases/Record work, a photo and a material on a property-border wall.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 210
sources:
  - Wall context records and materials design spec §3–§6
status: Ready
---

# Record work, a photo and a material on a property-border wall

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a floor with
one Room and one wall drawn outside it, a vault image, and two library assets priced per m² —
"Clinker brick" with plan pattern Brick, "Lime render" with none.

## Steps

1. Right-click the outside wall. **Expected:** the menu shows **Add** with a chevron; hovering it opens Door, Window, Opening, Wall from here, a separator, Work item, Note, Photo beside the parent item.
2. Press Esc once. **Expected:** only the submenu closes. Press Esc again. **Expected:** the menu closes.
3. Add › Work item, title "Repoint", apply. **Expected:** the room picker reads **No room**; the Work item lists under the wall.
4. Add › Photo, pick the image, apply. **Expected:** the photo shows in the wall's photo strip with no pin.
5. Inspector → Set material…, choose Clinker brick, apply. **Expected:** Material reads Clinker brick; the wall draws a brick hatch in both light and dark themes.
6. Planned view, change: modify, material Lime render, apply. **Expected:** Materials lists one Lime render entry measured by the wall's net area; the wall draws plain in the Planned view and hatched elsewhere.
7. Ctrl+Z. **Expected:** the planned material and its entry both disappear.
8. Delete Clinker brick in the Asset library. **Expected:** refused, naming the floor.
9. Right-click a Garden area → Add › Note. **Expected:** the note form opens with the area as its context.

## Runs

| Date | Build | Result | Notes |
| --- | --- | --- | --- |
```

- [ ] **Step 5: Visual check in the harness (Browser pane)**

Start `npm run harness` through the Browser pane's `preview_start`, open `?view=plan-editor&reference&planning&assets&theme=light`, select a wall, right-click it, hover **Add**, screenshot; repeat with `theme=dark` and at a 460 px width (`resize_window`). Then set a patterned material through Set material… and screenshot the wall. Record in the PR description which screenshots were taken and anything the harness refused (the plan-editor harness floor may refuse writes; say so rather than skipping silently).

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: record room-less records and construction materials"
```

---

### Task 14: Rename `slice10Composition.ts` to what it composes

The module composes the asset catalogue and material requirement commands, queries and cascade handlers. "Slice 10" is a delivery label, not a description.

**Files:**
- Rename: `src/plugin/slice10Composition.ts` → `src/plugin/catalogueRequirementComposition.ts` (`git mv`)
- Rename: `tests/plugin/slice10CascadeWiring.test.ts` → `tests/plugin/catalogueRequirementCascadeWiring.test.ts` (`git mv`)
- Modify: `src/plugin/composition-root.ts`, `src/plugin/guardedServices.ts`, `src/plugin/guardedAssetLibrary.ts`, `src/plugin/guardedAssetPrice.ts`, `src/presentation/notices/notify.ts`, `src/application/commands/requirement/DeleteRequirement.ts`, `tests/plugin/assetPriceNoticeWiring.test.ts`, `tests/plugin/catalogueRequirementCascadeWiring.test.ts`, `tests/plugin/assetPriceWiring.test.ts`, `tests/plugin/rootSwapRebind.test.ts`, `vitest.config.ts` (comments only)

**Interfaces:**
- Produces (identifier renames, everywhere they occur in `src/` and `tests/`):

| Old | New |
| --- | --- |
| `composeSlice10` | `composeCatalogueRequirements` |
| `Slice10Wiring` | `CatalogueRequirementWiring` |
| `composeSlice10Wiring` | `composeCatalogueRequirementWiring` |
| `guardSlice10` | `guardCatalogueRequirements` |
| `GuardedSlice10Services` | `GuardedCatalogueRequirementServices` |
| `UnguardedSlice10Services` | `UnguardedCatalogueRequirementServices` |
| local `slice10` (composition-root) | `catalogueRequirements` |

Out of scope, and said so in the PR: `tests/helpers/slice10.ts` and the ~50 test files importing it, and the dated plans under `docs/superpowers/plans/` (history records name the file as it was).

- [ ] **Step 1: Rename the files**

```bash
git mv src/plugin/slice10Composition.ts src/plugin/catalogueRequirementComposition.ts
git mv tests/plugin/slice10CascadeWiring.test.ts tests/plugin/catalogueRequirementCascadeWiring.test.ts
```

- [ ] **Step 2: Rename the identifiers**

Apply the table with the editor's rename-symbol where available, otherwise per file. Then:

Run: `git grep -n -E "composeSlice10|Slice10Wiring|guardSlice10|Slice10Services|slice10Composition" -- src tests vitest.config.ts`
Expected: no output.

- [ ] **Step 3: Rewrite the prose that named the slice**

- The module docblock opens: "The asset catalogue and material requirement composition — commands, queries and cascade handlers — lifted out of `composition-root.ts` when that file reached its 400-line cap." Keep the rest of the reasoning.
- `composeCatalogueRequirements`' docblock: "The catalogue and requirement write side, read side and cascade handlers, composed as ONE block…".
- `composition-root.ts`'s `composeCatalogueRequirementWiring` docblock: "The requirement lock set, the `RecalculateRequirementCommand`…".
- Comments in `guardedServices.ts`, `guardedAssetLibrary.ts`, `guardedAssetPrice.ts`, `notify.ts`, `DeleteRequirement.ts` and `vitest.config.ts` that cite the file or the functions by name: use the new names; a "slice 10" that dates a decision may stay.

- [ ] **Step 4: Run**

Run: `npx vue-tsc --noEmit`, then `npm run check:fast -- tests/plugin tests/application/reference`, then `npx fallow`
Expected: no errors; PASS; fallow clean.

- [ ] **Step 5: Commit**

```bash
git add -A src tests vitest.config.ts
git commit -m "plugin: name the catalogue and requirement composition after what it composes"
```

---

## Finish

- [ ] Run `npx fallow` and `npx vue-tsc --noEmit` once on the finished branch.
- [ ] Push the branch and open ONE pull request titled "Wall context records, Add submenu and construction materials", describing the four parts, the rename, the Task 13 screenshots, and the two out-of-scope items (`tests/helpers/slice10.ts`; the unrun manual case). Let CI run `npm run check`.

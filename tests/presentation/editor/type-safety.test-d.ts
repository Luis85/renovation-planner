import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';
import type { useSelectionStore, SelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import type { UseFormCommit } from '../../../src/presentation/composables/use-form-commit';
import type { UseFieldCommit } from '../../../src/presentation/composables/use-field-commit';
import type { EditorContext } from '../../../src/presentation/editor/tools/editor-context';
import type {
	DrawPolygonToolDeps,
	PolygonCompletion,
} from '../../../src/presentation/editor/tools/draw-polygon-tool';
import type { AppError } from '../../../src/core/errors/AppError';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createAssetId } from '../../../src/domain/asset/AssetId';

declare const screen: ScreenPoint;
declare const world: Point;
declare const zone: Zone;

// @ts-expect-error a screen pixel is not domain geometry
createPolygon([screen]);
createPolygon([world]);

// @ts-expect-error Zone.withGeometry consumes world-millimetre points, not screen pixels
zone.withGeometry({ points: [screen] });
zone.withGeometry({ points: [world] });

/**
 * `SelectionStore` is a hand-declared four-member interface rather than
 * `ReturnType<typeof useSelectionStore>`, so that `EditorContext.selection` cannot hand a
 * tool Pinia's `$patch`/`$dispose`. That narrowing is only safe while the real store still
 * SATISFIES the interface, and nothing at runtime can check a type — this is the check: a
 * store whose `selectedIds`, `select`, `clear` or `isSelected` drifted from the contract
 * would fail `vue-tsc --noEmit` in `npm run build`. It is an assignability check in one
 * direction only: the store may still have more members than the interface (it does —
 * Pinia adds them), which is exactly what the interface exists to keep out of a tool's
 * reach.
 */
declare function acceptsSelectionContract(selection: SelectionStore): void;
declare const liveSelectionStore: ReturnType<typeof useSelectionStore>;
acceptsSelectionContract(liveSelectionStore);

// Slice 16, Definition of Done item 10: the composable's state is read-only BY TYPE, so
// `setField` is the only write path. Both spellings are checked because they fail for
// different reasons — one is a property write through the ref, the other is what a template
// would do via unwrapping — and the shallow `Readonly<Ref<TInput>>` this slice started with
// permits both while looking like it forbids them.
declare const form: UseFormCommit<{ name: string }>;
// @ts-expect-error — a property write through the ref walks past setField.
form.values.value.name = 'x';
// @ts-expect-error — what `v-model="values.name"` compiles to.
form.values.value = { name: 'x' };
// Must still compile: reading is the component's whole job.
const readName: string = form.values.value.name;
void readName;

// The SAME item, on the other composable. Item 10 names both — "the same holds for
// `useFieldCommit`'s `draft` against `onInput`. Both spellings are checked on each" — and for
// two slices only `useFormCommit` had a fixture here, so half of the item was a claim about a
// type nothing asked the compiler about. `draft` is `DeepReadonly<Ref<T>>` for exactly the
// reason `values` is, and the two spellings fail for the same two different reasons.
//
// `T` is an OBJECT here rather than the `number | null` / `string` the real Inspector rows
// use, because a scalar `T` cannot express the first spelling at all — there is no property to
// write through. The parameterised type is what is being proven, so the fixture picks the
// argument that can carry both halves.
declare const field: UseFieldCommit<{ name: string }>;
// @ts-expect-error — a property write through the ref walks past onInput.
field.draft.value.name = 'x';
// @ts-expect-error — what `v-model="draft"` compiles to.
field.draft.value = { name: 'x' };
// Must still compile: reading is what a template binding does.
const readDraft: string = field.draft.value.name;
void readDraft;


/**
 * Design slice B2, first half: ONE `EditorContext` serves two subjects. `activePlan: { id:
 * PlanId, … }` was the single field of that facade naming a Plan, and `subject.id` is an
 * `EntityId<string>` precisely so a Plan and an Asset are both legal — which is a claim about
 * a TYPE and therefore has no runtime form at all.
 *
 * Both calls must compile. The third must not: widening a brand is what makes one context
 * serve two subjects, and accepting a bare `string` would give that up for nothing — the ids
 * this field carries come from `createEntityId`, never from user text.
 */
declare function acceptsSubject(subject: EditorContext['subject']): void;
acceptsSubject({ id: createPlanId(), calibration: null });
acceptsSubject({ id: createAssetId(), calibration: null });
// @ts-expect-error a subject is identified by a branded entity id, never by a bare string.
acceptsSubject({ id: 'plan-01JABC', calibration: null });

// The subject is READ-ONLY through the facade: a tool may not repoint the editor at another
// entity, which is `ToolManager`'s to do by re-assembling the context per activation.
declare const subject: EditorContext['subject'];
// @ts-expect-error a tool may not repoint the context at a different subject.
subject.id = createAssetId();
// @ts-expect-error nor swap the calibration under the tools that have already read it.
subject.calibration = null;

/**
 * Design slice B2, second half: what a closed polygon DOES is injected, so the tool's own
 * deps no longer name a Zone. The zone's name, its type and the plan it belongs to moved into
 * the `PolygonCompletion` that `runtime.ts` binds — this is what says they did not come back,
 * since an excess property on a deps literal is the only trace a re-added one would leave.
 */
declare const completion: PolygonCompletion;
declare const report: (error: AppError) => void;
const deps: DrawPolygonToolDeps = {
	completion,
	// @ts-expect-error `DrawPolygonToolDeps` names no Zone: a default name is the completion's.
	nextZoneName: () => 'Zone 1',
	reportRejected: report,
	reportInvalidInput: report,
};
void deps;

// A completion is handed the polygon `createPolygon` has already accepted, never the tool's
// raw vertex buffer — so it cannot build a command out of a shape the geometry rules refused.
declare const buffer: Point[];
// @ts-expect-error a raw vertex buffer is not a validated polygon.
completion.commandFor(buffer);
completion.commandFor({ points: buffer });

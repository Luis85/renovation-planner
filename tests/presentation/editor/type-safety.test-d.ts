import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';
import type { useSelectionStore, SelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import type { UseFormCommit } from '../../../src/presentation/composables/use-form-commit';
import type { UseFieldCommit } from '../../../src/presentation/composables/use-field-commit';

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

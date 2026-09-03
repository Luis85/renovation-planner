/**
 * `AssetLibraryContext.assetId`/`.expanded` are `DeepReadonly<Ref<T>>`, and the reason that
 * type rather than a bare `Ref<T>` is what this file proves — a runtime test cannot: nothing
 * observable differs at runtime between the two, since `DeepReadonly` is a type-level cast
 * `AssetLibraryView.mount` applies to the same writable ref it holds privately, never a
 * runtime `readonly()` wrapper. The claim is entirely about what the COMPILER refuses a
 * consumer that only ever sees the injected type.
 *
 * Same kind as `tests/presentation/editor/type-safety.test-d.ts`'s `UseFormCommit`/
 * `UseFieldCommit` fixtures, and for the reason that file states: the shallow
 * `Readonly<Ref<T>>` freezes `.value` as a PROPERTY and stops there, which is indistinguishable
 * from `DeepReadonly` for a primitive or a `readonly[]`-typed value — there is no nested
 * mutable property for the two to disagree about, unlike that file's OBJECT-shaped `T`. What
 * this file proves is the one write both members actually admit: a direct `.value = x`, which
 * is also what `v-model="context.assetId"` compiles to.
 *
 * Named directly in `.fallowrc.json`'s `entry` list, beside its six siblings — nothing imports
 * a `.test-d.ts` file and no npm script runs it; `vue-tsc -noEmit` compiles it because
 * `tsconfig.json`'s `include` is `tests/**\/*.ts`, and compiling is the whole point. An
 * unsatisfied `@ts-expect-error` is itself a build error, which is the mechanism.
 */
import type { AssetLibraryContext } from '../../../src/presentation/library/AssetLibraryContext';

declare const context: AssetLibraryContext;

// @ts-expect-error — `context.assetId` must refuse a write, which is what `v-model` compiles to.
context.assetId.value = 'tile-01';

// @ts-expect-error — `context.expanded` takes the identical shape.
context.expanded.value = ['material'];

// Must still compile: reading is what every consumer this context has needs to do.
const assetId: string = context.assetId.value;
const expanded: readonly string[] = context.expanded.value;
void assetId;
void expanded;

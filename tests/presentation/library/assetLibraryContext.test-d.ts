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
 * this file proves is the two writes a component could attempt: a direct `.value = x` (blocked
 * by `DeepReadonly`) and a reassignment of the member itself, `context.assetId = otherRef`
 * (blocked by the interface's own `readonly` modifier on the PROPERTY, one level up). The second
 * is the one worth naming explicitly: measured against `@vue/compiler-sfc`,
 * `v-model="context.assetId"` compiles to `(_ctx.context.assetId) = $event` — a write to the
 * PROPERTY, never to `.value` — so a consumer would have to write `v-model="context.assetId
 * .value"` to reach the `.value` write this file's first two directives cover. Both shapes are
 * refused, by different modifiers, and both need their own directive.
 *
 * Named directly in `.fallowrc.json`'s `entry` list, beside its seven siblings — nothing imports
 * a `.test-d.ts` file and no npm script runs it; `vue-tsc -noEmit` compiles it because
 * `tsconfig.json`'s `include` is `tests/**\/*.ts`, and compiling is the whole point. An
 * unsatisfied `@ts-expect-error` is itself a build error, which is the mechanism.
 */
import type { Ref } from 'vue';
import type { AssetLibraryContext } from '../../../src/presentation/library/AssetLibraryContext';

declare const context: AssetLibraryContext;
declare const otherAssetIdRef: Ref<string>;

// @ts-expect-error — `context.assetId.value` must refuse a write (the `DeepReadonly` shape).
context.assetId.value = 'tile-01';

// @ts-expect-error — `context.expanded.value` takes the identical shape.
context.expanded.value = ['material'];

// @ts-expect-error — `context.assetId` itself must refuse a write (the interface's own
// `readonly` on the property), which is the shape `v-model="context.assetId"` actually compiles
// to per the measurement above — a bare-member `v-model` binding is the one this refuses.
context.assetId = otherAssetIdRef;

// Must still compile: reading is what every consumer this context has needs to do.
const assetId: string = context.assetId.value;
const expanded: readonly string[] = context.expanded.value;
void assetId;
void expanded;

# AD04 — the accepted model extension

Contract revision `r1`. Written before the code, so the shape below is what AD05, AD08, AD10 and
AD11 build against rather than something each infers from whatever landed.

## 1. What the extension is, and what it deliberately is not

Three additions and nothing else: an **open** graphic beside the closed one, an optional **user
label** beside the stable semantic name, and **shallow groups** of graphic ids. C02's refusals
stand — no SVG path strings, no embedded HTML, no ellipses, no compound holes, no recursive symbol
instances.

## 2. An open graphic is a path, not a polygon with a gap

`CurvedPolygon` is closed by construction: its own comment says *"Closed boundary: bulge i describes
edge i→i+1, with implicit last→first closure"*, `createPolygon` demands three points, and
`validateBulges` requires exactly one bulge per POINT because the wrap edge is real. An open
polyline breaks all three, so it gets its own core type rather than a flag on that one:

```ts
// src/core/geometry/CurvedPath.ts
export interface CurvedPathInput {
	readonly points: readonly Point[];   // at least two, finite, with some length overall
	readonly bulges?: readonly number[]; // exactly points.length - 1, one per real edge
}
export interface CurvedPath extends CurvedPathInput { readonly [OPEN_PATH]: true } // §3
```

Same bulge vocabulary, same semicircle ceiling, same representable-radius rule — the per-edge
checks are shared with `validateBulges` rather than copied, because two copies of an arc rule is
the clone family `npm run analyze` would report and the pair that would drift.

What a path does **not** get: an area rule, a closure edge, and the simple-boundary test. A path
may touch itself; nothing computes its interior.

## 3. `AssetDetail` becomes a union with a `kind`

```ts
export type AssetDetail = ClosedDetail | OpenDetail;

interface DetailBase { readonly id: string; readonly name: string; readonly label?: string; readonly line: DetailLine; readonly pending: boolean }
export interface ClosedDetail extends DetailBase { readonly kind?: 'closed'; readonly outline: CurvedPolygon }
export interface OpenDetail   extends DetailBase { readonly kind: 'open';   readonly outline: CurvedPath }
```

**Amended while implementing, and the first version of this section is worth keeping as the
rejected alternative.** It said the geometry property would be RENAMED on the open arm (`path`), so
that an unnarrowed `detail.outline` read stopped compiling. That does deliver the guarantee — and
it was measured: it turned about seventy reads red across twenty test files, every one of them a
legitimate assertion about a closed graphic, for a property the type system can hold on its own.

What holds it instead is a **brand** on `CurvedPath` — a `unique symbol` its module declares and
never exports, the access lock `errorSurfacePolicy.ts`'s `Routed` already uses here. A path's
fields are structurally identical to a polygon's, so without the brand the two types are
interchangeable and the union buys nothing; with it, `CurvedPath` is not assignable to
`CurvedPolygon` and the reverse is not either, so the compiler refuses exactly the dangerous
operation — handing an open path to something that closes, measures or fills it — while `.points`
and `.bulges` stay readable on the union with no narrowing at all. The only way to hold a
`CurvedPath` is to have gone through `createCurvedPath`, which is also its validator.

`kind` is **optional on the closed arm and required on the open one**, for the same reason: every
literal written before AD04 stays a valid closed graphic, and `validateDetails` stamps
`kind: 'closed'` onto everything it returns, so a validated shape always carries the discriminant
and persistence never guesses. The cost is stated where the type is: a construction site could omit
`kind` and mean open — which nothing can do until AD11, and which becomes a missing REQUIRED field
on the other arm the day something can.

`name` stays the stable semantic key (`seat`, `bowl`) that presets and tests address. `label` is the
user's own words, optional, absent by default, and **never** written over `name` — C02.

`line` keeps its meaning for both kinds with one addition C10 already requires: an open graphic is a
STROKE and is never filled, whatever its `line` says. `solid`/`dashed` on an open path is the dash
pattern alone.

**What the union cost in `src/`, all of it mechanical and all of it deliberate**: `outlineOf` in
`shapeEdits.ts` answers `null` for an open graphic, so every outline gesture — the vertex drag, the
bend, the numeric box, the fit — stays closed-only until AD11 builds the open ones, and a caller
gets the same `part-not-found` it already had for a part that is not there. `mapDetailOutline`
narrows once for the four transforms that must keep a graphic's kind while moving its points (scale,
move, calibrate, duplicate), because TypeScript cannot correlate an object spread with a union.

## 4. Groups

```ts
export interface AssetGroup { readonly id: string; readonly label?: string; readonly members: readonly string[] }
// on AssetShape:  readonly groups: readonly AssetGroup[];
```

Validation refuses rather than repairs (C06): an empty or duplicate group id, a member id no detail
carries, a detail in two groups, a duplicate member inside one group, and an empty membership.
Groups hold **detail ids only** — never the footprint, the clearance, the anchor, the facing or
another group. Membership is editing metadata: it carries no z-order and no coordinates, and
`details` remains the one canonical draw order.

## 5. Schema 3

`AssetGeometrySchemaV3`, since this checkout read v1/v2 and emitted v2 with no v3 allocated.
`assetGeometry.test.ts`'s "refuses a version this build does not know" asserted 3; it asserts 4 now,
which is the case moving with the version rather than being deleted.

- `DetailSchemaV3` = v2's fields plus `kind` (default `'closed'`) and optional `label`, as a union on
  `kind`: the closed arm keeps `outline` with `min(3)` and `oneBulgePerEdge`, the open arm takes an
  `outline` of `min(2)` points with one bulge per SEGMENT.
- `AssetShapeSchemaV3` adds `groups`, defaulting to `[]`.
- `raiseVersion1` becomes `raiseLegacyVersions`: a v1 OR v2 document is a valid v3 one once it says
  so, because every added field defaults and `kind` defaults to the only kind either could express.
- The store emits from one `SCHEMA_VERSION` constant. It was two literal `2`s in two functions, and
  a bump had to remember both.

**Why the bump is required rather than tidy**, in the words the file already uses for v2: a Zod
object strips unknown keys, so a v2-only build reading a v3 file would load it and erase the groups
and every open graphic on its next write. `z.literal(2)` makes that build refuse the file instead.

Defaults apply to ABSENT fields only. A `kind` present and outside the union, a `groups` that is not
an array, a `label` that is not a string — each fails the read rather than being coerced, which is
`footprintPending`'s rule generalised: refuse, do not repair.

## 6. What AD04 owes its consumers

`AssetDetail`'s importers are few — `AssetShape`, `detailEdits`, `presetGeometry`, `assetPlacement`,
`DesignerSelectionInspector` — but `AssetShape`'s are 54, and the designer's selection, hit-testing,
snapping and layer modules all read `details[].outline`. AD04 makes every one of them narrow
explicitly; it does not make any of them DRAW an open path well. That is AD05, and no authoring tool
for an open graphic is exposed before it (criterion 7, and C12's rule against a control that does
nothing).

Until AD11, nothing in the product can create an open detail or a group. The model, the validators,
the schema and the migration land first and are exercised by fixtures — which is the order the card
asks for, and the reason this file exists before the code.

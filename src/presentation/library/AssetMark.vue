<!--
	The row's leading mark: the asset's own footprint, drawn from Task 6's `AssetOutline`,
	fitted to a 20px box at its true aspect ratio (design "Asset library overview" §3.4).

	Ported from `src/prototypes/AssetMark.vue`. What changed from the prototype and why:
	- Reads an `AssetOutline | null` (Task 6's query answer, `null` for §3.4's fifth state,
	  "not yet read") rather than a `CatalogueAsset` fixture — the prototype read a mock's
	  `shape`/`outline` pair directly, and `AssetOutline`'s own four-member union plus the
	  `null` the query cannot itself answer is where the mapping to §3.4's five states lives.
	- Dropped the `selected` prop and its `.rp-al-mark--on` styling. The prototype recoloured
	  the mark when its row was selected; this task's own contract for this component carries
	  no `selected` prop, and §3.3 makes selection a fact of the ROW alone — a leading
	  box-shadow rule plus `aria-current` (see `AssetRow.vue`) — never of the geometry mark,
	  which already carries five states of its own and should not carry a sixth axis of
	  colour on top of them.
	- `markPath`'s fitting arithmetic is inlined and reads `points`/`extent` off the outline
	  directly, rather than re-deriving a bounding box from a fixture's raw points the way
	  `src/prototypes/assetLibraryFixture.ts`'s `markPath` did — `AssetOutline.extent` is
	  already the guarded, finite `Dimensions` `ListAssetOutlines` computed (it refuses a
	  non-finite span as `refused` before this component ever sees it), so only the bounding
	  box's MINIMUM corner is still needed here, to place each point relative to it.

	`aria-hidden`, always: the shape's state and extent are carried in words by the row's own
	hidden span (`AssetRow.vue`), never by this drawing — a drawn outline that is the only
	statement of a fact would be the colour-alone failure this mark exists to avoid, in a
	different medium.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { Point } from '../../core/geometry/Point';

/**
 * The task brief's own "Produces" line also named an `ordinal` prop here. It was dropped
 * (Task 12 review round 1): nothing in §3.4 asks the DRAWING to vary by a row's position — the
 * row's own hidden description span is what is minted from the ordinal (§3.4's own rule), and
 * that span belongs to `AssetRow.vue`, never to this `aria-hidden` element, which carries no
 * meaning for an id to describe. A REQUIRED prop every caller must supply and nothing reads is
 * worse than a corrected line in a brief.
 */
const props = defineProps<{
	outline: AssetOutline | null;
}>();

/** §3.4's fifth state — `null` meaning "the query has not answered for this asset yet". */
type MarkKind = 'measured' | 'unscaled' | 'none' | 'pending' | 'unreadable';

const kind = computed((): MarkKind => {
	const outline = props.outline;
	if (outline === null) return 'pending';
	if (outline.kind === 'refused') return 'unreadable';
	return outline.kind;
});

/**
 * A polygon's bounding-box MINIMUM, scanned rather than spread. `Math.min(...xs)` passes
 * every coordinate as a function argument and V8 overflows the call stack around 125,000 of
 * them — a hazard `boundsOf` in `src/prototypes/assetLibraryFixture.ts` already carries a
 * comment about, and nothing here bounds a vertex count either. Only the minimum corner is
 * needed: `AssetOutline.extent` already carries the width and depth this fit divides by.
 */
function minimumOf(points: readonly Point[]): { readonly x: number; readonly y: number } {
	let minX = Infinity;
	let minY = Infinity;
	for (const point of points) {
		if (point.x < minX) minX = point.x;
		if (point.y < minY) minY = point.y;
	}
	return { x: minX, y: minY };
}

const BOX_SIZE = 20;
const INSET = 2;

/**
 * The fitted outline, as an SVG path — aspect ratio preserved, exactly as the prototype's
 * `markPath` derived it, ported to read the two fields `AssetOutline` already guarantees are
 * finite rather than re-deriving them from the raw points a second time.
 *
 * Both ends of the extent are guarded, as the prototype's own comment records: a zero width
 * or depth divides to `Infinity` rather than by zero, and an overall non-finite scale (which
 * `AssetOutline` should never hand this component, since `ListAssetOutlines` refuses that
 * case as `refused` before answering `measured`/`unscaled` at all) draws nothing rather than
 * a malformed path full of `NaN`.
 */
const path = computed((): string => {
	const outline = props.outline;
	// A TYPE-NARROWING guard rather than a runtime one, and coverage says so: the template
	// reads `:d="path"` only under `v-if="kind === 'measured' || kind === 'unscaled'"`, so this
	// branch is unreachable from any mount and costs the one uncovered statement/branch this
	// file has. It stays because `outline.extent` below does not exist on the `none`/`refused`
	// members, and `computed` has no narrower signature to ask for instead.
	if (outline === null || (outline.kind !== 'measured' && outline.kind !== 'unscaled')) return '';

	const { width, depth } = outline.extent;
	const span = BOX_SIZE - INSET * 2;
	// The design fixture fits raw points; the production mark consumes validated extents. Keep the prototype independent.
	// fallow-ignore-next-line code-duplication
	const scales = [width > 0 ? span / width : Infinity, depth > 0 ? span / depth : Infinity];
	const scale = Math.min(...scales);
	if (!Number.isFinite(scale)) return '';

	const { x: minX, y: minY } = minimumOf(outline.points);
	const left = INSET + (span - width * scale) / 2;
	const top = INSET + (span - depth * scale) / 2;
	const place = (point: Point): string =>
		`${(left + (point.x - minX) * scale).toFixed(2)} ${(top + (point.y - minY) * scale).toFixed(2)}`;
	return `M${outline.points.map(place).join(' L')} Z`;
});
</script>

<template>
	<svg
		class="rp-al-mark"
		:class="`rp-al-mark--${kind}`"
		viewBox="0 0 20 20"
		aria-hidden="true"
	>
		<path
			v-if="kind === 'measured' || kind === 'unscaled'"
			:d="path"
		/>
		<circle
			v-for="x in (kind === 'pending' ? [5, 10, 15] : [])"
			:key="x"
			class="rp-al-mark__dot"
			:cx="x"
			cy="10"
			r="1.1"
		/>
		<template v-if="kind === 'unreadable'">
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
			/>
			<path d="M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5" />
		</template>
	</svg>
</template>

<!--
	The asset library's inspector: how one catalogue entry is defined, what shape it has, and
	which projects lean on it.

	A region of its own rather than markup inside `AssetLibrary.vue`, for the reason
	`src/prototypes/README.md` gives and this repository has already paid for once: `max-lines`
	is 400 and the shell crossed it at 463 with this panel inline. The seam is a real one — the
	inspector is the surface's second pane and the one that replaces the first below 35rem — so
	the split is where the screen already bends.

	**The definition list is deliberately the vocabulary the other two surfaces already use.**
	`.rp-editor-inspector-fields` and `.rp-designer-inspector-fields` are both a two-column grid
	of `<dt class="rp-al-fields__key">`/`<dd class="rp-al-fields__value">`; a user moving between the Plan editor, the Asset designer and this must not
	be able to tell that three people wrote them.

	**Read-only, on purpose.** The promoted component commits these fields on blur through
	`useFieldCommit` against the real `UpdateAsset` and `SetAssetHeight`, both of which already
	exist — so the maintenance job needs no new command, only this surface. Mocking the commit
	would mock the one part that is not in question.

	`Used in` is loaded per SELECTION in the specification, never per row: the query behind it
	reads every requirement in every project, so a column would make opening the library
	O(requirements). What that costs is that "which of these is unused" cannot be scanned — it
	has to be asked asset by asset, which is exactly what this panel is.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ASSETS, type CatalogueAsset } from './assetLibraryFixture';
import { shapeAnswered, shapeClearance, shapeDimensions, shapeNotes } from './assetShapeFields';
import { priceOf } from './assetPrice';

/**
 * Defaulted for the same reason `AssetShelf.vue` is: the harness index mounts an entry bare, and
 * a region that needs a parent to exist is a region nobody looks at. The default is a real asset
 * rather than `null` because the resting line is the LESS informative of the two states, and a
 * specimen should open on what it is for. `null` still reaches it from the shell — a default
 * applies to an absent prop, never to an explicit `null`.
 */
const props = withDefaults(defineProps<{
	asset?: CatalogueAsset | null;
	/**
	 * "Give the pane back", asked by the shell rather than decided here. Below 35rem this panel
	 * IS the pane, so while a search is running it has to withdraw or the shelves it is meant to
	 * yield to draw underneath it. The selection is deliberately not cleared to achieve that: a
	 * user clearing the search field should find the panel they were reading, not an empty rail.
	 */
	withdraw?: boolean;
}>(), {
	asset: () => ASSETS[0] as CatalogueAsset,
	withdraw: false,
});

/**
 * The Shape section's four derivations, bound to this panel's own asset.
 *
 * Thin wrappers rather than logic: the rules live in `assetShapeFields.ts`, which takes a
 * `CatalogueAsset` and knows nothing about props or `computed`. That is what lets each of them
 * be read — and argued about — without the template around it.
 */
const dimensions = computed(() => shapeDimensions(props.asset));
const clearance = computed(() => shapeClearance(props.asset));
const answered = computed(() => shapeAnswered(props.asset));
const shapeWarnings = computed(() => shapeNotes(props.asset));

/** The row's rule, SHARED with it now rather than written out a second time — `assetPrice.ts`. */
const price = computed((): string => (props.asset === null ? '' : priceOf(props.asset)));
defineEmits<{ back: [] }>();

/**
 * The spec sheet's own name, from the reference's path.
 *
 * §3.5's Shape inventory asks for the file's NAME and the row is omitted when there is none —
 * so the basename is the whole of what this computes, and the `page` a PDF reference carries is
 * deliberately dropped. That page is what the Asset designer needs to open the right sheet;
 * printing it in a definition list would be inventing a row the inventory does not ask for.
 *
 * `split('/')` rather than a path helper: an Obsidian vault path is `/`-separated on every
 * platform, which is the one thing `normalizePath` guarantees about it.
 */
const specSheet = computed((): string | null => {
	const path = props.asset?.background?.path;
	if (path === undefined) return null;
	return path.split('/').at(-1) ?? path;
});


</script>

<template>
	<aside
		class="rp-al-inspector"
		:class="{ 'rp-al-inspector--rest': asset === null || withdraw }"
	>
		<button
			type="button"
			class="rp-al-inspector__back"
			@click="$emit('back')"
		>
			Back to library
		</button>
		<p
			v-if="asset === null"
			class="rp-al-inspector__rest"
		>
			Select an asset to see how it is defined and where it is used.
		</p>
		<template v-else>
			<h3 class="rp-al-inspector__name">
				{{ asset.name }}
			</h3>
			<dl class="rp-al-fields">
				<dt class="rp-al-fields__key">
					Category
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.category }}
				</dd>
				<dt class="rp-al-fields__key">
					Unit
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.unit }}
				</dd>
				<dt class="rp-al-fields__key">
					Unit cost
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ price }}
				</dd>
				<dt class="rp-al-fields__key">
					Waste
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ asset.waste ?? 'none' }}
				</dd>
				<dt class="rp-al-fields__key">
					Supplier
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.supplier ?? '—' }}
				</dd>
				<dt class="rp-al-fields__key">
					SKU
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.sku ?? '—' }}
				</dd>
				<template v-if="asset.heightMm !== null">
					<dt class="rp-al-fields__key">
						Height
					</dt>
					<dd class="rp-al-fields__value rp-al-fields__num">
						{{ asset.heightMm }} mm
					</dd>
				</template>
			</dl>
			<p
				v-if="asset.notes !== null"
				class="rp-al-note"
			>
				{{ asset.notes }}
			</p>

			<h4 class="rp-al-inspector__title">
				Shape
			</h4>
			<dl class="rp-al-fields">
				<template v-if="answered">
					<template v-if="dimensions !== null">
						<dt class="rp-al-fields__key">
							Footprint
						</dt>
						<dd class="rp-al-fields__value rp-al-fields__num">
							{{ dimensions }}
						</dd>
					</template>
					<dt class="rp-al-fields__key">
						Clearance
					</dt>
					<dd class="rp-al-fields__value rp-al-fields__num">
						{{ clearance }}
					</dd>
				</template>
				<template v-if="specSheet !== null">
					<dt class="rp-al-fields__key">
						Spec sheet
					</dt>
					<dd class="rp-al-fields__value">
						{{ specSheet }}
					</dd>
				</template>
			</dl>
			<p
				v-for="note in shapeWarnings"
				:key="note"
				class="rp-al-note"
			>
				{{ note }}
			</p>

			<h4 class="rp-al-inspector__title">
				Used in
			</h4>
			<ul
				v-if="asset.usedIn.length > 0"
				class="rp-al-used"
			>
				<li
					v-for="use in asset.usedIn"
					:key="use.projectId"
					class="rp-al-used__row"
				>
					<span class="rp-al-used__project">
						{{ use.project }}
						<span
							v-if="use.path !== undefined"
							class="rp-al-used__path"
						>{{ use.path === '' ? 'vault root' : use.path }}</span>
					</span>
					<span class="rp-al-used__count">{{ use.requirements }}</span>
				</li>
			</ul>
			<p
				v-else
				class="rp-al-note"
			>
				Not used in any project.
			</p>

			<div class="rp-al-actions">
				<!--
					Withdrawn when the sidecar refused: the designer hydrates through the same
					`GetAssetDesign`, reaches the same `failed` state and offers only a Retry, so
					the button would send the user to a screen repeating the refusal they are
					already reading. §3.5's own table, drawn rather than only specified.
				-->
				<button
					v-if="asset.shape !== 'unreadable'"
					type="button"
					class="rp-al-action"
				>
					Open designer
				</button>
				<button
					type="button"
					class="rp-al-action"
				>
					Open note
				</button>
			</div>
		</template>
	</aside>
</template>

<!--
	No `<style>` block, since Task 14 (`src/presentation/library/AssetInspector.vue` and its
	three sections): this mock's classes are declared in `styles/asset-library-inspector.css`
	now, which the harness's assembled sheet loads the same as a shipped component's. A scoped
	block here would be a second, unreachable copy of those same rules, and
	`tests/build/prototype-styles.test.ts` refuses a mock declaring a class a real component
	uses — measured, it reported all twenty-six of them. `AssetShelf.vue` and `ZoneSummary.vue`,
	this tree's other fully-promoted mocks, carry none for the identical reason.
-->

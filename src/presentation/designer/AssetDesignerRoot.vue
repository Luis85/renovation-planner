<script setup lang="ts">
/**
 * The asset designer's Vue root — its shell regions, and the one component that hydrates
 * (design slice B3, ADR-0015).
 *
 * Hydration happens HERE rather than in `AssetDesignerView` so the view stays what it is: an
 * Obsidian lifecycle object that mounts an app. `PlanEditorRoot` draws the same line.
 *
 * **The four regions below are declared even where nothing fills them yet, and that is the
 * point of this file rather than an accident of ordering.** Task B4 builds `DesignerCanvas`,
 * Task B5 a toolbar and Task B8 `DesignerInspector`, and none of those tasks says "mount it" —
 * so on the plan as written each would ship a component, a passing suite of its own, and no
 * surface. That is this repository's recorded slice-7 defect exactly: a tool registered by
 * nothing, invisible to all four gates because nothing is wrong with the code.
 *
 * Two instruments hold it, and they catch DIFFERENT mistakes:
 *
 * - `tests/presentation/designer/regionsReachable.test.ts` walks the real import graph from
 *   `AssetDesignerView.ts` and requires every `.vue` file under `src/presentation/designer/` to
 *   be reachable from it. A component created and never mounted fails there, and so does one
 *   whose mount is later deleted. It is a check at the FORBIDDEN THING rather than a list of
 *   the places somebody thought of, so it holds for components not yet written.
 * - `assetDesignerRoot.test.ts` asserts the region elements themselves, so a region dropped
 *   while its component survives elsewhere in the tree is red too.
 *
 * Named slots were the obvious alternative and are worse: the only thing that mounts this root
 * is `AssetDesignerView`, which is also a Task B3 file, so a slot moves the forgetting one
 * level up and leaves it unchecked. A registry the root iterates has the same hole — nothing
 * makes a later task add its entry.
 */
import { computed, onMounted, shallowRef } from 'vue';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import { isErr } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import SaveStateIndicator from '../editor/save-state/SaveStateIndicator.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { selectAssetDesignerEmptyState } from '../emptyStates/selectors';
import { useAssetDesignerContext } from './AssetDesignerContext';

const context = useAssetDesignerContext();

/**
 * The design this leaf is drawing, and why it has no store yet.
 *
 * Task B3a owns `AssetDesignStore` and the per-leaf dispatcher that re-reads after every
 * committed command — which is what makes a WRITE visible. This is the read that has to exist
 * before then, because without it the empty state below has nothing to be a function of, and an
 * empty state nothing can select is the very defect this file's header is about. B3a replaces
 * these two refs with the store; there is one hydrate routine either way, so it is a move
 * rather than a second answer to what the canvas is showing.
 */
const design = shallowRef<AssetDesignDto | null>(null);
const error = shallowRef<AppError | null>(null);

async function hydrate(): Promise<void> {
	const result = await context.queries.getAssetDesign(context.assetId);
	if (isErr(result)) {
		design.value = null;
		error.value = result.error;
		return;
	}
	design.value = result.value;
	error.value = null;
}

/**
 * The overlay's props, or `null` for none. An OVERLAY inside the canvas region and never a
 * replacement for it — slice 14's rule, which matters here for the reason it matters on a plan:
 * the region exists to show the object being drawn, so a panel taking its place would hide the
 * one thing both exist for.
 *
 * There is no `@action` handler and no `activeToolId` gate, and both absences are decisions.
 * Neither designer entry carries a label today (see `EMPTY_STATE_CONTENT.assetDesigner`), so
 * `EmptyState` renders no button and there is nothing to handle; and the tool framework arrives
 * with Task B5, so there is no active tool for an overlay to yield to. Task B5 adds that gate
 * where `PlanEditorRoot` keeps it — here, as a rendering rule, never inside the selector.
 */
const overlay = computed(() => {
	const current = design.value;
	if (current === null) return null;
	const key = selectAssetDesignerEmptyState(current);
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.assetDesigner[key]);
});

/**
 * The read replaced by the reason it has none.
 *
 * `trError` for the body rather than one fixed sentence, so unrecovered settings, a vault fault
 * and an asset that is gone each say their own thing — the defect slice 11 fixed on the project
 * surface and slice 17 carried to the editor.
 *
 * The retry is withheld from a bootstrap failure alone, through the same
 * `viewHydrationOrigin`/`surfaceFor` pair both other views ask: `settings.unrecovered` means the
 * composition root wired no query service at all, so re-running one does nothing while looking
 * like it might.
 *
 * **There is deliberately no close-the-tab action, and it is not an oversight.** Slice 17 gives
 * the Plan Editor one because `GetPlan` answers `ok(null)` for a plan that is gone — a SUCCEEDED
 * read reporting an absence, structurally distinct from a failure. `GetAssetDesign` refuses an
 * absent asset with a coded `ReferenceError` instead, so the designer has no such arm to branch
 * on, and inventing one means deciding whether `asset.not-found` is dangling or merely failed.
 * ADR-0015's Consequences record that as Task B9's, which is where a leaf restored onto a
 * deleted asset first becomes an ordinary thing rather than a hypothetical.
 */
const failure = computed(() => {
	const failed = error.value;
	if (failed === null) return null;
	const session = surfaceFor(failed, viewHydrationOrigin(failed)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'designer.asset-failed.headline'),
		body: trError(failed),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

onMounted(() => {
	void hydrate();
});
</script>

<template>
	<div class="renovation-asset-designer">
		<!-- Task B5 mounts the designer's toolbar here. -->
		<div class="rp-designer-toolbar" />
		<div class="rp-designer-body">
			<!--
				Task B4 mounts `DesignerCanvas` here. The region is ALWAYS drawn — the empty
				state, the failure state and the loading line all live inside it rather than in
				place of it, which is what keeps `EmptyState`'s `overlay` modifier meaning what
				it means on a plan.
			-->
			<div class="rp-designer-canvas">
				<ViewFailure
					v-if="failure !== null"
					v-bind="failure"
					@action="() => void hydrate()"
				/>
				<EmptyState
					v-else-if="overlay !== null"
					v-bind="overlay"
					overlay
				/>
				<p
					v-else-if="design === null"
					class="rp-designer-message"
				>
					{{ tr('designer.loading') }}
				</p>
			</div>
			<!-- Task B8 mounts `DesignerInspector` here. -->
			<div class="rp-designer-inspector" />
		</div>
		<div class="rp-designer-status">
			<SaveStateIndicator />
		</div>
		<!--
			Last child, and a sibling of the regions rather than nested in one: the host makes
			its parent's OTHER children inert while a dialog is open, so every region has to be
			a sibling of it for the background to actually go inert.
		-->
		<DialogHost />
	</div>
</template>

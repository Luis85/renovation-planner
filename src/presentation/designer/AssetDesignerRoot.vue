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
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import SaveStateIndicator from '../editor/save-state/SaveStateIndicator.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { selectAssetDesignerEmptyState } from '../emptyStates/selectors';
import { useAssetDesignerContext } from './AssetDesignerContext';
import { provideDesignerRuntime } from './runtime';
import { useAssetDesignStore } from './stores/assetDesignStore';

const context = useAssetDesignerContext();

/**
 * The leaf's live machinery (Task B3a), provided here so the regions later tasks mount can
 * inject it. The return value is used immediately: `runtime.hydrate` is THE read — the mount,
 * the retry below, and the cross-leaf subscription the runtime itself disposes all go through
 * one routine rather than three spellings of it.
 */
const runtime = provideDesignerRuntime(context);
const { design, error, status, stale } = storeToRefs(useAssetDesignStore());

/**
 * The canvas is drawing a design it can no longer confirm.
 *
 * A post-command read-back reads with `keepPreviousOnFailure`, which deliberately keeps
 * `status === 'ready'` and the previous design when the read fails. Nothing rendered that, so
 * the write succeeded, the indicator said Saved, and the canvas silently showed pre-command
 * geometry. `'ready'` is the whole point of the guard: any other status is already replaced by
 * the failure state, and this exists only for the case where there IS content to keep showing.
 */
const staleAfterRefresh = computed(() => status.value === 'ready' && stale.value);

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
	// `status` and not `error` alone: a keep-on-failure refresh sets `error` beside content that
	// is still real and still drawn, and replacing the canvas with a failure panel there would
	// hide a design the user can go on working on in order to report a read that failed. That
	// case is `staleAfterRefresh` above.
	if (status.value !== 'failed' || failed === null) return null;
	const session = surfaceFor(failed, viewHydrationOrigin(failed)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'designer.asset-failed.headline'),
		body: trError(failed),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

onMounted(() => {
	void runtime.hydrate();
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
					@action="() => void runtime.hydrate()"
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
		<p
			v-if="staleAfterRefresh"
			class="rp-designer-notice"
			role="status"
		>
			{{ tr('designer.refresh-failed') }}
		</p>
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

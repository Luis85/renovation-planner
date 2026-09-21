<script setup lang="ts">
/**
 * The asset designer's Vue root — its shell regions, and the one component that hydrates
 * (design slice B3, ADR-0015).
 *
 * Hydration happens HERE rather than in `AssetDesignerView` so the view stays what it is: an
 * Obsidian lifecycle object that mounts an app. `PlanEditorRoot` draws the same line.
 *
 * **The four regions below are declared even where nothing fills them yet, and that was the
 * point of this file rather than an accident of ordering.** Task B4 built `DesignerCanvas`,
 * Task B5 a toolbar and Task B8 `DesignerInspector`, and none of those tasks by itself says
 * "mount it" — so on the plan as written each would have shipped a component, a passing suite
 * of its own, and no surface. That is this repository's recorded slice-7 defect exactly: a tool
 * registered by nothing, invisible to all four gates because nothing is wrong with the code.
 * All three are mounted below now, each in the task that built it plus this one.
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
import { computed, markRaw, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import DialogHost from '../dialogs/DialogHost.vue';
import { useDialogStore } from '../dialogs/dialog-store';
import type { AssetShape } from '../../domain/asset/AssetShape';
import { scaleDesignToDimensions } from '../../domain/asset/shapeEdits';
import { notifyIfRefused } from '../editor/report-failure';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState, type EmptyStateProps } from '../emptyStates/resolve';
import { selectAssetDesignerEmptyState } from '../emptyStates/selectors';
import { constrainsAngle } from '../editor/snapping/editorSnapping';
import type { BackgroundStatus } from '../editor/layers/background/BackgroundRenderModel';
import type { StringKey } from '../i18n/locales/en';
import { isOpenGraphicSelection, isOutlineSelection } from './selection/designerSelection';
import { useAssetDesignerContext } from './AssetDesignerContext';
import { provideDesignerRuntime } from './runtime';
import { isMissingAsset, useAssetDesignStore } from './stores/assetDesignStore';
import { designerShortcut, selectionKeyActions } from './designerKeys';
import DesignerCanvas from './DesignerCanvas.vue';
import DesignerHeader from './DesignerHeader.vue';
import DesignerToolbar from './DesignerToolbar.vue';
import DesignerInspector from './inspector/DesignerInspector.vue';
import DesignerAddPanel from './DesignerAddPanel.vue';
import DesignerPartsPanel from './parts/DesignerPartsPanel.vue';
import DesignerEntryPaths from './DesignerEntryPaths.vue';
import AssetPresetForm from './presets/AssetPresetForm.vue';
import { useViewPreferences } from '../editor/shell/useViewPreferences';
import { STAGE_PIXELS, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { designerGrid } from './grid/designerGrid';

const context = useAssetDesignerContext();
const dialogs = useDialogStore();
useViewPreferences(context.viewPreferences);
const workspace = useWorkspaceStore(), editorStore = useEditorStore();

/**
 * The leaf's live machinery (Task B3a), provided here so the regions later tasks mount can
 * inject it. The return value is used immediately: `runtime.hydrate` is THE read — the mount,
 * the retry below, and the cross-leaf subscription the runtime itself disposes all go through
 * one routine rather than three spellings of it.
 */
const runtime = provideDesignerRuntime(context);
const designStore = useAssetDesignStore();
const { design, error, status, stale, selection, selected } = storeToRefs(designStore);

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
 * What became of the spec sheet this asset names — the plan editor's own
 * `backgroundStatus` seam, mounted here for the same reason it exists there.
 *
 * A picked background whose file has since been deleted or cannot be decoded draws NOTHING,
 * and the empty state above it has already stood down (`selectAssetDesignerEmptyState` answers
 * `noShape` the moment a reference exists, whatever became of the file). So without this the
 * user is invited to trace an outline over a blank canvas with nothing anywhere saying why the
 * sheet is not there — a silent wrong picture, which is the failure mode this repository
 * refuses. It is a NOTICE and not a failure state, because the asset itself read perfectly
 * well and everything else on this surface still works.
 */
const backgroundStatus = ref<BackgroundStatus>('none');

/**
 * The overlay's props, or `null` for none. An OVERLAY inside the canvas region and never a
 * replacement for it — slice 14's rule, which matters here for the reason it matters on a plan:
 * the region exists to show the object being drawn, so a panel taking its place would hide the
 * one thing both exist for.
 *
 * **TWO gates answering different questions**, exactly as `PlanEditorRoot` keeps them.
 * `selectAssetDesignerEmptyState` is "is this asset legitimately undrawn", decided from an
 * already-succeeded query result alone; `activeToolId` is "is the user mid-task", and it is
 * checked HERE rather than folded into the selector because it is a RENDERING rule — folding it
 * in would make "which state is this asset in" unanswerable without a live `ToolManager`, and a
 * node test could no longer ask it.
 *
 * **The gate arrived one task late and the account is worth keeping.** This docblock used to
 * record its absence as a decision — "the tool framework arrives with Task B5, so there is no
 * active tool for an overlay to yield to. Task B5 adds that gate where `PlanEditorRoot` keeps
 * it" — and Task B5 shipped the tools without it, while the line above this one was already
 * reading `runtime.activeToolId.value` for the Shift hint. A trigger stated in prose fires with
 * nothing to notice it, which is this repository's own recurring shape.
 *
 * It is worse on this surface than on a plan, which is why it is not merely a consistency fix:
 * the designer's gesture layer draws the vertices and the close target now, and an opaque
 * centred card over them would hide exactly the picture a user mid-gesture is steering by.
 *
 * **Both entries carry an `@action` handler now.** Task B7 gave `noBackground` its picker;
 * Task B8 gives `noShape` its dimensions dialog — see `onEmptyStateAction` and `editDimensions`
 * below, and `EMPTY_STATE_CONTENT.assetDesigner.noShape`'s own docblock for the history.
 */
/**
 * What Shift does right now, or `null` when it does nothing. A tool that takes the angle constraint is
 * asked of the ONE list that holds that question (`editor/snapping/editorSnapping.ts`), which `StatusBar`
 * asks for the plan editor.
 *
 * **Select is answered HERE and never added to that list** (spec Amendment 2): `select` is the plan
 * editor's id too, and its status bar pins no constrain hint under Select. Under the designer's Select,
 * Shift is read only by `draggedShape`: a Transform box handle keeps proportions and its rotate handle
 * snaps, and a facing drag snaps its bearing in any mode. A body, vertex, bend or anchor drag ignores it, so
 * Edit points, Bend edges, the anchor and no selection say nothing — the modes' own gestures are named in
 * their buttons' tooltips (`DesignerSelectionModes.vue`), not here.
 *
 * A modifier is invisible: no control shows it and no menu lists it, which is the standing cost
 * of the convention every drawing tool in the field uses. This is the cheapest honest
 * mitigation — present while the gesture it applies to is available, gone the moment it is not.
 *
 * It sits in the status region rather than in the toolbar for `StatusBar`'s reason: the toolbar
 * says what you can DO, and this says what is true of the thing you are doing.
 */
const hintKey = computed<StringKey | null>(() => {
	const id = runtime.activeToolId.value;
	if (constrainsAngle(id)) return 'editor.hint.constrain-angle';
	if (id !== 'select') return null;
	const focused = selection.value;
	if (focused?.kind === 'facing') return 'editor.hint.constrain-angle';
	// An OPEN graphic is an outline selection and has no handles, so it is excluded here for the
	// reason `DesignerSelectionModes` drops two of its buttons: this hint promises that Shift keeps
	// proportions and snaps the rotation, and a path offers neither — it has no box handle to
	// constrain and no rotate handle to snap. Advertising a modifier that cannot act is the same
	// defect as drawing a button that cannot, one surface over.
	if (isOpenGraphicSelection(design.value?.shape, focused)) return null;
	return isOutlineSelection(focused) && designStore.mode === 'transform' ? 'designer.hint.shift-transform' : null;
});

/**
 * The grid's step for the status row while the grid is shown (snapping spec §2.6), from the SAME `designerGrid` the
 * canvas draws and snaps with. Nothing while the footprint is unscaled: a step there is not a measurement, and a
 * number that is not one is not given a unit ("Read and correct an object's dimensions", criterion 6).
 */
const gridStep = computed<number | null>(() => {
	const current = design.value;
	if (!workspace.gridVisible || current === null || current.dimensionsUnscaled) return null;
	return designerGrid(current.shape, worldPerScreenPixel(editorStore.viewport, STAGE_PIXELS)).step;
});

/**
 * The camera's scale for the status row, from the SAME `editorStore.viewport` the canvas draws with
 * and `gridStep` above already reads.
 *
 * **Whole percent**, exactly as `StatusBar`'s own `zoomPercent` does it for the Plan Editor, and for
 * that file's stated reason: a readout that jitters in its last digit is one people stop reading.
 *
 * Gated on `design !== null` at the template rather than here, which is the same gate the Inspector
 * region takes — a scale stated over a leaf that is loading or failed is a fact about nothing, and
 * `AssetDesignStore.fail` blanks `design` for both.
 *
 * **Why this exists at all**, since the surface shipped without it: the designer has a real camera —
 * a Pan tool, a wheel door, `MIN_ZOOM` — and nothing anywhere stated its scale, on a surface whose
 * whole job is millimetres. The dimension labels and the legend the concept boards draw are
 * recoverable from the Inspector; the zoom was recoverable from nowhere. AD18 item 1.
 */
const zoomPercent = computed(() => Math.round(editorStore.viewport.zoom * 100));

/**
 * The KEY, held separately from its resolved props so `onEmptyStateAction` below can ask
 * which entry is showing without re-deriving it — the same split `overlay` used to collapse
 * into one step before Task B7 gave one of the two entries something to DO.
 */
const emptyStateKey = computed<'noShape' | 'noBackground' | null>(() => {
	const current = design.value;
	if (current === null || runtime.activeToolId.value !== null) return null;
	return selectAssetDesignerEmptyState(current);
});

/**
 * **The action label is withheld when no picker is bound**, even though the registry declares
 * one unconditionally — slice 14's Amendment 1 refuses a live control that does nothing, and a
 * bound picker is this button's whole reason to exist. The composition root binds a real one
 * today, so this is the defensive answer rather than a reachable production state; the same
 * shape `AssetDesignerContext.picker`'s own docblock states.
 *
 * `noShape` needs no such guard: Task B8's dimensions dialog is a member of THIS component's
 * own script, not a port that might be unbound, so `EMPTY_STATE_CONTENT.assetDesigner.noShape`'s
 * `actionLabel` is reachable unconditionally the moment it is declared.
 *
 * **This is the RANKED path alone since AD07.** The other two entry paths are buttons in
 * `EmptyState`'s `actions` slot below, which is why a `noBackground` state with no picker bound
 * still draws a panel with two live controls in it rather than none: the stripped label is the
 * one gesture nothing can perform, not the whole offer.
 */
const overlay = computed<EmptyStateProps | null>(() => {
	const key = emptyStateKey.value;
	if (key === null) return null;
	const resolved = resolveEmptyState(EMPTY_STATE_CONTENT.assetDesigner[key]);
	if (key === 'noBackground' && context.picker === null) {
		const { actionLabel: _actionLabel, ...withoutAction } = resolved;
		return withoutAction;
	}
	return resolved;
});

/**
 * Task B8's dimensions gesture, and the ONE place it is written rather than one copy per
 * caller: the empty state's action below and `DesignerInspector`'s own dimensions control
 * (labelled *Set* or *Edit* by whether there is a shape) both call it, so the two cannot drift into disagreeing about which dialog opens or
 * which command answers it. `dialogs.current !== null` mirrors `ViewRoot.onCreateProject`'s own
 * guard — `EmptyState`'s button and the inspector's have no disabled state of their own, so two
 * clicks landing in the same tick must not both reach `openDialog`, which throws
 * `DialogStackingError` on the second.
 *
 * `initial` is the asset's OWN current dimensions when it has any — the inspector's caller is
 * the only one that can ever supply them, since the empty state exists precisely because there
 * are none yet — so a user editing a rectangle sees it rather than a blank form.
 *
 * **UNLESS those numbers are not measurements**, which is the one place this form could launder
 * placeholder pixels into authored millimetres. `dimensionsUnscaled` is exactly the state the
 * inspector puts a warning over — "traced before a scale existed, so these numbers are not real
 * measurements yet" — and offering them back as the default made *Edit dimensions → Save* write
 * them as a `typed` rectangle in true millimetres, in two clicks, with the warning then
 * correctly gone because the footprint really is typed now. Nothing anywhere said so —
 * `DesignerInspector` was then the only reader of that flag, which was EXACT at `d852733bd^`
 * and stopped holding inside `d852733bd` itself, the commit that wrote this paragraph and added
 * `editDimensions`'s own read a few lines below it. The past tense is the one it earned, and it
 * is kept rather than corrected into a number: what falsifies such a sentence is not being wrong
 * but being unreadable, and three separate readers in a row took this one for a statement about
 * the tree in front of them. For who reads the flag TODAY, run `grep -rn "dimensionsUnscaled"
 * src/` — and read each hit, because it also prints prose that only names the field.
 *
 * Both halves, and each closes a different thing. The form is left EMPTY, so no gesture
 * promotes an unscaled number by accident — the ratio between two placeholder pixel counts is
 * not a default anybody should be nudged towards either. And it carries the reason, because
 * `docs/requirements/Asset designer.md`'s Definition of Done asks that "an uncalibrated surface
 * says so wherever a measurement would otherwise appear", and a form that silently declined to
 * pre-fill would meet the first half of this and not that sentence.
 */
async function editDimensions(): Promise<void> {
	if (dialogs.current !== null) return;
	const current = design.value;
	const unscaled = current?.dimensionsUnscaled === true;
	const dimensions = current?.dimensions ?? null;
	// In the whole millimetres `DesignerInspector` shows, never a curve's irrational box.
	const initial = dimensions !== null && !unscaled ? { width: Math.round(dimensions.width), depth: Math.round(dimensions.depth) } : null;
	const result = await dialogs.openDialog({
		kind: 'asset-dimensions',
		title: tr('designer.dimensions.edit.title'),
		...(initial !== null ? { initial } : {}),
		...(unscaled ? { warning: tr('designer.dimensions.unscaled') } : {}),
	});
	if (result === null) return;
	// Typing back the numbers this form OFFERED is not an edit, so it dispatches nothing and pushes no
	// undo entry (contract C03, and AD02's own acceptance criterion). Compared against `initial` rather
	// than against the canonical extent on purpose: a footprint measuring 1200.4 is offered as 1200, and
	// a user typing 1200 there means "leave it as it is" rather than "trim four tenths of a millimetre".
	// The two states with no `initial` — no shape, and a footprint still in placeholder pixels — cannot
	// reach this, which is right: there is nothing to have typed back.
	if (initial !== null && result.width === initial.width && result.depth === initial.depth) return;
	// A footprint in real millimetres is SCALED, whatever it is drawn as — a traced L-shape keeps its
	// corners, and its anchor keeps whatever relationship to the shape the user gave it. The rectangle
	// is for the two states where there is nothing to scale: no shape at all, and a footprint still in
	// placeholder pixels, where scaling by typed millimetres would leave the result flagged pending and
	// multiplied again by a later calibration.
	if (unscaled || !current?.shape) {
		await runtime.setFootprintFromDimensions(result.width, result.depth);
		return;
	}
	await notifyIfRefused(runtime.editShape((shape) => scaleDesignToDimensions(shape, result.width, result.depth)));
}

/** `FormDialog` carries its payload as `unknown`; the command validates the shape itself. */
function isShape(values: unknown): values is AssetShape {
	return typeof values === 'object' && values !== null && 'footprint' in values && 'details' in values;
}

/**
 * The symbols spec's preset gesture: open the picker, write what it builds. Guarded like
 * `editDimensions` against a second dialog, and a cancel writes nothing.
 */
async function startFromPreset(): Promise<void> {
	if (dialogs.current !== null) return;
	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('designer.preset.title'),
		component: markRaw(AssetPresetForm),
		props: { replaces: Boolean(design.value?.shape) },
	});
	if (result === 'cancel' || !isShape(result.values)) return;
	await runtime.applyShape(result.values);
}

/**
 * The reference gesture, and the ONE place it is written — `editDimensions`'s rule applied to
 * the third entry path, because AD07 gave it two callers: the ranked action of the
 * `noBackground` state, and the alternative offered from `noShape`.
 *
 * Cancelling the picker (`null`) dispatches nothing: a cancelled pick is not a chosen
 * reference, and `SetAssetBackground` has no meaning applied to data the user never supplied.
 */
async function traceReference(): Promise<void> {
	const picker = context.picker;
	if (picker === null) return;
	// `picked`, not `ref`: this script imports Vue's own `ref` since the background status
	// arrived, and `no-shadow` fails the build on the collision.
	const picked = await picker.pick();
	if (picked === null) return;
	await runtime.setBackground(picked);
}

/**
 * The empty state's `@action` — the path `selectAssetDesignerEmptyState` RANKS FIRST, which is
 * all that selector has ever decided (`selectors.ts`'s own header: "prominence rather than
 * access"). The other two paths are offered beside it in the `actions` slot below and call the
 * same two functions this does.
 */
async function onEmptyStateAction(): Promise<void> {
	if (emptyStateKey.value === 'noBackground') {
		await traceReference();
		return;
	}
	if (emptyStateKey.value === 'noShape') await editDimensions();
}

/**
 * The read replaced by the reason it has none — and the reason decides what the one button
 * means, which is THREE states in one slot rather than two.
 *
 * `trError` for the body of the two failure states, so unrecovered settings and a vault fault
 * each say their own thing — the defect slice 11 fixed on the project surface and slice 17
 * carried to the editor.
 *
 * The retry is withheld from a bootstrap failure, through the same
 * `viewHydrationOrigin`/`surfaceFor` pair both other views ask: `settings.unrecovered` means the
 * composition root wired no query service at all, so re-running one does nothing while looking
 * like it might.
 *
 * **The DANGLING state, and this paragraph used to argue against having one.** It said there was
 * deliberately no close-the-tab action, on the grounds that slice 17 could branch on
 * `status === 'missing'` — `GetPlan` answers `ok(null)` for a plan that is gone — while
 * `GetAssetDesign` refuses an absent asset with a coded `ReferenceError` and gives this view no
 * such arm. The premise is right and the conclusion did not follow: the CODE is the arm. What
 * the old argument called "inventing one" is a question `assetDesignStore` was already asking
 * twice, to hold the loading line before the index scan and to blank the design after it, and
 * `isMissingAsset` is that question exported rather than a fourth spelling of the code. Deferring
 * it to Task B9 left the user on a Retry that re-runs the same lookup for a note that is not
 * coming back, in a tab with no subject — the live control that does nothing this repository
 * refuses everywhere else. Reported on PR 43.
 *
 * The state carries its own body rather than a mapped one: `trError` would resolve
 * `asset.not-found`'s own sentence, "That asset no longer exists.", which is true and says
 * nothing about the TAB the user is looking at or what to do with it.
 */
const failure = computed(() => {
	const failed = error.value;
	// `status` and not `error` alone: a keep-on-failure refresh sets `error` beside content that
	// is still real and still drawn, and replacing the canvas with a failure panel there would
	// hide a design the user can go on working on in order to report a read that failed. That
	// case is `staleAfterRefresh` above.
	if (status.value !== 'failed' || failed === null) return null;
	// ASKED FIRST, because it is the narrow arm: an authoritative miss is a specific code, and
	// `viewHydrationOrigin` below would route it to the retryable bucket. The store only ever
	// reaches `failed` with this code once the index scan has run — before that it holds the
	// loading line — so a leaf restored onto a vault whose scan has not landed does not flash
	// this screen and retract it.
	if (isMissingAsset(failed)) {
		return {
			headline: tr('designer.asset-missing.headline'),
			body: tr('designer.asset-missing.body'),
			actionLabel: tr('designer.asset-missing.action'),
		};
	}
	const session = surfaceFor(failed, viewHydrationOrigin(failed)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'designer.asset-failed.headline'),
		body: trError(failed),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

/**
 * The failure state's one button, which means two different things — `PlanEditorRoot`'s own
 * `onFailureAction`, reached from the other side of the same structural difference.
 *
 * A read that FAILED is retryable: the query really tried and may succeed on a second attempt.
 * An asset that is GONE is not, so the useful action is to close the tab. Branching HERE rather
 * than emitting two events, because `ViewFailure` is deliberately generic — resolved strings in,
 * one `action` out — and teaching it which of its callers means what would make it this
 * surface's component rather than any view's.
 *
 * Both directions have a case: a handler that always closed, or always re-read, passes a suite
 * that tests only one of them.
 */
function onFailureAction(): void {
	const failed = error.value;
	if (failed !== null && isMissingAsset(failed)) {
		context.closeLeaf();
		return;
	}
	void runtime.hydrate();
}

/**
 * Delete and Ctrl+D for the designer's selection (symbols spec, Decision 10), bound on the canvas
 * ELEMENT — `<DesignerCanvas @keydown>` falls through to `EditorSurface`'s focusable root — because
 * `EditorSurface` routes neither key. The inspector is a sibling region, so a Backspace typed in one
 * of its fields never reaches this listener.
 *
 * Three refusals, each someone else's key:
 * - a key whose target is not that element itself — `keyDoors.ts`'s `isCanvasKey` rule, so a
 *   control inside the canvas (the overlay's action button, a later field) keeps its own Backspace;
 * - any tool but Select — the plan editor's `nudge.ts` rule, since every other tool owns the keyboard
 *   for its own gesture, and Backspace mid-trace must not delete the part still selected;
 * - a press still held on the selection (`hasDraft`), whose release is about to write that very part.
 */
const keyActions = selectionKeyActions(designStore, runtime.editShape, runtime.activeToolId);
function onCanvasKeyDown(event: KeyboardEvent): void {
	if (event.target !== event.currentTarget || runtime.activeToolId.value !== 'select' || runtime.toolManager.activeToolHasDraft()) return;
	designerShortcut(event, {
		selection: designStore.selection,
		deleteSelection: () => {
			void keyActions.deleteSelection();
		},
		duplicateSelection: () => {
			void keyActions.duplicateSelection();
		},
	});
}

onMounted(() => {
	void runtime.hydrate();
});
</script>

<template>
	<div class="renovation-asset-designer">
		<!--
			AD18 item 2's header region, FIRST in the shell: the asset's name, the way back to the
			catalogue, the save state and the way into a plan. `DesignerHeader` decides on its own
			what it can say about a leaf whose read is in flight or refused, which is why this region
			mounts its component unconditionally where the Parts and Inspector regions gate theirs —
			the save state is true of every state and the other three are not. It is not alone in
			mounting unconditionally: the toolbar region does too, and always has.
		-->
		<div class="rp-designer-header">
			<DesignerHeader
				:design="design"
				:open-library="context.openLibrary"
				:use-plan="context.usePlan"
			/>
		</div>
		<!--
			Design slice B5's toolbar, mounted. The REGION is this div and the component is its
			child, which is the shape the canvas and the status regions already take — and it is
			what lets the two instruments catch different mistakes: `assetDesignerRoot.test.ts`
			fails when the region disappears, and `regionsReachable.test.ts` fails when a
			component under `designer/` stops being reachable from the view.
		-->
		<div class="rp-designer-toolbar">
			<DesignerToolbar />
		</div>
		<div class="rp-designer-body">
			<!--
				AD09's rail, FIRST in the body so its visual position at every width matches its
				focus order — the concept board's "Parts left, properties right" (AD01 §3), and the
				same stacking order the narrow container query keeps.

				**It holds TWO panels since AD18 item 5, stacked and not tabbed (AD18-R5), and the
				region div is still the one `.rp-designer-parts` the rest of the stylesheet knows.**
				That is deliberate: `designer-parts.css` gives this div the rail's width, padding,
				background and border, and `designer-narrow.css` and `designer-toolbar.css` each
				name it again for the stacked layout and for item 6's cap. A wrapper element
				introduced here would move all four of those and buy nothing the `Add` panel needs.
				The class therefore names less than the div now holds, which is the honest cost of
				not moving three container queries; a rename is its own change.

				`design !== null` on the Parts panel alone, for `.rp-designer-inspector`'s reason: a
				loading leaf and a hard failure both blank the design, and the region survives as an
				empty one rather than drawing a list of parts nobody has read. **`DesignerAddPanel`
				takes no such gate** — a shape button activates a tool, and the tools exist whether
				or not a design has been read — which is AD18-R5's whole argument for stacking
				rather than tabbing: a condition on one child and none on the other is a shape this
				file already had, where a tab pair would have had to answer what `Parts` shows while
				`design` is `null`.
			-->
			<div class="rp-designer-parts">
				<DesignerAddPanel :start-from-preset="startFromPreset" />
				<DesignerPartsPanel
					v-if="design !== null"
					:design="design"
					:selected="selected"
					:select="designStore.select"
					:edit-shape="runtime.editShape"
					:view="runtime.partView"
				/>
			</div>
			<!--
				Task B4's `DesignerCanvas`, mounted. The region is ALWAYS drawn — the empty
				state, the failure state and the loading line all live inside it rather than in
				place of it, which is what keeps `EmptyState`'s `overlay` modifier meaning what
				it means on a plan.

				**The empty state moved INSIDE the canvas rather than beside it**, into the
				surface's own overlay slot, which is where `PlanEditorRoot` puts the plan
				editor's. Two things follow from that and neither is cosmetic: the overlay
				resolves its `position: absolute` against the canvas it floats over, and
				`EditorSurface`'s `display: contents` wrapper swallows a press on an overlay
				control so it cannot start a camera pan under a user who is merely clicking a
				button — a defect this repository has already shipped once on the plan side.

				The canvas mounts for a shapeless asset too, which is the whole of slice 14's
				rule: an empty state that REPLACED the region would hide the one thing the
				region exists to show. It does not mount over a FAILURE, for slice 17's: a read
				that refused has nothing to draw, and a canvas beneath the panel would be a
				stage bound to a design nobody has.
			-->
			<div class="rp-designer-canvas">
				<ViewFailure
					v-if="failure !== null"
					v-bind="failure"
					@action="onFailureAction"
				/>
				<p
					v-else-if="design === null"
					class="rp-designer-message"
				>
					{{ tr('designer.loading') }}
				</p>
				<DesignerCanvas
					v-else
					@background-status="(next) => (backgroundStatus = next)"
					@keydown="onCanvasKeyDown"
				>
					<EmptyState
						v-if="overlay !== null"
						v-bind="overlay"
						overlay
						@action="onEmptyStateAction"
					>
						<template #actions>
							<DesignerEntryPaths
								:empty-state-key="emptyStateKey"
								:has-picker="context.picker !== null"
								:edit-dimensions="editDimensions"
								:trace-reference="traceReference"
								:start-from-preset="startFromPreset"
							/>
						</template>
					</EmptyState>
				</DesignerCanvas>
			</div>
			<!--
				Task B8's region. `design !== null` rather than a status check: that is precisely
				what makes `.rp-designer-inspector` an EMPTY region for both a loading leaf and a
				hard failure (`AssetDesignStore.fail` blanks `design` for both), so the region
				survives — per `assetDesignerRoot.test.ts`'s own rule — without drawing a panel
				over data nobody has read yet.
			-->
			<div class="rp-designer-inspector">
				<DesignerInspector
					v-if="design !== null"
					:design="design"
					:set-height="runtime.commitHeight"
					:remove-background="runtime.removeBackground"
					:edit-dimensions="editDimensions"
					:logger="context.logger"
					:selection="selection"
					:edit-shape="runtime.editShape"
					:select="designStore.select"
					:selected="selected"
					:locked-graphics="runtime.partView.locked.value"
					:multi-selection-mode="runtime.multiSelectionMode.value"
					:set-multi-selection-mode="(next: boolean) => (runtime.multiSelectionMode.value = next)"
				/>
			</div>
		</div>
		<p
			v-if="staleAfterRefresh"
			class="rp-designer-notice"
			role="status"
		>
			{{ tr('designer.refresh-failed') }}
		</p>
		<p
			v-if="backgroundStatus === 'missing'"
			class="rp-designer-notice"
			role="status"
		>
			{{ tr('designer.background-missing') }}
		</p>
		<p
			v-else-if="backgroundStatus === 'unreadable'"
			class="rp-designer-notice"
			role="status"
		>
			{{ tr('designer.background-failed') }}
		</p>
		<!--
			The region keeps NO role, exactly as Task B3 shipped it. `StatusBar` puts the plan
			editor's indicator inside a `role="status"` region and its Shift hint inside a
			`role="group"` one, and merging the two here would make the hint's appearance an
			announced status change — it is a standing note about a modifier, not an event. Giving
			the designer's save state a live region of its own is a decision about THAT surface,
			which this task does not take.

			**The save state left this region in AD18** and is in the header above, which is where
			AD06 item 1 asks for it and where a user looking for "is my work safe" looks first. It
			is not drawn in both: a second indicator reading the same store would be a second answer
			to one question. What is left here is the three standing facts about the VIEW — what
			Shift does, the camera's scale, the grid's step — which is a coherent region rather than
			a remainder.
		-->
		<div class="rp-designer-status">
			<span
				v-if="hintKey !== null"
				class="rp-designer-hint"
			>{{ tr(hintKey) }}</span>
			<span
				v-if="design !== null"
				class="rp-designer-zoom"
			>{{ tr('designer.status.zoom', { percent: String(zoomPercent) }) }}</span>
			<span
				v-if="gridStep !== null"
				class="rp-designer-grid-step"
			>{{ tr('designer.status.grid', { step: String(gridStep) }) }}</span>
		</div>
		<!--
			Last child, and a sibling of the regions rather than nested in one: the host makes
			its parent's OTHER children inert while a dialog is open, so every region has to be
			a sibling of it for the background to actually go inert.
		-->
		<DialogHost />
	</div>
</template>

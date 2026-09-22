<script setup lang="ts">
/**
 * The designer's header (AD18 item 2, which is AD06 implementation item 1): which asset this leaf
 * is editing, the way back to the catalogue, whether the work is saved, and the way forward into a
 * plan.
 *
 * **It owns the NAME, and the Inspector no longer draws one** — ruling AD18-R1, taken by the user
 * before this component existed. The name was added to `DesignerInspector` in AD13 because nothing
 * on the surface answered *which asset is this*: `getDisplayText()` returns the same string for
 * every designer leaf, so three open designers are titled identically, and a per-asset view is
 * precisely the one you can have three of at once. A header that restated it would be a second
 * answer to one question, which is the shape this repository refuses everywhere it has a name for
 * it. So it moved rather than being copied.
 *
 * `AssetUsageScope` stayed behind, under the Inspector's own `Asset` heading, which is the check
 * AD18-R1 put on this move: that block is a blast-radius disclosure and it has to go on reading as
 * being about the asset with the name no longer directly above it. It does — `<h3>Asset</h3>` is
 * now what sits directly above it, and the block's own `<h4>Used in plans</h4>` reads under that
 * heading rather than under a bare paragraph. No second copy of the name, and no new heading.
 *
 * **`Open library` and `Use in plan` MOVED here too, for the same no-second-answer reason.** AD06
 * item 1 asks the header to carry both, and they existed in the Inspector already; leaving either
 * behind would have drawn one gesture in two places. `DesignerUsePlan` is the component that was
 * already there, mounted here instead — it owns both conditions that decide whether it draws
 * anything, so this file states none of them.
 *
 * **Neither door is bound in the BROWSER HARNESS** — `tests/harness/assetDesigner.ts`'s deps
 * object names neither `openLibrary` nor `usePlan` — so the header a capture photographs carries
 * the name and the save state alone. That is slice 14's Amendment 1 rather than an oversight: a
 * control with nothing behind it is a live control that does nothing. (The sentence is about the
 * harness and not about "every suite": `designerHeader.test.ts` binds `openLibrary` in the case
 * that presses it, which is what proves the control works when a door IS composed behind it.)
 *
 * **The save state it carries is qualified by THIS leaf's staleness (W18-C, contract C08).** A
 * write that landed over a canvas the leaf could then not re-read is `Saved` and not current, and
 * `SaveStateIndicator`'s own two stores cannot see that here — they are the Plan Editor's, and
 * this leaf's Pinia never hydrates either. So the fact arrives as a prop from the root, from the
 * same `staleAfterRefresh` the refresh-failed strip is drawn from.
 *
 * **What the `design !== null` gate covers is TWO of the four, not three of them.** The name and
 * `DesignerUsePlan` are inside it: a leaf whose read is in flight or refused has no name to state
 * and no asset to take into a plan. `SaveStateIndicator` is outside it because a save state is
 * true of every state, and it drew one from the status region before AD18 moved it up here. So is
 * the library door, and for a different reason: it is gated on `openLibrary` instead, which is
 * about the COMPOSITION behind this mount rather than about the read — a user whose read refused
 * is exactly the user who wants the way back to the catalogue. Both of those are pinned by
 * `states the save state and the library door for a leaf with no design`.
 *
 * **No account, logo, compass or marketing chrome** (C12, and AD06 item 1's own words). The four
 * things above are the whole of it.
 */
import { tr } from '../i18n/strings';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import SaveStateIndicator from '../editor/save-state/SaveStateIndicator.vue';
import DesignerUsePlan from './inspector/DesignerUsePlan.vue';
import HostIcon from '../components/HostIcon.vue';

defineProps<{
	/** The design this leaf holds, or `null` while the read is in flight or after it refused. */
	design: AssetDesignDto | null;
	/** The way back to the shared catalogue, or `undefined` where no door is bound (AD06). */
	openLibrary?: () => void;
	/** The way forward into a plan (AD13), passed straight through to `DesignerUsePlan`. */
	usePlan?: (assetId: string) => void;
	/**
	 * Is the canvas drawing a design the leaf can no longer confirm — `AssetDesignerRoot`'s
	 * `staleAfterRefresh`, passed straight through to `SaveStateIndicator`.
	 *
	 * **The root's computed rather than a second read of `assetDesignStore.stale` here**, so the
	 * qualifier on this label and the refresh-failed strip below the body cannot disagree: they
	 * are one expression rendered twice. `SaveStateIndicator`'s own docblock carries why that
	 * fact has to arrive as a prop at all — its two stores are a Plan Editor's, and neither is
	 * ever hydrated in this leaf's Pinia.
	 */
	stale?: boolean;
}>();
</script>

<template>
	<!--
		A `<header>` rather than a div, which is `EditorContextBar`'s shipped spelling for the same
		region one surface over, and LABELLED for that file's reason. The first version of this
		comment said the heading inside named it; that is false twice over — HTML-AAM does not name
		a `banner` landmark from a descendant heading, and for a leaf whose read is in flight or
		refused there is no heading in here at all.
	-->
	<header
		class="rp-designer-title-bar"
		:aria-label="tr('designer.header')"
	>
		<!--
			Board 02's `← Back to library` (AD18-R16 Task 2). The label's own text is the accessible
			name — no `aria-label` — because `styles/designer-header.css` CLIPS it below the header's
			narrow width rather than hiding it, and a clipped node keeps naming the button only while it
			is still what the button is named FROM. `HostIcon` carries `aria-hidden` itself, so the icon
			never doubles what the label already says.
		-->
		<button
			v-if="openLibrary !== undefined"
			type="button"
			class="rp-designer-open-library"
			@click="openLibrary"
		>
			<HostIcon name="arrow-left" />
			<span class="rp-designer-open-library-label">{{ tr('designer.header.back-to-library') }}</span>
		</button>
		<!--
			ONE gate over both, rather than one each. They ask the identical question, and an
			unreachable-in-practice second copy of it costs a branch it can never pay back —
			CLAUDE.md's own rule about the coverage margin, applied where the margin is thin.

			**An `<h2>`, which is the house convention rather than this surface's accident.**
			`grep -rn "<h1" src/` prints exactly two lines and both of them are in THIS comment —
			no element in the whole of `src/` opens one — and `ProjectDetail.vue`, the closest
			analogue at a leaf naming its own subject, draws `.rp-project-detail__name` as an `h2`.
			A plugin leaf sitting beside Obsidian's own markdown headings is not the place to claim
			the document's top level. The outline reads h2 asset, h2 parts, h2 inspector, h3 Asset,
			h4 Used in plans, with nothing skipped, and `designerHeader.test.ts` asserts the first
			half of that over the mounted leaf.
		-->
		<template v-if="design !== null">
			<h2 class="rp-designer-asset-name">
				{{ design.name }}
			</h2>
			<DesignerUsePlan
				:design="design"
				:use-plan="usePlan"
			/>
		</template>
		<SaveStateIndicator :stale="stale" />
	</header>
</template>

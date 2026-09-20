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
 * **`SaveStateIndicator` is OUTSIDE the `design !== null` gate, and the two others are inside
 * it.** A leaf whose read is still in flight, or refused, has no name to state and no asset to
 * take into a plan — but it still has a save state, and it used to draw one from the status
 * region. Gating all three together would have taken that away from exactly the states most
 * likely to need it.
 *
 * **No account, logo, compass or marketing chrome** (C12, and AD06 item 1's own words). The four
 * things above are the whole of it.
 */
import { tr } from '../i18n/strings';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
import SaveStateIndicator from '../editor/save-state/SaveStateIndicator.vue';
import DesignerUsePlan from './inspector/DesignerUsePlan.vue';

defineProps<{
	/** The design this leaf holds, or `null` while the read is in flight or after it refused. */
	design: AssetDesignDto | null;
	/** The way back to the shared catalogue, or `undefined` where no door is bound (AD06). */
	openLibrary?: () => void;
	/** The way forward into a plan (AD13), passed straight through to `DesignerUsePlan`. */
	usePlan?: (assetId: string) => void;
}>();
</script>

<template>
	<!--
		A `<header>` rather than a div, which is `EditorContextBar`'s shipped spelling for the same
		region one surface over. It carries no `aria-label`: the `<h1>` inside names it, and an
		`aria-label` on a landmark that already has a heading announces the same thing twice.
	-->
	<header class="rp-designer-title-bar">
		<button
			v-if="openLibrary !== undefined"
			type="button"
			class="rp-designer-open-library"
			@click="openLibrary"
		>
			{{ tr('designer.inspector.open-library') }}
		</button>
		<!--
			ONE gate over both, rather than one each. They ask the identical question, and an
			unreachable-in-practice second copy of it costs a branch it can never pay back —
			CLAUDE.md's own rule about the coverage margin, applied where the margin is thin.

			The `<h1>` is this surface's first heading; the Inspector's and the Parts panel's are
			both `<h2>`, so the outline reads asset → panel → section with nothing skipped.
		-->
		<template v-if="design !== null">
			<h1 class="rp-designer-asset-name">
				{{ design.name }}
			</h1>
			<DesignerUsePlan
				:design="design"
				:use-plan="usePlan"
			/>
		</template>
		<SaveStateIndicator />
	</header>
</template>

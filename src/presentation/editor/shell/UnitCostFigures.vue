<script setup lang="ts">
/**
 * §89's "beside what it replaced" at the INPUT level: what a Requirement's figures were PRICED
 * at, rather than what they came to. The shared library's unit price, this project's own, and
 * the provenance `calculatedFrom.unitCost` records — up to three figures, each labelled with
 * what it is and one of them marked as the one in force.
 *
 * **Its own component rather than a block in `RequirementRow.vue`, and the reason is measured
 * rather than stylistic** — the same reason that row is not a block in `InspectorPanel.vue`.
 * Inline, it took that template's cognitive complexity to 16 against a threshold of 15, which
 * `npm run analyze` reports as a finding. Three nested `v-if`s over one nullable group is a
 * coherent seam of its own.
 *
 * It renders `dt`/`dd` pairs and no wrapper: the caller's `<dl>` is what these belong to, and a
 * container here would break the definition list it sits in.
 */
import { computed } from 'vue';
import { sameMoney } from '../../../core/money/Money';
import type { RequirementInspectorDTO } from '../../../application/queries/GetRequirementsForZone';
import { tr } from '../../i18n/strings';

const props = defineProps<{
	/**
	 * `null` for a row whose asset is gone — there is no library price left to compare against,
	 * and inventing one would render a comparison against a figure that does not exist. The
	 * whole block is absent then, which is what the template's outer `v-if` says.
	 */
	unitCost: RequirementInspectorDTO['unitCost'];
}>();

/**
 * `resolved` is what the current inputs say the unit price is — the project's own if it has
 * one, otherwise the library's — and `provenance` is `unitCost.effective`, the price actually
 * recorded in `calculatedFrom`, drawn only when it DIFFERS from that. So an ordinary fresh row
 * draws one figure; a row with an override draws two; and a row whose recalculation has not
 * caught up draws three, which is Decision 6's "three numbers in the worst case".
 *
 * **The in-force mark is decided by PRECEDENCE, never by equality**, and that is the one rule a
 * reader is likely to reach for the wrong version of. A project price that happens to equal the
 * library's is still the price in force; marking every figure equal to `resolved` would mark
 * both rows and have the surface claim two figures are the one being used.
 *
 * **ONE computed rather than three, and the reason is which arms a test can reach.** As three —
 * a resolved price, a provenance, an in-force marker — each carried its own `null` guard while
 * the template gated on the PROP, so a row whose asset is gone evaluated none of them and all
 * three null arms were unreachable by construction. Gating on the block itself is what makes
 * the missing-asset case drive the branch it is about.
 */
const block = computed(() => {
	const group = props.unitCost;
	if (group === null) return null;
	const resolved = group.projectOverride ?? group.catalogue;
	const provenance = sameMoney(group.effective, resolved) ? null : group.effective;
	// Nothing beside it to be preferred over: one figure, and no label saying which of one is in
	// force, because that is a label dangling off the only number on screen.
	const comparing = group.projectOverride !== null || provenance !== null;
	return {
		catalogue: group.catalogue,
		projectOverride: group.projectOverride,
		provenance,
		inForce: comparing ? (group.projectOverride === null ? 'library' : 'project') : null,
	};
});
</script>

<template>
	<template v-if="block !== null">
		<!-- `data-price` is what each figure IS, so a caller or a test can name one without
		     depending on the order they happen to be written in. -->
		<dt>{{ tr('editor.inspector.price-library') }}</dt>
		<dd data-price="library">
			{{ block.catalogue.amount }} {{ block.catalogue.currency }}
			<span
				v-if="block.inForce === 'library'"
				class="rp-editor-requirement-badge rp-editor-requirement-in-force"
			>
				{{ tr('editor.inspector.price-in-force') }}
			</span>
		</dd>

		<template v-if="block.projectOverride !== null">
			<dt>{{ tr('editor.inspector.price-project') }}</dt>
			<!-- UNCONDITIONAL, and that is a consequence of the precedence rule rather than a
			     shortcut: this row exists only when `projectOverride !== null`, and `inForce` is
			     `'project'` for every such block by construction — `comparing` is true whenever
			     the override is set. A `v-if="block.inForce === 'project'"` here was an
			     unreachable arm, `counts [11, 0]`, of the `boundsOfZones` shape this repository
			     records DELETING rather than the shape that narrows a type. The LIBRARY row's own
			     `v-if` is NOT this: there the mark genuinely comes and goes. -->
			<dd data-price="project">
				{{ block.projectOverride.amount }} {{ block.projectOverride.currency }}
				<span class="rp-editor-requirement-badge rp-editor-requirement-in-force">
					{{ tr('editor.inspector.price-in-force') }}
				</span>
			</dd>
		</template>

		<!-- Its OWN label, never a second in-force mark: this figure is what the row's cost was
		     derived from, which on a stale row is precisely NOT the one in force. -->
		<template v-if="block.provenance !== null">
			<dt>{{ tr('editor.inspector.price-derived-from') }}</dt>
			<dd data-price="derived">
				{{ block.provenance.amount }} {{ block.provenance.currency }}
			</dd>
		</template>
	</template>
</template>

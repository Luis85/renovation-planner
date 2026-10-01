<script setup lang="ts">
/**
 * The Clearance section's `Show clearance` switch (AD18-R17, board 01), over the leaf runtime's
 * `showClearance` — `runtime.ts` carries what the switch hides and why it is stored nowhere.
 *
 * Its own component for `DesignerClearanceHelper`'s TEMPLATE budget (fallow's cognitive score), not for
 * reuse: the helper mounts it only while the design has a clearance to hide, and this draws nothing on a
 * bare mount with no leaf runtime (`useShowClearance`'s `null`).
 */
import { tr } from '../../i18n/strings';
import { useShowClearance } from '../runtime';

const showClearance = useShowClearance();
</script>

<template>
	<label
		v-if="showClearance !== null"
		class="rp-designer-clearance-toggle"
	>
		<input
			v-model="showClearance"
			type="checkbox"
			role="switch"
			name="show-clearance"
		>
		{{ tr('designer.clearance.show') }}
	</label>
</template>

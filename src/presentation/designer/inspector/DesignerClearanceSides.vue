<script setup lang="ts">
/**
 * The clearance helper's four per-side fields, folded under `Advanced` (AD18-R17, board 01): the Arrange
 * panel's bare `.rp-designer-collapsible`, closed by default, with its open state its own.
 *
 * Its own component for `DesignerClearanceHelper`'s TEMPLATE budget (fallow's cognitive score), not for
 * reuse. It owns no state: the four raw-text drafts stay the helper's (C03 — `generate` reads them there),
 * and each keystroke goes back through `onSide`.
 */
import type { ClearanceSetbacks } from '../../../domain/asset/referenceFrame';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import DesignerFieldRowShell from './DesignerFieldRowShell.vue';

type Side = keyof ClearanceSetbacks;

defineProps<{
	sides: readonly { readonly side: Side; readonly label: StringKey; readonly short: StringKey }[];
	draft: Readonly<Record<Side, string>>;
	onSide: (side: Side, value: string) => void;
}>();
</script>

<template>
	<details class="rp-designer-collapsible">
		<summary>
			<h4 class="rp-designer-panel-title rp-designer-section-title">
				{{ tr('designer.clearance.advanced') }}
			</h4>
		</summary>
		<DesignerFieldRowShell
			v-for="entry in sides"
			:key="entry.side"
			:short="entry.short"
			unit="mm"
		>
			<input
				type="number"
				step="any"
				inputmode="decimal"
				:name="`clearance-${entry.side}`"
				:aria-label="tr(entry.label)"
				:value="draft[entry.side]"
				@input="onSide(entry.side, ($event.target as HTMLInputElement).value)"
			>
		</DesignerFieldRowShell>
	</details>
</template>

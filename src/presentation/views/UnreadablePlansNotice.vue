<script setup lang="ts">
/**
 * The unreadable-plans sentence and the control that sentence names, drawn as ONE region by
 * both project surfaces — the detail state and the schedule surface.
 *
 * **It is a component because both templates were over fallow's cognitive budget with the
 * markup inline**, which is the same answer `ProjectEntryGuidance.vue` is: a `v-if` on the
 * sentence plus a `v-if` on the button is two nested decision points in each host template, and
 * moving both here is what took `ProjectDetail.vue` and `ProjectWorkState.vue` back under the
 * cap. Sharing it between the two sites is the part that is merely nice; clearing the cap is
 * the part that is load-bearing.
 *
 * **The button sits beside the live region, never inside it.** `role="status"` on a wrapper
 * re-announces the control with the sentence on every re-render — the same reason
 * `ProjectDetail.vue`'s plan-read failure notice puts its retry outside its own `<p>`.
 *
 * **Which sentence is the CALLER's decision, and so is whether the report is offered.** The
 * detail state has two arms and only `some-plans-unreadable` names the report, so
 * `canOpenReport` is a second answer rather than a re-reading of `notice` — a button gated on
 * the sentence's existence would offer an action the other arm never mentions.
 *
 * **The band is the caller's too**: `class` falls through to the root, so the detail state
 * wears `.rp-view-notice` and the schedule surface keeps the bare shape its sibling paragraphs
 * already have.
 */
import { tr } from '../i18n/strings';

defineProps<{ notice: string | null; canOpenReport: boolean }>();
defineEmits<{ diagnostics: [] }>();
</script>

<template>
	<div v-if="notice !== null">
		<p role="status">
			{{ notice }}
		</p>
		<button
			v-if="canOpenReport"
			type="button"
			data-rp-action="open-diagnostics"
			@click="$emit('diagnostics')"
		>
			{{ tr('command.show-diagnostics-report') }}
		</button>
	</div>
</template>

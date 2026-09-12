<script setup lang="ts">
/**
 * The open plan's Kind (ADR-0029), drawn in the Inspector's floor state directly after the
 * primary action and written through `usePlanReorder().setKind` — the ONE `updatePlanDetails`
 * door the Property tree's row menu also takes, so this select adds no second command path.
 * Its own SFC because `FloorInspector`'s template had crossed the cognitive-complexity budget
 * with this block in it; it reads the store itself rather than taking the plan as a prop, so
 * the parent mounts it with no condition of its own.
 *
 * `reorder.available` hides it without the command and in review perspective; `reorder.paused`
 * is `runtime.writesBlocked` under the tree's own name, and while it holds the select carries
 * §2.9's pair (`RoomInspector`'s `pausedAttrs` shape: both attributes while paused, NEITHER
 * while live). `setKind` answers whether the write landed, and when it did not — refused while
 * paused, or rejected by the command and reported there — the DOM value is put back to the
 * saved kind, which `:value` alone cannot do: the store's `kind` never changed, so Vue has
 * nothing to re-patch, and a select left reading `floor` over a plan still saved as `room` is a
 * control lying about a write that did not happen. Put back to the kind the store holds AFTER
 * the await, not the one captured before it: a re-hydrate during the write — another leaf's
 * concurrent write to this plan, which is also the likeliest cause of the refusal — has already
 * patched the select to the new kind, and the captured one would overwrite it with a stale one.
 * Never reset on success: `ProjectStore` re-hydrates on `PlanDetailsChanged` asynchronously,
 * and snapping back to the old kind in that window would flicker. `useId()` rather than a fixed
 * id because two Plan editor leaves share one document. The plan comes in from the template,
 * where the select's own `v-if` has already narrowed it; after the await it is read again,
 * since a plan gone in that window has no select to put back.
 */
import { computed, useId } from 'vue';
import { tr } from '../../i18n/strings';
import type { PlanDto } from '../../read-models/PlanDto';
import { useProjectStore } from '../../stores/ProjectStore';
import { PLAN_KINDS, type PlanKind } from '../../../domain/plan/PlanKind';
import { PLAN_KIND_LABELS } from '../editorIcons';
import { useEditorRuntime } from '../runtime';
import { usePlanReorder } from './usePlanReorder';

const runtime = useEditorRuntime();
const project = useProjectStore();
const reorder = usePlanReorder();
const kindId = useId();
const pausedAttrs = computed(() =>
	reorder.paused.value
		? ({ 'aria-disabled': 'true', 'aria-describedby': runtime.pausedReasonId } as Record<string, string>)
		: ({} as Record<string, string>),
);
async function onChange(event: Event, plan: PlanDto): Promise<void> {
	const select = event.target as HTMLSelectElement;
	const landed = await reorder.setKind(plan.id, select.value as PlanKind);
	if (!landed && project.plan) select.value = project.plan.kind;
}
</script>

<template>
	<div
		v-if="reorder.available.value && project.plan"
		class="rp-editor-requirement-assign"
	>
		<label :for="kindId">{{ tr('form.new-plan.kind') }}</label>
		<select
			:id="kindId"
			data-rp-field="plan-kind"
			:value="project.plan.kind"
			v-bind="pausedAttrs"
			@change="onChange($event, project.plan)"
		>
			<option
				v-for="kind in PLAN_KINDS"
				:key="kind"
				:value="kind"
			>
				{{ tr(PLAN_KIND_LABELS[kind]) }}
			</option>
		</select>
	</div>
</template>

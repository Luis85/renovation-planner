<!--
	Every lifecycle stage's strip, side by side, because nine of the ten cannot be seen in the
	harness any other way.

	`ProjectRow` takes a required `project` prop and `IndexPage.vue` renders `<component :is>`
	BARE, so a bare mount of it in the index draws the failure card rather than a row; and a real
	row shows ONE stage, which says nothing about the claim that matters here — that ten cells at
	3px with a 1px gap can be counted by eye at a glance, and that a reached cell reads as
	reached. jsdom resolves no CSS, so the suite can assert a rule EXISTS and never that two rules
	look different.

	This duplicates the component's markup, which is a cost and not an oversight — the same trade
	`SaveStateMarks.vue` states. The duplication is two class names deep and both are declared by
	the shipped stylesheet, the one home that ships, so a renamed class breaks the picture rather
	than silently drawing the wrong thing.

	A `div` rather than a `button` for the row, deliberately: a specimen is not a control, and
	giving it a button would put ten focusable elements with no destination into the index's own
	tab order. It keeps `.rp-project-list__row`, which `list-row.css` declares as a descendant of
	`.rp-project-list` and which therefore reaches this element exactly as it reaches the real one.
-->
<script setup lang="ts">
import { PROJECT_STATUSES } from '../domain/project/ProjectStatus';
import { PROJECT_STATUS_STAGE_COUNT } from '../presentation/views/projectStatusStage';

const cells = Array.from({ length: PROJECT_STATUS_STAGE_COUNT }, (_, cell) => cell);
</script>

<template>
	<ul class="rp-project-list">
		<li
			v-for="(status, stage) in PROJECT_STATUSES"
			:key="status"
		>
			<div class="rp-project-list__row rp-project-row">
				<span class="rp-project-list__name">{{ status }}</span>
				<span class="rp-project-row__facts">2 plans · EUR</span>
				<span class="rp-project-list__status rp-project-row__status">
					<span
						class="rp-project-row__ticks"
						aria-hidden="true"
					>
						<span
							v-for="cell in cells"
							:key="cell"
							class="rp-project-row__tick"
							:class="{ 'rp-project-row__tick--reached': cell <= stage }"
						/>
					</span>
				</span>
			</div>
		</li>
	</ul>
</template>

<script setup lang="ts">
/**
 * The LAUNCHER's report on a resume that did not open anything — the strip above the project
 * list, not P03's recovery screen, which `ProjectDetail` draws inside the project itself.
 *
 * **The region stays MOUNTED and its text is swapped**, which is a fix in both directions.
 * `resolveStored` re-resolves on every `onProjectsChanged` delivery, so a `v-if` around a
 * `role="status"` re-inserted the region — and re-announced an unchanged sentence — every time
 * any project note in the vault was touched (P03: "announce without repeated live-region
 * noise"). The opposite failure is the same element's: a live region inserted with its text
 * already in it is not reliably announced at all.
 *
 * **Retry is offered only where the error policy permits one**, which is the read/access
 * failure. A confirmed absence has nothing to retry — on `missing-project` the stored target has
 * already been cleared, so the button only made the explanation vanish — and `indexing` is
 * LOADING rather than failure: `onProjectsChanged` re-resolves it on its own, and a loading line
 * must never grow a retry.
 */
import { tr } from '../i18n/strings';
defineProps<{ message: string | null; projectId: string | null; retryable: boolean; loading: boolean }>();
defineEmits<{ retry: []; openProject: [] }>();
</script>

<template>
	<section
		class="rp-resume-recovery"
		:class="{ 'rp-resume-recovery--idle': message === null, 'rp-resume-recovery--loading': loading }"
	>
		<p
			class="rp-resume-recovery__message"
			role="status"
		>
			{{ message ?? '' }}
		</p>
		<button
			v-if="retryable"
			type="button"
			class="rp-resume-recovery__retry"
			@click="$emit('retry')"
		>
			{{ tr('view.project.resume-retry') }}
		</button>
		<button
			v-if="projectId !== null"
			type="button"
			class="rp-resume-recovery__open"
			@click="$emit('openProject')"
		>
			{{ tr('view.project.resume-open-project') }}
		</button>
	</section>
</template>

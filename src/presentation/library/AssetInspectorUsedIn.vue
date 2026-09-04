<script setup lang="ts">
/**
 * §3.5 section 3 — **Used in**: one row per project that references this asset, its requirement
 * count, and the project's path wherever the query supplies one.
 *
 * **The row's KEY is `projectId`, never the name-and-path pair.**
 * `withPathsWhereAmbiguous` sets `projectPath` to a folder, and two notes declaring
 * `type: renovation-project` can sit in ONE directory under different filenames — so two
 * projects can share a display name AND a folder, and a composite key would give two different
 * projects one identity. `ReferencingGroup.projectId` is unique by construction.
 *
 * **`projectPath` is read against `undefined`, never for truthiness.** `''` is a supplied
 * answer — `projectFolderOf` is `parentOf(path)` and `parentOf` slices to the last `/`, so a
 * `Project.md` at the vault root derives the empty string — and a truthy test suppresses
 * exactly the row the path was added to disambiguate, drawing it identically to a row whose
 * path was never supplied. The empty string renders a ROOT LABEL rather than nothing.
 *
 * **A group whose project holds a price override carries a printed MARK and a WORD**, never a
 * tint alone (§11 item 6): the Definition section's own claim is that *a price correction
 * reaches every room it was used in*, and an unmarked row makes that false by omission —
 * directly above the field that makes the correction.
 *
 * **Three states, because this is a SECOND read** that can be in flight or refuse while the
 * catalogue around it is perfectly readable. The difference between *nobody uses this* and
 * *I could not find out who uses this* is the difference between a safe deletion and a
 * destructive one, which is why `Delete` — the panel's, not this section's — is withheld until
 * this read has succeeded.
 *
 * **It is a SNAPSHOT taken at selection and does not subscribe.** `RequirementEventPayload` is
 * `{ requirementId, projectId }` and cannot be filtered to the selected asset; undoing an
 * assignment publishes nothing at all; and an unfiltered re-run is O(every requirement in the
 * vault) with a note read each. Reselecting is the refresh.
 */
import { computed } from 'vue';
import type { AppError } from '../../core/errors/AppError';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type { ProjectId } from '../../domain/project/ProjectId';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import type { SectionStatus } from './ticketedSection';

const props = defineProps<{
	groups: readonly ReferencingGroup[];
	/** Which of those projects price this asset themselves — §11 item 6's marks. */
	overriding: readonly ProjectId[];
	status: SectionStatus;
	error: AppError | null;
}>();

interface UsedInRow {
	readonly projectId: ProjectId;
	readonly label: string;
	/** `null` where the query supplied no path — NOT where it supplied an empty one. */
	readonly path: string | null;
	readonly overridden: boolean;
}

const rows = computed((): readonly UsedInRow[] => {
	const overriding = new Set(props.overriding);
	return props.groups.map((group) => ({
		projectId: group.projectId,
		label: tr('view.asset-library.used-in.project', {
			name: group.projectName,
			count: String(group.requirementIds.length),
		}),
		path:
			group.projectPath === undefined
				? null
				: group.projectPath === ''
					? tr('view.asset-library.used-in.vault-root')
					: group.projectPath,
		overridden: overriding.has(group.projectId),
	}));
});
</script>

<template>
	<section class="rp-al-inspector__section">
		<h4 class="rp-al-inspector__title">
			{{ tr('view.asset-library.used-in') }}
		</h4>
		<p
			v-if="status === 'idle' || status === 'loading'"
			class="rp-al-note"
		>
			{{ tr('view.asset-library.used-in.loading') }}
		</p>
		<p
			v-else-if="status === 'failed'"
			class="rp-al-inspector__refusal"
		>
			{{ error === null ? tr('view.asset-library.used-in.failed') : trError(error) }}
		</p>
		<ul
			v-else-if="rows.length > 0"
			class="rp-al-used"
		>
			<li
				v-for="row in rows"
				:key="row.projectId"
				class="rp-al-used__row"
				:data-project-id="row.projectId"
			>
				<span class="rp-al-used__project">
					<span class="rp-al-used__name">{{ row.label }}</span>
					<span
						v-if="row.path !== null"
						class="rp-al-used__path"
					>{{ row.path }}</span>
				</span>
				<!-- A mark AND a word (§85), never a tint alone: the mark is CSS-drawn and
				     `aria-hidden`, so the word is the whole of the accessible name. -->
				<span
					v-if="row.overridden"
					class="rp-al-used__override"
				>
					<span
						class="rp-al-used__override-mark"
						aria-hidden="true"
					/>
					{{ tr('view.asset-library.used-in.overridden') }}
				</span>
			</li>
		</ul>
		<p
			v-else
			class="rp-al-note"
		>
			{{ tr('view.asset-library.used-in.none') }}
		</p>
	</section>
</template>

<!--
	§5.1a's repair strip: the ADDITIVE `.rp-view-notice` region above the shelves, naming each
	note this build could draw no row for, with its reason, and offering `Open note` **per row
	rather than for every row**.

	A component of its own rather than markup inlined in `AssetLibraryRoot.vue`, and the reason
	is measured rather than stylistic: with this block inline, `npm run analyze` reported the
	root's template at cognitive complexity 24 and FAILED the health gate on it — three nested
	conditionals inside a `v-for` inside the ready branch, each level weighted by its depth. The
	tool's own suggested remedy is a `fallow-ignore-next-line complexity` comment, and this
	repository's rule is that a tool's suggested fix is a hypothesis: a suppression would have
	kept the nesting and hidden the signal, where the strip is a genuine seam — §5.1a's own
	region, with its own two rules and no dependency on anything else the root draws.

	Both of those rules live HERE, with the markup they decide:
	- **`Open note` is withheld from a `read-failed` whose code is the future-schema refusal**,
	  and from nothing else. The note was written by a build newer than this one, so opening it
	  invites an edit that cannot repair anything — *an action that cannot work is worse than no
	  action*. The guard is EXACT rather than reason-wide: a `read-failed` for any other cause
	  is a note this build really could open, and `no-id`/`duplicate-id` carry `code: null` and
	  are never this code.
	- **Each reason gets its own sentence.** Four arms, because a strip that tells a user to fix
	  the wrong thing is worse than one that says less.

	The row's action is EMITTED rather than handled: what to do after opening a note — the
	`'missing'` re-read — is a fact about the listing this strip was drawn from, which the root
	owns. This component knows a path and a reason and nothing about hydration.

	**No `role="status"`, and that is a correction rather than an omission.** It carried one for
	a review round, on a region that does not exist until its content does — the exact shape
	design slice 13's Toast finding refuses by name, and one a screen reader announces nothing
	for. Rather than keep an attribute that claims a behaviour it cannot have, the strip is what
	it actually is: a static region rendered with the pane. §5.1a asks for a repair strip and
	names no announcement; the one announcement §6.1 DOES ask for — the search result count — is
	a persistent, always-drawn region in `AssetLibraryRoot.vue`, written into on each keystroke.

	`rp-al-repair` beside the shared `rp-view-notice`: the strip's three-part rows are this
	surface's own layout, and `styles/view.css`'s `.rp-view-notice` was written for a single
	`<p>`. Declaring the row rules under a library-specific class leaves the shared one untouched
	rather than widening a rule `ViewRoot`'s own strip also draws with.
-->
<script setup lang="ts">
import type { UnreadableEntry } from '../../application/queries/ListCatalogueEntries';
import { tr } from '../i18n/strings';

defineProps<{ entries: readonly UnreadableEntry[] }>();
const emit = defineEmits<{ open: [path: string] }>();

/** What `MigrationRunner.migrateToLatest` raises for a note from a newer build
 *  (`${kind}.schema-version-unsupported`). */
const FUTURE_SCHEMA_CODE = 'asset.schema-version-unsupported';

function isFutureSchema(entry: UnreadableEntry): boolean {
	return entry.reason === 'read-failed' && entry.code === FUTURE_SCHEMA_CODE;
}

function canOpenNote(entry: UnreadableEntry): boolean {
	return !isFutureSchema(entry);
}

function reasonLabel(entry: UnreadableEntry): string {
	if (isFutureSchema(entry)) return tr('view.asset-library.unreadable.future-schema');
	if (entry.reason === 'no-id') return tr('view.asset-library.unreadable.no-id');
	if (entry.reason === 'duplicate-id') return tr('view.asset-library.unreadable.duplicate-id');
	return tr('view.asset-library.unreadable.read-failed');
}
</script>

<template>
	<div class="rp-view-notice rp-al-repair">
		<p>{{ tr('view.asset-library.some-unreadable', { count: String(entries.length) }) }}</p>
		<ul>
			<li
				v-for="entry in entries"
				:key="entry.path"
			>
				<span class="rp-view-notice__path">{{ entry.path }}</span>
				<span class="rp-view-notice__reason">{{ reasonLabel(entry) }}</span>
				<button
					v-if="canOpenNote(entry)"
					type="button"
					@click="emit('open', entry.path)"
				>
					{{ tr('view.asset-library.some-unreadable.open-note') }}
				</button>
			</li>
		</ul>
	</div>
</template>

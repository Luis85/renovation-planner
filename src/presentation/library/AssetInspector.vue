<script setup lang="ts">
/**
 * §3.5's inspector: how one catalogue entry is defined, what shape it has, which projects lean
 * on it, and the three gestures that act on it. Ported from `src/prototypes/AssetInspector.vue`
 * — the mock's markup and section order, against Tasks 4/9/10's real read models rather than
 * its own invented fixture, and with every one of the states the mock could not represent.
 *
 * **THE SUBJECT IS THE `assetId` PROP, never `context.assetId` — and the REASON has moved
 * since this was written, while the rule has not.** The original reason was a DIVERGENCE: Task
 * 13 held `selectedId` as a local ref in `AssetLibraryRoot.vue` and `onSelect` wrote only that
 * ref, since the context is `DeepReadonly` and no component may write it — so from the first
 * click the panel and the marked row would have named different assets. Task 16a's write-back
 * closed exactly that: `onSelect` assigns `selectedId` itself and then publishes, and
 * `AssetLibraryView` writes its own refs — so the root's `watch` on `context.assetId` fires
 * with the value the tree already holds. The two agree.
 *
 * **Stated that way rather than as a timing guarantee, which is the correction a re-review had
 * to make.** The first version of this sentence said the watch assigns `selectedId` "in the
 * same synchronous stretch", and it is wrong twice over: `onSelect` sets that ref DIRECTLY,
 * before it publishes at all, so the watch is not what assigns it on this path — and a `watch`
 * at Vue's default `flush: 'pre'` queues its callback rather than running inline, so no
 * synchronous claim about it would be true anywhere. The careful wording already existed twice
 * in the tree and neither place needed changing: `AssetLibraryRoot.vue`'s own header says the
 * watches "fire with the value they already hold", and `AssetLibraryContext.publishViewState`
 * says the watch "fires with the value the tree already holds". Both make the idempotence point
 * without promising a flush, which is what this sentence now does too.
 *
 * **The rule survives its reason, and this is the paragraph that must not be read as inviting
 * the switch.** What the prop buys now is that the panel is drawn from the SAME value the row's
 * `selected` mark is drawn from — one authority for one fact — rather than from a second read
 * of it kept equal by a watch. A panel wired to the context would be correct only for as long
 * as that watch stays unconditional, and nothing here would fail on the day it does not. A
 * prop also keeps this component mountable on its own, which `assetInspector.test.ts` and the
 * harness both depend on.
 *
 * §6.3's `''` sentinel gets its second consumer here: `''` means nothing selected, `null` after
 * `selectionOf`, and this panel's resting line is what that value draws.
 *
 * **This panel is drawn from the root's READY branch**, which is what makes resolving an id
 * against the listing meaningful: mounted while the catalogue read is still out, every id would
 * resolve to no entry and no unreadable row, and the panel would report a perfectly good asset
 * as gone. `AssetLibraryRoot.vue` keeps that placement — one `v-if` over `.rp-al-main`'s
 * contents, with §4's loading line as its `v-else` — and this file states the precondition
 * rather than adding a second loading branch beside the one §4 already owns.
 *
 * **Selection is what STARTS the three reads.** `AssetSelectionStore.select` clears and
 * restarts all three ticketed sections (§5.5), and this is its one caller — a click, a restored
 * leaf, and a re-click on the already-selected row all arrive here as a changed or re-asserted
 * prop, and the store deliberately does not guard an unchanged id so that re-selecting is the
 * retry this surface offers for a failed section.
 *
 * **`Open designer` is withdrawn for EVERY design refusal**, per §3.5's own table: the designer
 * hydrates through the same `GetAssetDesign`, whose `execute` is `if (isErr(snapshot)) return
 * snapshot;`, so it reaches the identical failed state and offers only a Retry. The button
 * would cost a navigation to repeat the refusal the user is already reading, which is worse
 * than inert.
 *
 * No `<style>` block, ever (`vue/no-restricted-block`): Task 15 owns
 * `styles/asset-library-inspector.css`.
 */
import { computed, useId, watch } from 'vue';
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { useAssetSelectionStore } from '../stores/AssetSelectionStore';
import AssetInspectorFields from './AssetInspectorFields.vue';
import AssetInspectorShape from './AssetInspectorShape.vue';
import AssetInspectorUsedIn from './AssetInspectorUsedIn.vue';

const props = defineProps<{ assetId: AssetId | null }>();

/**
 * `delete` carries the id because the panel is not where the gesture is RESOLVED: the
 * reference-resolution flow opens dialogs, and `DialogHost` plus every dialog-opening gesture
 * on this surface (`onCreateAsset`) already live in the root. `back` is §6.2's narrow-
 * composition control, which the shell decides the visibility of.
 */
const emit = defineEmits<{ back: []; delete: [assetId: AssetId] }>();

const context = useAssetLibraryContext();
const library = useAssetLibraryStore();
const selection = useAssetSelectionStore();

watch(
	() => props.assetId,
	(assetId) => {
		void selection.select(assetId, context.queries);
	},
	{ immediate: true },
);

/** The catalogue row for the selected id, read from the WHOLE listing — §6.1's search filters
 *  what is drawn, never what is selected. */
const entry = computed(() => (props.assetId === null ? null : library.entryFor(props.assetId)));

/** The §5.1a listing's own row for this id, or `null`. At most one entry carries any given id,
 *  which is the property a selection resolves against. */
const unreadable = computed(() =>
	props.assetId === null
		? null
		: (library.unreadable.find((row) => row.assetId === props.assetId) ?? null),
);

/**
 * §3.5's panel-level table, one level up from the Shape section's.
 *
 * `unreadable` is what makes *the note could not be read* tellable from *the asset is gone* —
 * §5.1a's listing omits an asset whose note refused, so without it a selection would collapse
 * to a gone state about a note sitting on disk.
 *
 * The future-schema row is a THIRD state rather than a wording of the second:
 * `MigrationRunner` raises `` `${kind}.schema-version-unsupported` `` and the remedy is to
 * upgrade the plugin, so `Open note` invites an edit that cannot repair anything — *an action
 * that cannot work is worse than no action*, which is this section's own rule for
 * `asset-geometry.unusable-id` applied to the door one level up.
 */
type PanelState = 'resting' | 'ready' | 'note-unreadable' | 'note-future-schema' | 'gone';

const state = computed((): PanelState => {
	// The two lookups are read BEFORE the resting test rather than after it, so a resting panel
	// still exercises the `null` arm of each — an early return would leave both computeds
	// unevaluated whenever nothing is selected, and a lazy `computed` nothing evaluates is a
	// branch that reads as checked and is not.
	const found = entry.value;
	const row = unreadable.value;
	if (found !== null) return 'ready';
	if (row !== null) {
		return row.code !== null && row.code.endsWith('.schema-version-unsupported')
			? 'note-future-schema'
			: 'note-unreadable';
	}
	return props.assetId === null ? 'resting' : 'gone';
});

/**
 * The panel-level failure sentence — THREE arms, one per row of §3.5's own table, and read by the
 * template only from the branch that has one.
 *
 * **It shipped with two, and the future-schema row got the REPAIRABLE row's wording.** The
 * actions were already right (`canOpenNote` withholds `Open note` for it), so a user whose note
 * came from a newer build was told it "could not be read", offered nothing, and never told the
 * remedy — which is the dead end §3.5 refuses by name. *An action that cannot work is worse than
 * no action* is the argument for withholding the BUTTON; it is not an argument for withholding
 * the explanation, and the docblock on `state` above already said this was "a THIRD state rather
 * than a wording of the second" while this function made it exactly that.
 */
const failure = computed((): string => {
	const row = unreadable.value;
	if (row === null) return tr('view.asset-library.asset-gone');
	return state.value === 'note-future-schema'
		? tr('view.asset-library.note-future-schema', { path: row.path })
		: tr('view.asset-library.note-unreadable', { path: row.path });
});

/**
 * `Open designer` and `Delete` are withdrawn for an unreadable note and the reason differs per
 * action: the designer needs a shape for an asset the catalogue could not parse, and `Delete`
 * is specified against the *Used in* read, which this panel does not have for it.
 */
const canOpenDesigner = computed(
	() => state.value === 'ready' && selection.designStatus !== 'failed',
);

/** `Open note` is the ONE action a repairable unreadable note gets, and it stays available for
 *  a readable asset too — the raw note is where broken frontmatter is repaired, exactly as the
 *  designer is where a damaged shape is. It is withheld only for the future-schema row. */
const canOpenNote = computed(() => state.value === 'ready' || state.value === 'note-unreadable');

/**
 * §3.5: `Delete` is unavailable while the usage read has not SUCCEEDED, which is a wider gate
 * than "failed" on purpose — an edit stays available, because a price correction is recoverable
 * and a deletion is the gesture this panel exists to inform. `aria-disabled` rather than
 * `disabled` so the reason below stays in the accessibility tree, with the click guarded in
 * `onDelete`.
 */
const canDelete = computed(() => state.value === 'ready' && selection.usedInStatus === 'ready');

/**
 * The sentence on a withheld `Delete`, or `null` — and it is NARROWER than the withholding above,
 * which is the whole of this member's reason for existing.
 *
 * §3.5 puts *"Where this is used could not be checked"* under its **Refused** bullet alone; the
 * *In flight* bullet asks for a loading line, which `AssetInspectorUsedIn` draws. This rendered
 * unconditionally on `!canDelete`, so for the whole of every selection's two reads the panel
 * claimed a FAILURE three elements below a line saying the read was proceeding — a surface
 * contradicting itself, invisible against a fake that answers in the same tick. While the read is
 * in flight the control is disabled and says nothing, because the section above it is already
 * saying the true thing.
 */
const deleteReason = computed((): string | null =>
	selection.usedInStatus === 'failed' ? tr('view.asset-library.used-in.failed') : null,
);

/** Minted rather than derived from the asset id: an id a user can author may hold whitespace,
 *  and `aria-describedby` is a whitespace-separated IDREF LIST — the same rule `AssetRow`
 *  states for its own mark description. */
const deleteReasonId = useId();

async function onOpenNote(): Promise<void> {
	const row = unreadable.value;
	// A path when the listing gave us one — the two unreadable sources that carry no usable id
	// cannot be SELECTED at all, so a selected unreadable row always has both — and the id-keyed
	// door otherwise, since a readable catalogue entry carries no path.
	if (row !== null) {
		if ((await context.openNote(row.path)) === 'missing') {
			await library.hydrate(context.queries, context.indexScanCompleted);
		}
		return;
	}
	// The id-keyed door acts on `'missing'` exactly as its path-keyed sibling above does: the
	// composition answers it when a LIVE index holds no note for the id, which means the listing
	// this panel resolved its subject against is stale.
	if (props.assetId !== null && (await context.openAssetNote(props.assetId)) === 'missing') {
		await library.hydrate(context.queries, context.indexScanCompleted);
	}
}

function onOpenDesigner(): void {
	if (props.assetId !== null) void context.openDesigner(props.assetId);
}

function onDelete(): void {
	if (!canDelete.value || props.assetId === null) return;
	emit('delete', props.assetId);
}
</script>

<template>
	<aside
		class="rp-al-inspector"
		:class="{ 'rp-al-inspector--rest': state === 'resting' }"
		:data-inspector-state="state"
	>
		<button
			type="button"
			class="rp-al-inspector__back"
			@click="emit('back')"
		>
			{{ tr('view.asset-library.back') }}
		</button>
		<p
			v-if="state === 'resting'"
			class="rp-al-inspector__rest"
		>
			{{ tr('view.asset-library.unselected') }}
		</p>
		<template v-else-if="entry !== null && assetId !== null">
			<h3 class="rp-al-inspector__name">
				{{ entry.name }}
			</h3>
			<!--
				§3.5's keying rule: a `:key` on the fields region re-establishes exactly the
				remount `RequirementRow` gets for free from its own `v-for`, discarding a draft
				and an inline error that belong to the asset the user has just left. The subject
				test on the OUTCOME is the other half and lives in the keyed component.
			-->
			<AssetInspectorFields
				:key="assetId"
				:entry="entry"
			/>
			<AssetInspectorShape
				:design="selection.design"
				:status="selection.designStatus"
				:error="selection.designError"
				:background="entry.background"
			/>
			<AssetInspectorUsedIn
				:groups="selection.usedIn"
				:overriding="selection.overriding"
				:status="selection.usedInStatus"
				:error="selection.usedInError"
			/>
		</template>
		<p
			v-else
			class="rp-al-inspector__failure"
		>
			{{ failure }}
		</p>
		<div class="rp-al-actions">
			<button
				v-if="canOpenDesigner"
				type="button"
				class="rp-al-action rp-al-action--designer"
				@click="onOpenDesigner"
			>
				{{ tr('view.asset-library.open-designer') }}
			</button>
			<button
				v-if="canOpenNote"
				type="button"
				class="rp-al-action rp-al-action--note"
				@click="void onOpenNote()"
			>
				{{ tr('view.asset-library.open-note') }}
			</button>
			<!--
				`aria-disabled` rather than `disabled`, so the control keeps its tab stop and the
				reason below is reachable — a disabled button is removed from the accessibility
				tree along with whatever describes it, which is precisely the sentence §3.5 asks
				to be SHOWN on the control. `onDelete` carries the guard, because an
				`aria-disabled` button is still clickable.
			-->
			<button
				v-if="state === 'ready'"
				type="button"
				class="rp-al-action rp-al-action--delete"
				:aria-disabled="canDelete ? undefined : 'true'"
				:aria-describedby="deleteReason === null ? undefined : deleteReasonId"
				@click="onDelete"
			>
				{{ tr('view.asset-library.delete') }}
			</button>
		</div>
		<p
			v-if="state === 'ready' && deleteReason !== null"
			:id="deleteReasonId"
			class="rp-al-actions__reason"
		>
			{{ deleteReason }}
		</p>
	</aside>
</template>

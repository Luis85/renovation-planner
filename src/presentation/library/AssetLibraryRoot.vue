<script setup lang="ts">
/**
 * The Vue root of the Asset library view — one isolated app per Obsidian `ItemView` (ADR-004,
 * SDD §12), exactly as `ViewRoot.vue` and `AssetDesignerRoot.vue` are for their own surfaces.
 *
 * **Four shell regions** (§3, "the Asset designer's count rather than the Plan editor's five"):
 * toolbar, shelves, inspector, status. Task 13 drew three of them; Task 16a mounts the fourth.
 * What is drawn INSIDE the shelves region moved to `AssetLibraryBody.vue` in the same commit
 * and for the reason that file's own header measures — this root owns the SHELL, the doors
 * (`New asset`, the failure retry), §6.2's focus handoff and §6.3's view state.
 *
 * **`data-selected-asset-id` names the asset this PANE IS SHOWING, which is the selection
 * except while a search is running**, and that widening is §6.1's narrow-composition rule
 * rather than a second meaning invented here. Below 35rem the inspector owns the whole pane, so
 * a user typing into the search field filtered a list they could not see and the surface
 * appeared to ignore them; the shipped stylesheet hides `.rp-al-body` off exactly this
 * attribute, so returning the narrow composition to the shelves IS emptying it. Writing a
 * second CSS rule keyed on "is a search running" would be two answers to one question, which is
 * what `styles/asset-library.css` already warns against. `showingSelection` is the flag, and it
 * is named for what it MEANS rather than for how it gets set — the prototype's own review found
 * three successive booleans named after their trigger and each one wrong for a different
 * transition.
 *
 * `data-expanded-categories` is unchanged: it reads the context directly, which the write-back
 * below keeps in step with what is drawn.
 *
 * **What is DRAWN follows the view state, and the first version of this file did not.**
 * `selectedId` and `expandedCategories` are seeded from the context pair at setup AND kept in
 * step with it by two `watch`es, because for one review round they were a second,
 * desynchronised copy. Both directions are pinned by `assetLibraryRoot.test.ts`'s *follows the
 * view state* cases.
 *
 * The refs are LOCAL rather than the context's own, because the context's are
 * `DeepReadonly<Ref<T>>` by deliberate design (`assetLibraryContext.test-d.ts` proves a write
 * through them is a compile error). The write-back Task 13 recorded as missing is
 * `context.publishViewState` — the view's own callback, which writes ITS refs and asks Obsidian
 * to record the state; the watches above then fire with the value they already hold, which is
 * what makes the round trip idempotent rather than re-entrant.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's marketplace
 * rejects inline styles and this plugin's CSS lives in `styles/`, assembled into one sheet.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DialogHost from '../dialogs/DialogHost.vue';
import ViewFailure from '../components/ViewFailure.vue';
import NewAssetForm from '../views/NewAssetForm.vue';
import AssetInspector from './AssetInspector.vue';
import AssetLibraryBody from './AssetLibraryBody.vue';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { focusRowAt, focusWithin, rowPositionOf, shelvesWithdrawn } from './shelfFocus';
import { deleteAssetWithReferences } from './deleteAssetFlow';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { AssetId } from '../../domain/asset/AssetId';

const context = useAssetLibraryContext();
const store = useAssetLibraryStore();
const dialogs = useDialogStore();

/** §6.2's two focus anchors that live in THIS file's markup: the shell the handoff searches,
 *  and the search field it falls back to when the target it wanted is not laid out. */
const shellEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

/**
 * The SHELL's read, on every occasion the shell runs one — open, a retry, and the `rehydrate`
 * `AssetLibraryBody` emits when a repair row turns out to name a note that is gone.
 *
 * **It is not the view's only call site, and the sentence here said it was.** Measured in the
 * edit that replaced it: `grep -rEn "(store|library)\.hydrate\(" src/presentation/library/`
 * prints THREE — this function, and `AssetInspector.vue`'s two repair doors. The claim was
 * vacuously safe while nothing mounted the panel; Task 16a mounting it is what made it false,
 * and the docblock is where this repository's rule says to look — an "only place X" sentence
 * gets a `grep` in the SAME edit.
 *
 * **THREE call sites and FOUR calls, which are different facts.** Task 16b's `onDelete` below
 * calls THIS function rather than the store, so the grep above still prints three; it is
 * re-measured here rather than assumed, because a count of call sites and a count of callers
 * of `hydrate` are exactly the pair that drifts. Why the delete awaits one at all is on
 * `onDelete` itself.
 *
 * **The PATTERN is escaped so that it cannot match this paragraph**, which is the correction a
 * re-review had to make: the first version quoted a bare dot-hydrate pattern and reported three
 * where it printed FOUR, the fourth being the docblock line quoting the pattern. *An instrument
 * written inside the text it measures counts itself* — CLAUDE.md records it against a
 * `MIGRATION_SET` grep that printed ten for an array of nine, and this branch has now produced
 * it twice. The escapes above (`\.`, `\(`) are literal backslashes in this comment and
 * metacharacters to `grep -E`, so the quoted text is not itself a match; the alternation is
 * what makes that possible without also excluding a real call site.
 *
 * The asymmetry between the two regions is deliberate rather than an oversight of the
 * extraction. `AssetLibraryBody.onOpenNoteRow` is THIS function's own body, moved out for a
 * budget, over `context.openNote` — the door the shell already had — so a `hydrate` call there
 * would be a second spelling of the line above it. `AssetInspector.onOpenNote` reaches
 * `context.openAssetNote`, an id-keyed door the shell does not have and cannot resolve, so its
 * re-read is its own rather than a copy of this one.
 *
 * What three callers of one store would cost, and why they cost nothing: `AssetLibraryStore
 * .hydrate` is ticketed (`latestHydration`), so a slower earlier read cannot land over a newer
 * one. What is still refused is a second read MODEL — another query, another shape, another
 * answer to what this pane is showing — which is what `PlanEditorRoot` and `ViewRoot` each
 * state about their own `hydrate` and what remains true here.
 */
function hydrate(): Promise<void> {
	return store.hydrate(context.queries, context.indexScanCompleted);
}

/**
 * Registered at setup and disposed on unmount, the same shape and for the same reason
 * `ViewRoot`'s `onProjectsChanged` subscription already carries: Obsidian reuses this view, so
 * a listener outliving its Vue app would re-hydrate a store nothing renders and stack another
 * on the next open.
 */
onMounted(() => {
	void hydrate();
});
onBeforeUnmount(
	context.onLibraryChanged((change) => {
		void store.applyChange(change, context.queries, context.indexScanCompleted);
	}),
);

/**
 * The whole in-place failure state, or `null` when there is nothing to fail about —
 * `ViewRoot.failure`'s identical shape, ported rather than shared: the two are siblings
 * (§2, "a sibling of that whole ladder rather than a state inside it"), and the headline key
 * differs (`view.asset-library.failed.headline`).
 *
 * The retry is withheld from a bootstrap failure for the identical reason: `surfaceFor`
 * answers `session-failure` for a session that composed no query services at all, and
 * re-running a query that was never wired would be the live-control-that-does-nothing slice
 * 14's own amendment refuses.
 */
const failure = computed(() => {
	const cause = store.error;
	if (cause === null) return null;
	const session = surfaceFor(cause, viewHydrationOrigin(cause)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'view.asset-library.failed.headline'),
		body: trError(cause),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

/**
 * §3.1's `New asset` — `ViewRoot.onCreateAsset`'s identical sequence, over the SAME
 * `NewAssetForm` and the guarded `createAsset`/`setAssetFootprintFromDimensions` pair. It does
 * NOT re-hydrate on success: `AssetCreated` already reaches `catalogue: true` on
 * `AssetLibraryChange`, so the `onLibraryChanged` subscription above re-reads the listing on
 * its own.
 */
const newAssetBusy = ref(false);

async function onCreateAsset(): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-asset.title'),
		component: NewAssetForm,
		props: {
			createAsset: (input: CreateAssetInput) => context.commands.createAsset.execute(input),
			setFootprintFromDimensions: (input: SetAssetFootprintFromDimensionsInput) =>
				context.commands.setAssetFootprintFromDimensions.execute(input),
			busy: newAssetBusy,
			logger: context.logger,
			defaultCurrency: context.commands.defaultCurrency,
		},
		busy: newAssetBusy,
	});
	if (result === 'cancel') return;
	await context.openDesigner(result.values as AssetId);
}

/**
 * §3.6's `54 assets`, and `''` until the read has actually answered — a count is a claim, and
 * an empty store asserting `0 assets` while the read is in flight is a false one.
 */
const assetCount = computed(() =>
	store.status === 'ready' ? tr('view.asset-library.assets', { count: String(store.total) }) : '',
);

/** §6.3's own sentinel: `context.assetId` is `''` for "nothing selected", never `null`, and
 *  `AssetRow`'s `selected` prop compares against an id — so the two vocabularies meet here and
 *  in exactly one place. */
function selectionOf(assetId: string): AssetId | null {
	return assetId === '' ? null : (assetId as AssetId);
}

/**
 * The shelves' own selection and expansion, SEEDED from the context at setup and WATCHED after
 * it — §6.3's whole mechanism, since the view state is what a restored leaf and every
 * `setState` speak through.
 */
const expandedCategories = ref<ReadonlySet<string>>(new Set(context.expanded.value));
const selectedId = ref<AssetId | null>(selectionOf(context.assetId.value));

watch(context.assetId, (assetId) => {
	selectedId.value = selectionOf(assetId);
});
watch(context.expanded, (categories) => {
	expandedCategories.value = new Set(categories);
});

/**
 * §6.1: is this pane showing the SELECTION, or the LIST? One line is the whole state machine —
 * typing anything shows the list, because you are looking for something; emptying the field
 * shows the selection again, because you have stopped; picking a row shows it too.
 */
const showingSelection = ref(true);
watch(
	() => store.searching,
	(searching) => {
		showingSelection.value = !searching;
	},
);

/**
 * What the shell ANNOUNCES it is showing — see this file's header for why the attribute means
 * the pane's subject rather than the raw selection.
 *
 * Reads `selectedId` rather than `context.assetId`, which are kept equal by the `watch` above
 * and are still TWO reads of one fact: the attribute the stylesheet hides `.rp-al-body` off and
 * the prop the panel is drawn from would then come from different places, and on the day that
 * watch is made conditional the marked row and the hidden body would disagree with nothing here
 * failing. One authority, and it reads the same.
 */
const paneAssetId = computed(() => (showingSelection.value ? (selectedId.value ?? '') : ''));

/** §6.3's write half: one call carries both values, because the view publishes one state. */
function publish(assetId: AssetId | null, expanded: ReadonlySet<string>): void {
	context.publishViewState(assetId ?? '', [...expanded]);
}

/**
 * §6.2's focus handoff, in the one shape the prototype's own review rounds landed on: the
 * question "did the pane swap" is asked of the DOM, and WHICH MOMENT it is asked at differs by
 * direction. Selecting HIDES the shelves, so the forward swap is only visible after the render;
 * `Back to library` REVEALS them, so by the time this ran the answer would be "laid out" and
 * the return would be skipped every time, in every layout. The predicate is therefore passed
 * in, and the back path takes its reading before it mutates anything.
 */
async function focusAfterSwap(selector: string, swapped: () => boolean): Promise<void> {
	await nextTick();
	if (!swapped()) return;
	focusWithin(shellEl.value, selector, searchEl.value);
}

function toggleShelf(category: string): void {
	const next = new Set(expandedCategories.value);
	if (!next.delete(category)) next.add(category);
	expandedCategories.value = next;
	publish(selectedId.value, next);
}

function onSelect(assetId: AssetId): void {
	selectedId.value = assetId;
	showingSelection.value = true;
	publish(assetId, expandedCategories.value);
	void focusAfterSwap('.rp-al-inspector__back', () => shelvesWithdrawn(shellEl.value));
}

/**
 * §6.2's mirror: leaving the inspector returns focus to the row it was opened from — and
 * REVEALS that row, because a selection can outlive its shelf being open. Returning focus to a
 * row that is in the DOM and not laid out focuses nothing at all, with the inspector already
 * gone, which is the stranding this pair exists to prevent.
 *
 * The reveal is withheld while a search is running: the row is drawn in §6.1's flat Results
 * list whatever its shelf is doing, so expanding here would silently rewrite an expansion state
 * §6.1 says is the user's.
 *
 * **`onDelete` answers the same collapsed-shelf situation the OPPOSITE way, deliberately, and
 * the two reasons are written in both places because a divergence stated once reads as an
 * oversight from the other side.** The difference is WHOSE row the destination is. This one
 * returns to the row the user CHOSE and then hid; revealing it restores what they were looking
 * at, and the alternative strands the caret on `<body>`. A deletion's destination is a NEIGHBOUR
 * the user never picked, so expanding a shelf they deliberately collapsed — to show them a row
 * they did not ask for — is the very rewrite the paragraph above withholds this reveal for,
 * arriving on a different trigger. §3.5's chain names no reveal and ends at the search field,
 * which is what `onDelete` does.
 *
 * `CSS.escape`: an asset id is `z.string().min(1)` in the frontmatter schema, so a
 * hand-authored one holding a quote or a backslash builds an invalid selector and
 * `querySelector` THROWS rather than missing.
 */
function onBack(): void {
	const leaving = selectedId.value;
	const swappingOut = shelvesWithdrawn(shellEl.value);
	const category = leaving === null || store.searching ? undefined : store.entryFor(leaving)?.category;
	const expanded = new Set(expandedCategories.value);
	if (category !== undefined) expanded.add(category);
	expandedCategories.value = expanded;
	selectedId.value = null;
	showingSelection.value = true;
	publish(null, expanded);
	// An EARLY EXIT rather than a behavioural guard, and saying so is the point: with it deleted
	// `CSS.escape(null)` builds `[data-asset-id="null"]`, which matches nothing, and the fallback
	// below does exactly what it does now — and `leaving === null` implies `paneAssetId === ''`,
	// so `swappingOut` was already false and `focusAfterSwap` would return at its own gate. No
	// case here reddens against removing it, deliberately: the case beside it asserts the
	// BEHAVIOUR, which is the same in both worlds.
	if (leaving === null) return;
	void focusAfterSwap(`[data-asset-id="${CSS.escape(leaving)}"]`, () => swappingOut);
}

/**
 * §3.5's `Delete` — the FIRST listener `AssetInspector`'s `delete` emit has ever had, and a
 * deliberately thin one: the resolution lives in `deleteAssetFlow.ts`, and this function is the
 * four things only the shell knows — which row was where, what to do with a refusal, what to do
 * with a FAULT, and where focus lands afterwards.
 *
 * **It is DETACHED, so both halves of SDD §65 are owed here and the first version of this
 * docblock claimed one of them for the other.** The binding is
 * `@delete="(id) => void onDelete(id)"`: the arrow returns `undefined`, so Vue's
 * `callWithAsyncErrorHandling` never sees a rejection and a thrown fault below this reached
 * neither the user nor a log. `runtime.ts`'s `createDeleteZoneAction` — the same flow's other
 * caller — has caught since slice 10, under a comment giving exactly this reason, and
 * `AssetLibraryDeps.logger` is declared as *"where a THROWN fault on a click-bound dispatch is
 * recorded"*. The seam, the precedent and the collaborator all existed; this function used none
 * of them while a sentence below asserted it matched the sibling "verbatim". Reported by review;
 * it is CLAUDE.md's oldest recurring shape — the docblock naming the invariant was the best
 * available description of the bug.
 *
 * **A second press is DROPPED rather than coalesced, and the two precedents in this repository
 * mean different things.** `openNote.ts`'s `openingByPath` COALESCES because its two callers
 * each want the outcome and one tab is the honest answer to two asks for it; slice 16's
 * `useFormCommit.submit` returns `false` on a second press because a repeated submit is one
 * intent pressed twice. A destructive command is the second: nobody awaits this handler, there
 * is no outcome for a second caller to receive, and joining the first press's promise would
 * dress an accidental repeat up as a request that was served. So `deleting` is a plain guard.
 *
 * It is what `onCreateAsset`'s `dialogs.current !== null` check does one function above, moved
 * to a flag because that check CANNOT work here: this flow awaits a query before it opens
 * anything, so during that window there is no dialog to see and the background is not yet
 * `inert`. Two presses inside it reach `dialogs.openDialog` twice (`DialogStackingError`, which
 * the catch above now records) or — for a referent-free asset, where no dialog opens at all —
 * dispatch twice, the second answering *"no longer there"* about a deletion that succeeded.
 *
 * **What the guard does NOT do is change the control**, and saying so is the point: `Delete`
 * stays clickable and says nothing while a deletion runs, exactly as `New asset` does. Making
 * it report busy is a prop on `AssetInspector` and a state §3.5's actions row does not describe.
 *
 * A plain `let` rather than a `ref` because nothing renders it — `newAssetBusy` beside it is a
 * `ref` only because `NewAssetForm` is handed it.
 *
 * **The position is captured BEFORE anything is dispatched**, because after a successful delete
 * there is no row left to ask. `rowPositionOf` is the whole of the reading: which list the row
 * was in, and its index in it. Nothing about which list is branched on here — §6.1's flat
 * *Results* list and a category shelf are the same `.rp-al-rows` element, so §3.5's two bullets
 * ("the shelf", "the same rule inside the flat Results list") are ONE rule over whichever list
 * the row was actually drawn into, rather than a condition on `store.searching` that would have
 * to be kept in step with what §6.1 mounts.
 *
 * **It does NOT reveal a collapsed shelf, where `onBack` does** — see that function's docblock
 * for the argument stated from the other side. In short: `onBack`'s destination is the row the
 * user chose and hid, and a deletion's is a neighbour they never picked, so expanding a shelf
 * they deliberately collapsed would rewrite an expansion state §6.1 says is theirs in order to
 * show them a row they did not ask for. §3.5's chain names no reveal, so the search field is the
 * answer for that state. Pinned as a POLICY rather than as a side effect: `assetDelete.test.ts`
 * asserts both that focus falls back AND that `data-expanded-categories` is unchanged, so a
 * build that started revealing — matching `onBack` — reddens an assertion about the expansion
 * rather than only one about the caret.
 *
 * **The inspector withdraws BEFORE the re-read**, which is the ordering that matters rather than
 * a tidy-up: below 35rem the shelves are hidden while something is selected, so a focus computed
 * with the selection still standing would find every candidate row not laid out and fall through
 * to the search field in exactly the composition §6.2 exists to serve.
 *
 * **And it AWAITS a listing read rather than trusting the event.** `AssetDeleted` does reach
 * `onLibraryChanged` as `catalogue: true`, but that subscription is fire-and-forget by
 * construction (`void store.applyChange(…)`), so the row's disappearance is not ordered against
 * this function at all and the focus would race the re-render. `hydrate` is ticketed
 * (`latestHydration`), so the event-driven read landing beside this one cannot regress it, and a
 * second listing read per deletion is what buys a deterministic moment to place the caret at.
 *
 * A REFUSAL is `notifyOperationFailure` and a FAULT is `notifyFault`, which is the Plan editor's
 * own delete action in both halves rather than — as this sentence said for one commit — in the
 * one half it had. The refusal reason is that action's: the DECISION half already happened, the
 * flow opened slice 15's modal and the user answered it, so what lands there is the command
 * refusing AFTER that answer — an explicit operation like any other rather than a second
 * decision to put in front of them. The fault reason is `notifyFault`'s own: mapped once and
 * LOGGED as well as printed, under an event name that says which door it came through.
 * `cancelled` is neither, and says nothing.
 */
let deleting = false;

async function onDelete(assetId: AssetId): Promise<void> {
	if (deleting) return;
	deleting = true;
	try {
		const position = rowPositionOf(shellEl.value, assetId);
		const outcome = await deleteAssetWithReferences(
			{ queries: context.queries, deleteAsset: context.commands.deleteAsset, dialogs },
			assetId,
			// `?? ''` is unreachable rather than defensive, and tracing it is what makes the
			// `??` honest: `AssetInspector` draws `Delete` only for `state === 'ready'`, which
			// is `entryFor(assetId) !== null`, and `onDelete` guards on `canDelete` before it
			// emits — so the entry this reads is the one that made the control exist, with no
			// await between the two. An empty label would be slice 15's "a descriptor says what
			// it is about IN WORDS" failing on the one dialog where naming the subject is the
			// whole contract, which is why the absence is named here rather than left to read
			// as a fallback somebody chose.
			store.entryFor(assetId)?.name ?? '',
		);
		if (outcome.kind === 'failed') {
			notifyOperationFailure(outcome.error);
			return;
		}
		if (outcome.kind === 'cancelled') return;
		selectedId.value = null;
		showingSelection.value = true;
		publish(null, expandedCategories.value);
		await hydrate();
		await nextTick();
		focusRowAt(position, searchEl.value);
	} catch (cause) {
		notifyFault(cause, context.logger, 'library.deleteAsset.faulted');
	} finally {
		deleting = false;
	}
}
</script>

<template>
	<div
		ref="shellEl"
		class="renovation-asset-library"
		:data-selected-asset-id="paneAssetId"
		:data-expanded-categories="context.expanded.value.join(',')"
	>
		<h2 class="rp-al-title">
			{{ tr('view.asset-library.title') }}
		</h2>
		<ViewFailure
			v-if="failure !== null"
			v-bind="failure"
			@action="() => void hydrate()"
		/>
		<template v-else>
			<div class="rp-al-toolbar">
				<label class="rp-al-search">
					<span class="rp-al-search__label">{{ tr('view.asset-library.search.label') }}</span>
					<input
						ref="searchEl"
						v-model="store.query"
						type="search"
						class="rp-al-search__input"
						:placeholder="tr('view.asset-library.search.placeholder')"
						@keydown.esc="store.query = ''"
					>
				</label>
				<button
					type="button"
					class="rp-al-create"
					@click="onCreateAsset"
				>
					{{ tr('view.asset-library.new-asset') }}
				</button>
			</div>
			<div class="rp-al-main">
				<!--
					§4's loading row — "the shell, with a loading line in the shelves region.
					Never a spinner over an empty pane" — drawn HERE rather than inside
					`.rp-al-body`, which is where Task 16a first put it and where it was strictly
					worse than the thing that row forbids. §7's narrow composition hides
					`.rp-al-body` once something is selected, so a restored leaf below 35rem drew
					a title, a toolbar, a status bar and a blank hole between them for the length
					of the read. Outside that element the line is visible in every composition,
					and it costs no attribute semantics and no fixture change.
				-->
				<div
					v-if="store.status !== 'ready'"
					class="rp-view-message"
				>
					<p>{{ tr('view.asset-library.loading') }}</p>
				</div>
				<template v-else>
					<AssetLibraryBody
						:expanded="expandedCategories"
						:selected-id="selectedId"
						@toggle="toggleShelf"
						@select="onSelect"
						@create="onCreateAsset"
						@rehydrate="() => void hydrate()"
					/>
					<AssetInspector
						:class="{ 'rp-al-inspector--away': !showingSelection }"
						:asset-id="selectedId"
						@back="onBack"
						@delete="(id) => void onDelete(id)"
					/>
				</template>
			</div>
			<footer class="rp-al-status">
				<span class="rp-al-status__count">{{ assetCount }}</span>
				<span class="rp-al-status__sep" />
				<span class="rp-al-status__folder">{{ context.libraryFolder }}</span>
			</footer>
		</template>
		<DialogHost />
	</div>
</template>

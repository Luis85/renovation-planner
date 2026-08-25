<script setup lang="ts">
/**
 * The harness index: every prototype and every component, click to open.
 *
 * The entry lists come from `entries.ts`, which owns both globs — `page.ts` needs the component
 * list too, to register those components for template-only prototypes, and a second glob here
 * would be a second answer that can disagree.
 *
 * Both globs are lazy: the index lists far more than it draws, and eagerly importing every
 * component would mount the whole plugin's presentation layer to render a list of links.
 *
 * THREE ways an entry fails, and no one mechanism sees two of them. A module that fails to
 * IMPORT rejects the promise and is caught in `open()`. A module that imports fine but THROWS —
 * in `setup()`, in `render()`, or from an async lifecycle hook a tick later — fails inside Vue's
 * error cycle, where a try/catch around the import cannot see it; `EntryBoundary` covers that.
 * And a module that neither rejects nor throws can still draw WRONGLY — an unresolved tag, a
 * missing or mistyped prop — which Vue only WARNS about; `renderDefects` covers that. Each of
 * the three was found by asking what an entry could do rather than by watching one do it, and
 * `tests/harness/indexPage.test.ts` drives all three.
 *
 * All three are also ASYNCHRONOUS, which is the second half of the problem and the harder one:
 * any of them can land after the reader has opened something else, and a report that lands on the
 * wrong entry is worse than no report — it pulls a working component off the stage and accuses it.
 * FOUR guards answer that, one for each place a result can land late, and they share ONE key:
 * `generation` below names the set together and says why the key is a mount rather than an entry.
 */
import { computed, defineComponent, getCurrentInstance, onErrorCaptured, onUnmounted, ref, shallowRef } from 'vue';
import { componentEntries, prototypeEntries, type HarnessEntry } from './entries';

const prototypes = prototypeEntries();
const components = componentEntries();

const all = computed<HarnessEntry[]>(() => [...prototypes, ...components]);

const requested = new URLSearchParams(window.location.search).get('entry');
const openComponent = shallowRef<unknown>(null);
const failure = ref<string | null>(null);
/**
 * The id of what is actually RENDERED, and it means the WHOLE subtree — null until every
 * async dependency below the entry has settled, and null again once one fails — immediately
 * for a defect the resolving render itself raised, and on the next microtask for one raised
 * after that (see `settle()`, which is where the exact guarantee is written down). The stage
 * exposes it as `data-entry`, which is what `scripts/harness-shot.mjs` waits for.
 *
 * It is deliberately not `requested`: the stage element exists from the first paint, so a
 * capture waiting on the stage alone would photograph "Pick an entry." and exit 0. An empty
 * screenshot reported as a success is the worst outcome this whole feature can produce,
 * because the actor it is built for cannot see that it is empty.
 *
 * And it is deliberately not set by `open()` either, which is the same defect one level in.
 * The global registry hands every component to Vue as a `defineAsyncComponent`, so a
 * prototype composing `<StatusBar />` starts loading it only once the OUTER module has
 * rendered. Setting the id when the outer loader resolves would mark the page ready while
 * every nested component was still a placeholder — the outer element satisfies the shot
 * selector, so `harness-shot` writes a picture of a half-drawn screen and exits 0. `open()`
 * therefore only ever CLEARS it; `<Suspense>` in the template is what sets it, because
 * resolving a whole subtree's async dependencies together is exactly what that boundary is
 * for and it holds at any nesting depth.
 */
const renderedId = ref<string | null>(null);

/** What a resolved render should name. Distinct from `renderedId`, which means "on screen". */
const pendingId = ref<string | null>(null);

/**
 * Every Vue warning raised while the current entry rendered — which is the whole classification,
 * stated as what IS a defect rather than as a list of the ones somebody enumerated.
 *
 * **This used to be an allowlist and the allowlist was wrong**, in the way an allowlist always
 * is: it named `Failed to resolve component` and `Missing required prop`, which are the two
 * cases the feature was designed against, and it did not name `Invalid prop: type check failed`
 * — so a prototype could pass every REQUIRED prop to `EmptyLayer` and pass a wrong one, Vue
 * would warn, nothing would throw (the template spreads `...props.transform`, and spreading a
 * string is legal), `<Suspense>` would resolve and `harness-shot` would record a malformed entry
 * as a success. The set it missed is not one string either: Vue's prop validator alone raises
 * four (`Missing required prop`, `Invalid prop: type check failed`,
 * `Invalid prop: custom validator check failed`, `Invalid prop name`), and there are dozens more
 * across `runtime-core` — `injection "x" not found`, `Property "x" was accessed during render
 * but is not defined on instance`, `Component is missing template or render function`,
 * `Failed to resolve directive`, `Extraneous non-props attributes` — each of which means the
 * same thing here: what is on screen is not what the entry was supposed to be.
 *
 * So the classification is inverted, which is `CLAUDE.md`'s rule about category invariants
 * ("checked at the forbidden thing, not by listing the places") applied to the one mechanism
 * that fails SILENTLY when it is wrong. Vue's dev `warn` is by construction "you did something
 * wrong"; this page is a tool for LOOKING at a component, so anything Vue is unhappy enough
 * about to warn on makes the picture untrustworthy. Reporting it costs a named failure card the
 * reader can act on. Missing it costs a screenshot of a broken screen, reported as a success, to
 * an actor who cannot see that it is broken.
 *
 * **What this costs, and why nothing is carved out today.** The inverted shape trades a silent
 * miss for a possible false alarm: a warning that is benign for this page would report an entry
 * as failed. Exactly one warning was expected to be that, `<Suspense> is an experimental feature
 * and its API will likely change` — and it turns out not to reach here at all, because Vue emits
 * it through `console.info` rather than through `warn` (measured in `runtime-core`, not assumed).
 *
 * And the fallout was measured rather than predicted: all twelve components under
 * `src/presentation/` were opened one at a time in a real browser, and the inversion added NO
 * new failure. Two report missing required props (`EmptyLayer`, `BackgroundLayer`) — the family
 * the allowlist already caught. Six THROW when mounted bare and are named by `onErrorCaptured`,
 * which this classification never touched. Four render clean and are marked ready. Not one
 * warning outside the prop family reached this handler.
 *
 * If a benign one is ever found, THIS is the one place to exclude it, by name and with the
 * reason beside it — a carve-out for a warning somebody has actually seen, rather than a list
 * written ahead of the evidence.
 *
 * A plain array rather than a ref, deliberately: it is written DURING render, where mutating
 * reactive state is a second warning and a re-render nobody asked for. It is read once the
 * render is over — by `settle()` at the resolve, and by `reportLateDefect` on the microtask
 * after a defect that arrives once the stage is already marked ready.
 *
 * **It holds ONE mount's warnings — the mount currently on the stage — and the handler enforces
 * that rather than the array being trusted to.** There is one `config.warnHandler` per app, so
 * this array is shared by construction; `open()` emptying it on the way past is not ownership,
 * because entry A's teardown runs on a flush AFTER that clear and its warnings would land in the
 * array B's `settle()` reads. `warningOwner` is what decides, at push time, whose warning this
 * is — the live boundary publishes the MOUNT it belongs to — and anything that is not the mount
 * on the stage goes to `console.error` instead of in here.
 */
const renderDefects: string[] = [];

/**
 * WHICH MOUNT this is. `open()` increments it, so every mount gets a number of its own —
 * including a second mount of an entry the reader has already opened once — and that number is
 * the ONE key all four asynchronous guards compare.
 *
 * Two clicks in quick succession leave both awaits in flight, and without it the FIRST to settle
 * is whichever import happens to finish last: entry A's module could overwrite entry B's, or A's
 * load error could replace a B that had drawn perfectly, while `pendingId` still says B. A stale
 * call returns instead of writing anything.
 *
 * The four are worth naming together because each covers a different asynchronous path and none
 * of them covers another's:
 *
 * - `mine !== generation.value` in `open()` covers the LOADER await, in the closure that started
 *   it.
 * - `mountedGeneration` in `settle()` covers the `<Suspense>` RESOLVE, which fires from a
 *   boundary that cannot say which mount it belongs to.
 * - `EntryBoundary`'s own `onErrorCaptured` covers the ERROR channel, which needs a per-MOUNT
 *   hook because a root one has no way back to the `open()` call that mounted the subtree it is
 *   told about.
 * - `warningOwner` covers the WARNING channel, which cannot have a per-entry hook at all — Vue
 *   allows one `config.warnHandler` per app — so the boundary publishes its mount instead.
 *
 * **An id names an ENTRY; only this names a MOUNT — which took a shipped defect to learn.** For
 * four fix rounds three of these four compared entry ids, and A -> B -> A is the case an id
 * cannot answer at all: open A, open B, open A again, and the FIRST A's rejection arrives while
 * the second A is on the stage drawing perfectly. Vue delivers it to the first boundary, which
 * snapshotted the id `A`; the stage is showing `A`; `id !== mountedId` is false, so the page
 * pulled a healthy entry off and accused it of a fault in a mount the reader had already left.
 * That is the exact outcome the whole apparatus exists to prevent, reached through the apparatus.
 *
 * A ref rather than a plain counter, because the template needs it: the boundary is keyed and
 * propped with it, so the component that hears a throw is the one created for the mount that
 * raised it. Everything else here reads `generation.value` — which is also why `pendingId` has no
 * generation twin, since between navigations `openComponent` is null and no boundary exists at
 * all; whenever one does, this holds the mount that put it there.
 *
 * Every one of the four was a real defect before it was a guard, each found by asking what could
 * still land late rather than by watching it happen, and each has a behavioural test that fails
 * without it. The LOADER's own arrived last, in the round that unified the key: it had been
 * pinned as source text by a task that has not run yet and driven by nothing, so the sentence
 * before this one was an intention. Removing either arm of it now reds
 * `tests/harness/indexPage.test.ts` — watched, both arms separately.
 */
const generation = ref(0);

/**
 * WHICH MOUNT is currently ASSIGNED to the stage — a `generation`, and null between navigations
 * and after a failure.
 *
 * `settle()` fires from a `<Suspense>` that belongs to whatever is mounted, and it has no other
 * way to know which mount that was: entry A can still be on screen with a descendant pending
 * while a click has already moved `pendingId` to B, and A's descendant settling would then mark
 * the stage ready under B's name with A's content in it. The clear at the top of `open()` is the
 * fix; this is the invariant that keeps it fixed, since removing the clear would otherwise
 * reintroduce the defect silently.
 *
 * `reportEntryFailure` reads it for the second question too — is the mount that threw the one on
 * the stage — which is what keeps a stale rejection off a page it no longer belongs to, and what
 * an id could not answer the moment one entry was mounted twice.
 *
 * There is deliberately no `mountedId` beside it. An id has exactly one honest use on these
 * paths, naming the entry in a message, and both messages already have one that cannot go stale:
 * `reportEntryFailure` is handed the id its own boundary snapshotted, and `reportDefects` names
 * `pendingId`. A second variable that only ever agreed with those is a second answer waiting to
 * disagree — and for four rounds it was the answer three guards asked.
 */
let mountedGeneration: number | null = null;

/**
 * Which MOUNT a Vue warning currently belongs to, set by the live `EntryBoundary` — the
 * generation for the comparison, the id for the message.
 *
 * Vue allows exactly ONE `config.warnHandler` per app, so the warning channel cannot be owned
 * per-mount the way the error channel now is — and `renderDefects` was therefore a shared array
 * that `open()` emptied on the way past. That is a mis-attribution waiting to happen, and it was
 * REACHABLE rather than theoretical: `open()` clears the array and sets `openComponent` to null
 * synchronously, which only QUEUES Vue's re-render, so the flush that actually tears entry A down
 * runs afterwards — reliably ahead of the module await resuming. A warning raised from A's
 * teardown therefore landed in the array that B's `settle()` reads, and pulled a clean B off the
 * stage under B's own name.
 *
 * This is the pair `EntryBoundary` already has, published for the one consumer that cannot be
 * given a hook of its own. Walking `$parent` from the `instance` the handler is passed would
 * answer the same question, and is refused for the same reason it was refused for the error
 * channel: more code, over Vue's instance tree, to recover values a per-mount component holds. The
 * objection is weaker here — there is no per-entry hook available, so this is not a free
 * alternative but a cheaper one — and it still wins on the same arithmetic.
 *
 * Cleared on unmount only if it is still ours — by GENERATION, so a boundary being torn down
 * cannot clear the publication of a LATER mount of the same entry — so the clear cannot depend on
 * how A's teardown and B's setup interleave across flushes.
 */
let warningOwner: { readonly id: string; readonly generation: number } | null = null;

async function open(entry: HarnessEntry): Promise<void> {
	const mine = ++generation.value;

	failure.value = null;
	renderedId.value = null;
	pendingId.value = entry.id;
	renderDefects.length = 0;
	// The previous entry comes OFF SCREEN before the await, not after it. Leaving it mounted
	// while the next module loads is what lets a stale `<Suspense>` resolve under the new
	// entry's name — and a blank stage during a load is the honest picture anyway.
	openComponent.value = null;
	mountedGeneration = null;
	try {
		const module = (await entry.component()) as { default: unknown };

		if (mine !== generation.value) return;

		openComponent.value = module.default;
		mountedGeneration = mine;
		// No `renderedId` assignment here, deliberately — see its declaration. The outer
		// module having loaded says nothing about the components it composes.
	} catch (error) {
		if (mine !== generation.value) return;

		// Named rather than blank: a prototype that half-drew itself is worse than one that
		// says what is missing, because a gap reads as a layout decision.
		openComponent.value = null;
		failure.value = `${entry.id} failed to load: ${error instanceof Error ? error.message : String(error)}`;
	}
}

/**
 * A throw from a mounted entry, attributed to the MOUNT that ACTUALLY raised it — `whose` is the
 * generation the reporting boundary was created for, and `id` is only ever the name in the text.
 *
 * **`mountedGeneration` is cleared on the reporting path and clearing it is load-bearing**, which
 * a committed test found rather than a reading: without it `<Suspense>` still fires `@resolve` for
 * the boundary the throw happened inside, `settle()` sees a mount it recognises and an empty
 * defect list, and it puts `data-entry` straight back on a stage showing the failure card. The
 * page then says "failed to render" while advertising itself as ready — the one combination that
 * gets an eyeless capture photographed and reported as a success. `mountedGeneration` means "what
 * is assigned to the stage", and after a throw nothing is.
 *
 * **A STALE failure never touches the stage, and is never dropped either.** An entry whose async
 * lifecycle hook rejects after the user has moved on still has its rejection delivered — Vue
 * walks the parent chain of an instance that is already unmounted — and blaming whatever is on
 * screen for it produces the worst outcome this page has: a working entry pulled off and replaced
 * by a card accusing it, for a fault in something the reader has already left. So it goes to
 * `console.error` instead, named as what it is. That is not a shrug: it is the one channel
 * `scripts/harness-shot.mjs` records and exits non-zero on, so the failure is still loud to an
 * agent with no eyes, while the entry actually on screen is left alone.
 *
 * **"The reader has moved on" includes moving BACK.** This is the one channel where the reporting
 * side carries a snapshot taken at mount and outlives the mount that took it, so it is the one
 * where two mounts of a single entry can both be in play: comparing ids answered `A === A` for
 * the A -> B -> A case and did the accusing itself. Comparing generations is what makes the
 * sentence above true.
 */
function reportEntryFailure(id: string, whose: number, error: unknown): void {
	const detail = error instanceof Error ? error.message : String(error);

	if (whose !== mountedGeneration) {
		console.error(`harness entry ${id} failed after the page moved on: ${detail}`);
		return;
	}

	openComponent.value = null;
	renderedId.value = null;
	mountedGeneration = null;
	failure.value = `${id} failed to render: ${detail}`;
}

/**
 * The error boundary for ONE MOUNT, which is what makes the attribution above possible.
 *
 * A root `onErrorCaptured` cannot do it. It is handed the error and the throwing instance and
 * nothing that says which `open()` call put that instance there, so it can only read the CURRENT
 * `renderedId`/`pendingId`/`mountedGeneration` — and that is precisely the bug. Making
 * `generation` reachable from anywhere does not rescue it: a root hook can read what the page IS,
 * never what the subtree it is being told about was mounted AS. The alternative considered was
 * walking `$parent` from the throwing instance to see whether it descends from the boundary
 * currently on stage, which needs a template ref through `<Suspense>` and a walk over Vue's
 * instance tree — more code, over internals, to recover two values a component created per mount
 * simply HAS.
 *
 * BOTH are snapshotted in `setup` rather than read from the props at throw time, for the same
 * reason `mountedGeneration` is a plain value: this boundary must report the mount it was created
 * for, whatever the page has since become. They answer different questions and both are needed —
 * `ownedGeneration` decides whether the failure is still the page's business, and `owned` is what
 * the message has to name either way, since a reader and an eyeless `harness-shot` both want the
 * entry rather than a counter.
 */
const EntryBoundary = defineComponent({
	props: {
		entryId: { type: String, required: true },
		generation: { type: Number, required: true },
	},
	setup(props, { slots }) {
		const owned = props.entryId;
		const ownedGeneration = props.generation;

		// The WARNING channel's owner, which cannot be a hook (Vue has one `warnHandler` per app)
		// and so is a published mount instead. Set in `setup`, which runs before this boundary's
		// slot content mounts — so a prop warning from the entry itself is already attributed.
		warningOwner = { id: owned, generation: ownedGeneration };
		onUnmounted(() => {
			if (warningOwner?.generation === ownedGeneration) warningOwner = null;
		});

		onErrorCaptured((error) => {
			reportEntryFailure(owned, ownedGeneration, error);
			// Stops here: one bad entry reports itself instead of blanking the page and taking
			// the list with it.
			return false;
		});

		return () => slots.default?.() ?? null;
	},
});

/**
 * The link an entry is reachable at, built with `URLSearchParams` rather than interpolated.
 *
 * `&` and `#` are legal in a filename on every platform this runs on, and an id carries the
 * path, so a raw `?entry=${id}` produces a URL that no longer means the id: opening the link
 * in a new tab or copying it hands `URLSearchParams.get('entry')` a truncated value and the
 * index reports an unknown entry. The in-page click hides this, because `@click.prevent`
 * calls `open(entry)` with the object and never reads the URL back — so the defect would
 * appear only in the one path an agent uses, which is the path with no human watching.
 * `scripts/harness-shot.mjs` encodes the same id on its side.
 */
function hrefFor(entry: HarnessEntry): string {
	return `?${new URLSearchParams({ entry: entry.id }).toString()}`;
}

/** Whatever has been collected, as a named failure, with the readiness marker taken off. */
function reportDefects(): void {
	openComponent.value = null;
	renderedId.value = null;
	failure.value = `${pendingId.value ?? 'the entry'} did not render cleanly: ${[...new Set(renderDefects)].join('; ')}`;
}

/**
 * What `<Suspense>`'s `@resolve` runs, once the whole subtree has settled.
 *
 * Ordering is the reason this is a function rather than an inline assignment. The resolution
 * warnings fire DURING the render that Suspense is waiting on, and `@resolve` fires after that
 * render is mounted — so by here every defect that render produced is already collected, and
 * `data-entry` is never set over a hole that was there when the subtree resolved. Deferring
 * THIS check to a microtask would open exactly that window, and "too short for Playwright to
 * observe" is not a claim this project accepts.
 *
 * **What one read cannot cover, and the reason `reportLateDefect` exists below.** A defect
 * first raised AFTER the resolve — a subtree mounted from `onMounted`, a `v-if` flipped a tick
 * later — arrives when the marker is already on the stage, and this function has run for the
 * last time. That is not hypothetical for this harness's own headline component:
 * `tests/helpers/editor.ts` records that `PlanEditorRoot` mounts `PlanCanvas` a promise tick
 * after mount whenever the store is not pre-seeded. So the guarantee is written to what the
 * two together deliver: the marker goes on only when the resolved subtree was clean, and it
 * comes OFF on the microtask after any later defect. A capture that reads `[data-entry]` inside
 * that microtask still photographs the hole.
 *
 * The constraint that leaves the window open is VUE's, not the platform's, and the sentence has
 * to say which: a `warnHandler` fires mid-render, and writing reactive state there earns a second
 * warning and a render pass nobody asked for — so the clear has to wait for the current render to
 * end. A raw `removeAttribute` on the stage element from the handler would close it, and is
 * refused because the attribute would then have two writers, one of them fighting Vue's next
 * patch to keep it off. One writer and a microtask of exposure is the cheaper trade; a wrong
 * absolute would have been free and false.
 */
function settle(): void {
	// The resolve belongs to whatever is mounted. If that is not the mount `open()` is currently
	// on, this is a previous entry's subtree finishing after a navigation, and marking the stage
	// ready would advertise the new id over the old content.
	//
	// A -> B -> A cannot reach this one, and the reason is Vue's rather than this page's: a
	// `<Suspense>` only ever calls `resolve()` while it is live — `suspense.resolve()` on an
	// unmounted boundary throws in dev (`runtime-core`, checked, not assumed), and every caller
	// is guarded by `suspense.isUnmounted` — so the firing side here is always the CURRENT
	// boundary, never a snapshot of an older one. The comparison is generation-keyed anyway,
	// because four guards reasoning about staleness in three different keys is what produced the
	// defect `generation` describes.
	if (mountedGeneration === null || mountedGeneration !== generation.value) return;

	if (renderDefects.length === 0) {
		renderedId.value = pendingId.value;
		return;
	}

	reportDefects();
}

/**
 * A defect that arrives once the stage is already marked ready.
 *
 * On a MICROTASK rather than inline, because this runs from `warnHandler` — which fires DURING
 * a render, where writing reactive state is a second warning and a re-render nobody asked for.
 * The array itself stays a plain one for that reason; this is the one place it has to reach
 * back out to the refs, and it waits for the render to be over before it does.
 *
 * Re-checked rather than assumed on arrival: `open()` can have moved on in the meantime, and
 * reporting then would put the previous entry's defect on the new entry's name.
 */
function reportLateDefect(): void {
	// `queueMicrotask`, not `Promise.resolve().then(...)`: the callback here reports rather than
	// producing a value, which `promise/always-return` refuses on a `then` and which the plain
	// microtask API says more directly anyway.
	queueMicrotask(() => {
		if (mountedGeneration !== null && mountedGeneration === generation.value && renderDefects.length > 0) {
			reportDefects();
		}
	});
}

/**
 * Turn Vue's warnings into something the page can fail on — see `renderDefects` for why that is
 * ALL of them rather than a named few.
 *
 * `IndexPage` is this app's ROOT component, so its `appContext` is the app — reaching the
 * config here keeps the failure state with the only component that owns any, rather than
 * adding a module whose whole job would be carrying one array across a boundary.
 *
 * The previous handler is called, and `console.warn` when there is none, so installing this
 * reports rather than swallows: a warning still reaches the console for a human reading it, and
 * `harness-shot` still sees whatever it saw before.
 *
 * **The limit, stated because it is invisible:** `warnHandler` exists in DEVELOPMENT builds
 * only. `npm run harness` and `npm run harness-shot` both run Vite's dev server, so it is
 * always live where it matters; a production build of the harness page would lose this and
 * would go back to photographing the hole.
 */
const config = getCurrentInstance()?.appContext.config;

if (config) {
	const previous = config.warnHandler;

	config.warnHandler = (message, instance, trace) => {
		// ATTRIBUTED before it is collected. `renderDefects` is read by ONE mount's `settle()`, so
		// only a warning belonging to the mount currently on the stage may go into it; anything
		// else would accuse a component that did nothing wrong.
		//
		// **A -> B -> A cannot reach this channel, and it is worth saying why, because the same
		// case DOES reach the error channel above.** There the reporting side is a snapshot that
		// outlives its own mount; here it is `warningOwner`, republished by whichever boundary is
		// live, so a mount the reader has left has nothing published at all. What settles it is
		// VUE's behaviour, not this page's: `config.warnHandler` is consulted only when Vue's
		// warning STACK is non-empty (`runtime-core`'s `warn` reads
		// `stack.length ? stack[stack.length - 1].component : null` and takes the handler off
		// THAT instance's app), and the stack is pushed only around a synchronous mount, patch or
		// async-setup resolve. A continuation resuming after its instance was unmounted runs on a
		// bare microtask with an empty stack, so Vue sends its warning to `console.warn` and this
		// handler never sees it — measured in `tests/harness/indexPage.test.ts` by driving that
		// exact navigation, not reasoned from the docs. And a warning that IS raised inside a
		// mount or patch is one Vue itself attributes to the component being patched, which is the
		// live entry — so no key available here, generation included, could tell a stale origin
		// from the current one.
		//
		// It is generation-keyed regardless: one key for four guards is the point, and the clear
		// on unmount is the one place here where two mounts of a single entry are both in play —
		// they share an id, and the older one's teardown must not clear the younger one's
		// publication. That needs an `onUnmounted` running after a later boundary's `setup`, which
		// this page's flush ordering does not produce today (`open()` queues the unmount before it
		// awaits the module that leads to the next mount), so it is a key that cannot be wrong
		// rather than a defect being fixed.
		if (warningOwner !== null && warningOwner.generation === mountedGeneration) {
			renderDefects.push(message);
			// Already marked ready, so `settle()` will not run again for this entry — see it.
			if (renderedId.value !== null) reportLateDefect();
		} else {
			// Not dropped: a stale warning is still a warning, and silence is the green signal
			// that means nothing. `console.error` is the channel `scripts/harness-shot.mjs`
			// records and exits non-zero on, so it stays loud without touching the stage.
			const subject = warningOwner === null ? 'the harness index itself' : `harness entry ${warningOwner.id}`;

			console.error(`Vue warning not attributable to the entry on the stage — from ${subject}: ${message}`);
		}

		if (previous) previous(message, instance, trace);
		else console.warn(message, trace);
	};
}

const initial = all.value.find((entry) => entry.id === requested);

// An `?entry=` naming nothing is reported rather than silently ignored — `harness-shot`
// exits non-zero on it, so a typo in a capture command fails loudly instead of writing a
// picture of the index.
if (requested && !initial) failure.value = `no entry named ${requested}`;
if (initial) void open(initial);
</script>

<template>
	<div class="rp-harness-index">
		<nav aria-label="Harness entries">
			<h1>Harness</h1>
			<p v-if="prototypes.length === 0">No prototypes yet — add a .vue file under src/prototypes/.</p>
			<ul>
				<li v-for="entry in all" :key="entry.id">
					<a :href="hrefFor(entry)" @click.prevent="open(entry)">{{ entry.label }}</a>
					<span>{{ entry.kind }}</span>
				</li>
			</ul>
		</nav>
		<main class="rp-harness-stage" :data-entry="renderedId ?? undefined">
			<p v-if="failure" role="alert" class="rp-harness-failure">{{ failure }}</p>
			<!--
				`@resolve` fires once every async dependency in the subtree has settled, which is
				the only signal that covers a mock composing a real component that composes
				another. `settle()` is what decides between ready and failed, because by then it
				knows whether any tag in that subtree resolved to nothing.

				`@pending` is belt-and-braces and does NOT fire on any path this page has today:
				Vue raises it from `patchSuspense`, and switching entries never patches this one
				— `open()` clears `openComponent` before it awaits, so the `v-else-if` tears the
				boundary down and builds a fresh one. What actually takes the marker away between
				entries is `open()`'s own `renderedId.value = null`, which is where the invariant
				is tested. This stays for the day a change makes Suspense patch instead.
			-->
			<Suspense v-else-if="openComponent" @pending="renderedId = null" @resolve="settle()">
				<!--
					Keyed by the MOUNT, so the boundary that hears a throw — and the one that
					published `warningOwner` — is the one created for the mount that raised it.

					Keying it by the entry id was not enough, and that is the whole of fix round 5:
					A -> B -> A gives two mounts one id, so the key held its value across a
					navigation the reader can see, and every guard downstream inherited the same
					blindness. `generation` changes on every `open()`, a return to the entry just
					left included.

					The key is doing real work rather than restating what `open()` already arranges:
					Vue's key semantics FORCE an unmount and remount instead of a patch, so the
					attribution holds on its own terms even if `open()` stopped clearing
					`openComponent` before its await. That clear happens to produce a fresh boundary
					today, which is why an earlier version of this note credited it — but resting a
					correctness property on it would be resting it on the same accident the
					`@pending` note above describes.
				-->
				<EntryBoundary :key="generation" :entry-id="pendingId ?? ''" :generation="generation">
					<component :is="openComponent" />
				</EntryBoundary>
			</Suspense>
			<p v-else>Pick an entry.</p>
		</main>
	</div>
</template>

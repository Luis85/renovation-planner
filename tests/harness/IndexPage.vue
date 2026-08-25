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
 * TWO failure paths, not one. A module that fails to IMPORT rejects the promise and is
 * caught below; a module that imports fine but throws in `setup()` or `render()` fails
 * later, inside Vue's render cycle, where a try/catch around the import cannot see it.
 * `onErrorCaptured` is what covers the second, and without it criterion 8 holds only for
 * half the ways an entry can fail — the half that is easier to cause deliberately and rarer
 * in practice.
 */
import { computed, getCurrentInstance, onErrorCaptured, ref, shallowRef } from 'vue';
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
 * The Vue warnings that mean what is on screen is NOT the entry, collected during the current
 * render pass.
 *
 * Two of them, and they are the same defect wearing different words. A tag that resolves to
 * nothing — a typo in a mock, or a label `registrableComponents` refused because two entries of
 * one kind claim it — renders as an unknown element. A component with REQUIRED PROPS mounted by
 * a bare `<component :is>` gets none of them: `EmptyLayer.vue` needs `layerId`, `transform` and
 * `visible`, and the index has no way to know that before importing it. Vue only WARNS about
 * either, and a warning is invisible to `scripts/harness-shot.mjs`, which records console errors
 * and page errors — so the prototype is photographed with a hole in it, or the component draws
 * malformed, and the command exits 0. That is the empty-capture failure narrowed to one element.
 *
 * The prop case is a real limit rather than a bug to route around: a component that needs props
 * cannot be mounted bare, and the index says so instead of drawing something wrong. Composing it
 * in a prototype — where a template CAN pass props — is how a designer looks at one.
 *
 * A plain array rather than a ref, deliberately: it is written DURING render, where mutating
 * reactive state is a second warning and a re-render nobody asked for. It is read once the
 * render is over — by `settle()` at the resolve, and by `reportLateDefect` on the microtask
 * after a defect that arrives once the stage is already marked ready.
 *
 * **These two strings are Vue's, and nothing here can keep them current.** A `message.includes`
 * against a reworded upstream warning matches nothing and turns this whole check off SILENTLY:
 * the array stays empty, the stage is marked ready and `harness-shot` photographs the hole and
 * exits 0. `tests/harness/indexPage.test.ts` pins them by driving a REAL component with real
 * `required` props and a REAL `resolveComponent` miss, so a Vue reword reds a test instead —
 * the same argument `tests/build/logging-carve-out.test.ts` makes against ESLint's message text.
 */
const FATAL_WARNINGS = ['Failed to resolve component', 'Missing required prop'];

const renderDefects: string[] = [];

/**
 * Which `open()` call is current. Two clicks in quick succession leave both awaits in flight,
 * and without this the FIRST to settle is whichever import happens to finish last: entry A's
 * module could overwrite entry B's, or A's load error could replace a B that had drawn
 * perfectly, while `pendingId` still says B. A stale call returns instead of writing anything.
 */
let generation = 0;

/**
 * The id of the component currently ASSIGNED to the stage, as a plain value.
 *
 * `settle()` fires from a `<Suspense>` that belongs to whatever is mounted, and it has no other
 * way to know which entry that was: entry A can still be on screen with a descendant pending
 * while a click has already moved `pendingId` to B, and A's descendant settling would then mark
 * the stage ready under B's name with A's content in it. The clear at the top of `open()` is the
 * fix; this is the invariant that keeps it fixed, since removing the clear would otherwise
 * reintroduce the defect silently.
 */
let mountedId: string | null = null;

async function open(entry: HarnessEntry): Promise<void> {
	const mine = ++generation;

	failure.value = null;
	renderedId.value = null;
	pendingId.value = entry.id;
	renderDefects.length = 0;
	// The previous entry comes OFF SCREEN before the await, not after it. Leaving it mounted
	// while the next module loads is what lets a stale `<Suspense>` resolve under the new
	// entry's name — and a blank stage during a load is the honest picture anyway.
	openComponent.value = null;
	mountedId = null;
	try {
		const module = (await entry.component()) as { default: unknown };

		if (mine !== generation) return;

		openComponent.value = module.default;
		mountedId = entry.id;
		// No `renderedId` assignment here, deliberately — see its declaration. The outer
		// module having loaded says nothing about the components it composes.
	} catch (error) {
		if (mine !== generation) return;

		// Named rather than blank: a prototype that half-drew itself is worse than one that
		// says what is missing, because a gap reads as a layout decision.
		openComponent.value = null;
		failure.value = `${entry.id} failed to load: ${error instanceof Error ? error.message : String(error)}`;
	}
}

/**
 * A render-time throw from the mounted entry. Returning `false` stops it propagating, so one
 * bad entry reports itself instead of blanking the page and taking the list with it.
 *
 * **`mountedId` is cleared here and clearing it is load-bearing**, which a committed test found
 * rather than a reading: without it `<Suspense>` still fires `@resolve` for the boundary the
 * throw happened inside, `settle()` sees a pending id it recognises and an empty defect list,
 * and it puts `data-entry` straight back on a stage showing the failure card. The page then
 * says "failed to render" while advertising itself as ready — the one combination that gets an
 * eyeless capture photographed and reported as a success. `mountedId` means "what is assigned
 * to the stage", and after a throw nothing is.
 */
onErrorCaptured((error) => {
	const id = renderedId.value ?? pendingId.value ?? requested ?? 'the entry';

	openComponent.value = null;
	renderedId.value = null;
	mountedId = null;
	failure.value = `${id} failed to render: ${error instanceof Error ? error.message : String(error)}`;
	return false;
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
 * that window still photographs the hole; nothing in a single-process page can close it, and
 * saying so is cheaper than a sentence that is wrong once a tick.
 */
function settle(): void {
	// The resolve belongs to whatever is mounted. If that is not what `pendingId` names, this
	// is a previous entry's subtree finishing after a navigation, and marking the stage ready
	// would advertise the new id over the old content.
	if (mountedId === null || mountedId !== pendingId.value) return;

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
		if (mountedId !== null && mountedId === pendingId.value && renderDefects.length > 0) reportDefects();
	});
}

/**
 * Turn the warnings in `FATAL_WARNINGS` into something the page can fail on.
 *
 * `IndexPage` is this app's ROOT component, so its `appContext` is the app — reaching the
 * config here keeps the failure state with the only component that owns any, rather than
 * adding a module whose whole job would be carrying one array across a boundary.
 *
 * The previous handler is called, and `console.warn` when there is none, so installing this
 * does not swallow every other Vue warning on the page.
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
		if (FATAL_WARNINGS.some((fragment) => message.includes(fragment))) {
			renderDefects.push(message);
			// Already marked ready, so `settle()` will not run again for this entry — see it.
			if (renderedId.value !== null) reportLateDefect();
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
				<component :is="openComponent" />
			</Suspense>
			<p v-else>Pick an entry.</p>
		</main>
	</div>
</template>

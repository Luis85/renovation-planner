/**
 * The bundle's entry point. Everything real is in `mount.ts`, `planEditor.ts`,
 * `assetDesigner.ts` and `IndexPage.vue`, each of which a test can drive.
 *
 * `?view=plan-editor` opens the Plan Editor instead of the project surface, `?view=asset-designer`
 * (Task B10) opens the asset designer the same way, `?view=asset-library` (Task 17) opens the
 * asset library — with `&asset=<id>` seeding a selection, which is what §7's narrow composition
 * needs to draw at all — `?project=<id>` opens the Renovation Project view's DETAIL state on a
 * seeded project of that id rather than its list, `?projects=<n>` and `?q=<text>` (Task 12) open
 * its LIST state over a seeded vault of that size with the filter already carrying that query,
 * and `?index` (or an `?entry=`) opens the harness index. A query parameter rather than a second
 * page, for the same reason `?theme`, `?phone` and `?lang` are ones: a headless screenshot needs
 * a URL and nothing to click.
 */
import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import { mountHarness } from './mount';
import { mountPlanEditorHarness, parseRoomKnob } from './planEditor';
import { mountAssetDesignerHarness } from './assetDesigner';
import { mountAssetLibraryHarness } from './assetLibrary';
import { seedFixture, harnessEditorContext } from './fixture';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { componentEntries, prototypeEntries, registerEntries, registrableComponents } from './entries';
import IndexPage from './IndexPage.vue';
import { installObsidianDom } from '../helpers/dom';
import { applyLanguage, applyPlatform, applyWantedScheme, drawSchemeToggle } from './theme';

// Before the mount: `is-phone` is a body class that a toolbar's own fit measurement can
// see, and applying it afterwards would leave that measurement made against the other
// layout.
applyPlatform(window.location.search);
// Before the mount for the same reason, differently spelled: `ProjectList` resolves its name
// collator and its key legend ONCE at setup, so a language applied after the mount would draw
// a half-translated pane. See `applyLanguage` for why this knob exists at all.
applyLanguage(window.location.search);

const params = new URLSearchParams(window.location.search);

/**
 * The index is OPT-IN, and that is a decision rather than an accident.
 *
 * `?view=plan-editor` keeps the Plan Editor and everything else keeps the project view,
 * because EVERY fixed shot of the project surface in `scripts/harness-shot.mjs` addresses it
 * with no `view` parameter at all. Making a bare URL mean "index" would break all of them, and
 * the test in Task 6 that asserts the fixed shots still exist would keep passing while the
 * captures timed out.
 *
 * **Stated as a rule rather than a count, because the count has now gone stale twice.** It said
 * THREE and named the first three until slice 21 added two more; it was corrected to FIVE and
 * was already wrong again, since the price section's own two shots had landed in the same
 * merge, and Task 12's four Home shots took it to eleven. A prose enumeration goes stale in the
 * direction of a WEAKER argument, which is the quiet kind, and nothing reads one against the
 * list it describes — so the enumeration is gone and what is left is the property that makes
 * the decision, which every shot added since has satisfied without anybody editing this.
 *
 * The PBI leaves "does the index displace the current root" open. This answers it: it does
 * not, because displacing it costs a working workflow to save one query parameter.
 */
const wantsIndex = params.has('index') || params.has('entry');
const wantsPlanEditor = params.get('view') === 'plan-editor';
const wantsAssetDesigner = params.get('view') === 'asset-designer';
const wantsAssetLibrary = params.get('view') === 'asset-library';

/**
 * The Plan Editor's own four knobs: `?select=<zoneId>` selects and frames a seeded zone once
 * the editor is ready and `?add` opens the Add menu once it is ready (both Task 21);
 * `?room=<widthMm>x<depthMm>` (Task 14) walks Add → Room → the two length fields, so a capture
 * can show the room task with a sized rectangle under it; `?stale` (Task 14) drives the trust
 * path's own stale-projection warning through a real zero-referent zone deletion. All four are
 * read here, beside `wantsPlanEditor`, and handed to `mountPlanEditorHarness` below rather than
 * read a second time there — one parse of the URL, like every other knob on this page.
 *
 * `parseRoomKnob` lives beside the knob it feeds rather than here, because it is the one of
 * the four with something to get wrong: `?room=big` is a URL a person can type, and a knob
 * that quietly did nothing with it would photograph the resting editor under the room shot's
 * name and exit 0. It refuses loudly instead — see its own docblock. `?stale` takes no value,
 * so there is nothing for it to get wrong the same way.
 */
const selectZoneId = params.get('select');
const wantsAddMenu = params.has('add');
const room = parseRoomKnob(params.get('room'));
const wantsStale = params.has('stale');

let view: unknown = null;

if (wantsIndex) {
	/**
	 * The shim, on this branch too.
	 *
	 * `mountHarness` and `mountPlanEditorHarness` install Obsidian's DOM prototype extensions
	 * and this branch calls neither — but `drawSchemeToggle()` below runs on EVERY branch and
	 * uses `document.body.createEl`. Without this the index mounts and then throws, which
	 * `harness-shot` records as a page error and exits non-zero on: a capture that looks
	 * broken while the entry rendered perfectly.
	 *
	 * `applyPlatform` in `theme.ts` carries the same rule, with the sentence that explains why
	 * no test catches it: every jsdom file installs these at module top, so the shimmed
	 * spelling passes the suite and throws on the real page.
	 */
	installObsidianDom();
	document.body.empty();

	const root = document.body.createDiv('rp-harness-leaf');
	/**
	 * Pinia AND VueKonva, because the production mount installs both.
	 * `src/presentation/views/PlanEditorView.ts` calls `app.use(VueKonva)` where it mounts, and without it
	 * here every canvas component — `PlanCanvas`, `ZoneLayer`, `ZoneShape` — leaves `VStage`,
	 * `VLayer` and `VLine` unresolved.
	 *
	 * That failure is SILENT in the worst way: Vue reports an unresolved component as a
	 * warning, not an error, and the entry's outer element still satisfies the screenshot
	 * selector. `harness-shot` would exit 0 with a PNG of a missing canvas — the exact shape
	 * of failure this whole feature is built to make impossible.
	 */
	const app = createApp(IndexPage).use(seedFixture()).use(VueKonva);

	/**
	 * The third thing the production mount does, and the one with no `use()` to make it
	 * obvious. `PlanEditorView` calls `app.provide(PLAN_EDITOR_CONTEXT, …)`; without it every
	 * component reading `usePlanEditorContext()` throws, and the index would show the named
	 * failure for precisely the components a designer most wants to see.
	 */
	app.provide(PLAN_EDITOR_CONTEXT, harnessEditorContext());

	/**
	 * Every real component, registered globally and lazily.
	 *
	 * Without this a template-only prototype cannot use one: `<StatusBar />` resolves through a
	 * local import or the app registry, and a file with no `<script setup>` has no imports. The
	 * prototype would render an unresolved custom element — silently, since Vue only warns —
	 * and "compose mocks beside real components" would not work at all, which is the feature.
	 *
	 * `defineAsyncComponent` keeps the glob lazy: registering twelve components eagerly would
	 * mount the presentation layer to draw a list of links.
	 */
	// BOTH kinds. A top-level prototype composes the mocks written beside it, and a
	// template-only mock cannot import a sibling any more than it can import a component —
	// registering only the real ones leaves `<MockToolbar />` unresolved, which is half the
	// main flow. One registry across both is also what lets a mock TAKE the tag of the
	// component it stands in for, which is the workflow rather than a collision to refuse.
	const { byTag, ambiguous, shadowed } = registrableComponents([
		...componentEntries(),
		...prototypeEntries(),
	]);

	// One shared function with `indexApp.ts`, which is what makes the refusal below reachable
	// from a test at all — see `registerEntries` for what it refuses and why the alternative is
	// a wrong screenshot at exit 0.
	const refused = registerEntries(app, byTag);

	if (refused.length > 0) {
		console.error(`harness entries not registered, the tag is a plugin's: ${refused.join(', ')}`);
	}

	// The workflow, not a warning: a mock named after a component takes its tag.
	if (shadowed.length > 0) console.info(`mocks standing in for components: ${shadowed.join(', ')}`);

	// Two of one kind: registered for nobody rather than for whichever won a race. The
	// unresolved tag that follows is NOT left as a console warning — `IndexPage.vue` catches
	// Vue's resolution warning and turns it into a named entry failure, because a warning is
	// invisible to `harness-shot` and it would photograph the gap and exit 0.
	if (ambiguous.length > 0) console.warn(`ambiguous component tags, not registered: ${ambiguous.join(', ')}`);

	app.mount(root);
} else {
	/**
	 * `params.get('project')` is `null` when the parameter is absent, which is exactly the
	 * value `mountHarness` reads as "the list" — the same sentinel `RenovationProjectDeps.
	 * projectId` uses, so no translation happens here and a bare root keeps taking the
	 * untouched default.
	 *
	 * `?projects=<n>` (Task 12) seeds that many projects into the LIST state, which is the
	 * only way a headless capture reaches a populated Home surface: the bare root's world is
	 * empty by construction and draws the empty state, which is what its own three fixed shots
	 * are for. `?q=` seeds the filter beside it — `harness-shot` navigates and screenshots and
	 * types nothing, so the no-match state has no other route.
	 *
	 * `Number.parseInt` and a finiteness test rather than `Number(...)`: `?projects=` with no
	 * value is `''`, which `Number` reads as `0` — a request for the empty state wearing the
	 * stress case's clothes. `NaN` falls through to `undefined`, which is the bare root.
	 *
	 * **`Math.max(0, …)` because a NEGATIVE is finite and the guard above lets it through.**
	 * `?projects=-5` reaches `HOME_PROJECTS.slice(0, -5)`, which counts from the END and seeds
	 * TWENTY-FIVE rows — a picture that looks like a working stress case, under a URL asking for
	 * something else, at exit 0. That is the silent wrong-picture class every comment in this
	 * module invokes, and a finiteness test is exactly the shape of guard that reads as though it
	 * had closed it. Clamped rather than refused, because `0` is a state this page HAS: it is the
	 * empty vault the bare root already draws.
	 */
	const asked = Math.max(0, Number.parseInt(params.get('projects') ?? '', 10));
	view = wantsPlanEditor
		? mountPlanEditorHarness(document.body, {
				select: selectZoneId ?? undefined,
				add: wantsAddMenu,
				room,
				stale: wantsStale,
			}).view
		: wantsAssetDesigner
			? mountAssetDesignerHarness(document.body).view
			: wantsAssetLibrary
				? mountAssetLibraryHarness(document.body, params.get('asset'), params.get('assets') === '0').view
				: mountHarness(document.body, {
						projectId: params.get('project'),
						projects: Number.isFinite(asked) ? asked : undefined,
						initialQuery: params.get('q') ?? undefined,
					}).view;
}

// After the mount: the toggle is the harness's own furniture and is appended to the body,
// which `mountHarness` empties.
//
// `&bare` asks for a picture of the SCREEN, and `scripts/entryShots.mjs` puts it on every named
// capture — so the furniture is skipped there while the scheme, which is the content's and not
// the harness's, is still applied. Without the split every "chromeless" PNG carried a dashed
// `Harness: dark` button fixed over its bottom-right corner, including the ones this branch
// captured and looked at.
if (new URLSearchParams(window.location.search).has('bare')) applyWantedScheme();
else drawSchemeToggle();

/**
 * The view, for a throwaway probe pasted into a console — does the scroll position survive
 * a redraw, does hovering force layout. Without this hook each of those means editing this
 * file. Nothing in the harness or the suite reads it: it exists so that the thing thrown
 * away afterwards is a paste rather than a commit.
 *
 * `null` on the index branch, which mounts a Vue app rather than an Obsidian view — there is
 * no `ItemView` to hand out.
 */
(window as unknown as Record<string, unknown>).__rp = { view };

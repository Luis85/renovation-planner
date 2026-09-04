/**
 * Mount the REAL view outside Obsidian, for looking at rather than for asserting on.
 *
 * Everything here is shared with the test suite — the `obsidian` module mock, the fake
 * workspace, the construction order a view needs. The only thing this module adds is a
 * mount that does not depend on vitest, so the same view can be served to a browser
 * (`npm run harness`). It draws; it checks nothing. jsdom remains the substitute for
 * Obsidian in tests, and a real vault remains the only place appearance is verified.
 *
 * `makeView()` is called with no `deps` argument ON THE BARE PATH, which is what keeps this
 * file compiling unchanged now that design slice 14 gave the constructor a second parameter.
 * What that default IS moved in design slice 16, and both halves of the sentence that used to
 * sit here moved with it.
 *
 * `?project=<id>` (design slice 21) is the one path that does pass one, and it passes the same
 * default with two changes: a seeded project under the id the URL named, and that id as
 * `projectId`, which is what makes this the DETAIL state rather than the list. It exists
 * because the harness index cannot photograph that state at all — `IndexPage.vue` mounts a
 * component bare, and `ProjectDetail` requires three props and reads `project.name`
 * immediately, so the picture would be the index's own failure card. The two rules most worth
 * looking at are properties of the component's PLACE in `.renovation-planner-view`
 * (`.rp-project-detail`'s `flex: 1`, `.rp-project-detail__body`'s scroll), which a bare mount has no pane
 * for.
 *
 * It is no longer a fixed `ok({ projects: [], unreadable: 0 })`: `makeRenovationProjectView.ts`
 * builds a real `InMemoryProjectRepository` with a `ListProjects` reading it and a
 * `CreateProjectCommand` writing it — see that file's own docblock for why a refusing stand-in
 * would have been the wrong fake here. The repository starts EMPTY, so the page still opens on
 * the "no renovation projects yet" empty state; the difference is that its button now works.
 *
 * And the populated surface is no longer "nothing else to draw until a later slice": slice 16
 * built `ProjectList.vue`, so creating a project through that button replaces the empty state
 * with a real list of rows, in the same session, with no reload. That is the whole reason to
 * open this page rather than read the empty state's markup — and the reason the list's own
 * header layout, its focus ring and its long-name truncation were all found by photographing
 * this surface rather than by any gate.
 */
import type { RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { Plan } from '../../src/domain/plan/Plan';
import { Asset } from '../../src/domain/asset/Asset';
import { AssetPriceOverride } from '../../src/domain/asset-price/AssetPriceOverride';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { AssetPriceOverrideId } from '../../src/domain/asset-price/AssetPriceOverrideId';
// `createMoney`, not `of`, for the seeded amounts: `of` normalizes through `Decimal` and prints
// `41.50` back as `41.5`, so the capture — the one instrument this repository has for what a
// price LOOKS like — would photograph an amount no user would type. `createMoney` stores the
// spelling verbatim, which is what the section renders. ONE import statement with `currencyOf`
// beside it, because `import/no-duplicates` refuses two value imports of one module.
import { createMoney, currencyOf } from '../../src/core/money/Money';
import { Project } from '../../src/domain/project/Project';
import type { ProjectStatus } from '../../src/domain/project/ProjectStatus';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { installObsidianDom } from '../helpers/dom';
import { defaultRenovationProjectDeps, makeView, type SeedRepositories } from '../helpers/makeRenovationProjectView';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';
import { expectOk } from '../helpers/domain';

/**
 * The plans one seeded project holds, and the COUNT is the part that was measured rather than
 * picked.
 *
 * The rule most worth looking at here is that `.rp-plan-list` scrolls under a pinned `Plans`
 * header (`styles/project-detail.css`), and a list that FITS its pane cannot show it: the
 * first version of this fixture held twelve, and at an 800px leaf the `ul`'s scroll height
 * equalled its client height exactly — 360 against 360 — so deleting the whole `flex: 1;
 * min-height: 0; overflow-y: auto` block changed nothing a capture could see. Twenty-six is
 * past the ~22 that fit, so the list genuinely overflows and the rule has something to do.
 *
 * The long one is the ellipsis case `.rp-plan-list__name` states, and it is the row a 460px
 * capture — an Obsidian sidebar leaf's real width — actually exercises.
 */
const HARNESS_PLAN_NAMES = [
	'Ground floor',
	'First floor',
	'Second floor',
	'Loft conversion',
	'Basement tanking',
	'Rear extension',
	'Side return',
	'Garage conversion',
	'Garden studio',
	'Roof and gutters',
	'Bathroom, first floor',
	'Bathroom, ground floor',
	'Utility and boot room',
	'Kitchen, phase one',
	'Kitchen, phase two',
	'Hallway and stairs',
	'Front elevation',
	'Rear elevation',
	'Drainage and soakaway',
	'Driveway and parking',
	'Boundary wall',
	'Bin and bike store',
	'Electrical first fix',
	'Electrical second fix',
	'Heating and hot water',
	'South elevation, render and window replacement, phase two',
];

/**
 * A seed step's `Result`, unwrapped loudly — and "loudly" means an UNHANDLED REJECTION, which
 * is worth stating precisely because the first two sentences written here claimed otherwise.
 *
 * They said this "reads the settled value rather than awaiting" and the call site said the
 * error was "THROWN rather than `void`ed". Both are false of a `void promise.then(…)`: the
 * promise IS `void`ed, and a `.then` callback is a microtask, so the throw happens after
 * `mountHarness` has returned and mounted. There is no synchronous stop to be had here — a
 * promise cannot be read synchronously however fast it settles, and a real `await` would make
 * `mountHarness` async for every caller.
 *
 * What actually carries the loudness is the CAPTURE tool rather than this function:
 * `scripts/harness-shot.mjs` registers `page.on('pageerror')` AND a `console` listener that
 * records anything of type `error`, collects both into one list, and `reportErrors` sets
 * `process.exitCode = 1` from it. So a failed seed fails the RUN rather than exiting 0 over a
 * wrong picture — **not** the capture: the rejection is asynchronous and `page.screenshot` sits
 * inside `captureOne`'s `try`, so the PNG of the list IS written, and the non-zero exit is what
 * stops anyone reasoning about it. (The first draft of this paragraph said "fails the capture",
 * which contradicted the `Error` string one line below it — the correction round's own residue,
 * reported by the scoped re-review of the correction round.) Which of the two listeners an
 * unhandled rejection reaches is not measured here and the sentence does not claim it: the
 * console half is enough for the exit code, and the pinned Chromium is absent from this
 * container.
 *
 * Under `npm run harness` there is no such collector — it is a console line beneath a page that
 * quietly draws the list. The residue, named rather than implied, because the sentence that used
 * to sit here read as a guarantee this module gave on its own.
 *
 * Found by the whole-branch review.
 */
const expectSeeded = (saved: Promise<{ ok: boolean }>): void => {
	void saved.then((result) => {
		if (!result.ok) throw new Error('the harness fixture failed to seed; the capture would photograph the list');

		return result;
	});
};

/**
 * One project under the id a URL named, with a plan each from the list above.
 *
 * The id is CAST rather than minted: `createProjectId()` answers a fresh ULID, and a URL
 * cannot name one of those. That is exactly what `EntityId`'s brand exists to stop, and the
 * exception is bounded to this file — a harness fixture is the one place an id is a thing a
 * person types. `buildProjectIndexEntries` asserts a note's raw frontmatter into the same
 * brand after checking only that it is non-empty, so this is not even the loosest instance in
 * the tree; CLAUDE.md records that one.
 *
 * `expectOk` on both constructors: a fixture that silently drew nothing because a name failed
 * validation is a picture of the loading state with no error anywhere, which is the quiet this
 * whole capture tool exists against.
 */
/**
 * The catalogue rows the price section draws, and every one of them is a case worth LOOKING at
 * rather than a filler name.
 *
 * `Skirting board, primed` is deliberately the longest: the row is a wrapping flex row and the
 * name takes the slack, so a name that cannot fit is what says whether it ellipses or shoves the
 * input and the button off the row — the defect `.rp-project-list__name` already paid for at
 * 460px, which is an Obsidian sidebar leaf's real width and one of the two shots taken.
 *
 * Every catalogue price is EUR and the seeded project is GBP, which is this increment's central
 * case: a project pricing a shared asset that is denominated in another currency. `Oak flooring`
 * is the one with an override, so the capture shows a GBP price of this project's own beside a
 * EUR library default — "beside what it replaced" — while the two rows without one show what
 * that row looked like before.
 */
const HARNESS_ASSETS: readonly { id: string; name: string; amount: string; currency: string; own?: string }[] = [
	{ id: 'asset-1', name: 'Oak flooring', amount: '48.00', currency: 'EUR', own: '41.50' },
	{ id: 'asset-2', name: 'Underlay', amount: '7.25', currency: 'EUR' },
	{ id: 'asset-3', name: 'Skirting board, primed', amount: '11.90', currency: 'EUR' },
];

/**
 * The Home surface's stress fixture — §9's *"0, 1, 4 (typical), 30 (the stress case for tab
 * stops, ordering and scroll), and one project whose name overruns the pane at 460px"*.
 *
 * **The COUNT is a URL knob (`?projects=<n>`) and this list is read from the front**, so one
 * table serves every range §9 names: `?projects=1` and `?projects=4` are the small vaults the
 * filter line's own recorded risk is about (a search field over two projects is furniture), and
 * `?projects=30` is the stress case the fixed shots take. The bare root stays the empty state
 * and is `0`.
 *
 * Every field here exists because a capture needs it, and none of it is filler:
 *
 * - **`status` walks the whole lifecycle**, so the tick strip shows real stages side by side
 *   rather than ten copies of one. `COMPLETE` and `AS_BUILT` are both present because
 *   `isCompleted` files exactly those two into the collapsed `Completed` group — with neither,
 *   `<details>` never renders and item 8's hit-floor question about its summary inspects
 *   nothing.
 * - **`plans` and `daysAgo` are the facts slot.** A project with NO plans is deliberately in
 *   the list, because §8's content rule is that an empty entry renders nothing and its
 *   neighbours close up — a row showing its currency alone is the case that proves it, and a
 *   fixture where every project had plans could not show it.
 * - **`overlapping` puts one row under PRD §83's marker**, which is a third item in the row's
 *   trailing column and the exact shape that broke the status column once before.
 * - **The long name is `Hinterhaus…`, in GERMAN and unbroken.** It is what checklist item 3 and
 *   the container-query threshold are measured against, and an English one would measure the
 *   easy case: `Bestandsaufnahme` is 16 characters against `Survey`'s 6, so the row runs out of
 *   room in one locale well before the other.
 *
 * Names are deliberately NOT alphabetical here: `orderProjects` sorts, so a table already in
 * order would photograph a list that is correct whether or not the sort ran.
 */
const HOME_PROJECTS: readonly {
	name: string;
	status: ProjectStatus;
	plans: number;
	daysAgo: number;
	overlapping?: true;
}[] = [
	{ name: 'Maple Street, ground floor refit', status: 'EXECUTION', plans: 4, daysAgo: 0 },
	{ name: 'Küche und Speisekammer', status: 'DESIGN', plans: 2, daysAgo: 1 },
	{ name: 'Garden studio', status: 'IDEA', plans: 0, daysAgo: 3 },
	{ name: 'Hinterhaus, Dachgeschossausbau und Bestandsaufnahme', status: 'SURVEY', plans: 7, daysAgo: 4 },
	{ name: 'Bathroom, first floor', status: 'ESTIMATE', plans: 1, daysAgo: 6 },
	{ name: 'Ähre Cottage', status: 'PROCUREMENT', plans: 3, daysAgo: 9 },
	{ name: 'Rear extension', status: 'READY', plans: 5, daysAgo: 11 },
	{ name: 'Boundary wall and gates', status: 'INSPECTION', plans: 2, daysAgo: 14 },
	{ name: 'Loft conversion', status: 'COMPLETE', plans: 6, daysAgo: 21 },
	{ name: 'Side return', status: 'AS_BUILT', plans: 3, daysAgo: 40 },
	// The §83 marker's row, and the one whose folder the seed files inside the library.
	{ name: 'Shared library store', status: 'DESIGN', plans: 1, daysAgo: 2, overlapping: true },
	{ name: 'Utility and boot room', status: 'IDEA', plans: 0, daysAgo: 5 },
	{ name: 'Drainage and soakaway', status: 'SURVEY', plans: 2, daysAgo: 7 },
	{ name: 'Front elevation', status: 'DESIGN', plans: 1, daysAgo: 8 },
	{ name: 'Electrical first fix', status: 'ESTIMATE', plans: 2, daysAgo: 10 },
	{ name: 'Heating and hot water', status: 'PROCUREMENT', plans: 4, daysAgo: 12 },
	{ name: 'Driveway and parking', status: 'READY', plans: 1, daysAgo: 13 },
	{ name: 'Bin and bike store', status: 'EXECUTION', plans: 1, daysAgo: 15 },
	{ name: 'Roof and gutters', status: 'INSPECTION', plans: 3, daysAgo: 16 },
	{ name: 'Basement tanking', status: 'COMPLETE', plans: 2, daysAgo: 30 },
	{ name: 'Garage conversion', status: 'AS_BUILT', plans: 5, daysAgo: 55 },
	{ name: 'Hallway and stairs', status: 'IDEA', plans: 0, daysAgo: 17 },
	{ name: 'Second floor', status: 'SURVEY', plans: 1, daysAgo: 18 },
	{ name: 'Kitchen, phase two', status: 'DESIGN', plans: 2, daysAgo: 19 },
	{ name: 'Zimmer drei', status: 'ESTIMATE', plans: 1, daysAgo: 20 },
	{ name: 'Rear elevation', status: 'PROCUREMENT', plans: 2, daysAgo: 22 },
	{ name: 'Electrical second fix', status: 'READY', plans: 1, daysAgo: 23 },
	{ name: 'Bathroom, ground floor', status: 'EXECUTION', plans: 3, daysAgo: 24 },
	{ name: 'First floor', status: 'INSPECTION', plans: 2, daysAgo: 25 },
	{ name: 'Bin store, phase two', status: 'COMPLETE', plans: 1, daysAgo: 60 },
];

/**
 * Where a seeded project's own note SITS, which is the whole of what decides its §83 marker:
 * `IndexLibraryOverlaps` derives the folder from the note's path (ADR-0013) and compares it
 * against the library folder, so a row is marked by being filed inside `Renovation/Library`
 * and by nothing else.
 *
 * `DEFAULT_SETTINGS.libraryFolder` rather than the string, because the seed and the adapter
 * under test must not be two spellings of one setting.
 */
const noteFolderFor = (name: string, overlapping: boolean): string =>
	overlapping ? `${DEFAULT_SETTINGS.libraryFolder}/${name}` : `Renovation/Projects/${name}`;

/**
 * A world of `count` projects, indexed and dated — the LIST state's fixture.
 *
 * **It seeds the INDEX as well as the repositories, and that is the whole reason
 * `SeedRepositories` grew two members.** Three of the five fields a row renders do not come
 * from the project repository at all: `planCount` and `lastWorked` are derived by
 * `IndexProjectListFacts` from index entries and file stats, and `libraryOverlap` by
 * `IndexLibraryOverlaps` from the note's folder. Seeding only `projects` and `plans` — which is
 * what the brief for this task described — produces thirty rows all reading `EUR` alone, with
 * no plan count, no date and no marker: a capture of the facts slot with no facts in it, which
 * reads exactly like a capture that found nothing wrong.
 *
 * The plans are indexed but NOT saved to the plan repository, and the asymmetry is deliberate
 * rather than an oversight: `planCount` is a count of index entries, and this state never opens
 * a detail state, so a `Plan` entity per row would be 79 domain objects nothing reads. The
 * detail fixture below saves real plans because its surface lists them.
 */
const seedHome = (count: number) => (
	{ projects, index, touch }: SeedRepositories,
): void => {
	HOME_PROJECTS.slice(0, count).forEach((entry, at) => {
		const id = `home-${at + 1}` as ProjectId;
		const project = expectOk(
			Project.create({
				id,
				name: entry.name,
				status: entry.status,
				currency: currencyOf('EUR'),
			}),
		);
		expectSeeded(projects.save(project, 'absent'));

		const notePath = `${noteFolderFor(entry.name, entry.overlapping === true)}/Project.md`;
		index.upsert({ id, type: 'renovation-project', path: notePath });
		// `daysAgo` counted back from ONE fixed instant rather than from each row's own
		// `Date.now()`, so the spread between rows is the fixture's and not the loop's.
		touch(notePath, new Date(Date.now() - entry.daysAgo * 24 * 60 * 60 * 1000));

		for (let plan = 0; plan < entry.plans; plan += 1) {
			index.upsert({
				id: `${id}-plan-${plan + 1}` as PlanId,
				type: 'renovation-plan',
				path: `${noteFolderFor(entry.name, entry.overlapping === true)}/Plans/Plan ${plan + 1}.md`,
				projectId: id,
			});
		}
	});
};

const seedProject = (projectId: string) => (
	{ projects, plans, assets, overrides }: SeedRepositories,
): void => {
	const id = projectId as ProjectId;
	const project = expectOk(
		Project.create({
			id,
			name: 'Maple Street, ground floor refit',
			status: 'EXECUTION',
			// GBP against a EUR catalogue, which is this increment's CENTRAL case: the library
			// default and this project's own price are denominated differently, and the price
			// section prints both. An all-EUR fixture would photograph the section without
			// photographing the thing it exists for.
			currency: currencyOf('GBP'),
		}),
	);

	// Checked rather than discarded, and the reason is what this fixture is for: a failed save
	// leaves an empty world, both captures then photograph the LIST, and they wait on
	// `.renovation-planner-view`, which the list satisfies — so `npm run harness-shot` would
	// write two PNGs of the wrong state and exit 0. `expectSeeded`'s docblock says by what
	// mechanism that is made loud, and it is not this file's.
	expectSeeded(projects.save(project, 'absent'));

	HARNESS_PLAN_NAMES.forEach((name, index) => {
		const plan = expectOk(Plan.create({ id: `plan-${index + 1}` as PlanId, projectId: id, name }));

		expectSeeded(plans.save(plan, 'absent'));
	});

	// The catalogue, plus this project's own price for one of it — so the capture shows a row
	// with an override beside two without, which is the comparison the section exists for.
	// `expectSeeded` on every save, for the reason it states: a fixture that silently seeded
	// nothing photographs the section's empty state and exits 0.
	HARNESS_ASSETS.forEach((entry) => {
		const asset = expectOk(
			Asset.create({
				id: entry.id as AssetId,
				name: entry.name,
				category: 'material',
				unit: 'm2',
				unitCost: expectOk(createMoney(entry.amount, entry.currency)),
			}),
		);
		expectSeeded(assets.save(asset, 'absent'));
		if (entry.own === undefined) return;
		const override = expectOk(
			AssetPriceOverride.create({
				id: `price-${entry.id}` as AssetPriceOverrideId,
				projectId: id,
				assetId: entry.id as AssetId,
				// The PROJECT's currency, never the catalogue entry's: an override is what this
				// project pays, and `SetAssetPriceOverrideCommand` refuses any other — so a
				// fixture spelling the catalogue's currency here would seed a row no command
				// could have written.
				unitCost: expectOk(createMoney(entry.own, 'GBP')),
			}),
		);
		expectSeeded(overrides.save(override, 'absent'));
	});
};

/**
 * The seeded default, plus the one member this page can honestly answer that the shared
 * default cannot: `navigate`.
 *
 * `defaultRenovationProjectDeps` leaves it inert because it has no workspace to navigate in,
 * and it says so. This page HAS the view, so Back and a project row both do here what they do
 * in a vault — a `setState` round trip through the view's own state machine, which is the
 * mechanism rather than an imitation of it. A harness whose only way out of the detail state
 * is the URL bar is a tool for looking at one screen, and the pair is what a person actually
 * wants to check.
 *
 * The view is reached through a THUNK because it does not exist yet: `makeView` takes these
 * deps as its argument. Called only from a click, long after the constructor has returned.
 */
const harnessDetailDeps = (projectId: string, view: () => RenovationProjectView): RenovationProjectDeps => ({
	...defaultRenovationProjectDeps(seedProject(projectId)),
	// `''` is the LIST, which is the sentinel `RenovationProjectView.getState` writes and
	// `projectIdFrom` parses back — not a value this page invents.
	navigate: (id) => {
		void view().setState({ projectId: id ?? '' }, { history: true });
	},
});

/** The one plan the Continue row names, shared by the seed that saves it and the context that points at it. */
const CONTINUE_PLAN_ID = 'home-1-plan-1' as PlanId;

/**
 * The LIST state over `seedHome`, plus the two members that make it worth photographing.
 *
 * `navigate` is `harnessDetailDeps`'s, for its reason: a list whose rows go nowhere is a
 * picture rather than the surface. `continueContext` answers a REAL context naming the first
 * seeded project and one of its plans — §7's Continue group renders only when the stored ids
 * resolve against what this mount actually read, so a `null` here (the shared default's honest
 * answer, since it has no store) draws no Continue group at all and checklist item 7c inspects
 * nothing.
 *
 * The plan it names is `home-1-plan-1`, which `seedHome` puts in the INDEX and not in the plan
 * repository — and `ViewRoot.resolveStored` resolves the plan half through
 * `queries.listPlansByProject`, which reads that repository. So the plan resolves to a miss and
 * the group does not render. That is why this seeds one real `Plan` for it: the fixture has to
 * satisfy the query the view actually asks, not the one the index would answer.
 */
const harnessHomeDeps = (
	count: number,
	initialQuery: string | undefined,
	view: () => RenovationProjectView,
): RenovationProjectDeps => ({
	...defaultRenovationProjectDeps((repositories) => {
		seedHome(count)(repositories);
		if (count < 1) return;
		const plan = expectOk(
			Plan.create({ id: CONTINUE_PLAN_ID, projectId: 'home-1' as ProjectId, name: 'Ground floor' }),
		);
		expectSeeded(repositories.plans.save(plan, 'absent'));
	}),
	initialQuery,
	navigate: (id) => {
		void view().setState({ projectId: id ?? '' }, { history: true });
	},
	continueContext: () =>
		Promise.resolve(count < 1 ? null : { projectId: 'home-1', planId: CONTINUE_PLAN_ID }),
});

export interface MountedHarness {
	/** The workspace leaf the app would give the view. */
	leafEl: HTMLElement;
	/** The view itself, for a probe pasted into a console. */
	view: RenovationProjectView;
}

/**
 * Which of the three worlds this page draws. Three INDEPENDENT knobs, which is why this is an
 * options object rather than the positional parameters the brief for this task specified: the
 * stress fixture is a LIST state and `projectId` selects the DETAIL one, so neither can express
 * the other and a `(root, projectId?, initialQuery?)` signature has nowhere to put a count.
 *
 * Every field absent — which is every existing caller, all of them `mountHarness(document.body)`
 * — is the empty vault, unchanged.
 */
export interface HarnessMountOptions {
	/** `?project=<id>`: the DETAIL state on a seeded project of that id. */
	readonly projectId?: string | null;
	/** `?projects=<n>`: the LIST state over that many of `HOME_PROJECTS`. */
	readonly projects?: number;
	/** `?q=<text>`: what the filter starts with. Only meaningful beside `projects`. */
	readonly initialQuery?: string;
}

export function mountHarness(root: HTMLElement, options: HarnessMountOptions = {}): MountedHarness {
	// Obsidian's DOM prototype extensions (`createEl`, `createDiv`, `empty`, `setText`,
	// `addClass`). The view calls them and a browser has none of them, so this is what
	// makes the same code run on a plain page. Installed first, because everything below
	// uses it.
	installObsidianDom();
	root.empty();

	// Real nesting on purpose. `containerEl` is what the app hands a view and `contentEl` is
	// the pane inside it, so a view that empties the wrong one is as visible here as in the
	// suite — and the leaf frame, together with the rules `tests/harness/theme.css` keys off
	// it, is what supplies the height Obsidian's own pane would.
	const leafEl = root.createDiv('rp-harness-leaf');
	const { projectId, projects, initialQuery } = options;
	// NO ARGUMENT on the bare path, deliberately: the docblock in
	// `makeRenovationProjectView.ts` says why the untouched default is what the harness root
	// takes, and the empty state is what that root exists to show. `?project=` and `?projects=`
	// are the two opt-ins.
	// ANNOTATED, and the annotation is load-bearing rather than style: both harness bundles
	// close over `view` to reach `setState`, so the initializer references the very binding it
	// initialises and inference goes circular (`TS7022`/`TS7024`). The closure is only ever
	// CALLED from a click, long after this line has returned.
	//
	// `projectId` is tested FIRST, so `?project=X&projects=30` draws the detail state rather
	// than silently seeding a world its id is not in: the two fixtures mint different ids
	// (`project-1` against `home-N`), so a bundle that seeded `home` and then opened `project-1`
	// would draw the "no longer there" screen — a wrong picture at exit 0, which is the failure
	// this whole capture tool exists against.
	const view: RenovationProjectView =
		projectId !== undefined && projectId !== null
			? makeView(harnessDetailDeps(projectId, () => view))
			: projects === undefined
				? makeView()
				: makeView(harnessHomeDeps(projects, initialQuery, () => view));
	leafEl.appendChild(view.containerEl);
	// The view's own first draw. `void` rather than awaited: this function is called from a
	// page entry that cannot await, and `onOpen` does its work synchronously before the
	// promise it returns.
	void view.onOpen();
	// The DETAIL state is reached the way Obsidian reaches it — through `setState`, after
	// `onOpen`, which is one of the two orderings the view is built to survive. NOT by passing
	// `projectId` in `deps`: `RenovationProjectView.mount` writes its own field over that
	// member on every mount, so a bundle naming a project would be silently ignored and this
	// page would draw the list while claiming to draw a project.
	if (projectId !== undefined && projectId !== null) void view.setState({ projectId }, { history: false });

	return { leafEl, view };
}

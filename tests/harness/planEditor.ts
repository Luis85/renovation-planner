import { planningRecoveryProbe } from './planningRecoveryProbe';
import { editorFidelityProbe } from './editorFidelityProbe';
import { referenceWorkspace } from './referenceWorkspace';
import { downstreamWorkspace } from './downstreamWorkspace';
import { err, ok } from '../../src/core/result/Result';
import type { PersistenceError } from '../../src/core/errors/AppError';
import { Zone } from '../../src/domain/zone/Zone';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { ZoneType } from '../../src/domain/zone/ZoneType';
import type { ZoneStatus } from '../../src/domain/zone/ZoneStatus';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { Structure } from '../../src/domain/spatial/Structure';
import type { Loaded } from '../../src/application/ports/versioning';
import type { ZoneRepository } from '../../src/application/ports/ZoneRepository';
import { PlanEditorView, type PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../src/presentation/editor/planEditorCommands';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { formatMetres } from '../../src/presentation/editor/shell/formatLength';
import { installObsidianDom } from '../helpers/dom';
import { emptyRequirementReads, zoneInspectorAnswering } from '../helpers/planFixtures';
import { observationToken } from '../helpers/domain';
import { FakeLeaf } from '../helpers/workspace';
// From `../helpers/settle`, deliberately not `../helpers/editor`: that file also imports
// Konva, Pinia, `@vue/test-utils` and `tests/helpers/canvas.ts`'s native `@napi-rs/canvas`
// binding, none of which may reach a page Vite serves to a real browser — `page.ts` imports
// this module for every route, so pulling that whole graph in broke every fixed shot, not only
// the Plan Editor's, with Vite's dependency optimizer refusing to bundle a native `.node` file
// as JavaScript. `../helpers/settle` has no import beyond `Promise`/`Date`/`setTimeout`.
import { settleUntil } from '../helpers/settle';
import { selectMultipleOnceReady } from './multiSelectionKnob';
import { collapsePanelsOnceReady } from './panelsKnob';
import { areaNumericWorkspace, enterNumericArea } from './areaNumericWorkspace';
import { memoryDeviceStorage } from '../helpers/deviceStorage';
import { detailedZoneDeps, detailPlanDeps, lockedZoneDeps, treePlanDeps } from './detailPlanKnob';
import { roomsDeps } from './roomsKnob';
import { runtimeOfPluginView } from '../helpers/editorRuntime';
import { driveItemKnob, type ItemGesture } from './itemKnob';
import { loadedZones } from './unreadableKnob';

/**
 * The REAL Plan Editor, mounted outside Obsidian for LOOKING at — `npm run harness`
 * with `?view=plan-editor`.
 *
 * This is the only place the layered Konva scene can be seen against Obsidian's own
 * app.css, in both colour schemes, at a real size. jsdom draws nothing and the suite
 * asserts structure; a browser is what shows whether the shell's five regions actually fit
 * together and whether zone fills read against a real theme's background.
 *
 * **No background document**, deliberately. The harness has no vault, so a background
 * would have to come from a committed binary or from a data URI built on the page — and
 * the second is a model of the base64 embedding §55 forbids, sitting right next to the
 * code that must never do it. The background pipeline is covered by the suite, with a real
 * PNG and a real PDF rasterized through real pdf.js, and by `npm run test-build` in a live
 * vault. What this page is for is the SCENE.
 *
 * `HARNESS_PLAN` and `HARNESS_ZONES` are EXPORTED because the harness index mounts single
 * components against the same world (`fixture.ts`). One fixture rather than two: a second
 * set would be a second derivation that can answer differently, and two components drawn
 * from two plans that differ in a way nobody notices is exactly the defect one world buys
 * its way out of. `harnessDeps` is exported for the same reason and carries more surface —
 * a cast vault, two always-answering queries and an Inspector query answered from the zones
 * above — that `fixture.ts`'s editor context now hands to every component the index mounts,
 * not only to this page's own view. Its WRITES all refuse; see `commands` below for why the
 * one read in that bundle does not.
 */

export const HARNESS_PLAN: PlanDto = {
	id: 'harness-plan',
	projectId: 'harness-project',
	name: 'Ground floor',
	kind: 'floor',
	order: 0,
	background: null,
	// Uncalibrated, which is the honest value rather than the convenient one: this plan has no
	// background to have been calibrated AGAINST, so the zones below are already in the world
	// units they claim. A `Calibration` here would say a measurement was taken that was not.
	//
	// The field was simply ABSENT until `tsconfig.json` started type-checking this file — the
	// annotation said `PlanDto` and nothing ever asked whether it was one.
	calibration: null,
	layers: [],
};

/**
 * The project `HARNESS_PLAN` belongs to — same id as `HARNESS_PLAN.projectId`. Not
 * exported, unlike its two siblings above: `fixture.ts` mounts single components against
 * `HARNESS_PLAN`/`HARNESS_ZONES` directly, and nothing outside `harnessDeps()` needs this
 * one yet.
 */
const HARNESS_PROJECT: ProjectSummaryDto = {
	id: HARNESS_PLAN.projectId,
	name: 'Willow House',
	status: 'DESIGN',
	currency: 'EUR',
	libraryOverlap: false,
	// The two Renovation Planner Home facts, which this fixture carries because
	// `ProjectSummaryDto` requires them and NOT because the editor draws either — nothing it
	// mounts reads `planCount` or `lastWorked`. `0` and `null` rather than plausible-looking
	// numbers, so the fixture states the same thing `createPlanEditorQueries.getProject`
	// really answers (`UNKNOWN_ROW_FACTS`) rather than a richer world than production has.
	//
	// Spelled out rather than spread from that constant: a fixture that agrees with production
	// BY CONSTRUCTION cannot disagree with it, and disagreeing is the whole job of a fixture.
	//
	// Added at the merge that brought this file and the required fields together from two
	// branches. It is one of five sites `vue-tsc` named and no test could: the file compiled
	// on `origin/main` and the field was required on the other side.
	planCount: 0,
	lastWorked: null,
};

/**
 * A small flat we can recognise at a glance — rooms of plausible domestic sizes in
 * millimetres, one of each status (off the canvas since the 2026-09-10 canvas fidelity pass;
 * the Room Inspector's Status row shows it — see M01), and one zone
 * with a non-rectangular outline so the polygon path is not being judged on rectangles alone.
 */
export const HARNESS_ZONES: readonly ZoneDto[] = [
	{
		id: 'harness-kitchen',
		planId: HARNESS_PLAN.id,
		name: 'Kitchen',
		zoneType: 'Room',
		status: 'Planned',
		points: [
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3000 },
			{ x: 0, y: 3000 },
		],
	},
	{
		id: 'harness-bath',
		planId: HARNESS_PLAN.id,
		name: 'Bathroom',
		zoneType: 'Room',
		status: 'InProgress',
		points: [
			{ x: 4400, y: 0 },
			{ x: 6800, y: 0 },
			{ x: 6800, y: 2200 },
			{ x: 4400, y: 2200 },
		],
	},
	{
		id: 'harness-terrace',
		planId: HARNESS_PLAN.id,
		name: 'Terrace',
		zoneType: 'Terrace',
		status: 'Complete',
		points: [
			{ x: 0, y: 3200 },
			{ x: 6800, y: 3200 },
			{ x: 6800, y: 5400 },
			{ x: 3400, y: 6600 },
			{ x: 0, y: 5400 },
		],
	},
	{
		id: 'harness-garden',
		planId: HARNESS_PLAN.id,
		name: 'Garden',
		zoneType: 'Garden',
		status: 'Planned',
		points: [
			{ x: 7000, y: 0 },
			{ x: 12_000, y: 0 },
			{ x: 12_000, y: 6600 },
			{ x: 7000, y: 6600 },
		],
	},
];

/**
 * The Kitchen's four walls, a door in the south wall and a window in the north one. Present
 * since 2026-09-10 because the fixture had NO walls before it, so no capture ever drew a
 * joint or an opening — and the wall stroke's alpha had been doubling at every corner in a
 * real vault while every gate stayed green. Terrace and Garden stay open on purpose: the
 * same frame then photographs a room with walls and a room whose outline is its own. The Garden
 * carries free-standing walls, no boundary, one group per corner case `wallPasses` draws.
 *
 * Wall order follows the zone's vertex order (north, east, south, west), so the loop reads
 * the way `harness-kitchen`'s polygon does. The walls sit OUTSIDE the Kitchen, inner faces on its
 * edges, the way Enclose with walls builds them (`encloseRoom`); 200 mm so their outer faces meet
 * the Bathroom's and Terrace's edges rather than crossing into them. Opening offsets run from each
 * wall's `start`. Ids start `wall-` and `opening-` because `validateStructure` refuses any other
 * and this fake does not validate; `zoneOutlineEnclosure.test.ts` writes it through the real sidecar.
 */
export const HARNESS_STRUCTURE: Structure = {
	walls: [
		{ id: 'wall-harness-north', start: { x: -100, y: -100 }, end: { x: 4300, y: -100 }, thickness: 200, height: 2600 },
		{ id: 'wall-harness-east', start: { x: 4300, y: -100 }, end: { x: 4300, y: 3100 }, thickness: 200, height: 2600 },
		{ id: 'wall-harness-south', start: { x: 4300, y: 3100 }, end: { x: -100, y: 3100 }, thickness: 200, height: 2600 },
		{ id: 'wall-harness-west', start: { x: -100, y: 3100 }, end: { x: -100, y: -100 }, thickness: 200, height: 2600 },
		// Garden walls, one per joint `wallPasses` distinguishes. A planter loop: two right, one acute and one obtuse mitre.
		{ id: 'wall-harness-planter-north', start: { x: 7600, y: 700 }, end: { x: 10_000, y: 700 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-planter-east', start: { x: 10_000, y: 700 }, end: { x: 9000, y: 2700 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-planter-south', start: { x: 9000, y: 2700 }, end: { x: 7600, y: 2700 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-planter-west', start: { x: 7600, y: 2700 }, end: { x: 7600, y: 700 }, thickness: 200, height: 900 },
		// An open chevron, its second wall drawn the other way round: one sharp mitre, two free ends.
		{ id: 'wall-harness-chevron-west', start: { x: 10_500, y: 2600 }, end: { x: 11_100, y: 700 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-chevron-east', start: { x: 11_700, y: 2600 }, end: { x: 11_100, y: 700 }, thickness: 200, height: 900 },
		// A T: three walls at one joint are capped, not chained.
		{ id: 'wall-harness-tee-west', start: { x: 7600, y: 3600 }, end: { x: 9000, y: 3600 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-tee-east', start: { x: 9000, y: 3600 }, end: { x: 10_400, y: 3600 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-tee-stem', start: { x: 9000, y: 3600 }, end: { x: 9000, y: 4800 }, thickness: 200, height: 900 },
		// An L of unequal walls: capped, not chained.
		{ id: 'wall-harness-step-thick', start: { x: 10_800, y: 3600 }, end: { x: 11_600, y: 3600 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-step-thin', start: { x: 11_600, y: 3600 }, end: { x: 11_600, y: 4800 }, thickness: 100, height: 900 },
		// A curved wall chained between straight ones, mitred where the tangent turns.
		{ id: 'wall-harness-curve-west', start: { x: 7600, y: 5600 }, end: { x: 9000, y: 5600 }, thickness: 200, height: 900 },
		{ id: 'wall-harness-curve-arc', start: { x: 9000, y: 5600 }, end: { x: 10_400, y: 5600 }, thickness: 200, height: 900, bulge: 0.4 },
		{ id: 'wall-harness-curve-east', start: { x: 10_400, y: 5600 }, end: { x: 11_000, y: 5000 }, thickness: 200, height: 900 },
	],
	openings: [
		{ id: 'opening-harness-door', kind: 'door', hostId: 'wall-harness-south', offset: 1600, width: 900, height: 2100, sill: 0, swing: { hinge: 'start', side: 'left', angle: 90 } },
		{ id: 'opening-harness-window', kind: 'window', hostId: 'wall-harness-north', offset: 1600, width: 1200, height: 1200, sill: 900 },
	],
	boundaries: [{ roomId: 'harness-kitchen', wallIds: ['wall-harness-north', 'wall-harness-east', 'wall-harness-south', 'wall-harness-west'] }],
};

/**
 * The one zone the `?stale` knob is allowed to delete — never the one a capture SELECTS, so
 * the picture's own subject survives the gesture that stales it. `findZonesByPlan` below is a
 * fixed answer with no vault behind it to have actually lost this zone, so it stays on the
 * canvas regardless of the deletion the trust path believes happened; picked for no reason
 * narrower than "not the zone `plan-editor-stale`'s query selects".
 */
const STALE_TRIGGER_ZONE_ID = 'harness-garden';

/** The one error `harnessDeps`'s stale knob answers with, once it is armed. */
function staleKnobFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'vault.unexpected-failure',
		message: 'harness: stale knob',
	};
}

/**
 * A REAL domain `Zone`, loaded, for `STALE_TRIGGER_ZONE_ID` — what
 * `ReversibleDeleteZoneCommand.execute()` reads through `ZoneRepository.getById` BEFORE it
 * dispatches, and what this harness has no vault behind that port to answer honestly from.
 * Built from `HARNESS_ZONES` rather than hand-spelled a second time, so the snapshot and the
 * fixture cannot describe two different zones.
 */
function staleTriggerZoneSnapshot(): Loaded<Zone> {
	const dto = HARNESS_ZONES.find((zone) => zone.id === STALE_TRIGGER_ZONE_ID);
	if (dto === undefined) {
		throw new Error(`the ?stale knob's own sacrifice zone "${STALE_TRIGGER_ZONE_ID}" is not in HARNESS_ZONES`);
	}
	const created = Zone.create({
		id: dto.id as ZoneId,
		planId: HARNESS_PLAN.id as PlanId,
		projectId: HARNESS_PLAN.projectId as ProjectId,
		name: dto.name,
		zoneType: dto.zoneType as ZoneType,
		status: dto.status as ZoneStatus,
		geometry: { points: dto.points },
	});
	if (!created.ok) {
		throw new Error(`the ?stale knob's sacrifice zone failed to construct: ${created.error.message}`);
	}
	return { entity: created.value, version: { revision: 1, observed: observationToken('harness-stale-knob') } };
}

/**
 * The one repository PORT the stale knob's single write needs — `execute()`'s own snapshot
 * read, and nothing past it: `undo()` is never called here, so every other method refuses
 * exactly as `unavailablePlanEditorCommands`'s `refusingPort` already does for a session with
 * no vault at all.
 */
function staleTriggerZonesPort(snapshot: Loaded<Zone>): ZoneRepository {
	const refuse = () => Promise.resolve(err(staleKnobFailure()));
	return {
		getById: (id) => Promise.resolve(id === snapshot.entity.id ? ok(snapshot) : err(staleKnobFailure())),
		save: refuse,
		delete: refuse,
		listByProject: refuse,
		listByPlan: refuse,
	};
}

/**
 * The stale knob's own `deleteZone`, succeeding once for `STALE_TRIGGER_ZONE_ID` where
 * `unavailablePlanEditorCommands` refuses every write. `HARNESS_ZONES` carries no
 * Requirement referencing any zone (`emptyRequirementReads`), so the real delete flow's
 * zero-referent branch dispatches straight through with no dialog — the one write this
 * harness can complete honestly with no vault behind it.
 */
function staleTriggerDeleteZoneCommand(): PlanEditorCommandServices['deleteZone'] {
	return {
		execute: (input) =>
			Promise.resolve(
				ok({ deletedId: input.zoneId, affectedBefore: [], affectedAfter: [], zoneId: input.zoneId }),
			),
	};
}

/**
 * The dependencies a Plan Editor takes, answered from the fixtures above. Nothing here
 * reaches a vault: `getAbstractFileByPath` always answers `null`, which is the "no
 * background" path the header explains.
 *
 * `stale` arms the `?stale` knob (Task 14, trust-path design spec §2.3/§2.4): the SECOND
 * `getPlan` — the read-back every post-write refresh takes — and every one after it answer
 * `staleKnobFailure()` instead of the plan, so a real successful write's own
 * `keepPreviousOnFailure` re-read fails exactly as a real vault fault would. `harnessDeps()`
 * with no argument is unaffected — every existing caller (`fixture.ts`, its own tests) calls
 * it that way, and `stale` defaults to off.
 *
 * `unreadable` arms the `?unreadable=N` knob: `findZonesByPlan` answers that refusal count, so
 * the `unreadable-zones` warning row — and the **Show diagnostics report** button it carries —
 * can be drawn at all. It was unreachable before, because the count was hard-coded to `0`.
 * It also REMOVES those N zones from the answer (`unreadableKnob.ts`, which owns which two and
 * refuses an `N` above them); the count alone made this fake kinder than a real listing.
 */
export function harnessDeps(options: { readonly stale?: boolean; readonly unreadable?: number } = {}): PlanEditorDeps {
	const stale = options.stale === true;
	const unreadable = Math.max(0, options.unreadable ?? 0);
	// Synchronous, so an `N` above the fixture's maximum refuses here rather than inside a
	// promise nothing awaits.
	const loaded = loadedZones(HARNESS_ZONES, unreadable);
	// Closure-scoped rather than truly module-level: each capture is a fresh page navigation
	// in a real browser, so module state resets on its own, and a counter that lived here
	// instead would carry a call from one mount into the next if this page ever mounted the
	// editor twice in one session, which `harness-shot` does not do today but nothing here
	// should rely on.
	let reads = 0;

	return {
		queries: {
			// **A fresh DTO per call, not the constant.** The real query builds its DTOs from
			// notes it just read, so every caller gets objects of its own; handing back the
			// module constant made this fake THINNER than the thing it stands in for, and
			// `PlanEditorRoot.hydrate()` puts whatever it gets straight into Pinia's deep
			// reactive state. So a scripted prototype composing the editor replaced
			// `reseedFixture()`'s copies with these very objects, and the next mutation through
			// the store edited the fixture itself — the leak that function's clone closes,
			// re-opened one seam over. Both clones are needed: this one covers hydration, that
			// one covers the synchronous seed, and neither path goes through the other.
			getPlan: () => {
				reads += 1;
				if (stale && reads >= 2) return Promise.resolve(err(staleKnobFailure()));
				return Promise.resolve(ok(structuredClone(HARNESS_PLAN)));
			},
			// Honours the requested id — the real query answers `ok(null)` for one it does not
			// recognise, and answering `HARNESS_PROJECT` for any id would leave a `hydrate`
			// call that asked for the wrong field indistinguishable from one that asked for the
			// right one. See [[Project-hydration fakes ignore the requested project ID]].
			getProject: (id) => Promise.resolve(ok(id === HARNESS_PROJECT.id ? structuredClone(HARNESS_PROJECT) : null)),
			listPlans: () => Promise.resolve(ok([structuredClone(HARNESS_PLAN)])),
			// `zones` is the pruned list; **`structure` is NOT, and that is not a compromise.**
			// The real query (`planEditorQueries.ts`) reads `structure` out of the per-plan
			// GEOMETRY SIDECAR — one shared document, read independently of which zone notes
			// loaded — so a real vault at `unreadable=2` hands back the whole structure beside
			// two zones. Pruning it here would be a NEW infidelity, not a smaller one.
			findZonesByPlan: () =>
				Promise.resolve(ok({ zones: structuredClone(loaded), unreadable, structure: structuredClone(HARNESS_STRUCTURE) })),
			// Slice 10's four reads, shared with `fakeQueries` — see `emptyRequirementReads`
			// for why EMPTY rather than refused, and for what a refusal bundle costs a READ.
			...emptyRequirementReads(),
		},
		/**
		 * Every WRITE refuses with `settings.unrecovered`, the honest answer for a page with no
		 * vault behind it — the buttons render and the gestures fail like any other failed write
		 * rather than pretending to persist.
		 *
		 * **`zoneInspector` is a READ, and it is answered here rather than refused.** The bundle
		 * carries it because SDD §59 groups the Inspector query with the commands it shares a
		 * selection with, and for that bundle's PRODUCTION purpose — settings unrecovered, no
		 * vault — refusing the read is correct, because there is nothing to read. On this page
		 * there is: `HARNESS_ZONES` is right there. Reaching for the refusal bundle wholesale
		 * made a stand-in HARSHER than the thing it stands in for, and the harness is a tool for
		 * LOOKING: `InspectorStore` maps a failed read onto `{ kind: 'empty' }` (its own docblock
		 * names the gap — `InspectorDto` has no error variant), so selecting the seeded Kitchen
		 * showed it selected on the canvas and empty in the Inspector, with no error anywhere and
		 * two of the five shell regions contradicting each other. `docs/actors/Designer.md` asks
		 * for the opposite: a component that cannot mount says so and names itself.
		 *
		 * The area is computed with the same `core/geometry` operation `Zone.area()` calls rather
		 * than being written down beside each fixture zone — a second derivation would answer
		 * differently the day either changes, and the number on screen has to be the one the
		 * domain would produce. `zoneInspectorAnswering` (`tests/helpers/planFixtures.ts`) is
		 * where that computation now lives, shared with `tests/helpers/editor.ts`'s jsdom
		 * default: `fallow` caught this file's own version and that one's as an identical
		 * 12-line clone the day the jsdom default started answering this read too (Task 22).
		 *
		 * **`zones` — the `ZoneRepository` — is deliberately left refusing**, and the reason is
		 * not that it matters less. Its reads are reached in this bundle only by the reversible
		 * adapters' RESTORE halves, i.e. only after a successful write, and no write on this page
		 * succeeds; nothing else here calls one. Answering them would mean handing back
		 * `Loaded<Zone>` — real domain entities with real revision handles — built from these
		 * DTOs, which is a second derivation of the fixture world in a second shape, maintained
		 * for a path the page cannot reach. When a harness entry does reach one, the honest fix
		 * is a fixture repository, not a cast; until then the refusal is what "nothing can be
		 * written, so nothing can be restored" actually means.
		 *
		 * **The `?stale` knob is the one exception, on `deleteZone` and `zones` alone.** It needs
		 * ONE real write to land — a zero-referent zone deletion through the Inspector's own
		 * Delete button — so its own `ReversibleDeleteZoneCommand.execute()` can read a genuine
		 * snapshot before dispatching. `staleTriggerZoneSnapshot()`/`staleTriggerZonesPort()` are
		 * exactly the "fixture repository" the paragraph above names as the honest fix for a path
		 * that reaches one, scoped to the single zone the knob deletes
		 * (`STALE_TRIGGER_ZONE_ID`) rather than to every zone this page seeds.
		 */
		commands: {
			...unavailablePlanEditorCommands(),
			// The LOADED list, not the fixture: the real Inspector query reads the zone note, and a
			// refused one has none to read. `zoneInspectorAnswering` answers `ok(null)` for an id
			// it does not hold, which is what that read really does.
			zoneInspector: zoneInspectorAnswering(loaded),
			...(stale
				? {
						deleteZone: staleTriggerDeleteZoneCommand(),
						zones: staleTriggerZonesPort(staleTriggerZoneSnapshot()),
					}
				: {}),
		},
		// There is no vault behind this page, so nothing here could really open a note;
		// this stub answers 'opened' the way a real door would, and nothing on this page
		// calls it.
		openNote: () => Promise.resolve('opened' as const),
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		clipboard: createEditorClipboard(),
		panelLayout: memoryDeviceStorage(),
		// The page's own scheme toggle changes the body class, and the plugin's variables
		// resolve from it — so a "theme change" here is exactly what Obsidian's `css-change`
		// means, and the toggle drives it through this.
		onThemeChange: (listener) => {
			window.addEventListener('rp-harness-theme', listener);
			return () => window.removeEventListener('rp-harness-theme', listener);
		},
		// Nothing writes on the BARE page, so nothing ever changes a plan under it — nor a sibling.
		// True of this bundle alone: `referenceWorkspace` writes, and swaps BOTH plan doors for the
		// real sources over its own bus.
		onPlanChanged: () => () => undefined,
		onProjectPlansChanged: () => () => undefined,
		// The harness holds a fixed fixture and publishes no domain events, so all four change
		// doors are honestly inert here rather than merely unimplemented. **Measured rather than
		// assumed for the two price doors**: this page holds no `EventBus`, every WRITE in
		// `commands` refuses with `settings.unrecovered`, and nothing on it can set a price or
		// recalculate anything — so binding the real `createProjectPricesChangeSource` /
		// `createRequirementFiguresChangeSource` to a bus with no publisher would be
		// indistinguishable from these callbacks at every observable point, while importing
		// `application/events` into a page that cannot reach it. A door that cannot fire is
		// better spelled as one than dressed up as one that could.
		onCatalogueChanged: () => () => undefined,
		onProjectPricesChanged: () => () => undefined,
		onRequirementFiguresChanged: () => () => undefined,
		// Inert for the reason the doors above are: the browser harness has no Obsidian and
		// therefore no vault to raise a file event, and its background is a fixture rather than a
		// file. §55 is why this page refuses a background outright.
		onVaultFileChanged: () => () => undefined,
		// Inert for the reason the doors above are, one layer further out: the report is a
		// `plugin/` modal over a diagnostics ledger this page has no plugin to hold. The
		// `unreadable-zones` row's button still renders and still presses — which is the whole
		// point of `?unreadable=N` — it simply has nothing to open.
		openDiagnosticsReport: () => undefined,
	};
}

export interface MountedPlanEditor {
	leafEl: HTMLElement;
	view: PlanEditorView;
}

/**
 * The harness-only knobs `?view=plan-editor` takes beside itself, for a headless capture that
 * needs the Room Inspector, the Add menu, the room task already under way, the trust path's own
 * stale-projection warning, refused zone notes, a fresh detail plan, a locked zone, a zone with
 * detail plans, a three-level Property tree, or collapsed side panels, with nothing to click.
 *
 * **Stated as a rule rather than a count**, for the reason `page.ts`'s own knob paragraph
 * already paid for twice: this said "nine" and named nine while the interface below declared
 * twice that many, and the enumeration goes stale in the direction of a WEAKER claim. The
 * members below are the list **this interface carries**, and every one is optional — they are
 * not the list of knobs the page takes. Others are read straight out of `location.search` and
 * are declared nowhere — some by `mountPlanEditorHarness` itself, more by the workspaces it
 * composes — and they are deliberately not enumerated here: the last count written in this
 * paragraph said four and missed six one call deeper, which is the same stale-toward-weaker
 * failure the sentence above already names. `grep -rn "location.search" tests/harness/` is the
 * census; this paragraph is not, and nothing re-runs it.
 *
 * **They are NOT all independent, and the rule is about WHERE a knob is armed rather than about
 * which knobs they are.** `?stale` and `?unreadable` are armed inside the base dependency bundle
 * (`harnessDeps`); every other knob's layer is composed OVER that bundle by
 * `mountPlanEditorHarness`. A layer that REPLACES the query one of those two arms — rather than
 * wrapping it — answers its own value, so the knob's whole effect is gone, with no error
 * anywhere: the page comes up without the thing the URL asked for. Measured, both directions and
 * **over the seven layers composed over that bundle**: `?unreadable` arms `findZonesByPlan`,
 * which `?detail`, `?numericArea`/`?roomResize`/`?roomNaming`/`?outline` and `?reference` each
 * replace and `?locked`, `?detailed`, `?rooms` and `?tree` do not; `?stale` arms `getPlan`,
 * which of those same seven only `?reference` replaces. `unreadableKnob.test.ts` re-runs BOTH
 * partitions over all seven — it sees the layers that exist today and cannot see one added
 * later, so a NEW layer overriding either query has to be added to both its tables by hand.
 *
 * **`?downstream` is the exception to every sentence above and is re-run by neither table.** It
 * is not a layer over the base bundle at all: `downstreamWorkspace` builds its `queries` from a
 * real composition root and spreads its base's into nothing, so it replaces both queries and
 * discards both knobs. That one is read from the code — see `unreadableKnob.test.ts` for why it
 * is not constructible there.
 *
 * Two combinations that are fine and read as if they might not be: `?room`
 * needs no combining with `?add`: it opens the Add menu itself on its way through, so pairing
 * the two is redundant rather than contradictory. `?stale` is not independent of `?select` in
 * EFFECT, even though both are legal on their own: see `mountPlanEditorHarness` for why it
 * sequences the two rather than racing them. It is not the only such pair — `?outline`'s own
 * paragraph below carries another — and `mountPlanEditorHarness`'s composition is where they
 * are readable, since no list of them is kept here.
 */
export interface PlanEditorHarnessOptions {
	/** Real commands against ephemeral memory repositories, with an editable numeric outline. */
	readonly numericArea?: boolean;
	readonly roomResize?: boolean;
	readonly roomNaming?: boolean;
	/**
	 * `?outline` — BP-04's numeric outline editor, open on `?select`'s zone, for a capture of the
	 * chosen-corner list and of the corner it marks on the canvas. `?outline=<n>` goes one step
	 * further and CHOOSES corner `n` (1-based, the number the list itself shows), which is the
	 * only way a capture can show action 3's highlight at all: nothing is highlighted until a
	 * corner is chosen, and no gate in this repository can see a Konva fill or radius on screen.
	 *
	 * **Without `?select` this knob is discarded ENTIRELY, silently** — `mountPlanEditorHarness`
	 * pushes it only when both are present — while a bare `?outline` still swaps the whole deps
	 * bundle to `areaNumericWorkspace` and then opens nothing. This is the paragraph `page.ts`'s
	 * own `outline:` comment points at for that dependency; it did not carry it until now.
	 *
	 * **Opened PROGRAMMATICALLY, and that is a harness door rather than a UI one.** That action
	 * has no production reach yet (limitation L-24: nothing in the plugin's UI opens it; slice B
	 * is the reach and is blocked on owner copy), so unlike `?area` and `?room` this knob cannot
	 * drive the controls a user would — there are none. The CHOOSING half is different and is
	 * driven exactly as a user would, through the row's own button. A capture taken through it
	 * shows what the surface LOOKS like, and says nothing about anybody being able to get to it.
	 */
	readonly outline?: string;
	readonly reference?: boolean;
	/** A seeded zone's id (e.g. `harness-kitchen`) to select and frame once the editor is ready. */
	readonly select?: string;
	/** Opens the Add menu once the editor is ready. */
	readonly add?: boolean;
	/** M02 Area: activate through Add and place an unfinished outline. Writes still refuse in this visual fixture. */
	readonly area?: boolean;
	/**
	 * Enters the room task and types both sides, in WORLD MILLIMETRES — the unit every geometry
	 * in this plugin is stored in, turned into the metres the field takes by the same
	 * `formatMetres` the form itself writes there after a drag.
	 */
	readonly room?: { readonly widthMm: number; readonly depthMm: number };
	/**
	 * Drives the trust path's own stale-projection warning (design spec §2.3/§2.4) through a
	 * REAL write — see `harnessDeps`'s own `stale` parameter and `driveStaleKnobOnceReady` for
	 * the gesture. `?select`, if present, is applied only once that gesture has landed, so a
	 * capture's chosen zone is selected AFTER the write that stales the projection rather than
	 * raced against it.
	 */
	readonly stale?: boolean;
	/**
	 * `?unreadable=N` — the zone read answers N refused notes AND drops those N zones, which is
	 * the only way the `unreadable-zones` warning row and its **Show diagnostics report** button
	 * can be drawn at all. `unreadableKnob.ts` owns which zones those are and refuses an `N`
	 * above them rather than clamping.
	 */
	readonly unreadable?: number;
	/** A fresh detail plan: no zones, a parent-zone guide and one ancestor (`detailPlanKnob.ts`). */
	readonly detail?: boolean;
	/** Comma-separated seeded zone ids answered as locked (`detailPlanKnob.ts`). */
	readonly locked?: string;
	/** Comma-separated seeded zone ids, each given one detail plan (`detailPlanKnob.ts`). */
	readonly detailed?: string;
	/** How many synthetic rooms `roomsKnob.ts` appends after the seeded zones (`?rooms=N`). */
	readonly rooms?: number;
	/**
	 * A four-plan property (Site › House › { Ground floor, Attic }) so the Property tree draws
	 * three levels (`detailPlanKnob.ts`); in the constrained layout the Layers overlay holding
	 * the tree is opened too, since a hidden tree is nothing a capture can look at.
	 */
	readonly tree?: boolean;
	/** Presses the constrained rail's Details button, which is the only thing that puts the Inspector on screen at that width. */
	readonly details?: boolean;
	/** `collapsed`, `layers` or `inspector`: collapses those full-layout side panels once drawn. */
	readonly panels?: string;
	/** Over `reference` (whose `&item` seeds the items): draws an item or promotes a seeded one (`itemKnob.ts`). */
	readonly item?: ItemGesture;
}

/**
 * Drives the `?select=<zoneId>` knob: waits for the floor summary's room list to exist at all
 * — it renders only once the plan has hydrated — then clicks its stable `data-rp-id` row.
 * Matching identity lets the visible row include area metadata or a renamed label without
 * changing which record the knob selects.
 *
 * The click goes through `RoomSummaryList`'s own `@click="runtime.selectAndFrame(record.id)"`
 * — the real door a user's own click takes — rather than reaching into the runtime or the
 * Pinia store directly, which is what makes this knob prove the same gesture a screenshot
 * exists to show actually works.
 *
 * **The CONSTRAINED layout is why this is not two straight lines**, met here for the first
 * time this knob has been driven at a narrow width: `ResponsiveEditorShell` hides the whole
 * `inspector` slot — the room list lives inside it, through `EntityInspector`'s `FloorInspector`
 * — behind a drawer the rail's Details button opens (`overlay === 'inspector'`), the identical
 * shape `enterRoomTaskOnceReady` already opens for the New room form. So the wait is for the
 * row OR the rail, and the rail is pressed only when the row is not already on screen — a
 * SECOND selection (this file's own stale knob selects twice) finds the drawer already open
 * and presses nothing.
 *
 * Fire-and-forget, the same way `view.setState`/`view.onOpen` already are in the caller below:
 * the URL a headless capture opens cannot be awaited from here, so the click lands whenever
 * hydration and the shell's own layout measurement let the row exist.
 */
async function selectZoneOnceReady(root: HTMLElement, zoneId: string): Promise<void> {
	if (zoneId.includes(',')) {
		await selectMultipleOnceReady(root, zoneId.split(','));
		return;
	}
	await settleUntil(
		() => root.querySelector('.rp-room-list__row, [data-rp-rail="details"]') !== null,
		`the ?select knob's room list, or the rail that holds it, to render for "${zoneId}"`,
	);
	if (root.querySelector('.rp-room-list__row') === null) {
		root.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(
			() => root.querySelector('.rp-room-list__row') !== null,
			`the ?select knob's Inspector drawer to open on the room list, for "${zoneId}"`,
		);
	}

	// THROWS for a row it cannot find, copied from `selectMultipleOnceReady`'s own line rather
	// than invented here — `guardKnob` wraps both and `view.onClose` replays both, which
	// `knobRejectionIsolation.test.ts` proves for the multi-id path and this file's own
	// `?unreadable=2&select=harness-terrace` drive confirms for this one. `row?.click()` was a
	// silent no-op, and the zone prune is what made it reachable: a capture naming a refused zone
	// would otherwise photograph the UNSELECTED editor under a selected shot's name and exit 0.
	const row = [...root.querySelectorAll<HTMLButtonElement>('.rp-room-list__row')].find(
		(candidate) => candidate.dataset.rpId === zoneId,
	);
	if (row === undefined) throw new Error(`No selection row for ${zoneId}`);
	row.click();
}

/**
 * Drives the `?stale` knob: selects `STALE_TRIGGER_ZONE_ID`, clicks the Inspector's own Delete
 * button on it — a REAL zero-referent zone deletion, the one write this harness can complete
 * with no vault behind it — and waits for that write's own post-command read-back to land the
 * stale-projection warning (`harnessDeps`'s `getPlan` is what fails it, per its own docblock).
 * Only THEN does it select `finalSelect`, if one was asked for: selecting and deleting the
 * SAME zone the knob targets, and selecting the capture's own subject, are two different
 * gestures the selection store can only hold one of at a time, so racing them would leave
 * whichever click landed last in charge of what is actually selected on screen.
 *
 * Every step goes through the real controls a user's own click reaches — the room list's row,
 * the Inspector's Delete button — rather than dispatching a command directly, for the same
 * reason `selectZoneOnceReady` does: a picture assembled beside the route is a picture of a
 * state no user can reach.
 */
async function driveStaleKnobOnceReady(root: HTMLElement, finalSelect: string | undefined): Promise<void> {
	await selectZoneOnceReady(root, STALE_TRIGGER_ZONE_ID);

	const deleteButton = `.rp-room-inspector[data-rp-id="${STALE_TRIGGER_ZONE_ID}"] .rp-editor-inspector-delete`;
	await settleUntil(
		() => root.querySelector(deleteButton) !== null,
		"the ?stale knob's own sacrifice zone to show its Delete button",
	);
	root.querySelector<HTMLButtonElement>(deleteButton)?.click();

	await settleUntil(
		() => root.querySelector('[data-rp-warning="stale"] button') !== null,
		"the ?stale knob's own delete to land the stale-projection warning",
	);

	if (finalSelect !== undefined) await selectZoneOnceReady(root, finalSelect);
}

/**
 * Drives the `?add` knob: waits for the floating Add button to exist — it mounts only once the
 * plan is `ready`, inside `PlanCanvas` — and clicks it, through the same door a user's own
 * click takes (`FloatingPrimaryActions`'s `@click="emit('openAdd')"`).
 */
async function openAddMenuOnceReady(root: HTMLElement): Promise<void> {
	await settleUntil(
		() => root.querySelector('button[data-rp-action="add"]') !== null,
		"the ?add knob's Add button to render",
	);
	root.querySelector<HTMLButtonElement>('button[data-rp-action="add"]')?.click();
}

/**
 * Drives the `?tree` knob's one gesture: in the `constrained` layout the Property tree sits in
 * the Layers overlay, which `ResponsiveEditorShell` hides until the rail's Layers button is
 * pressed — the same shape `selectZoneOnceReady` meets on the Details side. The wait is for the
 * rail, which exists only in that layout; in `full` it never renders and the tree is already on
 * screen, so the wait yields to the tree's own third level instead and nothing is pressed.
 */
async function openLayersOnceReady(root: HTMLElement): Promise<void> {
	await settleUntil(
		() => root.querySelector('[role="tree"] [aria-level="3"], [data-rp-rail="layers"]') !== null,
		"the ?tree knob's three-level tree, or the rail that holds it, to render",
	);
	root.querySelector<HTMLButtonElement>('[data-rp-rail="layers"]')?.click();
}

/**
 * Drives the `?details` knob: the Details side of `openLayersOnceReady`. In `constrained` the
 * whole Inspector region is `v-show`n away until `overlay === 'inspector'`, so every control in
 * it is ATTACHED and `display: none`; in `full` the rail never renders and nothing is pressed.
 * `open()` on the rail calls `workspace.openOverlay`, which is not a toggle, so a second press
 * from another knob cannot shut what this one opened.
 *
 * **Its own knob rather than a step inside `selectZoneOnceReady`, and the reason is measured.**
 * That function's rail press is guarded by `querySelector('.rp-room-list__row') === null`, which
 * an attached-but-hidden row satisfies — so it never fires at 460, and its docblock's "the rail
 * is pressed only when the row is not already on screen" is true of ATTACHMENT rather than of
 * screen. Making it fire would open the drawer under `plan-editor-outline-narrow` and
 * `plan-editor-stale-narrow` as well, two captures whose subject is what sits behind the modal
 * and the warning strip.
 */
async function openDetailsOnceReady(root: HTMLElement): Promise<void> {
	await settleUntil(
		() => root.querySelector('.rp-editor-shell[data-layout="full"], [data-rp-rail="details"]') !== null,
		"the ?details knob's rail, or a layout with no rail to press",
	);
	root.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
}

/**
 * `?room=<widthMm>x<depthMm>` as the option `mountPlanEditorHarness` takes, or `undefined` when
 * the parameter is absent.
 *
 * **A present value that does not parse is REFUSED LOUDLY rather than dropped**, which is the
 * only decision in this function. Say what that buys narrowly, because the wider claim is
 * false: the two FIXED shots would fail either way, since each waits on an element only a
 * landed knob produces and a dropped value leaves it waiting until the deadline. What the
 * refusal changes is which failure arrives — `scripts/harness-shot.mjs` turns a page's
 * `console.error` into a named failed shot, so `?room=big` reports the value it could not read,
 * where a drop reports a selector that never appeared and leaves the reader to work backwards.
 * And `npm run harness`, the interactive door, has no selector to wait on at all: there a
 * dropped value is invisible, and the console line is the whole of the notice.
 *
 * Whole millimetres only, both sides required: this is a URL a person types, and `NaN x 3800`
 * is not a rectangle.
 */
export function parseRoomKnob(raw: string | null): { widthMm: number; depthMm: number } | undefined {
	if (raw === null) return undefined;
	const match = /^(\d+)x(\d+)$/.exec(raw);
	if (match === null) {
		console.error(`the ?room knob wants <widthMm>x<depthMm> in whole millimetres, e.g. 4200x3800; got "${raw}"`);
		return undefined;
	}
	return { widthMm: Number(match[1]), depthMm: Number(match[2]) };
}

/**
 * Types one side of the room and commits it the way the field itself is committed — writing
 * the value and dispatching `blur`, which is what `NewRoomInspector`'s own
 * `@blur="commit(...)"` listens for. Setting `input.value` alone changes nothing: the
 * component reads the event target at commit time, so a value with no `blur` behind it is a
 * string sitting in a DOM node no store has heard about.
 *
 * The cast states a guarantee the caller has already established rather than hiding a branch:
 * `enterRoomTaskOnceReady` waits for `.rp-new-room` before either call, and that form renders
 * both fields unconditionally, so a null arm here is one nothing could ever drive.
 */
function typeSide(root: HTMLElement, name: 'width' | 'depth', mm: number): void {
	const field = root.querySelector<HTMLInputElement>(`.rp-new-room input[name="${name}"]`) as HTMLInputElement;
	field.value = formatMetres(mm);
	field.dispatchEvent(new Event('blur'));
}

/**
 * Drives the `?room=<w>x<d>` knob: Add → the catalogue's Room item → both length fields, every
 * step a press or a commit on the real control rather than a write into `RoomDraftStore`. That
 * is the whole point of the knob — a picture assembled beside the route is a picture of a state
 * no user can reach, which is worse than no picture at all.
 *
 * `[data-rp-entry="room"]` rather than the label text `?select` has to match on: `AddMenu`
 * renders that attribute on every item, so there is an id in the DOM here and no
 * label-to-entry translation to get wrong. It is still that item's own `@click` that runs.
 *
 * **The CONSTRAINED layout is why this is not four straight lines.** At an Obsidian sidebar's
 * width the shell renders no inspector column at all — the same form lives in a drawer the
 * rail's Details button opens (`ResponsiveEditorShell`'s `overlay === 'inspector'` branch) — so
 * there is nothing to type into until that drawer is open. The knob presses the rail button
 * when the form is not already on screen, and presses the drawer's own close button afterwards:
 * the drawer is `position: absolute` at `min(17rem, 80%)`, so leaving it open would cover the
 * canvas and the banner, which are exactly what a narrow capture of this task exists to show.
 * Both presses are the user's own doors, and both are skipped at a width that needs neither.
 */
async function enterRoomTaskOnceReady(
	root: HTMLElement,
	room: { readonly widthMm: number; readonly depthMm: number },
): Promise<void> {
	await openAddMenuOnceReady(root);
	await settleUntil(
		() => root.querySelector('.rp-add-menu [data-rp-entry="room"]') !== null,
		"the ?room knob's Add menu to render its Room item",
	);
	root.querySelector<HTMLButtonElement>('.rp-add-menu [data-rp-entry="room"]')?.click();

	// The form, or — in `constrained` — the rail button that reveals it. ONE wait for either,
	// because which of the two appears is the layout's decision rather than this knob's, and a
	// wait on the form alone would time out at every width that keeps it in a drawer.
	await settleUntil(
		() => root.querySelector('.rp-new-room, [data-rp-rail="details"]') !== null,
		"the ?room knob's New room form, or the rail that holds it",
	);
	const inDrawer = root.querySelector('.rp-editor-shell')?.getAttribute('data-layout') === 'constrained';
	if (inDrawer) {
		root.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(
			() => root.querySelector('.rp-new-room') !== null,
			"the ?room knob's Inspector drawer to open on the New room form",
		);
	}

	typeSide(root, 'width', room.widthMm);
	typeSide(root, 'depth', room.depthMm);

	if (inDrawer) root.querySelector<HTMLButtonElement>('.rp-inspector-drawer__close')?.click();
}

async function enterAreaTaskOnceReady(root: HTMLElement): Promise<void> {
	await openAddMenuOnceReady(root);
	await settleUntil(() => root.querySelector('[data-rp-entry="area"]') !== null, 'the Area catalogue item');
	root.querySelector<HTMLButtonElement>('[data-rp-entry="area"]')?.click();
	await settleUntil(() => root.querySelector('.rp-task-banner__repeat') !== null, 'the Area task');
	const canvas = root.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	const box = canvas.getBoundingClientRect();
	// Lower half stays clear of the wrapped task banner, including German at 460 px.
	for (const [x, y] of [[0.2, 0.55], [0.7, 0.55], [0.7, 0.8], [0.2, 0.8]]) {
		for (const type of ['pointerdown', 'pointerup']) {
			canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0,
				buttons: type === 'pointerdown' ? 1 : 0, clientX: box.left + box.width * x, clientY: box.top + box.height * y }));
		}
	}
	canvas.focus();
}

/**
 * Drives `?outline`: waits for `?select`'s zone to actually be selected — the Inspector carrying
 * that id is the DOM's own answer to that, and the two knobs run concurrently — then opens the
 * numeric outline editor on it.
 *
 * **`void`, not `await`.** `editZoneOutline` is the edit lifecycle's `open`, which does not
 * resolve until the dialog CLOSES; awaiting it here would hang this knob for the whole capture
 * and then be reported against `view.onClose`. The dialog's own markup is what is waited on
 * instead, so a knob that reached nothing still fails as itself.
 */
async function openZoneOutlineOnceReady(view: PlanEditorView, root: HTMLElement, zoneId: string, corner: string): Promise<void> {
	await settleUntil(
		() => root.querySelector(`.rp-room-inspector[data-rp-id="${zoneId}"]`) !== null,
		`the ?outline knob's selected zone "${zoneId}"`,
	);
	void runtimeOfPluginView(view).zoneOutline.editZoneOutline(zoneId as ZoneId);
	await settleUntil(
		() => root.querySelector('[data-rp-form="outline-points"]') !== null,
		`the ?outline knob's numeric outline editor for "${zoneId}"`,
	);

	// `?outline` alone opens and stops; `?outline=<n>` chooses that corner. A number below 1 or
	// past the end clicks nothing and the wait below fails as this knob, which is the point:
	// clicking nothing and capturing anyway would photograph an unchosen list under a name
	// promising a chosen one.
	const chosen = Number.parseInt(corner, 10);
	if (Number.isNaN(chosen)) return;
	if (chosen > 0) root.querySelectorAll<HTMLButtonElement>('[data-rp-corner="choose"]')[chosen - 1]?.click();
	await settleUntil(
		() => root.querySelector('[data-rp-corner="choose"][aria-pressed="true"]') !== null,
		`the ?outline knob's chosen corner ${corner}`,
	);
}

/**
 * Wraps a knob's fire-and-forget promise so a rejection that lands after its caller has moved
 * on cannot escape as a process-level unhandled rejection naming no test.
 *
 * The `.then` below attaches a handler in the SAME microtask turn the knob starts — the part
 * that actually matters, since attaching one only LATER, after the promise has already
 * rejected with nothing listening, does not retroactively un-report it. The rejection is
 * captured rather than rethrown here, so the promise this function returns can never itself
 * become a second unhandled rejection: it always resolves, to a thunk that is a no-op on
 * success and rethrows the original error on failure. `mountPlanEditorHarness` collects one of
 * these per knob it starts and replays them from inside `view.onClose`.
 */
function guardKnob(promise: Promise<void>): Promise<() => void> {
	return promise.then(
		() => () => undefined,
		(error: unknown) => () => { throw error; },
	);
}

export function mountPlanEditorHarness(
	root: HTMLElement,
	options: PlanEditorHarnessOptions = {},
): MountedPlanEditor {
	// Obsidian's DOM prototype extensions and its global `createEl`. Installed first,
	// because the mount below uses them.
	installObsidianDom();
	root.empty();

	// The same real nesting `mountHarness` uses: `containerEl` is what the app hands a
	// view, and the leaf frame plus `tests/harness/theme.css` is what supplies the height
	// Obsidian's own pane would.
	const leafEl = root.createDiv('rp-harness-leaf');
	const base = harnessDeps({ stale: options.stale, unreadable: options.unreadable });
	const workspace = options.reference === true ? referenceWorkspace(base, HARNESS_PLAN, new URLSearchParams(location.search).has('planning')) : null;
	const downstream = workspace && new URLSearchParams(location.search).has('downstream') ? downstreamWorkspace(workspace, leafEl) : null;
	const deps = downstream?.deps ?? (workspace ? workspace.deps : (options.numericArea === true || options.roomResize === true || options.roomNaming === true || options.outline !== undefined) ? areaNumericWorkspace(base, HARNESS_PLAN, HARNESS_ZONES) : base);
	const detailed = options.detail === true ? detailPlanDeps(deps) : deps;
	const locked = options.locked === undefined ? detailed : lockedZoneDeps(detailed, options.locked.split(','));
	const detailedZones = options.detailed === undefined ? locked : detailedZoneDeps(locked, options.detailed.split(','));
	const withRooms = options.rooms === undefined ? detailedZones : roomsDeps(detailedZones, options.rooms);
	const composed = options.tree === true ? treePlanDeps(withRooms) : withRooms;
	const view = new PlanEditorView((downstream?.leaf ?? new FakeLeaf()) as never, composed);
	downstream?.attach(view);
	leafEl.appendChild(view.containerEl);
	if (workspace && new URLSearchParams(location.search).has('recovery')) Object.assign(window, { planningRecovery: planningRecoveryProbe(workspace, view) });
	if (workspace && new URLSearchParams(location.search).has('fidelity')) Object.assign(window, { editorFidelity: editorFidelityProbe(workspace) });

	// State first, then open — the restored-leaf order. `void` rather than awaited: the
	// page entry cannot await, and both do their work synchronously before resolving.
	const open = () => { void view.setState({ planId: HARNESS_PLAN.id }, {} as never); return view.onOpen(); };
	// The opt-in shared root must finish fixture seeding/index scan before any mounted read.
	if (downstream) void downstream.ready.then(open);
	else void open();

	// Every knob runs against `leafEl`, never `document`, so a jsdom case mounting more than
	// one editor in a suite cannot have one's knob reach into another's DOM.
	//
	// `?stale` and `?select` are SEQUENCED rather than raced: `driveStaleKnobOnceReady` selects
	// and deletes its own sacrifice zone before selecting `options.select`, so a capture asking
	// for both gets the projection staled first and its chosen zone selected second, rather than
	// whichever of two independent `selectZoneOnceReady` calls happened to click last.
	//
	// Each is still fire-and-forget for the reason `open` above is — a headless capture's URL
	// cannot await anything — but each is now wrapped by `guardKnob` rather than left bare
	// `void`, and collected, so a knob's late rejection can be replayed from `view.onClose`
	// below instead of escaping as an unhandled rejection naming no test.
	const knobs: Array<Promise<() => void>> = [];
	if (options.stale === true) {
		knobs.push(guardKnob(driveStaleKnobOnceReady(leafEl, options.select)));
	} else if (options.select !== undefined) {
		knobs.push(guardKnob(selectZoneOnceReady(leafEl, options.select)));
	}
	if (options.add === true) knobs.push(guardKnob(openAddMenuOnceReady(leafEl)));
	if (options.panels !== undefined) knobs.push(guardKnob(collapsePanelsOnceReady(leafEl, options.panels)));
	if (options.area === true) knobs.push(guardKnob(enterAreaTaskOnceReady(leafEl)));
	if (options.numericArea === true) knobs.push(guardKnob(enterNumericArea(leafEl)));
	if (options.room !== undefined) knobs.push(guardKnob(enterRoomTaskOnceReady(leafEl, options.room)));
	if (options.tree === true) knobs.push(guardKnob(openLayersOnceReady(leafEl)));
	if (options.details === true) knobs.push(guardKnob(openDetailsOnceReady(leafEl)));
	if (options.item !== undefined) knobs.push(guardKnob(driveItemKnob(leafEl, options.item)));
	if (options.outline !== undefined && options.select !== undefined) knobs.push(guardKnob(openZoneOutlineOnceReady(view, leafEl, options.select, options.outline)));

	// Every caller's teardown is `await view.onClose()` (`grep -rn "view.onClose()" tests/harness`
	// today prints 8 files), so wrapping it here surfaces a late knob failure as THAT case's own
	// failure — with no test file touched. Awaited BEFORE `unmount()`/`contentEl.empty()` so a
	// knob that is still legitimately catching up (the common case a `?select` capture relies
	// on) gets to finish against a live tree instead of being raced by teardown the way the M11
	// flake was; only a knob that is genuinely stuck pays its own `SETTLE_BUDGET_MS` there, and
	// it now does so as this case's own named failure rather than as a process-level rejection.
	const originalOnClose = view.onClose.bind(view);
	view.onClose = async () => {
		const replays = await Promise.all(knobs);
		try {
			return await originalOnClose();
		} finally {
			for (const replay of replays) replay();
		}
	};

	return { leafEl, view };
}

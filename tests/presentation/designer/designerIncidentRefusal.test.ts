/**
 * **The FIRST half of the Asset Designer's incident claim, which nothing checked until now.**
 *
 * `designerIncidentGate.test.ts` beside this file owns the SECOND half — *"and nothing on
 * screen says so first"* — by reading `writesBlocked()` off the real `EditorContext` through a
 * probe tool and recording that no registered designer tool ever asks for it. Its header's
 * sentence has two halves and they live in two files; each points at the other, because one
 * claim split across two files with no pointer is how the next reader resolves it wrongly.
 *
 * This file is the first half: **"Every write it dispatches is refused by the guarded doors
 * underneath."** What it holds, in two layers:
 *
 * - **The CATEGORY**, checked at the forbidden thing rather than by listing the places. The
 *   last-but-one describe iterates the guarded bundle ITSELF — every command member discovered
 *   from the object `guardAssetDesign` returns, never from a list typed into this file — and
 *   requires BOTH doors of each (`execute` and `executeWithVersion`) to answer
 *   `WRITES_PAUSED_CODE` while an incident is open. Nine commands, eighteen doors today, and a
 *   tenth command is driven the day it is composed with no edit here. The `get` QUERY is the
 *   one member excluded, deliberately ungated so ADR-0034 keeps the vault inspectable, and the
 *   exclusion is asserted BY NAME rather than filtered silently.
 * - **Two adapters end to end**, which the category loop cannot do: `setHeight` and `setAnchor`
 *   are dispatched through the designer's real `designEdits` chain and their PORT is read back,
 *   so a refusal raised after the write would fail. The loop reaches the guarded bundle
 *   directly and can only see the code, not the data safety.
 *
 * **`tests/plugin/guardCategory.test.ts` does NOT carry the whole-bundle claim and never did.**
 * Its `MAPPED_REFUSAL` is `'vault.unexpected-failure'` and it names `WRITES_PAUSED_CODE`
 * nowhere: it drives a THROW through every door the composition root hands out and requires the
 * mapped refusal back. That is the ERROR BOUNDARY on every door — a true and useful
 * neighbouring claim, and a different one from this file's WRITE GATE. Disable the gate and
 * that file stays green; the loop below goes red, which is how this sentence was checked.
 *
 * The UNDO half is not covered by the file's sentence at all — see the last describe, which
 * measures an inverse called DIRECTLY and finds it lands. Since BP-02's L-16 that is no longer
 * the whole story about undo on this surface, and the describe's own docblock says where the
 * rest of it lives.
 *
 * The designer has exactly ONE write door for this to be about:
 * `grep -rn "\.commands\." src/presentation/designer/` prints the single line
 * `runtime.ts:368`, `context.commands.designEdits({ noteLedger, geometryLedger })`.
 *
 * **The bundle here is the REAL `guardAssetDesign`**, composed over the shared harness's own
 * ports rather than through `assetDesignHarness.seeded`'s own bundle or `designerRig`'s. Both
 * of those build the design commands from RAW `new SetAsset…Command(...)` instances and never
 * call `guardAssetDesign`, so no other designer test in this repository can observe the gate at
 * all — the harness is kinder than production, and every case below would pass against a
 * designer with no gate underneath it if it were built the same way. The deps handed to
 * `guardAssetDesign` and the ports handed to `createAssetDesignerCommands` are spelled exactly
 * as `src/plugin/composition-root.ts` and `src/plugin/assetDesignerDeps.ts` spell them, down to
 * the whole guarded `assetDesign` object being passed as the bundle with its `get` still on it.
 *
 * **TWO adapters, because one does not stand for the other.** `setHeight` writes the asset's
 * NOTE through `AssetRepository`; `setAnchor` writes its geometry sidecar through
 * `AssetGeometrySidecar`. They are different adapter classes over different ports, and a gate
 * proven on one says nothing about the other.
 *
 * **What this file measures about UNDO, stated at the level it actually measures.**
 * `ReversibleAssetDesignCommands`' inverses do not dispatch a command at all — they write the
 * captured snapshot back through the RAW ports in their `ReversibleAssetDesignDeps`
 * (`sidecar.write(...)` and `assets.save(...)` in
 * `src/application/editor/asset/ReversibleAssetDesignCommands.ts`), and neither port passes
 * `guardCommand`. So an inverse CALLED DIRECTLY still lands with an incident open, and the two
 * `undo()` cases below assert exactly that, by name and by reading the port back.
 *
 * **That used to be the whole finding, under the sentence "the UNDO half is not gated", and
 * BP-02's L-16 changed what is true above it without changing one byte of what is true here.**
 * The gate went in at the DISPATCHER — `designer/runtime.ts`'s `designerDispatcher` composes
 * `withStaleGate` between `withSaveStateTracking` and `wrapDispatcher`, so `dispatcher.undo()`
 * and `dispatcher.redo()` are refused with `STALE_WRITE_REFUSED` while
 * `saveState.unrecoveredWrite` holds, and `canUndo`/`canRedo` disable the toolbar's two
 * controls on the same fact. `tests/presentation/designer/designerIncidentGate.test.ts`'s third
 * describe is that measurement, watched red against this same tree before the link went in.
 *
 * **So these two cases stayed GREEN through that change, and their staying green is the
 * finding rather than a hole in it.** A gate at the dispatcher cannot reach a caller that
 * bypasses the dispatcher, and the reason that is SAFE is a fact about production rather than
 * about this file: no production caller invokes an inverse. `grep -rn "\.undo("
 * src/presentation/designer/` prints five lines and no more — `registerDesignerTools.ts:197`
 * (the detail write) and `:257`/`:269` (the footprint and clearance traces), each of which hands
 * the inverse to `CommandHistory` inside an `UndoableCommand` rather than calling it, plus
 * `runtime.ts:521`'s `dispatcher.undo()` and `DesignerToolbar.vue:89`'s `runtime.undo()`, which
 * are the gated door and the button on it. The Plan Editor's `inspector-wiring.ts:57` has the
 * same wrapping shape and is NOT on this surface's list: `grep -rn "inspector-wiring" src/`
 * shows `editor/runtime.ts` as its only importer.
 *
 * What would make these two cases red is a gate moved DOWN to the ports — which is a different
 * increment with a different argument, and is not what L-16 did.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isErr, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import { WRITES_PAUSED_CODE } from '../../../src/application/errors/guardAgainstThrowing';
import type { VaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import { persistenceError } from '../../../src/application/errors';
import { installWriteIncidentRegistry } from '../../../src/application/incidents/WriteIncidentRegistry';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import type { VaultFileProbe } from '../../../src/application/ports/VaultFileProbe';
import type {
	AssetDesignCommandBundle,
	ReversibleAssetDesignCommands,
} from '../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import { guardAssetDesign, type GuardedAssetDesignServices } from '../../../src/plugin/guardedServices';
import { createAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { seeded, drawn, type AssetDesignHarness } from '../../helpers/assetDesignHarness';
import { recorder, resetRecorder } from '../../helpers/logger';
import { installOpenWriteIncident, installQuietWriteIncidents } from '../../helpers/writeIncidents';

/**
 * The boundary's own mapper, required by `guardCommand`'s signature the way production's is.
 * Nothing in this file throws, so no case reaches it — `planEditorIncident.test.ts` spells the
 * identical stand-in one surface over.
 */
const threw: VaultExceptionMapper = (cause) => ({
	...persistenceError('vault.threw', 'threw', cause),
	technicalFault: true,
});

/**
 * `SetAssetBackgroundCommand`'s file probe, refusing every path.
 *
 * `guardAssetDesign` requires one to build `setBackground`, the ninth member of the bundle it
 * returns. No case here reaches it: the two adapter cases dispatch other commands, and the
 * category loop's dispatch is refused by the gate before `SetAssetBackgroundCommand` runs. So
 * this fake is never asked a question while the suite is green. Stated rather than left
 * implicit, because a probe that answered `true` for everything would be KINDER than the real
 * thing — and NO case in this file could tell the difference, not even with the gate disabled.
 * Measured 2026-09-17, by recording every path the probe was asked about and disabling
 * `guardCommand`'s incident block: both `setBackground` doors answered `vault.threw` and the
 * probe recorded `asked: []`. The loop's input carries no `path`, so `backgroundKindOf(input.path)`
 * throws before the probe is consulted — a `vault.threw` is what a throw BEFORE the probe looks
 * like, not a probe refusal. The same run proved the probe is callable at all: a well-formed
 * `{ path: 'sheets/spec.png', kind: 'image', page: null }` reached it and answered
 * `asset.background-not-found`.
 */
const noSpecSheets: VaultFileProbe = { fileExists: () => false };

/** The height the harness seeds every asset with, so a case can assert a value that MOVED. */
const SEEDED_HEIGHT = 700;
const NEW_HEIGHT = 850;
/** Somewhere `drawn()`'s anchor (5, 5) is not, so a landed write is visible and a refused one is too. */
const NEW_ANCHOR = { x: 40, y: 60 };

/**
 * The harness's ports, the REAL guarded bundle over them, and the designer's own write door on
 * top — the whole chain `runtime.ts` builds, with nothing hand-wrapped.
 *
 * `seeded()` is called with no options, so its `sidecar` and `stack.assets` ARE the ports its
 * own internal commands would have used; composing over them changes which bundle the adapters
 * dispatch through and nothing else. The two ledgers are the harness's own, so the ledger rules
 * every other adapter case rests on are unchanged here.
 */
async function guardedDesigner(): Promise<{
	readonly harness: AssetDesignHarness;
	readonly edits: ReversibleAssetDesignCommands;
	/** The same guarded object, at its FULL type — both doors per command, plus the query. */
	readonly guarded: GuardedAssetDesignServices['assetDesign'];
}> {
	const harness = await seeded();
	await harness.seed(drawn());
	const ports = { sidecar: harness.sidecar, assets: harness.stack.assets, events: harness.events };
	// The whole guarded bundle, `get` and all, exactly as `assetDesignerDeps.ts` passes
	// `persistence.assetDesign` straight through as the command bundle.
	const guarded = guardAssetDesign(
		{ ...ports, locks: new ReferenceLocks() },
		noSpecSheets,
		recorder,
		threw,
	).assetDesign;
	const bundle: AssetDesignCommandBundle = guarded;
	const edits = createAssetDesignerCommands(ports, bundle).designEdits({
		noteLedger: harness.noteLedger,
		geometryLedger: harness.geometryLedger,
	});
	return { harness, edits, guarded };
}

/**
 * One guarded design command as the category case reaches it: BOTH doors, and OPAQUE about the
 * input each would validate.
 *
 * The nine members carry nine different input types, so a loop over them can only be typed at
 * the shape they share. That is sound here for the reason the case exists: `guardCommand`
 * refuses BEFORE the wrapped command is awaited, so the input never reaches any door's
 * validation while an incident is open.
 */
interface OpaqueDoorPair {
	execute(input: unknown): Promise<Result<unknown, AppError>>;
	executeWithVersion(input: unknown): Promise<Result<unknown, AppError>>;
}

/**
 * A member of the bundle before it has been sorted into command or query, with
 * `executeWithVersion` OPTIONAL — which is the compiler agreeing with the discovery below: `guardQuery` really does
 * hand out an object that has no such door, and the whole bundle only types as this.
 */
type OpaqueMember = Partial<OpaqueDoorPair> & Pick<OpaqueDoorPair, 'execute'>;

/** What a door answered, as one comparable string, so a red prints every door's own verdict. */
function verdict(answer: Result<unknown, AppError>): string {
	return isErr(answer) ? answer.error.code : 'RESOLVED OK — the door was not refused';
}

describe('the asset designer dispatching through the REAL guarded design bundle', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
		resetRecorder();
	});

	describe('the NOTE door — setHeight, through AssetRepository', () => {
		it('lands the write while the vault holds no open incident', async () => {
			installQuietWriteIncidents();
			const { harness, edits } = await guardedDesigner();

			const ran = await edits.setHeight({ assetId: harness.assetId, height: NEW_HEIGHT }).execute();

			expect(ran).toEqual({ ok: true, value: 'wrote' });
			expect(await harness.height()).toBe(NEW_HEIGHT);
		});

		it('refuses with the writes-paused code and leaves the note untouched while an incident is open', async () => {
			await installOpenWriteIncident();
			const { harness, edits } = await guardedDesigner();

			const ran = await edits.setHeight({ assetId: harness.assetId, height: NEW_HEIGHT }).execute();

			expect(isErr(ran)).toBe(true);
			if (!isErr(ran)) throw new Error('the guarded height door let the write through');
			expect(ran.error.code).toBe(WRITES_PAUSED_CODE);
			// The data-safety half. A refusal raised AFTER the write would satisfy the code
			// assertion above and fail this one.
			expect(await harness.height()).toBe(SEEDED_HEIGHT);
		});
	});

	describe('the GEOMETRY door — setAnchor, through AssetGeometrySidecar', () => {
		it('lands the write while the vault holds no open incident', async () => {
			installQuietWriteIncidents();
			const { harness, edits } = await guardedDesigner();

			const ran = await edits.setAnchor({ assetId: harness.assetId, anchor: NEW_ANCHOR }).execute();

			expect(ran).toEqual({ ok: true, value: 'wrote' });
			expect((await harness.document()).shape?.anchor).toEqual(NEW_ANCHOR);
		});

		it('refuses with the writes-paused code and leaves the sidecar untouched while an incident is open', async () => {
			await installOpenWriteIncident();
			const { harness, edits } = await guardedDesigner();
			const before = await harness.geometryVersion();

			const ran = await edits.setAnchor({ assetId: harness.assetId, anchor: NEW_ANCHOR }).execute();

			expect(isErr(ran)).toBe(true);
			if (!isErr(ran)) throw new Error('the guarded anchor door let the write through');
			expect(ran.error.code).toBe(WRITES_PAUSED_CODE);
			expect((await harness.document()).shape?.anchor).toEqual(drawn().anchor);
			// The version too: a write that replaced the document with identical bytes would
			// still move this, and the anchor assertion alone could not see it. `toEqual`
			// rather than `toBe` because an `EntityVersion` is an OBJECT — each read mints a
			// fresh one, so identity here compares readers rather than revisions.
			expect(await harness.geometryVersion()).toEqual(before);
		});
	});

	/**
	 * **The CATEGORY, checked at the forbidden thing rather than by listing the places.** The
	 * forbidden thing is a door `guardAssetDesign` hands out that answers anything other than
	 * `WRITES_PAUSED_CODE` while an incident is open, so the case drives the bundle ITSELF —
	 * every member discovered from the returned object, never from a list typed here. A tenth
	 * design command is driven the day it is composed, with no edit to this file.
	 */
	describe('the CATEGORY — every command door the guarded bundle hands out', () => {
		it('refuses every door of every command member with the writes-paused code', async () => {
			await installOpenWriteIncident();
			const { harness, guarded } = await guardedDesigner();
			const members: Record<string, OpaqueMember> = guarded;

			// Discovered by SHAPE, not by name: `guardBothDoors` gives a command both doors and
			// `guardQuery` gives the query only `execute`.
			const commands = Object.entries(members).filter(
				(entry): entry is [string, OpaqueDoorPair] => typeof entry[1].executeWithVersion === 'function',
			);
			const driven = new Set(commands.map(([name]) => name));
			const excluded = Object.keys(members).filter((name) => !driven.has(name));
			// Asserted by NAME rather than filtered silently: `get` is deliberately ungated
			// (ADR-0034 keeps the vault inspectable), and a COMMAND that quietly fell out of this
			// filter would make the loop certify the gap it exists to close.
			expect(excluded).toEqual(['get']);
			// Found-something-at-all. `AssetDesignCommandBundle` declares nine commands today;
			// a door that vanished from the composed object drops this below nine and goes red,
			// while a tenth door simply joins the loop.
			expect(commands.length).toBeGreaterThanOrEqual(9);

			const answers: Record<string, string> = {};
			for (const [name, door] of commands) {
				// The input is deliberately the same for all nine and deliberately incomplete for
				// most: the gate refuses before any door's validation runs, so no door here is
				// ever asked whether it likes its argument.
				//
				// **Watched red, 2026-09-17**, by disabling `guardCommand`'s incident block in
				// `src/application/errors/guardAgainstThrowing.ts`. All eighteen doors then
				// answered something ELSE, identically at both doors of each command:
				// `vault.threw` (setAnchor, setBackground, setClearance, setFootprint, setShape —
				// the mapper reached, because an absent field threw past the command),
				// `asset.invalid-facing` (setFacing), `asset.invalid-footprint`
				// (setFootprintFromDimensions), `calibration.invalid-distance` (calibrate), and a
				// RESOLVED OK for setHeight, which accepted the input and wrote. That spread is
				// the evidence the loop reaches nine real commands rather than a stub: a stub
				// could not produce five different verdicts.
				answers[`${name}.execute`] = verdict(await door.execute({ assetId: harness.assetId }));
				answers[`${name}.executeWithVersion`] = verdict(
					await door.executeWithVersion({ assetId: harness.assetId }),
				);
			}

			expect(Object.keys(answers)).toHaveLength(commands.length * 2);
			// One assertion over the whole map rather than one per door, so a red prints WHICH
			// door answered WHAT rather than stopping at the first.
			expect(answers).toEqual(
				Object.fromEntries(Object.keys(answers).map((door) => [door, WRITES_PAUSED_CODE])),
			);
		});
	});

	/**
	 * **An inverse called DIRECTLY still reaches the raw ports, and nothing below the dispatcher
	 * refuses it.** The inverses write through `assets.save` / `sidecar.write` in
	 * `ReversibleAssetDesignDeps`, and neither passes `guardCommand`. Both cases below call
	 * `gesture.undo()` themselves — no `CommandHistory`, no dispatcher — and assert the value the
	 * port really holds afterwards.
	 *
	 * **What refuses an undo in production is the DISPATCHER**, since BP-02's L-16:
	 * `designerDispatcher`'s `withStaleGate` link, measured in `designerIncidentGate.test.ts`.
	 * These two cases are a seam below that gate on purpose — the header says which production
	 * callers make that seam safe, and none of them is a direct call.
	 */
	describe('the UNDO half — an inverse called DIRECTLY, below the dispatcher that now refuses it', () => {
		it('lands the note restore when the inverse is called directly, which no production caller does', async () => {
			installQuietWriteIncidents();
			const { harness, edits } = await guardedDesigner();
			const gesture = edits.setHeight({ assetId: harness.assetId, height: NEW_HEIGHT });
			expect(await gesture.execute()).toEqual({ ok: true, value: 'wrote' });

			await installOpenWriteIncident();
			const undone = await gesture.undo();

			expect(undone).toEqual({ ok: true, value: 'wrote' });
			expect(await harness.height()).toBe(SEEDED_HEIGHT);
		});

		it('lands the sidecar restore when the inverse is called directly, which no production caller does', async () => {
			installQuietWriteIncidents();
			const { harness, edits } = await guardedDesigner();
			const gesture = edits.setAnchor({ assetId: harness.assetId, anchor: NEW_ANCHOR });
			expect(await gesture.execute()).toEqual({ ok: true, value: 'wrote' });

			await installOpenWriteIncident();
			const undone = await gesture.undo();

			expect(undone).toEqual({ ok: true, value: 'wrote' });
			expect((await harness.document()).shape?.anchor).toEqual(drawn().anchor);
		});
	});
});

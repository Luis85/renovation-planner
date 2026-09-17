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
 * underneath."** **It checks LESS than that sentence, and the narrowing is written here rather
 * than left for a reader to discover.** What it actually holds is: *two* of the nine doors
 * `guardAssetDesign` composes — `setHeight` and `setAnchor` — refuse a FORWARD dispatch with
 * `WRITES_PAUSED_CODE` and leave their port unwritten while an incident is open. The other
 * seven doors are composed through the same `guardBothDoors` call in the same function and are
 * not driven here; the whole-bundle claim is `tests/plugin/guardCategory.test.ts`'s, which
 * drives every door of everything the composition root hands out. And the UNDO half is not
 * covered by the sentence at all — see the last describe, which measures it going the other
 * way.
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
 * **The measured gap this file records: the UNDO half is not gated.**
 * `ReversibleAssetDesignCommands`' inverses do not dispatch a command at all — they write the
 * captured snapshot back through the RAW ports in their `ReversibleAssetDesignDeps`
 * (`sidecar.write(...)` and `assets.save(...)` in
 * `src/application/editor/asset/ReversibleAssetDesignCommands.ts`), and neither port passes
 * `guardCommand`. So an incident opened between a forward write and its undo does not stop the
 * undo from landing. The two `undo()` cases below assert exactly that, by name and by reading
 * the port back. They are written to what the instrument printed, not to what would be
 * desirable; if the undo is ever brought inside the gate, they go red and say so.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isErr } from '../../../src/core/result/Result';
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
import { guardAssetDesign } from '../../../src/plugin/guardedServices';
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
 * `guardAssetDesign` requires one to build its eighth door and no case here dispatches
 * `setBackground`, so this fake is never asked a question. Stated rather than left implicit,
 * because a probe that answered `true` for everything would be KINDER than the real thing and
 * would be reached the moment somebody adds a background case to this file.
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
}> {
	const harness = await seeded();
	await harness.seed(drawn());
	const ports = { sidecar: harness.sidecar, assets: harness.stack.assets, events: harness.events };
	// The whole guarded bundle, `get` and all, exactly as `assetDesignerDeps.ts` passes
	// `persistence.assetDesign` straight through as the command bundle.
	const bundle: AssetDesignCommandBundle = guardAssetDesign(
		{ ...ports, locks: new ReferenceLocks() },
		noSpecSheets,
		recorder,
		threw,
	).assetDesign;
	const edits = createAssetDesignerCommands(ports, bundle).designEdits({
		noteLedger: harness.noteLedger,
		geometryLedger: harness.geometryLedger,
	});
	return { harness, edits };
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
	 * **The gap, measured.** An incident opened between a gesture and its undo does NOT stop the
	 * undo: the inverses write through the raw `assets.save` / `sidecar.write` ports in
	 * `ReversibleAssetDesignDeps`, and neither passes `guardCommand`. Both cases below name the
	 * outcome in the case name and assert the value the port really holds afterwards.
	 */
	describe('the UNDO half, which reaches the ports directly and is NOT behind the gate', () => {
		it('lands the note restore anyway when an incident opens between the write and the undo', async () => {
			installQuietWriteIncidents();
			const { harness, edits } = await guardedDesigner();
			const gesture = edits.setHeight({ assetId: harness.assetId, height: NEW_HEIGHT });
			expect(await gesture.execute()).toEqual({ ok: true, value: 'wrote' });

			await installOpenWriteIncident();
			const undone = await gesture.undo();

			expect(undone).toEqual({ ok: true, value: 'wrote' });
			expect(await harness.height()).toBe(SEEDED_HEIGHT);
		});

		it('lands the sidecar restore anyway when an incident opens between the write and the undo', async () => {
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err } from '../../src/core/result/Result';
import type { AppError } from '../../src/core/errors/AppError';
import { leftWritesBehind, type AffectedEntity, type DispatchResult, type UncompensatedWrite } from '../../src/application/commands/DispatchOutcome';
import { installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import type { AssetRepository } from '../../src/application/ports/AssetRepository';
import { CommandHistory } from '../../src/presentation/editor/tools/command-history';
import { useSaveStateStore } from '../../src/presentation/editor/save-state/save-state-store';
import { withSaveStateTracking } from '../../src/presentation/editor/save-state/with-save-state-tracking';
import { createAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import { guardAssetDesign, VAULT_EXCEPTION_MAPPER } from '../../src/plugin/guardedServices';
import { seeded, drawn } from '../helpers/assetDesignHarness';
import { expectDefined, expectOk, injectedPersistenceError } from '../helpers/domain';
import { recorder } from '../helpers/logger';
import { installQuietWriteIncidents } from '../helpers/writeIncidents';

/**
 * Q1's deciding measurement for the Asset designer's undo, kept as the pin a fix has to keep
 * (`docs/releases/first-beta-readiness/11-q1-stamp-census.md`), and — since owner ruling 13's
 * first step — the pin that #17 no longer marks a coherent vault as half-written.
 *
 * `ReversibleAssetBackgroundEdit.undo` writes its snapshot back through the RAW ports, so its
 * stamp reaches no recorder. The ordinary door on a healthy vault raises none, with or without a
 * calibration to restore. A peer write landing inside the undo's read-to-write window — driven
 * right after the note restore, where the census found the stamp — now raises none either: the
 * undo puts the note back, refuses cleanly and leaves the vault as the undo found it plus the
 * peer's write. The positive control shows the same rig still sees the stamp when the sidecar
 * restore AND the note compensation are both refused and the undo's half is really left behind —
 * the restored background over a calibration the undo did not restore; two refusals over a vault
 * holding nothing of the undo raise none (the last two describes). Deliberately NOT asserted: that the stamp
 * stays unrecorded — true today, and exactly what ruling 13's second step changes.
 */

/** Every dispatch of the five wrote, none was refused, and nothing opened an incident. */
const HEALTHY = { refusals: [], outcomes: ['wrote', 'wrote', 'wrote', 'wrote', 'wrote'], recorded: false };

afterEach(() => {
	vi.restoreAllMocks();
	installWriteIncidentRegistry(null);
});

/** The designer's chain as `runtime.ts` composes it: raw ports for the inverse, the REAL guarded bundle for the forward door, and the leaf's save-state tracking. */
async function designerRig(calibrated: boolean) {
	const registry = installQuietWriteIncidents();
	setActivePinia(createPinia());
	const saveState = useSaveStateStore();
	const harness = await seeded();
	await harness.seed(drawn());
	if (calibrated) await harness.seedCalibration();
	const ports = { sidecar: harness.sidecar, assets: harness.stack.assets, events: harness.events };
	const guarded = guardAssetDesign({ ...ports, locks: new ReferenceLocks() }, { fileExists: () => true }, recorder, VAULT_EXCEPTION_MAPPER).assetDesign;
	/** One designer leaf: its own ledgers and its own history, as `runtime.ts` builds per leaf. */
	const leaf = () => ({
		edits: createAssetDesignerCommands(ports, guarded).designEdits({ noteLedger: new SessionWriteLedger(), geometryLedger: new SessionWriteLedger() }),
		history: new CommandHistory(),
	});
	const { edits, history: raw } = leaf();
	const history = withSaveStateTracking(raw, saveState);
	const seen: { step: string; code: string; stamped: boolean; named?: readonly AffectedEntity[] }[] = [];
	const outcomes: string[] = [];
	/** One dispatch through the history, recording any refusal, whether it carried the stamp, and what the stamp named. */
	async function dispatch(step: string, result: Promise<DispatchResult>): Promise<void> {
		const settled = await result;
		outcomes.push(settled.ok ? settled.value : 'refused');
		if (settled.ok) return;
		const stamped = leftWritesBehind(settled.error);
		seen.push({ step, code: settled.error.code, stamped, ...(stamped ? { named: (settled.error as AppError & UncompensatedWrite).uncompensatedWrite } : {}) });
	}
	const setBackground = () => edits.setBackground({ assetId: harness.assetId, path: 'Specs/other.png', kind: 'image', page: null });
	/** The asset's note entity and sidecar document as the vault holds them now. */
	async function state() {
		const note = expectOk(await harness.stack.assets.getById(harness.assetId));
		const sidecar = await harness.sidecar.read(harness.assetId);
		return { note: note === null ? ('absent' as const) : note.entity, sidecar: sidecar.ok ? sidecar.value.document : sidecar.error.code };
	}
	/** Runs `peer` the moment the note save that follows it has landed — the undo's note restore, inside its read-to-write window. */
	function afterNextNoteSave(peer: () => Promise<void>): void {
		const assets: AssetRepository = harness.stack.assets;
		const save = assets.save.bind(assets);
		let fired = false;
		vi.spyOn(assets, 'save').mockImplementation(async (asset, expected) => {
			const saved = await save(asset, expected);
			if (!fired && saved.ok) {
				fired = true;
				await peer();
			}
			return saved;
		});
	}
	/** Runs `peer` the moment the next sidecar write is REFUSED — the undo's restore, before its note put-back. */
	function afterSidecarRefusal(peer: () => Promise<void>): void {
		const write = harness.sidecar.write.bind(harness.sidecar);
		let fired = false;
		vi.spyOn(harness.sidecar, 'write').mockImplementation(async (assetId, document, expected) => {
			const written = await write(assetId, document, expected);
			if (!fired && !written.ok) {
				fired = true;
				await peer();
			}
			return written;
		});
	}
	return { registry, saveState, harness, guarded, leaf, raw, history, seen, outcomes, dispatch, setBackground, state, afterNextNoteSave, afterSidecarRefusal };
}

type Rig = Awaited<ReturnType<typeof designerRig>>;

describe('ReversibleAssetBackgroundEdit.undo — the Asset designer undo', () => {
	for (const calibrated of [false, true]) {
		it(`run, undo, redo, undo, redo on a healthy vault raises no stamp and records nothing (calibrated: ${String(calibrated)})`, async () => {
			const r = await designerRig(calibrated);
			await r.dispatch('run', r.history.run(r.setBackground()));
			await r.dispatch('undo', r.history.undo());
			await r.dispatch('redo', r.history.redo());
			await r.dispatch('undo again', r.history.undo());
			await r.dispatch('redo again', r.history.redo());
			expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
		});
	}

	// POSITIVE CONTROL. #17 used to stamp on ONE refused write (the sidecar restore after the note
	// restore landed); since ruling 13's first step the undo compensates the note restore, so the
	// stamp needs TWO refusals — the sidecar restore and that compensation — AND a vault that still
	// holds the undo's half: the note naming the restored background over a calibration the undo
	// did not restore. Its cause is the sidecar restore's own error (`putNoteBack`'s `cause`), which
	// is why the compensation is refused with a DISTINCT code here; it is what pauses this leaf's Undo.
	it('POSITIVE CONTROL: the sidecar restore AND the note compensation refused DOES raise the stamp, carrying the cause', async () => {
		const r = await designerRig(true);
		await r.dispatch('run', r.history.run(r.setBackground()));
		vi.spyOn(r.harness.sidecar, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		const assets: AssetRepository = r.harness.stack.assets;
		const save = assets.save.bind(assets);
		vi.spyOn(assets, 'save')
			.mockImplementationOnce((asset, expected) => save(asset, expected))
			.mockResolvedValueOnce(err({ ...injectedPersistenceError(), code: 'test.injected-put-back' }));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: true, named: [{ entityKind: 'asset', entityId: r.harness.assetId }] }]);
		expect(r.saveState.unrecoveredWrite).toBe(true);
		// The gesture's own announcement, then the stamped undo's: its note restore stands, so every leaf has to redraw.
		expect(r.harness.designChanges).toHaveLength(2);
	});
});

/**
 * The peers the S21 review drove against #17 (`s21-q1-review.md` Q2), plus the Asset library's
 * own footprint door, which that review established only by reading. Each lands right after the
 * undo's note restore — inside the window the census measured.
 *
 * Each case compares the WHOLE note entity and the WHOLE sidecar document afterwards against what
 * the vault held after the gesture ran (the note) and what the peer left (the sidecar): the undo
 * refused, and nothing of it is left behind. And the leaf stays usable: `unrecoveredWrite` is the
 * fact `runtime.ts`'s `canUndo`/`canRedo` disable Undo and Redo on.
 */
describe('#17 — a peer write inside the undo\'s read-to-write window leaves no stamp', () => {
	const PEERS: readonly { name: string; code: string; write: (r: Rig) => Promise<void> }[] = [
		{
			name: 'a second designer leaf of the same asset, through its own history',
			code: 'asset-geometry.revision-conflict',
			write: async (r) => {
				const peer = r.leaf();
				expect(expectOk(await peer.history.run(peer.edits.setFacing({ assetId: r.harness.assetId, facing: 1.2 })))).toBe('wrote');
			},
		},
		{
			name: 'the Asset library\'s setAssetFootprintFromDimensions',
			code: 'asset-geometry.revision-conflict',
			write: async (r) => {
				expectOk(await r.guarded.setFootprintFromDimensions.execute({ assetId: r.harness.assetId, width: 1200, depth: 800 }));
			},
		},
		{
			name: 'a byte-only rewrite of the .rpgeo (semantically identical JSON)',
			code: 'asset-geometry.external-modification',
			write: (r) => {
				const { entries } = r.harness.stack.vault;
				const path = expectDefined([...entries.keys()].find((key) => key.endsWith('.rpgeo')), 'the sidecar');
				entries.set(path, JSON.stringify(JSON.parse(expectDefined(entries.get(path), 'the sidecar text')), null, 4));
				return Promise.resolve();
			},
		},
	];

	for (const calibrated of [false, true]) {
		for (const peer of PEERS) {
			it(`${peer.name}: the undo refuses cleanly and the vault is the gesture's plus the peer's (calibrated: ${String(calibrated)})`, async () => {
				const r = await designerRig(calibrated);
				await r.dispatch('run', r.history.run(r.setBackground()));
				const afterRun = await r.state();
				let afterPeer: unknown = null;
				r.afterNextNoteSave(async () => {
					await peer.write(r);
					afterPeer = (await r.state()).sidecar;
				});
				await r.dispatch('undo', r.history.undo());
				expect({ seen: r.seen, state: await r.state() }).toEqual({
					seen: [{ step: 'undo', code: peer.code, stamped: false }],
					state: { note: afterRun.note, sidecar: afterPeer },
				});
				expect({ unrecovered: r.saveState.unrecoveredWrite, canUndo: r.raw.canUndo }).toEqual({ unrecovered: false, canUndo: true });
			});
		}

		it(`the asset deleted inside the window: the undo refuses cleanly and the asset stays gone (calibrated: ${String(calibrated)})`, async () => {
			const r = await designerRig(calibrated);
			await r.dispatch('run', r.history.run(r.setBackground()));
			r.afterNextNoteSave(async () => {
				const note = expectDefined(expectOk(await r.harness.stack.assets.getById(r.harness.assetId)), 'the restored note');
				expectOk(await r.harness.stack.assets.delete(r.harness.assetId, note.version));
			});
			await r.dispatch('undo', r.history.undo());
			expect({ seen: r.seen, note: (await r.state()).note }).toEqual({
				seen: [{ step: 'undo', code: 'asset-geometry.revision-conflict', stamped: false }],
				note: 'absent',
			});
			expect(r.saveState.unrecoveredWrite).toBe(false);
		});
	}
});

/**
 * The put-back's LOST-UPDATE guard (S21 #17 review, I2). `putNoteBack` conditions its save on the
 * version the note restore produced, so a peer's note write landing between the refused sidecar
 * restore and the put-back refuses the put-back instead of being overwritten by it. Two peers of a
 * second designer leaf drive it: `setFacing` inside the undo's window (the sidecar refusal), then
 * `setHeight` (a note field the undo never touched) before the put-back.
 *
 * Both refusals are real, and the stamp follows the VAULT rather than the count (review I1, Q2a):
 * the note names the restored background either way, so the uncalibrated asset is coherent and
 * unstamped, and the calibrated one has lost the calibration the undo was restoring — stamped.
 */
describe('#17 — a note peer between the refused sidecar restore and the put-back', () => {
	for (const calibrated of [false, true]) {
		it(`keeps the peer's note edit, and stamps only when the calibration is lost (calibrated: ${String(calibrated)})`, async () => {
			const r = await designerRig(calibrated);
			await r.dispatch('run', r.history.run(r.setBackground()));
			const peer = r.leaf();
			r.afterNextNoteSave(async () => {
				expect(expectOk(await peer.history.run(peer.edits.setFacing({ assetId: r.harness.assetId, facing: 1.2 })))).toBe('wrote');
			});
			r.afterSidecarRefusal(async () => {
				expect(expectOk(await peer.history.run(peer.edits.setHeight({ assetId: r.harness.assetId, height: 900 })))).toBe('wrote');
			});
			await r.dispatch('undo', r.history.undo());
			const { note, sidecar } = await r.state();
			expect(note === 'absent' ? note : { background: note.background, height: note.height }).toEqual({ background: null, height: 900 });
			expect(typeof sidecar === 'string' ? sidecar : sidecar.calibration).toBeNull();
			const named = [{ entityKind: 'asset', entityId: r.harness.assetId }];
			expect(r.seen).toEqual([{ step: 'undo', code: 'asset-geometry.revision-conflict', stamped: calibrated, ...(calibrated ? { named } : {}) }]);
			expect(r.saveState.unrecoveredWrite).toBe(calibrated);
		});
	}
});

/**
 * ONE peer gesture that writes BOTH files inside the undo's window (review I1, Q2b): a second
 * leaf's `setBackground` clears the sidecar and saves the note after the undo's note restore. The
 * sidecar restore and the put-back are both refused, and the vault is exactly the peer's completed
 * gesture — nothing of the undo is left in either file, so nothing is stamped.
 */
describe("#17 — a peer background gesture inside the undo's window", () => {
	for (const calibrated of [false, true]) {
		it(`leaves the peer's gesture standing and raises no stamp (calibrated: ${String(calibrated)})`, async () => {
			const r = await designerRig(calibrated);
			await r.dispatch('run', r.history.run(r.setBackground()));
			const peer = r.leaf();
			r.afterNextNoteSave(async () => {
				const path = 'Specs/a.png';
				expect(expectOk(await peer.history.run(peer.edits.setBackground({ assetId: r.harness.assetId, path, kind: 'image', page: null })))).toBe('wrote');
			});
			await r.dispatch('undo', r.history.undo());
			const { note, sidecar } = await r.state();
			expect({
				background: note === 'absent' ? note : note.background,
				calibration: typeof sidecar === 'string' ? sidecar : sidecar.calibration,
			}).toEqual({ background: { path: 'Specs/a.png', kind: 'image', page: null }, calibration: null });
			expect({ seen: r.seen, unrecovered: r.saveState.unrecoveredWrite }).toEqual({
				seen: [{ step: 'undo', code: 'asset-geometry.revision-conflict', stamped: false }],
				unrecovered: false,
			});
		});
	}
});

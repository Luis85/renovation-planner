import { afterEach, describe, expect, it, vi } from 'vitest';
import { err } from '../../src/core/result/Result';
import type { AppError } from '../../src/core/errors/AppError';
import { leftWritesBehind, type AffectedEntity, type DispatchResult, type UncompensatedWrite } from '../../src/application/commands/DispatchOutcome';
import { installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { CommandHistory } from '../../src/presentation/editor/tools/command-history';
import { createAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import { guardAssetDesign, VAULT_EXCEPTION_MAPPER } from '../../src/plugin/guardedServices';
import { seeded, drawn } from '../helpers/assetDesignHarness';
import { injectedPersistenceError } from '../helpers/domain';
import { recorder } from '../helpers/logger';
import { installQuietWriteIncidents } from '../helpers/writeIncidents';

/**
 * Q1's deciding measurement for the Asset designer's undo, kept as the pin a fix has to keep
 * (`docs/releases/first-beta-readiness/11-q1-stamp-census.md`).
 *
 * `ReversibleAssetBackgroundEdit.undo` writes its snapshot back through the RAW ports, so its
 * stamp reaches no recorder. The ordinary door on a healthy vault raises none, with or without a
 * calibration to restore; the positive control shows the same rig sees the stamp when the sidecar
 * restore is refused after the note restore landed. Deliberately NOT asserted: that the stamp
 * stays unrecorded, and that a peer write inside the undo's read-to-write window raises it — both
 * true today, both exactly what the owner's choice may change, and both measured in the census.
 */

/** Every dispatch of the five wrote, none was refused, and nothing opened an incident. */
const HEALTHY = { refusals: [], outcomes: ['wrote', 'wrote', 'wrote', 'wrote', 'wrote'], recorded: false };

afterEach(() => {
	vi.restoreAllMocks();
	installWriteIncidentRegistry(null);
});

/** The designer's chain as `runtime.ts` composes it: raw ports for the inverse, the REAL guarded bundle for the forward door. */
async function designerRig(calibrated: boolean) {
	const registry = installQuietWriteIncidents();
	const harness = await seeded();
	await harness.seed(drawn());
	if (calibrated) await harness.seedCalibration();
	const ports = { sidecar: harness.sidecar, assets: harness.stack.assets, events: harness.events };
	const guarded = guardAssetDesign({ ...ports, locks: new ReferenceLocks() }, { fileExists: () => true }, recorder, VAULT_EXCEPTION_MAPPER).assetDesign;
	const edits = createAssetDesignerCommands(ports, guarded).designEdits({ noteLedger: harness.noteLedger, geometryLedger: harness.geometryLedger });
	const history = new CommandHistory();
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
	return { registry, harness, history, seen, outcomes, dispatch, setBackground };
}

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

	it('POSITIVE CONTROL: the sidecar restore refused after the note restore landed DOES raise the stamp', async () => {
		const r = await designerRig(true);
		await r.dispatch('run', r.history.run(r.setBackground()));
		vi.spyOn(r.harness.sidecar, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: true, named: [{ entityKind: 'asset', entityId: r.harness.assetId }] }]);
	});
});

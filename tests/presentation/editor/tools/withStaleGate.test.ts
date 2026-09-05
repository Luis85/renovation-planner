import { describe, expect, it } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import {
	STALE_WRITE_REFUSED,
	staleWriteRefusal,
	withStaleGate,
} from '../../../../src/presentation/editor/tools/with-stale-gate';
import { affectsSaveState } from '../../../../src/presentation/editor/save-state/affects-save-state';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

const command: UndoableCommand = { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) };

function recording() {
	const calls: string[] = [];
	const history = {
		run: () => {
			calls.push('run');
			return Promise.resolve(ok('wrote' as const));
		},
		undo: () => {
			calls.push('undo');
			return Promise.resolve(ok('wrote' as const));
		},
		redo: () => {
			calls.push('redo');
			return Promise.resolve(ok('wrote' as const));
		},
	};
	return { calls, history };
}

describe('withStaleGate', () => {
	it('refuses a run while stale, without reaching the history', async () => {
		const { calls, history } = recording();
		const result = await withStaleGate(history, () => true).run(command);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(STALE_WRITE_REFUSED);
		expect(result.error.category).toBe('Validation');
		expect(calls).toEqual([]);
	});
	it('passes a run through when not stale', async () => {
		const { calls, history } = recording();
		expect((await withStaleGate(history, () => false).run(command)).ok).toBe(true);
		expect(calls).toEqual(['run']);
	});
	it('lets undo and redo through in BOTH states', async () => {
		const stale = recording();
		const gatedStale = withStaleGate(stale.history, () => true);
		await gatedStale.undo();
		await gatedStale.redo();
		expect(stale.calls).toEqual(['undo', 'redo']);

		const fresh = recording();
		const gatedFresh = withStaleGate(fresh.history, () => false);
		await gatedFresh.undo();
		await gatedFresh.redo();
		expect(fresh.calls).toEqual(['undo', 'redo']);
	});
	it('reads the flag at dispatch time, not at construction', async () => {
		let stale = true;
		const { calls, history } = recording();
		const gated = withStaleGate(history, () => stale);
		await gated.run(command);
		stale = false;
		await gated.run(command);
		expect(calls).toEqual(['run']);
	});
	it('is neutral to the save indicator: the refusal is pre-write', () => {
		expect(affectsSaveState(staleWriteRefusal())).toBe(false);
	});
});

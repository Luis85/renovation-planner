/**
 * `createWriteChain` and `createEditShape` — the designer leaf's ONE write chain (spec Amendment 2), and
 * the door a click-, field- or key-bound shape edit takes onto it (Amendment 1): read the design when
 * the step runs, run a pure edit, and dispatch a conditional write only when the edit has one to make.
 */
import { describe, expect, it } from 'vitest';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../../src/core/result/Result';
import { assetError } from '../../../../src/domain/asset/Asset.errors';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { createEditShape, createWriteChain } from '../../../../src/presentation/designer/selection/editShape';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';
import { settle } from '../../../helpers/settle';

function writes(): { readonly calls: { shape: AssetShape; expected: EntityVersion }[]; write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult> } {
	const calls: { shape: AssetShape; expected: EntityVersion }[] = [];
	return {
		calls,
		write: (shape, expected) => {
			calls.push({ shape, expected });
			return Promise.resolve(ok('wrote'));
		},
	};
}

/** `createEditShape` over a fresh chain of its own. */
function editShapeOver(design: Parameters<typeof createEditShape>[1], write: Parameters<typeof createEditShape>[2]) {
	return createEditShape(createWriteChain().enqueue, design, write);
}

const drawn = () => ({ shape: TOILET, geometryVersion: DESIGN_VERSION });

const shifted = (shape: AssetShape) => ok({ ...shape, anchor: { x: 10, y: 0 } });

const faulting = (): never => {
	throw new Error('the edit faulted');
};

describe('createWriteChain', () => {
	it('is writing from the moment a step is queued until it settles, and settled waits for it', async () => {
		const chain = createWriteChain();
		let finish!: () => void;
		let drained = false;
		expect(chain.writing()).toBe(false);

		const step = chain.enqueue(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		void (async () => {
			await chain.settled();
			drained = true;
		})();
		await settle();
		expect([chain.writing(), drained]).toEqual([true, false]);

		finish();
		await step;
		await settle();
		expect([chain.writing(), drained]).toEqual([false, true]);
	});

	it('stops writing after a step that rejected, and runs the step behind it', async () => {
		const chain = createWriteChain();

		const faulted = chain.enqueue(() => Promise.reject(new Error('the step faulted')));
		const later = chain.enqueue(() => Promise.resolve('ran'));

		await expect(faulted).rejects.toThrow('the step faulted');
		await expect(later).resolves.toBe('ran');
		expect(chain.writing()).toBe(false);
	});
});

describe('createEditShape', () => {
	it('writes nothing, and resolves no-write, when nothing has been read or nothing drawn', async () => {
		const recorder = writes();
		let edits = 0;
		const count = (shape: AssetShape) => {
			edits += 1;
			return ok(shape);
		};

		const unread = await editShapeOver(() => null, recorder.write)(count);
		const shapeless = await editShapeOver(() => ({ shape: null, geometryVersion: DESIGN_VERSION }), recorder.write)(count);

		expect(unread).toEqual(ok('no-write'));
		expect(shapeless).toEqual(ok('no-write'));
		expect(edits).toBe(0);
		expect(recorder.calls).toEqual([]);
	});

	it('writes nothing, and resolves no-write, for an edit with nothing to do on the shape it is handed', async () => {
		const recorder = writes();

		const result = await editShapeOver(drawn, recorder.write)(() => null);

		expect(result).toEqual(ok('no-write'));
		expect(recorder.calls).toEqual([]);
	});

	it('resolves a refused edit as that refusal, without dispatching', async () => {
		const recorder = writes();
		const refusal = assetError('part-not-found', 'That part is not on this shape.');

		const result = await editShapeOver(drawn, recorder.write)(() => err(refusal));

		expect(result).toEqual(err(refusal));
		expect(recorder.calls).toEqual([]);
	});

	it('writes the edited shape once, conditional on the version it read, and resolves the write', async () => {
		const recorder = writes();

		const result = await editShapeOver(drawn, recorder.write)(shifted);

		expect(result).toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
		expect(recorder.calls[0]?.shape.anchor).toEqual({ x: 10, y: 0 });
		expect(recorder.calls[0]?.expected).toBe(DESIGN_VERSION);
	});

	it('rejects, rather than throwing at the call, when the edit faults', async () => {
		const recorder = writes();

		// Taken without awaiting: a synchronous throw would fail HERE, which is the defect this case pins.
		const outcome = editShapeOver(drawn, recorder.write)(faulting);

		await expect(outcome).rejects.toThrow('the edit faulted');
		expect(recorder.calls).toEqual([]);
	});

	it('reads the design for a second edit only once the first write has settled, so two quick taps compose', async () => {
		let reads = 0;
		let written = 0;
		let settleFirst!: (result: DispatchResult) => void;
		const editShape = editShapeOver(
			() => {
				reads += 1;
				return drawn();
			},
			() => {
				written += 1;
				return written === 1 ? new Promise<DispatchResult>((resolve) => { settleFirst = resolve; }) : Promise.resolve(ok('wrote'));
			},
		);

		const first = editShape(shifted);
		const second = editShape(shifted);
		await settle();
		expect(reads).toBe(1);

		settleFirst(ok('wrote'));
		await expect(first).resolves.toEqual(ok('wrote'));
		await expect(second).resolves.toEqual(ok('wrote'));
		expect(reads).toBe(2);
		expect(written).toBe(2);
	});

	it('reads the design for an edit only once every step queued before it has settled', async () => {
		const chain = createWriteChain();
		let reads = 0;
		let settleEarlier!: () => void;
		const editShape = createEditShape(
			chain.enqueue,
			() => {
				reads += 1;
				return drawn();
			},
			() => Promise.resolve(ok('wrote')),
		);

		// A tool's release, queued first on the same chain and not yet settled.
		const earlier = chain.enqueue(
			() =>
				new Promise<void>((resolve) => {
					settleEarlier = resolve;
				}),
		);
		const edit = editShape(shifted);
		await settle();
		expect(reads).toBe(0);

		settleEarlier();
		await earlier;
		await expect(edit).resolves.toEqual(ok('wrote'));
		expect(reads).toBe(1);
	});

	it('runs a later edit after an earlier one faulted, rather than wedging behind it', async () => {
		const recorder = writes();
		const editShape = editShapeOver(drawn, recorder.write);

		const faulted = editShape(faulting);
		const later = editShape(shifted);

		await expect(faulted).rejects.toThrow('the edit faulted');
		await expect(later).resolves.toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
	});
});

/**
 * `createEditShape` — the ONE door a click- or field-bound shape edit takes (spec Amendment 1): read
 * the design, run a pure edit, and dispatch a conditional write only when the edit succeeded.
 */
import { describe, expect, it } from 'vitest';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../../src/core/result/Result';
import { assetError } from '../../../../src/domain/asset/Asset.errors';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { createEditShape } from '../../../../src/presentation/designer/selection/editShape';
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

const shifted = (shape: AssetShape) => ok({ ...shape, anchor: { x: 10, y: 0 } });

const faulting = (): never => {
	throw new Error('the edit faulted');
};

describe('createEditShape', () => {
	it('writes nothing, and resolves no-write, when nothing has been read or nothing drawn', async () => {
		const recorder = writes();
		let edits = 0;
		const count = (shape: AssetShape) => {
			edits += 1;
			return ok(shape);
		};

		const unread = await createEditShape(() => null, recorder.write)(count);
		const shapeless = await createEditShape(() => ({ shape: null, geometryVersion: DESIGN_VERSION }), recorder.write)(count);

		expect(unread).toEqual(ok('no-write'));
		expect(shapeless).toEqual(ok('no-write'));
		expect(edits).toBe(0);
		expect(recorder.calls).toEqual([]);
	});

	it('resolves a refused edit as that refusal, without dispatching', async () => {
		const recorder = writes();
		const refusal = assetError('part-not-found', 'That part is not on this shape.');

		const result = await createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(() => err(refusal));

		expect(result).toEqual(err(refusal));
		expect(recorder.calls).toEqual([]);
	});

	it('writes the edited shape once, conditional on the version it read, and resolves the write', async () => {
		const recorder = writes();

		const result = await createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(shifted);

		expect(result).toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
		expect(recorder.calls[0]?.shape.anchor).toEqual({ x: 10, y: 0 });
		expect(recorder.calls[0]?.expected).toBe(DESIGN_VERSION);
	});

	it('rejects, rather than throwing at the call, when the edit faults', async () => {
		const recorder = writes();

		// Taken without awaiting: a synchronous throw would fail HERE, which is the defect this case pins.
		const outcome = createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(faulting);

		await expect(outcome).rejects.toThrow('the edit faulted');
		expect(recorder.calls).toEqual([]);
	});

	it('reads the design for a second edit only once the first write has settled, so two quick taps compose', async () => {
		let reads = 0;
		let written = 0;
		let settleFirst!: (result: DispatchResult) => void;
		const editShape = createEditShape(
			() => {
				reads += 1;
				return { shape: TOILET, geometryVersion: DESIGN_VERSION };
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

	it('runs a later edit after an earlier one faulted, rather than wedging behind it', async () => {
		const recorder = writes();
		const editShape = createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write);

		const faulted = editShape(faulting);
		const later = editShape(shifted);

		await expect(faulted).rejects.toThrow('the edit faulted');
		await expect(later).resolves.toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
	});
});

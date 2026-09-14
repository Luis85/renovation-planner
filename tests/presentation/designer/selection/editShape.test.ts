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
});

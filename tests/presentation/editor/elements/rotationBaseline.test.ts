import { expect, it } from 'vitest';
import { expectErr } from '../../../helpers/domain';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { readRotationBaseline } from '../../../../src/presentation/editor/elements/rotationBaseline';
import { staleWriteRefusal } from '../../../../src/presentation/editor/tools/with-stale-gate';
import type { PlanEditorContext } from '../../../../src/presentation/editor/PlanEditorContext';
import type { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';

it('refuses a wall turn as stale on a host with no renovation services to read or write it through', async () => {
	const wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
	const context = { planId: 'plan-a', commands: {} } as unknown as PlanEditorContext;
	const result = await readRotationBaseline(context, {} as ReturnType<typeof useProjectStore>, { id: 'wall-a', kind: 'wall', name: 'Wall 1', points: [wall.start, wall.end], wall }, new SessionWriteLedger());
	expect(expectErr(result)).toEqual(staleWriteRefusal());
});

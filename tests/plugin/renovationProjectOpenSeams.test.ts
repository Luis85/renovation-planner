/**
 * @vitest-environment jsdom
 *
 * `renovationProjectOpenPlan`/`renovationProjectOpenProject`/`renovationProjectOpenAsset` —
 * `RenovationProjectDeps.openPlan`, `.openProject` and `.openAsset` bound to the real
 * Obsidian-facing activations, pulled out of `renovationProjectDeps` purely for
 * `composition-root.ts`'s 400-line budget. Moving code does not move its behaviour for free,
 * so this file drives each directly rather than trusting that the extraction changed nothing.
 *
 * `openProject`'s own fault path is already covered end to end through
 * `renovationProjectWiring.test.ts`'s "reports rather than rejecting when opening the note
 * faults" (that case predates the extraction and needs nothing new here); `openPlan`'s and
 * `openAsset`'s never had a caller that drives a real fault through them, since
 * `renovationProjectWiring.test.ts` mocks `revealPlanEditor`/`revealAssetDesigner` outright to
 * prove the WIRING. This file is the other half: the real functions, faulted for real.
 */
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { activateNotices } from '../../src/presentation/notices/notify';
import { recorder, resetRecorder, lines } from '../helpers/logger';
import { FakeWorkspace } from '../helpers/workspace';
import { renovationProjectOpenAsset, renovationProjectOpenPlan } from '../../src/plugin/renovationProjectOpenSeams';

installObsidianDom();

describe('renovationProjectOpenPlan', () => {
	it('opens a leaf carrying the plan id, through the real revealPlanEditor', async () => {
		const workspace = new FakeWorkspace();
		const openPlan = renovationProjectOpenPlan(workspace as never, recorder);

		await openPlan('plan-ground');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0]?.state?.state).toEqual({ planId: 'plan-ground' });
	});

	/**
	 * The one path `renovationProjectWiring.test.ts` cannot reach: that file mocks
	 * `revealPlanEditor` outright to prove which function `openPlan` is bound to, so its own
	 * `reportFault` closure — mapping a real activation fault to `view.plan-editor.reveal-failed`
	 * — never runs there. A workspace whose candidate lookup throws is `revealPlanEditor.test.ts`'s
	 * own fault case, reused here for the composed closure rather than the bare function.
	 */
	it('reports a real activation fault as view.plan-editor.reveal-failed', async () => {
		activateNotices();
		resetRecorder();
		const exploding = {
			getLeavesOfType: () => {
				throw new Error('workspace exploded');
			},
		};
		const openPlan = renovationProjectOpenPlan(exploding as never, recorder);

		await expect(openPlan('plan-ground')).resolves.toBeUndefined();

		const logged = lines.find((line) => line.event === 'view.plan-editor.reveal-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('workspace exploded');
	});
});

describe('renovationProjectOpenAsset', () => {
	it('opens a leaf carrying the asset id, through the real revealAssetDesigner', async () => {
		const workspace = new FakeWorkspace();
		const openAsset = renovationProjectOpenAsset(workspace as never, recorder);

		await openAsset('asset-chair');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0]?.state?.state).toEqual({ assetId: 'asset-chair' });
	});

	/**
	 * The one path `renovationProjectWiring.test.ts` cannot reach: that file mocks
	 * `revealAssetDesigner` outright to prove which function `openAsset` is bound to, so its
	 * own `reportFault` closure — mapping a real activation fault to
	 * `view.asset-designer.reveal-failed` — never runs there. A workspace whose candidate
	 * lookup throws is `revealAssetDesigner.test.ts`'s own fault case, reused here for the
	 * composed closure rather than the bare function.
	 */
	it('reports a real activation fault as view.asset-designer.reveal-failed', async () => {
		activateNotices();
		resetRecorder();
		const exploding = {
			getLeavesOfType: () => {
				throw new Error('workspace exploded');
			},
		};
		const openAsset = renovationProjectOpenAsset(exploding as never, recorder);

		await expect(openAsset('asset-chair')).resolves.toBeUndefined();

		const logged = lines.find((line) => line.event === 'view.asset-designer.reveal-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('workspace exploded');
	});
});

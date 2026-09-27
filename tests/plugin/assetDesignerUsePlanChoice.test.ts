/**
 * @vitest-environment jsdom
 *
 * AD18 Task 8, take.md steps 15 and 16's D clauses, over `assetDesignerUsePlan`
 * (`src/plugin/renovationProjectOpenSeams.ts`) — `assetDesignerUsePlan.test.ts` drives the
 * picker's ZERO-open arm (creates and reveals a new leaf) and the already-one-open arm, but never
 * the TWO-open arm past the point the picker opens: it asserts the picker appears and nothing is
 * revealed, then moves on. Two clauses of the case's own pass condition for step 15 — "choosing
 * one opens it... with the same armed banner and the same asset" — are therefore untested for the
 * branch where the choice is genuinely ambiguous, and step 16's "nothing is armed" is untested for
 * that same two-leaf shape at all.
 *
 * Driven the same way `assetDesignerUsePlan.test.ts` does: through the real seam, a real
 * `FakeWorkspace` and the real `FuzzySuggestModal`/`Notice` mocks (imported BY NAME for the same
 * reason that file's own header gives — `obsidian` declares neither) — both files share that rig
 * through `tests/helpers/usePlanRig.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FuzzySuggestModal, Notice } from '../helpers/obsidian-mock';
import { PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { ASSET, FIRST, GROUND, flush, pickerAt, wired } from '../helpers/usePlanRig';

installObsidianDom();

beforeEach(() => {
	Notice.shown.length = 0;
	FuzzySuggestModal.opened.length = 0;
	activateNotices();
});

describe('use in plan, choosing among two already-open plans', () => {
	it('reveals the plan chosen — not the other one — armed with the same asset', async () => {
		const { workspace, usePlan } = wired();
		const ground = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });
		const first = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: FIRST });

		usePlan();
		const picker = pickerAt(0);
		const chosen = picker.getItems().find((item) => item.id === FIRST);
		if (chosen === undefined) throw new Error('the picker offered no first-floor plan');
		picker.choose(chosen);
		await flush();

		// "choosing one opens it" — the FIRST leaf, never the GROUND one sitting beside it.
		expect(workspace.revealed).toEqual([first]);
		// "with the same armed banner and the same asset" — `editorArrivalQueue.ts`'s arrival
		// writes `origin` onto the leaf's own state, which is what the Plan Editor's banner and
		// the placement tool both read.
		expect(first.state?.state?.['origin']).toEqual({ planId: FIRST, assetId: ASSET });
		// And the OTHER open leaf is untouched — never revealed, never armed.
		expect(ground.state?.state?.['origin']).toBeUndefined();
		expect(workspace.revealed).not.toContain(ground);
	});

	it('arms neither already-open Plan Editor when the picker is dismissed', async () => {
		const { workspace, usePlan } = wired();
		const ground = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: GROUND });
		const first = workspace.withOpen(PLAN_EDITOR_VIEW, { planId: FIRST });
		const groundBefore = ground.state;
		const firstBefore = first.state;

		usePlan();
		pickerAt(0).close();
		await flush();

		expect(ground.state).toBe(groundBefore);
		expect(first.state).toBe(firstBefore);
		expect(workspace.revealed).toEqual([]);
	});
});

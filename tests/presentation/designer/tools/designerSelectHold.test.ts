/**
 * `DesignerSelectTool`'s HOLD (asset designer symbols spec, Amendment 2), driven directly: a press made
 * while the leaf's write chain still has a write queued is held, with its latest move and its release,
 * and replayed once the chain has drained — so it reads the design that write left. The mounted half is
 * `designerWriteChain.test.ts`; what only this file can reach is the moment between the two.
 */
import { describe, expect, it } from 'vitest';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';
import { DESIGN_VERSION, detailOutline, justInsideBottom, selectToolRig } from '../../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);

/** A chain the case drains by hand: every `settled()` waits for `wake`, which also says whether a write is still queued then. */
function manualChain() {
	let busy = true;
	let waiting: (() => void)[] = [];
	return {
		writing: () => busy,
		settled: () =>
			new Promise<void>((resolve) => {
				waiting.push(resolve);
			}),
		wake: (stillWriting: boolean) => {
			busy = stillWriting;
			const woken = waiting;
			waiting = [];
			for (const resolve of woken) resolve();
		},
	};
}

function heldRig() {
	const chain = manualChain();
	const rig = selectToolRig({ writing: chain.writing, settled: chain.settled });
	rig.tool.activate(rig.harness.context);
	return { rig, chain };
}

/** A whole drag of the bowl by +100 mm, with a +50 move before the +100 one. */
function dragBowl(rig: ReturnType<typeof selectToolRig>): void {
	rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
	rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
	rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
	rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
}

describe('a press made while a write is queued', () => {
	it('is held: nothing is selected, previewed or written, and it is a draft Escape can abandon', async () => {
		const { rig } = heldRig();

		dragBowl(rig);
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.written).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(true);
		expect(rig.tool.tracksPointer()).toBe(false);
	});

	it('is replayed with only its latest move and its release once the chain drains', async () => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		chain.wake(false);
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		// The +50 move was superseded while held: the first preview is already the +100 one.
		expect(rig.previews[0]?.details.find((detail) => detail.id === 'detail-2')?.outline.points).toEqual(
			BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })),
		);
		expect(rig.written).toHaveLength(1);
		expect(rig.written[0]?.expected).toBe(DESIGN_VERSION);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('is held again, with what it carried, when another write was queued while it waited', async () => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		chain.wake(true);
		await flushGesture();
		expect([rig.selected, rig.written]).toEqual([[], []]);
		expect(rig.tool.hasDraft()).toBe(true);

		chain.wake(false);
		await flushGesture();
		expect(rig.written).toHaveLength(1);
	});

	it('is replayed as a live press when its release has not come yet, and that release commits it', async () => {
		const { rig, chain } = heldRig();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));

		chain.wake(false);
		await flushGesture();
		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(rig.tool.hasDraft()).toBe(true);

		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();
		expect(rig.written).toHaveLength(1);
	});

	it.each(['cancel', 'abandonGesture', 'deactivate'] as const)('is dropped by %s, and nothing replays it', async (exit) => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		rig.tool[exit]();
		expect(rig.tool.hasDraft()).toBe(false);
		chain.wake(false);
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.written).toEqual([]);
	});
});

/**
 * @vitest-environment jsdom
 *
 * The designer's selection shortcuts as pure decisions (`designerShortcut`), and the three edits they
 * and the arrow keys dispatch (`selectionKeyActions`) over a fake `editShape` that applies each edit to
 * the toilet preset — so what an action WOULD write is asserted without a vault. jsdom only for the
 * notice a refused duplicate raises. `designerKeyboard.test.ts` is the mounted half.
 */
import { describe, expect, it } from 'vitest';
import type { AppError, ValidationError } from '../../../src/core/errors/AppError';
import { ok, type Result } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { ToolId } from '../../../src/presentation/editor/tools/editor-tool';
import { canGroup, designerShortcut, selectionKeyActions, type DesignerKeyPress } from '../../../src/presentation/designer/designerKeys';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/settle';
import { TOILET, detailOutline } from '../../helpers/designerSelection';

installObsidianDom();

const DETAIL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const GROUPED: AssetShape = { ...TOILET, groups: [{ id: 'group-1', members: ['detail-1', 'detail-2'] }] };

function pressed(init: Partial<DesignerKeyPress>): { readonly event: DesignerKeyPress; readonly prevented: () => boolean; readonly stopped: () => boolean } {
	let prevented = false;
	let stopped = false;
	const event: DesignerKeyPress = {
		key: '',
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		repeat: false,
		isComposing: false,
		...init,
		preventDefault: () => {
			prevented = true;
		},
		stopPropagation: () => {
			stopped = true;
		},
	};
	return { event, prevented: () => prevented, stopped: () => stopped };
}

const PAIR: readonly DesignerSelection[] = [{ kind: 'detail', id: 'detail-1' }, DETAIL];
const NO_DESIGN = Symbol('no design read yet');

type Case = readonly [string, Partial<DesignerKeyPress>, readonly DesignerSelection[], AssetShape | typeof NO_DESIGN];

function doors(): { readonly calls: string[]; readonly doors: Parameters<typeof designerShortcut>[2] } {
	const calls: string[] = [];
	return {
		calls,
		doors: {
			deleteSelection: () => {
				calls.push('delete');
			},
			duplicateSelection: () => {
				calls.push('duplicate');
			},
			groupSelection: () => {
				calls.push('group');
			},
			ungroupSelection: () => {
				calls.push('ungroup');
			},
		},
	};
}

function state(selected: readonly DesignerSelection[], shape: AssetShape | typeof NO_DESIGN): Parameters<typeof designerShortcut>[1] {
	return { selected, design: shape === NO_DESIGN ? null : { shape } };
}

const HANDLED: readonly (readonly [...Case, string])[] = [
	['Delete on a detail', { key: 'Delete' }, [DETAIL], TOILET, 'delete'],
	['Backspace on the clearance', { key: 'Backspace' }, [{ kind: 'clearance' }], TOILET, 'delete'],
	['Ctrl+D on a detail', { key: 'd', ctrlKey: true }, [DETAIL], TOILET, 'duplicate'],
	['Cmd+D on a detail', { key: 'd', metaKey: true }, [DETAIL], TOILET, 'duplicate'],
	['Ctrl+D with Caps Lock on', { key: 'D', ctrlKey: true }, [DETAIL], TOILET, 'duplicate'],
	['Ctrl+G on two ungrouped details', { key: 'g', ctrlKey: true }, PAIR, TOILET, 'group'],
	['Cmd+G on two ungrouped details', { key: 'g', metaKey: true }, PAIR, TOILET, 'group'],
	['Ctrl+Shift+G on a grouped detail', { key: 'G', ctrlKey: true, shiftKey: true }, [DETAIL], GROUPED, 'ungroup'],
	['Cmd+Shift+G on a grouped detail', { key: 'G', metaKey: true, shiftKey: true }, [DETAIL], GROUPED, 'ungroup'],
];

/**
 * A chord that would do nothing is NOT claimed — `historyShortcut.ts`'s rule, "a chord that does
 * nothing here stays the host's" — so Obsidian's own Ctrl+G still opens its graph view whenever
 * there is nothing here to group.
 */
const IGNORED: readonly Case[] = [
	['Delete on the footprint', { key: 'Delete' }, [{ kind: 'footprint' }], TOILET],
	['Delete on the anchor', { key: 'Delete' }, [{ kind: 'anchor' }], TOILET],
	['Delete with nothing selected', { key: 'Delete' }, [], TOILET],
	['Shift+Delete', { key: 'Delete', shiftKey: true }, [DETAIL], TOILET],
	['Ctrl+Backspace', { key: 'Backspace', ctrlKey: true }, [DETAIL], TOILET],
	['an autorepeated Delete', { key: 'Delete', repeat: true }, [DETAIL], TOILET],
	['Ctrl+D on the clearance', { key: 'd', ctrlKey: true }, [{ kind: 'clearance' }], TOILET],
	['Ctrl+Shift+D', { key: 'D', ctrlKey: true, shiftKey: true }, [DETAIL], TOILET],
	['Ctrl+Alt+D', { key: 'd', ctrlKey: true, altKey: true }, [DETAIL], TOILET],
	['an autorepeated Ctrl+D', { key: 'd', ctrlKey: true, repeat: true }, [DETAIL], TOILET],
	['Ctrl+D mid-composition', { key: 'd', ctrlKey: true, isComposing: true }, [DETAIL], TOILET],
	['a bare d', { key: 'd' }, [DETAIL], TOILET],
	['Ctrl+G on a single detail, which cannot be grouped', { key: 'g', ctrlKey: true }, [DETAIL], TOILET],
	['Ctrl+G on a pair already grouped', { key: 'g', ctrlKey: true }, PAIR, GROUPED],
	['Ctrl+G on the clearance', { key: 'g', ctrlKey: true }, [{ kind: 'clearance' }], TOILET],
	['Ctrl+G with nothing selected', { key: 'g', ctrlKey: true }, [], TOILET],
	['Ctrl+G before any design is read', { key: 'g', ctrlKey: true }, PAIR, NO_DESIGN],
	['Ctrl+Shift+G on an ungrouped detail', { key: 'G', ctrlKey: true, shiftKey: true }, [DETAIL], TOILET],
	['Ctrl+Shift+G on the footprint', { key: 'G', ctrlKey: true, shiftKey: true }, [{ kind: 'footprint' }], GROUPED],
	['Ctrl+Alt+G', { key: 'g', ctrlKey: true, altKey: true }, PAIR, TOILET],
	['Ctrl+Alt+Shift+G', { key: 'G', ctrlKey: true, altKey: true, shiftKey: true }, [DETAIL], GROUPED],
	['an autorepeated Ctrl+G', { key: 'g', ctrlKey: true, repeat: true }, PAIR, TOILET],
	['an autorepeated Ctrl+Shift+G', { key: 'G', ctrlKey: true, shiftKey: true, repeat: true }, [DETAIL], GROUPED],
	['Ctrl+G mid-composition', { key: 'g', ctrlKey: true, isComposing: true }, PAIR, TOILET],
	['a bare g', { key: 'g' }, PAIR, TOILET],
	['Shift+G', { key: 'G', shiftKey: true }, [DETAIL], GROUPED],
	['an unrelated key', { key: 'x' }, [DETAIL], TOILET],
];

describe('designerShortcut', () => {
	it.each(HANDLED)('handles %s', (_name, init, selected, shape, door) => {
		const { event, prevented, stopped } = pressed(init);
		const recorded = doors();

		expect(designerShortcut(event, state(selected, shape), recorded.doors)).toBe(true);
		expect(recorded.calls).toEqual([door]);
		// Only a chord has a default worth taking away — the browser's, and the host's own hotkey
		// (Obsidian binds Ctrl+G to its graph view); a bare Delete on a focused canvas has neither.
		expect(prevented()).toBe(door !== 'delete');
		expect(stopped()).toBe(door !== 'delete');
	});

	it.each(IGNORED)('ignores %s', (_name, init, selected, shape) => {
		const { event, prevented, stopped } = pressed(init);
		const recorded = doors();

		expect(designerShortcut(event, state(selected, shape), recorded.doors)).toBe(false);
		expect(recorded.calls).toEqual([]);
		expect(prevented()).toBe(false);
		expect(stopped()).toBe(false);
	});
});

const REFUSED: DispatchResult = { ok: false, error: { category: 'Validation', code: 'asset.part-not-found', message: 'x' } as AppError };

function actionsOver(
	selection: DesignerSelection | null,
	answer: DispatchResult = ok('wrote'),
	tool: ToolId | null = 'select',
	shape: AssetShape = TOILET,
	members: readonly DesignerSelection[] = selection === null ? [] : [selection],
) {
	const selected: (DesignerSelection | null)[] = [];
	const edited: (Result<AssetShape, ValidationError> | null)[] = [];
	const actions = selectionKeyActions(
		{
			selection,
			selected: members,
			select: (next) => {
				selected.push(next);
			},
		},
		(edit) => {
			edited.push(edit(shape));
			return Promise.resolve(answer);
		},
		{ value: tool },
	);
	return { actions, selected, edited };
}

function shapeOf(result: Result<AssetShape, ValidationError> | null | undefined): AssetShape | undefined {
	return result?.ok === true ? result.value : undefined;
}

describe('selectionKeyActions', () => {
	it('deletes a selected detail, and removes a selected clearance', async () => {
		const detail = actionsOver(DETAIL);
		const clearance = actionsOver({ kind: 'clearance' });

		await detail.actions.deleteSelection();
		await clearance.actions.deleteSelection();

		expect(shapeOf(detail.edited[0])?.details.map((each) => each.id)).toEqual(['detail-1']);
		expect(shapeOf(clearance.edited[0])?.clearance).toBeNull();
	});

	it('nudges an outline or the anchor, and writes nothing for the facing or for no selection', async () => {
		const outline = actionsOver(DETAIL);
		const anchor = actionsOver({ kind: 'anchor' });
		const facing = actionsOver({ kind: 'facing' });
		const nothing = actionsOver(null);

		await outline.actions.nudgeSelection({ dx: 10, dy: 0 });
		await anchor.actions.nudgeSelection({ dx: 0, dy: 100 });
		await facing.actions.nudgeSelection({ dx: 10, dy: 0 });
		await nothing.actions.nudgeSelection({ dx: 10, dy: 0 });

		const bowl = shapeOf(outline.edited[0])?.details.find((each) => each.id === 'detail-2')?.outline.points;
		expect(bowl).toEqual(detailOutline('detail-2').points.map((point) => ({ x: point.x + 10, y: point.y })));
		expect(shapeOf(anchor.edited[0])?.anchor).toEqual({ x: TOILET.anchor.x, y: TOILET.anchor.y + 100 });
		expect(facing.edited).toEqual([]);
		expect(nothing.edited).toEqual([]);
	});

	it('nudges nothing unless Select is the active tool, which every other tool leaves the keys to', async () => {
		const tracing = actionsOver(DETAIL, ok('wrote'), 'trace-footprint');
		const camera = actionsOver(DETAIL, ok('wrote'), null);

		await tracing.actions.nudgeSelection({ dx: 10, dy: 0 });
		await camera.actions.nudgeSelection({ dx: 10, dy: 0 });

		expect(tracing.edited).toEqual([]);
		expect(camera.edited).toEqual([]);
	});

	it('deletes and duplicates only a part each can act on, whoever calls it', async () => {
		const footprint = actionsOver({ kind: 'footprint' });
		const nothing = actionsOver(null);
		const clearance = actionsOver({ kind: 'clearance' });

		await footprint.actions.deleteSelection();
		await nothing.actions.deleteSelection();
		await clearance.actions.duplicateSelection();
		await nothing.actions.duplicateSelection();

		expect(footprint.edited).toEqual([]);
		expect(clearance.edited).toEqual([]);
		expect(nothing.edited).toEqual([]);
		expect([...clearance.selected, ...nothing.selected]).toEqual([]);
	});

	it('duplicates a detail and selects the copy it wrote', async () => {
		const harness = actionsOver(DETAIL);

		await harness.actions.duplicateSelection();

		expect(shapeOf(harness.edited[0])?.details.map((each) => each.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(harness.selected).toEqual([{ kind: 'detail', id: 'detail-3' }]);
	});

	it('selects nothing for a refused duplicate, and says why', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const harness = actionsOver(DETAIL, REFUSED);

		await harness.actions.duplicateSelection();
		await settle();

		expect(harness.selected).toEqual([]);
		expect(Notice.shown).toHaveLength(1);
	});

	/**
	 * Amendment 2: a key captures its part at the press, and a Delete or an undo queued ahead of it can
	 * remove that part before its step runs. The edit then answers `null` — nothing to do — which
	 * `editShape` resolves as `no-write` without dispatching, so nothing is said and nothing is written.
	 * The anchor is never gone, which `nudges an outline or the anchor…` above already drives.
	 */
	it('skips a nudge or a delete whose part is gone by the time its step runs', async () => {
		const detail = actionsOver({ kind: 'detail', id: 'detail-9' });
		const clearance = actionsOver({ kind: 'clearance' }, ok('wrote'), 'select', { ...TOILET, clearance: null });

		await detail.actions.nudgeSelection({ dx: 10, dy: 0 });
		await detail.actions.deleteSelection();
		await clearance.actions.deleteSelection();
		await clearance.actions.nudgeSelection({ dx: 10, dy: 0 });

		expect([...detail.edited, ...clearance.edited]).toEqual([null, null, null, null]);
	});

	it('groups the selected graphics, and writes nothing for a set it cannot group', async () => {
		const both: DesignerSelection[] = [{ kind: 'detail', id: 'detail-1' }, DETAIL];
		const pair = actionsOver(DETAIL, ok('wrote'), 'select', TOILET, both);
		const single = actionsOver(DETAIL);
		const grouped = actionsOver(DETAIL, ok('wrote'), 'select', GROUPED, both);

		await pair.actions.groupSelection();
		await single.actions.groupSelection();
		await grouped.actions.groupSelection();

		expect(shapeOf(pair.edited[0])?.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-2'] }]);
		expect([...single.edited, ...grouped.edited]).toEqual([null, null]);
	});

	it("ungroups the focused graphic's group, and nothing for an ungrouped graphic or a non-graphic", async () => {
		const grouped = actionsOver(DETAIL, ok('wrote'), 'select', GROUPED);
		const loose = actionsOver(DETAIL);
		const footprint = actionsOver({ kind: 'footprint' }, ok('wrote'), 'select', GROUPED);

		await grouped.actions.ungroupSelection();
		await loose.actions.ungroupSelection();
		await footprint.actions.ungroupSelection();

		expect(shapeOf(grouped.edited[0])?.groups).toEqual([]);
		expect(loose.edited).toEqual([null]);
		expect(footprint.edited).toEqual([]);
	});
});

describe('canGroup', () => {
	it('answers true only for two or more graphics none of which is grouped yet', () => {
		expect(canGroup(TOILET, ['detail-1', 'detail-2'])).toBe(true);
		expect(canGroup(TOILET, ['detail-2'])).toBe(false);
		expect(canGroup(GROUPED, ['detail-1', 'detail-2'])).toBe(false);
	});
});

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
import { designerShortcut, selectionKeyActions, type DesignerKeyPress } from '../../../src/presentation/designer/designerKeys';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/settle';
import { TOILET, detailOutline } from '../../helpers/designerSelection';

installObsidianDom();

const DETAIL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

function pressed(init: Partial<DesignerKeyPress>): { readonly event: DesignerKeyPress; readonly prevented: () => boolean } {
	let prevented = false;
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
	};
	return { event, prevented: () => prevented };
}

function doors(selection: DesignerSelection | null): { readonly calls: string[]; readonly doors: Parameters<typeof designerShortcut>[1] } {
	const calls: string[] = [];
	return {
		calls,
		doors: {
			selection,
			deleteSelection: () => {
				calls.push('delete');
			},
			duplicateSelection: () => {
				calls.push('duplicate');
			},
		},
	};
}

const HANDLED: readonly (readonly [string, Partial<DesignerKeyPress>, DesignerSelection, string])[] = [
	['Delete on a detail', { key: 'Delete' }, DETAIL, 'delete'],
	['Backspace on the clearance', { key: 'Backspace' }, { kind: 'clearance' }, 'delete'],
	['Ctrl+D on a detail', { key: 'd', ctrlKey: true }, DETAIL, 'duplicate'],
	['Cmd+D on a detail', { key: 'd', metaKey: true }, DETAIL, 'duplicate'],
	['Ctrl+D with Caps Lock on', { key: 'D', ctrlKey: true }, DETAIL, 'duplicate'],
];

const IGNORED: readonly (readonly [string, Partial<DesignerKeyPress>, DesignerSelection | null])[] = [
	['Delete on the footprint', { key: 'Delete' }, { kind: 'footprint' }],
	['Delete on the anchor', { key: 'Delete' }, { kind: 'anchor' }],
	['Delete with nothing selected', { key: 'Delete' }, null],
	['Shift+Delete', { key: 'Delete', shiftKey: true }, DETAIL],
	['Ctrl+Backspace', { key: 'Backspace', ctrlKey: true }, DETAIL],
	['an autorepeated Delete', { key: 'Delete', repeat: true }, DETAIL],
	['Ctrl+D on the clearance', { key: 'd', ctrlKey: true }, { kind: 'clearance' }],
	['Ctrl+Shift+D', { key: 'D', ctrlKey: true, shiftKey: true }, DETAIL],
	['Ctrl+Alt+D', { key: 'd', ctrlKey: true, altKey: true }, DETAIL],
	['an autorepeated Ctrl+D', { key: 'd', ctrlKey: true, repeat: true }, DETAIL],
	['Ctrl+D mid-composition', { key: 'd', ctrlKey: true, isComposing: true }, DETAIL],
	['a bare d', { key: 'd' }, DETAIL],
	['an unrelated key', { key: 'x' }, DETAIL],
];

describe('designerShortcut', () => {
	it.each(HANDLED)('handles %s', (_name, init, selection, door) => {
		const { event, prevented } = pressed(init);
		const recorded = doors(selection);

		expect(designerShortcut(event, recorded.doors)).toBe(true);
		expect(recorded.calls).toEqual([door]);
		// Only the chord has a browser default worth taking away; a bare Delete on a focused canvas has none.
		expect(prevented()).toBe(door === 'duplicate');
	});

	it.each(IGNORED)('ignores %s', (_name, init, selection) => {
		const { event, prevented } = pressed(init);
		const recorded = doors(selection);

		expect(designerShortcut(event, recorded.doors)).toBe(false);
		expect(recorded.calls).toEqual([]);
		expect(prevented()).toBe(false);
	});
});

const REFUSED: DispatchResult = { ok: false, error: { category: 'Validation', code: 'asset.part-not-found', message: 'x' } as AppError };

function actionsOver(selection: DesignerSelection | null, answer: DispatchResult = ok('wrote')) {
	const selected: (DesignerSelection | null)[] = [];
	const edited: Result<AssetShape, ValidationError>[] = [];
	const actions = selectionKeyActions(
		{
			selection,
			select: (next) => {
				selected.push(next);
			},
		},
		(edit) => {
			edited.push(edit(TOILET));
			return Promise.resolve(answer);
		},
	);
	return { actions, selected, edited };
}

function shapeOf(result: Result<AssetShape, ValidationError> | undefined): AssetShape | undefined {
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
});

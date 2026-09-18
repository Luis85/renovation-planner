/**
 * @vitest-environment jsdom
 *
 * AD10's composition block, mounted BARE with a fake `editShape` that applies the edit it is handed
 * to a LIVE fixture — `designerSelectionInspector.test.ts`'s shape, so every case asserts the shape
 * a control would write rather than which function it happened to name. The last describe mounts
 * the real `DesignerInspector`, because a component proven bare and bound to nothing is the slice-7
 * shape this repository refuses.
 *
 * The fixture is `threeBoxes`: `detail-1` x -50…50, `detail-2` x 200…400, `detail-3` x 680…720.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerArrangePanel from '../../../src/presentation/designer/inspector/DesignerArrangePanel.vue';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { detailBox } from '../../../src/domain/asset/detailEdits';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { graphicIds, grouped, requireDetail, threeBoxes } from '../../helpers/arrangeShapes';
import { expectOk } from '../../helpers/domain';
import { recorder } from '../../helpers/logger';

/** `editShape`'s own signature: an edit may answer `null` for "nothing to do", which dispatches nothing. */
type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

const graphic = (id: string): DesignerSelection => ({ kind: 'detail', id });
const ALL = ['detail-1', 'detail-2', 'detail-3'].map((id) => graphic(id));

/**
 * The fake write chain: each edit that lands advances the shape the NEXT edit is handed.
 *
 * **`writes` counts the shapes that would actually be DISPATCHED**, which is not the same as the
 * calls to `editShape`: an edit answering `null` resolves `no-write` and pushes no undo entry
 * (`selection/editShape.ts`), and that difference is the whole of contract C05's no-op half. A case
 * counting calls instead would be green against a panel that wrote on every press.
 */
function mountPanel(options: { shape?: AssetShape; selected?: readonly DesignerSelection[]; locked?: ReadonlySet<string> } = {}) {
	let live = options.shape ?? threeBoxes();
	const writes: AssetShape[] = [];
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
		const result = edit(live);
		if (result === null) return Promise.resolve(ok('no-write'));
		if (result.ok) {
			live = result.value;
			writes.push(result.value);
		}
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	const wrapper = mount(DesignerArrangePanel, {
		props: {
			design: assetDesign({ shape: options.shape ?? threeBoxes() }),
			selected: options.selected ?? ALL,
			editShape,
			locked: options.locked ?? new Set<string>(),
		},
	});
	return {
		wrapper,
		editShape,
		writes,
		written: (): AssetShape => live,
		/** What a PEER leaf wrote between this render and the next press — the one window a withheld control cannot close. */
		advance: (next: AssetShape): void => {
			live = next;
		},
	};
}

/** One number field driven the way a user leaves it: type, then blur. */
async function commitNumber(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const field = wrapper.find(`[name="${name}"]`);
	(field.element as HTMLInputElement).value = value;
	await field.trigger('change');
	await flushPromises();
}

async function press(wrapper: VueWrapper, name: string): Promise<void> {
	await wrapper.find(`[name="${name}"]`).trigger('click');
	await flushPromises();
}

async function choose(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const control = wrapper.find(`[name="${name}"]`);
	(control.element as HTMLSelectElement).value = value;
	await control.trigger('change');
}

async function type(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	await wrapper.find(`[name="${name}"]`).setValue(value);
}

const names = (wrapper: VueWrapper): (string | undefined)[] => wrapper.findAll('button').map((button) => button.attributes('name'));

const boxOf = (shape: AssetShape, id: string) => expectOk(detailBox(requireDetail(shape, id)));
const leftOf = (shape: AssetShape, id: string): number => boxOf(shape, id).min.x;

describe('what the block draws', () => {
	it('draws nothing at all while no graphic is selected', () => {
		const { wrapper } = mountPanel({ selected: [{ kind: 'footprint' }] });
		expect(wrapper.find('.rp-designer-arrange').exists()).toBe(false);
	});

	it('offers repeat but neither grouping nor aligning for one graphic', () => {
		const { wrapper } = mountPanel({ selected: [graphic('detail-1')] });
		expect(names(wrapper)).toEqual(['repeat-run']);
	});

	it('offers grouping and the six alignments at two graphics, and no distribution', () => {
		const { wrapper } = mountPanel({ selected: [graphic('detail-1'), graphic('detail-2')] });
		expect(names(wrapper)).toEqual([
			'group',
			'align-left',
			'align-centre-x',
			'align-right',
			'align-top',
			'align-centre-y',
			'align-bottom',
			'repeat-run',
		]);
	});

	it('offers the four distributions only at three, naming centres and gaps in the labels', () => {
		const { wrapper } = mountPanel();
		expect(names(wrapper)).toContain('distribute-centres-x');
		expect(names(wrapper)).toContain('distribute-gaps-y');
		expect(wrapper.find('[name="distribute-gaps-x"]').text()).toBe(t('en', 'designer.arrange.distribute.gaps-x'));
	});

	/**
	 * **Group is offered only where grouping could SUCCEED.** Two graphics already in one group can
	 * only answer `overlapping-groups`, and a button whose one outcome is a refusal is the live
	 * control that does nothing this panel's own header refuses (contract C12).
	 */
	it('withholds Group where every selected graphic is already in a group', () => {
		const { wrapper } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-1'), graphic('detail-2')] });
		expect(names(wrapper)).not.toContain('group');
	});

	it('withholds Group where only ONE of the selected graphics is already in a group', () => {
		const { wrapper } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-1'), graphic('detail-3')] });
		expect(names(wrapper)).not.toContain('group');
	});

	it('offers Group where none of them is', () => {
		const { wrapper } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-3'), graphic('detail-1')] });
		expect(names(wrapper)).not.toContain('group');
		expect(names(mountPanel({ selected: [graphic('detail-1'), graphic('detail-3')] }).wrapper)).toContain('group');
	});

	it('offers a group’s two ordering actions only where the focused graphic is in one', () => {
		const { wrapper } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-2')] });
		expect(names(wrapper)).toEqual(['ungroup', 'group-front', 'group-back', 'repeat-run']);
	});

	it('names the focused part in the key-object option, so the choice says which part stays put', () => {
		const { wrapper } = mountPanel({ selected: [graphic('detail-1'), graphic('detail-3')] });
		const options = wrapper.findAll('[name="align-reference"] option').map((option) => option.text());
		expect(options).toEqual([t('en', 'designer.arrange.reference.bounds'), t('en', 'designer.arrange.reference.key', { name: 'detail-3' })]);
	});
});

describe('grouping', () => {
	it('writes one group over the selected graphics in canonical order, with one dispatch', async () => {
		const { wrapper, editShape, written } = mountPanel({ selected: [graphic('detail-3'), graphic('detail-1')] });
		await press(wrapper, 'group');
		expect(editShape).toHaveBeenCalledTimes(1);
		expect(written().groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-3'] }]);
	});

	it('leaves every coordinate and the drawing order exactly as they were', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before });
		await press(wrapper, 'group');
		expect(written().details).toEqual(before.details);
	});

	it('takes a group apart again', async () => {
		const { wrapper, written } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-1')] });
		await press(wrapper, 'ungroup');
		expect(written().groups).toEqual([]);
	});

	/**
	 * BOTH ends, because `to` is a hand-written literal per action rather than generated from the
	 * array that builds the edit — so a swapped `'front'`/`'back'` is a defect only a case that
	 * presses each of them can see.
	 */
	it.each([
		['group-front', ['detail-2', 'detail-1', 'detail-3']],
		['group-back', ['detail-1', 'detail-3', 'detail-2']],
	] as const)('moves a noncontiguous group with %s, as a block', async (name, order) => {
		const { wrapper, written } = mountPanel({ shape: grouped(['detail-1', 'detail-3']), selected: [graphic('detail-3')] });
		await press(wrapper, name);
		expect(graphicIds(written())).toEqual(order);
	});

	/**
	 * **`overlapping-groups` is reachable from this panel through exactly one window**, now that the
	 * button is withheld for a selection already grouped: the shape a step is handed is read when the
	 * step RUNS, so a peer leaf that grouped these parts since this render is a press whose button was
	 * drawn correctly and whose edit is refused all the same. That is why the copy for this code stays
	 * in the locale table rather than going with the button.
	 */
	it('shows the refusal when the shape gained the group between the draw and the press', async () => {
		const { wrapper, written, advance } = mountPanel({ selected: [graphic('detail-1'), graphic('detail-2')] });
		advance(grouped(['detail-1', 'detail-2']));
		await press(wrapper, 'group');
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.overlapping-groups'));
		expect(written().groups).toHaveLength(1);
	});
});

describe('aligning', () => {
	it('brings every selected graphic onto the selection bounds', async () => {
		const { wrapper, written } = mountPanel();
		await press(wrapper, 'align-left');
		for (const id of ['detail-1', 'detail-2', 'detail-3']) expect(leftOf(written(), id)).toBeCloseTo(-50, 9);
	});

	/** The key object is the FOCUSED part — the last selected — and choosing it must leave it put. */
	it('holds the chosen key object still when the reference is switched to it', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before, selected: [graphic('detail-1'), graphic('detail-3'), graphic('detail-2')] });
		await choose(wrapper, 'align-reference', 'key');
		await press(wrapper, 'align-left');
		expect(written().details.find((detail) => detail.id === 'detail-2')).toEqual(before.details.find((detail) => detail.id === 'detail-2'));
		expect(leftOf(written(), 'detail-1')).toBeCloseTo(200, 9);
	});

	it('distributes the interior and leaves the endpoints untouched', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before });
		await press(wrapper, 'distribute-centres-x');
		expect(leftOf(written(), 'detail-2')).toBeCloseTo(250, 9);
		expect(written().details.find((detail) => detail.id === 'detail-1')).toEqual(before.details.find((detail) => detail.id === 'detail-1'));
	});
});

describe('a locked participant', () => {
	/**
	 * The lock is leaf-local UI state; this panel hands it to the domain as `immovable` and the
	 * WHOLE operation refuses. Watched failing against a panel that passed no locks at all, which is
	 * exactly the state the integration request below this task leaves the product in until the
	 * root binds `runtime.partView`.
	 */
	it('refuses the arrangement and writes nothing', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before, locked: new Set(['detail-2']) });
		await press(wrapper, 'align-left');
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.locked-part'));
		expect(written()).toEqual(before);
	});
});

describe('moving, rotating and scaling the set', () => {
	it('moves every selected graphic and puts the field back to zero', async () => {
		const { wrapper, written } = mountPanel();
		const field = wrapper.find('[name="set-move-x"]');
		(field.element as HTMLInputElement).value = '25';
		await field.trigger('change');
		await flushPromises();
		expect(leftOf(written(), 'detail-1')).toBeCloseTo(-25, 9);
		expect((field.element as HTMLInputElement).value).toBe('0');
	});

	it('puts the scale field back to one, since a factor of one is the resting state', async () => {
		const { wrapper, written } = mountPanel();
		const field = wrapper.find('[name="set-scale-by"]');
		(field.element as HTMLInputElement).value = '2';
		await field.trigger('change');
		await flushPromises();
		expect((field.element as HTMLInputElement).value).toBe('1');
		// The set scales about the centre of its shared box, x -50…720, so the left edge doubles away from 335.
		expect(leftOf(written(), 'detail-1')).toBeCloseTo(-435, 9);
	});

	/**
	 * **`set-move-y` is a hand-written literal too** — `{ dx: 0, dy: value }` beside `set-move-x`'s
	 * `{ dx: value, dy: 0 }` — so a swapped axis passes a suite that drives only the first of them.
	 */
	it('moves every selected graphic DOWN from the y field, not across', async () => {
		const { wrapper, written } = mountPanel();
		await commitNumber(wrapper, 'set-move-y', '25');
		expect(boxOf(written(), 'detail-1').min.y).toBeCloseTo(-25, 9);
		expect(boxOf(written(), 'detail-1').min.x).toBeCloseTo(-50, 9);
	});

	/** Degrees at the field, radians at the domain, about the centre of the shared box — all three per press. */
	it('turns the set about its shared centre, reading the field as degrees', async () => {
		const { wrapper, written } = mountPanel({ selected: [graphic('detail-1'), graphic('detail-3')] });
		await commitNumber(wrapper, 'set-rotate-by', '90');
		// The shared box of detail-1 and detail-3 is x -50 to 720, y -220 to 50, centred (335, -85), so
		// a quarter turn takes detail-1's centre from (0, 0) to (250, -420).
		const moved = boxOf(written(), 'detail-1');
		expect((moved.min.x + moved.max.x) / 2).toBeCloseTo(250, 9);
		expect((moved.min.y + moved.max.y) / 2).toBeCloseTo(-420, 9);
	});

	it('shows the refusal for a factor the domain will not take, and writes nothing', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before });
		const field = wrapper.find('[name="set-scale-by"]');
		(field.element as HTMLInputElement).value = '0';
		await field.trigger('change');
		await flushPromises();
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.invalid-scale'));
		expect(written()).toEqual(before);
	});
});

describe('repeating', () => {
	it('previews the step it will apply, and says a different one for each spacing mode', async () => {
		const { wrapper } = mountPanel({ selected: [graphic('detail-1')] });
		await type(wrapper, 'repeat-count', '3');
		await type(wrapper, 'repeat-spacing', '20');
		expect(wrapper.find('[data-rp-preview="repeat"]').text()).toBe(t('en', 'designer.arrange.repeat.preview', { count: '3', step: '20' }));
		await choose(wrapper, 'repeat-mode', 'gaps');
		// detail-1 is 100 wide, so a 20 mm gap is a 120 mm step.
		expect(wrapper.find('[data-rp-preview="repeat"]').text()).toBe(t('en', 'designer.arrange.repeat.preview', { count: '3', step: '120' }));
	});

	it('adds the copies on one press, with ids above the highest the design carried', async () => {
		const { wrapper, editShape, written } = mountPanel({ selected: [graphic('detail-1')] });
		await type(wrapper, 'repeat-count', '2');
		await type(wrapper, 'repeat-spacing', '150');
		await press(wrapper, 'repeat-run');
		expect(editShape).toHaveBeenCalledTimes(1);
		expect(written().details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3', 'detail-4', 'detail-5']);
		expect(leftOf(written(), 'detail-4')).toBeCloseTo(100, 9);
	});

	it('shows no preview and writes nothing for a count the domain refuses', async () => {
		const before = threeBoxes();
		const { wrapper, written } = mountPanel({ shape: before, selected: [graphic('detail-1')] });
		await type(wrapper, 'repeat-count', '0');
		expect(wrapper.find('[data-rp-preview="repeat"]').exists()).toBe(false);
		await press(wrapper, 'repeat-run');
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.repeat-count-out-of-range'));
		expect(written()).toEqual(before);
	});
});

describe('mounted by the inspector it actually ships in', () => {
	it('draws the composition block for a selected graphic and reaches the same editShape', async () => {
		const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
			const result = edit(threeBoxes());
			return Promise.resolve(result === null || result.ok ? ok('wrote') : err(result.error));
		});
		const wrapper = mount(DesignerInspector, {
			props: {
				design: assetDesign({ shape: threeBoxes() }),
				setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
				editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				startFromPreset: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				logger: recorder,
				// Required, and never pressed here: this case is about the arrange block.
				removeBackground: async (): Promise<void> => {},
				selection: graphic('detail-2'),
				// No locks in this case; the prop is required so that saying so is not optional.
				lockedGraphics: new Set<string>(),
				editShape,
				select: vi.fn<(next: DesignerSelection | null) => void>(),
				selected: [graphic('detail-1'), graphic('detail-2')],
			},
		});
		expect(wrapper.find('.rp-designer-arrange').exists()).toBe(true);
		await press(wrapper, 'align-left');
		expect(editShape).toHaveBeenCalledTimes(1);
	});
});

describe('a gesture that would change nothing writes nothing (contract C05)', () => {
	/**
	 * **One completed gesture is one history entry; a no-op gesture is none.** Every case here was
	 * watched failing against the candidate, which dispatched a whole `SetAssetShape` per press:
	 * `SetAssetShapeCommand` compares nothing by design, so the cost was one sidecar revision and one
	 * undo entry whose Ctrl+Z appears to do nothing.
	 *
	 * Asserted on `writes` rather than on the shape, deliberately: the shape after two presses is
	 * right either way, and the second write is the defect.
	 */
	it('writes once for two presses of the same alignment', async () => {
		const { wrapper, writes } = mountPanel();
		await press(wrapper, 'align-left');
		await press(wrapper, 'align-left');
		expect(writes).toHaveLength(1);
	});

	it('writes once for two presses of the same distribution', async () => {
		const { wrapper, writes } = mountPanel();
		await press(wrapper, 'distribute-centres-x');
		await press(wrapper, 'distribute-centres-x');
		expect(writes).toHaveLength(1);
	});

	it('writes nothing bringing a group to the front it is already at', async () => {
		const { wrapper, writes } = mountPanel({ shape: grouped(['detail-2', 'detail-3']), selected: [graphic('detail-3')] });
		await press(wrapper, 'group-front');
		expect(writes).toHaveLength(0);
	});

	/**
	 * The resting value of a by-field IS its displayed value, so committing it is one blur away at all
	 * times — which is why this one is caught at the field rather than in the domain: a rotation of
	 * zero produces fresh coordinate objects that are equal and not identical.
	 */
	it.each([['set-move-x', '0'], ['set-move-y', '0'], ['set-rotate-by', '0'], ['set-scale-by', '1']])(
		'writes nothing for %s left at its resting value',
		async (name, resting) => {
			const { wrapper, editShape, writes } = mountPanel();
			await commitNumber(wrapper, name, resting);
			expect(writes).toHaveLength(0);
			expect(editShape).not.toHaveBeenCalled();
		},
	);
});

describe('the refusal alert', () => {
	/** A refusal is about the selection that caused it; a new selection must not inherit it. */
	it('clears when the selection changes', async () => {
		const { wrapper } = mountPanel({ locked: new Set(['detail-2']) });
		await press(wrapper, 'align-left');
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);

		await wrapper.setProps({ selected: [graphic('detail-1'), graphic('detail-3')] });
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});
});

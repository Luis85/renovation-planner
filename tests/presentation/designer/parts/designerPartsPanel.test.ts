/**
 * @vitest-environment jsdom
 *
 * AD09's Parts panel, mounted bare over a real `createPartView()` and a fake `editShape` that
 * applies the edit it is handed to a live shape — `designerSelectionInspector.test.ts`'s own rig,
 * so every case asserts the SHAPE a control would write rather than which function it named.
 *
 * The panel takes everything as props and holds no store, which is what lets this file mount it
 * without Pinia, without a dialog host and without a canvas. Its wiring into the real designer —
 * that the region exists and the component is reachable — is `assetDesignerRoot.test.ts` and
 * `regionsReachable.test.ts`, because a component proven bare and bound to nothing is the slice-7
 * shape this repository refuses.
 *
 * The fixture is `editableShape()`: `detail-1` ("top", solid, measured) and `detail-2` ("bowl",
 * dashed, pending), a clearance, an anchor and a facing, with a background picked — so the list is
 * bowl, top, footprint, clearance, anchor, facing, reference sheet.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { ref, type Ref } from 'vue';
import DesignerPartsPanel from '../../../../src/presentation/designer/parts/DesignerPartsPanel.vue';
import { ok, type Result } from '../../../../src/core/result/Result';
import type { ValidationError } from '../../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { validateAssetShape, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { detailOutlines } from '../../../../src/presentation/designer/layers/detailsLayer';
import { createPartView } from '../../../../src/presentation/designer/parts/partView';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../../src/presentation/i18n/strings';
import { assetDesign } from '../../../helpers/assetDesign';
import { editableShape } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';
import { resolveThemeTokens } from '../../../../src/presentation/editor/theme/themeTokens';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

function mountPanel(
	options: { shape?: AssetShape | null; selected?: readonly DesignerSelection[]; mode?: Ref<boolean> } = {},
) {
	const shape = options.shape === undefined ? editableShape() : options.shape;
	let live = shape;
	const applied: AssetShape[] = [];
	const editShape = vi.fn<(edit: ShapeEdit) => Promise<DispatchResult>>((edit) => {
		const result = edit(live as AssetShape);
		// `null` is the real `editShape`'s nothing-to-do; no case here hands it one.
		if (result?.ok) {
			live = result.value;
			applied.push(result.value);
		}
		return Promise.resolve(ok('wrote'));
	});
	const select = vi.fn<(next: DesignerSelection | null) => void>();
	const view = createPartView();
	const wrapper = mount(DesignerPartsPanel, {
		props: {
			design: assetDesign({ shape }),
			selected: options.selected ?? [],
			select,
			editShape,
			view,
			// The selection keys' store and gate. No case here presses one — `designerPartShortcuts.test.ts`
			// drives them in the real root, and `designerGroupFromRest.test.ts` the rows' Shift press that
			// reaches `extend` — so these only satisfy the props.
			selectionStore: { selected: options.selected ?? [], selection: null, select, focus: vi.fn<(next: DesignerSelection) => void>(), extend: vi.fn<(next: DesignerSelection) => void>() },
			tools: { activeToolId: { value: 'select' }, toolManager: { activeToolHasDraft: () => false } },
			// A value down and a setter up, exactly as `DesignerInspector` took it before AD18-R16
			// Task 7 moved the control here: `v-model` on a prop is a mutation of one, which
			// `vue/no-mutating-props` refuses.
			...(options.mode === undefined
				? {}
				: {
						multiSelectionMode: options.mode.value,
						setMultiSelectionMode: (next: boolean): void => {
							if (options.mode !== undefined) options.mode.value = next;
						},
					}),
		},
		attachTo: document.body,
	});
	return { wrapper, select, editShape, applied, view, shape, latest: (): AssetShape => live as AssetShape };
}

/** A single-graphic shape: what makes composing a set of two impossible (AD08). */
const oneDetail = (): AssetShape => expectOk(validateAssetShape({ ...editableShape(), details: editableShape().details.slice(0, 1) }));

/** jsdom resolves no CSS, so every token comes back as the same empty string — which is all these cases need: they compare one reading against another. */
const TOKENS = resolveThemeTokens(document.documentElement);

const grouped = (): AssetShape =>
	expectOk(validateAssetShape({ ...editableShape(), groups: [{ id: 'group-1', label: 'Cistern', members: ['detail-1'] }] }));

const rowNames = (wrapper: VueWrapper): string[] => wrapper.findAll('.rp-designer-part-row').map((row) => row.text());

/** The row that names one part, by the `name` attribute `partRows` keys it with. */
const rowFor = (wrapper: VueWrapper, key: string) => wrapper.find(`[name="${key}"]`);

async function choose(wrapper: VueWrapper, key: string): Promise<void> {
	await rowFor(wrapper, key).trigger('click');
}

describe('the Parts panel', () => {
	it('lists every part of the object, topmost graphic first', () => {
		const { wrapper } = mountPanel();

		expect(rowNames(wrapper)).toEqual([
			t('en', 'designer.detail.bowl'),
			'top',
			t('en', 'designer.selection.footprint'),
			t('en', 'designer.selection.clearance'),
			t('en', 'designer.selection.anchor'),
			t('en', 'designer.selection.facing'),
		]);
		expect(wrapper.find('.rp-designer-part-static').text()).toBe(t('en', 'designer.parts.reference'));
	});

	it('says so, once, when the asset has no shape to list parts of', () => {
		const { wrapper } = mountPanel({ shape: null });

		expect(wrapper.find('.rp-designer-parts-empty').text()).toBe(t('en', 'designer.parts.empty'));
		expect(wrapper.findAll('.rp-designer-part-row')).toHaveLength(0);
	});

	/**
	 * Criterion 5: a part is a piece of ONE symbol and never a procurement unit. The panel is handed
	 * an `AssetDesignDto`, which carries no price, no quantity and no unit at all — so the check is
	 * that each row says the part's NAME and nothing beside it, rather than a rule about words this
	 * panel must avoid.
	 */
	it('says a part’s name and nothing else — no count, no unit, no price', () => {
		const { wrapper } = mountPanel();

		expect(rowNames(wrapper)).toEqual(rowNames(wrapper).map((name) => name.trim()));
		expect(wrapper.text()).not.toMatch(/\d/u);
	});

	describe('selection', () => {
		/** Criterion 1, the first direction: a row press is the same `select` a canvas press makes. */
		it('selects the part its row names', async () => {
			const { wrapper, select } = mountPanel();

			await choose(wrapper, 'detail:detail-2');

			expect(select).toHaveBeenCalledWith(BOWL);
		});

		/** Criterion 1, the other direction: what the canvas selected is what the panel shows as pressed. */
		it('marks the row of every part the canvas has selected', () => {
			const { wrapper } = mountPanel({ selected: [{ kind: 'footprint' }, BOWL] });

			expect(
				wrapper.findAll('.rp-designer-part-row').filter((row) => row.attributes('aria-pressed') === 'true').map((row) => row.attributes('name')),
			).toEqual(['detail:detail-2', 'footprint']);
		});

		it('opens the graphic’s own controls under the selected row, and nowhere else', () => {
			const { wrapper } = mountPanel({ selected: [BOWL] });

			expect(wrapper.findAll('.rp-designer-part-controls')).toHaveLength(1);
			expect(wrapper.find('[name="part-label"]').exists()).toBe(true);
		});

		/**
		 * The four special parts have no label, no visibility and no order of their own, so their rows
		 * carry no controls — a control that did nothing is the one this repository refuses everywhere.
		 */
		it('opens no controls for the footprint, which is not a graphic', () => {
			const { wrapper } = mountPanel({ selected: [{ kind: 'footprint' }] });

			expect(wrapper.findAll('.rp-designer-part-controls')).toHaveLength(0);
		});
	});

	describe('rename', () => {
		/** Criterion 2's first half: the user's words go to `label`, and the semantic key is untouched. */
		it('writes a user label and leaves the semantic name alone', async () => {
			const { wrapper, applied } = mountPanel({ selected: [BOWL] });

			const field = wrapper.find('[name="part-label"]');
			(field.element as HTMLInputElement).value = 'Pan';
			await field.trigger('change');
			await flushPromises();

			expect(applied).toHaveLength(1);
			expect(applied[0].details[1]).toMatchObject({ id: 'detail-2', name: 'bowl', label: 'Pan' });
		});

		it('shows the user’s label on the row once it is written, in place of the semantic name', () => {
			const labelled = expectOk(
				validateAssetShape({ ...editableShape(), details: editableShape().details.map((detail) => ({ ...detail, label: 'Pan' })) }),
			);
			const { wrapper } = mountPanel({ shape: labelled });

			expect(rowNames(wrapper)[0]).toBe('Pan');
		});

		/**
		 * Criterion 5 of the card's own list: focus survives a rename. The row's key is its part key, so
		 * the field is the same element across the re-render the write causes — which is exactly what a
		 * list keyed by index would have broken silently.
		 */
		it('keeps focus in the field the rename was typed into', async () => {
			const { wrapper } = mountPanel({ selected: [BOWL] });

			const field = wrapper.find('[name="part-label"]');
			(field.element as HTMLInputElement).focus();
			(field.element as HTMLInputElement).value = 'Pan';
			await field.trigger('change');
			await flushPromises();

			expect(document.activeElement).toBe(field.element);
		});
	});

	describe('visibility and locks', () => {
		/**
		 * Criterion 3. Hiding is an editing aid: it writes nothing, so the stored shape — and with it
		 * plan placement, the library mark and every quantity derived from the asset — is untouched.
		 */
		it('hides a graphic without writing anything or changing the shape', async () => {
			const { wrapper, editShape, view, shape, latest } = mountPanel({ selected: [BOWL] });

			await wrapper.find('[name="toggle-hidden"]').trigger('click');

			expect(editShape).not.toHaveBeenCalled();
			expect(latest()).toEqual(shape);
			expect([...view.hidden.value]).toEqual(['detail-2']);
		});

		/** Criterion 4: a hidden graphic is still listed, still says it is hidden, and its row offers the way back. */
		it('keeps a hidden graphic in the list, marked, with Show on its own row', async () => {
			const { wrapper } = mountPanel({ selected: [BOWL] });

			await wrapper.find('[name="toggle-hidden"]').trigger('click');

			expect(rowFor(wrapper, 'detail:detail-2').text()).toContain(t('en', 'designer.parts.hidden'));
			expect(wrapper.find('[name="toggle-hidden"]').attributes('aria-label')).toBe(t('en', 'designer.parts.show'));
		});

		it('offers Show all only once something is hidden, and clears everything when pressed', async () => {
			const { wrapper, view } = mountPanel({ selected: [BOWL] });

			expect(wrapper.find('.rp-designer-parts-show-all').exists()).toBe(false);
			await wrapper.find('[name="isolate"]').trigger('click');
			expect([...view.hidden.value]).toEqual(['detail-1']);

			await wrapper.find('.rp-designer-parts-show-all').trigger('click');

			expect(view.hidden.value.size).toBe(0);
			expect(wrapper.find('.rp-designer-parts-show-all').exists()).toBe(false);
		});

		it('locks a graphic, marks its row and offers Unlock, writing nothing', async () => {
			const { wrapper, editShape, view } = mountPanel({ selected: [BOWL] });

			await wrapper.find('[name="toggle-locked"]').trigger('click');

			expect([...view.locked.value]).toEqual(['detail-2']);
			expect(rowFor(wrapper, 'detail:detail-2').text()).toContain(t('en', 'designer.parts.locked'));
			expect(wrapper.find('[name="toggle-locked"]').attributes('aria-label')).toBe(t('en', 'designer.parts.unlock'));
			expect(editShape).not.toHaveBeenCalled();
		});
	});

	describe('order', () => {
		it('moves a graphic one step through the drawing order, and its row with it', async () => {
			const { wrapper, applied } = mountPanel({ selected: [{ kind: 'detail', id: 'detail-1' }] });

			await wrapper.find('[name="bring-forward"]').trigger('click');
			await flushPromises();

			expect(applied[0].details.map((detail) => detail.id)).toEqual(['detail-2', 'detail-1']);
		});

		it('sends a graphic one step back, which is the other direction and its own write', async () => {
			const { wrapper, applied } = mountPanel({ selected: [BOWL] });

			await wrapper.find('[name="send-backward"]').trigger('click');
			await flushPromises();

			expect(applied[0].details.map((detail) => detail.id)).toEqual(['detail-2', 'detail-1']);
		});

		/**
		 * `aria-disabled` and a press that runs nothing, never `:disabled` — pressing the button until
		 * the graphic is at the end would otherwise disable the control holding focus, and Chromium
		 * drops focus to `<body>` (the selection inspector's own recorded finding 11).
		 */
		it('marks Bring forward disabled on the topmost graphic and runs nothing when it is pressed', async () => {
			const { wrapper, editShape } = mountPanel({ selected: [BOWL] });

			const forward = wrapper.find('[name="bring-forward"]');
			expect(forward.attributes('aria-disabled')).toBe('true');
			expect(forward.attributes('disabled')).toBeUndefined();

			await forward.trigger('click');

			expect(editShape).not.toHaveBeenCalled();
		});
	});

	describe('groups', () => {
		it('heads its members with a disclosure that says whether it is open', () => {
			const { wrapper } = mountPanel({ shape: grouped() });

			expect(wrapper.find('.rp-designer-part-group').attributes('aria-expanded')).toBe('true');
			expect(wrapper.find('.rp-designer-part-group').text()).toBe('Cistern');
		});

		/**
		 * Criterion 6. Collapsing a group changes the LIST and nothing else: no write, and the very
		 * same Konva configs — one per graphic, in the same order — come off the same shape. A group is
		 * editing metadata, never a second rendering order or a layer per row (C06).
		 */
		it('keeps every row outside the group when it is collapsed', async () => {
			const { wrapper } = mountPanel({ shape: grouped() });

			await wrapper.find('.rp-designer-part-group').trigger('click');

			expect(rowNames(wrapper)).toEqual([
				t('en', 'designer.detail.bowl'),
				t('en', 'designer.selection.footprint'),
				t('en', 'designer.selection.clearance'),
				t('en', 'designer.selection.anchor'),
				t('en', 'designer.selection.facing'),
			]);
		});

		it('folds its members away without writing anything or changing what the canvas draws', async () => {
			const { wrapper, editShape, shape } = mountPanel({ shape: grouped() });
			const before = detailOutlines(shape, TOKENS, 1);

			await wrapper.find('.rp-designer-part-group').trigger('click');

			expect(rowNames(wrapper)).not.toContain('top');
			expect(wrapper.find('.rp-designer-part-group').attributes('aria-expanded')).toBe('false');
			expect(editShape).not.toHaveBeenCalled();
			expect(detailOutlines(shape, TOKENS, 1)).toEqual(before);
		});
	});

	describe('the keyboard', () => {
		/**
		 * Where the ONE tab stop sits when nothing has been focused yet: on the first SELECTED row, so
		 * a keyboard user entering the panel lands on the part they are working on rather than at the
		 * top of the list. With no selection either, it falls to the first row.
		 */
		it('puts the tab stop on a selected row before anything has been focused', () => {
			const { wrapper } = mountPanel({ selected: [{ kind: 'anchor' }] });

			expect(rowFor(wrapper, 'anchor').attributes('tabindex')).toBe('0');
			expect(rowFor(wrapper, 'detail:detail-2').attributes('tabindex')).toBe('-1');
		});

		it('falls to the first row when nothing is selected', () => {
			const { wrapper } = mountPanel();

			expect(rowFor(wrapper, 'detail:detail-2').attributes('tabindex')).toBe('0');
		});

		/** The list is ONE tab stop: exactly one row is reachable by Tab, and the arrows move between them. */
		it('gives the list a single tab stop', () => {
			const { wrapper } = mountPanel();

			expect(wrapper.findAll('.rp-designer-part-row').filter((row) => row.attributes('tabindex') === '0')).toHaveLength(1);
		});

		it('moves focus down the list with the down arrow, and the tab stop with it', async () => {
			const { wrapper } = mountPanel();

			await wrapper.find('.rp-designer-part-list').trigger('keydown', { key: 'ArrowDown' });

			expect(document.activeElement).toBe(rowFor(wrapper, 'detail:detail-1').element);
			expect(rowFor(wrapper, 'detail:detail-1').attributes('tabindex')).toBe('0');
		});

		/**
		 * The card's criterion 5: focus survives a REMOVAL. The panel remembers the row that last had
		 * focus by KEY, and a key naming a graphic the inspector has since deleted names no row — so
		 * the tab stop falls back rather than leaving the list with none, which is a list a keyboard
		 * cannot re-enter at all.
		 */
		it('keeps a tab stop when the row that had focus is deleted from under it', async () => {
			const { wrapper } = mountPanel();

			await wrapper.find('.rp-designer-part-list').trigger('keydown', { key: 'ArrowDown' });
			expect(rowFor(wrapper, 'detail:detail-1').attributes('tabindex')).toBe('0');

			const base = editableShape();
			await wrapper.setProps({ design: assetDesign({ shape: expectOk(validateAssetShape({ ...base, details: [base.details[1]] })) }) });

			expect(rowFor(wrapper, 'detail:detail-1').exists()).toBe(false);
			expect(wrapper.findAll('.rp-designer-part-row').filter((row) => row.attributes('tabindex') === '0')).toHaveLength(1);
		});

		it('moves focus back up the list with the up arrow', async () => {
			const { wrapper } = mountPanel();
			const list = wrapper.find('.rp-designer-part-list');

			await list.trigger('keydown', { key: 'ArrowDown' });
			await list.trigger('keydown', { key: 'ArrowDown' });
			expect(document.activeElement).toBe(rowFor(wrapper, 'footprint').element);

			await list.trigger('keydown', { key: 'ArrowUp' });

			expect(document.activeElement).toBe(rowFor(wrapper, 'detail:detail-1').element);
		});

		/** Neither end runs off: the arrows clamp rather than wrapping, which is the list pattern's own rule. */
		it('stops at the ends rather than wrapping round', async () => {
			const { wrapper } = mountPanel();
			const list = wrapper.find('.rp-designer-part-list');

			await list.trigger('keydown', { key: 'ArrowUp' });
			expect(document.activeElement).toBe(rowFor(wrapper, 'detail:detail-2').element);

			await list.trigger('keydown', { key: 'End' });
			await list.trigger('keydown', { key: 'ArrowDown' });
			expect(document.activeElement).toBe(rowFor(wrapper, 'facing').element);
		});

		it('jumps to the last row with End and back to the first with Home', async () => {
			const { wrapper } = mountPanel();
			const list = wrapper.find('.rp-designer-part-list');

			await list.trigger('keydown', { key: 'End' });
			expect(document.activeElement).toBe(rowFor(wrapper, 'facing').element);

			await list.trigger('keydown', { key: 'Home' });
			expect(document.activeElement).toBe(rowFor(wrapper, 'detail:detail-2').element);
		});

		/**
		 * A key this list does not own moves nothing and, crucially, is not `preventDefault`ed — the
		 * rename field lives inside this panel, and swallowing every keystroke over the list would make
		 * it unusable.
		 */
		it('leaves a key it does not own alone', async () => {
			const { wrapper } = mountPanel();
			const focused = document.activeElement;
			const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });

			wrapper.find('.rp-designer-part-list').element.dispatchEvent(event);
			await flushPromises();

			expect(event.defaultPrevented).toBe(false);
			expect(document.activeElement).toBe(focused);
		});
	});
});

/**
 * AD08 / C05: the control that lets a keyboard or a touch user build a selection without a
 * modifier — moved here from the Inspector's Asset block at AD18-R16 Task 7, since it is a
 * selection affordance rather than an asset fact and AD08-R1 already blesses this panel as C05's
 * accessible alternative to an overlap chooser. `designerInspector.test.ts` owned these cases
 * before this task; they are moved rather than copied, because a case left behind asserting the
 * Inspector still draws this control would be the second answer to "how do I select more than
 * one part" the move exists to prevent.
 */
describe('select multiple parts', () => {
	it('sits under the panel’s own heading, before the part list', () => {
		const { wrapper } = mountPanel({ mode: ref(false) });
		const heading = wrapper.get('h2');
		const control = wrapper.get('.rp-designer-multi-select');
		const list = wrapper.get('.rp-designer-part-list');

		expect(Boolean(heading.element.compareDocumentPosition(control.element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
		expect(Boolean(control.element.compareDocumentPosition(list.element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
	});

	it('offers the control where the design has more than one graphic', () => {
		const { wrapper } = mountPanel({ mode: ref(false) });
		expect(wrapper.find('[data-rp-action="multiple-selection"]').exists()).toBe(true);
	});

	it('turns the mode on through the control, so a canvas press extends rather than replaces', async () => {
		const mode = ref(false);
		const { wrapper } = mountPanel({ mode });
		await wrapper.find('[data-rp-action="multiple-selection"]').setValue(true);
		expect(mode.value).toBe(true);
	});

	/** Slice 14's Amendment 1 again: no runtime bound, no control. */
	it('draws no control where no mode is bound', () => {
		expect(mountPanel().wrapper.find('[data-rp-action="multiple-selection"]').exists()).toBe(false);
	});

	/** Nor where there is nothing to compose: one graphic cannot be part of a set of two. */
	it('draws no control for a design with one graphic, until the mode is already on', () => {
		expect(mountPanel({ shape: oneDetail(), mode: ref(false) }).wrapper.find('[data-rp-action="multiple-selection"]').exists()).toBe(false);
		expect(mountPanel({ shape: oneDetail(), mode: ref(true) }).wrapper.find('[data-rp-action="multiple-selection"]').exists()).toBe(true);
	});
});

/**
 * The selection keys' focus hand-off (AD18-R17 Task 3). A refresh reads back whatever else changed
 * meanwhile, so a write can remove more than the row a key was pressed on — here the row below it
 * too. Focus goes to the nearest row still drawn, and never to a row that is not there.
 */
describe('the selection keys', () => {
	it('hands dropped focus to the nearest row still drawn when the row below went as well', async () => {
		const { wrapper } = mountPanel({ selected: [BOWL] });
		const bowl = rowFor(wrapper, 'detail:detail-2').element as HTMLElement;
		bowl.focus();
		bowl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
		await wrapper.setProps({ design: assetDesign({ shape: expectOk(validateAssetShape({ ...editableShape(), details: [] })) }) });
		await flushPromises();

		expect(document.activeElement).toBe(rowFor(wrapper, 'footprint').element);
		expect(rowFor(wrapper, 'footprint').attributes('tabindex')).toBe('0');
		wrapper.unmount();
	});
});

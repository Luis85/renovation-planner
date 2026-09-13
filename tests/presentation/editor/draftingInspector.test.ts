// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { BOUNDARY_A, DIMENSION_A, GRID_A, SECTION_A, TEXT_A } from '../../helpers/drafting';
import { dimensionEdit, dimensionText } from '../../../src/presentation/editor/elements/dimensionInput';
import { elementLength } from '../../../src/domain/spatial/SpatialElement';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('proposes a new offset for unchanged points, keeps the stored millimetres behind an untouched field, and refuses unreadable text', () => {
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
	expect(dimensionEdit(points, -612.4, dimensionText(-612.4, 'Front')).edit).toEqual({ name: 'Front', points, offset: -612.4 });
	expect(dimensionEdit(points, -600, { name: 'Front', offset: '0,25' }).edit).toEqual({ name: 'Front', points, offset: 250 });
	expect(dimensionEdit(points, -600, { name: 'Front', offset: 'x' })).toEqual({ edit: null, invalid: true });
	expect(dimensionEdit(points, -600, { name: ' ', offset: '1' }).edit).toBeNull();
});

it('flips a section line from its Inspector through undoable history', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await settle();
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('Section line');
	await rig.wrapper.get('[data-rp-action="flip-section"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0].flipped === true, 'flipped');
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.[0].flipped).toBe(false);
});

it('edits a dimension chain\'s offset and keeps its points', async () => {
	const rig = await editorWith(mounted, DIMENSION_A);
	rig.selection.select([DIMENSION_A.id as never]); await settle();
	const editing = rig.runtime.elementActions.edit(DIMENSION_A.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="dimension-edit"]');
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input[name="dimension-offset"]').setValue('-0,8');
	await form.trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ offset: -800, points: DIMENSION_A.points });
});

it('shows no length line for a text or a grid point, a length for a boundary line, and no renovation entry for any of them', async () => {
	const rig = await editorWith(mounted, TEXT_A, GRID_A, BOUNDARY_A);
	for (const item of [TEXT_A, GRID_A]) {
		rig.selection.select([item.id as never]); await settle();
		const inspector = rig.wrapper.get('.rp-element-inspector');
		expect(inspector.findAll('.rp-inspector-subline')).toHaveLength(1);
		expect(inspector.find('.rp-structure-renovation-entry').exists()).toBe(false);
	}
	rig.selection.select([BOUNDARY_A.id as never]); await settle();
	const inspector = rig.wrapper.get('.rp-element-inspector');
	expect(inspector.text()).toContain(`${formatMetres(elementLength(BOUNDARY_A))} m`);
	expect(inspector.find('.rp-structure-renovation-entry').exists()).toBe(false);
});

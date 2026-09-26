import { describe, expect, it } from 'vitest';
import { rowName, semanticLabel } from '../../../../src/presentation/designer/parts/partNames';
import { partRows } from '../../../../src/presentation/designer/parts/partRows';
import { validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { editableShape } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';
import { t } from '../../../../src/presentation/i18n/strings';

/** What a Parts row is called: the user's words first, the preset's semantic key as the fallback (C02). */
const rows = (shape = editableShape()): ReturnType<typeof partRows> => partRows(shape, { hasReference: true });

describe('rowName', () => {
	it('translates a semantic name the catalogue knows and prints an unknown one as stored', () => {
		expect(semanticLabel('bowl')).toBe(t('en', 'designer.detail.bowl'));
		expect(semanticLabel('gusset')).toBe('gusset');
	});

	it('prefers a graphic’s user label over its semantic name, without changing the name', () => {
		const labelled = expectOk(
			validateAssetShape({ ...editableShape(), details: editableShape().details.map((detail) => ({ ...detail, label: `my ${detail.name}` })) }),
		);
		const [top] = rows(labelled);

		expect(rowName(top)).toBe('my bowl');
		expect(top.detail?.name).toBe('bowl');
	});

	it('names the shape’s special parts and the reference sheet by their kind', () => {
		expect(rows().slice(2).map((row) => rowName(row))).toEqual([
			t('en', 'designer.selection.footprint'),
			t('en', 'designer.selection.clearance'),
			t('en', 'designer.selection.anchor'),
			t('en', 'designer.selection.facing'),
			t('en', 'designer.parts.reference'),
		]);
	});

	it('falls back to the word Group for a group with no label of its own', () => {
		const shape = expectOk(validateAssetShape({ ...editableShape(), groups: [{ id: 'group-1', members: ['detail-1'] }] }));
		const header = rows(shape).find((row) => row.kind === 'group');

		expect(header === undefined ? '' : rowName(header)).toBe(t('en', 'designer.parts.group'));
	});
});

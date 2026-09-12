import { describe, expect, it } from 'vitest';
import { PLAN_KINDS } from '../../../src/domain/plan/PlanKind';
import { PLAN_KIND_ICONS } from '../../../src/presentation/editor/editorIcons';
import { editorIconNodes } from '../../helpers/editorIconNodes';

describe('PLAN_KIND_ICONS', () => {
	it('names one distinct harness-drawable icon per kind', () => {
		const icons = PLAN_KINDS.map((kind) => PLAN_KIND_ICONS[kind]);
		expect(new Set(icons).size).toBe(PLAN_KINDS.length);
		expect(icons.filter((icon) => editorIconNodes[icon] === undefined)).toEqual([]);
	});
});

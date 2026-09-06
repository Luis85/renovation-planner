import { describe, expect, it } from 'vitest';
import { definitionChanges, definitionDraft, validateDefinition } from '../../../src/presentation/library/definitionDraft';
import { anEntry } from '../../helpers/assetLibraryRootHarness';

/**
 * `useDefinitionDraft.test.ts` does not exist — the composable's own tests
 * (`assetInspectorFields.test.ts` and siblings) drive this module through the Vue
 * surface. This file is the direct one, for the two review findings that touch it:
 * a negative-zero numeric field (C6, the same class `Asset.ts`'s `checkWasteFraction`
 * fixes) and `definitionChanges` parsing unguarded when called without the
 * `validateDefinition` gate in front of it.
 */
describe('validateDefinition', () => {
	it('accepts a negative-zero numeric field, since decimal.js reports -0 as negative', () => {
		const draft = definitionDraft(anEntry());
		const errors = validateDefinition({ ...draft, waste: '-0' }, 'EUR');
		expect(errors.waste).toBeUndefined();
	});

	it('still refuses a genuinely negative field', () => {
		const draft = definitionDraft(anEntry());
		const errors = validateDefinition({ ...draft, waste: '-5' }, 'EUR');
		expect(errors.waste).toBeDefined();
	});
});

describe('definitionChanges', () => {
	it('diffs a changed field against the baseline', () => {
		const baseline = anEntry();
		const draft = { ...definitionDraft(baseline), name: 'Renamed plank' };
		expect(definitionChanges(draft, baseline)).toEqual({ name: 'Renamed plank' });
	});

	/**
	 * `validateDefinition` is the gate `save()` always runs first; this is the belt. A
	 * caller that skips the gate and hands in an unparseable amount must not throw a raw
	 * parse error out of a pure diffing function — it gets no changes instead.
	 */
	it('answers no changes rather than throwing, when a numeric field cannot parse', () => {
		const baseline = anEntry();
		const draft = { ...definitionDraft(baseline), unitCost: 'not a number' };
		expect(definitionChanges(draft, baseline)).toEqual({});
	});
});

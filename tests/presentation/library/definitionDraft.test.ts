import { describe, expect, it } from 'vitest';
import { definitionChanges, definitionDraft, validateDefinition } from '../../../src/presentation/library/definitionDraft';
import { anEntry } from '../../helpers/entities';

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
	 * `validateDefinition:38` trims before parsing; this line did not, so a waste of `" 5 "`
	 * against a baseline of `"5"` threw instead of diffing to no change. Fixed at the root
	 * (trim before both the comparison and the parse) rather than swallowing the throw —
	 * see the docblock above this function for why the try/catch belt is gone.
	 */
	it('answers the same no-op diff for a waste value that only differs from the baseline by whitespace', () => {
		const baseline = anEntry({ wasteFactorDefault: '0.05' });
		const draft = { ...definitionDraft(baseline), waste: ' 5 ' };
		expect(definitionChanges(draft, baseline)).toEqual({});
	});

	/** The same whitespace-only no-op, for `height` — trimmed now the same way its siblings are. */
	it('answers the same no-op diff for a height value that only differs from the baseline by whitespace', () => {
		const baseline = anEntry({ height: 5 });
		const draft = { ...definitionDraft(baseline), height: ' 5 ' };
		expect(definitionChanges(draft, baseline)).toEqual({});
	});
	it('accepts a comma decimal in price, waste and height and submits dot decimals', () => {
		const baseline = anEntry();
		const draft = { ...definitionDraft(baseline), unitCost: '4,50', waste: '12,5', height: '190,5' };
		expect(validateDefinition(draft, baseline.currency)).toEqual({});
		const changes = definitionChanges(draft, baseline);
		expect(changes.unitCost?.amount.toString()).toBe('4.5');
		expect(changes.wasteFactorDefault?.toString()).toBe('0.125');
		expect(changes.height).toBe(190.5);
	});
	it('answers the same no-op diff for a unit cost that only differs by whitespace', () => {
		const baseline = anEntry({ unitCostAmount: '12.50' });
		const draft = { ...definitionDraft(baseline), unitCost: ' 12.50 ' };
		expect(definitionChanges(draft, baseline)).toEqual({});
	});
});

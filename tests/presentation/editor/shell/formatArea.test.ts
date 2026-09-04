import { describe, expect, it } from 'vitest';
import { formatArea } from '../../../../src/presentation/editor/shell/formatArea';

/**
 * A node test rather than a mounted one: both Inspector bodies exercise this indirectly, but
 * a pure function is worth asking directly rather than only through a component that happens
 * to call it.
 */
describe('formatArea', () => {
	it('renders world millimetres² as square metres, en-US formatted', () => {
		expect(formatArea(12_000_000)).toBe('12 m²');
	});

	/**
	 * **The one thing the hoist to a module-scope `Intl.NumberFormat` could quietly break.** Its
	 * sibling `formatMetres` passes `useGrouping: false`, and it must: the field it writes into
	 * is handed back to `parseMetres`, which reads a comma as a DECIMAL separator, so a grouped
	 * `1,000` reparsed as 1000 mm was a silent 1000× shrink. Nothing reparses an AREA, so this
	 * formatter keeps `en-US` grouping — and a second constant written by copying the first
	 * one's options is exactly how that asymmetry gets lost, with no other case in the suite
	 * reaching a figure large enough to show it.
	 *
	 * Two decimals is the other half of the same copy hazard, in the other direction: three
	 * would follow `formatMetres` and print a precision an area does not have.
	 */
	it('groups thousands and stops at two decimals, unlike formatMetres', () => {
		expect(formatArea(1_234_000_000)).toBe('1,234 m²');
		expect(formatArea(15_960_000)).toBe('15.96 m²');
		expect(formatArea(15_964_999)).toBe('15.96 m²');
	});
});

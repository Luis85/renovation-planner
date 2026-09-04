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
});

import { describe, expect, it } from 'vitest';
import { CURRENCIES, DEFAULT_SETTINGS, settingsFrom } from '../../../src/plugin/settings/settings';

describe('defaultCurrency', () => {
	it('defaults to EUR on a fresh install', () => {
		expect(settingsFrom(null).defaultCurrency).toBe('EUR');
	});

	it('reads a value the vocabulary declares', () => {
		expect(settingsFrom({ defaultCurrency: 'GBP' }).defaultCurrency).toBe('GBP');
	});

	it('drops a value outside the vocabulary, like every other setting', () => {
		expect(settingsFrom({ defaultCurrency: 'JPY' }).defaultCurrency).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});

	it('drops a non-string, because data.json is a file the user can edit', () => {
		expect(settingsFrom({ defaultCurrency: 978 }).defaultCurrency).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});

	/**
	 * The list's whole reason: `round` finalizes at two decimal places, so a currency with
	 * a different minor unit would round wrong. A code added here without two minor units
	 * fails this case rather than shipping a quietly wrong total.
	 */
	it('offers only currencies with two minor units', () => {
		expect([...CURRENCIES]).toEqual(['CHF', 'EUR', 'GBP', 'USD']);
	});
});

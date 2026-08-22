import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, settingsFrom } from '../../../src/plugin/settings/settings';

/**
 * Pure merges, asked of the function: every shape `loadData` can hand back — a fresh
 * install's null, a stored partial, junk — resolves to a complete settings object.
 */
describe('resolving settings from stored data', () => {
	it('answers the defaults on a fresh install', () => {
		expect(settingsFrom(null)).toEqual(DEFAULT_SETTINGS);
		expect(settingsFrom(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps a stored choice over the default', () => {
		expect(settingsFrom({ units: 'imperial' })).toEqual({ units: 'imperial' });
	});

	it('fills what the stored object does not say', () => {
		expect(settingsFrom({})).toEqual(DEFAULT_SETTINGS);
	});

	// data.json is user-editable, so "junk" is a shape, not a hypothesis.
	it('answers the defaults for junk', () => {
		expect(settingsFrom('not an object')).toEqual(DEFAULT_SETTINGS);
		expect(settingsFrom(42)).toEqual(DEFAULT_SETTINGS);
	});

	/**
	 * The trust boundary, and the reason this is not a spread over the defaults. A spread
	 * accepts whatever the file says: `units: 'furlongs'` would type as `Units` and reach
	 * every reader, and a hand-edited or downgraded `data.json` is exactly where that comes
	 * from.
	 */
	it('rejects a value outside the vocabulary', () => {
		expect(settingsFrom({ units: 'furlongs' })).toEqual(DEFAULT_SETTINGS);
		expect(settingsFrom({ units: null })).toEqual(DEFAULT_SETTINGS);
		expect(settingsFrom({ units: ['metric'] })).toEqual(DEFAULT_SETTINGS);
	});

	/**
	 * And it answers only the fields this version declares. A key from a newer version, or
	 * one somebody typed, is dropped rather than carried forward for the life of the file —
	 * which also means `saveData` never writes back something no code reads.
	 */
	it('drops keys it does not declare', () => {
		expect(settingsFrom({ units: 'imperial', currency: 'EUR' })).toEqual({ units: 'imperial' });
	});

	it('answers the same shape as the defaults', () => {
		expect(new Set(Object.keys(settingsFrom({})))).toEqual(new Set(Object.keys(DEFAULT_SETTINGS)));
	});

	it('does not mutate the defaults', () => {
		settingsFrom({ units: 'imperial' });

		expect(DEFAULT_SETTINGS.units).toBe('metric');
	});
});

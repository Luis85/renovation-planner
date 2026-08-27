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
		expect(settingsFrom({ units: 'imperial' })).toEqual({
			units: 'imperial',
			projectFolder: DEFAULT_SETTINGS.projectFolder,
			verboseLogging: DEFAULT_SETTINGS.verboseLogging,
		});
	});

	it('keeps a stored folder over the default', () => {
		expect(settingsFrom({ projectFolder: 'Renovations/Main' })).toEqual({
			units: DEFAULT_SETTINGS.units,
			projectFolder: 'Renovations/Main',
			verboseLogging: DEFAULT_SETTINGS.verboseLogging,
		});
	});

	it('keeps a stored verbose-logging choice, and rejects junk for it', () => {
		expect(settingsFrom({ verboseLogging: true }).verboseLogging).toBe(true);
		expect(settingsFrom({ verboseLogging: 1 }).verboseLogging).toBe(false);
		expect(settingsFrom({ verboseLogging: 'yes' }).verboseLogging).toBe(false);
	});

	it('falls back to the default folder for an empty or junk path', () => {
		expect(settingsFrom({ projectFolder: '' }).projectFolder).toBe(DEFAULT_SETTINGS.projectFolder);
		expect(settingsFrom({ projectFolder: '   ' }).projectFolder).toBe(DEFAULT_SETTINGS.projectFolder);
		expect(settingsFrom({ projectFolder: 42 }).projectFolder).toBe(DEFAULT_SETTINGS.projectFolder);
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
		expect(settingsFrom({ units: 'imperial', currency: 'EUR' })).toEqual({
			units: 'imperial',
			projectFolder: DEFAULT_SETTINGS.projectFolder,
			verboseLogging: DEFAULT_SETTINGS.verboseLogging,
		});
	});

	it('answers the same shape as the defaults', () => {
		expect(new Set(Object.keys(settingsFrom({})))).toEqual(new Set(Object.keys(DEFAULT_SETTINGS)));
	});

	it('does not mutate the defaults', () => {
		settingsFrom({ units: 'imperial' });

		expect(DEFAULT_SETTINGS.units).toBe('metric');
	});

	it('round-trips a configured projects folder under the key it has always used', () => {
		// The key is NOT renamed. `settingsFrom` drops keys this version does not declare,
		// on the way in and on the way out, so renaming it would silently reset every
		// existing user's configured folder to the default — and writing to a defaulted
		// path is the exact failure this slice refuses everywhere else.
		expect(settingsFrom({ projectFolder: 'Somewhere Else' }).projectFolder).toBe('Somewhere Else');
	});
});

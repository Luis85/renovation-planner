import { describe, expect, it } from 'vitest';
import { SAVE_STATE_KEYS, type SaveState } from '../../../../src/presentation/editor/save-state/save-state';
import { en } from '../../../../src/presentation/i18n/locales/en';
import { de } from '../../../../src/presentation/i18n/locales/de';

const STATES: SaveState[] = ['saved', 'saving', 'unsaved-changes', 'save-error'];

describe('the save-state vocabulary', () => {
	it.each(STATES)('resolves English copy for %s', (state) => {
		expect(en[SAVE_STATE_KEYS[state]]).toBeTruthy();
	});

	it.each(STATES)('resolves German copy for %s', (state) => {
		expect(de[SAVE_STATE_KEYS[state]]).toBeTruthy();
	});

	it('holds no English of its own — the copy lives in the locale tables', () => {
		expect(Object.values(SAVE_STATE_KEYS).every((key) => key.startsWith('save-state.'))).toBe(true);
	});
});

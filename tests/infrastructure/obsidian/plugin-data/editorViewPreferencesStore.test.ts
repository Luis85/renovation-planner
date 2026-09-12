import { describe, expect, it, vi } from 'vitest';
import type { LocalStorageAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { editorViewPreferencesStore } from '../../../../src/infrastructure/obsidian/plugin-data/editorViewPreferencesStore';
import { recorder as logger } from '../../../helpers/logger';

const KEY = 'renovation-planner:editor-view';

function memory(initial?: unknown): LocalStorageAdapter {
	let stored: unknown = initial ?? null;
	return { loadLocalStorage: () => stored, saveLocalStorage: (_key, data) => { stored = data; } };
}

const broken: LocalStorageAdapter = {
	loadLocalStorage: () => { throw new Error('storage unavailable'); },
	saveLocalStorage: () => { throw new Error('quota exceeded'); },
};

describe('editorViewPreferencesStore', () => {
	it('round-trips both choices', () => {
		const store = editorViewPreferencesStore(memory(), KEY, logger);
		store.write({ gridVisible: true, snappingEnabled: false });
		expect(store.read()).toEqual({ gridVisible: true, snappingEnabled: false });
	});

	it.each([['nothing stored', null], ['a string', 'on'], ['non-boolean fields', { gridVisible: 'yes', snappingEnabled: 0 }]])(
		'answers no choice for %s',
		(_what, stored) => expect(editorViewPreferencesStore(memory(stored), KEY, logger).read()).toEqual({}),
	);

	it('keeps a valid field beside an invalid one', () => {
		expect(editorViewPreferencesStore(memory({ gridVisible: 1, snappingEnabled: false }), KEY, logger).read()).toEqual({ snappingEnabled: false });
	});

	it('logs rather than throwing when the host storage fails', () => {
		const spy = vi.spyOn(logger, 'warn');
		const store = editorViewPreferencesStore(broken, KEY, logger);
		expect(store.read()).toEqual({});
		store.write({ gridVisible: true, snappingEnabled: true });
		expect(spy).toHaveBeenCalledWith('editor-view-preferences.read-failed', expect.objectContaining({ cause: expect.any(Error) }));
		expect(spy).toHaveBeenCalledWith('editor-view-preferences.write-failed', expect.objectContaining({ cause: expect.any(Error) }));
		spy.mockRestore();
	});
});

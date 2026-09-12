import { describe, expect, it, vi } from 'vitest';
import { DeviceLocalStore } from '../../../../src/infrastructure/obsidian/plugin-data/deviceLocalStore';
import type { LocalStorageAdapter } from '../../../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { recorder as logger } from '../../../helpers/logger';

const KEY = 'renovation-planner:panel-layout';

function fakeAdapter(): LocalStorageAdapter {
	const entries = new Map<string, unknown>();
	return {
		loadLocalStorage: (key) => entries.get(key) ?? null,
		saveLocalStorage: (key, data) => { entries.set(key, data); },
	};
}

describe('DeviceLocalStore', () => {
	it('answers null for nothing stored, then what was written', () => {
		const store = new DeviceLocalStore(fakeAdapter(), KEY, logger);
		expect(store.read()).toBeNull();
		store.write({ layers: { width: 300, collapsed: true } });
		expect(store.read()).toEqual({ layers: { width: 300, collapsed: true } });
	});

	it('answers null and warns when the host read throws', () => {
		const spy = vi.spyOn(logger, 'warn');
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => { throw new Error('blocked'); },
			saveLocalStorage: () => undefined,
		};
		expect(new DeviceLocalStore(adapter, KEY, logger).read()).toBeNull();
		expect(spy).toHaveBeenCalledWith('device-local-store.read-failed', expect.objectContaining({ key: KEY, cause: expect.any(Error) }));
		spy.mockRestore();
	});

	it('warns rather than throwing when the host write throws', () => {
		const spy = vi.spyOn(logger, 'warn');
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => null,
			saveLocalStorage: () => { throw new Error('quota exceeded'); },
		};
		expect(() => new DeviceLocalStore(adapter, KEY, logger).write({})).not.toThrow();
		expect(spy).toHaveBeenCalledWith('device-local-store.write-failed', expect.objectContaining({ key: KEY, cause: expect.any(Error) }));
		spy.mockRestore();
	});
});

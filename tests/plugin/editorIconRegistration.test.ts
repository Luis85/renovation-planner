// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';

installObsidianDom();
afterEach(() => vi.restoreAllMocks());

it('registers the application stair artwork on load and removes it once on unload', async () => {
	const add = vi.spyOn(obsidian, 'addIcon'), remove = vi.spyOn(obsidian, 'removeIcon');
	const { plugin } = await loadedPlugin();
	try {
		expect(add).toHaveBeenCalledWith('rp-stairs', expect.stringContaining('M12 88V64H36V40H60V16H88V88Z'));
		const icon = document.createElement('span');
		obsidian.setIcon(icon, 'rp-stairs');
		expect(icon.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 100');
		expect(icon.querySelectorAll('path')).toHaveLength(1);
		plugin.onunload();
		obsidian.setIcon(icon, 'rp-stairs');
		expect(icon.querySelector('svg')).toBeNull();
		plugin.onunload();
		expect(remove).toHaveBeenCalledTimes(1);
		expect(remove).toHaveBeenCalledWith('rp-stairs');
	} finally { plugin.onunload(); }
});

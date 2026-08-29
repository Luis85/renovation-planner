/**
 * @vitest-environment jsdom
 *
 * **Driven through a real `onunload`, not by calling `disposeNotices()` directly.** A test
 * that calls the disposer itself is green whether or not the plugin ever registers it — so it
 * would pass with `this.disposers.push(disposeNotices)` deleted, which is the entire thing
 * this task adds. That is this repository's own recurring shape: the wiring is checked, not
 * assumed.
 *
 * `loadedPlugin` is the same helper `registration.test.ts` uses for the Konva disposer, so
 * this rides an idiom rather than inventing one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { Notice } from '../helpers/obsidian-mock';
import { disposeNotices, notifyWarning } from '../../src/presentation/notices/notify';

describe('notice disposal', () => {
	beforeEach(() => {
		installObsidianDom();
		vi.useFakeTimers();
		document.body.innerHTML = '';
		Notice.shown.length = 0;
		Notice.constructed.length = 0;
		// Terminal, and left that way: each case activates through a real `loadedPlugin()`.
		disposeNotices();
	});

	it('takes every notice off the screen when the plugin unloads', async () => {
		const { plugin } = await loadedPlugin();

		notifyWarning('a');
		notifyWarning('b');
		expect(document.querySelectorAll('.notice')).toHaveLength(2);

		plugin.onunload();

		expect(document.querySelectorAll('.notice')).toHaveLength(0);
	});

	it('registers exactly one disposer for the queue, so a reload cannot strand a notice', async () => {
		const { plugin } = await loadedPlugin();
		const disposers = (plugin as unknown as { disposers: (() => void)[] }).disposers;

		// Named rather than counted: the list also holds Konva's, and asserting a LENGTH here
		// would break every time another slice adds an unrelated disposer.
		expect(disposers).toContain(disposeNotices);
	});

	it('stays off after unload, so a late promise cannot strand a notice', async () => {
		const { plugin } = await loadedPlugin();
		notifyWarning('before');
		plugin.onunload();

		// The cascade and the recovery pass run fire-and-forget, so this is a real path: a
		// promise resolving after unload and reporting its failure. There is no plugin left to
		// clean up what it would attach, so the push is dropped.
		notifyWarning('after');
		expect(document.querySelectorAll('.notice')).toHaveLength(0);
	});

	it('comes back on the next load, not on the next push', async () => {
		const { plugin } = await loadedPlugin();
		plugin.onunload();
		notifyWarning('while unloaded');
		expect(document.querySelectorAll('.notice')).toHaveLength(0);

		await loadedPlugin();
		notifyWarning('after reload');
		expect(document.querySelectorAll('.notice')).toHaveLength(1);
	});
});

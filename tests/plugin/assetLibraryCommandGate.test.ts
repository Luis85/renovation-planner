/**
 * @vitest-environment jsdom
 *
 * `open-asset-library` on both platforms. AD13 criterion 6 gave it a mobile gate — a
 * `checkCallback` answering `false` on `Platform.isMobile`, the palette half of a desktop-only
 * library — and owner ruling 66 (2026-10-01) undid it when `main` met the beta branch: the library
 * is READ-ONLY on a phone (L-43, `AssetLibraryView`'s `readOnly`), so a phone's palette offers it.
 * The subject this file was written for — what the command does on each device — is unchanged, so
 * the file was turned round rather than deleted: it now pins the ABSENCE of that gate.
 *
 * **Its own file rather than a describe in `registration.test.ts`**, which already holds this
 * command's two other cases and is near the 450-line cap that exists precisely to force a split
 * by subject.
 *
 * **The leaf count is the load-bearing assertion.** A plain callback driven through optional
 * chaining (`callback?.()`) goes silently inert if the member is ever renamed back to a
 * `checkCallback`; asserting the leaf the run opened is what turns that into a red. What the
 * opened library then OFFERS on a phone is `tests/presentation/library/assetLibraryMobile.test.ts`'s,
 * against the real view — `FakeLeaf` records asks and constructs no view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';
import { installObsidianDom } from '../helpers/dom';
import { ASSET_LIBRARY_VIEW } from '../../src/presentation/library/AssetLibraryView';
import { loadedPlugin, type LoadedPlugin } from '../helpers/plugin';
import { type FakeWorkspace } from '../helpers/workspace';
import { resetRecorder } from '../helpers/logger';
import { settle } from '../helpers/async';

vi.mock('../../src/infrastructure/logging/consoleLogger', async () => (await import('../helpers/logger')).consoleLoggerMock());

installObsidianDom();

let plugin: LoadedPlugin;
let workspace: FakeWorkspace;

beforeEach(async () => {
	resetRecorder();
	({ plugin, workspace } = await loadedPlugin());
});

afterEach(() => {
	// `Platform` is a module-level singleton shared by every case in THIS file — each test FILE
	// gets its own module registry, but not each test within one. Left flipped, a mobile case
	// would leak into the desktop default the cases below assume.
	Platform.isMobile = false;
});

describe('open-asset-library on every device', () => {
	const command = () => plugin.commands.find((c) => c.id === 'open-asset-library');

	/**
	 * A plain `callback` is a command Obsidian lists in every palette; a `checkCallback` is the
	 * only member through which this command could hide itself again. Asserted on mobile, where
	 * AD13's gate used to answer `false`.
	 */
	it('stays in a mobile palette: a plain callback, with no device check to hide it', () => {
		Platform.isMobile = true;

		expect(command()?.checkCallback).toBeUndefined();
		expect(typeof command()?.callback).toBe('function');
	});

	it('opens the library on mobile, where it draws read-only', async () => {
		Platform.isMobile = true;

		command()?.callback?.();
		await settle();

		expect(workspace.getLeavesOfType(ASSET_LIBRARY_VIEW)).toHaveLength(1);
	});

	it('opens the library on a desktop', async () => {
		command()?.callback?.();
		await settle();

		expect(workspace.getLeavesOfType(ASSET_LIBRARY_VIEW)).toHaveLength(1);
	});
});

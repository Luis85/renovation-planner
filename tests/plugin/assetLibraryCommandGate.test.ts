/**
 * @vitest-environment jsdom
 *
 * `open-asset-library`'s mobile gate — AD13 criterion 6's palette half, and the second of the
 * two sites that answer it.
 *
 * **Its own file rather than a describe in `registration.test.ts`**, which already holds this
 * command's two other cases and is near the 450-line cap that exists precisely to force a split
 * by subject. The subject here is one command's `checkCallback`, on both platforms and in both
 * `checking` arms — four answers, which is more than the neighbouring file wants.
 *
 * **Why a `checkCallback` at all, since `open-plan-editor`'s lesson points the other way.** That
 * lesson is about gating on something the VAULT has to contain: such a command is absent from the
 * palette in every vault that has none of it, which is how `open-plan-editor` once hid itself in
 * every vault with no plan notes while nothing in the app could create one. `Platform.isMobile` is
 * not that kind of precondition — nothing a user does in a vault changes it — so this gate hides
 * the command exactly where the surface behind it refuses anyway, and nowhere else.
 *
 * **The leaf count is the load-bearing assertion, not the boolean.** A build that answered `false`
 * on mobile and still revealed the view would satisfy a boolean-only case while shipping the defect
 * — so the mobile arms assert that NO asset-library leaf exists afterwards, which is what proves
 * `openAssetLibrary()` was never reached rather than merely that the right value came back. The
 * same reason `new-project`'s own pair asserts the dialog store stays empty.
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

describe('open-asset-library’s device gate', () => {
	const command = () => plugin.commands.find((c) => c.id === 'open-asset-library');

	it('hides from the palette on mobile', () => {
		Platform.isMobile = true;

		expect(command()?.checkCallback?.(true)).toBe(false);
	});

	/**
	 * The arm that matters: asked to actually RUN on mobile it refuses too, rather than revealing
	 * a leaf and leaving `AssetLibraryView.onOpen`'s own refusal to be the only thing standing
	 * between the user and a catalogue this device cannot draw. Both arms are asserted so a build
	 * that gated only the palette question would still be caught.
	 */
	it('refuses to run on mobile, and reveals nothing', async () => {
		Platform.isMobile = true;

		expect(command()?.checkCallback?.(false)).toBe(false);
		await settle();

		expect(workspace.getLeavesOfType(ASSET_LIBRARY_VIEW)).toHaveLength(0);
	});

	/**
	 * Off mobile, the palette's own question answers `true` WITHOUT opening anything — which is
	 * what keeps this command in the palette everywhere `Platform.isMobile` is `false`. The leaf
	 * count is what separates a correct `true` from one that also ran the command.
	 */
	it('answers the palette’s question off mobile without opening anything', async () => {
		expect(command()?.checkCallback?.(true)).toBe(true);
		await settle();

		expect(workspace.getLeavesOfType(ASSET_LIBRARY_VIEW)).toHaveLength(0);
	});
});

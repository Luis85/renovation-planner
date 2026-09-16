// @vitest-environment jsdom
// jsdom: loading the plugin shell touches the DOM through the module mock, the same reason
// tests/plugin/assetPriceWiring.test.ts gives.
import { describe, expect, it, vi } from 'vitest';
import { loadedPlugin } from '../helpers/plugin';
import { installObsidianDom } from '../helpers/dom';
import { activeWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

/**
 * ADR-0034's wiring, at the composition site rather than at the unit.
 *
 * Three claims live here and nowhere else: the registry the guard reads is INSTALLED by
 * loading the plugin, it is seeded from the plugin directory at the same load step
 * `recoverInterruptedSequences` runs in, and `onunload` takes the module-level global back
 * off. The last is the rule this repository already paid for with `window.Konva`: a global
 * this code installs is a global this code removes.
 */
describe('write incident wiring', () => {
	it('installs the registry the guard reads, and releases it on unload', async () => {
		const { plugin } = await loadedPlugin();

		expect(activeWriteIncidentRegistry()).not.toBeNull();

		plugin.onunload();

		expect(activeWriteIncidentRegistry()).toBeNull();
	});

	it('reads the incidents file at load, so a previous session can close the gate', async () => {
		const { plugin, workspace, asked } = await loadedPlugin();
		workspace.layoutReady();
		await vi.waitFor(() => expect(asked.some((path) => path.endsWith('write-incidents.json'))).toBe(true));

		plugin.onunload();
	});
});

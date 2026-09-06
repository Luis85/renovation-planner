/**
 * @vitest-environment jsdom
 * jsdom: `loadedPlugin` touches the DOM (ribbon element, settings tab) the way every other
 * suite that loads the real plugin does.
 *
 * That recovery is DISPATCHED at layout-ready, with the marker store the root composed —
 * the wiring, not the repair.
 *
 * This file used to hold a second case, over an `if (persistence.markers)` guard whose false
 * arm was reachable only by mutating the composed root: `PersistenceServices.markers` is
 * required now, every composition has a store (an in-memory one when no session supplies
 * one), and the guard is gone rather than covered.
 *
 * `recoverInterruptedSequences` is mocked so the assertion is on whether the plugin CALLS it,
 * not on what it does once called — that half already belongs to
 * `tests/application/reference/recovery.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';

const recoverInterruptedSequences = vi.fn<(deps: unknown) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('../../src/application/reference/recoverInterruptedSequences', () => ({
	recoverInterruptedSequences: (deps: unknown) => recoverInterruptedSequences(deps),
}));

installObsidianDom();

beforeEach(() => {
	recoverInterruptedSequences.mockClear();
});

describe('interrupted-sequence recovery wiring', () => {
	it('runs recovery at layout-ready with the marker store the root composed', async () => {
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS);
		const persistence = plugin.root.persistence;
		if (!persistence) throw new Error('expected a composed persistence stack');
		expect(persistence.markers).toBeDefined();

		workspace.layoutReady();

		expect(recoverInterruptedSequences).toHaveBeenCalledTimes(1);
		expect(recoverInterruptedSequences).toHaveBeenCalledWith(
			expect.objectContaining({ markers: persistence.markers, requirements: persistence.requirements }),
		);
	});
});

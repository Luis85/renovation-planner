/**
 * @vitest-environment jsdom
 * jsdom: `loadedPlugin` touches the DOM (ribbon element, settings tab) the way every other
 * suite that loads the real plugin does.
 *
 * `startPersistence`'s own comment: "Load-time recovery of an interrupted multi-entity
 * sequence: conditional and idempotent". The `if (persistence.markers)` guard is the
 * "conditional" half, and nothing exercised its FALSE arm — every real composition builds a
 * marker store (`RenovationPlannerPlugin.sequenceMarkerStore` always returns one), so the only
 * way to a persistence stack with none is to mutate the composed root directly, the way
 * `PersistenceServices.markers`'s own docblock predicts: "Absent only in tests that compose
 * without one."
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

describe('interrupted-sequence recovery guard', () => {
	/**
	 * The contrast case: without it, the case below could pass in a world where the plugin
	 * never calls the recovery function at all — an absence proving nothing.
	 */
	it('runs recovery at layout-ready when the persistence stack has a marker store', async () => {
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

	/**
	 * The guarded arm. `PersistenceServices.markers` is optional precisely for a composition
	 * like this one — mutated here rather than composed this way, since every real path builds
	 * a store; the mutation is what stands in for the composition slice 4's own docblock names.
	 */
	it('does not attempt recovery when the persistence stack has no marker store', async () => {
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS);
		const persistence = plugin.root.persistence as { markers?: unknown } | null;
		if (!persistence) throw new Error('expected a composed persistence stack');
		persistence.markers = undefined;

		workspace.layoutReady();

		expect(recoverInterruptedSequences).not.toHaveBeenCalled();
	});
});

// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM through the module mock, exactly as
// tests/plugin/slice10CascadeWiring.test.ts does.
import { beforeEach, describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { expectOk } from '../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../helpers/entities';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { InMemorySequenceMarkerStore } from '../../src/infrastructure/persistence/in-memory/InMemorySequenceMarkerStore';
import type { SequenceMarkerStore } from '../../src/application/ports/SequenceMarkerStore';

installObsidianDom();

/**
 * A delete resolution that WROTE everything it owed the vault and then failed to clear its
 * own recovery marker answers `ok`, so slice 13's save indicator settles on `Saved` — which
 * is true, and is the whole of what every other surface says. The marker outliving its
 * sequence is therefore invisible unless the composition root passes `notify`, which is
 * optional on both delete commands for the suite's benefit.
 *
 * Nothing else can tell a composition that wires it from one that leaves it undefined and
 * logs into the void — the same gap `slice10CascadeWiring.test.ts` closes for `CascadeDeps`.
 */
async function seededStack() {
	const stack = createRepositoryStack();
	const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
	const plan = expectOk(await stack.plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zone = expectOk(
		await stack.zones.save(
			expectOk(
				makeZone({ projectId: project.entity.id, planId: plan.entity.id }).withGeometry({
					points: squareAt().points,
				}),
			),
			'absent',
		),
	);
	stack.metadataCache.catchUp();
	return { stack, zone };
}

/**
 * The composed marker store reads through a plugin-data adapter the plugin harness does not
 * stand up, so every call answers `sequence.marker-unreadable`. Its METHODS are re-pointed
 * at a working in-memory store rather than the property being reassigned, because both
 * delete commands captured this exact object at composition time — swapping the property
 * would leave the sequence talking to the broken one and prove nothing.
 */
function workingMarkers(markers: SequenceMarkerStore): SequenceMarkerStore {
	const inner = new InMemorySequenceMarkerStore();
	markers.list = () => inner.list();
	markers.read = (id) => inner.read(id);
	markers.write = (marker) => inner.write(marker);
	markers.clear = (id) => inner.clear(id);
	return markers;
}

beforeEach(() => {
	activateNotices();
});

describe('sequence marker notice wiring', () => {
	it('a delete whose recovery marker cannot be cleared reaches the user as a notice', async () => {
		const { stack, zone } = await seededStack();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const persistence = plugin.root.persistence;
		if (!persistence?.markers) throw new Error('expected a composed marker store');
		const markers = workingMarkers(persistence.markers);
		// Everything else about the sequence works; only the FINAL clear refuses, which is
		// the one outcome that answers `ok` while leaving a marker behind.
		markers.clear = () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'no' },
			}) as ReturnType<SequenceMarkerStore['clear']>;

		const before = Notice.shown.length;
		const deleted = await persistence.deleteZone.execute({ zoneId: zone.entity.id });

		// Both halves together. The delete SUCCEEDED — every write it owed the vault
		// landed — so asserting the notice alone would pass just as well against a build
		// that had started failing the whole deletion, which is the over-correction this
		// pairing exists to refuse.
		expect(deleted.ok).toBe(true);
		expect(Notice.shown.length).toBe(before + 1);
		expect(Notice.shown.at(-1)).toContain('recovery record');

		await plugin.onunload();
	});

	it('a delete whose marker clears normally says nothing to the user', async () => {
		const { stack, zone } = await seededStack();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const persistence = plugin.root.persistence;
		if (!persistence?.markers) throw new Error('expected a composed marker store');
		workingMarkers(persistence.markers);

		const before = Notice.shown.length;
		const deleted = await persistence.deleteZone.execute({ zoneId: zone.entity.id });

		// The counterpart, without which the case above is satisfied by a `notify` called
		// after every successful delete — a warning on the happy path.
		expect(deleted.ok).toBe(true);
		expect(Notice.shown.length).toBe(before);

		await plugin.onunload();
	});
});

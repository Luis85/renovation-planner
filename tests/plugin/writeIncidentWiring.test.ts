// @vitest-environment jsdom
// jsdom: loading the plugin shell touches the DOM through the module mock, the same reason
// tests/plugin/assetPriceWiring.test.ts gives.
import { describe, expect, it, vi } from 'vitest';
import { loadedPlugin } from '../helpers/plugin';
import { installObsidianDom } from '../helpers/dom';
import { activeWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { WRITES_PAUSED_CODE } from '../../src/application/errors/guardAgainstThrowing';
import type { ZoneId } from '../../src/domain/zone/ZoneId';

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

/**
 * ADR-0034's wiring, at the composition site rather than at the unit.
 *
 * Four claims live here and nowhere else: the registry the guard reads is INSTALLED by
 * loading the plugin, it is seeded from the plugin directory at the same load step
 * `recoverInterruptedSequences` runs in, an open incident refuses a COMPOSED guarded command,
 * and `onunload` takes the module-level global back off. The last is the rule this repository
 * already paid for with `window.Konva`: a global this code installs is a global this code
 * removes.
 */
describe('write incident wiring', () => {
	it('installs the registry the guard reads, and releases it on unload', async () => {
		const { plugin } = await loadedPlugin();

		expect(activeWriteIncidentRegistry()).not.toBeNull();

		plugin.onunload();

		expect(activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * ADR-0034's reader, wired end to end. `GetDiagnosticsSnapshotQuery` takes the open
	 * incidents through its `DiagnosticsSources` bundle, and `guardedServices.ts` fills that
	 * slot from `activeWriteIncidentRegistry()` — so this is the only case that can see the
	 * accessor and the composed query agreeing about ONE registry. The unit tests either side
	 * of it would both pass over a bundle wired to a constant.
	 */
	it('reports the installed registry through the composed diagnostics query', async () => {
		const { plugin } = await loadedPlugin();
		const persistence = plugin.root.persistence;
		expect(persistence).not.toBeNull();

		const before = await persistence?.queries.diagnostics.execute();
		expect(before?.writeIncidents.open).toEqual([]);
		// The path is the plugin directory's own, which is what makes the removal gesture
		// findable — and it is the ONE path this content-free snapshot carries.
		expect(before?.writeIncidents.path).toMatch(/write-incidents\.json$/);

		await activeWriteIncidentRegistry()?.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [{ entityKind: 'zone', entityId: 'zone-01JAAA' }],
		});

		const after = await persistence?.queries.diagnostics.execute();
		expect(after?.writeIncidents.open).toHaveLength(1);
		expect(after?.writeIncidents.open[0]?.affected).toEqual([{ entityKind: 'zone', entityId: 'zone-01JAAA' }]);

		plugin.onunload();

		// The other arm of the accessor, and the one a root composed without a session takes:
		// released global, so the query answers the empty constant rather than throwing.
		const released = await persistence?.queries.diagnostics.execute();
		expect(released?.writeIncidents).toEqual({ path: '', open: [] });
	});

	it('reads the incidents file at load, so a previous session can close the gate', async () => {
		const { plugin, workspace, asked } = await loadedPlugin();
		workspace.layoutReady();
		await vi.waitFor(() => expect(asked.some((path) => path.endsWith('write-incidents.json'))).toBe(true));

		plugin.onunload();
	});

	/**
	 * The gate itself, through the COMPOSED command rather than through `guardCommand` directly:
	 * an open incident refuses a real guarded door on a loaded plugin, with the registry the
	 * composition root installed.
	 *
	 * **What this holds and what it does not.** It holds that the registry the plugin installs
	 * is the one the plugin's own guarded commands consult — the unit test either side would
	 * pass over a second registry nobody reads. It does NOT hold the seeded-from-DISK half: the
	 * incident here is raised in this session, because `loadedPlugin`'s plugin-directory files
	 * live in a map that is created inside that call and cannot be planted before `onload`.
	 * Planting one would mean a new parameter on a helper every plugin suite shares, for a
	 * property `tests/application/incidents/` already drives at the registry level, so the case
	 * above stays what it is — the file is ASKED for at load — and this one starts one step later.
	 *
	 * No vault surface is passed and none is needed: the refusal happens BEFORE `execute`, so
	 * nothing here reaches a repository.
	 */
	it('refuses a composed guarded command while an incident is open', async () => {
		const { plugin } = await loadedPlugin();
		const persistence = plugin.root.persistence;
		expect(persistence).not.toBeNull();

		await activeWriteIncidentRegistry()?.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [{ entityKind: 'zone', entityId: 'zone-01JAAA' }],
		});

		const refused = await persistence?.deleteZone.execute({ zoneId: 'zone-01JAAA' as ZoneId });
		expect(refused?.ok).toBe(false);
		expect(refused?.ok === false && refused.error.code).toBe(WRITES_PAUSED_CODE);

		plugin.onunload();
	});
});

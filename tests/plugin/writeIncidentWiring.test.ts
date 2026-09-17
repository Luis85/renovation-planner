// @vitest-environment jsdom
// jsdom: loading the plugin shell touches the DOM through the module mock, the same reason
// tests/plugin/assetPriceWiring.test.ts gives.
import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { loadedPlugin } from '../helpers/plugin';
import { installObsidianDom } from '../helpers/dom';
import { activeWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { WRITES_PAUSED_CODE } from '../../src/application/errors/guardAgainstThrowing';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../helpers/deviceStorage';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { createInspector } from '../../src/presentation/editor/inspector-wiring';
import type { InspectorEdit } from '../../src/presentation/editor/inspector/inspector-store';
import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import type { DispatchResult } from '../../src/application/commands/DispatchOutcome';

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

/**
 * What a driven door ANSWERED, as one comparable value: its refusal code, or `true` where it
 * resolved `ok`.
 *
 * It exists so the before-incident halves below can assert the code each door actually gives
 * rather than `.not.toBe(WRITES_PAUSED_CODE)`, which passes for every wrong answer that is not
 * that one string — a success, a different refusal, a door that never reached the command. The
 * docblocks over those cases claim each door "reaches the command underneath and answers its own
 * coded refusal", and that claim is only checked if the code is named.
 */
function codeOf(answered: DispatchResult): string | true {
	return answered.ok ? true : answered.error.code;
}

/**
 * What every zone-edit door below answers when no incident is open: the REPOSITORY's own
 * refusal for a zone id that is not in the vault. Naming it is what makes the before-incident
 * halves say the command underneath was actually reached — the gate cannot produce this code,
 * and neither can a door that short-circuited above it.
 */
const ZONE_NOT_FOUND = 'zone.zone-not-found';

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

	/**
	 * The two doors ADR-0034 named as OUTSIDE the gate, now inside it — tracker limitation
	 * L-05. The Inspector builds `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand`
	 * per edit, and until BP-02 slice 4 it built them straight against the raw
	 * `ZoneRepository` port: an incident raised anywhere else in the vault left exactly these
	 * two edits still writing while every other editor write was refused.
	 *
	 * Driven through `planEditorDeps` — the composition site — rather than through the
	 * wrapper, because the claim is that the bundle handed to the editor carries the guarded
	 * factories, which a unit on `guardZoneEdit` cannot say.
	 *
	 * BOTH doors of both factories, and the four are asserted the same way: a guarded
	 * `execute` beside a raw `undo` is a wrapper by every structural test there is.
	 *
	 * The first half is the gate NOT being stuck shut, and it is the half that fails if the
	 * cheapest wrong fix is taken: before any incident is recorded, all four doors reach the
	 * command underneath and answer its own coded refusal — `zone.zone-not-found`, asserted by
	 * name rather than as "not the paused code", which would also pass for a success, for a
	 * different refusal, and for a door that never reached the command at all.
	 */
	it("refuses the Inspector's two zone edits at both doors while an incident is open", async () => {
		const { plugin } = await loadedPlugin();
		const deps = planEditorDeps(plugin.root, {} as never, {} as never, createEditorClipboard(), memoryDeviceStorage());
		const expected = { revision: 1, observed: 'observed-1' as never };
		const doors = () => [
			deps.commands.editZoneDetails(new SessionWriteLedger(), {
				zoneId: 'zone-01JAAA' as ZoneId,
				forward: { name: 'Kitchen', zoneType: 'Room' as const },
				inverse: { name: 'Küche', zoneType: 'Room' as const },
				expected,
			}),
			deps.commands.renameZone(new SessionWriteLedger(), {
				zoneId: 'zone-01JAAA' as ZoneId,
				name: 'Kitchen',
				inverse: 'Küche',
				expected,
			}),
		].flatMap((transaction) => [() => transaction.execute(), () => transaction.undo()]);

		const beforeCodes: (string | true)[] = [];
		for (const drive of doors()) beforeCodes.push(codeOf(await drive()));
		expect(beforeCodes).toEqual([ZONE_NOT_FOUND, ZONE_NOT_FOUND, ZONE_NOT_FOUND, ZONE_NOT_FOUND]);

		await activeWriteIncidentRegistry()?.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [{ entityKind: 'zone', entityId: 'zone-01JAAA' }],
		});

		for (const drive of doors()) {
			const refusedEdit = await drive();
			expect(refusedEdit.ok).toBe(false);
			expect(refusedEdit.ok === false && refusedEdit.error.code).toBe(WRITES_PAUSED_CODE);
		}

		plugin.onunload();
	});

	/**
	 * The same claim as the case above, one seam LOWER — and the seam is the whole point.
	 *
	 * That case enters at `deps.commands.editZoneDetails(...)`, so what it proves is that the
	 * composition root now OFFERS a guarded factory. It cannot see whether the Inspector USES
	 * it: `inspector-wiring.ts`'s `toCommand` switch is what decides, and reverting its
	 * `'details'` and `'name'` arms to the pre-fix raw `new EditZoneDetailsCommand(...)` /
	 * `new ReversibleRenameZoneCommand(...)` construction left the whole suite green. This case
	 * is the one that reddens under exactly that revert — measured, by making the revert and
	 * watching it fail, not by reasoning about the composition.
	 *
	 * So it enters where a user does: `inspector.commit({ kind: 'details' | 'name' })`, over the
	 * real `createInspector` and the real composed `deps.commands`. The dispatcher keeps each
	 * command it is handed, so the `undo` door is driven through the same seam rather than being
	 * reached for behind the store's back.
	 *
	 * Both halves, for the reason the case above gives: before any incident every door must
	 * reach the command underneath and answer `zone.zone-not-found` by name (a gate stuck shut
	 * passes a refusal test by breaking the feature), and after one every door must answer
	 * `WRITES_PAUSED_CODE`.
	 */
	it("refuses an Inspector commit at the switch that decides, before and after an incident", async () => {
		setActivePinia(createPinia());
		const { plugin } = await loadedPlugin();
		const deps = planEditorDeps(plugin.root, {} as never, {} as never, createEditorClipboard(), memoryDeviceStorage());
		const dispatched: UndoableCommand[] = [];
		const inspector = createInspector(
			{ commands: deps.commands } as unknown as PlanEditorContext,
			{
				run: (command) => {
					dispatched.push(command);
					return command.execute();
				},
			},
			new SessionWriteLedger(),
		);
		const expected = { revision: 1, observed: 'observed-1' as never };
		const edits: InspectorEdit[] = [
			{
				kind: 'details',
				zoneId: 'zone-01JAAA' as ZoneId,
				forward: { name: 'Kitchen', zoneType: 'Room' as const },
				inverse: { name: 'Küche', zoneType: 'Room' as const },
				expected,
			},
			{ kind: 'name', zoneId: 'zone-01JAAA' as ZoneId, name: 'Kitchen', inverse: 'Küche', expected },
		];
		const driveBothDoors = async (): Promise<DispatchResult[]> => {
			dispatched.length = 0;
			const answers = [];
			for (const edit of edits) answers.push(await inspector.commit(edit));
			for (const command of dispatched) answers.push(await command.undo());
			return answers;
		};

		expect((await driveBothDoors()).map((answered) => codeOf(answered)))
			.toEqual([ZONE_NOT_FOUND, ZONE_NOT_FOUND, ZONE_NOT_FOUND, ZONE_NOT_FOUND]);

		await activeWriteIncidentRegistry()?.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [{ entityKind: 'zone', entityId: 'zone-01JAAA' }],
		});

		const refusals = await driveBothDoors();
		expect(refusals).toHaveLength(4);
		for (const refusedEdit of refusals) {
			expect(refusedEdit.ok).toBe(false);
			expect(refusedEdit.ok === false && refusedEdit.error.code).toBe(WRITES_PAUSED_CODE);
		}

		plugin.onunload();
	});
});

import { persistenceError } from '../../src/application/errors';
import {
	activeWriteIncidentRegistry,
	installWriteIncidentRegistry,
	WriteIncidentRegistry,
} from '../../src/application/incidents/WriteIncidentRegistry';
import { guardCommand } from '../../src/application/errors/guardAgainstThrowing';
import { createVaultExceptionMapper } from '../../src/application/errors/exceptionMapper';
import { markUncompensated } from '../../src/application/commands/DispatchOutcome';
import { err, type Result } from '../../src/core/result/Result';
import type { AppError } from '../../src/core/errors/AppError';
import { InMemoryWriteIncidentStore } from './InMemoryWriteIncidentStore';
import { recorder } from './logger';

/**
 * A `WriteIncidentRegistry` installed in the module-level holder every consumer reads
 * (ADR-0034), for the suites that drive a surface's behaviour WHILE an incident is open.
 *
 * **Built by recording a real stamp rather than by planting a `WriteIncident` object.**
 * `record()` is the only door onto the open list — `open` is private and there is no setter —
 * so this is not a shortcut around the class: it is the class's own raise path, with an
 * `uncompensatedWrite: []` affected set, which ADR-0034's identity ruling declares a legal and
 * fully open stamp for a raise site that cannot name what it left standing.
 *
 * **`installWriteIncidentRegistry` is module-level state, so the reset is owed WITHIN the file
 * that installs one.** Every caller here pairs the install with
 * `afterEach(() => installWriteIncidentRegistry(null))`. Vitest gives each test FILE its own
 * module registry, which is what keeps an un-reset install from reaching another file — not
 * anything this helper does. That is the same rule `tests/application/errors/
 * writeIncidentGate.test.ts` states for itself, and this helper does not weaken it.
 */
export async function installOpenWriteIncident(): Promise<WriteIncidentRegistry> {
	const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
	await registry.record({
		...persistenceError('zone.sidecar-write-uncompensated', 'left standing'),
		uncompensatedWrite: [],
	});
	installWriteIncidentRegistry(registry);
	return registry;
}

/**
 * A registry with NOTHING open, installed the same way.
 *
 * The control the seeding cases need, and not a redundant one: "no registry installed at all"
 * and "a registry that answers `anyOpen() === false`" are two different arms of
 * `activeWriteIncidentRegistry()?.anyOpen() ?? false`, and only the second one proves the
 * question is being asked of the registry rather than skipped.
 */
export function installQuietWriteIncidents(): WriteIncidentRegistry {
	const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
	installWriteIncidentRegistry(registry);
	return registry;
}

/**
 * **A registry over a store that DOES hold a durable incident, installed before `seed()` has
 * run** — the state a leaf Obsidian restored from the workspace layout actually meets.
 *
 * `RenovationPlannerPlugin.startPersistence` calls `void this.stores.writeIncidents.seed()` at
 * `onLayoutReady`, and that same function's own comment records that Obsidian restores its leaves
 * BEFORE `onLayoutReady`. So a restored leaf's store asks `anyOpen()` of a registry whose list is
 * still empty and seeds CLEAN, however full the file is.
 *
 * Distinct from `installQuietWriteIncidents` in exactly the way that matters: there the vault
 * really is clean, here it is not and the registry has simply not looked yet. A helper that
 * installed an empty store instead would pass for the wrong reason and could never go red.
 *
 * It does NOT simulate Obsidian's ordering — nothing in this repository can, and `FakeLeaf`
 * records asks rather than performing them. It simulates the registry state that ordering
 * produces, which is the half the code here decides.
 */
export async function installUnseededWriteIncidents(): Promise<WriteIncidentRegistry> {
	const store = new InMemoryWriteIncidentStore();
	const filled = new WriteIncidentRegistry(store, recorder);
	await filled.record({
		...persistenceError('zone.sidecar-write-uncompensated', 'left standing'),
		uncompensatedWrite: [],
	});
	const restored = new WriteIncidentRegistry(store, recorder);
	installWriteIncidentRegistry(restored);
	return restored;
}

/**
 * A GUARDED save whose body waits until the case finishes it — a write still running when
 * `onunload` arrives, which is what owner ruling 16 keeps the record alive for.
 *
 * `seen` is which registry the body found installed when it ran: exactly what a stamp made then
 * would record into (`markUncompensated` reads the holder at stamp time, owner ruling 13), and —
 * since the guard reads the same holder one line earlier — whether the save was gated at all.
 * `halfFail` stamps when IT is called, so it records into whatever is installed at that moment.
 */
export function slowGuardedSave() {
	let finish!: (result: Result<'wrote', AppError>) => void;
	const outcome = new Promise<Result<'wrote', AppError>>((resolve) => { finish = resolve; });
	const seen: (WriteIncidentRegistry | null)[] = [];
	const guarded = guardCommand(
		{ execute: () => { seen.push(activeWriteIncidentRegistry()); return outcome; } },
		'command.test.failed',
		recorder,
		createVaultExceptionMapper('test'),
	);
	return {
		execute: () => guarded.execute(undefined),
		seen,
		finish,
		halfFail: () => finish(err(markUncompensated(persistenceError('zone.write-uncompensated', 'half-written'), []))),
	};
}

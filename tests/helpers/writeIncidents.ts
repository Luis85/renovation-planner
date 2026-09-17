import { persistenceError } from '../../src/application/errors';
import {
	installWriteIncidentRegistry,
	WriteIncidentRegistry,
} from '../../src/application/incidents/WriteIncidentRegistry';
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

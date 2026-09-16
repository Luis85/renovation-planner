import { ok, type Result } from '../../src/core/result/Result';
import type { PersistenceError } from '../../src/core/errors/AppError';
import type { WriteIncident } from '../../src/application/incidents/WriteIncident';
import type { WriteIncidentStore } from '../../src/application/ports/WriteIncidentStore';

/**
 * The in-memory twin of the write incident store (ADR-0034), for the suite.
 *
 * **It sits in `tests/helpers/` and NOT beside `InMemorySequenceMarkerStore` in production
 * `src/`, which is the placement its sibling's own docblock argues for.** That sibling is
 * there because it is also the composition root's real fallback for a caller composing
 * services with no session. This one has no such caller: nothing in `CompositionRoot` reads
 * the incident store, because the gate reads the registry `RenovationPlannerPlugin` installs
 * rather than anything the root carries. The reason is what places the file, so when the
 * reason does not hold the file does not move. A later increment that gives the root a reader
 * — ADR-0034 requires `GetDiagnosticsSnapshotQuery` to name open incidents — is what moves it
 * across, with the fallback the move is for.
 *
 * Append-only, like the port: there is no `clear`, because nothing in the plugin retires an
 * incident.
 *
 * It is no kinder than the file store on the arms it shares — `add` never refuses there
 * either, and `list` cannot refuse here because there is no file to be malformed. The one
 * behaviour the file store has that this cannot reproduce is refusing an unreadable envelope;
 * a caller with nothing on disk has nothing unreadable, so that is an absent subject rather
 * than a tolerated one.
 */
export class InMemoryWriteIncidentStore implements WriteIncidentStore {
	private readonly incidents: WriteIncident[] = [];

	list(): Promise<Result<readonly WriteIncident[], PersistenceError>> {
		return Promise.resolve(ok([...this.incidents]));
	}

	add(incident: WriteIncident): Promise<Result<void, PersistenceError>> {
		this.incidents.push(incident);
		return Promise.resolve(ok(undefined));
	}
}

import type { PersistenceError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { WriteIncident } from '../incidents/WriteIncident';

/**
 * Where write incidents (ADR-0034) persist. Plugin-local operational state, implemented OVER
 * the plugin directory and never through `data.json`'s settings object — the same reasoning
 * `SequenceMarkerStore` states verbatim: `settingsFrom` drops keys this version does not
 * declare, so an open incident put there would be silently discarded on the next settings
 * write, and an incident is not a preference a user should find among their settings.
 *
 * **Exactly two methods, and the ABSENCE of a third is load-bearing.** There is no `clear`
 * and no `remove`, because ADR-0034 decides that nothing in the plugin retires an incident:
 * not a control, not a reload, not a later successful write. Nothing here can tell a repaired
 * vault from an unrepaired one, so any retirement door the plugin owned would be a
 * plugin-decided all-clear the ADR refuses by name. Retirement is the user deleting the file
 * after checking their vault against a backup. A port with no removal door is how that
 * decision is held by the type system instead of by everyone remembering it.
 *
 * A caller that finds it needs a third method has found a disagreement with ADR-0034 and
 * should report it rather than add one.
 */
export interface WriteIncidentStore {
	/** Every open incident — what the registry is seeded from at load. */
	list(): Promise<Result<readonly WriteIncident[], PersistenceError>>;
	add(incident: WriteIncident): Promise<Result<void, PersistenceError>>;
}

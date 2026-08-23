import type { Logger } from '../application/ports/Logger';
import type { RenovationPlannerSettings } from './settings/settings';

/**
 * The ONE place dependencies are composed (SDD §10). At this slice it composes two things,
 * and the commented members are not a wish list — they are the promise this seam makes:
 * every later slice adds a FIELD and a constructor parameter here, and never a second
 * wiring point somewhere else in the plugin.
 *
 * `plugin/` is the only layer allowed to import from every other one, which is the entire
 * reason the inner layers can stay ignorant of Obsidian: something has to know how to build
 * a `ZoneRepository` from an `App`, and it is this file rather than `domain/zone/`.
 */
export interface CompositionRoot {
	/**
	 * `null` when `data.json` could not be READ — not when it is absent, which is a fresh
	 * install and loads defaults normally. Deliberately not "defaults on failure": once
	 * slice 4 puts folder paths in here, a default is a different LOCATION, not a milder
	 * version of the user's, so an index built on it scans folders the projects are not in.
	 *
	 * Every consumer therefore has to face the case, which is the point rather than a cost:
	 * code wanting a default for a display preference writes `?? DEFAULT_SETTINGS` and is
	 * visibly choosing it, while code needing a folder path cannot be handed a plausible
	 * wrong one.
	 */
	readonly settings: RenovationPlannerSettings | null;
	/**
	 * Not one of §10's five members, and held here because slice 11 states the wiring as a
	 * contract: the `Logger` is injected via the composition root like any other Application
	 * port. If the root did not hold it from its first version, the injection point would
	 * have to MOVE later — and this seam is extended by a field, never relocated.
	 */
	readonly logger: Logger;
	// readonly eventBus: EventBus;                — arrives with slice 2 (Core Primitives)
	// readonly repositories: RepositoryRegistry;  — arrives with slice 4 (Persistence Layer)
	// readonly services: ApplicationServices;     — arrives with slice 4 / slice 9
	// readonly queries: QueryServices;            — arrives with slice 4
}

/**
 * The logger is a PARAMETER rather than something this function constructs: it has to exist
 * before the settings load that may fail, and that load happens before this call.
 */
export function createCompositionRoot(settings: RenovationPlannerSettings | null, logger: Logger): CompositionRoot {
	return { settings, logger };
}

// When slice 4 adds repositories, the index and the query services, this function composes
// them only when `settings !== null` — a service that reads or writes a configured location
// has no correct behaviour without the configuration that names it.

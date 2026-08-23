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
	readonly settings: RenovationPlannerSettings;
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
export function createCompositionRoot(settings: RenovationPlannerSettings, logger: Logger): CompositionRoot {
	return { settings, logger };
}

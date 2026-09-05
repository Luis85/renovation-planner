/**
 * Task 6, Step 5: the joint census A2 asks for — every domain event PUBLISHED somewhere under
 * an `.events.ts` file in `src/domain/` reaches at least one subscriber, named as a
 * `*_EVENTS` list under `src/application/events/`.
 *
 * **Discovery is text-based and CRUDE, exactly like `reversibleWritePathDiscovery.test.ts`'s
 * own instrument, and for the same reason.** A behavioural check that some listener somewhere
 * fires would need one fixture EventBus and one assertion per event type — a census by
 * duplication, not a scan. What text can answer reliably is which names exist on each side of
 * the seam: every `extends DomainEvent<'X'>` interface names a published type, and every
 * `const SOMETHING_EVENTS = [...]` array names a subscribed one. Whether the DELIVERY that
 * follows is correct is what the sources' own per-file test suites drive — this file only
 * asks whether the NAME was ever handed to `subscribeAll` at all, which is the gap A2 found:
 * `CostEstimateChanged` was in no list, so no test file could have driven a delivery of it.
 *
 * **What the walk cannot see, named rather than assumed.** A source that subscribes an event
 * directly (`events.subscribe('X', …)`, `assetLibraryChangeSource.ts`'s shape) rather than
 * through a `*_EVENTS` array is invisible to this scan — every event that module subscribes
 * this way is ALSO named in a `*_EVENTS` list elsewhere (`AssetCreated`, `AssetUpdated`,
 * `AssetDeleted`, `AssetDesignChanged`, `AssetPriceOverrideChanged`), so today's tree has no
 * gap hiding behind that blind spot, but a NINTH source subscribing a domain event only that
 * way would pass this file while genuinely being the defect A2 describes. And an array whose
 * name does not end `_EVENTS` (there is none today) would be invisible the same way a
 * differently-named `DISPOSITIONS` key would be to the sibling census.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOMAIN_EVENTS_DIR = join('src', 'domain');
const APPLICATION_EVENTS_DIR = join('src', 'application', 'events');

/** Every `interface X extends DomainEvent<'Type'>` in an `.events.ts` file under `src/domain/`. */
function publishedEventTypes(): readonly string[] {
	const found: string[] = [];
	for (const category of readdirSync(DOMAIN_EVENTS_DIR)) {
		const dir = join(DOMAIN_EVENTS_DIR, category);
		for (const file of readdirSync(dir)) {
			if (!file.endsWith('.events.ts')) continue;
			const text = readFileSync(join(dir, file), 'utf8');
			for (const match of text.matchAll(/extends DomainEvent<'([^']+)'>/g)) {
				found.push(match[1]);
			}
		}
	}
	return found;
}

/**
 * Every string literal inside a `const SOMETHING_EVENTS = [ … ] as const;` array in a
 * top-level file under `src/application/events/`. Non-greedy up to the first `]`: no array in this directory
 * nests brackets, which the "finds something" test below would catch if that ever changed
 * (the count would collapse rather than merely shift).
 */
function subscribedEventTypes(): readonly string[] {
	const found: string[] = [];
	for (const file of readdirSync(APPLICATION_EVENTS_DIR)) {
		if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
		const text = readFileSync(join(APPLICATION_EVENTS_DIR, file), 'utf8');
		for (const list of text.matchAll(/const\s+[A-Z][A-Z0-9_]*_EVENTS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/g)) {
			for (const literal of list[1].matchAll(/'([^']+)'/g)) {
				found.push(literal[1]);
			}
		}
	}
	return found;
}

describe('the vocabulary walk finds something at all', () => {
	it('discovers a non-trivial number of published domain event types', () => {
		// A typo'd glob or regex would find nothing and look exactly like full coverage.
		expect(publishedEventTypes().length).toBeGreaterThan(10);
	});

	it('discovers a non-trivial number of subscribed event types across every *_EVENTS list', () => {
		expect(subscribedEventTypes().length).toBeGreaterThan(10);
	});
});

/**
 * **The joint assertion A2 names.** No deliberate exceptions remain: `RequirementCreated`,
 * `RequirementDeleted` and `RequirementRestored` were the three A2 found missing (alongside
 * `CostEstimateChanged`, closed by `requirementFiguresChangeSource.ts` in this same task), and
 * `projectPricesChangeSource.ts`'s `REQUIREMENT_LIST_EVENTS` now carries all three. A future
 * gap here means a new `interface … extends DomainEvent<'X'>` landed with no `*_EVENTS` list
 * naming it — exactly the shape A2 was.
 */
describe('every published domain event reaches at least one *_EVENTS list', () => {
	it('has no event type published under src/domain that no *_EVENTS list under src/application/events names', () => {
		const published = new Set(publishedEventTypes());
		const subscribed = new Set(subscribedEventTypes());

		const orphaned = [...published].filter((type) => !subscribed.has(type)).toSorted();

		expect(orphaned).toEqual([]);
	});
});

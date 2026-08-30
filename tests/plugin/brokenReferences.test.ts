// @vitest-environment jsdom
// jsdom: `installObsidianDom()` reads `HTMLElement.prototype` at module evaluation and node
// provides no `HTMLElement`, so without this the file dies before any assertion runs — not a
// failing test, a file that never executes. `tests/plugin/persistence-wiring.test.ts` carries
// the same directive for the same reason. `tests/build/test-environments.test.ts` guards two
// things and this file trips neither: `tests/plugin/` is not one of the THREE
// `PROTECTED_DIRECTORIES` (`tests/core/`, `tests/domain/`, `tests/application/`), and this
// file's own imports (`../helpers/dom`, `../helpers/plugin`, `../helpers/fixtureVault`,
// `../helpers/domain`, plus `src/`) never reach `tests/contracts/`, which is that guard's
// second, structural arm (`reachesContracts`) — so this is permitted there on BOTH counts,
// checked rather than assumed.
import { afterEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { openFixtureVault, type FixtureStack } from '../helpers/fixtureVault';
import { expectErr, expectOk } from '../helpers/domain';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import type RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';
import type { ZoneId } from '../../src/domain/zone/ZoneId';

/**
 * The fixture's own ids, BRANDED — never minted.
 *
 * `createZoneId()` takes no parameters and always generates a fresh id, so
 * `createZoneId('kitchen')` silently discards the string and looks up an id that exists
 * nowhere: both reads would answer `ok(null)`, the planted-refusal case would fail, and
 * `tests/` sits outside `tsconfig.json`'s include so the extra argument is not a build error.
 * A call that compiles, runs, and asks the wrong question.
 *
 * A cast is the honest spelling here rather than a weakness: these strings are the fixture
 * notes' own frontmatter `id` values, and `buildProjectIndexEntries` asserts raw frontmatter
 * into `EntityId` exactly this way after checking only that it is non-empty. The fixture is
 * the authority on its own ids.
 */
const PLANTED = 'zone-with-missing-plan' as ZoneId;
const HEALTHY = 'kitchen' as ZoneId;

installObsidianDom();

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

/**
 * The real startup over the fixture's host surfaces, and every argument position matters.
 *
 * `loadedPlugin(stored, loadFailure, dataFileExists, surface)` — the surface is the FOURTH
 * parameter. An earlier draft passed it FIRST, where it was read as stored settings, leaving
 * the plugin with no vault surface at all; an `as never` cast is what stopped the compiler
 * saying so. A cast that makes wrong code compile is worse than the wrong code.
 *
 * `workspace.layoutReady()` is not optional either: `RenovationPlannerPlugin` registers
 * `startPersistence()` through `onLayoutReady` and NOT in `onload`, deliberately — a
 * vault-wide scan in `onload` would block Obsidian's start. So without this call the index
 * is never built and the assertions below would be about a plugin that never started.
 *
 * NO CAST, and that costs one prerequisite edit — see Step 1b. `VaultSurface` is a
 * STRUCTURAL contract now, and `FixtureStack`'s `vault`/`fileManager`/`metadataCache`
 * satisfy it directly. Casting past it would hide exactly the mismatch this test needs the
 * compiler to check.
 */
const bootstrap = async (): Promise<{ stack: FixtureStack; plugin: RenovationPlannerPlugin }> => {
	const stack = await openFixtureVault('broken-references');
	const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, {
		vault: stack.vault,
		fileManager: stack.fileManager,
		metadataCache: stack.metadataCache,
	});

	workspace.layoutReady();
	return { stack, plugin };
};

/**
 * Architecture Completion Criterion 13 — "a broken project file does not prevent the entire
 * plugin from loading" — and its §92 half about a poisoned note refusing "only when something
 * OPENS it".
 *
 * THREE assertions, and the first is the one criterion 13 is actually about. An earlier draft
 * claimed the degradation half alone "simultaneously proves the fixture exercises the failure
 * mode it claims to". It does not: *the rest of the plugin still works* is equally true of a
 * fixture that has quietly become VALID, so the criterion could sit untested behind a green
 * suite. A test asserting an ABSENCE passes in both worlds when neither world can produce the
 * thing.
 *
 * Every read goes through `plugin.root.persistence`, never through the `FixtureStack`'s own
 * repositories. Those are an independent construction over the same bytes, so asserting on
 * them would prove the fixture is readable and say nothing about what the plugin composed.
 */
describe('a broken project file does not stop the plugin loading', () => {
	it('completes the real bootstrap and builds the index fully, dropping nothing', async () => {
		const { stack, plugin } = await bootstrap();
		open = stack;

		// The index scan deliberately does NOT run the fail-closed gate: `collectNotes` copies
		// `project` and `plan` through `stringField(...)` with no referential check, so the
		// poisoned note is indexed exactly like its neighbours. Asserting a refusal HERE would
		// be asserting something bootstrapping never produces.
		expect(plugin.root.persistence).not.toBeNull();
		// `NonNullable` rather than `!`: `no-non-null-assertion` is an error
		// (`.oxlintrc.json`), and `tests/plugin/persistence-wiring.test.ts` already carries
		// this exact widening for the same reason.
		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;

		// "Fully built, nothing dropped" is the poisoned note present BESIDE the healthy one.
		// `InMemoryProjectIndex` exposes no `size` — measured — and a count would be the weaker
		// claim anyway: criterion 13 is about the poisoned note not taking the vault down.
		//
		// THE PLUGIN'S index, not `stack.index`. `openFixtureVault` builds one of its own and
		// `loadedPlugin` composes a second; only the second is rebuilt by `startPersistence()`,
		// so the fixture's own index is still EMPTY here and asserting on it would fail even
		// when startup succeeded perfectly. The comment two lines above already said every read
		// goes through the plugin, and this assertion did not — the rule stated in a docblock
		// that the code beside it breaks, for the second time in this one test.
		//
		// `'renovation-zone'`, not `'zone'` — `ProjectIndex.ts`'s `ENTITY_TYPES` is the
		// persisted discriminator, and `'zone'` is not a member of it: measured by running
		// this case, which answered `expected [] to include 'kitchen'` against the shorter
		// spelling.
		const zones = persistence.index.getIdsByType('renovation-zone');
		expect(zones).toContain('kitchen');
		expect(zones).toContain('zone-with-missing-plan');
	});

	it('refuses the planted record when something opens it, with the code its edge produces', async () => {
		const { stack, plugin } = await bootstrap();
		open = stack;
		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;

		const failure = expectErr(await persistence.zones.getById(PLANTED));

		expect(failure.code).toBe('zone.sidecar-unreadable');
		expect((failure.cause as { code?: string } | undefined)?.code).toBe('plan-geometry.path-unresolved');
	});

	it('still loads a healthy record from the same fixture', async () => {
		const { stack, plugin } = await bootstrap();
		open = stack;
		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;

		const loaded = expectOk(await persistence.zones.getById(HEALTHY));

		expect(loaded?.entity.name).toBe('Kitchen');
	});
});

/**
 * The Asset library's read model: five doors mapped from five guarded queries, and the
 * refusal a session whose settings could not be read hands over instead.
 *
 * Node, not jsdom — the mapping is a pure function of its queries, and asking a function
 * rather than a screen is the return on the layering.
 */
import { describe, expect, it } from 'vitest';
import {
	createAssetLibraryQueries,
	unavailableAssetLibraryQueries,
} from '../../../src/presentation/read-models/assetLibraryQueries';
import type { CatalogueListing } from '../../../src/application/queries/ListCatalogueEntries';
import type {
	AssetOutline,
	ListAssetOutlinesInput,
} from '../../../src/application/queries/ListAssetOutlines';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type {
	ReferencedTarget,
	ReferencingGroup,
} from '../../../src/application/queries/ListRequirementsReferencing';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { assetDesign } from '../../helpers/assetDesign';

const TILES = 'asset-tiles' as AssetId;
const PAINT = 'asset-paint' as AssetId;

const EMPTY_LISTING: CatalogueListing = { entries: [], unreadable: [] };

/**
 * Every query the bundle takes, each recording what it was asked. Overridable one at a time,
 * so a case names the door it is about and nothing else.
 */
function queriesWith(overrides: Partial<Parameters<typeof createAssetLibraryQueries>[0]> = {}) {
	const asked: unknown[] = [];
	const bundle = createAssetLibraryQueries({
		listCatalogue: {
			execute: () => {
				asked.push('listCatalogue');
				return Promise.resolve(ok(EMPTY_LISTING));
			},
		},
		listOutlines: {
			execute: (input: ListAssetOutlinesInput) => {
				asked.push(input);
				return Promise.resolve(
					ok(new Map<AssetId, AssetOutline>(input.assetIds.map((id) => [id, { kind: 'none' }]))),
				);
			},
		},
		getDesign: {
			execute: (assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>> => {
				asked.push(assetId);
				return Promise.resolve(ok(assetDesign()));
			},
		},
		listReferencing: {
			execute: (target: ReferencedTarget): Promise<Result<readonly ReferencingGroup[], RepositoryError>> => {
				asked.push(target);
				return Promise.resolve(ok([]));
			},
		},
		listOverridingProjects: {
			execute: (assetId: AssetId): Promise<Result<readonly ProjectId[], RepositoryError>> => {
				asked.push(assetId);
				return Promise.resolve(ok([]));
			},
		},
		...overrides,
	});
	return { bundle, asked };
}

describe('createAssetLibraryQueries', () => {
	/**
	 * Every door is asked, with the argument the view supplied. A bundle whose members called
	 * their query with nothing would type-check under the same signatures and answer about
	 * whichever asset the query defaulted to.
	 */
	it('hands each door its own query, with the id the caller supplied', async () => {
		const { bundle, asked } = queriesWith();

		expectOk(await bundle.listCatalogue());
		await bundle.listOutlines([TILES, PAINT]);
		expectOk(await bundle.getDesign(TILES));
		expectOk(await bundle.listReferencing(TILES));
		expectOk(await bundle.listOverridingProjects(PAINT));

		expect(asked).toEqual([
			'listCatalogue',
			{ assetIds: [TILES, PAINT] },
			TILES,
			// The discriminator is THIS bundle's to supply: `ListRequirementsReferencing` serves
			// the zone flow too, and a view remembering which kind it meant is a view one edit
			// away from asking about a zone.
			{ kind: 'asset', assetId: TILES },
			PAINT,
		]);
	});

	it("hands the outline query's answer straight back when it succeeds", async () => {
		const { bundle } = queriesWith();

		const outlines = await bundle.listOutlines([TILES, PAINT]);

		expect([...outlines.keys()]).toEqual([TILES, PAINT]);
		expect([...outlines.values()].map((outline) => outline.kind)).toEqual(['none', 'none']);
	});

	/**
	 * The one mapping in this file that changes shape, and the reason it exists: a fault below
	 * the boundary arrives as a refused `Result`, and the view's map has no arm for it. One
	 * `refused` entry per requested id is the honest answer — every mark says *unread*. An
	 * empty map would drop every entry and read back as `none`, which is the false absence
	 * §3.4's fifth mark state exists to refuse.
	 */
	it('turns a refused outline batch into one refused entry per requested id', async () => {
		const { bundle } = queriesWith({
			listOutlines: { execute: () => Promise.resolve(err(injectedPersistenceError())) },
		});

		const outlines = await bundle.listOutlines([TILES, PAINT]);

		expect([...outlines.keys()]).toEqual([TILES, PAINT]);
		expect([...outlines.values()]).toEqual([
			{ kind: 'refused', code: 'test.injected-failure', sidecarPath: undefined },
			{ kind: 'refused', code: 'test.injected-failure', sidecarPath: undefined },
		]);
	});

	it('propagates a refused catalogue read rather than answering an empty catalogue', async () => {
		// The two are opposite claims about the vault, and the second one draws *no assets yet*
		// over a library this build simply could not read.
		const { bundle } = queriesWith({
			listCatalogue: { execute: () => Promise.resolve(err(injectedPersistenceError())) },
		});

		expect(expectErr(await bundle.listCatalogue()).code).toBe('test.injected-failure');
	});
});

describe('unavailableAssetLibraryQueries', () => {
	it('refuses every door when settings are unrecovered, including the outline map', async () => {
		const queries = unavailableAssetLibraryQueries();
		expect(expectErr(await queries.listCatalogue()).code).toBe('settings.unrecovered');
		const outlines = await queries.listOutlines(['a', 'b'] as AssetId[]);
		expect([...outlines.values()].map((o) => o.kind)).toEqual(['refused', 'refused']);
	});

	/**
	 * TOTAL, member by member. The code is `settings.unrecovered` and not one of this
	 * surface's own, because `viewHydrationOrigin` reads that exact string to decide the
	 * failure gets NO retry — nothing was composed to re-run, so a retry button would be a
	 * live control that does nothing.
	 */
	it('refuses the three selection reads under the same code', async () => {
		const queries = unavailableAssetLibraryQueries();

		const codes = [
			expectErr(await queries.getDesign(TILES)).code,
			expectErr(await queries.listReferencing(TILES)).code,
			expectErr(await queries.listOverridingProjects(TILES)).code,
		];

		expect(codes).toEqual(['settings.unrecovered', 'settings.unrecovered', 'settings.unrecovered']);
	});

	it('names the requested ids in the refused outline map, rather than answering an empty one', async () => {
		const queries = unavailableAssetLibraryQueries();

		const outlines = await queries.listOutlines([TILES, PAINT]);

		expect([...outlines.keys()]).toEqual([TILES, PAINT]);
		expect([...outlines.values()]).toEqual([
			{ kind: 'refused', code: 'settings.unrecovered', sidecarPath: undefined },
			{ kind: 'refused', code: 'settings.unrecovered', sidecarPath: undefined },
		]);
	});
});

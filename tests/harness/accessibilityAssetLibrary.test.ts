import type { ObservationToken } from '../../src/application/ports/versioning';
/**
 * @vitest-environment jsdom
 *
 * **The asset library half of `accessibility.test.ts`, split out for `max-lines` and not for a
 * change of subject.** Read that file's header first: its SCOPE paragraph — what an axe scan in
 * jsdom can and cannot settle, and why `document.body` rather than a wrapper's own element — is
 * the contract this file runs under too, and restating it here would be the second copy of a
 * claim that then disagrees with itself.
 *
 * The split is a MERGE artefact rather than a design: two branches each appended cases to that
 * one file and the sum crossed the 450-line cap. The seam is the one the file already drew —
 * three top-level `describe`s, one per surface — so this is the whole of the asset library's,
 * moved with nothing rewritten. `runOptions` moved to `./axeOptions` in the same edit, because
 * the alternative to sharing it is two copies of the list naming the rules this suite cannot
 * honestly grade.
 *
 * One thing the move REPAIRED rather than preserved: the harness index's own section docblock
 * had been left sitting above this block, describing a `describe` two definitions further down,
 * because the asset library section was inserted between the two. Nothing in any gate reads
 * whether a docblock still belongs to what follows it.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountAssetLibraryHarness } from './assetLibrary';
import { runOptions } from './axeOptions';
import { installObsidianDom } from '../helpers/dom';
import { defaultAssetLibraryDeps, makeAssetLibraryView } from '../helpers/makeAssetLibraryView';
import { ok } from '../../src/core/result/Result';
import { createAssetId } from '../../src/domain/asset/AssetId';
import { currencyOf } from '../../src/core/money/Money';
import type { CatalogueEntryDto } from '../../src/application/queries/ListCatalogueEntries';
import type { ViewStateResult } from 'obsidian';

beforeEach(() => {
	document.body.innerHTML = '';
});

/**
 * §2's fourth workspace view (Task 11 review, M12): a cheap addition here rather than a
 * deferral, since the root is a real, opened `AssetLibraryView` and needs none of the other
 * cases' hydration-timing care — `mount()` builds the Vue tree synchronously inside `onOpen`,
 * and the first paint draws before `hydrate()`'s own query resolves.
 *
 * **Task 13 built §3's shelves-and-inspector-less shell** (the toolbar, the shelves region and
 * every one of §4's states except the Inspector, which is Task 14's), so the first two cases
 * below now scan REAL branching rather than the placeholder div Task 11 left here — both were
 * strengthened with a load-bearing assertion on `.rp-view-failure` for exactly the reason this
 * file's own header names as the recurring hazard on this branch (an axe scan that passes with
 * nothing meaningful mounted): `defaultAssetLibraryDeps()` refuses every query, so both cases
 * scan the FAILED state, and a mount that silently stopped drawing `ViewFailure` would still
 * pass an unguarded `axe.run` on an empty subtree. A third case below scans the READY state —
 * the toolbar, the shelves and the repair strip — which is the branch these two cannot reach.
 */
/** A minimal, real `CatalogueEntryDto` for the ready-state scan below — the exact shape
 *  `tests/presentation/library/assetRow.test.ts`'s own fixture builds, since this file's job
 *  is to scan what those unit-tested components draw together rather than to invent a second
 *  reading of the DTO. */
function anAxeCatalogueEntry(): CatalogueEntryDto {
	return {
		version: { revision: 1, observed: 'fixture' as ObservationToken },
		assetId: createAssetId(),
		name: 'Oak plank floor',
		category: 'material',
		unit: 'm2',
		unitCostAmount: '34.95',
		currency: currencyOf('EUR'),
		wasteFactorDefault: '0.08',
		supplier: 'Holzhandel Nord',
		sku: 'EIC-1200-190',
		height: null,
		notes: null,
		background: null,
	};
}

/**
 * One case per §4 empty state, and the shared half is a FUNCTION rather than an `it.each`
 * table: `noMatches` is reached by typing into the search field and `noAssets` is not, so a
 * parameterised version put an `expect` inside an `if` — which `vitest/no-conditional-expect`
 * refuses, and rightly: a conditional assertion is one that can be skipped without the case
 * going red.
 */
const mountLibraryWith = async (entries: readonly CatalogueEntryDto[]) => {
	installObsidianDom();
	const deps = defaultAssetLibraryDeps({
		queries: {
			...defaultAssetLibraryDeps().queries,
			listCatalogue: () => Promise.resolve(ok({ entries, unreadable: [] })),
		},
	});
	const view = makeAssetLibraryView(deps);
	document.body.appendChild(view.containerEl);
	await view.onOpen();
	await flushPromises();
	return view;
};

describe('axe against the asset library', () => {
	/**
	 * `axe.run` requires its target to be part of the live document — `mountHarness`'s own
	 * comment says why (`leafEl.appendChild(view.containerEl)`): the `ItemView` mock builds
	 * `contentEl` with `document.createElement`, never attached to anything, so scanning it
	 * unattached answers "No elements found for include in page Context" rather than a result.
	 * `document.body.appendChild(view.containerEl)` is the same fix, done here rather than
	 * through the harness mount because this view needs no leaf frame or theme rules.
	 */
	it('reports no semantic violations on the surface AssetLibraryView actually draws', async () => {
		installObsidianDom();
		const view = makeAssetLibraryView(defaultAssetLibraryDeps());
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await flushPromises();

		try {
			// Load-bearing, not decorative (see the file header): without this, a scan that ran
			// before the tree mounted would find nothing and pass on an empty subtree. Refined
			// past the outer wrapper to `.rp-view-failure` — the `defaultAssetLibraryDeps()`
			// refusal bundle drives this mount to `status === 'failed'`, so the outer div alone
			// was already true before Task 13 drew anything, and would stay true even if the
			// failure branch stopped rendering.
			expect(view.contentEl.querySelector('.renovation-asset-library')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});

	/** And with a selection and an expanded category carried in, both `data-*` attributes on the
	 * one root element rather than a second paragraph (Task 11 re-review, M11's exposure moved
	 * one element along and was then removed rather than relocated a second time). */
	it('reports no semantic violations with an asset selected and a category expanded', async () => {
		installObsidianDom();
		const view = makeAssetLibraryView(defaultAssetLibraryDeps());
		document.body.appendChild(view.containerEl);
		await view.setState({ assetId: 'tile-01', expanded: ['material'] }, {} as ViewStateResult);
		await view.onOpen();
		await flushPromises();

		try {
			expect(view.contentEl.querySelector('.renovation-asset-library')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});

	/**
	 * The READY branch neither case above can reach: a catalogue that actually answers, so the
	 * toolbar, a shelf with a real row and the `.rp-view-notice` repair strip (with its own
	 * per-row `Open note` button) are all on screen at once — the surface Task 13 actually
	 * built, scanned rather than assumed. `.rp-al-toolbar` is this case's own load-bearing
	 * assertion, mirroring the two above: without it, a mount that regressed to the loading or
	 * failed branch would still pass an `axe.run` finding nothing wrong with an empty pane.
	 */
	it('reports no semantic violations on the ready shelves, beside a repair strip', async () => {
		installObsidianDom();
		const deps = defaultAssetLibraryDeps({
			queries: {
				...defaultAssetLibraryDeps().queries,
				listCatalogue: () =>
					Promise.resolve(
						ok({
							entries: [anAxeCatalogueEntry()],
							unreadable: [
								{ assetId: null, path: 'Renovation/Library/mystery.md', reason: 'no-id', code: null },
							],
						}),
					),
			},
		});
		const view = makeAssetLibraryView(deps);
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await flushPromises();

		try {
			expect(view.contentEl.querySelector('.rp-al-toolbar')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-view-notice')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});

	/**
	 * THE INSPECTOR, and it is the reason this block grew a sixth case rather than a sixth
	 * assertion. Task 14 shipped §3.5's panel and reported, as its own last concern, that no axe
	 * scan reaches it — and it is the largest new ARIA surface on this view: four sections each
	 * with three states, a definition list of live fields with inline errors, `aria-disabled`
	 * controls carrying their reason by `aria-describedby`, and a per-group override mark. Every
	 * other case in this block rests where the panel draws its one resting line or nothing at
	 * all, so all five would pass a build in which the inspector's ARIA is broken.
	 *
	 * **Scanned in its ANSWERED state, which is what `flushPromises()` buys and why it is
	 * load-bearing here in a way it is not everywhere.** `AssetInspector` starts three ticketed
	 * reads from a `watch` with `immediate: true`, and while they are out the Shape and *Used in*
	 * sections draw a single `<p>` loading line each. A scan taken one tick early therefore grades
	 * a strictly smaller surface — no `<dl>`, no list, no override mark — and reads identically to
	 * one that grades the larger. `.rp-al-used__override` is the assertion that tells the two
	 * apart, because it exists only once `listOverridingProjects` has answered.
	 *
	 * Mounted through `mountAssetLibraryHarness`, the same function `npm run harness` and
	 * `scripts/harness-shot.mjs` both drive, for the reason every case in this file gives: a
	 * fixture typed into this file would grade markup nobody keeps in sync with what renders.
	 */
	it('reports no semantic violations on the inspector, with an asset selected', async () => {
		const { view } = mountAssetLibraryHarness(document.body, 'base-cabinet-600');
		await flushPromises();

		try {
			// The panel is drawn AND its two ticketed sections have answered — see this case's
			// docblock for why the second assertion is not decoration.
			expect(view.contentEl.querySelector('.rp-al-inspector')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-al-fields__input')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-al-used__override')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-al-action--delete')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});

	/**
	 * §4's two action-bearing empty states, scanned on the day they ship — that paragraph's own
	 * requirement, and it names the mechanism as well as the rule: `planEditor.noZones` went seven
	 * slices unscanned because the case's fixture resolved to a DIFFERENT entry, so both cases
	 * below assert `.rp-empty-state` and `.rp-empty-state__action` are in the scanned DOM rather
	 * than trusting the fixture to have produced the state its name claims.
	 */
	it('reports no semantic violations on the empty state for a vault with no assets', async () => {
		const view = await mountLibraryWith([]);

		try {
			expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-empty-state__action')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});

	/**
	 * Reached by TYPING rather than by seeding a store: §6.1's query lives in
	 * `AssetLibraryStore`, and the only door into it from outside the tree is the field the user
	 * uses. Driving it through the input is also what makes this a scan of a state a user can
	 * actually reach — a store poked directly would grade the state and prove nothing about the
	 * route to it. Measured: with the two typing lines removed the case fails at
	 * `.rp-empty-state`, because a catalogue holding one entry draws a shelf.
	 */
	it('reports no semantic violations on the empty state for a search that matches nothing', async () => {
		const view = await mountLibraryWith([anAxeCatalogueEntry()]);
		const field = view.contentEl.querySelector<HTMLInputElement>('.rp-al-search__input');

		try {
			expect(field).not.toBeNull();
			// `definite`'s job, spelled out because this file imports no such helper: the
			// assertion above is what makes the cast honest rather than optimistic.
			const input = field as HTMLInputElement;
			input.value = 'nothing matches this';
			input.dispatchEvent(new Event('input'));
			await flushPromises();

			expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
			expect(view.contentEl.querySelector('.rp-empty-state__action')).not.toBeNull();

			const results = await axe.run(view.contentEl, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			await view.onClose();
			view.containerEl.remove();
		}
	});
});

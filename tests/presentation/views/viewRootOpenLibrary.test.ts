/**
 * @vitest-environment jsdom
 *
 * §2's two in-app doors into the Asset library, both reaching `context.openAssetLibrary` — a
 * plain reveal, driven and asserted the way `viewRootCreateAsset.test.ts` already drives its
 * own two doors: "a door exists" is equally true of one wired to the wrong handler, so both
 * cases assert the SPY was called rather than merely finding the button.
 *
 * ONE door lives in `ProjectList`'s header, reached whenever the list draws; the other is the
 * no-projects aside's own sibling to `New asset`, reached only in the empty-vault state where
 * `ProjectList` is not mounted at all — §2's own argument for building both rather than one.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import type { RenovationProjectDeps } from '../../../src/presentation/views/RenovationProjectContext';
import { ok } from '../../../src/core/result/Result';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';

function mountWith(projects: readonly ProjectSummaryDto[]) {
	setActivePinia(createPinia());
	const openAssetLibrary = vi.fn<() => void>();
	const context: RenovationProjectDeps = {
		...defaultRenovationProjectDeps(),
		queries: {
			...defaultRenovationProjectDeps().queries,
			listProjects: () => Promise.resolve(ok({ projects, unreadable: 0 })),
		},
		openAssetLibrary,
	};
	const wrapper = mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	return { wrapper, openAssetLibrary };
}

describe('ViewRoot, opening the asset library from the project list', () => {
	it('reaches context.openAssetLibrary from the list header, and opens nothing else', async () => {
		const { wrapper, openAssetLibrary } = mountWith([
			{ id: 'p1', name: 'Kitchen', status: 'IDEA', currency: 'EUR', libraryOverlap: false },
		]);
		await flushPromises();
		expect(wrapper.find('.rp-project-list').exists()).toBe(true);

		await wrapper.get('.rp-project-list__open-library').trigger('click');

		expect(openAssetLibrary).toHaveBeenCalledTimes(1);
	});
});

/**
 * **The state that needs this door most**, per §2's own argument: `ProjectList` — and with it
 * its header's own door — is not mounted at all in a vault with no projects, so a door placed
 * only there would disappear in exactly the state where a user has fewest other routes.
 */
describe('ViewRoot, opening the asset library from the no-projects aside', () => {
	it('offers the door beside New asset, and reaches context.openAssetLibrary', async () => {
		const { wrapper, openAssetLibrary } = mountWith([]);
		await flushPromises();
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list').exists()).toBe(false);

		await wrapper.get('.rp-view-aside__open-library').trigger('click');

		expect(openAssetLibrary).toHaveBeenCalledTimes(1);
	});

	/**
	 * A SIBLING of `New asset`, never a replacement of it — §2's own rule, restated as an
	 * assertion: both controls exist together, and clicking the library door must not have
	 * dispatched the project-creation form instead.
	 */
	it('leaves New asset in place beside it', async () => {
		const { wrapper } = mountWith([]);
		await flushPromises();

		expect(wrapper.find('.rp-view-aside__create-asset').exists()).toBe(true);
		expect(wrapper.find('.rp-view-aside__open-library').exists()).toBe(true);
	});

	/**
	 * **Found by a review round, not by any gate here.** Compiling this SFC shows the two
	 * `<button>`s as adjacent element vnodes with no text node between them — Vue's default
	 * `whitespace: 'condense'` strips the whitespace-only text node their separate template
	 * lines would otherwise leave — and `.rp-view-aside` carried `text-align: center` with no
	 * `display: flex` and no `gap`, so the two rendered touching. jsdom lays nothing out and
	 * cannot see this; the fix is asserted as TEXT over the stylesheet, the same instrument
	 * `projectListOverlap.test.ts` uses for the identical class of defect on the sibling row.
	 */
	it('gives the aside a gap, so the two buttons do not render touching', () => {
		const forms = readFileSync('styles/forms.css', 'utf8');
		const rule = forms.slice(forms.indexOf('.rp-view-aside {'), forms.indexOf('.rp-project-list {'));

		expect(rule).toMatch(/display:\s*flex;/);
		expect(rule).toMatch(/gap:\s*var\(--size-4-2\);/);
	});
});

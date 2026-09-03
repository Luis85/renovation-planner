/**
 * @vitest-environment jsdom
 *
 * THE FOOT LINE (design spec §5, region 7): the key legend at the leading edge and `New asset`
 * at the trailing one, present in both the empty and the populated state. This is also where
 * today's duplication goes away — `ProjectList`'s own header button and `ViewRoot`'s
 * `.rp-view-aside` were two independently-decided homes for one action.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const ONE: ProjectSummaryDto[] = [
	{
		id: 'p1',
		name: 'Kitchen',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
	},
];

describe('ProjectList foot line', () => {
	it('holds the key legend and New asset, and nothing else', () => {
		const wrapper = mount(ProjectList, { props: { projects: ONE, unreadable: 0 } });
		const foot = wrapper.find('.rp-project-list__foot');

		expect(foot.find('.rp-project-list__keys').exists()).toBe(true);
		expect(foot.find('.rp-view-aside__create-asset').exists()).toBe(true);
	});

	it('has exactly ONE New asset affordance on the whole surface', () => {
		// The duplication this region removes: `ProjectList`'s header button and `ViewRoot`'s
		// `.rp-view-aside` were two independently-decided homes for one action.
		const wrapper = mount(ProjectList, { props: { projects: ONE, unreadable: 0 } });

		expect(wrapper.findAll('.rp-view-aside__create-asset')).toHaveLength(1);
		expect(wrapper.find('.rp-project-list__create-asset').exists()).toBe(false);
	});

	it('emits createAsset from the foot', async () => {
		const wrapper = mount(ProjectList, { props: { projects: ONE, unreadable: 0 } });

		await wrapper.find('.rp-view-aside__create-asset').trigger('click');

		expect(wrapper.emitted('createAsset')).toHaveLength(1);
	});

	it('names the modifier in the legend rather than hard-coding one', () => {
		const legend = mount(ProjectList, { props: { projects: ONE, unreadable: 0 } })
			.find('.rp-project-list__keys')
			.text();

		expect(legend).toContain('open');
		expect(legend).toMatch(/⌘|Ctrl/);
		// `{mod}` is resolved at the call site — a fact about the machine, not the language —
		// so an unresolved hole would be a visible bug report rather than a silent one.
		expect(legend).not.toContain('{mod}');
	});

	/**
	 * §2 of Task 9's carried constraints (Task 7's review finding): the no-match block must
	 * stay the LAST thing in the list region, so the foot lands BELOW it rather than between
	 * the groups and the no-match block. Asserted on the rendered ORDER, not on both existing —
	 * a foot placed above the no-match block would satisfy every other case in this file.
	 */
	it('sits below the no-match block, not above it', async () => {
		const wrapper = mount(ProjectList, { props: { projects: ONE, unreadable: 0 } });
		await wrapper.get('.rp-project-filter__input').setValue('no such project');

		const html = wrapper.html();
		const noMatchAt = html.indexOf('rp-project-list__no-match');
		const footAt = html.indexOf('rp-project-list__foot');

		expect(noMatchAt).toBeGreaterThan(-1);
		expect(footAt).toBeGreaterThan(noMatchAt);
	});
});

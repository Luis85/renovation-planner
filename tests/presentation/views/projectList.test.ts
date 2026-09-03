/**
 * @vitest-environment jsdom
 *
 * The list, and the one rule slice 14 spent a whole decision on: a list and the
 * unreadable notice are ADDITIVE. `unreadable > 0` means the vault holds projects this build
 * could not read — it never replaces the ones it could.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import { t } from '../../../src/presentation/i18n/strings';

// `libraryOverlap: false` on both: design slice 19's §83 marker is not what any case in
// this file is about, and an ordinary row is the state they all describe. The marked row
// has its own file (`projectListOverlap.test.ts`).
const PROJECTS = [
	{ id: 'p1', name: 'Kitchen', status: 'IDEA', currency: 'EUR', libraryOverlap: false },
	// 'PLANNING' is not a member of `ProjectStatus` — deliberately, so this fixture exercises
	// both the recognised and the unrecognised branch of the status label at once.
	{ id: 'p2', name: 'Bathroom', status: 'PLANNING', currency: 'EUR', libraryOverlap: false },
];

describe('ProjectList', () => {
	it('renders one row per project, naming each', () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(2);
		expect(wrapper.text()).toContain('Kitchen');
		expect(wrapper.text()).toContain('Bathroom');
	});

	it('emits open with that row’s id', async () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.findAll('.rp-project-list__row')[1].trigger('click');

		expect(wrapper.emitted('open')).toEqual([['p2']]);
	});

	it('offers a create affordance even when the list is populated', async () => {
		// Finding 3: the empty state's button unmounts the moment a project exists, and there
		// is no other entry point — so without this a user creates one project and never a
		// second. It emits rather than opening anything: `ViewRoot` owns the one handler.
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.get('.rp-project-list__create').trigger('click');

		expect(wrapper.emitted('create')).toHaveLength(1);
	});

	/**
	 * §2's own placement: the Assets control sits in this header beside `New asset`, reached
	 * whenever the list — not the empty state — is what a vault draws. It emits rather than
	 * opening anything itself, the same rule `create`/`createAsset` already follow.
	 */
	it('offers a door into the asset library', async () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.get('.rp-project-list__open-library').trigger('click');

		expect(wrapper.emitted('openLibrary')).toHaveLength(1);
	});

	it('gives every row a real button, not a clickable div', () => {
		// A div with a click handler is neither focusable nor announced. There is no href
		// here, so a link would be the wrong element in the other direction.
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		for (const row of wrapper.findAll('.rp-project-list__row')) {
			expect(row.element.tagName).toBe('BUTTON');
			expect(row.attributes('type')).toBe('button');
		}
	});

	/**
	 * The global constraint this task adds to the brief's own draft: "a status must not
	 * render as a raw enum code". A recognised status resolves through
	 * `PROJECT_STATUS_LABELS`/`tr`, the same table `NewProjectForm`'s status control uses —
	 * asserted against the real English copy so a regression to `{{ project.status }}` (which
	 * would print `IDEA`, not `Idea`) fails here.
	 */
	it('renders a recognised status as its translated label, not the raw code', () => {
		const wrapper = mount(ProjectList, { props: { projects: [PROJECTS[0]] } });

		expect(wrapper.get('.rp-project-list__status').text()).toBe(t('en', 'form.new-project.status.idea'));
		expect(wrapper.text()).not.toContain('IDEA');
	});

	/**
	 * `ProjectSummaryDto.status` is `string`, not `ProjectStatus` — a note this build cannot
	 * recognise the lifecycle stage of still needs a row, so the fallback is the raw value
	 * rather than a thrown lookup or an invented locale key for a value nothing in the domain
	 * can actually produce.
	 */
	it('renders an unrecognised status as its own raw value rather than throwing', () => {
		const wrapper = mount(ProjectList, { props: { projects: [PROJECTS[1]] } });

		expect(wrapper.get('.rp-project-list__status').text()).toBe('PLANNING');
	});

	/**
	 * §2's own door made this header FOUR flex children on a `space-between` row that had
	 * carried three since it was last captured at 1280 and 460 (`styles/forms.css`'s own
	 * comment). No capture exists of the four-child row — this environment has no Chromium —
	 * so `flex-wrap` is the honest default rather than a verified layout: it is what stops the
	 * excess item from being squeezed toward zero width or overflowing the pane at a width too
	 * narrow to hold all four, which `styles/forms.css`'s own comment states rather than
	 * claims verified. Asserted as TEXT over the stylesheet, since jsdom lays nothing out.
	 */
	it('lets the header wrap rather than squeezing its fourth child', () => {
		const forms = readFileSync('styles/forms.css', 'utf8');
		const rule = forms.slice(
			forms.indexOf('.rp-project-list__header {'),
			forms.indexOf('.rp-project-list__title {'),
		);

		expect(rule).toMatch(/flex-wrap:\s*wrap;/);
	});
});

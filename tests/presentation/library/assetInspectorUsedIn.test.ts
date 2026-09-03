/**
 * @vitest-environment jsdom
 *
 * §3.5 section 3 — *Used in*: the per-project groups, their three states, and the two rules a
 * row can be drawn wrongly by (a truthy path test, and a key that is not `projectId`).
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetInspectorUsedIn from '../../../src/presentation/library/AssetInspectorUsedIn.vue';
import type { ReferencingGroup } from '../../../src/application/queries/ListRequirementsReferencing';
import { createProjectId, type ProjectId } from '../../../src/domain/project/ProjectId';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import type { SectionStatus } from '../../../src/presentation/library/ticketedSection';

function aGroup(overrides: Partial<ReferencingGroup> = {}): ReferencingGroup {
	return {
		projectId: createProjectId(),
		projectName: 'Kitchen refit',
		requirementIds: [createRequirementId()],
		...overrides,
	};
}

function mountSection(options: {
	groups?: readonly ReferencingGroup[];
	overriding?: readonly ProjectId[];
	status?: SectionStatus;
}) {
	return mount(AssetInspectorUsedIn, {
		props: {
			groups: options.groups ?? [],
			overriding: options.overriding ?? [],
			status: options.status ?? 'ready',
			error: null,
		},
	});
}

describe('AssetInspectorUsedIn', () => {
	it('renders a root label for a project whose path is the empty string', () => {
		// `''` is a SUPPLIED answer — a `Project.md` at the vault root, where `parentOf` slices
		// to the last `/` and derives nothing. A truthy test would suppress exactly the row the
		// path was added to disambiguate and draw it identically to a row with no path at all.
		const section = mountSection({ groups: [aGroup({ projectPath: '' })] });

		expect(section.get('.rp-al-used__path').text()).toBe('Vault root');
	});

	it('draws no path element at all for a group the query gave none', () => {
		const section = mountSection({ groups: [aGroup()] });

		expect(section.find('.rp-al-used__path').exists()).toBe(false);
	});

	it('draws two identically named projects in the same folder as two distinct rows', () => {
		// Two projects legitimately sharing a name AND a folder: `Project.create` trims a name
		// and refuses only an empty one, and two notes declaring `type: renovation-project` can
		// sit in one directory. `projectId` is the only field unique by construction, which is
		// why it is both the `:key` and what each row publishes.
		//
		// **WHAT THIS CASE CANNOT FALSIFY, stated rather than implied**: swapping the `:key` to
		// the name-and-path pair passes it, measured — Vue renders both elements under a
		// duplicate key and only mis-patches per-row STATE, and these rows hold none. The
		// identity that is checkable today is the one below; the `:key` is the rule kept for the
		// row that grows state, and the day it does this case will need a state-carrying
		// assertion rather than a count.
		const section = mountSection({
			groups: [
				aGroup({ projectName: 'Bathroom', projectPath: 'Renovation' }),
				aGroup({ projectName: 'Bathroom', projectPath: 'Renovation' }),
			],
		});

		const rows = section.findAll('.rp-al-used__row');
		expect(rows).toHaveLength(2);
		expect(rows[0]?.attributes('data-project-id')).not.toBe(rows[1]?.attributes('data-project-id'));
	});

	it('marks a group whose project overrides this price with a mark AND a word', () => {
		const overriding = createProjectId();
		const section = mountSection({
			groups: [aGroup({ projectId: overriding }), aGroup()],
			overriding: [overriding],
		});

		const marked = section.findAll('.rp-al-used__override');
		expect(marked).toHaveLength(1);
		// Both halves: §85 refuses a tint alone, so the mark is a CSS-drawn `aria-hidden` span
		// beside a word rather than a colour on the row.
		expect(marked[0]?.text()).toContain('Overrides this price');
		expect(marked[0]?.find('.rp-al-used__override-mark').attributes('aria-hidden')).toBe('true');
	});

	it('says the asset is used nowhere only once the read has answered', () => {
		expect(mountSection({ status: 'loading' }).text()).not.toContain('Not used in any project');
		expect(mountSection({ status: 'ready' }).text()).toContain('Not used in any project');
	});

	it('reports a refused usage read as a refusal rather than as an unused asset', () => {
		// The first version of this section offered groups or "not used" and nothing else, so an
		// unreadable usage graph rendered as an unused asset — the difference between a safe
		// deletion and a destructive one.
		const section = mountSection({ status: 'failed' });

		expect(section.find('.rp-al-inspector__refusal').exists()).toBe(true);
		expect(section.text()).not.toContain('Not used in any project');
	});
});

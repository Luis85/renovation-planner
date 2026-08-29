/**
 * @vitest-environment jsdom
 *
 * The project list against an index that was not there yet when the pane mounted.
 *
 * Obsidian RESTORES ITS LEAVES BEFORE `onLayoutReady`, and the Project Index scan runs from
 * `onLayoutReady` (SDD §47 — a vault-wide scan competing with workspace restoration builds a
 * partial index that looks complete). So a Renovation Project leaf reopened with the app
 * hydrates against an EMPTY index: `listProjects` iterates nothing, answers a legitimate
 * `ok({ projects: [], unreadable: 0 })`, and the pane draws the actionable "no projects yet"
 * empty state over a vault full of them — indefinitely, because this view subscribed to
 * nothing and `hydrate`'s only two callers were `onMounted` and `onCreateProject`.
 *
 * `projectIndex.events.ts` documents that exact hazard and closes it for the Plan Editor with
 * `ProjectIndexRebuilt`; this file is the same closure for the project surface. Reported in
 * review as a P1, after an earlier round on this branch found the deleted-row half of the same
 * absence (`viewRootOpenProject.test.ts`) and recorded this one as still open.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { unavailableRenovationProjectCommands } from '../../../src/presentation/views/renovationProjectCommands';
import { ok } from '../../../src/core/result/Result';

const KITCHEN = { id: 'p1', name: 'Kitchen', status: 'IDEA' };

/**
 * Mounts the view over an index that is EMPTY at mount and holds one project afterwards —
 * the restored-leaf race spelled as the query answering differently on its second call, which
 * is precisely what a rebuild between the two makes true.
 *
 * The subscription is captured rather than stubbed away: a test that handed `onProjectsChanged`
 * a no-op would pass against a view that subscribed to nothing.
 */
async function mountBeforeTheScan() {
	setActivePinia(createPinia());
	let projects: readonly (typeof KITCHEN)[] = [];
	const listProjects = vi.fn<() => Promise<unknown>>(() => Promise.resolve(ok({ projects, unreadable: 0 })));
	const listeners: (() => void)[] = [];
	const unsubscribe = vi.fn<() => void>();
	const onProjectsChanged = vi.fn<(listener: () => void) => () => void>((listener) => {
		listeners.push(listener);
		return unsubscribe;
	});
	const wrapper = mount(ViewRoot, {
		global: {
			provide: {
				[RENOVATION_PROJECT_CONTEXT as symbol]: {
					queries: { listProjects },
					commands: unavailableRenovationProjectCommands(),
					openProject: () => Promise.resolve('opened'),
					onProjectsChanged,
				},
			},
		},
	});
	await flushPromises();

	/** What `startPersistence` publishing `ProjectIndexRebuilt` reaches this view as. */
	const rebuildTheIndex = async (): Promise<void> => {
		projects = [KITCHEN];
		for (const listener of listeners) listener();
		await flushPromises();
	};
	return { wrapper, listProjects, onProjectsChanged, unsubscribe, rebuildTheIndex };
}

describe('ViewRoot, and an index built after the pane was restored', () => {
	it('re-reads the list when the index is rebuilt, so a restored leaf stops claiming the vault is empty', async () => {
		const { wrapper, listProjects, rebuildTheIndex } = await mountBeforeTheScan();
		// The defect as the user meets it: the actionable empty state, over a populated vault.
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);

		await rebuildTheIndex();

		expect(listProjects).toHaveBeenCalledTimes(2);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);
	});

	it('keeps the rebuilt list when the mount read was still in flight and settles last', async () => {
		// The overlap is not hypothetical for THIS caller, which is what makes the store's
		// hydration ticket load-bearing rather than a precaution: the restored leaf is mid-read
		// against the EMPTY index at the moment `startPersistence` publishes the rebuild. Both
		// reads are in flight, and the mount one — issued first, against the emptier index —
		// is the one that may settle last. Without the ticket it lands on top and restores the
		// very empty list the rebuild exists to replace, with no error anywhere.
		setActivePinia(createPinia());
		const settle: ((projects: readonly (typeof KITCHEN)[]) => void)[] = [];
		const listProjects = vi.fn<() => Promise<unknown>>(
			() =>
				new Promise((resolve) => {
					settle.push((projects) => resolve(ok({ projects, unreadable: 0 })));
				}),
		);
		const listeners: (() => void)[] = [];
		const wrapper = mount(ViewRoot, {
			global: {
				provide: {
					[RENOVATION_PROJECT_CONTEXT as symbol]: {
						queries: { listProjects },
						commands: unavailableRenovationProjectCommands(),
						openProject: () => Promise.resolve('opened'),
						onProjectsChanged: (listener: () => void) => {
							listeners.push(listener);
							return () => undefined;
						},
					},
				},
			},
		});
		await flushPromises();

		for (const listener of listeners) listener();
		await flushPromises();
		expect(settle).toHaveLength(2);

		// The rebuild's read answers first, then the mount's — the losing order.
		settle[1]([KITCHEN]);
		await flushPromises();
		settle[0]([]);
		await flushPromises();

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
	});

	it('subscribes once and releases the subscription when the pane unmounts', async () => {
		// Obsidian REUSES a view, so a subscription outliving its Vue app would re-hydrate a
		// store belonging to an app that is gone — and stack a second listener on every reopen.
		const { wrapper, onProjectsChanged, unsubscribe } = await mountBeforeTheScan();
		expect(onProjectsChanged).toHaveBeenCalledTimes(1);
		expect(unsubscribe).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});
});

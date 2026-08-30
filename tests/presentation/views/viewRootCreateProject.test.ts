/**
 * @vitest-environment jsdom
 *
 * The empty state's button, end to end: it opens the form, and a created project reaches
 * the READ MODEL. The second half is the one that matters — a create whose result never
 * reaches the store is the exact failure a re-hydrate exists to prevent.
 *
 * The second case stops at `RenovationProjectStore.projects`, not at rendered DOM: at the time
 * it was written `ViewRoot` drew no project list yet, and asserting on `wrapper.text()` would
 * have silently started requiring a component that task did not build. Design slice 16's
 * `ProjectList.vue` (Task 8) now reads that exact store field, and the last case in this file
 * is what asserts the two are actually connected.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { useRenovationProjectStore } from '../../../src/presentation/stores/RenovationProjectStore';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { ok } from '../../../src/core/result/Result';

function deps(listProjects: () => Promise<unknown>) {
	return {
		queries: { listProjects },
		commands: {
			createProject: {
				execute: vi.fn<() => Promise<unknown>>(() =>
					Promise.resolve(ok({ project: { entity: { id: 'p1' } } })),
				),
			},
		},
		openProject: vi.fn<() => Promise<'opened'>>(() => Promise.resolve('opened')),
		onProjectsChanged: () => () => undefined,
	};
}

describe('ViewRoot, creating a project', () => {
	it('opens the New Project form from the empty state action', async () => {
		setActivePinia(createPinia());
		const context = deps(() => Promise.resolve(ok({ projects: [], unreadable: 0 })));
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(wrapper.findComponent(NewProjectForm).exists()).toBe(true);
	});

	it('re-reads the list after a successful create, so the new project reaches the store', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		let projects: readonly { id: string; name: string; status: string }[] = [];
		const listProjects = vi.fn<() => Promise<unknown>>(() => Promise.resolve(ok({ projects, unreadable: 0 })));
		const context = deps(listProjects);
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();
		// The write lands, and the vault now holds one project.
		projects = [{ id: 'p1', name: 'Kitchen', status: 'IDEA' }];
		wrapper.findComponent(NewProjectForm).vm.$emit('submit', { name: 'Kitchen' });
		await flushPromises();

		expect(listProjects).toHaveBeenCalledTimes(2);
		expect(useRenovationProjectStore(pinia).projects).toEqual(projects);
	});

	/**
	 * `openDialog` THROWS if a dialog is already open (`DialogStackingError`) — sequential,
	 * never stacked. `onCreateProject` guards against ever reaching that call a second time
	 * while one is in flight, rather than relying on nobody double-clicking: two clicks fired
	 * back to back (no `flushPromises` between them, so both land before the first `await`
	 * inside the handler resolves) must open exactly one dialog and raise nothing.
	 */
	it('does not open a second dialog on a double press', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const context = deps(() => Promise.resolve(ok({ projects: [], unreadable: 0 })));
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		const openDialog = vi.spyOn(useDialogStore(pinia), 'openDialog');

		const action = wrapper.get('.rp-empty-state__action');
		await Promise.all([action.trigger('click'), action.trigger('click')]);
		await flushPromises();

		expect(openDialog).toHaveBeenCalledTimes(1);
		expect(wrapper.findAllComponents(NewProjectForm)).toHaveLength(1);
	});

	/**
	 * The one ref `ViewRoot` declares (`newProjectBusy`) has to reach BOTH the descriptor's
	 * `busy` (which `FormDialog` reads to refuse Cancel) and the form's own `busy` PROP
	 * (which `NewProjectForm`'s `watchEffect` writes `submitting` into) — passing it to only
	 * one of the two is this mechanism's most-repeated defect, and every line still reads as
	 * correct when it happens. Proved here by MOVEMENT, not by inspecting the wiring: a real
	 * submit through the mounted form, with the dispatch left pending, must make Cancel
	 * `aria-disabled` — which is only true if `props.busy` received the ref (so the form's
	 * `watchEffect` ran and set it) AND the descriptor's `busy` is the SAME ref (so
	 * `FormDialog` reads the write). Either wiring dropped and this assertion sees `busy`
	 * stuck at `false` for the whole write, exactly like the broken drafts this plan records.
	 */
	it('shares one busy ref between the form and the dialog: Cancel disables while the real dispatch is in flight', async () => {
		setActivePinia(createPinia());
		// Definite assignment, not `| null`: the assignment happens inside the promise executor,
		// which TypeScript's control flow cannot see running, so the declared union narrows to
		// `null` at every later read and `settle?.()` stops being callable. The executor runs
		// synchronously, so the value is there. Same spelling `drawPolygonTool.test.ts` uses.
		let settle!: () => void;
		const pending = new Promise<void>((resolve) => {
			settle = resolve;
		});
		const context = {
			queries: { listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })) },
			commands: {
				createProject: {
					execute: vi.fn<() => Promise<unknown>>(async () => {
						await pending;
						return ok({ project: { entity: { id: 'p1' } } });
					}),
				},
			},
			openProject: vi.fn<() => Promise<'opened'>>(() => Promise.resolve('opened')),
		onProjectsChanged: () => () => undefined,
		};
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();

		// Before the write starts: an ordinary, cancellable dialog.
		expect(wrapper.get('[data-rp-action="cancel"]').attributes('aria-disabled')).toBe('false');

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		// The dispatch is still pending (nothing has called `settle` yet), and Cancel is
		// disabled only if the shared ref actually carried `true` from the form out to the
		// descriptor `FormDialog` reads.
		expect(wrapper.get('[data-rp-action="cancel"]').attributes('aria-disabled')).toBe('true');

		settle();
		await flushPromises();

		// The write settled, the dialog resolved and closed — nothing left to assert `busy`
		// against, which is itself the honest end state of a successful create.
		expect(wrapper.find('.rp-dialog').exists()).toBe(false);
	});

	/**
	 * `onCreateProject`'s `if (result === 'cancel') return;` — untested until now. A Cancel
	 * closes the dialog without ever having dispatched `createProject`, so re-hydrating would
	 * be a pointless extra read at best; this pins that the guard actually takes the early
	 * return rather than falling through to `store.hydrate` regardless of the result.
	 */
	it('does not re-hydrate when the dialog is cancelled', async () => {
		const listProjects = vi.fn<() => Promise<unknown>>(() =>
			Promise.resolve(ok({ projects: [], unreadable: 0 })),
		);
		setActivePinia(createPinia());
		const context = deps(listProjects);
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		expect(listProjects).toHaveBeenCalledTimes(1); // the mount's own onMounted hydrate

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent(NewProjectForm).exists()).toBe(true);

		await wrapper.get('[data-rp-action="cancel"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-dialog').exists()).toBe(false);
		expect(context.commands.createProject.execute).not.toHaveBeenCalled();
		// Still just the one read from mount — Cancel took the early return.
		expect(listProjects).toHaveBeenCalledTimes(1);
	});

	/**
	 * The rule design slice 14 spent a whole decision on, proved at the component this task
	 * wires it into: a list and the unreadable notice are ADDITIVE, never either-or.
	 * `unreadable > 0` means the vault holds projects this build could not read — it never
	 * replaces the ones it could, so both `.rp-project-list__row` and `.rp-view-notice` must
	 * render together.
	 */
	it('draws the project list and the unreadable notice together', async () => {
		setActivePinia(createPinia());
		const context = deps(() =>
			Promise.resolve(ok({ projects: [{ id: 'p1', name: 'Kitchen', status: 'IDEA' }], unreadable: 2 })),
		);
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);
		expect(wrapper.find('.rp-view-notice').exists()).toBe(true);
	});
});

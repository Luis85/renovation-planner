/**
 * @vitest-environment jsdom
 *
 * **The THIRD surface the shared save-state store's seed reaches, and the one that had no case.**
 *
 * `save-state-store.ts` seeds its vault-pause ref from `activeWriteIncidentRegistry()` at setup,
 * and the project view's work section calls that same `useSaveStateStore()` — so it is gated by
 * an open write incident without anything under `views/work/` being edited for it. The Plan
 * Editor and the Asset Designer each got a case when that seed landed; this one was claimed in
 * three documents and driven by nothing, which is the shape this repository's own rules call an
 * unchecked comment.
 *
 * Driven through `useProjectWorkActions` itself, inside a real component `setup` — it registers
 * an `onBeforeUnmount` and resolves Pinia stores, so there is no honest way to call it outside
 * one. The read beside it is the REAL `useLiveRead` composable, which is the whole of what
 * `useProjectWorkRead` is, over a source that answers a valid empty `ProjectWorkRead`. That
 * matters: `useLiveRead`'s own `paused` is `loading || error !== null`, so a read with no source
 * behind it is paused unconditionally and would have made both cases below pass for a reason that
 * has nothing to do with an incident. `flushPromises` is what lets the mount read settle before
 * the gate is read.
 *
 * **What it does NOT claim**: that any control is visibly dimmed. `blocked` is what
 * `ProjectWorkState.vue` binds to its toolbar and rows; whether a themed vault draws that as
 * disabled is appearance, which jsdom cannot measure and nothing on this branch has ever run in a
 * vault to see.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ok } from '../../../../src/core/result/Result';
import { installWriteIncidentRegistry } from '../../../../src/application/incidents/WriteIncidentRegistry';
import type { ProjectWorkRead } from '../../../../src/application/queries/schedule/ProjectWork';
import { useLiveRead } from '../../../../src/presentation/composables/live-read';
import { useProjectWorkActions } from '../../../../src/presentation/views/work/projectWorkActions';
import { defaultRenovationProjectDeps } from '../../../helpers/makeRenovationProjectView';
import { makeProject } from '../../../helpers/entities';
import { installObsidianDom } from '../../../helpers/dom';
import { installOpenWriteIncident, installQuietWriteIncidents } from '../../../helpers/writeIncidents';

installObsidianDom();

/** A project with no work at all — the read has to SUCCEED, and nothing here reads its rows. */
const emptyWork = (): ProjectWorkRead => ({
	project: makeProject(),
	rows: [],
	rooms: [],
	unreadablePlans: 0,
	roomsIncomplete: false,
});

/**
 * Whether the work section refuses to dispatch, read at `blocked` — the member
 * `ProjectWorkState.vue` binds to its toolbar and every row, and the one `useProjectWorkActions`
 * exports. `paused` is its internal first term and is not reachable from outside; asserting the
 * exported value is what makes this a case about the consumed behaviour rather than about an
 * expression.
 */
async function blockedForWorkSection(): Promise<boolean> {
	let read!: () => boolean;
	const wrapper = mount(
		defineComponent({
			setup() {
				const live = useLiveRead<ProjectWorkRead>({
					read: () => Promise.resolve(ok(emptyWork())),
					onChanged: () => () => undefined,
				});
				const actions = useProjectWorkActions(defaultRenovationProjectDeps(), live);
				read = () => actions.blocked.value;
				return () => h('div');
			},
		}),
		{ global: { plugins: [createPinia()] } },
	);
	await flushPromises();
	const blocked = read();
	wrapper.unmount();
	return blocked;
}

describe('the project view’s work section under a vault-wide write incident', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
	});

	it('is paused when the section mounts while the vault holds an open incident', async () => {
		await installOpenWriteIncident();

		expect(await blockedForWorkSection()).toBe(true);
	});

	/**
	 * The control, and not a redundant one: `blocked` is an OR over five terms in all
	 * (`read.paused`, the save-state gate, `context.readOnly`, a local `loading` and a `saving`
	 * indicator), so without this the case above would pass on a build where the seed does nothing
	 * and one of the other four happened to be true — which is exactly what the first draft of
	 * this file did, with no source behind the read.
	 */
	it('is live when the registry holds nothing', async () => {
		installQuietWriteIncidents();

		expect(await blockedForWorkSection()).toBe(false);
	});
});

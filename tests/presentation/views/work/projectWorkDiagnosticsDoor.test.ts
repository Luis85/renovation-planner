// @vitest-environment jsdom
/**
 * L-34's door on the schedule surface: `view.project.some-plans-unreadable` tells the user to
 * open the diagnostics report, and until this there was no control on this surface that did.
 *
 * Driven through the REAL downstream stack rather than against a fabricated read, because the
 * gate is `read.data.value.unreadablePlans` and a hand-built `ProjectWorkRead` would assert
 * that a number this file wrote reaches a `v-if` this file wrote. Damaging a plan note and
 * republishing `ProjectIndexRebuilt` is what `downstreamNavigation.test.ts` already does to
 * produce that count, and it is the path a vault takes.
 *
 * `ProjectWorkState.vue` has no `all-plans-unreadable` arm to stay off — the sentence renders
 * unconditionally on the count — so unlike `ProjectDetail.vue` there is no second gate here.
 * That asymmetry is the reason this case lives beside the surface rather than being folded
 * into the detail state's.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../../helpers/downstream';
import { downstreamFloor } from '../../../helpers/downstreamFloor';
import { downstreamView } from '../../../helpers/downstreamView';
import { expectDefined } from '../../../helpers/domain';
import { installObsidianDom } from '../../../helpers/dom';
import { tr } from '../../../../src/presentation/i18n/strings';

installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it('offers the diagnostics report beside the unreadable-plans sentence, and presses the injected door once', async () => {
	const rig = await downstreamStack(), other = await downstreamFloor(rig);
	const view = await downstreamView(rig, 'schedule');
	try {
		const open = vi.spyOn(view.context, 'openDiagnosticsReport');
		const path = expectDefined(rig.persistence.index.getPath(other.plan.id), 'other Plan path');
		const original = expectDefined(rig.stack.vault.entries.get(path), 'other Plan bytes');
		rig.stack.vault.entries.set(path, original.replace(/^name:.*$/m, 'name: []'));
		await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' });
		await flushPromises();

		expect(view.wrapper.text()).toContain(tr('view.project.some-plans-unreadable', { count: '1' }));
		const button = view.wrapper.get('[data-rp-action="open-diagnostics"]');
		expect(button.text()).toBe(tr('command.show-diagnostics-report'));

		await button.trigger('click');

		expect(open).toHaveBeenCalledTimes(1);
	} finally {
		view.dispose();
	}
});

it('offers none while every plan note reads', async () => {
	const rig = await downstreamStack();
	await downstreamFloor(rig);
	const view = await downstreamView(rig, 'schedule');
	try {
		expect(view.wrapper.text()).not.toContain(tr('view.project.some-plans-unreadable', { count: '1' }));
		expect(view.wrapper.findAll('[data-rp-action="open-diagnostics"]')).toHaveLength(0);
	} finally {
		view.dispose();
	}
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';

installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

/** The downstream plan plus Work on `wall-a` that bounds no room and waits on the Room's sanding (ADR-0030). */
async function roomlessStack() {
	const rig = await downstreamStack();
	const loaded = expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'Plan'), renovation = expectDefined(loaded.entity.renovation, 'Work register');
	const border = { id: 'work-border', targetId: 'wall-a', title: 'Repoint the border wall', description: '', order: 1, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: ['work-sand'] };
	expectOk(await rig.persistence.plans.save(expectOk(withPlanRenovation(loaded.entity, { ...renovation, work: [...renovation.work, border] })), loaded.version));
	const view = await downstreamView(rig, 'schedule');
	const row = () => view.wrapper.get('[data-work-id="work-border"]');
	const rowButton = (text: string) => expectDefined(row().findAll('button').find(button => button.text() === text), text);
	return { rig, view, row, rowButton };
}

it('lists room-less Work with no room and the Work it waits on, and opens its floor with no room', async () => {
	const { rig, view, row, rowButton } = await roomlessStack();
	try {
		expect(row().text()).toContain(tr('renovation.target.none'));
		expect(row().text()).toContain(tr('renovation.blocked', { names: 'Sand floor' }));
		const open = vi.spyOn(view.context, 'openPlan');
		await rowButton(tr('schedule.open-floor')).trigger('click'); await flushPromises();
		expect(open).toHaveBeenCalledExactlyOnceWith(rig.plan.id, { planId: rig.plan.id, workId: 'work-border' });
	} finally { view.dispose(); }
});

it('edits room-less Work, and reports an Undo that faults rather than dropping it', async () => {
	const { view, rowButton } = await roomlessStack();
	try {
		const make = view.work.renovation.command.bind(view.work.renovation), fault = new Error('Undo failed');
		vi.spyOn(view.work.renovation, 'command').mockImplementation((...args) => { const command = make(...args); return { execute: () => command.execute(), undo: () => Promise.reject(fault) }; });
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		await rowButton(tr('renovation.edit.work')).trigger('click'); await flushPromises();
		const form = view.wrapper.get('[data-rp-form="renovation"]');
		expect(form.get<HTMLInputElement>('input[name="title"]').element.value).toBe('Repoint the border wall');
		await form.get('input[name="schedule-start"]').setValue('2026-09-10'); await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
		await view.button(tr('editor.context.undo')).trigger('click'); await flushPromises();
		expect(report).toHaveBeenCalledExactlyOnceWith(fault, view.context.commands.logger, 'project.work-history-failed');
	} finally { view.dispose(); }
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { downstreamFloor } from '../../helpers/downstreamFloor';
import { expectDefined } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { tr } from '../../../src/presentation/i18n/strings';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
it('filters real Work floors locally without losing row identity, rereading or writing the vault', async () => {
 const rig = await downstreamStack(), other = await downstreamFloor(rig);
 const origin = { planId: rig.plan.id, roomId: rig.roomId, workId: 'work-sand' }, view = await downstreamView(rig, 'schedule', origin);
 try {
  const read = vi.spyOn(view.work, 'read'), bytes = [...rig.stack.vault.entries], filter = view.wrapper.get('select');
  expect(view.wrapper.findAll('[data-work-id]')).toHaveLength(2);
  await filter.setValue(other.plan.id); expect(view.wrapper.findAll('[data-work-id]').map(row => row.attributes('data-work-id'))).toEqual(['work-upper']);
  await filter.setValue(rig.plan.id); expect(view.wrapper.get('[data-work-id="work-sand"]').classes()).toContain('is-selected');
  await filter.setValue('all'); expect(view.wrapper.findAll('[data-work-id]')).toHaveLength(2);
  expect(read).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { view.dispose(); }
});
it.each(['schedule', 'quotes'] as const)('returns from %s with the exact origin and Project identity without changing records', async section => {
 const rig = await downstreamStack(), origin = { planId: rig.plan.id, roomId: rig.roomId, workId: 'work-sand', costId: 'cost-floor' };
 const view = await downstreamView(rig, section, origin);
 try {
  const open = vi.spyOn(view.context, 'openPlan'), navigate = vi.spyOn(view.context, 'navigate'), bytes = [...rig.stack.vault.entries];
  await view.button(tr('schedule.return')).trigger('click'); await flushPromises();
  expect(open).toHaveBeenCalledExactlyOnceWith(rig.plan.id, origin);
  await view.wrapper.get('.rp-project-detail__back').trigger('click'); await flushPromises();
  expect(navigate).toHaveBeenCalledExactlyOnceWith(rig.plan.projectId); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { view.dispose(); }
});
it.each(['schedule', 'quotes'] as const)('keeps readable records and unresolved identities visible in %s when peer notes are malformed, then recovers from their repair', async section => {
 const rig = await downstreamStack(), other = await downstreamFloor(rig), origin = { planId: rig.plan.id, roomId: rig.roomId, workId: 'work-sand' };
 const view = await downstreamView(rig, section, origin);
 try {
  const paths = [expectDefined(rig.persistence.index.getPath(other.plan.id), 'other Plan path'), expectDefined(rig.persistence.index.getPath(rig.roomId), 'Room path')];
  const originals = paths.map(path => expectDefined(rig.stack.vault.entries.get(path), 'source bytes'));
  paths.forEach((path, index) => rig.stack.vault.entries.set(path, originals[index].replace(/^name:.*$/m, 'name: []')));
  const damaged = [...rig.stack.vault.entries]; await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
  const messages = section === 'schedule' ? [tr('view.project.some-plans-unreadable', { count: '1' }), tr('schedule.rooms-incomplete'), tr('schedule.room-missing', { id: rig.roomId })] : [tr('quote.partial'), tr('quote.unresolved', { id: rig.roomId })];
  for (const message of messages) expect(view.wrapper.text()).toContain(message);
  expect(view.wrapper.findAll('[data-work-id]').map(row => row.attributes('data-work-id'))).toEqual(section === 'schedule' ? ['work-sand'] : []);
  expect([...rig.stack.vault.entries]).toEqual(damaged);
  paths.forEach((path, index) => rig.stack.vault.entries.set(path, originals[index])); const repaired = [...rig.stack.vault.entries];
  await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
  expect(view.wrapper.text()).not.toContain(tr(section === 'schedule' ? 'schedule.rooms-incomplete' : 'quote.partial'));
  expect(view.wrapper.findAll('[data-work-id]').map(row => row.attributes('data-work-id'))).toEqual(section === 'schedule' ? ['work-sand', 'work-upper'] : []);
  expect([...rig.stack.vault.entries]).toEqual(repaired);
 } finally { view.dispose(); }
});

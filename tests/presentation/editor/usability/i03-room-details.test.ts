// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

it('puts common Room edits before advanced actions and exposes one Plan Renovate route', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const room = rig.wrapper.get('.rp-room-inspector');
	const rename = room.get('[data-rp-action="rename-room"]').element;
	const resize = room.get('[data-rp-action="resize-room"]').element;
	const advanced = room.get('.rp-inspector-more').element;
	const route = room.get('[data-rp-action="renovate-room"]').element;

	expect(follows(rename, resize)).toBe(true);
	expect(follows(resize, advanced)).toBe(true);
	expect(follows(advanced, route)).toBe(true);
	expect(route.getAttribute('aria-label')).toContain('Renovate');
	expect(room.find('.rp-room-navigation').exists()).toBe(false);

	const entries = [...rig.stack.vault.entries];
	await room.get('[data-rp-action="renovate-room"]').trigger('click'); await settle();
	expect(rig.session.perspective).toBe('renovate');
	expect([...rig.stack.vault.entries]).toEqual(entries);
});

it.each([
	['irregular', [{ x: 1000, y: 500 }, { x: 2200, y: 500 }, { x: 2400, y: 1100 }, { x: 1800, y: 1600 }, { x: 1000, y: 1200 }]],
	['rotated', [{ x: 1000, y: 500 }, { x: 1800, y: 1300 }, { x: 1400, y: 1700 }, { x: 600, y: 900 }]],
] as const)('keeps the size route truthful for a %s Room outline', async (_kind, points) => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const created = await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Non-rectangular', zoneType: 'Room', geometry: { points } });
	if (!created.ok) throw new Error('expected the focused Room fixture to be created');
	await rig.runtime.refreshProjection(); rig.selection.select([created.value.zone.entity.id]); await settle();
	const room = rig.wrapper.get('.rp-room-inspector');
	expect(room.find('[data-rp-action="resize-room"]').exists()).toBe(false);
	expect(room.get('.rp-inspector-actions > p').text()).toContain('supports only rectangles aligned with the floor axes');
	expect(room.find('.rp-inspector-more').exists()).toBe(true);
});

// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';
import { expectOk } from '../../../helpers/domain';
import type { Opening } from '../../../../src/domain/spatial/Structure';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup(withRoom = false) {
	const rig = await renovationEditor(true);
	mounted.push(rig);
	const baseline = expectOk(await rig.services.read(rig.plan.id));
	const opening: Opening = { id: 'opening-i11-door', kind: 'door', hostId: 'wall-a', offset: 150, width: 900, height: 2100, sill: 0,
		swing: { hinge: 'end', side: 'right', angle: 90 } };
	const boundaries = withRoom ? [{ roomId: rig.room.id, wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }] : [];
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({
		planId: rig.plan.id,
		baseline,
		structure: { ...rig.project.structure, openings: [opening], boundaries },
		ledger: rig.runtime.structureTask.ledger,
	})));
	rig.selection.select([opening.id]);
	await settle();
	return rig;
}

const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

it('makes a hosted Door readable, orders supported properties, and keeps Renovate a no-write route', async () => {
	const rig = await setup();
	const inspector = rig.wrapper.get('.rp-structure-inspector');

	expect(inspector.get('[data-rp-opening-identity]').text()).toBe('Door');
	expect(inspector.get('[data-rp-opening-context]').text()).toBe('No room');
	expect(inspector.get('[data-rp-opening-floor]').text()).toContain('Ground floor');
	expect(inspector.get('[data-rp-opening-property="host"]').text()).toBe('Wall 1');
	expect(inspector.get('[data-rp-opening-property="room-context"]').text()).toBe('No room');
	const width = inspector.get('[data-rp-opening-property="width"]');
	const height = inspector.get('[data-rp-opening-property="height"]');
	const offset = inspector.get('[data-rp-opening-property="offset"]');
	expect(width.text()).toBe('0.9 m');
	expect(height.text()).toBe('2.1 m');
	expect(offset.text()).toBe('0.15 m');
	expect(follows(width.element, height.element)).toBe(true);
	expect(follows(height.element, offset.element)).toBe(true);
	expect(inspector.get('[data-rp-action="renovate-opening"]').attributes('aria-label')).toBe('Renovate: Door');

	const entries = [...rig.stack.vault.entries];
	await inspector.get('[data-rp-action="renovate-opening"]').trigger('click');
	await settle();
	expect(rig.session.perspective).toBe('renovate');
	expect(rig.session.targetId).toBe('opening-i11-door');
	expect([...rig.stack.vault.entries]).toEqual(entries);
});

it('shows a real room context when the host wall bounds a room', async () => {
	const rig = await setup(true);
	const inspector = rig.wrapper.get('.rp-structure-inspector');
	expect(inspector.get('[data-rp-opening-context]').text()).toBe('Studio');
	expect(inspector.get('[data-rp-opening-property="room-context"]').text()).toBe('Studio');
});

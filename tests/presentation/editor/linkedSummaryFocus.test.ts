// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { defer } from '../../helpers/async';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(width: number, wall = false) {
	const rig = await renovationEditor(true); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(baseline.document.structure, 'walls');
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline,
		structure: { ...structure, boundaries: [{ roomId: rig.room.id, wallIds: structure.walls.map(item => item.id) }] }, ledger: rig.runtime.structureTask.ledger })));
	rig.selection.select([wall ? 'wall-a' : rig.room.id] as never[]); await settle();
	rig.runtime.renovation.focus(rig.room.id, 'overview'); resizeTo(rig.rootEl, width, 900); await settle();
	if (width === 460) { rig.wrapper.get<HTMLButtonElement>('[data-rp-rail="details"]').element.click(); await settle(); }
	return rig;
}

it.each([
	{ width: 1280, mode: 'materials', wall: false }, { width: 460, mode: 'materials', wall: false },
	{ width: 1280, mode: 'notes', wall: true }, { width: 460, mode: 'notes', wall: true },
] as const)('keeps native focus and Room/target context after the $mode overview link at $width px', async ({ width, mode, wall }) => {
	const rig = await setup(width, wall), bytes = [...rig.stack.vault.entries];
	const opener = rig.wrapper.get<HTMLButtonElement>(`[data-rp-linked="${mode}"]`).element;
	opener.focus(); opener.click(); await settle();
	expect(opener.isConnected).toBe(false);
	expect(rig.session).toMatchObject({ roomId: rig.room.id, targetId: wall ? 'wall-a' : rig.room.id, mode, focusedId: '' });
	expect(rig.selection.selectedIds).toEqual([wall ? 'wall-a' : rig.room.id]);
	const successor = rig.wrapper.get<HTMLButtonElement>('[data-rp-room-navigation]').element;
	expect(document.activeElement).toBe(successor); expect(successor.isConnected).toBe(true);
	if (width === 460) {
		successor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
	}
	expect(rig.wrapper.findAll('[data-rp-rail="details"][aria-expanded="true"]')).toHaveLength(0);
	expect(document.activeElement).toBe(width === 460 ? rig.wrapper.get('[data-rp-rail="details"]').element : successor);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('leaves focus on the connected overview link when a real pending Undo refuses navigation', async () => {
	const rig = await setup(460), entered = defer<void>(), release = defer<void>(), original = rig.geometry.write.bind(rig.geometry);
	vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { entered.resolve(); await release.promise; return original(...args); });
	const undo = vi.spyOn(rig.runtime.dispatcher, 'undo');
	const undoButton = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="undo"]').element;
	undoButton.focus(); undoButton.click(); await entered.promise;
	try {
		expect(useSaveStateStore(rig.pinia).state).toBe('saving');
		const opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-linked="materials"]').element;
		opener.focus(); opener.click(); await settle();
		expect(rig.session.mode).toBe('overview'); expect(opener.isConnected).toBe(true); expect(document.activeElement).toBe(opener);
	} finally { release.resolve(); await expectDefined(undo.mock.results[0], 'native Undo').value; await settle(); }
});

it('does not return focus into the removed leaf when the host closes during linked navigation', async () => {
	const rig = await setup(460), bytes = [...rig.stack.vault.entries];
	const opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-linked="materials"]').element;
	opener.focus(); opener.click();
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	const outside = document.createElement('button'); outside.textContent = 'Other leaf'; document.body.append(outside); outside.focus();
	try {
		await settleUntil(() => document.activeElement === outside, 'other leaf focus'); await settle();
		expect(document.activeElement).toBe(outside); expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { outside.remove(); }
});

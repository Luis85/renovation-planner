import type { Workspace } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { guardedRenovation } from '../../src/plugin/guardedRenovation';
import { reviewNoteAction } from '../../src/plugin/reviewNoteAction';
import type { RenovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { renovationStack } from '../helpers/renovation';
import { recorder } from '../helpers/logger';
import { expectDefined, expectOk } from '../helpers/domain';

const fault = () => Promise.reject(new Error('disk unavailable'));
describe('renovation and review-note composition boundaries', () => {
	it('guards every argument-taking service door and forwards actual command construction', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read()), input = { renovation: rig.value, intended: undefined };
		const raw: RenovationServices = { read: fault, command: vi.fn<RenovationServices['command']>(() => ({ execute: fault, undo: fault })) };
		const guarded = guardedRenovation(raw, recorder); expect(await guarded.read(rig.plan.id)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		const command = guarded.command(baseline, input, rig.ledger); expect(raw.command).toHaveBeenCalledWith(baseline, input, rig.ledger);
		for (const result of [await command.execute(), await command.undo()]) expect(result).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
	});
	it('generates source links, opens the actual note and refuses to replace human edits', async () => {
		const rig = await renovationStack(), openLinkText = vi.fn<Workspace['openLinkText']>().mockResolvedValue(undefined);
		const action = reviewNoteAction(rig.stack.deps.vault, { openLinkText } as never, rig.stack.index, recorder);
		expectOk(await action(rig.plan.id, '# Review'));
		const path = String(openLinkText.mock.calls[0][0]); expect(openLinkText).toHaveBeenCalledWith(path, '', false);
		const bytes = expectDefined(rig.stack.vault.entries.get(path), 'generated review'); expect(bytes).toContain('Source floor'); expect(bytes).toContain(encodeURI(expectDefined(rig.stack.index.getPath(rig.plan.id), 'source')));
		rig.stack.vault.entries.set(path, `${bytes}Human notes`); expect(await action(rig.plan.id, 'Changed findings')).toMatchObject({ ok: false }); expect(openLinkText).toHaveBeenCalledOnce();
		rig.stack.index.remove(rig.plan.id); expect(await action(rig.plan.id, 'No source')).toMatchObject({ ok: false });
	});
	it('maps a thrown navigation fault after safely generating the note', async () => {
		const rig = await renovationStack(), action = reviewNoteAction(rig.stack.deps.vault, { openLinkText: fault } as never, rig.stack.index, recorder);
		expect(await action(rig.plan.id, 'Findings')).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		expect([...rig.stack.vault.entries.keys()].some(path => path.includes('/Review-'))).toBe(true);
	});
 it('encodes source filenames containing Markdown punctuation and refuses a stale index after source deletion', async () => {
  const rig = await renovationStack(), source = expectDefined(rig.stack.index.getPath(rig.plan.id), 'source');
  const renamed = 'Floors/Floor #1 (east)?.md';
  rig.stack.vault.entries.set(renamed, expectDefined(rig.stack.vault.entries.get(source), 'source bytes'));
  vi.spyOn(rig.stack.index, 'getPath').mockReturnValue(renamed);
  const openLinkText = vi.fn<Workspace['openLinkText']>().mockResolvedValue(undefined);
  const action = reviewNoteAction(rig.stack.deps.vault, { openLinkText } as never, rig.stack.index, recorder);
  expectOk(await action(rig.plan.id, 'Findings'));
  const path = String(openLinkText.mock.calls[0][0]); expect(rig.stack.vault.entries.get(path)).toContain('Floors/Floor%20%231%20%28east%29%3F.md');
  rig.stack.vault.entries.delete(renamed); expect(await action(rig.plan.id, 'Changed findings')).toMatchObject({ ok: false, error: { code: 'review.source-missing' } });
  expect(openLinkText).toHaveBeenCalledOnce();
 });

});

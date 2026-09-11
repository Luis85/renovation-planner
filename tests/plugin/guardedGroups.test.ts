// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from 'obsidian';
import * as groupModule from '../../src/application/commands/spatial/GroupGeometryCommand';
import type { GroupGeometryServices } from '../../src/application/commands/spatial/GroupGeometryCommand';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { structureStack, WALL_LOOP } from '../helpers/structure';
import { expectDefined, expectOk } from '../helpers/domain';
import { FakeWorkspace } from '../helpers/workspace';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();
const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await structureStack();
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.baseline.document, structure: WALL_LOOP }, rig.baseline.version));
	rig.stack.metadataCache.catchUp();
	const root = createCompositionRoot(DEFAULT_SETTINGS, rig.stack.logger, rig.stack.deps);
	const persistence = expectDefined(root.persistence, 'persistence');
	const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: persistence.vaultDeps.echo });
	persistence.index.rebuild(scan.entries, scan.exclusions);
	disposers.push(() => { for (const subscription of persistence.subscriptions) subscription.dispose(); });
	return { ...rig, root, persistence };
}
function composed(rig: Awaited<ReturnType<typeof setup>>) {
	const deps = planEditorDeps(rig.root, new FakeWorkspace() as unknown as Workspace, rig.stack.deps.vault, createEditorClipboard());
	const groups = expectDefined(deps.commands.groups, 'composed Group service');
	expect(Object.keys(groups).toSorted()).toEqual(['command', 'read']);
	return groups;
}

describe('Group access boundaries through the production editor composition', () => {
	it('maps and logs escaped read, execute and undo faults through the argument-taking factory', async () => {
		const rig = await setup(), failure = new Error('group collaborator failed');
		const fault = () => Promise.reject(failure);
		const raw: GroupGeometryServices = { read: fault, command: vi.fn<GroupGeometryServices['command']>(() => ({ execute: fault, undo: fault })) };
		const factory = vi.spyOn(groupModule, 'groupGeometryServices').mockReturnValueOnce(raw), log = vi.spyOn(rig.stack.logger, 'error');
		const groups = composed(rig), bytes = [...rig.stack.vault.entries];
		expect(factory).toHaveBeenCalledWith(rig.persistence.geometry, rig.persistence.zones, rig.root.eventBus);
		expect(await groups.read(rig.plan.id)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		const input = { planId: rig.plan.id, baseline: rig.baseline, document: rig.baseline.document, ledger: rig.ledger };
		const command = groups.command(input); expect(raw.command).toHaveBeenCalledExactlyOnceWith(input);
		expect(await command.execute()).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		expect(await command.undo()).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		expect(log.mock.calls.map(([event]) => event)).toEqual(['group.read.failed', 'group.execute.failed', 'group.undo.failed']);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('retains application-owned write refusals and permits exact execute/undo retry against real repositories', async () => {
		const rig = await setup(), groups = composed(rig);
		vi.spyOn(rig.persistence.geometry, 'read').mockRejectedValueOnce(new Error('read fault'));
		expect(await groups.read(rig.plan.id)).toMatchObject({ ok: false, error: { code: 'vault.unexpected-failure' } });
		const baseline = expectOk(await groups.read(rig.plan.id)), group = { id: 'group-shell', name: 'Wall shell', memberIds: ['wall-a', 'wall-b'] };
		const command = groups.command({ planId: rig.plan.id, baseline, document: { ...baseline.document, groups: [group] }, ledger: rig.ledger });
		const before = [...rig.stack.vault.entries];
		vi.spyOn(rig.persistence.geometry, 'write').mockRejectedValueOnce(new Error('write fault'));
		expect(await command.execute()).toMatchObject({ ok: false, error: { code: 'spatial-group.write-failed' } });
		expect([...rig.stack.vault.entries]).toEqual(before);
		expectOk(await command.execute()); expect(expectOk(await groups.read(rig.plan.id)).document.groups).toEqual([group]);
		const saved = [...rig.stack.vault.entries];
		vi.mocked(rig.persistence.geometry.read).mockRejectedValueOnce(new Error('undo read fault'));
		expect(await command.undo()).toMatchObject({ ok: false, error: { code: 'spatial-group.write-failed' } });
		expect([...rig.stack.vault.entries]).toEqual(saved);
		expectOk(await command.undo()); expect(expectOk(await groups.read(rig.plan.id)).document).toEqual(baseline.document);
	});
});

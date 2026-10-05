// @vitest-environment jsdom
/**
 * **Owner ruling 74: the planning panel's READ is not refused during a write pause; every write is.**
 * "The planning panel's read uses a read-side guard: it still reads (and shows current figures)
 * during a pause; all writes stay refused."
 *
 * `planning.read` used to be wrapped by `guardCommand`, whose ADR-0034 gate refuses EVERY call
 * while any write incident is open — so under any incident every Plan Editor drew "This plan could
 * not be re-read after the last change" and "Saved · refresh needed" over a plan that read fine.
 * It is `guardQuery` now, the same boundary without the gate, as `guardCommand`'s own docblock
 * says queries must be.
 *
 * Driven over the PRODUCTION composition (`planEditorDeps` over a real root and a planning stack),
 * because the defect was a wiring choice in `planningEditorServices.ts` that no fake reaches.
 * "Writes nothing" is measured as the vault's bytes, not as a spy on a door somebody listed.
 */
import { afterEach, expect, it } from 'vitest';
import { downstreamStack } from '../../helpers/downstream';
import { FakeLeaf, FakeWorkspace } from '../../helpers/workspace';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { installOpenWriteIncident } from '../../helpers/writeIncidents';
import { expectDefined, expectOk } from '../../helpers/domain';
import { memoryDeviceStorage } from '../../helpers/deviceStorage';
import { planEditorDeps } from '../../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { PlanEditorView } from '../../../src/presentation/views/PlanEditorView';
import { installWriteIncidentRegistry } from '../../../src/application/incidents/WriteIncidentRegistry';
import { WRITES_PAUSED_CODE } from '../../../src/application/errors/guardAgainstThrowing';

installEditorEnvironment();
afterEach(() => { installWriteIncidentRegistry(null); document.body.replaceChildren(); });

async function setup() {
	const rig = await downstreamStack(), workspace = new FakeWorkspace();
	const deps = { ...planEditorDeps(rig.root, workspace as never, rig.stack.deps.vault, createEditorClipboard(), memoryDeviceStorage()), openDiagnosticsReport: () => undefined };
	return { rig, deps, dispose: rig.dispose };
}

const warningIds = (root: HTMLElement): string[] => [...root.querySelectorAll('[data-rp-warning]')].map((row) => row.getAttribute('data-rp-warning') ?? '');

it('reads and draws the planning panel during a pause, with no re-read row and the badge on Saved', async () => {
	const { rig, deps, dispose } = await setup();
	const view = new PlanEditorView(new FakeLeaf() as never, deps); document.body.append(view.containerEl);
	try {
		await installOpenWriteIncident();
		const bytes = [...rig.stack.vault.entries];
		await view.setState({ planId: rig.plan.id }, {} as never); await view.onOpen(); sizedShellRoot(view.contentEl); await settle();
		// Anchored on the row the pause DOES draw, so a broken selector cannot pass the absence below.
		expect(warningIds(view.contentEl)).toContain('unrecovered');
		expect(warningIds(view.contentEl)).not.toContain('stale');
		expect(view.contentEl.querySelector('.rp-save-state-saved-refresh-needed')).toBeNull();
		expect(view.contentEl.querySelector('.rp-save-state-label')?.className).toContain('rp-save-state-saved');
		expectOk(await expectDefined(deps.commands.planning, 'planning').read(rig.plan.id));
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { await view.onClose(); dispose(); }
});

/**
 * The category, discovered from the bundles themselves: every member of `planning` and `renovation`
 * except `read` is a factory whose product's every door is a write. `read` is excluded BY NAME and
 * asserted present, rather than filtered silently; a new factory is driven the day it is composed.
 */
it('refuses every planning write door with writes-paused, and writes nothing', async () => {
	const { rig, deps, dispose } = await setup();
	try {
		await installOpenWriteIncident();
		const planning = expectDefined(deps.commands.planning, 'planning'), renovation = expectDefined(deps.commands.renovation, 'renovation');
		const baseline = expectOk(await planning.read(rig.plan.id));
		const inputs: Record<string, unknown> = { material: rig.input, command: { renovation: { ...rig.value, depth: rig.depth }, intended: undefined } };
		const bytes = [...rig.stack.vault.entries], driven: string[] = [];
		for (const [bundleName, bundle] of Object.entries({ planning, renovation })) {
			expect(typeof bundle.read).toBe('function');
			for (const [name, factory] of Object.entries(bundle)) {
				if (name === 'read' || typeof factory !== 'function') continue;
				const product = (factory as (...args: unknown[]) => Record<string, unknown>)(baseline, inputs[name], rig.ledger);
				for (const [door, run] of Object.entries(product)) {
					if (typeof run !== 'function') continue;
					const result = await (run as () => Promise<{ ok: boolean; error?: { code: string } }>)();
					expect(result, `${bundleName}.${name}()#${door}`).toMatchObject({ ok: false, error: { code: WRITES_PAUSED_CODE } });
					driven.push(`${bundleName}.${name}()#${door}`);
				}
			}
		}
		// The floor: an instrument that reached nothing would look exactly like a gated bundle.
		expect(driven).toEqual(expect.arrayContaining(['planning.material()#execute', 'planning.material()#undo', 'renovation.command()#execute', 'renovation.command()#undo']));
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { dispose(); }
});

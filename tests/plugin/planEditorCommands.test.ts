/**
 * @vitest-environment jsdom
 *
 * The two Plan Editor commands: when they appear in the palette, and what they do.
 *
 * `checkCallback`, not `callback` — Obsidian asks first and acts second, which is how a
 * command stays out of the palette when its context is absent. Both halves are driven,
 * because a command that answered `true` to the question and did nothing on the act would
 * pass a test that only ran one of them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FuzzySuggestModal, Notice, TFile, type Command } from 'obsidian';
import { registerPlanEditorCommands, type PlanEditorCommandHost } from '../../src/plugin/planEditorCommands';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { SetPlanBackgroundCommand } from '../../src/application/commands/plan/SetPlanBackground';
import { ReversibleSetPlanBackgroundCommand } from '../../src/application/commands/plan/ReversibleSetPlanBackground';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { t } from '../../src/presentation/i18n/strings';
import { expectOk, RecordingEventBus } from '../helpers/domain';
import { makePlan } from '../helpers/entities';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { FakeWorkspace } from '../helpers/workspace';

const PLAN_NOTE = 'Renovation/Plans/Ground floor.md';

function file(path: string): TFile {
	const made = new TFile();
	made.path = path;
	made.extension = path.split('.').at(-1) ?? '';
	return made;
}

interface Wired {
	readonly host: PlanEditorCommandHost;
	readonly workspace: FakeWorkspace;
	readonly commands: Command[];
	readonly plans: InMemoryPlanRepository;
	readonly planId: string;
	readonly vaultFiles: TFile[];
}

async function wired(options: { withPersistence?: boolean; files?: string[] } = {}): Promise<Wired> {
	const plans = new InMemoryPlanRepository();
	const projectId = createProjectId();
	const plan = makePlan({ projectId });
	expectOk(await plans.save(plan, 'absent'));

	const index = new InMemoryProjectIndex();
	index.upsert({ id: plan.id, type: 'renovation-plan', path: PLAN_NOTE, projectId });

	const workspace = new FakeWorkspace();
	const commands: Command[] = [];
	const vaultFiles = (options.files ?? ['Plans/ground.png', 'Notes/readme.md']).map((path) => file(path));

	const setPlanBackground = new SetPlanBackgroundCommand(
		plans,
		{ fileExists: (path) => vaultFiles.some((one) => one.path === path) },
		new RecordingEventBus(),
	);

	const host: PlanEditorCommandHost = {
		app: {
			workspace,
			vault: { getFiles: () => vaultFiles },
		} as never,
		root: {
			persistence:
				options.withPersistence === false
					? null
					: {
							index,
							reversibleSetPlanBackground: new ReversibleSetPlanBackgroundCommand(setPlanBackground, plans),
						},
		} as never,
		addCommand: (command) => commands.push(command),
	};

	registerPlanEditorCommands(host);
	return { host, workspace, commands, plans, planId: plan.id, vaultFiles };
}

/**
 * The command dispatches through a promise chain it deliberately does not return —
 * Obsidian's `checkCallback` is synchronous — so a test has to let the microtask queue
 * drain before asking what happened. A macrotask hop, not a fixed number of `await`s: the
 * chain's length is an implementation detail and counting ticks makes the test fail on a
 * refactor that changed nothing observable.
 */
function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/** A stand-in for the active Plan Editor: what the command reads is its view state. */
function activePlanEditor(planId: string): unknown {
	return { getState: () => ({ planId }) };
}

beforeEach(() => {
	Notice.shown.length = 0;
	FuzzySuggestModal.opened.length = 0;
});

describe('open plan editor', () => {
	it('stays out of the palette when no file is open', async () => {
		const { commands } = await wired();

		expect(commands[0].checkCallback?.(true)).toBe(false);
	});

	it('stays out of the palette when the open file is not a plan note', async () => {
		const { commands, workspace } = await wired();
		workspace.activeFile = { path: 'Notes/readme.md' };

		expect(commands[0].checkCallback?.(true)).toBe(false);
	});

	it('stays out of the palette when settings were never recovered', async () => {
		const { commands, workspace } = await wired({ withPersistence: false });
		workspace.activeFile = { path: PLAN_NOTE };

		expect(commands[0].checkCallback?.(true)).toBe(false);
	});

	it('appears, and opens the editor for the plan that note IS', async () => {
		const { commands, workspace, planId } = await wired();
		workspace.activeFile = { path: PLAN_NOTE };

		expect(commands[0].checkCallback?.(true)).toBe(true);
		// Asking must not act: a palette that opened a tab while the user was still scrolling
		// past the entry is the defect `checking` exists to prevent.
		expect(workspace.leaves).toHaveLength(0);

		commands[0].checkCallback?.(false);
		await flush();

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state?.state).toEqual({ planId });
	});

	it('carries an unprefixed id and a translated name', async () => {
		const { commands } = await wired();

		expect(commands[0].id).toBe('open-plan-editor');
		expect(commands[0].name).toBe(t('en', 'command.open-plan-editor'));
	});
});

describe('set plan background', () => {
	it('stays out of the palette with no plan editor active', async () => {
		const { commands } = await wired();

		expect(commands[1].checkCallback?.(true)).toBe(false);
	});

	it('appears once a plan editor is the active view', async () => {
		const { commands, workspace, planId } = await wired();
		workspace.activeView = activePlanEditor(planId);

		expect(commands[1].checkCallback?.(true)).toBe(true);
		expect(FuzzySuggestModal.opened).toHaveLength(0);
	});

	/** Only the formats §54 names — the vault's markdown notes are not candidates. */
	it('offers only files that can BE a background', async () => {
		const { commands, workspace, planId } = await wired({
			files: ['Plans/ground.png', 'Plans/first.pdf', 'Plans/photo.jpeg', 'Notes/readme.md', 'Plans/cad.dwg'],
		});
		workspace.activeView = activePlanEditor(planId);

		commands[1].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		expect(picker.getItems().map((one) => one.path)).toEqual([
			'Plans/ground.png',
			'Plans/first.pdf',
			'Plans/photo.jpeg',
		]);
	});

	it('shows the full path, since two plans called ground.pdf is the normal case', async () => {
		const { commands, workspace, planId } = await wired();
		workspace.activeView = activePlanEditor(planId);
		commands[1].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;

		expect(picker.getItemText(picker.getItems()[0])).toBe('Plans/ground.png');
		expect(picker.placeholder).toBe(t('en', 'command.set-plan-background'));
	});

	it('writes the chosen file to the plan through the command', async () => {
		const { commands, workspace, plans, planId } = await wired();
		workspace.activeView = activePlanEditor(planId);
		commands[1].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		picker.choose(picker.getItems()[0]);
		await flush();

		const stored = expectOk(await plans.getById(planId as never));
		expect(stored?.entity.background).toEqual({ path: 'Plans/ground.png', kind: 'image' });
	});

	it('gives a pdf a page and an image none', async () => {
		const { commands, workspace, plans, planId } = await wired({ files: ['Plans/first.pdf'] });
		workspace.activeView = activePlanEditor(planId);
		commands[1].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		picker.choose(picker.getItems()[0]);
		await flush();

		const stored = expectOk(await plans.getById(planId as never));
		expect(stored?.entity.background).toEqual({ path: 'Plans/first.pdf', kind: 'pdf', page: 1 });
	});

	it('surfaces a refusal to the user rather than failing silently', async () => {
		const { commands, workspace } = await wired();
		// A plan id nothing answers for: the command refuses with plan-not-found.
		workspace.activeView = activePlanEditor('plan-gone');
		commands[1].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(Notice.shown).toHaveLength(1);
		expect(Notice.shown[0]).toContain('plan-gone');
	});

	it('says so rather than opening an empty picker when the vault has no candidate', async () => {
		const { commands, workspace, planId } = await wired({ files: ['Notes/readme.md'] });
		workspace.activeView = activePlanEditor(planId);

		commands[1].checkCallback?.(false);

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(Notice.shown).toEqual([t('en', 'background.unsupported')]);
	});
});

/**
 * The picker's callback runs LATER than the check that opened it — a user can sit on the
 * file list — so the command it dispatches through has to be resolved at that moment, not
 * assumed from the moment the palette entry appeared. With no persistence there is nothing
 * to dispatch through, and the right answer is to do nothing rather than to throw inside a
 * modal callback.
 */
describe('choosing a file with nothing to dispatch through', () => {
	it('does nothing, quietly, when settings were never recovered', async () => {
		const { commands, workspace, planId } = await wired({ withPersistence: false });
		workspace.activeView = activePlanEditor(planId);

		// The command is still offered: its availability turns on an open Plan Editor, and a
		// Plan Editor with unrecovered settings is a pane a user can be looking at.
		expect(commands[1].checkCallback?.(true)).toBe(true);
		commands[1].checkCallback?.(false);
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(Notice.shown).toHaveLength(0);
	});
});

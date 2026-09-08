/**
 * @vitest-environment jsdom
 *
 * The two Plan Editor commands: when they appear in the palette, and what they do.
 *
 * They activate DIFFERENTLY, and the difference is the subject of half this file.
 * `set-plan-background` uses `checkCallback` — Obsidian asks first and acts second, which
 * is how a command stays out of the palette when its context is absent — and both halves
 * are driven, because a command that answered `true` to the question and did nothing on the
 * act would pass a test that only ran one of them. `open-plan-editor` is a plain
 * `callback`: it used to demand a plan note be the active file, which kept it out of the
 * palette in every vault that had no plan notes, and a picker over the Project Index has no
 * such precondition.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Platform, TFile, type Command } from 'obsidian';
// Mock-only surface, imported BY NAME. `FuzzySuggestModal`, `Notice` carry members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { FuzzySuggestModal, Notice } from '../helpers/obsidian-mock';
import { registerPlanEditorCommands } from '../../src/plugin/planEditorCommands';
import type { PluginCommandHost } from '../../src/plugin/commandHost';
import type { ContinueContext } from '../../src/application/continueContext';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { SetPlanBackgroundCommand } from '../../src/application/commands/plan/SetPlanBackground';
import { ReversibleSetPlanBackgroundCommand } from '../../src/application/commands/plan/ReversibleSetPlanBackground';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { t } from '../../src/presentation/i18n/strings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
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
	readonly host: PluginCommandHost;
	readonly workspace: FakeWorkspace;
	readonly commands: Command[];
	readonly plans: InMemoryPlanRepository;
	readonly planId: string;
	readonly projectId: string;
	readonly vaultFiles: TFile[];
	/** Every context `rememberContinue` was handed, in order. */
	readonly remembered: ContinueContext[];
}

async function wired(
	options: {
		withPersistence?: boolean;
		files?: string[];
		indexed?: boolean;
		/** The picked entry carries no `projectId` — a project-less index row. */
		omitProjectId?: boolean;
		/** A workspace to reveal through instead of the default `FakeWorkspace` — how a
		 * reveal failure is driven, the same shape `revealPlanEditor.test.ts` uses. */
		workspace?: unknown;
	} = {},
): Promise<Wired> {
	const plans = new InMemoryPlanRepository();
	const projectId = createProjectId();
	const plan = makePlan({ projectId });
	expectOk(await plans.save(plan, 'absent'));

	const index = new InMemoryProjectIndex();
	// A PROJECT entry as well as the plan, so the picker's filter is asked to reject
	// something: an unfiltered `entries()` would pass every assertion about the plan row.
	index.upsert({ id: projectId, type: 'renovation-project', path: 'Renovation/Sample.md' });
	if (options.indexed !== false) {
		index.upsert({
			id: plan.id,
			type: 'renovation-plan',
			path: PLAN_NOTE,
			...(options.omitProjectId ? {} : { projectId }),
		});
	}

	const workspace = (options.workspace as FakeWorkspace | undefined) ?? new FakeWorkspace();
	const commands: Command[] = [];
	const vaultFiles = (options.files ?? ['Plans/ground.png', 'Notes/readme.md']).map((path) => file(path));

	const setPlanBackground = new SetPlanBackgroundCommand(
		plans,
		{ fileExists: (path) => vaultFiles.some((one) => one.path === path) },
		new RecordingEventBus(),
	);

	const host: PluginCommandHost = {
		app: {
			workspace,
			vault: { getFiles: () => vaultFiles },
		} as never,
		root: {
			logger: { error: () => undefined, warn: () => undefined, info: () => undefined, debug: () => undefined },
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

	const remembered: ContinueContext[] = [];
	registerPlanEditorCommands(host, (context) => remembered.push(context));
	return { host, workspace: workspace as FakeWorkspace, commands, plans, planId: plan.id, projectId, vaultFiles, remembered };
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

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

beforeEach(() => {
	Notice.shown.length = 0;
	FuzzySuggestModal.opened.length = 0;
	// A notice is INERT until something activates the queue — `onload` is what does that
	// in production, so a suite asserting on `Notice.shown` has to stand where the plugin
	// stands. Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the
	// identical sentence would fold into one `(×2)` and construct no second `Notice`.
	activateNotices();
});

// `Platform` is a plain mutable object in the mock, so a case that assigns `isMobile` owes the
// later cases IN THIS FILE the reset — the `suite` project takes no `isolate: false`, so it stops
// at the file boundary (CLAUDE.md's Testing section).
afterEach(() => {
	Platform.isMobile = false;
});

describe('open plan editor', () => {
	/**
	 * The whole point of THAT change: no VAULT precondition. The version before it answered
	 * `false` unless a plan note was the active file, which is why the command was invisible in a
	 * vault whose plan notes nothing could create — so this asserts the absence of that gate, and
	 * it is asserted through the check ANSWERING rather than through the check being absent.
	 *
	 * A `checkCallback` again since the mobile task, and the two questions are not the same kind:
	 * "is the right note open" is something the vault can change, "is this a phone" is not. The
	 * mobile case below is the other half of this one.
	 */
	it('answers the palette on a desktop vault with no plan note open', async () => {
		const { commands } = await wired();

		expect(commands[0].checkCallback?.(true)).toBe(true);
		expect(FuzzySuggestModal.opened).toHaveLength(0);
	});

	it('stays out of the palette on mobile, opening no picker', async () => {
		const { commands } = await wired();
		Platform.isMobile = true;

		expect(commands[0].checkCallback?.(true)).toBe(false);
		expect(commands[0].checkCallback?.(false)).toBe(false);

		expect(FuzzySuggestModal.opened).toHaveLength(0);
	});

	it('offers every plan the index holds, and nothing that is not one', async () => {
		const { commands } = await wired();

		commands[0].checkCallback?.(false);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<{ path: string }>;
		expect(picker.getItems().map((item) => item.path)).toEqual([PLAN_NOTE]);
		expect(picker.getItemText(picker.getItems()[0])).toBe(PLAN_NOTE);
		// The placeholder is the command's own name, translated — not a literal.
		expect(picker.placeholder).toBe(t('en', 'command.open-plan-editor'));
	});

	it('opens the editor for the plan the user picks', async () => {
		const { commands, workspace, planId } = await wired();

		commands[0].checkCallback?.(false);
		// Opening the picker must not open a leaf: choosing is what acts.
		expect(workspace.leaves).toHaveLength(0);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<unknown>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state?.state).toEqual({ planId });
	});

	it('says so rather than opening an empty picker when the vault has no plans', async () => {
		const { commands } = await wired({ indexed: false });

		commands[0].checkCallback?.(false);

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(Notice.shown).toEqual([t('en', 'plan.none')]);
	});

	/** Settings that could not be read compose no index at all, which is the same answer. */
	it('says so when settings were never recovered', async () => {
		const { commands } = await wired({ withPersistence: false });

		commands[0].checkCallback?.(false);

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(Notice.shown).toEqual([t('en', 'plan.none')]);
	});

	it('carries an unprefixed id and a translated name', async () => {
		const { commands } = await wired();

		expect(commands[0].id).toBe('open-plan-editor');
		expect(commands[0].name).toBe(t('en', 'command.open-plan-editor'));
	});

	/**
	 * The Resume target (design slice 22, Task 3): a palette open is one of the two main-flow
	 * doors the requirement note names, and it routes through the same `renovationProjectOpenPlan`
	 * seam the project surface uses, so a confirmed leaf open records the plan the way a row
	 * click already does.
	 */
	it('remembers the picked plan as the Resume target once the reveal opens', async () => {
		const { commands, planId, projectId, remembered } = await wired();

		commands[0].checkCallback?.(false);
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<unknown>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(remembered).toEqual([{ projectId, planId }]);
	});

	it('remembers nothing when the reveal fails', async () => {
		// The same shape `revealPlanEditor.test.ts` uses to force a fault: a candidate whose
		// own view state throws, caught by `revealCandidate`'s outer boundary.
		const exploding = {
			getLeavesOfType: () => [
				{
					getViewState: () => {
						throw new Error('state exploded');
					},
				},
			],
		};
		const { commands, remembered } = await wired({ workspace: exploding });

		commands[0].checkCallback?.(false);
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<unknown>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(remembered).toEqual([]);
	});

	it('remembers nothing when the picked entry carries no project id', async () => {
		const { commands, remembered } = await wired({ omitProjectId: true });

		commands[0].checkCallback?.(false);
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<unknown>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(remembered).toEqual([]);
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

	/**
	 * The platform refusal is asked BEFORE the active-view question, so this case sets the active
	 * view that would otherwise answer `true` — asserting the guard rather than the absence of an
	 * editor mobile could not have mounted anyway.
	 */
	it('stays out of the palette on mobile even with a plan editor active', async () => {
		const { commands, workspace, planId } = await wired();
		workspace.activeView = activePlanEditor(planId);
		Platform.isMobile = true;

		expect(commands[1].checkCallback?.(true)).toBe(false);
		expect(commands[1].checkCallback?.(false)).toBe(false);

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
		// Through `toUserMessage`: the ReferenceError falls back to its category sentence,
		// and the raw id — vault content — stays out of the notice.
		expect(Notice.shown[0]).toBe('That entry no longer exists.');
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

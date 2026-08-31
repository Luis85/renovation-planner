/**
 * @vitest-environment jsdom
 *
 * `open-project-detail` — the palette's way INTO a project, and the first production caller
 * of `navigateToProject` that passes no `targetLeaf`.
 *
 * Every case here drives the real command callback and asserts on what the workspace ends up
 * holding, because the subject is that the command REACHES `navigateToProject` rather than
 * re-deciding for itself: a hand-rolled `revealView` followed by a `getLeavesOfType(...)[0]`
 * write passes the first case and fails the third. The first three are the same properties
 * `tests/infrastructure/obsidian/workspace/navigateToProject.test.ts` pins on the helper; they
 * are asserted again through the COMMAND for that reason, and the fourth is this command's
 * own — the empty-vault branch lives nowhere else.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Command } from 'obsidian';
// Mock-only surface, imported BY NAME: `opened` and `choose` are the fake's own members and
// do not exist on the real class's declaration, so reaching them through the `'obsidian'`
// specifier would type-check against a surface that has no such thing. The vitest alias points
// that specifier at this very file, so this is the SAME class and the same statics.
import { FuzzySuggestModal } from '../helpers/obsidian-mock';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { settle } from '../helpers/async';
import type { FakeLeaf, FakeWorkspace } from '../helpers/workspace';
import { RENOVATION_PROJECT_VIEW } from '../../src/presentation/views/RenovationProjectView';
import { t } from '../../src/presentation/i18n/strings';
import type RenovationPlannerPlugin from '../../src/plugin/RenovationPlannerPlugin';

installObsidianDom();

const KITCHEN = 'project-kitchen';
const LOFT = 'project-loft';

let plugin: RenovationPlannerPlugin;
let workspace: FakeWorkspace;

/**
 * The registered command itself, found by id — never by position in the list.
 *
 * `commands` is the obsidian MOCK's record of what `addCommand` was handed;
 * `RenovationPlannerPlugin extends Plugin` resolves against the REAL package's types outside
 * vitest, where the base class carries no such field. One cast, named for what it is.
 */
function openProjectDetail(): Command {
	const registered = (plugin as unknown as { commands: Command[] }).commands;
	const command = registered.find((one) => one.id === 'open-project-detail');
	if (!command) throw new Error('open-project-detail was never registered');
	return command;
}

/**
 * Runs the command and picks one row, which is the only gesture that reaches
 * `navigateToProject` at all: opening the picker must write nothing, and every case that
 * asserts a write goes through here so that "the picker opened" can never stand in for it.
 */
function pick(projectId: string): void {
	openProjectDetail().callback?.();
	const picker = FuzzySuggestModal.opened.at(-1) as FuzzySuggestModal<{ id: string }> | undefined;
	if (!picker) throw new Error('the command opened no picker');
	const row = picker.getItems().find((one) => one.id === projectId);
	if (!row) throw new Error(`the picker offered no row for ${projectId}`);
	picker.choose(row);
}

/**
 * Holds this leaf's FIRST `setViewState` open until it is released, so a second navigation
 * can be made to arrive mid-write rather than before or after it — the same instrument
 * `navigateToProject.test.ts` uses, for the same window.
 */
function slowSetViewState(leaf: FakeLeaf): { firstWriteStarted: Promise<void>; releaseFirst: () => void } {
	const original = leaf.setViewState.bind(leaf);
	let started: (() => void) | undefined;
	const firstWriteStarted = new Promise<void>((resolve) => {
		started = resolve;
	});
	let release: (() => void) | undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let first = true;
	leaf.setViewState = (state) => {
		if (!first) return original(state);
		first = false;
		started?.();
		return held.then(() => original(state));
	};
	return { firstWriteStarted, releaseFirst: () => release?.() };
}

beforeEach(async () => {
	FuzzySuggestModal.opened.length = 0;
	({ plugin, workspace } = await loadedPlugin());
	// Straight into the composed index rather than through a vault scan: what this command
	// reads is the index, and a scan would be a second thing able to fail here. A PLAN entry
	// as well, so the type filter is asked to reject something — an unfiltered `entries()`
	// would pass every assertion about a project row.
	const index = plugin.root.persistence?.index;
	index?.upsert({ id: KITCHEN as never, type: 'renovation-project', path: 'Renovation/Kitchen/Project.md' });
	index?.upsert({ id: LOFT as never, type: 'renovation-project', path: 'Renovation/Loft/Project.md' });
	index?.upsert({ id: 'plan-ground' as never, type: 'renovation-plan', path: 'Renovation/Plans/Ground.md' });
});

describe('open-project-detail', () => {
	/**
	 * The id and the name are different KINDS of thing, and this is where that shows. The id
	 * is DATA — Obsidian binds a user's hotkey to it — and it is a SECOND id rather than new
	 * behaviour behind `open-project` for exactly that reason, which is this slice's recorded
	 * deviation from the spec. The name is text, so it is asserted THROUGH the string table
	 * rather than against a literal, which is this repository's own idiom next door in
	 * `registration.test.ts` — a literal pin would break on every copy edit while proving
	 * nothing about the wiring.
	 *
	 * **What it catches and what it cannot**, measured rather than assumed. It catches the
	 * command being named from the WRONG key, which is a live risk with two keys this close
	 * together: `tr('command.open-project')` here turns it red. It does NOT catch a raw
	 * English literal whose text happens to match — measured green — and no gate does either,
	 * since `I18N_LITERAL_BAN` reaches four call sites and `addCommand({ name })` is none of
	 * them. Stated so the assertion is not read as wider than it is.
	 */
	it('carries an unprefixed id of its own and a translated name', () => {
		expect(openProjectDetail().name).toBe(t('en', 'command.open-project-detail'));
		// The pane-revealing command keeps its own id and its own copy: a build that
		// repurposed `open-project` would leave a user's existing hotkey meaning something
		// else, which is the whole argument for there being two.
		const registered = (plugin as unknown as { commands: Command[] }).commands;
		expect(registered.find((one) => one.id === 'open-project')?.name).toBe(t('en', 'command.open-project'));
	});

	/**
	 * A plain `callback`, never a `checkCallback` — so the command is in the palette in every
	 * vault, including the one with no projects in it. That is not a stylistic preference: a
	 * precondition here would hide the command in exactly the vault whose user most needs the
	 * list state and its Create button, which is the same mistake `open-plan-editor` shipped
	 * with and had removed. This asserts the ABSENCE of the gate.
	 */
	it('is a plain callback with no palette precondition', () => {
		expect(openProjectDetail().checkCallback).toBeUndefined();
		expect(typeof openProjectDetail().callback).toBe('function');
	});

	it('offers every project the index holds, and nothing that is not one', () => {
		openProjectDetail().callback?.();

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<{ id: string }>;
		expect(picker.getItems().map((one) => one.id)).toEqual([KITCHEN, LOFT]);
		// Opening the picker must not touch the workspace: choosing is what acts.
		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * **Asserted on THAT leaf**, not on `setViewState` having been called and not on
	 * `getLeavesOfType(...)[0]`: a build that revealed the pane and then created a second leaf
	 * to write into satisfies both of those and leaves the pane the user is looking at showing
	 * its old state, which is the whole reason `navigateToProject` writes to the leaf the
	 * reveal ANSWERED.
	 */
	it('navigates an already-open leaf to the chosen project', async () => {
		const leaf = workspace.withOpen(RENOVATION_PROJECT_VIEW);

		pick(LOFT);
		await settle();

		expect(leaf.getViewState().state).toEqual({ projectId: LOFT });
		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	/**
	 * The view is a singleton, and two picks in one tick are the way to find out whether
	 * anything believes it. Driven with two DIFFERENT projects on purpose: the same project
	 * coalesces under a key built from the request, and only different ones separate a guard
	 * that describes the LEAF from one that describes what was asked for.
	 */
	it('leaves exactly one leaf for two invocations naming different projects', async () => {
		pick(KITCHEN);
		pick(LOFT);
		await settle();

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	/**
	 * **The window a ticket alone does not close, and the one case here that separates this
	 * command from one that spelled the two steps for itself.** The picks do not overlap at the
	 * supersession check: the first passes it, begins a slow write, and only then is the second
	 * made. Without the per-leaf write chain both writes are in flight, the earlier settles
	 * LAST, and the pane is restored to the project the user has just navigated away from.
	 *
	 * **The `settle()` between the second pick and the release is load-bearing, and the case
	 * was measured green without it.** With the release issued in the same tick as the second
	 * pick, the outcome turns on microtask hop counts rather than on the design: a hand-rolled
	 * `revealView`-then-`setViewState` build has not finished revealing when the hold lifts, so
	 * its second write lands after the first anyway and the case passes against the very build
	 * it exists to refuse. A macrotask turn lets that build get all the way to its own
	 * `setViewState` while the first is still held, which is the scenario in words.
	 *
	 * Both assertions discriminate and they discriminate differently. The recorder is installed
	 * BEFORE the hold, so `slowSetViewState` wraps it and `written` is the order the writes
	 * actually REACHED the leaf rather than the order they were asked for — which is
	 * `[KITCHEN, LOFT]` in both builds and pins nothing.
	 */
	it('ends on the later of two invocations even when the first settles last', async () => {
		const leaf = workspace.withOpen(RENOVATION_PROJECT_VIEW);
		const written: unknown[] = [];
		const record = leaf.setViewState.bind(leaf);
		leaf.setViewState = (state) => {
			written.push(state.state?.['projectId']);
			return record(state);
		};
		const writes = slowSetViewState(leaf); // wraps the recorder: holds the first write

		pick(KITCHEN);
		await writes.firstWriteStarted;
		pick(LOFT);
		await settle();
		writes.releaseFirst();
		await settle();

		expect(written).toEqual([KITCHEN, LOFT]);
		expect(leaf.getViewState().state).toEqual({ projectId: LOFT });
	});

	/**
	 * **The list, not a picker and not a notice** — deliberately unlike `open-plan-editor`,
	 * which says `plan.none` and stops, because this view HAS a list state whose empty state
	 * carries a Create button. Both assertions discriminate and they discriminate differently:
	 * a build that opened a zero-row picker writes no state, and a build that raised a notice
	 * and returned opens no picker either.
	 */
	it('reveals the list state rather than a picker in an empty vault', async () => {
		const empty = (await loadedPlugin()) as { plugin: RenovationPlannerPlugin; workspace: FakeWorkspace };
		plugin = empty.plugin;
		const leaf = empty.workspace.withOpen(RENOVATION_PROJECT_VIEW);

		openProjectDetail().callback?.();
		await settle();

		expect(leaf.getViewState().state).toEqual({ projectId: '' });
		expect(FuzzySuggestModal.opened).toHaveLength(0);
	});

	/** Settings that could not be read compose no index at all, which is the same answer. */
	it('reveals the list state when settings were never recovered', async () => {
		const unrecovered = await loadedPlugin(null, new Error('unreadable'), true);
		plugin = unrecovered.plugin;
		const leaf = unrecovered.workspace.withOpen(RENOVATION_PROJECT_VIEW);

		openProjectDetail().callback?.();
		await settle();

		expect(leaf.getViewState().state).toEqual({ projectId: '' });
		expect(FuzzySuggestModal.opened).toHaveLength(0);
	});
});

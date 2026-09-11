import type { Vault, Workspace } from 'obsidian';
import { createCompositionRoot, renovationProjectDeps } from '../../src/plugin/composition-root';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { navigateToProject } from '../../src/infrastructure/obsidian/workspace/navigateToProject';
import { type PlanEditorView, PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import { RenovationProjectView, RENOVATION_PROJECT_VIEW } from '../../src/presentation/views/RenovationProjectView';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';
import { expectDefined } from '../helpers/domain';
import type { referenceWorkspace } from './referenceWorkspace';

type NativeView = PlanEditorView | RenovationProjectView;
type LeafState = Parameters<FakeLeaf['setViewState']>[0];

/** Only host construction/reveal is simulated. Native view state owns every arrival. */
class BrowserLeaf extends FakeLeaf {
	declare view: NativeView;
	constructor(private readonly construct: (leaf: BrowserLeaf, type: string) => NativeView) { super(); }
	override async setViewState(state: LeafState): Promise<void> {
		const fresh = !this.view;
		if (fresh) this.view = this.construct(this, state.type);
		await super.setViewState(state);
		if (fresh) await this.view.onOpen();
	}
}

class BrowserWorkspace extends FakeWorkspace {
	constructor(private readonly construct: (leaf: BrowserLeaf, type: string) => NativeView) { super(); }
	override getLeaf(): BrowserLeaf {
		const leaf = new BrowserLeaf(this.construct);
		this.leaves.push(leaf);
		return leaf;
	}
	override async revealLeaf(leaf: FakeLeaf): Promise<void> {
		for (const candidate of this.leaves) {
			const view = candidate.view as NativeView | undefined;
			if (view) view.containerEl.style.display = candidate === leaf ? '' : 'none';
		}
		await super.revealLeaf(leaf);
	}
}

/** Opt-in downstream fixture: one production root, bus and persistence authority for both views. */
export function downstreamWorkspace(reference: ReturnType<typeof referenceWorkspace>, host: HTMLElement) {
	const { stack } = reference;
	const root = createCompositionRoot({ ...DEFAULT_SETTINGS, libraryFolder: stack.libraryFolder }, stack.logger, stack.deps);
	const persistence = expectDefined(root.persistence, 'downstream browser persistence');
	let scanned = false;
	const ready = reference.ready.then(() => {
		stack.metadataCache.catchUp();
		const scan = buildProjectIndexEntries({ ...stack.deps, echo: persistence.vaultDeps.echo });
		persistence.index.rebuild(scan.entries, scan.exclusions);
		scanned = true;
		return undefined;
	});
	const vault = stack.deps.vault as Vault;
	const workspace = new BrowserWorkspace((leaf, type) => {
		if (type !== RENOVATION_PROJECT_VIEW) throw new Error(`Unexpected downstream view: ${type}`);
		const deps = renovationProjectDeps(root, workspace as unknown as Workspace, vault, {
			projectId: null, indexScanCompleted: () => scanned,
			continueContext: () => Promise.resolve(null), rememberContinue: () => undefined, forgetContinue: () => undefined,
			navigate: (projectId, section) => { void navigateToProject({ workspace: workspace as unknown as Workspace,
				reportFault: cause => { throw cause; } }, RENOVATION_PROJECT_VIEW, projectId, leaf as never, section); },
		});
		const view = new RenovationProjectView(leaf as never, deps);
		host.appendChild(view.containerEl);
		return view;
	});
	const native = planEditorDeps(root, workspace as unknown as Workspace, vault, createEditorClipboard());
	const deps = { ...native, vault: reference.deps.vault, onThemeChange: reference.deps.onThemeChange };
	const leaf = workspace.getLeaf();
	leaf.state = { type: PLAN_EDITOR_VIEW, state: { planId: reference.plan.id } };
	const attach = (view: PlanEditorView) => {
		leaf.view = view;
		window.addEventListener('pagehide', () => {
			for (const candidate of workspace.leaves) void (candidate.view as NativeView).onClose();
			for (const subscription of persistence.subscriptions) subscription.dispose();
		}, { once: true });
	};
	return { deps, leaf, attach, ready };
}

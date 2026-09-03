/**
 * Builds the real `AssetLibraryView` against a fake leaf.
 *
 * Split into its own file (the brief's own Files list, and `tests/helpers/makeRenovationProjectView.ts`'s
 * precedent) rather than a private helper inside `assetLibraryView.test.ts`, so a second suite
 * needing this view — the rebind mutation check mirrors `rootSwapRebind.test.ts`, whose own
 * cases build the view directly against the plugin's registered factory rather than through
 * this helper — is not tempted to hand-roll a second, silently drifting copy.
 *
 * The `as never` on `FakeLeaf` is the one cast this file needs: `tests/helpers/workspace.ts`
 * implements the MOCK module's `WorkspaceLeaf`, while `src/` names the real `obsidian` typings
 * and `tsconfig.json` declares no `paths` mapping between them — `assetDesignerView.test.ts`
 * and `planEditorView.test.ts` both carry the identical cast for the identical reason.
 */
import { AssetLibraryView } from '../../src/presentation/library/AssetLibraryView';
import type { AssetLibraryDeps } from '../../src/presentation/library/AssetLibraryDeps';
import { unavailableAssetLibraryCommands } from '../../src/presentation/library/AssetLibraryDeps';
import { unavailableAssetLibraryQueries } from '../../src/presentation/read-models/assetLibraryQueries';
import { createAssetLibraryChangeSource } from '../../src/application/events/assetLibraryChangeSource';
import { emptyBackgroundVault } from './background';
import { recorder } from './logger';
import { RecordingEventBus } from './domain';
import { FakeLeaf } from './workspace';

/**
 * The default `deps`: a session with nothing composed, exactly like the other three views'
 * "unavailable" defaults — nothing this task builds exercises a real catalogue read or write,
 * so refusing everything is the honest default rather than an arbitrary one. A caller that
 * needs an answering query or command overrides that one member; `{ ...defaultAssetLibraryDeps(), queries }`.
 *
 * `onLibraryChanged` is wired to a REAL (private) event bus rather than a no-op, mirroring
 * `defaultRenovationProjectDeps`'s own reasoning for `onProjectsChanged`: a bundle whose
 * subscription door does nothing at all cannot be told apart, by any test reading only the
 * bundle, from one that is correctly wired to a bus nobody happens to publish on.
 */
export function defaultAssetLibraryDeps(overrides: Partial<AssetLibraryDeps> = {}): AssetLibraryDeps {
	return {
		queries: unavailableAssetLibraryQueries(),
		commands: unavailableAssetLibraryCommands(),
		logger: recorder,
		onLibraryChanged: createAssetLibraryChangeSource(new RecordingEventBus()),
		indexScanCompleted: () => true,
		openNote: () => Promise.resolve('opened'),
		openDesigner: () => Promise.resolve(),
		vault: emptyBackgroundVault(),
		libraryFolder: 'Renovation/Library',
		...overrides,
	};
}

/**
 * Builds the view against `deps`, or — handed none — against `defaultAssetLibraryDeps()`
 * above, and against a fresh `FakeLeaf` unless a caller supplies its own (a caller that needs
 * the leaf back already holds the one it passed in, `assetDesignerView.test.ts`'s own
 * `makeView` shape).
 *
 * Returns the view DIRECTLY rather than wrapped in an object, the same shape every sibling
 * factory here takes (`makeRenovationProjectView.ts`'s `makeView`, `assetDesignerView.test.ts`'s
 * own). Not a style preference: `fallow` resolves a class member through a variable's OWN
 * explicit type, not through a property read off a destructured object — a first draft of this
 * helper answered `{ view, leaf }`, and every `const { view } = makeAssetLibraryView(...)` call
 * that followed left `AssetLibraryView.getState` reported as an unused class member, despite
 * being called from every case in `assetLibraryView.test.ts`.
 */
export function makeAssetLibraryView(
	deps: AssetLibraryDeps = defaultAssetLibraryDeps(),
	leaf: FakeLeaf = new FakeLeaf(),
): AssetLibraryView {
	return new AssetLibraryView(leaf as never, deps);
}

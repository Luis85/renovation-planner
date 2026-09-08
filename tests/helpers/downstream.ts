import { createCompositionRoot } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { planningStack } from './planning';
import { expectDefined } from './domain';
export async function downstreamStack() {
 const rig = await planningStack(); rig.stack.metadataCache.catchUp();
 const root = createCompositionRoot(DEFAULT_SETTINGS, rig.stack.logger, rig.stack.deps);
 const persistence = expectDefined(root.persistence, 'downstream persistence');
 const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: persistence.vaultDeps.echo });
 persistence.index.rebuild(scan.entries, scan.exclusions);
 return { ...rig, root, persistence, dispose: () => { for (const subscription of persistence.subscriptions) subscription.dispose(); } };
}

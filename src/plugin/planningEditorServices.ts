import { validateTradeAssignments } from '../application/commands/renovation/tradeAssignments';
import { createTrade } from '../domain/trade/Trade';
import { guardedNamedCatalogue } from './namedCatalogueServices';
import type { PlanId } from '../domain/plan/PlanId';
import type { Vault, Workspace } from 'obsidian';
import { EMPTY_RENOVATION } from '../domain/renovation/Renovation';
import { planningServices, readPlanning, type PlanningDeps } from '../application/commands/renovation/PlanningServices';
import { renovationLinkCheckAgainst } from '../application/commands/renovation/renovationLinkCheck';
import { renovationServices } from '../application/commands/renovation/RenovationCommand';
import { constructionAwareRenovation } from '../application/commands/renovation/ConstructionMaterialCommand';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { ObsidianEvidenceFiles } from '../infrastructure/obsidian/repositories/ObsidianEvidenceFiles';
import type { PlanEditorCommandServices } from '../presentation/editor/planEditorCommands';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
import { guardedRenovation } from './guardedRenovation';
import { reviewNoteAction } from './reviewNoteAction';
import type { CompositionRoot } from './composition-root';

export function planningEditorServices(root: CompositionRoot, vault: Vault, workspace: Workspace): Pick<PlanEditorCommandServices, 'planning' | 'renovation' | 'evidenceFiles' | 'shoppingNote' | 'tradeCatalogue'> {
	const persistence = root.persistence;
	if (!persistence) return {};
	const deps: PlanningDeps = { ...persistence, events: root.eventBus };
	const services = planningServices(deps);
	const read = guardCommand({ execute: (id: PlanId) => services.read(id) }, 'planning.read.failed', root.logger, VAULT_EXCEPTION_MAPPER);
	return {
		tradeCatalogue: guardedNamedCatalogue({ kind: 'trade', repository: persistence.trades, create: createTrade }, root.eventBus, root.logger),
		planning: { read: id => read.execute(id), material(baseline, input, ledger) {
			const command = services.material(baseline, input, ledger);
			const execute = guardCommand({ execute: () => command.execute() }, 'material.execute.failed', root.logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'material.undo.failed', root.logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		} },
		// One fresh planning read per write, shared by both checks that need one: the trade check
		// (`validateTradeAssignments`, which diffs against the previous renovation) and
		// `renovationLinkCheckAgainst` (materials + depth links) — run against the SAME read, so
		// they cannot see different vault states.
		renovation: guardedRenovation(constructionAwareRenovation(renovationServices(persistence.plans, persistence.geometry, root.eventBus, async (plan, document) => {
			const fresh = await readPlanning(deps, plan.id);
			if (!fresh.ok) return fresh;
			const proposed = plan.renovation ?? EMPTY_RENOVATION;
			const trades = await validateTradeAssignments(proposed, fresh.value.plan.entity.renovation ?? EMPTY_RENOVATION, persistence.trades);
			if (!trades.ok) return trades;
			return renovationLinkCheckAgainst(proposed, fresh.value, document);
		}), deps), root.logger),
		evidenceFiles: new ObsidianEvidenceFiles({ vault, workspace, cache: persistence.vaultDeps.metadataCache, index: persistence.index }),
		shoppingNote: reviewNoteAction(vault, workspace, persistence.index, root.logger, 'shopping'),
	};
}

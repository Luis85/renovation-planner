import type { PlanId } from '../domain/plan/PlanId';
import type { Vault, Workspace } from 'obsidian';
import { err } from '../core/result/Result';
import { EMPTY_RENOVATION } from '../domain/renovation/Renovation';
import { planningServices, readPlanning, type PlanningDeps } from '../application/commands/renovation/PlanningServices';
import { validateDepthLinks } from '../application/commands/renovation/planningLinks';
import { renovationServices } from '../application/commands/renovation/RenovationCommand';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { ObsidianEvidenceFiles } from '../infrastructure/obsidian/repositories/ObsidianEvidenceFiles';
import type { PlanEditorCommandServices } from '../presentation/editor/planEditorCommands';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
import { guardedRenovation } from './guardedRenovation';
import { reviewNoteAction } from './reviewNoteAction';
import type { CompositionRoot } from './composition-root';

export function planningEditorServices(root: CompositionRoot, vault: Vault, workspace: Workspace): Pick<PlanEditorCommandServices, 'planning' | 'renovation' | 'evidenceFiles' | 'shoppingNote'> {
	const persistence = root.persistence;
	if (!persistence) return {};
	const deps: PlanningDeps = { ...persistence, events: root.eventBus };
	const services = planningServices(deps);
	const read = guardCommand({ execute: (id: PlanId) => services.read(id) }, 'planning.read.failed', root.logger, VAULT_EXCEPTION_MAPPER);
	return {
		planning: { read: id => read.execute(id), material(baseline, input, ledger) {
			const command = services.material(baseline, input, ledger);
			const execute = guardCommand({ execute: () => command.execute() }, 'material.execute.failed', root.logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'material.undo.failed', root.logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		} },
		renovation: guardedRenovation(renovationServices(persistence.plans, persistence.geometry, root.eventBus, async (plan, document) => {
			const fresh = await readPlanning(deps, plan.id);
			if (!fresh.ok) return fresh;
			const links = validateDepthLinks(plan.renovation ?? EMPTY_RENOVATION, { ...fresh.value, geometry: { ...fresh.value.geometry, document } });
			return links.ok ? links : err(links.error);
		}), root.logger),
		evidenceFiles: new ObsidianEvidenceFiles({ vault, workspace, cache: persistence.vaultDeps.metadataCache, index: persistence.index }),
		shoppingNote: reviewNoteAction(vault, workspace, persistence.index, root.logger, 'shopping'),
	};
}

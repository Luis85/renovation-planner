import { MaterialCommand } from './MaterialCommand';
import { readPlanning, type PlanningDeps, type PlanningServices } from './materialPlanning';
export { readPlanning, prepareMaterial, type PlanningBaseline, type PlanningDeps, type MaterialInput, type PlanningServices } from './materialPlanning';
export function planningServices(deps: PlanningDeps): PlanningServices {
 return { read: id => readPlanning(deps, id), material(baseline, input, ledger) { const command = new MaterialCommand(deps, baseline, input, ledger); return { execute: () => command.run(true), undo: () => command.run(false) }; } };
}

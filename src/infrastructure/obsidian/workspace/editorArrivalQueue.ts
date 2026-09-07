import type { WorkspaceLeaf } from 'obsidian';
import type { ProjectOrigin } from '../../../application/navigation/ProjectDestination';
type Outcome = 'opened' | 'failed';
interface Arrival { issue: number; result: Promise<Outcome> }
interface Lane { latest: number; tail: Promise<void>; pending: Map<string, Arrival> }
const lanes = new WeakMap<WorkspaceLeaf, Lane>();
let issued = 0;
/** Issue order is captured before reveal; identical pending arrivals share one host action. */
export function prepareEditorArrival(origin: ProjectOrigin): (leaf: WorkspaceLeaf, reportFault: (cause: unknown) => void) => Promise<Outcome> {
 const issue = ++issued, key = JSON.stringify(origin);
 return (leaf, reportFault) => {
  const lane = lanes.get(leaf) ?? { latest: 0, tail: Promise.resolve(), pending: new Map<string, Arrival>() };
  lanes.set(leaf, lane);
  if (issue < lane.latest) return Promise.resolve('opened');
  lane.latest = issue;
  const joined = lane.pending.get(key);
  if (joined) { joined.issue = issue; return joined.result; }
  const entry: Arrival = { issue, result: Promise.resolve('opened') };
  entry.result = lane.tail.then(async () => {
   if (entry.issue !== lane.latest) return 'opened';
   try {
    const state = leaf.getViewState();
    await leaf.setViewState({ ...state, active: true, state: { ...state.state, planId: origin.planId, origin } });
    return 'opened';
   } catch (cause) { reportFault(cause); return 'failed'; }
  }).finally(() => { lane.pending.delete(key); });
  lane.pending.set(key, entry);
  lane.tail = entry.result.then(() => undefined, () => undefined);
  return entry.result;
 };
}

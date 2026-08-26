/**
 * @vitest-environment jsdom
 *
 * Design slice 11's Error Boundary over design slice 10's services.
 *
 * The claim under test is the composition, not the guard: `guardCommand`/`guardQuery` have
 * their own suite (`tests/application/errors/guardAgainstThrowing.test.ts`), and a wrapper
 * that is never applied passes every one of those tests. So this file asks the ROOT — is
 * each slice-10 command and query a WRAPPER when it leaves, and does a fault below it
 * arrive as a resolved failed `Result` with the boundary's own event in the log?
 *
 * Two halves, because neither is sufficient alone. The identity half names all twelve
 * services one at a time: a missing guard is a single service that silently rejects, and a
 * count would not say which. The behavioural half drives a real throw through one command
 * and one query, because "not an instance of the class" is also true of any other object —
 * only the resolved refusal plus the named log line say that the thing wrapping it is the
 * boundary.
 *
 * Deliberately NOT the category invariant ("every member of `PersistenceServices` that is
 * a Command or a Query is guarded"). That check has to be made at the forbidden thing
 * rather than by enumerating, and a later task owns it; what this file guarantees is
 * exactly the twelve services it names.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { installObsidianDom } from '../helpers/dom';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { CreateAssetCommand } from '../../src/application/commands/asset/CreateAsset';
import { UpdateAssetCommand } from '../../src/application/commands/asset/UpdateAsset';
import { DeleteAssetCommand } from '../../src/application/commands/asset/DeleteAsset';
import { AssignAssetCommand } from '../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { SetRequirementQuantityOverrideCommand } from '../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../src/application/commands/requirement/SetRequirementCostOverride';
import { DeleteRequirementCommand } from '../../src/application/commands/requirement/DeleteRequirement';
import { GetRequirementsForZone } from '../../src/application/queries/GetRequirementsForZone';
import { ListAssets } from '../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../src/application/queries/ListReassignmentTargets';

installObsidianDom();

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [], getMarkdownFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

function composed() {
	const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
	const persistence = root.persistence;
	if (persistence === null) throw new Error('expected a composed persistence stack');
	return persistence;
}

/**
 * Shadow every port method on a composed repository with a thrower. Own properties, so the
 * prototype's methods are hidden without touching the class — and the commands hold THIS
 * instance, which is the whole point: the fault has to originate below the boundary.
 */
function detonate(repository: object): void {
	const methods = ['getById', 'save', 'delete', 'listByProject', 'listByPlan', 'listByZone', 'listByAsset', 'markStale'];
	for (const method of methods) {
		Object.defineProperty(repository, method, {
			configurable: true,
			value: () => {
				throw new Error('the vault exploded');
			},
		});
	}
}

describe('slice 10 leaves the composition root guarded', () => {
	it('hands out a wrapper for every slice-10 command, never the command class', () => {
		const persistence = composed();

		expect(persistence.createAsset).not.toBeInstanceOf(CreateAssetCommand);
		expect(persistence.updateAsset).not.toBeInstanceOf(UpdateAssetCommand);
		expect(persistence.deleteAsset).not.toBeInstanceOf(DeleteAssetCommand);
		expect(persistence.assignAsset).not.toBeInstanceOf(AssignAssetCommand);
		expect(persistence.recalculateRequirement).not.toBeInstanceOf(RecalculateRequirementCommand);
		expect(persistence.setRequirementQuantityOverride).not.toBeInstanceOf(SetRequirementQuantityOverrideCommand);
		expect(persistence.setRequirementCostOverride).not.toBeInstanceOf(SetRequirementCostOverrideCommand);
		expect(persistence.deleteRequirement).not.toBeInstanceOf(DeleteRequirementCommand);

		// Still callable, and still only `execute`: the guard hands back the Command shape
		// and nothing else, which is why the fields are typed structurally.
		expect(typeof persistence.createAsset.execute).toBe('function');
		expect(typeof persistence.deleteRequirement.execute).toBe('function');
	});

	it('hands out a wrapper for every slice-10 query, never the query class', () => {
		const { requirementQueries } = composed();

		expect(requirementQueries.getRequirementsForZone).not.toBeInstanceOf(GetRequirementsForZone);
		expect(requirementQueries.listAssets).not.toBeInstanceOf(ListAssets);
		expect(requirementQueries.listRequirementsReferencing).not.toBeInstanceOf(ListRequirementsReferencing);
		expect(requirementQueries.listReassignmentTargets).not.toBeInstanceOf(ListReassignmentTargets);
		expect(typeof requirementQueries.listAssets.execute).toBe('function');
	});

	/**
	 * The two override commands are the exception this root writes down rather than hides:
	 * the Inspector's reversible adapters dispatch through `executeWithVersion`, which the
	 * guard does not wrap, so `requirementEdits` carries the CONCRETE commands beside their
	 * guarded twins. Asserted so the exception cannot be closed by accident and cannot be
	 * widened by accident either.
	 */
	it('carries the unguarded concrete override commands under requirementEdits, and only there', () => {
		const { requirementEdits } = composed();

		expect(requirementEdits.setQuantityOverride).toBeInstanceOf(SetRequirementQuantityOverrideCommand);
		expect(requirementEdits.setCostOverride).toBeInstanceOf(SetRequirementCostOverrideCommand);
		expect(requirementEdits.assignAsset).toBeInstanceOf(AssignAssetCommand);
		expect(Object.keys(requirementEdits)).toEqual(['assignAsset', 'setQuantityOverride', 'setCostOverride']);
	});

	it('turns a thrown fault inside a slice-10 command into a resolved refusal, logged at the boundary', async () => {
		resetRecorder();
		const persistence = composed();
		detonate(persistence.requirements);

		const result = await persistence.recalculateRequirement.execute({ requirementId: 'req-1' as never });

		expect(result.ok).toBe(false);
		// Mapped by the vault exception mapper, so the caller gets a coded error rather than
		// the raw `Error` — and the log line names THIS service's boundary, not a shared one.
		expect(result.ok === false && result.error.category).toBe('Persistence');
		const logged = lines.filter((line) => line.event === 'command.recalculateRequirement.failed');
		expect(logged).toHaveLength(1);
		expect(logged[0].context?.cause).toBeInstanceOf(Error);
	});

	it('turns a thrown fault inside a slice-10 query into a resolved refusal, logged at the boundary', async () => {
		resetRecorder();
		const persistence = composed();
		detonate(persistence.assets);

		const result = await persistence.requirementQueries.listAssets.execute('project-1' as never);

		expect(result.ok).toBe(false);
		const logged = lines.filter((line) => line.event === 'query.listAssets.failed');
		expect(logged).toHaveLength(1);
	});
});

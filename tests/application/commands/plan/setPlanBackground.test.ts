/**
 * `SetPlanBackgroundCommand` and its snapshot inverse — design slice 5's one write.
 *
 * Everything here runs against in-memory repositories, so what is being checked is the
 * command's own behaviour: what it validates, what it writes, what it publishes, and what
 * it leaves untouched when it refuses.
 */
import { describe, expect, it } from 'vitest';
import { ReversibleSetPlanBackgroundCommand } from '../../../../src/application/commands/plan/ReversibleSetPlanBackground';
import { SetPlanBackgroundCommand } from '../../../../src/application/commands/plan/SetPlanBackground';
import type { VaultFileProbe } from '../../../../src/application/ports/VaultFileProbe';
import type { PlanBackgroundRef } from '../../../../src/domain/plan/PlanBackgroundRef';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';

const GROUND_PNG: PlanBackgroundRef = { path: 'Plans/ground.png', kind: 'image' };
const GROUND_PDF: PlanBackgroundRef = { path: 'Plans/ground.pdf', kind: 'pdf', page: 2 };

/** Every path in `present` exists; everything else does not. */
function probe(present: readonly string[]): VaultFileProbe {
	return { fileExists: (path) => present.includes(path) };
}

function wired(present: readonly string[] = [GROUND_PNG.path, GROUND_PDF.path]) {
	const plans = new InMemoryPlanRepository();
	const events = new RecordingEventBus();
	const command = new SetPlanBackgroundCommand(plans, probe(present), events);
	return { plans, events, command, reversible: new ReversibleSetPlanBackgroundCommand(command, plans) };
}

async function storedPlan(plans: InMemoryPlanRepository, background: PlanBackgroundRef | null = null) {
	const plan = makePlan({ projectId: createProjectId(), background });
	return expectOk(await plans.save(plan, 'absent'));
}

describe('setting a plan background', () => {
	it('writes the reference and publishes PlanBackgroundChanged', async () => {
		const { plans, events, command } = wired();
		const loaded = await storedPlan(plans);

		const { plan, previousBackground } = expectOk(
			await command.execute({ planId: loaded.entity.id, background: GROUND_PNG }),
		);

		expect(plan.entity.background).toEqual(GROUND_PNG);
		expect(previousBackground).toBeNull();
		expect(events.published).toEqual([
			{
				type: 'PlanBackgroundChanged',
				payload: { planId: loaded.entity.id, projectId: loaded.entity.projectId },
			},
		]);
	});

	it('keeps a pdf page on the reference it writes', async () => {
		const { plans, command } = wired();
		const loaded = await storedPlan(plans);

		const { plan } = expectOk(await command.execute({ planId: loaded.entity.id, background: GROUND_PDF }));

		expect(plan.entity.background).toEqual(GROUND_PDF);
	});

	it('reports the reference it replaced, so an inverse has something to restore', async () => {
		const { plans, command } = wired();
		const loaded = await storedPlan(plans, GROUND_PNG);

		const { previousBackground } = expectOk(
			await command.execute({ planId: loaded.entity.id, background: GROUND_PDF }),
		);

		expect(previousBackground).toEqual(GROUND_PNG);
	});
});

describe('what it refuses, writing nothing', () => {
	it('refuses a path that resolves to no vault file, with a ReferenceError', async () => {
		const { plans, events, command } = wired([]);
		const loaded = await storedPlan(plans);

		const error = expectErr(await command.execute({ planId: loaded.entity.id, background: GROUND_PNG }));

		expect(error).toMatchObject({ category: 'Reference', code: 'plan.background-not-found' });
		expect(expectOk(await plans.getById(loaded.entity.id))?.entity.background).toBeNull();
		expect(events.published).toHaveLength(0);
	});

	it('refuses an unsupported file type with a ValidationError', async () => {
		const { plans, events, command } = wired(['Plans/ground.dwg']);
		const loaded = await storedPlan(plans);

		const error = expectErr(
			await command.execute({
				planId: loaded.entity.id,
				background: { path: 'Plans/ground.dwg', kind: 'image' },
			}),
		);

		expect(error).toMatchObject({ category: 'Validation', code: 'plan.unsupported-background' });
		expect(events.published).toHaveLength(0);
	});

	/**
	 * A `.pdf` labelled as an image would reach `loadBackground` and be handed to the image
	 * decoder, which fails at RENDER — a broken canvas with nothing pointing at the cause.
	 * The kind and the extension have to agree, and this is the only place that can be
	 * checked: `PlanBackgroundRef.kind` is already narrowed to the two the type allows.
	 */
	it('refuses a kind that disagrees with the path', async () => {
		const { plans, command } = wired();
		const loaded = await storedPlan(plans);

		const error = expectErr(
			await command.execute({
				planId: loaded.entity.id,
				background: { path: GROUND_PDF.path, kind: 'image' },
			}),
		);

		expect(error).toMatchObject({ code: 'plan.unsupported-background' });
	});

	it('refuses a plan that does not exist', async () => {
		const { events, command } = wired();

		const error = expectErr(
			await command.execute({ planId: 'plan-missing' as never, background: GROUND_PNG }),
		);

		expect(error).toMatchObject({ category: 'Reference', code: 'plan.plan-not-found' });
		expect(events.published).toHaveLength(0);
	});

	/**
	 * The cheap refusal costs no vault read. Asserted through the repository rather than by
	 * timing: a command that read the plan first would have loaded one before deciding, and
	 * an in-memory repository can say whether it was asked.
	 */
	it('checks the file before it reads the plan', async () => {
		const reads: string[] = [];
		class CountingReads extends InMemoryPlanRepository {
			override getById(id: Parameters<InMemoryPlanRepository['getById']>[0]) {
				reads.push(String(id));
				return super.getById(id);
			}
		}
		const plans = new CountingReads();
		const loaded = await storedPlan(plans);
		const command = new SetPlanBackgroundCommand(plans, probe([]), new RecordingEventBus());
		// The setup above read nothing, but `storedPlan` may in future; cleared so the
		// assertion is about the command's own reads and not about the fixture's.
		reads.length = 0;

		expectErr(await command.execute({ planId: loaded.entity.id, background: GROUND_PNG }));

		expect(reads).toEqual([]);
	});
});

describe('undoing a background import', () => {
	it('restores the previous reference', async () => {
		const { plans, reversible } = wired();
		const loaded = await storedPlan(plans, GROUND_PNG);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PDF }));
		expectOk(await reversible.undo());

		expect(expectOk(await plans.getById(loaded.entity.id))?.entity.background).toEqual(GROUND_PNG);
	});

	/**
	 * The case an inverse that treats `null` as "nothing to restore" gets wrong while
	 * passing every replace-an-existing-background test. Undoing the FIRST import has to
	 * leave the plan with no background at all.
	 */
	it('restores a null, which is what the first import replaced', async () => {
		const { plans, reversible } = wired();
		const loaded = await storedPlan(plans);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		expectOk(await reversible.undo());

		expect(expectOk(await plans.getById(loaded.entity.id))?.entity.background).toBeNull();
	});

	it('re-emits no event: one field on one note has no cascade behind it', async () => {
		const { plans, events, reversible } = wired();
		const loaded = await storedPlan(plans);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		events.published.length = 0;
		expectOk(await reversible.undo());

		expect(events.published).toHaveLength(0);
	});

	/**
	 * DoD 12's real content. An UNCONDITIONAL restore passes every single-writer test above
	 * — what distinguishes an inverse from an overwrite is that it refuses when the field it
	 * would restore has moved since. Two codes because the recoveries differ: another tab
	 * bumped the revision, or a hand edit left the revision alone and changed the bytes.
	 */
	it('refuses when another writer changed the plan in between', async () => {
		const { plans, command, reversible } = wired();
		const loaded = await storedPlan(plans);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		// A second writer — the same command again, as another tab would run it.
		expectOk(await command.execute({ planId: loaded.entity.id, background: GROUND_PDF }));

		const error = expectErr(await reversible.undo());

		expect(error).toMatchObject({ code: 'plan.revision-conflict' });
		// And it wrote nothing: the second writer's background is still there.
		expect(expectOk(await plans.getById(loaded.entity.id))?.entity.background).toEqual(GROUND_PDF);
	});

	/**
	 * The OTHER refusal, and it is a different code on purpose: a hand edit or a sync leaves
	 * the revision alone and changes the bytes, so the recovery is "someone else's change is
	 * on disk, look at it", not "re-read and retry". `poke` is the in-memory stand-in for
	 * exactly that — it advances the observed token without bumping the revision.
	 */
	it('refuses when the note was changed outside the plugin', async () => {
		const { plans, reversible } = wired();
		const loaded = await storedPlan(plans);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		plans.poke(loaded.entity.id);

		const error = expectErr(await reversible.undo());

		expect(error).toMatchObject({ code: 'plan.external-modification' });
		expect(expectOk(await plans.getById(loaded.entity.id))?.entity.background).toEqual(GROUND_PNG);
	});

	it('records no snapshot when the forward write failed', async () => {
		const { plans, reversible } = wired([]);
		const loaded = await storedPlan(plans);

		expectErr(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		const error = expectErr(await reversible.undo());

		expect(error).toMatchObject({ code: 'plan.nothing-to-undo' });
	});

	it('spends its snapshot, so a second undo refuses rather than writing again', async () => {
		const { plans, reversible } = wired();
		const loaded = await storedPlan(plans);

		expectOk(await reversible.execute({ planId: loaded.entity.id, background: GROUND_PNG }));
		expectOk(await reversible.undo());
		const error = expectErr(await reversible.undo());

		expect(error).toMatchObject({ code: 'plan.nothing-to-undo' });
	});
});

/**
 * The three failure paths that are not about the INPUT — the vault refusing a read, the
 * domain refusing the value, and the write itself failing. Each returns the error it was
 * given rather than inventing one, and none of them publishes.
 */
describe('when the store itself refuses', () => {
	it('surfaces a failed read rather than reporting a missing plan', async () => {
		const events = new RecordingEventBus();
		class FailingRead extends InMemoryPlanRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const command = new SetPlanBackgroundCommand(new FailingRead(), probe([GROUND_PNG.path]), events);

		const error = expectErr(await command.execute({ planId: 'plan-1' as never, background: GROUND_PNG }));

		expect(error).toEqual(injectedPersistenceError());
		expect(events.published).toHaveLength(0);
	});

	/**
	 * The failure is ARMED after the seed, not before. A repository whose `save` always
	 * failed could not hold the plan the command has to read first — the command would
	 * refuse with `plan.plan-not-found` and the test would pass green on a path that never
	 * reached a write at all. The exact error code below is what makes that distinction
	 * visible rather than assumed.
	 */
	it('surfaces a failed write, having published nothing', async () => {
		const events = new RecordingEventBus();
		class ArmableSave extends InMemoryPlanRepository {
			armed = false;

			override save(...args: Parameters<InMemoryPlanRepository['save']>) {
				return this.armed ? Promise.resolve(injectedReadFailure()) : super.save(...args);
			}
		}
		const plans = new ArmableSave();
		const loaded = await storedPlan(plans);
		plans.armed = true;
		const command = new SetPlanBackgroundCommand(plans, probe([GROUND_PNG.path]), events);

		const error = expectErr(await command.execute({ planId: loaded.entity.id, background: GROUND_PNG }));

		expect(error).toEqual(injectedPersistenceError());
		expect(events.published).toHaveLength(0);
	});

	/**
	 * The DOMAIN's own refusal, reached through the command: a page of zero passes the
	 * extension check and the file check and is stopped by `withBackground`. That is the
	 * point of routing through the entity rather than validating here — one set of rules,
	 * whichever door a value comes through.
	 */
	it('surfaces the domain refusal for a value the file checks let through', async () => {
		const { plans, events, command } = wired(['Plans/ground.pdf']);
		const loaded = await storedPlan(plans);

		const error = expectErr(
			await command.execute({
				planId: loaded.entity.id,
				background: { path: 'Plans/ground.pdf', kind: 'pdf', page: 0 },
			}),
		);

		expect(error).toMatchObject({ category: 'Validation', code: 'plan.invalid-background-page' });
		expect(events.published).toHaveLength(0);
	});
});

/**
 * @vitest-environment jsdom
 *
 * AD13's duplicate half as the library draws it: the `Duplicate` action, the panel it opens, the
 * plan-usage scope inside that panel, and the two doors out of it.
 *
 * Driven through `mountInspector` — the real `AssetInspector` over a hydrated store — rather than
 * by mounting either new component bare, because what these cases are about is the WIRING: which
 * gesture reaches which command with which input, and what is on screen while it has not answered.
 * A bare mount would pass with the action button wired to nothing.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { AssetPlanUsage } from '../../../src/application/queries/ListPlansUsingAsset';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import type { Asset } from '../../../src/domain/asset/Asset';
import type { AssetLibraryCommandServices } from '../../../src/presentation/library/AssetLibraryDeps';
import type { DuplicateAssetInput } from '../../../src/application/commands/asset/DuplicateAsset';
import { anEntry } from '../../helpers/assetLibraryRootHarness';
import { makeAsset } from '../../helpers/entities';
import { mountInspector } from '../../helpers/assetInspectorHarness';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';

installObsidianDom();

const REFUSAL = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the vault would not answer',
} as const;

function usage(overrides: Partial<AssetPlanUsage> = {}): AssetPlanUsage {
	return {
		plans: [
			{ planId: createPlanId(), planName: 'Kitchen', projectId: createProjectId(), placements: 2 },
		],
		unreadable: 0,
		...overrides,
	};
}

/** Exactly the door the bundle declares, so a mock cannot be kinder than the command it stands for. */
type DuplicateDoor = (input: DuplicateAssetInput) => Promise<Result<Asset, AppError>>;

/** The answering pair: a usage read that settles, and a duplicate that records what it was asked. */
function doors(options: { scope?: AssetPlanUsage; duplicate?: Mock<DuplicateDoor> } = {}) {
	const duplicate = options.duplicate ?? vi.fn<DuplicateDoor>(() => Promise.resolve(ok(makeAsset())));
	const commands: Partial<AssetLibraryCommandServices> = {
		listPlansUsingAsset: { execute: () => Promise.resolve(ok(options.scope ?? usage())) },
		duplicateAsset: { execute: duplicate },
	};
	return { duplicate, commands };
}

async function opened(options: Parameters<typeof doors>[0] = {}) {
	const entry = anEntry({ name: 'Wall oven' });
	const wired = doors(options);
	const inspector = await mountInspector({
		entries: [entry],
		assetId: entry.assetId,
		commands: wired.commands,
	});
	await inspector.panel.get('[data-action="duplicate-open"]').trigger('click');
	await settle();
	return { entry, inspector, duplicate: wired.duplicate };
}

describe('the Duplicate action', () => {
	it('is drawn for a readable asset and opens a panel prefilled with a copy name', async () => {
		const open = await opened();

		const field = open.inspector.panel.get<HTMLInputElement>('[data-field="duplicate-name"]');
		expect(field.element.value).toBe('Wall oven (copy)');
		expect(open.inspector.panel.text()).toContain('Duplicate as new asset');
	});

	it('is not drawn at all for an asset this build cannot read', async () => {
		// The predicate rule: a control that could only refuse is not drawn, never `:disabled`.
		const inspector = await mountInspector({ entries: [], assetId: 'asset-gone' as AssetId });

		expect(inspector.panel.find('[data-action="duplicate-open"]').exists()).toBe(false);
	});

	it('is withdrawn while its own panel is open, so one gesture cannot open two', async () => {
		const open = await opened();

		expect(open.inspector.panel.find('[data-action="duplicate-open"]').exists()).toBe(false);
	});
});

describe('the duplicate panel', () => {
	it('shows which plans place the definition before anything is dispatched', async () => {
		const open = await opened();

		expect(open.inspector.panel.text()).toContain('Used in plans');
		expect(open.inspector.panel.get('[data-plan-id]').text()).toBe('Kitchen — 2 placement(s)');
		expect(open.duplicate).not.toHaveBeenCalled();
	});

	it('says the scope is incomplete when some plans could not be read', async () => {
		// C08 at the surface: a scope that quietly omitted what it could not read would understate
		// the blast radius of the change it was consulted about.
		const open = await opened({ scope: usage({ unreadable: 3 }) });

		expect(open.inspector.panel.get('[data-usage-incomplete]').text()).toContain('3 note(s) could not be read');
	});

	it('draws the refusal rather than an empty scope when the usage read refuses', async () => {
		const entry = anEntry();
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			commands: { listPlansUsingAsset: { execute: () => Promise.resolve(err(REFUSAL)) } },
		});
		await inspector.panel.get('[data-action="duplicate-open"]').trigger('click');
		await settle();

		expect(inspector.panel.text()).not.toContain('No plan places this asset');
		expect(inspector.panel.findAll('.rp-al-inspector__refusal').some((p) => p.text().length > 0)).toBe(true);
	});

	it('dispatches the real command with the subject and the typed name', async () => {
		const open = await opened();
		const field = open.inspector.panel.get('[data-field="duplicate-name"]');
		await field.setValue('Wall oven, second run');

		await open.inspector.panel.get('[data-action="duplicate-confirm"]').trigger('submit');
		await settle();

		expect(open.duplicate).toHaveBeenCalledWith({ assetId: open.entry.assetId, name: 'Wall oven, second run' });
	});

	it('closes on success, leaving the selection where it was', async () => {
		const open = await opened();

		await open.inspector.panel.get('[data-action="duplicate-confirm"]').trigger('submit');
		await settle();

		expect(open.inspector.panel.find('[data-field="duplicate-name"]').exists()).toBe(false);
		expect(open.inspector.panel.get('.rp-al-inspector__name').text()).toBe('Wall oven');
	});

	it('stays open and says why when the command refuses', async () => {
		const open = await opened({ duplicate: vi.fn<DuplicateDoor>(() => Promise.resolve(err(REFUSAL))) });

		await open.inspector.panel.get('[data-action="duplicate-confirm"]').trigger('submit');
		await settle();

		expect(open.inspector.panel.find('[data-field="duplicate-name"]').exists()).toBe(true);
		expect(open.inspector.panel.get('[role="alert"]').text().length).toBeGreaterThan(0);
	});

	it('dispatches nothing on cancel and leaves the panel gone', async () => {
		// AD13 criterion 4's cancel half, asserted at the gesture: no command was reached, so
		// there is no id, reference or link to be left pointing at anything.
		const open = await opened();

		await open.inspector.panel.get('[data-action="duplicate-cancel"]').trigger('click');
		await settle();

		expect(open.duplicate).not.toHaveBeenCalled();
		expect(open.inspector.panel.find('[data-field="duplicate-name"]').exists()).toBe(false);
		expect(open.inspector.panel.find('[data-action="duplicate-open"]').exists()).toBe(true);
	});

	it('closes when the selection moves, so no name is carried from the previous asset', async () => {
		const other = anEntry({ name: 'Sink' });
		const wired = doors();
		const first = anEntry({ name: 'Wall oven' });
		const inspector = await mountInspector({
			entries: [first, other],
			assetId: first.assetId,
			commands: wired.commands,
		});
		await inspector.panel.get('[data-action="duplicate-open"]').trigger('click');
		await settle();

		await inspector.select(other.assetId);

		expect(inspector.panel.find('[data-field="duplicate-name"]').exists()).toBe(false);
		await inspector.panel.get('[data-action="duplicate-open"]').trigger('click');
		await settle();
		expect(inspector.panel.get<HTMLInputElement>('[data-field="duplicate-name"]').element.value).toBe('Sink (copy)');
	});
});

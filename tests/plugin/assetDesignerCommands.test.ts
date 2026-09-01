/**
 * @vitest-environment jsdom
 *
 * The one command that makes ADR-0015's Asset Designer reachable at all: a picker over the
 * vault's whole catalogue (`ListAssets`, vault-wide since design slice 19).
 *
 * It is a plain `callback`, never a `checkCallback` — the `open-plan-editor` defect refused
 * in advance: a precondition requiring something the app cannot yet create kept that command
 * out of the palette in every vault that had none. And it shares its activation mechanism
 * with the create-asset dialog's own hand-off (`ViewRoot.onCreateAsset`, through
 * `renovationProjectOpenAsset`) rather than deciding activation twice — the two cases under
 * "two activations racing" are what proves the shared mechanism's key is the view type PLUS
 * the state: keying on the type alone would collapse the multiplicity the designer exists to
 * permit, and the same-asset case alone would pass against that broken key.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Command } from 'obsidian';
// Mock-only surface, imported BY NAME — see `planEditorCommands.test.ts`'s own header for why:
// `FuzzySuggestModal` and `Notice` carry members (`opened`, `shown`, `choose`) the real
// `obsidian` module does not declare, and the vitest alias points the bare specifier at this
// very file, so this is the same class the code under test constructs.
import { FuzzySuggestModal, Notice } from '../helpers/obsidian-mock';
import { registerAssetDesignerCommands } from '../../src/plugin/assetDesignerCommands';
import type { PluginCommandHost } from '../../src/plugin/commandHost';
import { ASSET_DESIGNER_VIEW } from '../../src/presentation/designer/AssetDesignerView';
import { InMemoryAssetRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { ListAssets } from '../../src/application/queries/ListAssets';
import { t } from '../../src/presentation/i18n/strings';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { err } from '../../src/core/result/Result';
import { FakeWorkspace } from '../helpers/workspace';
import type { Asset } from '../../src/domain/asset/Asset';

interface Wired {
	readonly host: PluginCommandHost;
	readonly workspace: FakeWorkspace;
	readonly commands: Command[];
}

async function wired(
	options: { withPersistence?: boolean; assets?: readonly Asset[] } = {},
): Promise<Wired> {
	const repo = new InMemoryAssetRepository();
	for (const asset of options.assets ?? [makeAsset({ name: 'Porcelain Tile' })]) {
		expectOk(await repo.save(asset, 'absent'));
	}

	const workspace = new FakeWorkspace();
	const commands: Command[] = [];

	const host: PluginCommandHost = {
		app: { workspace } as never,
		root: {
			logger: recorder,
			persistence:
				options.withPersistence === false
					? null
					: {
							requirementQueries: { listAssets: new ListAssets(repo) },
						},
		} as never,
		addCommand: (command) => commands.push(command),
	};

	registerAssetDesignerCommands(host);
	return { host, workspace, commands };
}

/**
 * The command dispatches through a promise chain it deliberately does not return — Obsidian's
 * `callback` returns nothing — so a test has to let the microtask queue drain before asking
 * what happened. A macrotask hop, not a fixed number of `await`s, for `planEditorCommands.
 * test.ts`'s own reason: the chain's length is an implementation detail.
 */
function flush(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

installObsidianDom();

beforeEach(() => {
	Notice.shown.length = 0;
	FuzzySuggestModal.opened.length = 0;
	// A notice is INERT until something activates the queue — per test, and dedup would fold
	// two identical sentences from separate cases into one `(×2)`.
	activateNotices();
});

describe('open asset designer', () => {
	/**
	 * Case 1 of Task B9's brief: NO precondition, unlike `open-plan-editor` before its own
	 * fix. A `checkCallback` requiring some existing state would keep this command out of the
	 * palette in exactly the vault it exists to help — one with no assets yet.
	 */
	it('is a plain callback, so it appears in the palette in a vault with no assets', async () => {
		const { commands } = await wired({ assets: [] });

		const registered = commands.find((c) => c.id === 'open-asset-designer');
		expect(registered?.callback).toBeTypeOf('function');
		expect(registered?.checkCallback).toBeUndefined();
	});

	it('carries an unprefixed id and a translated name', async () => {
		const { commands } = await wired();

		const registered = commands.find((c) => c.id === 'open-asset-designer');
		expect(registered?.id).toBe('open-asset-designer');
		expect(registered?.name).toBe(t('en', 'command.open-asset-designer'));
	});

	it('offers every asset the catalogue holds, and nothing that is not one', async () => {
		const asset = makeAsset({ name: 'Porcelain Tile' });
		const { commands } = await wired({ assets: [asset] });

		commands[0].callback?.();
		// `openAssetPicker` is async — it awaits `ListAssets` — so the picker opens only after
		// that resolves, unlike `open-plan-editor`'s synchronous index read.
		await flush();

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<Asset>;
		expect(picker.getItems().map((item) => item.name)).toEqual(['Porcelain Tile']);
		expect(picker.getItemText(picker.getItems()[0])).toBe('Porcelain Tile');
		// The placeholder is the command's own name, translated — not a literal.
		expect(picker.placeholder).toBe(t('en', 'command.open-asset-designer'));
	});

	it('opens the designer for the asset the user picks', async () => {
		const asset = makeAsset({ name: 'Porcelain Tile' });
		const { commands, workspace } = await wired({ assets: [asset] });

		commands[0].callback?.();
		await flush();
		// Opening the picker must not open a leaf: choosing is what acts.
		expect(workspace.leaves).toHaveLength(0);

		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<Asset>;
		picker.choose(picker.getItems()[0]);
		await flush();

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state).toEqual({
			type: ASSET_DESIGNER_VIEW,
			active: true,
			state: { assetId: asset.id },
		});
	});

	/**
	 * `revealAssetDesigner` answers its own fault rather than rejecting, and the mapping is
	 * `openAssetDesigner`'s own `reportFault` closure — the one line nothing else in this file
	 * drives, since every other case's workspace lookup succeeds. A workspace whose candidate
	 * lookup throws is the same fault case `revealAssetDesigner.test.ts` and
	 * `renovationProjectOpenSeams.test.ts` drive for the bare function and for the sibling
	 * seam; this is the third leg, for the closure this file composes.
	 */
	it('reports a reveal fault as view.asset-designer.reveal-failed', async () => {
		resetRecorder();
		const asset = makeAsset({ name: 'Porcelain Tile' });
		const commands: Command[] = [];
		const exploding = {
			getLeavesOfType: () => {
				throw new Error('workspace exploded');
			},
		};
		const host: PluginCommandHost = {
			app: { workspace: exploding } as never,
			root: {
				logger: recorder,
				persistence: {
					requirementQueries: { listAssets: new ListAssets({ listAll: () => Promise.resolve({ ok: true, value: [{ entity: asset, version: 1 }] }) } as never) },
				},
			} as never,
			addCommand: (command) => commands.push(command),
		};
		registerAssetDesignerCommands(host);

		commands[0].callback?.();
		await flush();
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<Asset>;
		picker.choose(picker.getItems()[0]);
		await flush();

		const logged = lines.find((line) => line.event === 'view.asset-designer.reveal-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('workspace exploded');
	});

	it('says so rather than opening an empty picker when the vault has no assets', async () => {
		const { commands } = await wired({ assets: [] });

		commands[0].callback?.();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(Notice.shown).toEqual([t('en', 'asset.none')]);
	});

	/** Settings that could not be read compose no persistence at all, which is the same answer. */
	it('says so when settings were never recovered', async () => {
		const { commands } = await wired({ withPersistence: false });

		commands[0].callback?.();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		expect(Notice.shown).toEqual([t('en', 'asset.none')]);
	});

	/**
	 * `ListAssets` is a guarded query and answers a `Result` rather than throwing — a real
	 * repository read CAN still refuse, and that refusal is surfaced through the same policy
	 * `applyBackground` uses for its own command failure, never as the developer-English
	 * `message` a thrown cause would carry.
	 */
	it('surfaces a refusal to the user rather than failing silently', async () => {
		const failing = {
			listAll: () =>
				Promise.resolve(
					err({ category: 'Persistence', code: 'vault.io-failed', message: 'disk exploded' } as never),
				),
		};
		const commands: Command[] = [];
		const host: PluginCommandHost = {
			app: { workspace: new FakeWorkspace() } as never,
			root: {
				logger: recorder,
				persistence: { requirementQueries: { listAssets: new ListAssets(failing as never) } },
			} as never,
			addCommand: (command) => commands.push(command),
		};
		registerAssetDesignerCommands(host);

		commands[0].callback?.();
		await flush();

		expect(FuzzySuggestModal.opened).toHaveLength(0);
		// Through `toUserMessage`: an unmapped `Persistence` code falls back to its category
		// sentence, and the raw developer message — vault content, possibly — stays out of it.
		expect(Notice.shown).toEqual(['The vault could not be read or written.']);
	});
});

/**
 * Task B9's binding controller ruling: `revealCandidate`'s in-flight map already keys on the
 * view type PLUS the state, so these are a PIN on that existing property for a second view
 * type rather than a change made here.
 */
describe('two activations racing', () => {
	/**
	 * `AssetSuggestModal`'s `choose` callback `void`s `openAssetDesigner`, exactly as
	 * `open-plan-editor`'s picker does — so two synchronous picks in one tick both start
	 * `revealAssetDesigner` before either has resolved, which is the window `revealCandidate`
	 * coalesces. Two calls with no `await` between them, not `Promise.all`: there is nothing
	 * to await from the CALLER's side, since the picker's callback returns nothing.
	 */
	it('opens one leaf for two activations of the same asset in the same tick', async () => {
		const asset = makeAsset({ name: 'Porcelain Tile' });
		const { commands, workspace } = await wired({ assets: [asset] });

		commands[0].callback?.();
		await flush();
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<Asset>;

		picker.onChooseItem(picker.getItems()[0]);
		picker.onChooseItem(picker.getItems()[0]);
		await flush();

		expect(workspace.leaves).toHaveLength(1);
	});

	/**
	 * The mutation that proves the case above's key is the view type PLUS the state: keying
	 * on the type alone would collapse this multiplicity too, and the same-asset case alone
	 * would pass against that broken key.
	 */
	it('opens two leaves for two different assets', async () => {
		const assetA = makeAsset({ name: 'Porcelain Tile' });
		const assetB = makeAsset({ name: 'Oak Worktop' });
		const { commands, workspace } = await wired({ assets: [assetA, assetB] });

		commands[0].callback?.();
		await flush();
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<Asset>;

		picker.onChooseItem(assetA);
		picker.onChooseItem(assetB);
		await flush();

		expect(workspace.leaves).toHaveLength(2);
	});
});

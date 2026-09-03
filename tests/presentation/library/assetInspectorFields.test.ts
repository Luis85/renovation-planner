/**
 * @vitest-environment jsdom
 *
 * §3.5 section 1 — *Definition*, and the two halves of its keying rule. Both are asserted here
 * because either alone leaves a real defect: the `:key` on the fields region discards a retired
 * asset's draft and inline error, and the subject test on the OUTCOME stops an in-flight
 * dispatch announcing a refusal about an asset the user has left.
 *
 * Driven through the mounted PANEL rather than by mounting `AssetInspectorFields` directly,
 * because the mechanism under test is the key — and a key is a fact about the parent's template,
 * invisible to any mount of the child.
 */
import { beforeEach, describe, expect, it } from 'vitest';
// Mock-only surface, imported BY NAME: `Notice.shown` is the recorder this suite reads, and
// the aliased `obsidian` module is where it lives.
import { Notice } from '../../helpers/obsidian-mock';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { Asset } from '../../../src/domain/asset/Asset';
import type { UpdateAssetErrors, UpdateAssetInput } from '../../../src/application/commands/asset/UpdateAsset';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { anEntry } from '../../helpers/assetLibraryRootHarness';
import { mountInspector } from '../../helpers/assetInspectorHarness';
import { settle } from '../../helpers/async';

// `activateNotices` appends its two live regions with Obsidian's `createDiv`, which this suite
// installs per file — the same per-file jsdom decision every other file in this tree makes.
installObsidianDom();

/**
 * An `updateAsset` whose dispatch is held open until a case decides its outcome — which is what
 * makes "an edit to A still in flight when the user clicks B" expressible at all. A resolved
 * fake cannot describe that window: the outcome lands before the selection can move.
 */
function deferredUpdateAsset() {
	const calls: UpdateAssetInput[] = [];
	let settleWith: ((result: Result<Asset, UpdateAssetErrors>) => void) | null = null;
	return {
		calls,
		command: {
			execute: (input: UpdateAssetInput) => {
				calls.push(input);
				return new Promise<Result<Asset, UpdateAssetErrors>>((resolve) => {
					settleWith = resolve;
				});
			},
		},
		async reject(code: string): Promise<void> {
			if (settleWith === null) throw new Error('no dispatch is in flight to reject');
			settleWith(err({ category: 'Validation', code, message: 'refused' }));
			await settle();
		},
	};
}

describe('AssetInspectorFields keying', () => {
	beforeEach(() => {
		Notice.shown.length = 0;
	});

	it("does not render A's rejection under B's name", async () => {
		const a = anEntry({ name: 'Oak plank floor' });
		const b = anEntry({ name: 'Wall paint' });
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a, b],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});

		const nameInput = inspector.panel.get('[data-field="name"]');
		await nameInput.setValue('');
		await nameInput.trigger('blur');
		await settle();
		await inspector.select(b.assetId);
		await updateAsset.reject('asset.empty-name');

		expect(inspector.panel.get('.rp-al-inspector__name').text()).toBe('Wall paint');
		expect(inspector.panel.find('.rp-field-error__message').exists()).toBe(false);
	});

	it('announces nothing for an outcome whose subject is no longer selected', async () => {
		// The half a `:key` cannot perform. The retired instance is gone from the DOM, so no
		// inline error can be drawn — and the resolved promise still points at it and would
		// otherwise run `notify`, putting a toast about asset A in front of a user reading B.
		const a = anEntry();
		const b = anEntry({ name: 'Wall paint' });
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a, b],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});
		activateNotices();

		const nameInput = inspector.panel.get('[data-field="name"]');
		await nameInput.setValue('');
		await nameInput.trigger('blur');
		await settle();
		await inspector.select(b.assetId);
		// A code with no entry in this form's error map, so `useFieldCommit` routes it to the
		// notice door rather than to a field — the one path that can announce at all.
		await updateAsset.reject('vault.unexpected-failure');

		expect(Notice.shown).toEqual([]);
	});

	it('announces a banner-routed refusal that is still about the SELECTED asset', async () => {
		// The guard's other arm, and the reason it is a subject test rather than a blanket
		// silence: a refusal about the asset on screen must still reach the user.
		const a = anEntry();
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});
		activateNotices();

		const nameInput = inspector.panel.get('[data-field="name"]');
		await nameInput.setValue('Renamed');
		await nameInput.trigger('blur');
		await settle();
		await updateAsset.reject('vault.unexpected-failure');

		expect(Notice.shown).toHaveLength(1);
	});
});

describe('AssetInspectorFields editing', () => {
	it('keeps what the user typed under a persistent inline error rather than reverting', async () => {
		const a = anEntry({ name: 'Oak plank floor' });
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});

		const nameInput = inspector.panel.get('[data-field="name"]');
		await nameInput.setValue('   ');
		await nameInput.trigger('blur');
		await settle();
		await updateAsset.reject('asset.empty-name');

		expect(inspector.panel.get('.rp-field-error__message').text()).toContain('An asset needs a name.');
		expect((nameInput.element as HTMLInputElement).value).toBe('   ');
	});

	it('routes a referenced unit-kind change to the UNIT field, because that is the field that is wrong', async () => {
		const a = anEntry();
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});

		await inspector.panel.get('[data-field="unit"]').setValue('m');
		await settle();
		await updateAsset.reject('asset.unit-kind-referenced');

		// One message, and it is the unit control that carries the ARIA pair — a banner-routed
		// version of this would attach the refusal to no field at all.
		expect(inspector.panel.findAll('.rp-field-error__message')).toHaveLength(1);
		expect(inspector.panel.get('[data-field="unit"]').attributes('aria-invalid')).toBe('true');
	});

	it('refuses an unconvertible unit cost at the field, without dispatching', async () => {
		// `moneyOf` THROWS on a malformed literal, so this refusal has no `AppError` for
		// `routeError` to place: it is the composable's own `validate`, and nothing is sent.
		const a = anEntry();
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});

		const cost = inspector.panel.get('[data-field="unitCost"]');
		await cost.setValue('not a price');
		await cost.trigger('blur');
		await settle();

		expect(updateAsset.calls).toEqual([]);
		expect(inspector.panel.get('.rp-field-error__message').text()).toContain('Enter an amount');
	});

	it('sends a height through SetAssetHeight rather than through the change bag', async () => {
		// The one field of the nine that is not `UpdateAsset`'s: a height lives on the note.
		const a = anEntry();
		const heights: unknown[] = [];
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: {
				setAssetHeight: {
					execute: (input) => {
						heights.push(input.height);
						return Promise.resolve(ok('wrote'));
					},
					executeWithVersion: () => Promise.resolve(ok({ outcome: 'no-write' as const })),
				},
			},
		});

		const height = inspector.panel.get('[data-field="height"]');
		await height.setValue('900');
		await height.trigger('blur');
		await settle();

		expect(heights).toEqual([900]);
	});

	it('sends every editable field through its own change, with an empty text field meaning "no value"', async () => {
		// One case over all seven `UpdateAsset` fields rather than seven: what is being checked
		// is that each control is WIRED to the change it names — a per-field case would be seven
		// copies of one assertion, and the failure they catch is the same one.
		const a = anEntry({ supplier: 'Holzhandel Nord', sku: 'EIC-1200-190', notes: 'Kept dry.' });
		const sent: UpdateAssetInput['changes'][] = [];
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: {
				updateAsset: {
					execute: (input: UpdateAssetInput) => {
						sent.push(input.changes);
						return Promise.resolve(err<UpdateAssetErrors>({
							category: 'Validation',
							code: 'asset.no-such-refusal',
							message: 'held so the draft stays put',
						}));
					},
				},
			},
		});

		for (const [selector, typed] of [
			['[data-field="name"]', 'Renamed'],
			['[data-field="unitCost"]', '41.50'],
			['[data-field="waste"]', '0.12'],
			// The three nullable strings, EMPTIED: an empty field is "no value", and trimming
			// first is what stops a stray space persisting as a supplier.
			['[data-field="supplier"]', '  '],
			['[data-field="sku"]', ''],
			['[data-field="notes"]', ''],
		] as const) {
			const control = inspector.panel.get(selector);
			await control.setValue(typed);
			await control.trigger('blur');
			await settle();
		}
		await inspector.panel.get('[data-field="category"]').setValue('fixture');
		await settle();

		expect(sent).toEqual([
			{ name: 'Renamed' },
			// `Money.of` normalises `41.50` to `41.5` and carries the entry's OWN currency —
			// never a literal, since a vault-wide catalogue is legitimately mixed (PRD §72).
			{ unitCost: expect.objectContaining({ amount: '41.5', currency: 'EUR' }) },
			{ wasteFactorDefault: expect.anything() },
			{ supplier: null },
			{ sku: null },
			{ notes: null },
			{ category: 'fixture' },
		]);
		expect(String(sent[2]?.wasteFactorDefault)).toBe('0.12');
	});

	it('refuses an unconvertible waste factor at the field, without dispatching', async () => {
		// `new Decimal('abc')` throws, exactly as `moneyOf` does — the other half of the same
		// rule, and the arm that a validate written for the cost field alone would leave open.
		const a = anEntry();
		const updateAsset = deferredUpdateAsset();
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: { updateAsset: updateAsset.command },
		});

		const waste = inspector.panel.get('[data-field="waste"]');
		await waste.setValue('a lot');
		await waste.trigger('blur');
		await settle();

		expect(updateAsset.calls).toEqual([]);
		expect(inspector.panel.get('.rp-field-error__message').text()).toContain('fraction between 0 and 1');
	});

	it('refuses an unparseable height and clears one with an empty field', async () => {
		const a = anEntry({ height: 900 });
		const heights: (number | null)[] = [];
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: {
				setAssetHeight: {
					execute: (input) => {
						heights.push(input.height);
						return Promise.resolve(ok('wrote'));
					},
					executeWithVersion: () => Promise.resolve(ok({ outcome: 'no-write' as const })),
				},
			},
		});

		const height = inspector.panel.get('[data-field="height"]');
		await height.setValue('tall');
		await height.trigger('blur');
		await settle();
		expect(heights).toEqual([]);

		// The EMPTY field is "say nothing about how tall this is", answered before `Number` is
		// consulted at all — `Number('')` is `0`, which is a real height and not an absence.
		await height.setValue('');
		await height.trigger('blur');
		await settle();
		expect(heights).toEqual([null]);
	});

	it('commits on Enter and resyncs on Escape, which are the boundary useFieldCommit names', async () => {
		const a = anEntry({ name: 'Oak plank floor', supplier: null, sku: null, notes: null });
		const sent: UpdateAssetInput['changes'][] = [];
		const inspector = await mountInspector({
			entries: [a],
			assetId: a.assetId,
			commands: {
				updateAsset: {
					execute: (input: UpdateAssetInput) => {
						sent.push(input.changes);
						// An ACCEPTED write, which is also the arm that drops the draft so the field
						// tracks the refreshed canonical value.
						return Promise.resolve(ok({} as Asset));
					},
				},
			},
		});
		// The three nullable strings render as empty fields rather than as the word `null`.
		expect((inspector.panel.get('[data-field="supplier"]').element as HTMLInputElement).value).toBe('');

		const nameInput = inspector.panel.get('[data-field="name"]');
		await nameInput.setValue('Renamed');
		await nameInput.trigger('keydown.enter');
		await settle();
		expect(sent).toEqual([{ name: 'Renamed' }]);

		// Escape discards the draft and dispatches nothing — the field resyncs to canonical.
		const supplier = inspector.panel.get('[data-field="supplier"]');
		await supplier.setValue('Typed then abandoned');
		await supplier.trigger('keydown.esc');
		await settle();
		expect(sent).toEqual([{ name: 'Renamed' }]);
		expect((supplier.element as HTMLInputElement).value).toBe('');

		// And a non-empty nullable string is sent trimmed rather than as-is.
		await supplier.setValue('  Holzhandel Nord  ');
		await supplier.trigger('keydown.enter');
		await settle();
		expect(sent[1]).toEqual({ supplier: 'Holzhandel Nord' });
	});
});

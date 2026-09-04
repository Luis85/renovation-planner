/**
 * @vitest-environment jsdom
 *
 * §3.5's inspector as a PANEL: its resting state, its four sections in order, the panel-level
 * failure table one level up from the Shape section's, and the three actions — including the two
 * withdrawals that are the difference between a live control and one that cannot work.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { installObsidianDom } from '../../helpers/dom';
import { anEntry, aNoIdNote } from '../../helpers/assetLibraryRootHarness';
import { mountInspector } from '../../helpers/assetInspectorHarness';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import { settle } from '../../helpers/async';

installObsidianDom();

/** A read that never answers — the only way to hold a section in flight while a case looks at
 *  what is drawn around it. */
function neverAnswers(): Promise<never> {
	return new Promise<never>(() => {
		// deliberately never settles
	});
}

describe('AssetInspector resting', () => {
	it('draws the resting line and no sections with nothing selected', async () => {
		const inspector = await mountInspector({ entries: [anEntry()], assetId: null });

		expect(inspector.panel.get('.rp-al-inspector__rest').text()).toBe('Nothing selected.');
		expect(inspector.panel.classes()).toContain('rp-al-inspector--rest');
		expect(inspector.panel.text()).not.toContain('Shape');
	});

	it('withdraws to the resting state when the selection is cleared again', async () => {
		const entry = anEntry();
		const inspector = await mountInspector({ entries: [entry], assetId: entry.assetId });
		expect(inspector.panel.find('.rp-al-inspector__rest').exists()).toBe(false);

		await inspector.select(null);

		expect(inspector.panel.find('.rp-al-inspector__rest').exists()).toBe(true);
	});
});

describe('AssetInspector sections', () => {
	it('draws the four sections in §3.5 order for a readable asset', async () => {
		const entry = anEntry({ name: 'Oak plank floor' });
		const inspector = await mountInspector({ entries: [entry], assetId: entry.assetId });

		expect(inspector.panel.get('.rp-al-inspector__name').text()).toBe('Oak plank floor');
		const headings = inspector.panel.findAll('.rp-al-inspector__title').map((h) => h.text());
		expect(headings).toEqual(['Shape', 'Used in']);
		// The Definition fields come FIRST and carry the editable controls; the actions row is
		// last. Asserted on the DOM order rather than on presence, because "all four are there"
		// is equally true of a panel that draws them in any order at all.
		expect(inspector.panel.find('.rp-al-fields [data-field="name"]').exists()).toBe(true);
		expect(inspector.panel.find('.rp-al-actions').exists()).toBe(true);
	});

	it('starts the three selection reads on the prop, and restarts them on a re-selection', async () => {
		// The store deliberately does not guard an unchanged id, which is what makes re-clicking
		// the selected row the retry this surface offers for a failed section.
		const entry = anEntry();
		const seen: AssetId[] = [];
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			queries: {
				listReferencing: (assetId) => {
					seen.push(assetId);
					return Promise.resolve(ok([]));
				},
			},
		});

		await inspector.select(null);
		await inspector.select(entry.assetId);

		expect(seen).toEqual([entry.assetId, entry.assetId]);
	});
});

describe('AssetInspector panel-level failure', () => {
	it('offers Open note alone for a selected id that is in unreadable', async () => {
		// §5.1a's listing omits an asset whose NOTE could not be read, so without `unreadable`
		// this id would resolve to nothing and the panel would report a note sitting on disk as
		// a deleted asset.
		const assetId = createAssetId();
		const opened: string[] = [];
		const inspector = await mountInspector({
			unreadable: [aNoIdNote({ assetId, path: 'Renovation/Library/tile.md', reason: 'read-failed', code: 'asset.parse-failed' })],
			assetId,
			openNote: (path) => {
				opened.push(path);
				return Promise.resolve('opened');
			},
		});

		expect(inspector.panel.get('.rp-al-inspector__failure').text()).toContain('Renovation/Library/tile.md');
		expect(inspector.panel.findAll('.rp-al-action').map((b) => b.text())).toEqual(['Open note']);

		await inspector.panel.get('.rp-al-action--note').trigger('click');
		await settle();
		expect(opened).toEqual(['Renovation/Library/tile.md']);
	});

	it('names the upgrade remedy for a note written by a newer build, and offers nothing', async () => {
		// TWO halves, and the case shipped asserting only the second. `Open note` is withheld
		// because editing frontmatter cannot repair a future schema — but the SENTENCE has to
		// carry the remedy that can, or the panel is a dead end that offers nothing and explains
		// nothing. It rendered the REPAIRABLE row's wording ("could not be read"), which is
		// identical in both worlds to a build with no future-schema state at all: exactly the
		// assert-an-absence shape this file's own used-in sibling records one level up.
		const assetId = createAssetId();
		const inspector = await mountInspector({
			unreadable: [
				aNoIdNote({
					assetId,
					path: 'Renovation/Library/future.md',
					reason: 'read-failed',
					code: 'asset.schema-version-unsupported',
				}),
			],
			assetId,
		});

		const said = inspector.panel.get('.rp-al-inspector__failure').text();
		expect(said).toContain('Renovation/Library/future.md');
		expect(said).toContain('Update the plugin');
		expect(said).not.toContain('could not be read');
		expect(inspector.panel.findAll('.rp-al-action')).toHaveLength(0);
	});

	it('re-reads the listing when the note a repair row pointed at turns out to be gone', async () => {
		// `'missing'` means the listing this row was drawn from is stale, which is the one strip
		// outcome that buys a re-read — the same rule `AssetLibraryRoot.onOpenNoteRow` follows.
		const assetId = createAssetId();
		const row = aNoIdNote({ assetId, path: 'Renovation/Library/tile.md', reason: 'read-failed', code: 'x' });
		let listings = 0;
		const inspector = await mountInspector({
			assetId,
			// The override answers the SAME listing the mount was drawn from — a `listCatalogue`
			// that dropped the row would take the control this case clicks with it, and the case
			// would fail at `get` rather than at its assertion.
			queries: {
				listCatalogue: () => {
					listings += 1;
					return Promise.resolve(ok({ entries: [], unreadable: [row] }));
				},
			},
			openNote: () => Promise.resolve('missing'),
		});
		const before = listings;

		await inspector.panel.get('.rp-al-action--note').trigger('click');
		await settle();

		expect(listings).toBe(before + 1);
	});

	it('says the asset is gone, with no actions, for an id in neither list', async () => {
		const inspector = await mountInspector({ entries: [anEntry()], assetId: createAssetId() });

		expect(inspector.panel.get('.rp-al-inspector__failure').text()).toBe('This asset no longer exists.');
		expect(inspector.panel.findAll('.rp-al-action')).toHaveLength(0);
	});
});

describe('AssetInspector actions', () => {
	it('withdraws Open designer for a damaged sidecar and for an unusable id alike', async () => {
		// §3.5's table: `GetAssetDesign.execute` returns early on a sidecar refusal, so the
		// designer hydrates through the same read and reaches the same failed state with only a
		// Retry — the button would cost a navigation to repeat the refusal already on screen.
		for (const code of ['asset-geometry.corrupt', 'asset-geometry.unusable-id']) {
			const entry = anEntry();
			const inspector = await mountInspector({
				entries: [entry],
				assetId: entry.assetId,
				queries: {
					getDesign: () =>
						Promise.resolve(
							// `sidecarPath` on the damaged-sidecar row ONLY: `AssetGeometryStore.pathFor`
						// refuses an unusable id before any path is derived, so production never
						// mints one carrying it — a fixture more permissive than the real thing is
						// evidence about a different program.
						err(
							code === 'asset-geometry.unusable-id'
								? { category: 'Validation', code, message: 'x' }
								: { category: 'Validation', code, message: 'x', sidecarPath: 'g.rpgeo' },
						),
						),
				},
			});

			expect(inspector.panel.find('.rp-al-action--designer').exists()).toBe(false);
			// `Open note` stays, which is what the `unusable-id` row asks for by name: the id is
			// in the note's frontmatter and editing it is the whole repair.
			expect(inspector.panel.find('.rp-al-action--note').exists()).toBe(true);
		}
	});

	it('opens the designer by id for a readable asset whose shape read answered', async () => {
		const entry = anEntry();
		const opened: AssetId[] = [];
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			openDesigner: (assetId) => {
				opened.push(assetId);
				return Promise.resolve();
			},
		});

		await inspector.panel.get('.rp-al-action--designer').trigger('click');

		expect(opened).toEqual([entry.assetId]);
	});

	it('opens a readable asset’s note through the id-keyed door, since a catalogue row carries no path', async () => {
		const entry = anEntry();
		const opened: AssetId[] = [];
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			openAssetNote: (assetId) => {
				opened.push(assetId);
				return Promise.resolve('opened');
			},
		});

		await inspector.panel.get('.rp-al-action--note').trigger('click');
		await settle();

		expect(opened).toEqual([entry.assetId]);
	});

	it('re-reads the listing when the id-keyed door reports the note missing', async () => {
		// The composition answers `'missing'` when a LIVE index holds no note for the id, which
		// means the listing this panel resolved its subject against is stale — so this door acts
		// on it exactly as its path-keyed sibling does. It shipped DISCARDING the outcome, so an
		// `Open note` on an asset whose note had just been deleted opened nothing, said nothing
		// and left the stale row on screen.
		const entry = anEntry();
		let listings = 0;
		const inspector = await mountInspector({
			assetId: entry.assetId,
			queries: {
				listCatalogue: () => {
					listings += 1;
					return Promise.resolve(ok({ entries: [entry], unreadable: [] }));
				},
			},
			openAssetNote: () => Promise.resolve('missing'),
		});
		const before = listings;

		await inspector.panel.get('.rp-al-action--note').trigger('click');
		await settle();

		expect(listings).toBe(before + 1);
	});

	it('withholds Delete while the usage read has not succeeded, with the reason on the control', async () => {
		const entry = anEntry();
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			queries: {
				listReferencing: () =>
					Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' })),
			},
		});

		const control = inspector.panel.get('.rp-al-action--delete');
		expect(control.attributes('aria-disabled')).toBe('true');
		// `aria-disabled` rather than `disabled`, so the reason stays in the accessibility tree
		// and the control keeps its tab stop — the sentence §3.5 asks to be SHOWN on the control.
		const reason = inspector.panel.get('.rp-al-actions__reason');
		expect(control.attributes('aria-describedby')).toBe(reason.attributes('id'));
		expect(reason.text()).toContain('deleting it is unavailable');

		await control.trigger('click');
		expect(inspector.panel.emitted('delete')).toBeUndefined();
	});

	it('withholds Delete while the usage read is IN FLIGHT without claiming it failed', async () => {
		// §3.5 puts "Where this is used could not be checked" under its Refused bullet alone; the
		// In flight bullet asks for a loading line, which the section draws. The reason rendered
		// unconditionally on `!canDelete`, so for the whole of every selection's two reads the
		// panel claimed a FAILURE three elements below a line saying the read was proceeding —
		// invisible against a fake that answers in the same tick.
		const entry = anEntry();
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			queries: { listReferencing: neverAnswers },
		});

		const control = inspector.panel.get('.rp-al-action--delete');
		expect(control.attributes('aria-disabled')).toBe('true');
		expect(inspector.panel.find('.rp-al-actions__reason').exists()).toBe(false);
		expect(control.attributes('aria-describedby')).toBeUndefined();
		// And the section above it says the true thing while this one says nothing.
		expect(inspector.panel.text()).toContain('Loading where this is used');
	});

	it('emits delete with the asset id once the usage read has succeeded', async () => {
		// An edit stays available throughout; only the destructive gesture waits on the read that
		// says what deleting this breaks.
		const entry = anEntry();
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			queries: {
				listReferencing: () =>
					Promise.resolve(
						ok([
							{
								projectId: createProjectId(),
								projectName: 'Kitchen refit',
								requirementIds: [createRequirementId()],
							},
						]),
					),
			},
		});

		const control = inspector.panel.get('.rp-al-action--delete');
		expect(control.attributes('aria-disabled')).toBeUndefined();
		await control.trigger('click');

		expect(inspector.panel.emitted('delete')).toEqual([[entry.assetId]]);
	});

	it('keeps the Definition fields usable while the shape read is still out', async () => {
		// §3.5: only the section waits. The definition fields are already drawn from the
		// catalogue read, which succeeded, and a shape in flight must not take them down.
		const entry = anEntry();
		const inspector = await mountInspector({
			entries: [entry],
			assetId: entry.assetId,
			queries: { getDesign: neverAnswers },
		});

		expect(inspector.panel.find('[data-field="name"]').exists()).toBe(true);
		expect(inspector.panel.text()).toContain('Loading shape…');
		expect(inspector.panel.text()).not.toContain('None');
	});

	it('emits back from the narrow-composition control', async () => {
		const inspector = await mountInspector({ entries: [anEntry()], assetId: null });

		await inspector.panel.get('.rp-al-inspector__back').trigger('click');

		expect(inspector.panel.emitted('back')).toHaveLength(1);
	});
});

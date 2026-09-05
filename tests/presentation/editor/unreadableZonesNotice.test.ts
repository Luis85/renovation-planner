/**
 * @vitest-environment jsdom
 *
 * The canvas's counted warning strip: every zone it could read, drawn, plus a sentence saying
 * how many it could not. Asserted on the RENDERED DOM rather than on `ProjectStore`'s field,
 * because a store field no template reads is a shipped defect rather than a feature.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditor, settle, type EditorHarness } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { t } from '../../../src/presentation/i18n/strings';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { PlanDto } from '../../../src/presentation/read-models/PlanDto';

let harness: EditorHarness | null = null;
afterEach(() => {
	harness?.wrapper.unmount();
	harness = null;
});

/** A vault that holds nothing, so a plan naming a background resolves to `missing`. */
const emptyVault = (): BackgroundVault =>
	({
		getAbstractFileByPath: () => null,
		getResourcePath: (file: { path: string }) => `app://fake/${file.path}`,
		readBinary: () => Promise.resolve(new ArrayBuffer(0)),
	}) as unknown as BackgroundVault;

/**
 * A plan that NAMES a background. Whether it resolves is the vault's business: paired with
 * `emptyVault()` it is a missing background, and the empty-state selector only ever reads
 * whether the field is null.
 */
const planNamingABackground = (): PlanDto => ({
	...FIXTURE_PLAN,
	background: { path: 'Plans/gone.png', kind: 'image' },
});

const notices = (mounted: EditorHarness): readonly string[] =>
	mounted.wrapper.findAll('.rp-warning-strip__item').map((notice) => notice.text());

describe('the canvas reports zones it could not read', () => {
	it('draws a counted notice when some zone notes refused', async () => {
		harness = await mountPlanEditor({ unreadableZones: 3 });
		await settle();

		// R5: `unreadable-zones` is `error` (a read refused), so the item carries that word.
		expect(notices(harness)).toContain(
			`${t('en', 'editor.warning.severity.error')} ${t('en', 'editor.some-zones-unreadable', { count: '3' })}`,
		);
	});

	it('draws no such notice when every zone note was read', async () => {
		harness = await mountPlanEditor({ unreadableZones: 0 });
		await settle();

		expect(notices(harness)).toEqual([]);
	});

	/**
	 * The contradiction the sibling surface was changed to prevent, on the surface this
	 * increment is named for. A plan WITH a background and no readable zones used to draw
	 * `planEditor.noZones` — headline, body and an "Add a room" button (Task 6 reworded it from
	 * "Draw a zone") — over the canvas, beside a strip saying three of its zones could not be
	 * read. Two answers to "why is this canvas empty", and the actionable one is the wrong one.
	 *
	 * The fixture's plan must NAME a background: the selector short-circuits to `noBackground`
	 * for a plan carrying none, so a case without one grades the wrong entry — which is how the
	 * whole class went unnoticed, since every other case here either has zones or lands there.
	 * Whether that background RESOLVES is a different question and not this one's:
	 * `selectPlanEditorEmptyState` reads `plan.background`, never the vault.
	 */
	it('offers no empty state when the zones that would fill it are the ones that refused', async () => {
		harness = await mountPlanEditor({
			plan: planNamingABackground(),
			zones: [],
			unreadableZones: 3,
			vault: emptyVault(),
		});
		await settle();

		expect(harness.wrapper.find('.rp-empty-state').exists()).toBe(false);
		// R5: `unreadable-zones` is `error` (a read refused), so the item carries that word.
		expect(notices(harness)).toContain(
			`${t('en', 'editor.warning.severity.error')} ${t('en', 'editor.some-zones-unreadable', { count: '3' })}`,
		);
	});

	it('still offers the no-zones empty state when nothing refused', async () => {
		harness = await mountPlanEditor({
			plan: planNamingABackground(),
			zones: [],
			unreadableZones: 0,
			vault: emptyVault(),
		});
		await settle();

		// The contrast case, and it is load-bearing: a selector that refused unconditionally
		// would pass the case above and take the editor's one actionable empty state with it.
		expect(harness.wrapper.find('.rp-empty-state').exists()).toBe(true);
	});

	it('draws it INDEPENDENTLY of the background chain', async () => {
		// The regression this asserts: chained into the background v-if/v-else-if, one failure
		// silently swallows the other. This plan has a missing background AND unreadable zones,
		// and BOTH sentences must be on screen. `PlanEditorRoot`'s own comment records what
		// chaining an independent condition cost the staleness notice a slice earlier.
		harness = await mountPlanEditor({
			plan: planNamingABackground(),
			unreadableZones: 1,
			vault: emptyVault(),
		});
		await settle();

		expect(notices(harness)).toEqual([
			`${t('en', 'editor.warning.severity.error')} ${t('en', 'editor.some-zones-unreadable', { count: '1' })}`,
			`${t('en', 'editor.warning.severity.warning')} ${t('en', 'editor.background-missing')}`,
		]);
	});
});

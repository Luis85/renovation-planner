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

const planWithMissingBackground = (): PlanDto => ({
	...FIXTURE_PLAN,
	background: { path: 'Plans/gone.png', kind: 'image' },
});

const notices = (mounted: EditorHarness): readonly string[] =>
	mounted.wrapper.findAll('.rp-editor-notice').map((notice) => notice.text());

describe('the canvas reports zones it could not read', () => {
	it('draws a counted notice when some zone notes refused', async () => {
		harness = await mountPlanEditor({ unreadableZones: 3 });
		await settle();

		expect(notices(harness)).toContain(t('en', 'editor.some-zones-unreadable', { count: '3' }));
	});

	it('draws no such notice when every zone note was read', async () => {
		harness = await mountPlanEditor({ unreadableZones: 0 });
		await settle();

		expect(notices(harness)).toEqual([]);
	});

	it('draws it INDEPENDENTLY of the background chain', async () => {
		// The regression this asserts: chained into the background v-if/v-else-if, one failure
		// silently swallows the other. This plan has a missing background AND unreadable zones,
		// and BOTH sentences must be on screen. `PlanEditorRoot`'s own comment records what
		// chaining an independent condition cost the staleness notice a slice earlier.
		harness = await mountPlanEditor({
			plan: planWithMissingBackground(),
			unreadableZones: 1,
			vault: emptyVault(),
		});
		await settle();

		expect(notices(harness)).toEqual([
			t('en', 'editor.some-zones-unreadable', { count: '1' }),
			t('en', 'editor.background-missing'),
		]);
	});
});

/**
 * @vitest-environment jsdom
 *
 * The small pieces around the editor whose contract is one function: the two pickers'
 * three overrides each, the injection guard, and the PDF adapter's own precondition.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { PlanBackgroundSuggestModal } from '../../../src/presentation/modals/PlanBackgroundSuggestModal';
import { PlanSuggestModal } from '../../../src/presentation/modals/PlanSuggestModal';
import type { ProjectIndexEntry } from '../../../src/application/ports/ProjectIndex';
import { PLAN_EDITOR_CONTEXT, usePlanEditorContext } from '../../../src/presentation/editor/PlanEditorContext';
import { useThemeTokens } from '../../../src/presentation/editor/theme/useThemeTokens';
import { renderPdfPage } from '../../../src/presentation/editor/layers/background/pdfRaster';
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { pdfFixture } from '../../helpers/backgroundFixtures';

installObsidianDom();

function file(path: string): TFile {
	const made = new TFile();
	made.path = path;
	return made;
}

/**
 * Obsidian owns the rendering and the fuzzy matching; a subclass supplies these three, so
 * these three are the whole contract and the only thing worth checking.
 */
describe('the background file picker', () => {
	const files = [file('Plans/ground.png'), file('Plans/first.pdf')];

	it('offers exactly the candidates it was given', () => {
		const picker = new PlanBackgroundSuggestModal({} as never, files, () => undefined);

		expect(picker.getItems()).toEqual(files);
	});

	/**
	 * A COPY, not the caller's array. The modal hands this to Obsidian's own list, and a
	 * shared reference would let a later mutation change what an open picker is showing.
	 */
	it('does not hand out the array it was given', () => {
		const picker = new PlanBackgroundSuggestModal({} as never, files, () => undefined);

		expect(picker.getItems()).not.toBe(files);
	});

	it('labels a row with the full path, since two ground.pdf files is the normal case', () => {
		const picker = new PlanBackgroundSuggestModal({} as never, files, () => undefined);

		expect(picker.getItemText(files[1])).toBe('Plans/first.pdf');
	});

	it('hands the chosen file to its caller and decides nothing itself', () => {
		const chosen: TFile[] = [];
		const picker = new PlanBackgroundSuggestModal({} as never, files, (one) => chosen.push(one));

		picker.onChooseItem(files[0]);

		expect(chosen).toEqual([files[0]]);
	});

	it('names itself from the string table', () => {
		const picker = new PlanBackgroundSuggestModal({} as never, files, () => undefined);

		expect(picker.placeholder).toBe(t('en', 'command.set-plan-background'));
	});
});

/**
 * The plan picker, whose three overrides are the same contract as its sibling's above —
 * and which is what makes the Plan Editor reachable at all, since `open-plan-editor` no
 * longer requires a plan note to be the active file.
 */
describe('the plan picker', () => {
	const plans: ProjectIndexEntry[] = [
		{ id: 'plan-a' as never, type: 'renovation-plan', path: 'Renovation/Plans/Ground floor.md' },
		{ id: 'plan-b' as never, type: 'renovation-plan', path: 'Renovation/Plans/First floor.md' },
	];

	it('offers exactly the plans it was given, and not the array itself', () => {
		const picker = new PlanSuggestModal({} as never, plans, () => undefined);

		expect(picker.getItems()).toEqual(plans);
		// A COPY: Obsidian holds this list while the picker is open, and a shared reference
		// would let a later index change rewrite what the user is looking at.
		expect(picker.getItems()).not.toBe(plans);
	});

	/** The index holds a path, not a name — labelling a row with anything else is a read. */
	it('labels a row with the note path the index holds', () => {
		const picker = new PlanSuggestModal({} as never, plans, () => undefined);

		expect(picker.getItemText(plans[1])).toBe('Renovation/Plans/First floor.md');
	});

	it('hands the chosen plan to its caller and decides nothing itself', () => {
		const chosen: ProjectIndexEntry[] = [];
		const picker = new PlanSuggestModal({} as never, plans, (one) => chosen.push(one));

		picker.onChooseItem(plans[0]);

		expect(chosen).toEqual([plans[0]]);
	});

	it('names itself from the string table', () => {
		const picker = new PlanSuggestModal({} as never, plans, () => undefined);

		expect(picker.placeholder).toBe(t('en', 'command.open-plan-editor'));
	});
});

/**
 * There is no sensible degraded behaviour for a canvas with no plan id and no vault: it
 * would mount, draw nothing, and look exactly like an empty plan. Failing at mount points
 * at the composition mistake instead of hiding it as an empty pane.
 */
describe('the editor context guard', () => {
	it('throws rather than mounting an editor with nothing behind it', () => {
		expect(() => usePlanEditorContext()).toThrow(/EditorContext/);
	});
});

/**
 * The precondition `loadBackground` relies on. A canvas with no 2D context cannot be
 * rendered into, and pdf.js's own failure for that case is several frames deep in its
 * renderer; refusing here keeps the cause next to the requirement.
 */
describe('rendering a pdf page without a canvas context', () => {
	it('refuses rather than handing pdf.js a null context', async () => {
		const bytes = pdfFixture();
		// The suite's canvas backing is deliberately NOT installed in this file, so
		// `getContext('2d')` is jsdom's own — which answers null.
		await expect(renderPdfPage(bytes.buffer as ArrayBuffer, 1)).rejects.toThrow(/2D canvas context/);
	});
});

/**
 * The theme resolver reads against the editor's OWN root element, because a theme may
 * scope its variables to a subtree. That element does not exist until the component is
 * mounted — and Obsidian's `css-change` can fire in between, since the subscription is
 * registered at setup. The document is the fallback for exactly that window.
 */
describe('resolving the theme before the root element exists', () => {
	it('falls back to the document rather than throwing mid-setup', () => {
		document.documentElement.style.setProperty('--color-blue', 'rgb(4, 5, 6)');
		const probe = defineComponent({
			setup() {
				const { tokens, refresh } = useThemeTokens(ref(null));
				refresh();
				return () => h('span', tokens.value.zoneRoom);
			},
		});

		const wrapper = mount(probe, {
			global: {
				provide: {
					[PLAN_EDITOR_CONTEXT as symbol]: {
						planId: 'plan-1',
						queries: {} as never,
						vault: {} as never,
						onThemeChange: () => () => undefined,
						onPlanChanged: () => () => undefined,
					},
				},
			},
		});

		expect(wrapper.text()).toBe('rgb(4, 5, 6)');
		wrapper.unmount();
		document.documentElement.style.removeProperty('--color-blue');
	});
});

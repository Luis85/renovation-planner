/**
 * `ObsidianBackgroundPicker` (Task B7) — the `BackgroundPicker` port bound to Obsidian's own
 * file suggester, the one door `AssetDesignerRoot.vue`'s empty-state action reaches it through.
 *
 * Mock-only surface, imported BY NAME — the vitest alias points the `'obsidian'` specifier at
 * this same file, so `FuzzySuggestModal.opened` is the modal this picker actually constructed,
 * the same pattern `planEditorCommands.test.ts` drives `PlanBackgroundSuggestModal` through.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TFile, type App } from 'obsidian';
import { FuzzySuggestModal } from '../helpers/obsidian-mock';
import { ObsidianBackgroundPicker } from '../../src/plugin/assetBackgroundPicker';
import { t } from '../../src/presentation/i18n/strings';

function file(path: string): TFile {
	const made = new TFile();
	made.path = path;
	made.extension = path.split('.').at(-1) ?? '';
	return made;
}

function appWith(paths: string[]): App {
	return { vault: { getFiles: () => paths.map((path) => file(path)) } } as never;
}

function placeholderOf(modal: FuzzySuggestModal<unknown>): string {
	return (modal as unknown as { placeholder: string }).placeholder;
}

beforeEach(() => {
	FuzzySuggestModal.opened.length = 0;
});

describe('ObsidianBackgroundPicker', () => {
	it('offers only the files a background can be, not the whole vault', () => {
		const app = appWith(['Specs/oven.pdf', 'Notes/readme.md', 'Specs/oven.png']);

		void new ObsidianBackgroundPicker(app).pick();

		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		expect(modal.getItems().map((f) => f.path)).toEqual(['Specs/oven.pdf', 'Specs/oven.png']);
	});

	it('labels a row with the note path, not the basename', () => {
		const app = appWith(['Specs/oven.pdf']);

		void new ObsidianBackgroundPicker(app).pick();

		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		expect(modal.getItemText(modal.getItems()[0])).toBe('Specs/oven.pdf');
	});

	it('names itself from the string table', () => {
		void new ObsidianBackgroundPicker(appWith([])).pick();

		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<unknown>;
		expect(placeholderOf(modal)).toBe(t('en', 'designer.background.pick'));
	});

	it('resolves a PDF pick with page 1, and an image pick with no page', async () => {
		const app = appWith(['Specs/oven.pdf', 'Specs/panel.png']);

		const pdfPick = new ObsidianBackgroundPicker(app).pick();
		const pdfModal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		pdfModal.choose(pdfModal.getItems()[0]);
		await expect(pdfPick).resolves.toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });

		FuzzySuggestModal.opened.length = 0;
		const imagePick = new ObsidianBackgroundPicker(app).pick();
		const imageModal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;
		imageModal.choose(imageModal.getItems()[1]);
		await expect(imagePick).resolves.toEqual({ path: 'Specs/panel.png', kind: 'image', page: null });
	});

	it('resolves null when the modal closes with nothing chosen', async () => {
		const app = appWith(['Specs/oven.pdf']);
		const pick = new ObsidianBackgroundPicker(app).pick();
		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;

		modal.close();

		await expect(pick).resolves.toBeNull();
	});

	/**
	 * `obsidian.d.ts` states no ordering between a close and the choice it carries, and
	 * `SuggestModal.selectSuggestion` is widely believed to close FIRST. A picker that reads
	 * "nothing chosen" synchronously off `onClose` would resolve `null` under this ordering,
	 * and the real file arriving a statement later would find the promise already settled and
	 * be silently dropped. Both orderings are driven, per this repository's own rule that a
	 * fake modelling only the convenient ordering hides exactly this defect —
	 * `tests/helpers/obsidian-mock.ts`'s own `chooseAfterClose` exists for it.
	 */
	it('resolves the real pick even when the modal closes before delivering it', async () => {
		const app = appWith(['Specs/oven.pdf']);
		const pick = new ObsidianBackgroundPicker(app).pick();
		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;

		modal.chooseAfterClose(modal.getItems()[0]);

		await expect(pick).resolves.toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	});

	/**
	 * `getItems` already narrows to supported kinds, so `onChooseItem` never legitimately
	 * receives one `backgroundKindFor` refuses — but nothing STOPS it, and the door answers
	 * `null` rather than asserting, which is the honest thing to do about what it can prove.
	 */
	it('resolves null rather than asserting, for a choice outside what it offered', async () => {
		const app = appWith(['Specs/oven.pdf']);
		const pick = new ObsidianBackgroundPicker(app).pick();
		const modal = FuzzySuggestModal.opened[0] as FuzzySuggestModal<TFile>;

		modal.choose(file('Notes/readme.md'));

		await expect(pick).resolves.toBeNull();
	});
});

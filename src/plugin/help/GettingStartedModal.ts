import { Modal, Platform, type App } from 'obsidian';
import type { StringKey } from '../../presentation/i18n/locales/en';
import { currentLanguage, t, tr } from '../../presentation/i18n/strings';
import type { PluginCommandHost } from '../commandHost';

/**
 * The getting-started guide (owner rulings 47 and 49): seven steps and a line saying how to get
 * back here, in a plugin `Modal` — plain DOM, for the reason `DiagnosticsReportModal` gives: a
 * palette command has no view whose Vue app it could mount in. No close button of its own, as
 * there: Obsidian's X and Esc are the close.
 */

const STEPS = [
	'help.guide.step-1',
	'help.guide.step-2',
	'help.guide.step-3',
	'help.guide.step-4',
	'help.guide.step-5',
	'help.guide.step-6',
	'help.guide.step-7',
] as const satisfies readonly StringKey[];

/**
 * Every control the guide quotes, by the key that control renders its own label from. The guide
 * never spells a label itself: a renamed button renames its mention here, which is how ruling 50's
 * German door rename reached step 5 with no edit to the step. Exported for its test, which pins
 * this map key by key: two keys sharing a value today would resolve identically either way.
 */
export const GUIDE_CONTROLS = {
	openProject: 'command.open-project',
	createProject: 'empty.project.no-projects.action',
	newProject: 'view.project.create',
	createFirstPlan: 'view.project.entry-plan-create',
	newPlan: 'view.project.create-plan',
	addRooms: 'editor.reference.rooms',
	add: 'editor.primary.add',
	room: 'editor.add.room.label',
	createRoom: 'editor.room.create',
	upload: 'editor.reference.upload',
	newAsset: 'view.asset.create',
	library: 'view.asset-library.door',
	asset: 'editor.add.asset.label',
	sample: 'command.create-sample-project',
	diagnostics: 'command.show-diagnostics-report',
	openHelp: 'command.open-help',
} as const satisfies Record<string, StringKey>;

/** The guide as a reader sees it, every hole filled. Takes the language so a test can ask for any. */
export function gettingStartedGuide(language: string): { title: string; steps: readonly string[]; reopen: string } {
	const labels = Object.fromEntries(Object.entries(GUIDE_CONTROLS).map(([hole, key]) => [hole, t(language, key)]));
	return {
		title: t(language, 'help.guide.title'),
		steps: STEPS.map((key) => t(language, key, labels)),
		reopen: t(language, 'help.guide.reopen', labels),
	};
}

export class GettingStartedModal extends Modal {
	override onOpen(): void {
		const guide = gettingStartedGuide(currentLanguage());
		this.titleEl.setText(guide.title);
		const list = this.contentEl.createEl('ol');
		for (const step of guide.steps) list.createEl('li', { text: step });
		this.contentEl.createEl('p', { text: guide.reopen });
		// Every step names a control that writes, and mobile is read-only — so there, say so.
		if (Platform.isMobile) this.contentEl.createEl('p', { text: tr('view.mobile.read-only') });
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

/** The one way the guide opens; every input calls this. */
function openGettingStarted(app: App): void {
	new GettingStartedModal(app).open();
}

/**
 * A plain `callback`, never a `checkCallback`: the guide reads the same on every device and in a
 * session whose settings could not be read. The id is DATA — a user's hotkey binds to it.
 */
export function registerHelpCommand(host: PluginCommandHost): void {
	host.addCommand({
		id: 'open-help',
		name: tr('command.open-help'),
		callback: () => {
			openGettingStarted(host.app);
		},
	});
}

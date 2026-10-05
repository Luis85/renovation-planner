/**
 * @vitest-environment jsdom
 *
 * The getting-started guide (owner rulings 47 and 49), its command and its modal.
 *
 * **The resolved-text case is the only sentence-case check these strings get.** The stored
 * templates quote every control through a `{hole}`, and `obsidianmd/ui/sentence-case-locale-module`
 * skips any string containing one (measured in `s21-guide-draft.md` §4) — so the build reads
 * none of them. What holds them instead is this: every string rendered with its holes filled
 * from the controls' own keys, compared against the approved §1 text in full.
 *
 * German step 5 names „Objekt-Bibliothek“, not §1's „Objekte“: ruling 50 renamed the door the
 * hole is filled from, and following a renamed control is what the hole is for.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal, Platform, setLanguage } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import { loadedPlugin, type LoadedPlugin } from '../../helpers/plugin';
import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
import { GUIDE_CONTROLS, GettingStartedModal, gettingStartedGuide } from '../../../src/plugin/help/GettingStartedModal';
import { t } from '../../../src/presentation/i18n/strings';

installObsidianDom();

const APPROVED = {
	en: {
		title: 'Getting started',
		steps: [
			'Run “Open renovation project” from the command palette or its ribbon icon. Choose “Create a project”, or “New project” once one exists, and give it a name.',
			'Open the project and choose “Create first plan”, or “New plan” below the plan list. Select a plan in the list to open it in the plan editor.',
			'On an empty plan, choose “Add rooms”; later, choose “Add” and then “Room”. Drag on the floor to size the room or type its width and depth, name it, and choose “Create room”.',
			'To draw over an existing floor plan, first put its PNG, JPEG or PDF file in your vault. Choose “Upload a floor plan”, enter the file’s path in the vault, then set the scale so areas come out in real units.',
			'Choose “New asset” or “Asset library” below the project list to build your catalogue. In the plan editor, choose “Add” and then “Asset” to place one on the plan.',
			'To look around first, run “Create sample renovation project” from the command palette. It creates a fictional project with one plan and five rooms and areas, and opens that plan.',
			'If something could not be read, run “Show diagnostics report” from the command palette or open it from this plugin’s settings. It shows which notes refused to load in this session.',
		],
		reopen: 'Open this guide again at any time with “Open getting-started help” in the command palette.',
	},
	de: {
		title: 'Einstiegshilfe',
		steps: [
			'Führen Sie „Renovierungsprojekt öffnen“ über die Befehlspalette oder das Symbol in der Werkzeugleiste aus. Wählen Sie „Projekt erstellen“ – oder „Neues Projekt“, sobald es ein Projekt gibt – und geben Sie einen Namen ein.',
			'Öffnen Sie das Projekt und wählen Sie „Ersten Plan anlegen“ oder unter der Planliste „Neuer Plan“. Wählen Sie einen Plan in der Liste aus, um ihn im Grundriss-Editor zu öffnen.',
			'Wählen Sie auf einem leeren Grundriss „Räume hinzufügen“, später „Hinzufügen“ und dann „Raum“. Ziehen Sie auf dem Grundriss, um den Raum zu bemessen, oder geben Sie Breite und Tiefe ein, benennen Sie ihn und wählen Sie „Raum erstellen“.',
			'Um über einer vorhandenen Zeichnung zu arbeiten, legen Sie zuerst die PNG-, JPEG- oder PDF-Datei in Ihren Vault. Wählen Sie „Grundriss hochladen“, geben Sie den Pfad der Datei im Vault ein und legen Sie dann den Maßstab fest, damit Flächen in echten Einheiten herauskommen.',
			'Wählen Sie unter der Projektliste „Neues Objekt“ oder „Objekt-Bibliothek“, um Ihren Katalog aufzubauen. Im Grundriss-Editor platzieren Sie ein Objekt mit „Hinzufügen“ und dann „Bibliotheksobjekt“.',
			'Um sich zuerst umzusehen, führen Sie „Beispielprojekt anlegen“ in der Befehlspalette aus. Damit entsteht ein fiktives Projekt mit einem Plan und fünf Räumen und Flächen, und der Plan wird geöffnet.',
			'Wenn sich etwas nicht lesen lässt, führen Sie „Diagnosebericht anzeigen“ in der Befehlspalette aus oder öffnen Sie den Bericht in den Einstellungen dieses Plugins. Er zeigt, welche Notizen in dieser Sitzung das Laden verweigert haben.',
		],
		reopen: 'Sie können diese Hilfe jederzeit wieder mit „Einstiegshilfe öffnen“ in der Befehlspalette öffnen.',
	},
} as const;

describe('the getting-started guide text', () => {
	it.each(['en', 'de'] as const)('resolves every %s string to the approved text', (language) => {
		expect(gettingStartedGuide(language)).toEqual(APPROVED[language]);
	});

	/**
	 * WHICH key fills each hole, pinned as the §2 map itself. The resolved text cannot tell: the
	 * library door and the library title share a value, and so do `editor.primary.add` and
	 * `editor.add.menu` — a hole pointed at the wrong one of a pair reads identically today and
	 * drifts the day the two are moved apart.
	 */
	it('fills each hole from the control §2 names', () => {
		expect(GUIDE_CONTROLS).toEqual({
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
		});
	});

	it('names the command as approved', () => {
		expect([t('en', 'command.open-help'), t('de', 'command.open-help')]).toEqual([
			'Open getting-started help',
			'Einstiegshilfe öffnen',
		]);
	});
});

const drawn = (modal: Modal): { title: string; steps: string[]; paragraphs: string[] } => ({
	title: modal.titleEl.textContent ?? '',
	steps: [...modal.contentEl.querySelectorAll('ol > li')].map((item) => item.textContent ?? ''),
	paragraphs: [...modal.contentEl.querySelectorAll(':scope > p')].map((line) => line.textContent ?? ''),
});

describe('the open-help command', () => {
	let plugin: LoadedPlugin;

	beforeEach(async () => {
		Modal.opened.length = 0;
		({ plugin } = await loadedPlugin(DEFAULT_SETTINGS));
	});

	// Both are mutable across this file's cases, so each case that sets one is reset here.
	afterEach(() => {
		Platform.isMobile = false;
		setLanguage('en');
	});

	const openHelp = (): Modal => {
		const command = plugin.commands.find((candidate) => candidate.id === 'open-help');
		expect(command?.name).toBe(t('en', 'command.open-help'));
		command?.callback?.();
		expect(Modal.opened).toHaveLength(1);
		const modal = Modal.opened[0];
		expect(modal).toBeInstanceOf(GettingStartedModal);
		return modal;
	};

	it('opens the guide: a title, seven steps and the reopen line', () => {
		expect(drawn(openHelp())).toEqual({
			title: APPROVED.en.title,
			steps: APPROVED.en.steps,
			paragraphs: [APPROVED.en.reopen],
		});
	});

	it('draws in the app language', () => {
		setLanguage('de');
		expect(drawn(openHelp())).toEqual({
			title: APPROVED.de.title,
			steps: APPROVED.de.steps,
			paragraphs: [APPROVED.de.reopen],
		});
	});

	it('adds the read-only line on mobile, and only there', () => {
		Platform.isMobile = true;
		expect(drawn(openHelp()).paragraphs).toEqual([APPROVED.en.reopen, t('en', 'view.mobile.read-only')]);
	});

	it('leaves nothing behind when closed', () => {
		const modal = openHelp();
		modal.close();
		expect(modal.contentEl.childElementCount).toBe(0);
	});
});

/**
 * @vitest-environment jsdom
 *
 * Two doors into the diagnostics report, one function behind them — this repository's
 * one-action-every-input rule, checked rather than asserted. A second entry point with its own
 * composition looks correct alone and drifts the moment either is edited.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
// From the MOCK module by path, not from `'obsidian'`. `tests/**` is type-checked against the
// real package — vitest's alias is a runtime resolution the compiler cannot see — so `Modal`
// imported the ordinary way carries the real type and its `opened` recorder does not exist on
// it. Same class object at runtime either way, since that alias is what production resolves to.
import { Modal } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import { loadedPlugin, type LoadedPlugin } from '../../helpers/plugin';
import type { SettingsTab } from '../../../src/plugin/settings/SettingsTab';
import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
import { tr } from '../../../src/presentation/i18n/strings';
import { DiagnosticsReportModal } from '../../../src/plugin/diagnostics/DiagnosticsReportModal';
import { showDiagnosticsReport } from '../../../src/plugin/diagnostics/showDiagnosticsReport';
import { NO_WRITE_INCIDENTS } from '../../../src/application/incidents/WriteIncidentRegistry';
import { recorder } from '../../helpers/logger';
import { PLAN_EDITOR_VIEW, type PlanEditorDeps } from '../../../src/presentation/views/PlanEditorView';
import { FakeLeaf } from '../../helpers/workspace';
import type { PluginCommandHost } from '../../../src/plugin/commandHost';
import type { DiagnosticsSnapshot } from '../../../src/application/queries/GetDiagnosticsSnapshot';

vi.mock('../../../src/infrastructure/logging/consoleLogger', async () =>
	(await import('../../helpers/logger')).consoleLoggerMock(),
);

installObsidianDom();

let plugin: LoadedPlugin;

beforeEach(async () => {
	Modal.opened.length = 0;
	({ plugin } = await loadedPlugin(DEFAULT_SETTINGS));
});

/**
 * The tab is recorded by the mock plugin as an opaque object, so it is read back through the
 * REAL class's type — which is what makes `row.action` a checked member rather than an `any`.
 */
const definitions = (): ReturnType<SettingsTab['getSettingDefinitions']> =>
	(plugin.settingTabs[0] as unknown as SettingsTab).getSettingDefinitions();

const diagnosticsRow = (): ReturnType<SettingsTab['getSettingDefinitions']>[number] | undefined =>
	definitions().find((row) => row.name === tr('settings.diagnostics.name'));

describe('the diagnostics report has three doors', () => {
	it('is registered as a command', () => {
		expect(plugin.commands.map((command) => command.id)).toContain('show-diagnostics-report');
	});

	it('is offered as a settings action row', () => {
		// Discriminated by NAME, never by `row.action !== undefined`. The library-move row is an
		// action row too and this one sits after it, so a bare `.find((r) => r.action)` selects
		// the library move — leaving this case red against a CORRECT implementation, and
		// starting a catalogue migration inside a test.
		expect(diagnosticsRow()?.action).toBeDefined();
	});

	/**
	 * Both doors OPEN one, which is the property that matters and the one a spy on the module
	 * export could not settle: a spy that binds to nothing reports `not.toHaveBeenCalled()` for
	 * every build ever written. `Modal.opened` is the fake's own record, so a door that composed
	 * its own modal separately would still be counted here — and that is the point, because the
	 * drift this rule guards against is two compositions, not two call sites.
	 */
	/**
	 * The THIRD door is the Plan Editor's `unreadable-zones` warning row, whose message has
	 * told the user to open this report since it was written. `presentation/` may not import
	 * `plugin/`, so what the row presses is a callback the composition root injects — and the
	 * property under test is that it lands on the SAME public method rather than on a second
	 * `showDiagnosticsReport` composition of its own, which is exactly what `Modal.opened`
	 * counts. Reached through the registered view factory, so this is the wiring a user gets;
	 * no case asserts the member merely EXISTS, because `PlanEditorDeps` requires it and the
	 * compiler already refuses a bundle without one.
	 */
	it('all three doors open the report', async () => {
		plugin.commands.find((command) => command.id === 'show-diagnostics-report')?.callback?.();
		await Promise.resolve();
		await Promise.resolve();
		// `action` receives the row's index within its group, per `SettingDefinitionAction`. The
		// value is unused by this row and passed anyway, because calling it with none would be
		// an input Obsidian never sends.
		diagnosticsRow()?.action?.(0);
		await Promise.resolve();
		await Promise.resolve();
		const built = plugin.views.get(PLAN_EDITOR_VIEW)?.(new FakeLeaf() as never);
		(built as unknown as { deps: PlanEditorDeps }).deps.openDiagnosticsReport();
		await Promise.resolve();
		await Promise.resolve();

		expect(Modal.opened).toHaveLength(3);
		expect(Modal.opened.every((modal) => modal instanceof DiagnosticsReportModal)).toBe(true);
	});
});

/**
 * The two CLOSURES the function composes, driven directly. Neither is reachable through a door
 * in this suite: `resolvePath` runs once per issue row and a freshly loaded plugin's ledger is
 * empty, and `writeToClipboard` runs on a click. A structural host is honest here — this
 * function's whole job is assembling those two from the root, so a fake root is exactly the
 * input under test.
 */
describe('what showDiagnosticsReport hands the modal', () => {
	const ISSUE = { entityType: 'zone', entityId: 'zone-01JAAA', issue: 'zone.frontmatter-invalid' };
	const SINK = 'Renovation/Kitchen/Zones/Sink.md';

	const hostWith = (written: string[]): PluginCommandHost => {
		Object.defineProperty(globalThis.navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: (text: string) => {
					written.push(text);
					return Promise.resolve();
				},
			},
		});
		return {
			app: {},
			root: {
				logger: recorder,
				persistence: {
					index: { getPath: (id: string) => (id === ISSUE.entityId ? SINK : undefined) },
					queries: {
						diagnostics: {
							// Annotated as `Promise<DiagnosticsSnapshot>` -- narrower than the outer
							// `as unknown as PluginCommandHost` cast below, which cannot see a missing
							// field here. That cast is why the compiler did not say so when ADR-0034 added
							// `writeIncidents` as required: this literal reached the real renderer, which
							// read `.open` off `undefined` and threw -- a fake thinner than the real thing,
							// caught by the suite rather than by the type it was cast to. Typing the
							// literal itself, rather than trusting the cast around it, is what makes the
							// NEXT required field a build error here too.
							execute: (): Promise<DiagnosticsSnapshot> =>
								Promise.resolve({
									pluginVersion: '0.1.0',
									obsidianVersion: '1.13.0',
									schemaVersions: { zone: 1 },
									migrationState: { pending: [], lastApplied: null },
									validationIssues: [ISSUE],
									writeIncidents: NO_WRITE_INCIDENTS,
								}),
						},
					},
				},
			},
		} as unknown as PluginCommandHost;
	};

	it('resolves an issue id to its note path through the project index', async () => {
		await showDiagnosticsReport(hostWith([]));

		expect(Modal.opened[0]?.contentEl.textContent).toContain(SINK);
	});

	it('copies the content-free payload, without the path the row shows', async () => {
		const written: string[] = [];
		await showDiagnosticsReport(hostWith(written));

		Modal.opened[0]?.contentEl
			.querySelector<HTMLButtonElement>('.rp-diagnostics__copy')
			?.click();
		await Promise.resolve();

		expect(written[0]).toContain(ISSUE.entityId);
		expect(written[0]).not.toContain(SINK);
	});
});

describe('the diagnostics report in a session whose settings could not be read', () => {
	beforeEach(async () => {
		Modal.opened.length = 0;
		({ plugin } = await loadedPlugin(null, new Error('unreadable data.json'), true));
	});

	/**
	 * There is no snapshot to show: `GetDiagnosticsSnapshotQuery` is composed inside
	 * `persistence`, which is `null` exactly when settings are. An EMPTY report is the wrong
	 * answer rather than a lesser one — it would say "No notes have refused to load in this
	 * session" about a session that never attempted a read.
	 */
	it('opens nothing rather than an empty report', () => {
		plugin.commands.find((command) => command.id === 'show-diagnostics-report')?.callback?.();

		expect(Modal.opened).toHaveLength(0);
	});

	/**
	 * And the settings tab offers no row there either — not by a decision taken here, but
	 * because that branch returns one text-only definition and stops. Pinned so that widening
	 * it later is a deliberate change rather than one that quietly offers a report which
	 * cannot be produced.
	 */
	it('offers no settings row there', () => {
		expect(diagnosticsRow()).toBeUndefined();
	});
});

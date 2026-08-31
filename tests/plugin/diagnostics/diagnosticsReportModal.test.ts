/**
 * @vitest-environment jsdom
 *
 * The surface `GetDiagnosticsSnapshotQuery` never had. `renderDiagnosticsReport` and
 * `diagnosticsReportText` are exported separately from the `Modal` precisely so both can be
 * driven without constructing one.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { lines, recorder } from '../../helpers/logger';
import {
	DiagnosticsReportModal,
	diagnosticsReportText,
	renderDiagnosticsReport,
} from '../../../src/plugin/diagnostics/DiagnosticsReportModal';
import type { DiagnosticsSnapshot } from '../../../src/application/queries/GetDiagnosticsSnapshot';
import { t } from '../../../src/presentation/i18n/strings';

installObsidianDom();

const SNAPSHOT: DiagnosticsSnapshot = {
	pluginVersion: '0.1.0',
	obsidianVersion: '1.13.0',
	schemaVersions: { zone: 1 },
	migrationState: { pending: [], lastApplied: null },
	validationIssues: [
		{ entityType: 'zone', entityId: 'zone-01JAAA', issue: 'zone.frontmatter-invalid' },
	],
};

const SINK = 'Renovation/Kitchen/Zones/Sink.md';

const render = (
	snapshot: DiagnosticsSnapshot,
	resolvePath: (id: string) => string | undefined,
): HTMLElement => {
	const into = document.createElement('div');
	renderDiagnosticsReport(into, {
		snapshot,
		resolvePath,
		writeToClipboard: () => Promise.resolve(),
		logger: recorder,
	});
	return into;
};

describe('the diagnostics report', () => {
	it('shows the note path for an issue, so the user can find the broken note', () => {
		const into = render(SNAPSHOT, (id) => (id === 'zone-01JAAA' ? SINK : undefined));

		expect(into.textContent).toContain(SINK);
		expect(into.textContent).toContain('zone-01JAAA');
	});

	it('renders the schema versions and pending migrations it promises', () => {
		// Promised by `settings.diagnostics.desc` AND by this increment's Definition of Done,
		// and absent from this renderer's first draft while present in the copied payload.
		// Asserted on the DOM so that omission cannot pass again.
		const into = render(
			{ ...SNAPSHOT, migrationState: { pending: ['zone@2'], lastApplied: 'plan@2' } },
			() => undefined,
		);

		expect(into.textContent).toContain('zone 1');
		expect(into.textContent).toContain('zone@2');
		expect(into.textContent).toContain('plan@2');
	});

	it('renders an issue whose path the index does not know', () => {
		const into = render(SNAPSHOT, () => undefined);

		expect(into.textContent).toContain('zone-01JAAA');
		expect(into.querySelector('.rp-diagnostics__path')).toBeNull();
	});

	it('says so when nothing refused, rather than drawing an empty list', () => {
		const into = render({ ...SNAPSHOT, validationIssues: [] }, () => undefined);

		expect(into.querySelector('.rp-diagnostics__empty')).not.toBeNull();
		expect(into.querySelector('.rp-diagnostics__issues')).toBeNull();
	});

	it('EXCLUDES the path from the copied text, which the rendered row shows', () => {
		// The asymmetry this increment is built on. The ledger is provably content-free
		// (`diagnostics.test-d.ts`), the VIEW joins a path so the user can act, and the exported
		// text stays content-free because exporting is what SDD §86 governs. Both halves in one
		// case: either alone passes a build that got it backwards.
		const shown = render(SNAPSHOT, () => SINK).textContent ?? '';
		const copied = diagnosticsReportText(SNAPSHOT);

		expect(shown).toContain(SINK);
		expect(copied).toContain('zone-01JAAA');
		expect(copied).not.toContain(SINK);
		expect(copied).not.toContain('.md');
	});
});

describe('copying the report', () => {
	beforeEach(() => {
		lines.length = 0;
	});

	it('writes the content-free payload to the clipboard', async () => {
		let written: string | null = null;
		const into = document.createElement('div');
		renderDiagnosticsReport(into, {
			snapshot: SNAPSHOT,
			resolvePath: () => SINK,
			writeToClipboard: (text) => {
				written = text;
				return Promise.resolve();
			},
			logger: recorder,
		});

		into.querySelector<HTMLButtonElement>('.rp-diagnostics__copy')?.click();
		await Promise.resolve();

		// The payload, not merely "something was written": the row on screen carries the path
		// and this must not, which is the same asymmetry asserted from the button rather than
		// from the function.
		expect(written).toBe(diagnosticsReportText(SNAPSHOT));
		expect(written).not.toContain(SINK);
	});

	/**
	 * A rejected clipboard write reaches the user AND the log. `runDetached` rather than a bare
	 * `void`, which would discard the rejection — the spelling `runDetached`'s own docblock
	 * exists to refuse, and the one this handler's first draft used under a comment claiming the
	 * opposite. Clipboard permission really can be unavailable.
	 */
	it('reports a clipboard write that rejects, rather than discarding it', async () => {
		const into = document.createElement('div');
		renderDiagnosticsReport(into, {
			snapshot: SNAPSHOT,
			resolvePath: () => undefined,
			writeToClipboard: () => Promise.reject(new Error('no clipboard permission')),
			logger: recorder,
		});

		into.querySelector<HTMLButtonElement>('.rp-diagnostics__copy')?.click();
		await Promise.resolve();
		await Promise.resolve();

		expect(lines.map((line) => line.event)).toContain('diagnostics.copy.failed');
	});

	/**
	 * A clipboard that throws SYNCHRONOUSLY rather than rejecting, which is what an absent or
	 * blocked API actually does: the composed writer is `navigator.clipboard.writeText(text)`,
	 * and that property access is a `TypeError` where the API is missing.
	 *
	 * `runDetached` takes a promise, so its argument is evaluated before it is entered — a bare
	 * `runDetached(deps.writeToClipboard(...).then(...), …)` lets this throw escape the click
	 * handler entirely: no notice, no log, a dead button, past the very function that exists to
	 * prevent it. Only the rejecting sibling above was handled until this case existed.
	 */
	it('reports a clipboard that throws rather than rejecting', async () => {
		const into = document.createElement('div');
		renderDiagnosticsReport(into, {
			snapshot: SNAPSHOT,
			resolvePath: () => undefined,
			writeToClipboard: () => {
				throw new TypeError("Cannot read properties of undefined (reading 'writeText')");
			},
			logger: recorder,
		});

		expect(() => {
			into.querySelector<HTMLButtonElement>('.rp-diagnostics__copy')?.click();
		}).not.toThrow();
		await Promise.resolve();
		await Promise.resolve();

		expect(lines.map((line) => line.event)).toContain('diagnostics.copy.failed');
	});
});

describe('the modal around it', () => {
	it('titles itself and draws the report on open, and empties on close', () => {
		const modal = new DiagnosticsReportModal({} as never, {
			snapshot: SNAPSHOT,
			resolvePath: () => SINK,
			writeToClipboard: () => Promise.resolve(),
			logger: recorder,
		});

		modal.open();

		expect(modal.titleEl.textContent).toBe(t('en', 'diagnostics.title'));
		expect(modal.contentEl.querySelector('.rp-diagnostics')).not.toBeNull();

		modal.close();

		// Obsidian REUSES a modal instance, so content left behind would be drawn twice on the
		// next open — the same reason `DialogHost` releases its `inert` on unmount.
		expect(modal.contentEl.childElementCount).toBe(0);
	});
});

import { Modal, type App } from 'obsidian';
import type { DiagnosticsSnapshot } from '../../application/queries/GetDiagnosticsSnapshot';
import { UNREADABLE_WRITE_INCIDENT_CODE } from '../../application/incidents/WriteIncident';
import type { Logger } from '../../application/ports/Logger';
import type { StringKey } from '../../presentation/i18n/locales/en';
import { tr } from '../../presentation/i18n/strings';
import { notifySuccess } from '../../presentation/notices/notify';
import { runDetached } from '../runDetached';

/**
 * The surface `GetDiagnosticsSnapshotQuery` never had. It was built, guarded, composed and
 * tested in slice 11 and consumed by nobody, while the design that skips unreadable notes rests
 * on "the per-entity detail lives in the diagnostics report" — a fallback to nothing until this
 * file existed. Three sentences added by this increment now tell the user to open it.
 *
 * **Plain DOM, deliberately.** Slice 15's `DialogHost` is scoped to an ItemView's Vue app, and a
 * palette command has no such host when no view is open — so mounting this in Vue would mean a
 * third Vue app, the plugin-global one SDD §12 would need an exception for and slice 13
 * deliberately never built. `createDiv`/`createEl` is what the notice live regions and the
 * settings pane already use.
 */

export interface DiagnosticsReportDeps {
	readonly snapshot: DiagnosticsSnapshot;
	/** Where a note with this id sits, or `undefined` when the index does not know it. */
	resolvePath(entityId: string): string | undefined;
	writeToClipboard(text: string): Promise<void>;
	/** For `runDetached`: a rejected clipboard write owes a user sentence AND a log line. */
	readonly logger: Logger;
}

/**
 * The COPIED payload. It takes the snapshot and nothing else — no `resolvePath` parameter exists
 * to pass — which is what makes "the export carries no path" structural rather than a discipline
 * somebody has to keep. A future edit that wants a path in here has to widen the signature,
 * which is a visible decision.
 */
export function diagnosticsReportText(snapshot: DiagnosticsSnapshot): string {
	const lines = [
		`plugin ${snapshot.pluginVersion}`,
		`obsidian ${snapshot.obsidianVersion}`,
		`schema ${Object.entries(snapshot.schemaVersions)
			.map(([kind, version]) => `${kind}=${String(version)}`)
			.join(' ')}`,
		`migration last-applied ${snapshot.migrationState.lastApplied ?? 'none'}`,
		`migration pending ${snapshot.migrationState.pending.join(' ') || 'none'}`,
	];
	for (const issue of snapshot.validationIssues) {
		lines.push(`issue ${issue.entityType} ${issue.entityId} ${issue.issue}`);
	}
	// The incidents file's path is the ONE path this payload carries, and it is here rather
	// than only in the modal for the same reason the schema versions are: a user pasting this
	// into a support thread is the case the export exists for, and "which file do I remove"
	// is unanswerable from a list of ids. It is plugin-local and holds no user content, which
	// is what distinguishes it from the note paths `resolvePath` deliberately never reaches.
	const incidents = snapshot.writeIncidents;
	lines.push(`incidents ${incidents.open.length === 0 ? 'none' : incidents.path}`);
	for (const incident of incidents.open) {
		const affected = incident.affected.map((entity) => `${entity.entityKind}:${entity.entityId}`).join(' ');
		lines.push(`incident ${incident.code} ${incident.raisedAt || 'unknown'} ${affected || 'unnamed'}`);
	}
	return lines.join('\n');
}

/**
 * The incidents section of the rendered report — ADR-0034's discoverable retirement gesture.
 *
 * Extracted rather than inlined because `renderDiagnosticsReport` is under the 100-line
 * `max-lines-per-function` budget and this is a self-contained region with its own empty
 * state; the seam is the one `fact` above already draws inside that function.
 */
function renderIncidents(report: HTMLElement, incidents: DiagnosticsSnapshot['writeIncidents']): void {
	report.createEl('h3', { cls: 'rp-diagnostics__section', text: tr('diagnostics.incidents') });
	if (incidents.open.length === 0) {
		// Its OWN class rather than the issues list's `__empty`. Two empty states under one
		// selector makes `expect(querySelector('.rp-diagnostics__empty')).not.toBeNull()` — an
		// assertion that already exists for the issues list — pass on a build that dropped it.
		report.createEl('p', { cls: 'rp-diagnostics__incidents-empty', text: tr('diagnostics.incidents.none') });
		return;
	}
	const list = report.createEl('ul', { cls: 'rp-diagnostics__incidents' });
	for (const incident of incidents.open) {
		const row = list.createEl('li', { cls: 'rp-diagnostics__incident' });
		row.createSpan({ cls: 'rp-diagnostics__code', text: incident.code });
		// `raisedAt` is deliberately `''` on an unreadable record — there is no string shape a
		// real ISO instant can never take, so `unreadableWriteIncident` refuses to mint a
		// placeholder that might read as one. An omitted span is this renderer's half of that.
		if (incident.raisedAt !== '') row.createSpan({ cls: 'rp-diagnostics__at', text: incident.raisedAt });
		if (incident.code === UNREADABLE_WRITE_INCIDENT_CODE) {
			row.createSpan({ cls: 'rp-diagnostics__note', text: tr('diagnostics.incidents.unreadable') });
		}
		if (incident.affected.length === 0) {
			row.createSpan({ cls: 'rp-diagnostics__note', text: tr('diagnostics.incidents.unnamed') });
		}
		for (const entity of incident.affected) {
			row.createSpan({ cls: 'rp-diagnostics__id', text: `${entity.entityKind} ${entity.entityId}` });
		}
	}
	report.createEl('p', {
		cls: 'rp-diagnostics__note',
		text: tr('diagnostics.incidents.remove', { path: incidents.path }),
	});
}

/**
 * **What is SHOWN and what is COPIED differ, on purpose.** `DiagnosticsLedger` is provably
 * content-free — `tests/application/ports/diagnostics.test-d.ts` holds five `@ts-expect-error`
 * directives forbidding a name or a path from ever entering it — so an issue names an opaque id
 * and nothing else. A user holding an id still has to find the note, so the VIEW joins the id
 * against the project index at render time. The COPIED text is `diagnosticsReportText`, built
 * from the snapshot alone and never from the join, because SDD §86 governs what leaves the
 * device rather than what is drawn on it.
 *
 * **A strip's count and this report's rows can disagree, and that is not reconciled.** A warning
 * strip counts ONE listing; this report holds every refusal recorded this session, deduplicated
 * on `(kind, id, code)` and bounded at `MAX_ISSUES = 200`
 * (`infrastructure/logging/diagnosticsLedger.ts:19`). A user who opens one plan and then this
 * report sees the same number; a user who opened three plans does not.
 */
export function renderDiagnosticsReport(into: HTMLElement, deps: DiagnosticsReportDeps): void {
	into.empty();
	const report = into.createDiv({ cls: 'rp-diagnostics' });

	report.createEl('p', { cls: 'rp-diagnostics__scope', text: tr('diagnostics.session-only') });

	const facts = report.createEl('dl', { cls: 'rp-diagnostics__facts' });
	const fact = (label: StringKey, value: string): void => {
		facts.createEl('dt', { text: tr(label) });
		facts.createEl('dd', { text: value });
	};
	fact('diagnostics.plugin-version', deps.snapshot.pluginVersion);
	fact('diagnostics.obsidian-version', deps.snapshot.obsidianVersion);
	fact(
		'diagnostics.last-migration',
		deps.snapshot.migrationState.lastApplied ?? tr('diagnostics.none'),
	);
	// Both of these are PROMISED twice over — by `settings.diagnostics.desc` and by this
	// increment's Definition of Done — and the first draft of this renderer omitted both while
	// `diagnosticsReportText` carried them. A fact present in the COPY and absent from the
	// REPORT is this file's asymmetry pointed the wrong way: the user reads the modal.
	fact(
		'diagnostics.schema-versions',
		Object.entries(deps.snapshot.schemaVersions)
			.map(([kind, version]) => `${kind} ${String(version)}`)
			.join(', '),
	);
	fact(
		'diagnostics.pending-migrations',
		deps.snapshot.migrationState.pending.join(', ') || tr('diagnostics.none'),
	);

	if (deps.snapshot.validationIssues.length === 0) {
		report.createEl('p', { cls: 'rp-diagnostics__empty', text: tr('diagnostics.no-issues') });
	} else {
		const list = report.createEl('ul', { cls: 'rp-diagnostics__issues' });
		for (const issue of deps.snapshot.validationIssues) {
			const row = list.createEl('li', { cls: 'rp-diagnostics__issue' });
			row.createSpan({ cls: 'rp-diagnostics__code', text: issue.issue });
			row.createSpan({ cls: 'rp-diagnostics__id', text: issue.entityId });
			// The JOIN, and the only place it happens. The ledger never held this.
			const path = deps.resolvePath(issue.entityId);
			if (path !== undefined) row.createSpan({ cls: 'rp-diagnostics__path', text: path });
		}
	}

	renderIncidents(report, deps.snapshot.writeIncidents);

	const copy = report.createEl('button', {
		cls: 'rp-diagnostics__copy',
		text: tr('diagnostics.copy'),
	});
	copy.addEventListener('click', () => {
		// `runDetached`, never a bare `void`. A DOM click handler returns nothing, so this
		// promise has no awaiter — and `void` DISCARDS a rejection rather than handling it, which
		// is the spelling `runDetached`'s own docblock exists to refuse. `writeText` really can
		// reject: clipboard permission may be unavailable.
		//
		// The success notice is chained INSIDE the promise, so it fires on fulfilment only.
		// "Copied" printed beside an empty clipboard is worse than no notice at all.
		//
		// **The async IIFE is load-bearing and is not a style choice.** `runDetached` takes a
		// PROMISE, so its argument is evaluated before it is entered — and `writeToClipboard`
		// can throw SYNCHRONOUSLY rather than reject: the composed one is
		// `navigator.clipboard.writeText(text)`, and where the API is absent or blocked that
		// property access is a `TypeError` thrown during argument evaluation. Written as a bare
		// `runDetached(deps.writeToClipboard(...).then(...), …)` the throw escapes the click
		// handler entirely — no notice, no log line, a button that silently does nothing, which
		// is the exact failure `runDetached` exists to prevent, reached past it. Inside an async
		// function both failure shapes become one rejection.
		runDetached(
			(async (): Promise<void> => {
				await deps.writeToClipboard(diagnosticsReportText(deps.snapshot));
				notifySuccess(tr('diagnostics.copied'));
			})(),
			deps.logger,
			'diagnostics.copy.failed',
		);
	});
}

export class DiagnosticsReportModal extends Modal {
	constructor(
		app: App,
		private readonly deps: DiagnosticsReportDeps,
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.setText(tr('diagnostics.title'));
		renderDiagnosticsReport(this.contentEl, this.deps);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

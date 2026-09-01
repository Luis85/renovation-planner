import type { EntityId } from '../../core/identity/EntityId';
import { tr } from '../../presentation/i18n/strings';
import { notifyWarning } from '../../presentation/notices/notify';
import type { PluginCommandHost } from '../commandHost';
import { DiagnosticsReportModal } from './DiagnosticsReportModal';

/**
 * The ONE function both doors call — a palette command and a settings action row — per this
 * repository's one-action-every-input rule. A second entry point with its own composition looks
 * correct alone and drifts the moment either is edited.
 *
 * `resolvePath` closes over the project index rather than being computed here, so the modal
 * never learns what an index is and the join stays a rendering concern.
 *
 * **A session whose settings could not be read gets a refusal rather than a report**, and that
 * is a decision rather than a limitation of the wiring. `GetDiagnosticsSnapshotQuery` is
 * composed inside `persistence`, which is `null` exactly when `settings` is — so there is no
 * snapshot to draw. An EMPTY report is the WRONG answer rather than a lesser one: it would say
 * "No notes have refused to load in this session" about a session that never attempted a read,
 * which is the false-reassurance shape slice 14's own amendment refuses. The settings tab
 * offers no row there either, though not by a decision taken here — that branch returns one
 * text-only definition and stops.
 */
export async function showDiagnosticsReport(host: PluginCommandHost): Promise<void> {
	const persistence = host.root.persistence;
	if (persistence === null) {
		notifyWarning(tr('settings.unrecovered'));
		return;
	}

	const snapshot = await persistence.queries.diagnostics.execute();
	new DiagnosticsReportModal(host.app, {
		snapshot,
		// The ledger's ids are branded at their raise sites and arrive here as plain strings on
		// the snapshot, which is the content-free shape SDD §86 asks for. The cast is at the
		// index lookup rather than on the way in, so nothing upstream has to carry a brand it
		// deliberately dropped.
		resolvePath: (entityId: string) => persistence.index.getPath(entityId as EntityId<string>),
		writeToClipboard: (text: string) => navigator.clipboard.writeText(text),
		logger: host.root.logger,
	}).open();
}

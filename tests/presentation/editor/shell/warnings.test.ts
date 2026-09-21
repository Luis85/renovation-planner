/**
 * `editorWarnings` — the pure derivation behind Task 20's keyed warning strip, and Task 9's
 * actions/busy/unrecovered widening (design spec §2.3, §2.4, §2.8). No DOM: this is the same
 * question the shell's template used to ask independently, asked once as a function of one
 * input bundle.
 */
import { describe, expect, it, vi } from 'vitest';
import { editorWarnings, type EditorWarning, type EditorWarningInput } from '../../../../src/presentation/editor/shell/warnings';

const noop = (): void => {};

/** Every condition clear, every flag false, every count zero — the baseline every case narrows. */
const clear: EditorWarningInput = {
	unrecoveredWrite: false,
	stale: false,
	refreshing: false,
	retriesFailed: 0,
	unreadableZones: 0,
	backgroundStatus: 'none',
	retry: noop,
	openSourceNote: noop,
	openDiagnosticsReport: noop,
};

describe('editorWarnings', () => {
	it('orders unrecovered first, then stale, unreadable-zones, background-*', () => {
		const w = editorWarnings({ ...clear, unrecoveredWrite: true, stale: true, unreadableZones: 1, backgroundStatus: 'missing' });
		expect(w.map((x) => x.id)).toStrictEqual(['unrecovered', 'stale', 'unreadable-zones', 'background-missing']);
	});

	it('gives the stale row Try again and Open source note, busy while refreshing', () => {
		const retry = vi.fn<() => void>();
		const open = vi.fn<() => void>();
		const [stale] = editorWarnings({ ...clear, stale: true, refreshing: true, retry, openSourceNote: open });
		expect(stale.actions?.map((a) => [a.id, a.labelKey, a.busy])).toStrictEqual([
			['retry', 'editor.warning.retry', true],
			['open-source-note', 'editor.warning.open-source-note', true],
		]);
		stale.actions?.[0].run();
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it('moves the stale message to .again after the first failed retry', () => {
		expect(editorWarnings({ ...clear, stale: true })[0].messageKey).toBe('editor.refresh-failed');
		expect(editorWarnings({ ...clear, stale: true, retriesFailed: 1 })[0].messageKey).toBe('editor.refresh-failed.again');
	});

	it('the unrecovered row is an error with Open source note only — nothing to re-read would change it', () => {
		const [row] = editorWarnings({ ...clear, unrecoveredWrite: true });
		expect(row.severity).toBe('error');
		expect(row.messageKey).toBe('editor.unrecovered');
		expect(row.actions?.map((a) => a.id)).toStrictEqual(['open-source-note']);
	});

	it('carries the count as a string param on the unreadable-zones warning', () => {
		const warnings = editorWarnings({ ...clear, stale: true, unreadableZones: 2, backgroundStatus: 'missing' });
		const unreadable = warnings.find((w) => w.id === 'unreadable-zones');

		expect(unreadable?.params).toStrictEqual({ count: '2' });
	});

	/**
	 * `editor.some-zones-unreadable` has ended with "Open the diagnostics report to see which
	 * notes refused" since it was written, and the row carried no control that could — an
	 * instruction with no door. The label is the palette command's own key rather than a new
	 * pair: it is the verb phrase both sibling actions on this strip already are, and it is
	 * sentence case in both locales.
	 */
	it('gives the unreadable-zones row the diagnostics door its own message names', () => {
		const open = vi.fn<() => void>();
		const [row] = editorWarnings({ ...clear, unreadableZones: 2, openDiagnosticsReport: open });

		expect(row.actions?.map((a) => [a.id, a.labelKey, a.busy])).toStrictEqual([
			['open-diagnostics', 'command.show-diagnostics-report', false],
		]);

		row.actions?.[0].run();
		expect(open).toHaveBeenCalledTimes(1);
	});

	/**
	 * `busy` is `ProjectStore.refreshing`, and this action does not read it — a plan re-read in
	 * flight changes nothing about the ledger the report opens over. Pinned separately from the
	 * case above because that one passes `refreshing: false`, so it would agree with a build
	 * that had spelled `busy: input.refreshing` here.
	 */
	it('never marks the diagnostics action busy, even mid-refresh', () => {
		const [row] = editorWarnings({ ...clear, unreadableZones: 1, refreshing: true });

		expect(row.actions?.map((a) => a.busy)).toStrictEqual([false]);
	});

	/**
	 * **The census as a census.** The two `background-*` rows stay action-less, and the reason
	 * is structural rather than "not yet": `DiagnosticEntityKind` has no background member and
	 * every `DiagnosticsLedger.record` call site names a note or a sidecar, so a diagnostics
	 * button here would open a report incapable of mentioning the background — an action that
	 * cannot work, which `en-assetLibrary.ts` already refuses by name for `UnreadableStrip`.
	 *
	 * This passes TODAY, and deliberately: it exists so that the "give the other two the same
	 * button for consistency" edit is a red test rather than a review comment nobody makes.
	 * It asserts `actions` is undefined rather than empty — `PersistentWarningStrip.vue` gates
	 * the whole group on `w.actions !== undefined`, so an empty array would render an empty
	 * actions container.
	 */
	it('leaves the two background rows action-less — a report cannot name a background', () => {
		expect(editorWarnings({ ...clear, backgroundStatus: 'missing' })[0].actions).toBeUndefined();
		expect(editorWarnings({ ...clear, backgroundStatus: 'unreadable' })[0].actions).toBeUndefined();
	});

	it('yields background-unreadable for an unreadable background, and never both background ids', () => {
		const warnings = editorWarnings({ ...clear, backgroundStatus: 'unreadable' });

		expect(warnings.map((w) => w.id)).toStrictEqual(['background-unreadable']);
	});

	it('yields no background warning for a plan with no background, or one already rendering', () => {
		expect(editorWarnings({ ...clear, backgroundStatus: 'none' }).map((w) => w.id)).toStrictEqual([]);
		expect(editorWarnings({ ...clear, backgroundStatus: 'raster' }).map((w) => w.id)).toStrictEqual([]);
	});

	it('is empty when every condition is clear', () => {
		expect(editorWarnings(clear)).toStrictEqual([]);
	});

	it('carries a severity on every warning: out-of-date content is a warning, a refused read is an error', () => {
		const warnings = editorWarnings({ ...clear, stale: true, unreadableZones: 2, backgroundStatus: 'unreadable' });
		expect(warnings.map((w) => [w.id, w.severity])).toStrictEqual([
			['stale', 'warning'],
			['unreadable-zones', 'error'],
			['background-unreadable', 'error'],
		]);
		expect(editorWarnings({ ...clear, backgroundStatus: 'missing' })[0]?.severity).toBe('warning');
	});

	it('refuses a warning with no severity at compile time', () => {
		// @ts-expect-error — `severity` is required (R5); a fixture of ids and messages alone no longer type-checks.
		const bare: EditorWarning = { id: 'stale', messageKey: 'editor.refresh-failed' };
		expect(bare.id).toBe('stale');
	});
});

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

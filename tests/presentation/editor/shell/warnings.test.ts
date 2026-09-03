/**
 * `editorWarnings` — the pure derivation behind Task 20's keyed warning strip. No DOM: this
 * is the same question the four `v-if`s in `PlanEditorRoot.vue` used to ask independently,
 * asked once as a function of the same three inputs.
 */
import { describe, expect, it } from 'vitest';
import { editorWarnings, type EditorWarning } from '../../../../src/presentation/editor/shell/warnings';

describe('editorWarnings', () => {
	it('orders every warning fixed: stale, unreadable-zones, background-*', () => {
		const warnings = editorWarnings({ stale: true, unreadableZones: 2, backgroundStatus: 'missing' });

		expect(warnings.map((w) => w.id)).toStrictEqual(['stale', 'unreadable-zones', 'background-missing']);
	});

	it('carries the count as a string param on the unreadable-zones warning', () => {
		const warnings = editorWarnings({ stale: true, unreadableZones: 2, backgroundStatus: 'missing' });
		const unreadable = warnings.find((w) => w.id === 'unreadable-zones');

		expect(unreadable?.params).toStrictEqual({ count: '2' });
	});

	it('yields background-unreadable for an unreadable background, and never both background ids', () => {
		const warnings = editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'unreadable' });

		expect(warnings.map((w) => w.id)).toStrictEqual(['background-unreadable']);
	});

	it('yields no background warning for a plan with no background, or one already rendering', () => {
		expect(
			editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'none' }).map((w) => w.id),
		).toStrictEqual([]);
		expect(
			editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'raster' }).map((w) => w.id),
		).toStrictEqual([]);
	});

	it('is empty when every condition is clear', () => {
		expect(editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'none' })).toStrictEqual([]);
	});

	it('carries a severity on every warning: out-of-date content is a warning, a refused read is an error', () => {
		const warnings = editorWarnings({ stale: true, unreadableZones: 2, backgroundStatus: 'unreadable' });
		expect(warnings.map((w) => [w.id, w.severity])).toStrictEqual([
			['stale', 'warning'],
			['unreadable-zones', 'error'],
			['background-unreadable', 'error'],
		]);
		expect(editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'missing' })[0]?.severity).toBe('warning');
	});

	it('refuses a warning with no severity at compile time', () => {
		// @ts-expect-error — `severity` is required (R5); a fixture of ids and messages alone no longer type-checks.
		const bare: EditorWarning = { id: 'stale', messageKey: 'editor.refresh-failed' };
		expect(bare.id).toBe('stale');
	});
});

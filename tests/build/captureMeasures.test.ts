import { describe, expect, it } from 'vitest';
import { overflowFinding } from '../../scripts/captureMeasures.mjs';

describe('overflowFinding', () => {
	it('is null when the shell fits its width', () => {
		expect(overflowFinding('plan-editor-unsupported', { scrollWidth: 320, clientWidth: 320 })).toBeNull();
	});
	it('names the shot and both widths when the shell scrolls sideways', () => {
		expect(overflowFinding('plan-editor-unsupported', { scrollWidth: 412, clientWidth: 320 })).toBe(
			'[plan-editor-unsupported] .rp-editor-shell scrolls horizontally: scrollWidth 412 > clientWidth 320',
		);
	});
	it('reports a shell that was not there to measure', () => {
		expect(overflowFinding('plan-editor-unsupported', null)).toBe('[plan-editor-unsupported] no .rp-editor-shell to measure');
	});
});

// @vitest-environment jsdom
/**
 * `PanelResizer` on its own (2026-09-12 side panels spec §1): the WAI-ARIA window splitter. It
 * reports widths and commits; the store and storage are the shell's, driven in `sidePanels.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import PanelResizer from '../../../../src/presentation/editor/shell/PanelResizer.vue';
import { pointer } from '../../../helpers/planEditorRig';
import type { PanelSide } from '../../../../src/presentation/editor/shell/panelLayout';

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; });

function resizer(side: PanelSide, width = 256): VueWrapper {
	wrapper = mount(PanelResizer, { props: { side, width, min: 200, max: 400, controls: 'panel-body' } });
	return wrapper;
}

function emitted(name: string): unknown[][] {
	return (wrapper as VueWrapper).emitted(name) ?? [];
}

describe('PanelResizer', () => {
	it('is a named, focusable vertical separator carrying its value and bounds', () => {
		const el = resizer('layers').get('[role="separator"]');
		expect(el.attributes()).toMatchObject({
			tabindex: '0',
			'aria-orientation': 'vertical',
			'aria-controls': 'panel-body',
			'aria-valuenow': '256',
			'aria-valuemin': '200',
			'aria-valuemax': '400',
			'aria-label': 'Resize property and layers',
			'data-rp-resizer': 'layers',
		});
	});

	it.each([
		['layers', 'ArrowRight', false, 272],
		['layers', 'ArrowLeft', true, 200],
		['inspector', 'ArrowLeft', false, 272],
		['inspector', 'ArrowRight', true, 200],
		['layers', 'Home', false, 200],
		['layers', 'End', false, 400],
	] as const)('on %s, %s (shift %s) resizes to %i and commits', async (side, key, shiftKey, expected) => {
		await resizer(side).get('[role="separator"]').trigger('keydown', { key, shiftKey });
		expect(emitted('resize')).toEqual([[expected]]);
		expect(emitted('commit')).toHaveLength(1);
	});

	it('asks to collapse on Enter and ignores other keys', async () => {
		const el = resizer('layers').get('[role="separator"]');
		await el.trigger('keydown', { key: 'Enter' });
		await el.trigger('keydown', { key: 'a' });
		expect(emitted('collapse')).toHaveLength(1);
		expect(emitted('resize')).toHaveLength(0);
	});

	it('follows a primary drag live and commits once, on release', () => {
		const el = resizer('inspector', 352).get('[role="separator"]').element as HTMLElement;
		pointer(el, 'pointerdown', 500, 10);
		pointer(el, 'pointermove', 450, 10);
		pointer(el, 'pointermove', 480, 10);
		expect(emitted('resize')).toEqual([[400], [372]]);
		expect(emitted('commit')).toHaveLength(0);
		pointer(el, 'pointerup', 480, 10);
		pointer(el, 'pointermove', 400, 10);
		expect(emitted('commit')).toHaveLength(1);
		expect(emitted('resize')).toHaveLength(2);
	});

	it('ignores a non-primary press and a move from another pointer', () => {
		const el = resizer('layers').get('[role="separator"]').element as HTMLElement;
		pointer(el, 'pointerdown', 100, 10, 1);
		pointer(el, 'pointermove', 150, 10, 1);
		pointer(el, 'pointerdown', 100, 10, 0, 1);
		pointer(el, 'pointermove', 150, 10, 0, 2);
		pointer(el, 'pointercancel', 150, 10, 0, 2);
		expect(emitted('resize')).toHaveLength(0);
		pointer(el, 'pointercancel', 150, 10, 0, 1);
		expect(emitted('commit')).toHaveLength(1);
	});

	it('resets on double-click', async () => {
		await resizer('layers').get('[role="separator"]').trigger('dblclick');
		expect(emitted('reset')).toHaveLength(1);
	});
});

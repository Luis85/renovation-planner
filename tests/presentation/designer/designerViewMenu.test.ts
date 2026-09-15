/**
 * @vitest-environment jsdom
 *
 * The asset designer's View menu, its remembered choices and the grid readout (asset designer snapping spec
 * 2026-09-15, §2.6 and §5), through the real mounted designer.
 */
import { describe, expect, it } from 'vitest';
import { editorViewPreferencesStore } from '../../../src/infrastructure/obsidian/plugin-data/editorViewPreferencesStore';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { toiletShape } from '../../helpers/assetShapes';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';
import { recorder } from '../../helpers/logger';

const input = (rig: Awaited<ReturnType<typeof designerRig>>, view: 'grid' | 'snap') => rig.wrapper.get(`.rp-designer-tools [data-rp-view="${view}"]`);

describe('the designer’s View menu', () => {
	it('shows and hides the grid, and turns automatic snapping off', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			await input(rig, 'grid').setValue(true);
			expect(useWorkspaceStore(rig.pinia).gridVisible).toBe(true);
			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(true);

			await input(rig, 'snap').setValue(false);
			expect(useEditorStore(rig.pinia).snappingEnabled).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	it.each([['designer.toolbar.select'], ['designer.toolbar.pan']] as const)(
		'refuses to change snapping while a press is held on the canvas under %s',
		async (label: StringKey) => {
			const rig = await designerRig({ shape: toiletShape() });
			try {
				rig.toolbarButton(t('en', label)).click();
				await settle();
				const at = rig.at({ x: 0, y: -160 });
				const pointer = (type: string, buttons: number) =>
					rig.canvasEl.dispatchEvent(new PointerEvent(type, { button: 0, buttons, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
				pointer('pointerdown', 1);

				await input(rig, 'snap').setValue(false);

				expect(useEditorStore(rig.pinia).snappingEnabled).toBe(true);
				expect((input(rig, 'snap').element as HTMLInputElement).checked).toBe(true);
				pointer('pointerup', 0);
			} finally {
				rig.unmount();
			}
		},
	);

	it('closes on a plain Escape and hands focus back to its summary', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			const menu = rig.wrapper.get('.rp-designer-tools .rp-view-menu');
			const details = menu.element as HTMLDetailsElement;
			details.open = true;

			await menu.trigger('keydown', { key: 'Escape' });

			expect(details.open).toBe(false);
			expect(document.activeElement).toBe(menu.get('summary').element);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * `useDisclosureDismissal`'s outside-press half, shared with `EditorViewMenu`
	 * (`editorViewMenuPopOut.test.ts` proves the pop-out-document case there) — never exercised on the
	 * designer's own menu before this (final review, F1). `designerRig` attaches to the real `document`,
	 * so a plain document-level `pointerdown` is already "outside": nothing in this rig runs in a pop-out
	 * leaf's own document.
	 */
	it('closes on a pointerdown outside the menu', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			const menu = rig.wrapper.get('.rp-designer-tools .rp-view-menu');
			const details = menu.element as HTMLDetailsElement;
			details.open = true;

			document.dispatchEvent(new Event('pointerdown'));

			expect(details.open).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	it('opens with this device’s remembered choices and writes a change back', async () => {
		let stored: unknown = { gridVisible: true, snappingEnabled: false };
		const viewPreferences = editorViewPreferencesStore(
			{ loadLocalStorage: () => stored, saveLocalStorage: (_key, data) => { stored = data; } },
			'designer-view',
			recorder,
		);
		const rig = await designerRig({ shape: toiletShape(), viewPreferences });
		try {
			expect(useWorkspaceStore(rig.pinia).gridVisible).toBe(true);
			expect(useEditorStore(rig.pinia).snappingEnabled).toBe(false);

			await input(rig, 'grid').setValue(false);

			expect(stored).toEqual({ gridVisible: false, snappingEnabled: false });
		} finally {
			rig.unmount();
		}
	});
});

describe('the grid readout', () => {
	it('names the step while the grid is shown, and nothing while it is hidden', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			expect(rig.wrapper.find('.rp-designer-grid-step').exists()).toBe(false);
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			// 10 mm per pixel at the rig's camera: the 500 mm step.
			expect(rig.wrapper.get('.rp-designer-status .rp-designer-grid-step').text()).toBe(t('en', 'designer.status.grid', { step: '500' }));
		} finally {
			rig.unmount();
		}
	});

	it('names no step, a measurement, while the footprint is unscaled', async () => {
		// `footprintOrigin: 'traced'` alongside it: a TYPED footprint may never be pending
		// (`AssetShape.ts`'s `typed-footprint-cannot-be-pending`), so the toilet preset's own
		// 'typed' origin has to change too, or the sidecar's read-side revalidation refuses the
		// shape outright rather than answering the unscaled design this case is about.
		const rig = await designerRig({ shape: { ...toiletShape(), footprintOrigin: 'traced', footprintPending: true } });
		try {
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(true);
			expect(rig.wrapper.find('.rp-designer-grid-step').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});

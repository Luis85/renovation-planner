/**
 * @vitest-environment jsdom
 *
 * Design 89 (AD18 audit 2, rank 1): with `Platform.isMacOS` true, the designer's context menu
 * labels its four chords with the platform's own modifier symbol (`⌘`), not `Ctrl`.
 * `designerContextMenu.test.ts` pins the off-macOS `Ctrl` list on the same rig; this is its
 * macOS sibling, reusing that rig (`selecting`, `rightClick`, the shared fixtures) rather than
 * cloning it, and touches nothing that file owns.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { selecting } from '../../helpers/designerRig';
import { rightClick } from '../../helpers/designerRightClick';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';
import { settle } from '../../helpers/editor';

const BOWL = justInsideBottom(detailOutline('detail-2'));

afterEach(() => {
	// A module-level singleton (`platformModifier.test.ts`'s own note): left flipped, it would
	// leak into whatever runs next in this file's registry.
	Platform.isMacOS = false;
});

describe('the context menu on macOS', () => {
	it('labels Group, Ungroup and Duplicate with ⌘, leaving Delete as Del', async () => {
		Platform.isMacOS = true;
		const rig = await selecting(TOILET);
		rightClick(rig, BOWL);
		await settle();

		const menu = (rig.wrapper.element as HTMLElement).querySelector('.rp-canvas-context-menu') as HTMLElement;
		const hints = [...menu.querySelectorAll('.rp-canvas-context-menu-shortcut')].map((hint) => hint.textContent);
		expect(hints).toEqual(['⌘+G', '⌘+Shift+G', '⌘+D', 'Del']);
		rig.unmount();
	});
});

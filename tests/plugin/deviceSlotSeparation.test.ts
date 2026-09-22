/**
 * @vitest-environment jsdom
 *
 * "The asset designer's View-menu choices are remembered in their OWN per-device slot, separate
 * from the Plan Editor's."
 *
 * The approved snapping spec (§2.6) requires it, AD15-R2's *"Two rows that were NEVER OPEN"*
 * correction found the surfaces already satisfy it, and what that correction recorded as still
 * owed is this file: `assetDesignerDeviceSlots`' docblock asserts the separation in prose —
 * *"under `designer-view` rather than the Plan Editor's `editor-view`"* — and nothing failed when
 * it stopped being true. A confident paragraph is evidence of intent and of nothing else.
 *
 * **Behavioural rather than a string comparison, and the difference is the whole point.**
 * Comparing the two key literals proves two literals differ; it would stay green if
 * `editorViewPreferencesStore` ever ignored the key it was handed, and it re-states the code
 * rather than asking anything of it. So both slot builders are driven against ONE adapter and the
 * question asked is the user-visible one: does flipping the designer's grid flip the Plan
 * Editor's. The keys are then pinned as a SECOND case, because a behavioural pass says the two
 * slots are separate without saying which key either is, and the spec names one of them.
 *
 * **The fake is keyed, because the real `App.loadLocalStorage` is.** A one-slot fake —
 * `editorViewPreferencesStore.test.ts` has one, correctly, since it drives a single store —
 * would collide every key and make this file pass by being kinder than Obsidian in exactly the
 * direction it is asking about.
 *
 * It also has to honour the MERGE `write` performs (that function's own docblock: a leaf writing
 * its whole pair would restore its stale value for the choice another leaf just changed), which
 * is why the write below is a single field over a stored pair — a replacing fake would hide a
 * shared key behind a wholesale overwrite.
 *
 * **jsdom although nothing here mounts anything.** Both deps modules reach an SFC by import
 * (`planEditorDeps.ts` → `PlanEditorRoot.vue`), and `scripts/vitest-no-ssr-sfc.mjs` refuses that
 * under the node environment — watched: it named `PlanEditorRoot.vue` before this directive was
 * added. The other remedy that plugin names, moving what the test needs into a module with no
 * `.vue` below it, is a `src/` change this card may not make.
 */
import { describe, expect, it } from 'vitest';
import type { LocalStorageAdapter } from '../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { assetDesignerDeviceSlots } from '../../src/plugin/assetDesignerDeps';
import { planEditorDeviceSlots } from '../../src/plugin/planEditorDeps';
import { recorder as logger } from '../helpers/logger';

const PLUGIN_ID = 'renovation-planner';

/** One device's storage: keyed, the way `App.loadLocalStorage`/`saveLocalStorage` are. */
function deviceStorage(): LocalStorageAdapter & { keys: () => string[] } {
	const stored = new Map<string, unknown>();
	return {
		loadLocalStorage: (key) => stored.get(key) ?? null,
		saveLocalStorage: (key, data) => void stored.set(key, data),
		keys: () => [...stored.keys()].toSorted(),
	};
}

describe('the asset designer and the Plan Editor', () => {
	it('do not read or write each other view preferences', () => {
		const adapter = deviceStorage();
		const designer = assetDesignerDeviceSlots(adapter, PLUGIN_ID, logger);
		const editor = planEditorDeviceSlots(adapter, PLUGIN_ID, logger);

		editor.viewPreferences.write({ gridVisible: true, snappingEnabled: true });
		designer.viewPreferences.write({ gridVisible: false });

		expect(editor.viewPreferences.read()).toEqual({ gridVisible: true, snappingEnabled: true });
		expect(designer.viewPreferences.read()).toEqual({ gridVisible: false });
	});

	// The other direction of the same property: the designer's own write must not be READABLE
	// through the editor's slot either, which the case above cannot distinguish from the editor
	// simply having written last.
	it('keep a designer-only choice out of the editor slot entirely', () => {
		const adapter = deviceStorage();
		const designer = assetDesignerDeviceSlots(adapter, PLUGIN_ID, logger);

		designer.viewPreferences.write({ snappingEnabled: false });

		expect(planEditorDeviceSlots(adapter, PLUGIN_ID, logger).viewPreferences.read()).toEqual({});
	});

	/**
	 * Which keys those are, pinned by the set the two builders actually TOUCH rather than
	 * transcribed from either module: §2.6 names the designer's slot, and a rename is a per-device
	 * preference every user on that device silently loses.
	 */
	it('store under their own keys, the editor carrying its panel layout beside them', () => {
		const adapter = deviceStorage();

		assetDesignerDeviceSlots(adapter, PLUGIN_ID, logger).viewPreferences.write({ gridVisible: true });
		const designerOnly = adapter.keys();
		const editor = planEditorDeviceSlots(adapter, PLUGIN_ID, logger);
		editor.viewPreferences.write({ gridVisible: true });
		editor.panelLayout.write({ leftCollapsed: true, rightCollapsed: false });

		expect(designerOnly).toEqual(['renovation-planner:designer-view']);
		expect(adapter.keys()).toEqual(['renovation-planner:designer-view', 'renovation-planner:editor-view', 'renovation-planner:panel-layout']);
	});
});

import type { EditorContext } from '../editor/tools/editor-context';

/**
 * The `ToolManager` context factory the designer's canvas is built with until Task B5 supplies
 * a real one — and a THROW rather than a stand-in, deliberately.
 *
 * `ToolManager` takes a factory and calls it at exactly one moment: activating a tool. Nothing
 * registers a designer tool yet (Task B5's `registerDesignerTools` is what will), so this
 * function is unreachable through every door a user has — there is no toolbar and no command —
 * and the canvas is camera-only, which is this repository's ordinary "no active tool" state
 * rather than a degraded one.
 *
 * **A fabricated context would be the worse answer**, and that is the decision this file
 * records. `EditorContext` promises seven live members — a bound viewport, the selection store,
 * the snap service, a dispatcher, the write ledger, the render state and the subject — and a
 * bundle of no-ops satisfying the type is a fake KINDER than the real thing in production code:
 * the first tool registered against it would dispatch into silence and refuse nothing. Throwing
 * is the same category `ToolManager` itself already uses for a wiring mistake ("no tool is
 * registered for id …"), which is what this would be.
 *
 * Task B5 DELETES this module rather than growing it; the assembler it replaces this with is
 * `createEditorContext`, exactly as `presentation/editor/runtime.ts` builds one.
 */
export function designerToolsUnavailable(): EditorContext {
	throw new Error('The asset designer registers no editor tools yet; Task B5 supplies the context.');
}

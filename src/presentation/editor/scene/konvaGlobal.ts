/**
 * Konva installs ITSELF on `window`, and this is how the plugin takes it back off.
 *
 * `konva/lib/Global.js` ends in `Konva._injectGlobal(Konva)`, which runs at MODULE SCOPE:
 *
 * ```js
 * _injectGlobal(Konva) {
 *   if (typeof glob.Konva !== 'undefined') {
 *     console.error('Several Konva instances detected. ...');
 *   }
 *   glob.Konva = Konva;
 * }
 * ```
 *
 * Obsidian evaluates `main.js` on every plugin load, so every load runs that line. Nothing
 * removed the global on unload, so deactivating and reactivating the plugin logged
 * **"Several Konva instances detected"** at `console.error` — reported from a real vault,
 * and reproducible by toggling the plugin off and on.
 *
 * The console line is the symptom; the LEAK is the defect. `window.Konva` keeps the whole
 * Konva module — and through it this plugin's bundle — reachable after unload, which is the
 * plainest form of "a plugin must clean up after itself".
 *
 * **Only if it is still ours.** The global is claimed at load, when it is by construction
 * this bundle's instance: Konva's module scope has already run by the time Obsidian calls
 * `onload`. Deleting unconditionally would take away the global belonging to another
 * Konva-bundling plugin that loaded after us. Comparing identity is what keeps this to
 * removing exactly what we added.
 *
 * Deleting it cannot break our own rendering: everything inside Konva refers to its
 * module-scope binding, and `glob.Konva` is read only by the duplicate check above.
 */

/** The one property Konva assigns, named once so the claim and the release agree. */
const KONVA_GLOBAL = 'Konva';

/**
 * Claim the global Konva installed by importing this bundle, and answer the function that
 * releases it.
 *
 * A disposer rather than a `releaseKonvaGlobal()` that re-reads `window` at unload time:
 * the identity check needs the value from LOAD, and a closure is what carries it without
 * putting module-level mutable state between the two halves.
 *
 * Answers a no-op when there is no global to claim, which is not defensive padding — it is
 * what happens if the editor's Konva import ever becomes lazy, and a no-op disposer is the
 * honest response to "there was nothing of ours here".
 */
export function claimKonvaGlobal(): () => void {
	// `window` and not `globalThis`, for the reason `pdfRaster.ts` records: they are the
	// same object in every environment this runs in, and the obsidianmd ruleset refuses the
	// second spelling — a marketplace gate the review bot runs with its own configuration.
	const host = window as unknown as Record<string, unknown>;
	const claimed = host[KONVA_GLOBAL];
	if (claimed === undefined) return () => undefined;
	return () => {
		if (host[KONVA_GLOBAL] === claimed) delete host[KONVA_GLOBAL];
	};
}

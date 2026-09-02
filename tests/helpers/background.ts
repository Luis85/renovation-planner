import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';

/**
 * A vault with nothing in it — enough for any subject whose background reference is `null`.
 *
 * Its OWN module rather than a member of `tests/helpers/editor.ts`, where it started life:
 * that file imports Konva, vue-konva and `PlanEditorRoot`, and the designer suites that need
 * a `BackgroundVault` have no business dragging the whole plan editor in behind one triple of
 * inert answers. This module imports a TYPE and nothing else.
 *
 * A FUNCTION rather than a shared constant, because two leaves can mount concurrently in one
 * file and a shared object is a shared identity: a spy planted on one leaf's copy would be
 * read by the other's.
 *
 * **It is the honest stand-in only where the reference is `null`.** A case that means to draw
 * a real sheet has to answer `getAbstractFileByPath` with a `TFile` and `getResourcePath` or
 * `readBinary` with something decodable — `tests/presentation/editor/background.test.ts`'s own
 * `fakeVault` is the worked example, and it is deliberately not generalised here: it registers
 * bytes with the canvas helper's resource registry, which is a fixture concern rather than a
 * helper one.
 */
export function emptyBackgroundVault(): BackgroundVault {
	return {
		getAbstractFileByPath: () => null,
		getResourcePath: () => '',
		readBinary: () => Promise.resolve(new ArrayBuffer(0)),
	} as unknown as BackgroundVault;
}

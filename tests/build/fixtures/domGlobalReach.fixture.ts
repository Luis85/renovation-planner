/**
 * The DOM reach itself, isolated in its own module.
 *
 * `indirectDom.fixture.ts` imports this rather than inlining the reach, so the violation
 * crosses a real module boundary — the shape a per-file `no-restricted-imports` rule could
 * plausibly have been asked to follow (an import chain) rather than a same-file helper
 * function, which such a rule sees just as clearly as an inline expression: nothing about
 * wrapping a bare identifier read in a locally-called function crosses any boundary an
 * import-scanning rule inspects.
 */
declare const document: { title: string };

/** Evaluated when the importer calls it — but the reach itself lives one hop away. */
export const reachDocument = (): string => document.title;

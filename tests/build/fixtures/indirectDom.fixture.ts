/**
 * A `domain`-shaped module reaching a DOM global INDIRECTLY — through a helper, with no
 * import of its own.
 *
 * This is the shape the per-file lint rule cannot see: `no-restricted-imports` reads
 * imports, and there is no import here to read. The node default environment is what
 * catches it, at module evaluation, which is why SDD §8 counts the environment as one of
 * the two enforcement mechanisms rather than as a convenience.
 *
 * `*.fixture.ts` rather than `*.test.ts`: Vitest's `include` is `tests/**\/*.test.ts`, so
 * this is never collected, and `tests/build/spec-files.test.ts`'s naming rule bans
 * `.spec.ts` rather than this extension.
 *
 * It shares a directory with Task 9's `brokenFake.fixture.ts`, which is why that task's child
 * vitest config names its own fixture EXACTLY rather than globbing `*.fixture.ts`: a glob
 * would collect this module too, and this module throwing at evaluation would put a second,
 * unrelated cause into a run whose whole purpose is discriminating one.
 */
// Unqualified, so bare node throws a ReferenceError naming `document` — a sharper
// discriminator than a TypeError about reading a property of undefined, which many
// unrelated fixture bugs could also produce.
declare const document: { title: string };
const reachDocument = (): string => document.title;

/** Evaluated at import, so importing this module under bare node throws. */
export const plantedTitle = reachDocument();

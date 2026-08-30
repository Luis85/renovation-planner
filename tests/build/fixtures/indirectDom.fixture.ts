/**
 * A `domain`-shaped module reaching a DOM global INDIRECTLY — through an IMPORTED helper
 * module, never naming a DOM global itself.
 *
 * This is the shape a per-file `no-restricted-imports` rule cannot rule out by reading THIS
 * file's imports alone: nothing here names `document`, `window` or any DOM identifier, and
 * `no-restricted-imports` has nothing here to flag. The reach is only discoverable by
 * following the import into `domGlobalReach.fixture.ts` and reading what THAT module does —
 * exactly the transitive case a per-file, single-module rule does not perform. (A same-file
 * helper function wrapping the same reach would NOT demonstrate this: a locally-called
 * function crosses no module boundary, and a rule that reads this file's imports sees a
 * same-file helper's body precisely as easily as it would see the reach inlined. The
 * violation has to live in a DIFFERENT module for "no import to read" to be true of THIS
 * file.) The node default environment is what catches it regardless, at module evaluation,
 * which is why SDD §8 counts the environment as one of the two enforcement mechanisms
 * rather than as a convenience — it does not need to see the reach at all, only to evaluate
 * the whole graph.
 *
 * `*.fixture.ts` rather than `*.test.ts`: Vitest's `include` is `tests/**\/*.test.ts`, so
 * this is never collected, and `tests/build/spec-files.test.ts`'s naming rule bans
 * `.spec.ts` rather than this extension. `domGlobalReach.fixture.ts` is named the same way
 * for the same reason.
 *
 * It shares a directory with Task 9's `brokenFake.fixture.ts`, which is why that task's child
 * vitest config names its own fixture EXACTLY rather than globbing `*.fixture.ts`: a glob
 * would collect this module (and its helper) too, and this module throwing at evaluation
 * would put a second, unrelated cause into a run whose whole purpose is discriminating one.
 */
import { reachDocument } from './domGlobalReach.fixture';

/** Evaluated at import, so importing this module under bare node throws — via the import. */
export const plantedTitle = reachDocument();

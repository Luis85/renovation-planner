import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosix } from './posix';

/**
 * Where this repository is, resolved from `import.meta.url` rather than from the working
 * directory: another test file in the same worker legitimately `chdir`s while it runs.
 *
 * It carries a TRAILING SLASH, because `new URL('../..', …)` produces one.
 * `prototypes-not-bundled.test.ts` builds a prefix out of it and re-appends the separator
 * rather than inheriting it, for the reason its own comment gives; nothing else here depends
 * on the slash either way, and `path.join` and a `cwd` both absorb it.
 *
 * **This module may not be imported by a test running under jsdom, and that is why `toPosix`
 * is NOT in it.** Measured rather than reasoned, after consolidating the two into one file
 * turned `tests/harness/fixture.test.ts` red: under `@vitest-environment jsdom`,
 * `import.meta.url` is still `file:///…/thing.test.ts`, but `new URL('../..', …)` off it
 * resolves to `http://localhost:3000/@fs/…` — so `fileURLToPath` throws "The URL must be of
 * scheme file" at MODULE SCOPE, before any case runs, for a file that only wanted to
 * normalise a separator. The split makes that structural: a pure string helper and an
 * environment probe are different things, and only one of them is safe to import anywhere.
 */
export const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** A repository-relative path with forward slashes — `toPosix` over `relative(REPO, …)`. */
export const repoRelative = (file: string): string => toPosix(relative(REPO, file));

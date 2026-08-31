import { sep } from 'node:path';

/**
 * Forward slashes on both platforms, for a path that came from the FILESYSTEM — a `readdir`
 * walk, a glob, `path.relative`, or a tool reporting where it looked. Every caller compares
 * against paths built from repository-relative literals, which are written with `/`.
 *
 * It was spelled out longhand at twelve sites and three of those had grown an identical
 * private `posix` helper, which is the shape this repository already has a rule against: a
 * question worth asking at one site is a FUNCTION, and the moment it is written out by hand
 * the count of places it is missing stops being knowable.
 *
 * `sep` and not a literal `'\\'`, and the difference is not cosmetic: a POSIX filename may
 * legally contain a backslash, and the literal spelling corrupts one where this leaves it
 * alone. Exactly one site in `tests/` keeps the literal and it is not an oversight —
 * `lint-edited.test.ts`'s `named()` parses a hook COMMAND out of `.claude/settings.json`,
 * which may carry the other platform's separators whatever platform is reading it, so `sep`
 * would be the wrong question there. `grep -rn "replaceAll('\\\\'" tests/` prints that one
 * line.
 *
 * Deliberately alone in this module, with no module-scope environment probe beside it, for
 * the reason `repo.ts` records: this one is imported from jsdom files and that one cannot be.
 */
export const toPosix = (file: string): string => file.replaceAll(sep, '/');

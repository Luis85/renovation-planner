# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

The rule: a dated `## [x.y.z]` section is added in the **same pull request** as every
version bump, as a **second commit** — `npm version` refuses a dirty tree. `[Unreleased]`
entries are added by the pull request that earns them, never invented at release time.

## [Unreleased]

### Added

- 29 further oxlint rules, named one at a time out of the categories left off as bundles:
  `eqeqeq`, `require-await`, `no-template-curly-in-string`, `array-callback-return`,
  `oxc/no-accumulating-spread`, `unicorn/error-message`, `unicorn/no-array-callback-reference`,
  `unicorn/prefer-node-protocol`, `import/no-duplicates`, `vitest/no-identical-title` and
  the rest, including three that are decisions about how code is written here
  (`typescript/no-non-null-assertion`, `no-param-reassign`, `no-use-before-define`).
  27 reported nothing when they were adopted. The two that did are fixed rather than
  configured away: `scripts/version-bump.mjs` was the only file of forty-two importing a
  builtin without the `node:` protocol, and `tests/build/encoding.test.ts` passed a
  function reference straight to `flatMap`.
- ESLint takes no inline configuration (`linterOptions.noInlineConfig`). A block comment
  reading `eslint no-restricted-syntax: off` used to turn the vault write boundary off in
  `src/` with `npm run check` still green — measured — and that rule is ESLint-only, so
  oxlint could not have backstopped it. The setting refuses the whole class rather than a
  spelling, and a comment that now does nothing is reported and fails `--max-warnings 0`.
- Inline lint suppressions are refused across the whole linted tree
  (`tests/build/suppressions.test.ts`). oxlint honours ESLint's directive spelling as well
  as its own, and the rules that police suppressions arrive with the Obsidian ruleset,
  which stops at `src/` — so a single comment used to turn a rule off in `tests/`,
  `scripts/` or a root config with nothing anywhere reporting it. The complementary half,
  a directive that silences nothing, is now denied by oxlint itself.
- oxlint lints the edited file after every Edit and Write (`scripts/lint-edited.mjs`, wired
  in `.claude/settings.json`), putting the findings in front of the agent in about 90
  milliseconds instead of at the next `npm run check`. It does not prevent or revert the
  edit — `PostToolUse` runs after the write — so exit 2 is chosen for being the code that
  reaches the agent rather than the user. It fails open on its own bugs, and it is not the
  gate: one file means it sees nothing cross-file and nothing ESLint owns.
- `scripts/` and the root config files now have the size and complexity budgets they had
  none of — ESLint's block reaches `**/*.ts` in `src/` only, and those paths are outside it.
  The numbers are the ones `src/` already lives under.
- oxlint runs beside ESLint in `npm run lint`, in milliseconds and before it. It covers the
  tree the type-aware Obsidian ruleset has to be held out of — `tests/`, `scripts/` and the
  root config files — and it found an unsafe optional chain there on its first run, plus
  two `toThrow()` calls asserting only that something threw. `.oxlintrc.json` records which
  categories are on and why the other four are not, and `tests/build/lint-scope.test.ts`
  asks oxlint which files it lints so a narrowed `ignorePatterns` fails the build instead of
  quietly shrinking the gate.

### Changed

- Build with Vite instead of esbuild, per the SDD's stack: single CJS bundle into `dist/`,
  a dev-server browser harness, and `@vitejs/plugin-vue` one line away when the first Vue
  component arrives.
- Layer import bans now name the SDD's layers (`core`, `domain`, `application`,
  `infrastructure`, `presentation`, `plugin`) and ban `vue`, `pinia`, `konva` and
  `obsidian` in the inner ones, which is the architecture test the SDD asks for (§76).
- Tests live in `tests/`, matching the SDD's proposed structure.

### Added

- A settings pane, built on Obsidian 1.13's declarative settings API so its contents also
  appear in the settings search. One setting for now — the unit system — and both ends of it
  are validated by the same function, so neither a hand-edited `data.json` nor a control can
  store a value the plugin does not recognise.
- The **Renovation project** workspace view, with a ribbon button and an `Open renovation
  project` command. Both call one activation function, which reuses the view's leaf instead
  of opening a second tab. The view draws the mount point a Vue app will take.
- `RELEASING.md`: the release procedure, and the live-vault sweep that belongs before the
  tag. The changelog rule it states is now checked (`tests/release/changelog.test.ts`).
- The release workflow now requires a green CI run on the exact commit and refuses one that
  `main` does not contain, refuses a tag already on another commit, and puts this version's
  changelog entry at the top of the release body (`scripts/changelog.mjs`).
- First coverage floors, from the first measurement worth ratcheting.
- `docs/setup/publishing.md`: the community-list submission path, the manifest rules a
  reviewer checks, and the recurring rejections.
- Every user-facing string goes through one pure lookup (`src/presentation/i18n/`),
  following Obsidian's own language via `getLanguage()` — English complete, German first,
  per-key fallback. The English table is linted for sentence case.
- A settings stub (`src/plugin/settings/`): `units` (metric/imperial), loaded first in
  `onload` per the SDD's order, merged pure over defaults. Deliberately no settings tab
  yet — an empty tab is a marketplace rejection; it arrives with the first setting a user
  has to change.
- The plugin's view hides Obsidian's view header (`styles/chrome.css`), scoped to this
  view's type; a test pairs the selector with the persisted type constant.
- Minimum Obsidian version raised to 1.13.0 (manifest, typings pin, and versions.json
  together).
- `npm run lint` now fails on warnings (`--max-warnings 0`) — the mobile-safety rule
  (`no-nodejs-modules`) reports as a warning, and `isDesktopOnly: false` is a promise —
  and lints `manifest.json` itself (`obsidianmd/validate-manifest`).
- A BOM gate (`tests/build/encoding.test.ts`) plus `.editorconfig`: a UTF-8 BOM in any
  tracked text file fails the suite, after a BOM'd manifest broke lint with an error
  pointing nowhere near the cause.

### Fixed

- The stylesheet assembler now accepts hyphenated partial names and CRLF-saved entry
  files (both failed the build with a false "does not import" message), counts the
  400-line cap without the trailing-newline off-by-one that made it 399, and fails
  LOUDLY on any `styles/index.css` line it cannot resolve — a rule authored in the entry
  file or a subdirectory import was previously dropped from the shipped sheet silently.
- `scripts/version-bump.mjs` refuses to run outside `npm version` instead of silently
  corrupting `manifest.json` and `versions.json`.
- The vault-write lint boundary now covers `modify`/`process`/`append`/`delete` (and the
  adapter's writes), not just `vault.create`; the SVG `cls` ban also catches a quoted
  key; layer bans also catch barrel imports; `core/` and `domain/` now ban DOM globals
  per SDD §3.4.
- CI runs `npm run check` verbatim instead of re-enumerating its steps, cancels
  superseded PR runs, and the audit job no longer installs dependencies `npm audit`
  never reads; the release workflow caches npm like CI does.

## [0.1.0] - 2026-08-22

### Added

- The project scaffold: build, lint, tests with coverage thresholds, dead-code analysis,
  the two-platform CI matrix, and the release workflow.

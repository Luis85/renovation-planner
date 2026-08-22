# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

The rule: a dated `## [x.y.z]` section is added in the **same pull request** as every
version bump, as a **second commit** — `npm version` refuses a dirty tree. `[Unreleased]`
entries are added by the pull request that earns them, never invented at release time.

## [Unreleased]

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
- The plugin's view hides Obsidian's view header (`styles/chrome.css`), scoped to this
  view's type; a test pairs the selector with the persisted type constant.
- Minimum Obsidian version raised to 1.13.0 (manifest, typings pin, and versions.json
  together).
- `npm run lint` now fails on warnings (`--max-warnings 0`) — the mobile-safety rule
  (`no-nodejs-modules`) reports as a warning, and `isDesktopOnly: false` is a promise —
  and lints `manifest.json` itself (`obsidianmd/validate-manifest`).
- A BOM gate (`tests/build/encoding.test.ts`) plus `.editorconfig`: a UTF-8 BOM in any
  file git can see fails the suite, after a BOM'd manifest broke lint with an error
  pointing nowhere near the cause.
- Release builds are MINIFIED and checked: the assembled `styles.css` now follows the
  build's minify switch (lightningcss, Vite 8's own CSS minifier), and the release
  workflow refuses any readable `dist/` asset. `test-build` and `--mode development`
  stay readable on purpose — that build exists to be debugged.
- `tr()` — `t` in the app's own language, resolved in ONE place instead of per call
  site; the view/ribbon icon is one exported constant (`RENOVATION_PROJECT_ICON`); the
  workflows' Node versions are test-pinned to the `engines` floor
  (`tests/release/manifest.test.ts`).

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
- The release CI gate paginates the check-runs list — a verify leg pushed off the first
  page by future workflows could previously be missed entirely, or a failed off-page leg
  overlooked — and the shipped-asset list is stated once (`RELEASE_ASSETS`) for both the
  attestation and the release, so a fourth file cannot ship unattested.
- The stylesheet assembler refuses a partial imported twice: the duplicate passed every
  gate and was concatenated twice, silently reordering the cascade.
- The vault-write lint boundary now exempts `src/infrastructure/obsidian/` — the
  sanctioned writer no longer trips the rule whose message names it as the sanctioned
  writer — with the shared SVG bans restated there per the flat-config override rule.

## [0.1.0] - 2026-08-22

### Added

- The project scaffold: build, lint, tests with coverage thresholds, dead-code analysis,
  the two-platform CI matrix, and the release workflow.

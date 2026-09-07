# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

The rule: a dated `## [x.y.z]` section is added in the **same pull request** as every
version bump, as a **second commit** — `npm version` refuses a dirty tree. `[Unreleased]`
entries are added by the pull request that earns them, never invented at release time.

## [Unreleased]

### Added

- Work and Quote recovery opens the actual saved source after failed read-back, including a newly created Quote and Undo across floors. Successful Retry restores keyboard focus when its warning disappears; source opening and retry never replay the write.

- Work and Quote dialogs return keyboard focus to the Project control when a refreshed row removes their opener, including a Quote becoming received or a peer deleting the edited record.

- Reference dialogs return keyboard focus to the originating Layers/Details control or width-recovery action when reflow hides their opener; cancellation preserves the saved reference.

- Recovery regression coverage: native cancellation after peer-deleted element edits, corrected Object geometry and Undo, retired leaf callbacks, and composed downstream repository fault boundaries. Structural edit/removal share one fresh-baseline recovery decision.

- Project Work: assign shared Trades and explicit start/end dates through the existing Work form, inspect floor and Room context, and return to the source Work with conditional Undo/Redo.
- Project quote comparison: shared Suppliers, precise decimal offer lines with explicit Work/catalogue scope, immutable received offers, separate revisions, and contextual return from Costs. Failed refreshes preserve draft text and successful writes; retries do not replay saved offers.

- Plan editor: canvas Enter finishes named element drafts and Backspace removes their last point through the existing guarded tool lifecycle; native form input and pending numeric drafts retain their own behavior.

- Plan editor: compact material rows, expandable cost groups that highlight their linked Work geometry, a photo gallery with selected metadata and phase controls, and persistent contextual navigation. Entering renovation details now uses the selected Room instead of restoring a previous wall.

- Plan editor: Add → Item creates a named Object from a numeric rectangle or outline, with native input validation, persistent draft text, precise editing and guarded history. All eleven Add entries now reach supported production tasks or contextual forms.

- Linked material documents reveal their spatial context; several targets within one Room use its aggregate view. Explicit marker navigation reopens Details in constrained layouts. Paused Area type controls retain keyboard focus and refuse changes.

- Plan editor: numbered material markers highlight source geometry and navigate to the same Inspector record. Explicit Work, cost, material, Decision and evidence links reveal their target while preserving a valid shared Room context.

- Plan editor: deleting a mixed wall/opening/Object/Path/Fence/Measurement selection uses one guarded transaction with impact confirmation and Undo/Redo; hosted openings and boundary references are handled together while independent Room outlines remain intact.

- Plan editor: Path, Fence and Measurement creation with numeric coordinates, snapping, selection, precise editing, movement and guarded Undo/Redo. Generic element geometry and canonical names participate in existing/intended renovation, material quantities and explicit Room contexts. Failed baseline reads preserve drafts for read-only retry; compensated retries retain the same creation identity.

- Align dragged Room rectangles to saved geometry with visible snap feedback; exact numeric edits remain available.

- Plan editor: Add → Note opens the selected Room’s Notes form. Notes remain ordinary vault files; Undo/Redo removes/restores the evidence link without deleting the note file.

- Plan editor: explicit Area name/type editing and numeric corner editing for existing Room/Area outlines, with conditional writes, previews and Undo/Redo. Add → Room offers a free-shape outline with native name and corner controls; switching from a completed rectangle preserves its outline and name.

- Plan editor: Project breadcrumb and Materials library actions reuse the existing workspace navigation paths. Contextual planning drafts preserve the selected source target and related record.

- Plan editor: planning read-back recovery retains the last valid projection, qualifies saved
  status, pauses unsafe writes/history and offers read-only retry from warnings and open drafts.
  Renovation Apply exposes its paused state to assistive technology while draft fields stay editable.
  EN/DE planning numbers preserve decimal precision and accept decimal comma or point.
  Relevant event bursts coalesce; linked evidence refreshes without recalculating the floor.

- Planning reliability: generated Review findings use one fresh planning baseline, and stale
  fully procured materials block generated shopping content. Evidence follows Plan-note renames
  after its index updates, and failed thumbnails recover when their linked resource changes.

- Plan editor: start an empty floor with rooms, a reference plan or an empty canvas. Prepare a
  vault image/PDF with page, crop and rotation, set scale by pointer or keyboard, then review
  opacity and locking. One compensated, version-checked command persists the reference and
  calibration with coherent Undo/Redo. Floor/layer settings reopen the configuration; plan
  schema v2 preserves legacy references without read-time note rewrites.

- Plan editor: selected rectangular Rooms aligned with the floor axes can be resized entirely
  by keyboard. An explicit dimension form previews changes, keeps the top-left corner fixed,
  and applies one conditional reversible update through existing geometry persistence.
  Other outlines are explained rather than converted; room/area creation remains unchanged.

- Plan editor: Area corners can be entered, corrected and removed entirely by keyboard in
  metres, including decimal comma and signed positions. Numeric input and mouse gestures
  share one temporary outline and reversible creation. Pending coordinates and saving block
  every completion route; existing explicit repetition and Select return are preserved.

- Plan editor: ordered multi-selection with numbered canvas badges, member focus, shared type
  and area summaries, and a persistent room/area list with an option for selection without
  modifier keys. Shift-click toggles membership; Alt-click cycles overlapping areas. Escape
  clears single and multiple selections from list, Inspector and rail controls after closing overlays.

- **The Asset catalogue is shared across the vault** (design slice 19, PRD §59 as amended on
  2026-08-26). An `Asset` carries no project id at all — the field, the `project:` frontmatter
  key, the event payload member, the index axis and the project-folder location are all gone —
  so one catalogue entry may be referenced from every project in the vault. Asset notes live
  under a new **library folder** setting (§83), defaulting to `Renovation/Library`, and
  `AssetRepository.listByProject` became `listAll`. The asset schema stays at version 1 and
  is redefined rather than bumped: no release has ever been cut, verified against the remote.
- **A library-folder migration**, reached from an action row in the settings pane: it
  validates the destination, moves every catalogue note with `fileManager.renameFile` so vault
  links survive, rebuilds the Project Index, and persists to `data.json` only then. A failure
  at any earlier step leaves the setting untouched and names what had already moved. The
  library row itself binds **no control**, deliberately: `setControlValue` writes on every
  change, so a control there would persist a folder with no notes moved and strand the
  catalogue at the old path.
- **§83's overlap rule**, through one predicate (`foldersOverlap` — symmetric, compared at the
  folder boundary, case-folded). Creating a project whose folder would overlap the library is
  refused, as is moving the library onto a project folder or onto itself. The third site §83
  names has no door — ADR-0013 derives a project's folder from where its note sits, so a user
  moves a project by dragging a folder — and it gets a **marker on the affected project's row**
  instead: a mark and a word, derived per read, so it clears the moment the folder does.
- **References grouped by project.** `ListRequirementsReferencing` answers one group per
  project rather than a flat list, carrying `projectName` and — only where two projects share a
  name, which nothing refuses — `projectPath`. A shared asset's references are no longer all in
  the project the user is looking at, so a bare count would read as a claim it cannot make.
- **`t(language, key, params?)` interpolates**, leaving an unmatched hole standing as `{name}`
  rather than blanking it: a visible hole is a bug report and an empty string is a silent one.
  Substitution is a single pass, so a substituted VALUE that itself contains a hole is left
  alone rather than filled in turn. `tr` forwards the third argument, and every existing
  two-argument call is unchanged. `de.ts` is now required to name the same holes as `en.ts` for
  **any** key, per key.
- The declared Node range is `^22.22.2 || ^24.15.0 || >=26.0.0`, and
  `tests/build/engines.test.ts` keeps it honest by comparing it against every installed
  package with npm's own `semver.subset`. `>=22` was already false before oxlint — `eslint`
  asks for `^22.13.0` and `jsdom` for `^22.22.2` — and raising the floor alone was still
  wrong at the top, because eighteen packages exclude Node 23 that an unbounded floor
  claims.
- 29 further oxlint rules, named one at a time out of the categories left off as bundles:
  `eqeqeq`, `require-await`, `no-template-curly-in-string`, `array-callback-return`,
  `oxc/no-accumulating-spread`, `unicorn/error-message`, `unicorn/no-array-callback-reference`,
  `unicorn/prefer-node-protocol`, `import/no-duplicates`, `vitest/no-identical-title` and
  the rest, including three that are decisions about how code is written here
  (`typescript/no-non-null-assertion`, `no-param-reassign`, `no-use-before-define`).
  27 reported nothing when they were adopted. The two that did are fixed rather than
  configured away: `scripts/version-bump.mjs` was the only file in the repository importing a
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

### Removed

- The refusal of a Zone and an Asset from different projects (`requirement.cross-project`, in
  `AssignAssetCommand` and its reversible adapter) and the asset half of
  `reference.cross-project-reassign`. Those pairings are what sharing MEANS. **The Zone half
  stays** — a Zone still belongs to one project — and both halves are asserted together, since
  an asymmetry read alone looks like an oversight. Each deleted refusal is replaced by its
  inverse as a positive assertion, because a deleted refusal otherwise leaves no test behind
  and nothing would notice the guard coming back.

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

- Keep Room rename/resize controls consistent with planning and unrecovered-write pauses, reload changed evidence thumbnails at the same resource path, and return keyboard focus into an already-open panel when its rail is activated again.

- Restore Room and reviewed wall selection handles and Select/Add in Renovate, using the existing geometry history while retaining read-only Review.
- Plan editor: editing or removing a wall that a peer has already deleted refreshes the displayed structure and refuses the obsolete action without writing.

- Discarding an added generic element removes its intended geometry and canonical label together; Undo restores both, and a peer revision refuses stale history without overwriting it.

- Planning and renovation dialogs keep busy native choices and actions focusable, refuse changes while saving, and retain the original draft values. Late save completion after closing a leaf does not reopen its form or move focus.

- Room naming, dimensions, outline and Area details dialogs return keyboard focus to a visible control after responsive reflow, including when the persistent Inspector opener becomes hidden.

- Preserve native Inspector/Layer controls, pending text, caret selection and focus while resizing the editor. A focused region opens automatically at constrained widths; close and Escape still return focus to the rail.

- Report unexpected query failures from planning, renovation and spatial draft retries while retaining the draft and keeping retry read-only; suppress late reports after the editor closes.

- Plan editor recovery retires obsolete spatial and Inspector reads when a newer refresh is queued, continues after obsolete read failures, reports detached refresh faults, and offers only Close when the Plan is missing.

- Open drafts distinguish an incomplete write from a failed refresh: source inspection and Cancel remain available, without offering a read retry that cannot repair partial writes.

- Evidence opened from a material or cost announces the same selected state it highlights; unlinked evidence stays unselected until explicitly focused.

- Keep the evidence-path draft editable during refresh recovery while blocking file writes and Apply; retain readable Room names in freshly generated Review notes, with ID fallback for missing Rooms.

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

# Releasing and community directory submission

## Cutting a release

The **Release** workflow builds the plugin and creates a GitHub release with `main.js`,
`manifest.json` and `styles.css` attached as individual assets. It runs on a tag push (the
tag named exactly the `manifest.json` version, no `v` prefix) or on a manual dispatch, which
reads the version straight out of `manifest.json` on the ref you name and creates that tag
itself.

**The release workflow builds rather than gates, and REQUIRES the gate rather than trusting
you to have run it.** Its own npm steps are `npm ci` and `npm run build`, so lint, the tests
and fallow are not re-run at publish time; CI is where those run, and before building
anything the workflow demands that run. It refuses, with a message naming the reason, when:

- the commit is not one `main` contains — which a dispatch on the wrong ref produces in a
  single click;
- CI did not conclude successfully on that exact commit. It **waits** for a run still in
  flight rather than refusing it, because `git push --follow-tags` pushes the branch and the
  tag together and this workflow starts while CI is still starting;
- the tag disagrees with `manifest.json`;
- that version already has a release;
- that version's tag already exists on a *different* commit — what a failed attempt leaves
  behind, since the tag is pushed before the workflow runs. `gh release create` would
  publish the tag's commit while attaching assets built from this one, so the two have to be
  the same commit or nothing else here applies to what gets published.

Nothing below asks you to check those first. That is the point: they were preconditions a
person had to remember and an agent had no way to discover, and they are now the workflow's
own refusals.

Three things are checked earlier than any of this, by the test suite, so they fail on the
pull request rather than at publish time: `manifest.json`, `package.json` and `versions.json`
agreeing; the `obsidian` devDependency being pinned to `minAppVersion` exactly; and this
version having a dated `CHANGELOG.md` section
(`tests/release/manifest.test.ts`, `tests/release/changelog.test.ts`).

The two built assets come from `dist/`, which is what `npm run build` writes — `main.js`
minified, and `styles.css` assembled from `styles/` by `styles-assemble.mjs`. The file to
edit is always the partial. `gh` uploads each asset under its basename, which is why
building into `dist/` costs nothing here and why Obsidian still finds the three names it
requires. Each asset also gets a signed provenance attestation, verifiable with
`gh attestation verify <file> --repo Luis85/renovation-planner`.

**The release body carries this version's `CHANGELOG.md` entry, and that is automated
rather than a step below to remember.** `gh release create` runs with both `--notes-file` —
the section `scripts/changelog.mjs` extracts for the tag being published — and
`--generate-notes`, which GitHub prepends the extracted entry ahead of: the body reads the
curated summary first, the auto-generated merged-PR list underneath. The extraction reads a
parsed Markdown tree rather than matching lines, so a `## ` inside a fenced block cannot end
the section early, and it **throws** — failing the workflow — if the manifest version has no
dated heading. `tests/release/changelog.test.ts` already keeps that state off `main`, so in
practice that only fires on a manual dispatch against an unusual ref.

### 1. Get the version bumped onto `main`

Skip this if the version files are already committed on `main` — the case for the **first
release** (this repository was authored at `0.1.0`), or for any later release where the bump
landed with some other merged change and only the tag is missing.

Otherwise bump it. This updates `package.json`, `manifest.json` and `versions.json` together
and commits them:

```bash
npm version patch   # or minor / major
```

`.npmrc` sets `tag-version-prefix=""`, so the local tag is named `0.1.1`, not `v0.1.1` —
Obsidian requires the published tag to match the manifest version exactly, and the workflow
refuses a mismatch as a second line of defence.

If `main` is a protected branch, `git push` to it is refused by GitHub itself and every
change goes through a pull request, version bumps included: push the commit to a branch,
open a PR, get CI green, merge. `npm version` also creates a local tag on the **pre-merge**
commit; that is not the tag to publish, because the merge commit is what lands on `main`.
Leave it alone rather than pushing it — step 3 creates the real one from `manifest.json` on
`main`.

**`npm version` does not touch `CHANGELOG.md`, and cannot be made to in one commit**: it
refuses to run against a dirty working tree, and its own `version` script stages only
`manifest.json` and `versions.json` before committing — so the changelog would either be
swept in uncommitted, failing the clean-tree check, or left behind. Edit it as a **second
commit right after**, in the same pull request: rename `## [Unreleased]` to
`## [<version>] - <date>` using the version `npm version` just wrote, and leave a fresh,
empty `## [Unreleased]` above it. This step only retitles and dates a section that already
has content — a pull request that changes what the plugin does adds its own bullet as it
merges. `tests/release/changelog.test.ts` is what makes that a check rather than a habit.

### 2. Before the tag: the live-vault sweep

Obsidian does not run in the jsdom harness and the browser harness answers no themed
vault's colours, so a set of things about this plugin can only be checked by a person in
Obsidian. Walk them **before** the tag: afterwards, the only thing a failure can produce is
a second release.

```bash
npm run test-build
```

That installs the plugin into `.obsidian/plugins/renovation-planner/` in this repository, so
the repository root opens as a vault — no second checkout, no symlink. On a vault's first
open, turn off Restricted Mode in Settings → Community plugins.

**There is no case catalog yet, so this step is currently a judgement call rather than a
list**, and that is the honest state rather than a gap to paper over. What to walk today:
every surface the release touches, plus these, which nothing automated here can see —

- the plugin loads with no console error, and unloads without leaving a view behind;
- each view opens, redraws after a workspace layout change, and survives a reload;
- appearance under a **community theme** and under both colour schemes, since the harness
  answers only Obsidian's defaults;
- anything using an Obsidian API this code assumes rather than exercises.

The source project makes this repeatable by keeping each check as a note under
`docs/tests/cases/` with a `## How to check` section and a `cadence:` (`release` or
`conditional`), queried from the register at release time rather than read from a checklist
in this file. Two rules from it worth adopting with the first note: **date each note's
`Outcome` with what was seen**, and **a check that has found nothing across two releases
gets reviewed, not retired** — what retires a check is evidence about its subject (the thing
is gone, or an automated test now watches it), never its hit rate. A sweep that drops its
quietest checks empties itself while reading as disciplined.

### 3. Cut the tag and publish

Once the version files are on `main`, this is the whole remaining step. Three equivalent
ways to trigger it, all of which read the version from `manifest.json` on the ref you name:

- From the browser: **Actions** → **Release** → **Run workflow** on `main`.
- From anything that can reach the API — `gh`, curl, or an agent session with the GitHub
  tools. Needs neither a checkout nor a browser, and takes no inputs:

  ```bash
  gh workflow run release.yml --ref main
  ```

  ```http
  POST /repos/Luis85/renovation-planner/actions/workflows/release.yml/dispatches
  {"ref": "main"}
  ```

  A dispatch returns no run id, so find the run rather than assuming it: list the workflow's
  runs, take the newest, and read its jobs or logs while it goes.

- Or push the tag yourself, reading it from the manifest rather than typing it. Branch
  protection on `main` does not cover tags, so this succeeds where pushing to `main` does
  not. Pull the merged `main` first — if step 1 ran in this same clone, `npm version` left a
  local tag of this name on the **pre-merge** commit, and `git tag` refuses to reuse a name
  without `-f`:

  ```bash
  git fetch origin main && git checkout main && git merge --ff-only origin/main
  tag="$(node -p "require('./manifest.json').version")"
  git tag -f "$tag" && git push origin "$tag"
  ```

  `-f` only ever moves the LOCAL ref onto the commit just checked out; the push after it is
  a plain, non-forced push of a name that does not exist on the remote in the normal case,
  so it fails safely rather than overwriting anything. The dispatch path above sidesteps all
  of this — it never touches a local tag.

What proves it worked is the release, not a green run: on the releases page, the tag name
**exactly matches** the version in `manifest.json` (`x.y.z`, no `v` prefix) and all three
assets — `main.js`, `manifest.json`, `styles.css` — are attached.

Publishing is public and a release cannot be un-published without deleting it, so an agent
session should have been **told** to release, never infer it from a merged pull request.

## Community directory submission

The first release is a precondition for this, not the other way round: the directory entry
points at a repository that already has one. The steps, what a reviewer rejects, and the
manifest rules a reviewer checks are in
[`docs/setup/publishing.md`](docs/setup/publishing.md).

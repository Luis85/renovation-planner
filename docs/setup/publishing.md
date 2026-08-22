# Publishing to the community plugin list

The one-time submission that makes releases installable from inside Obsidian, and the
things a reviewer sends back. `RELEASING.md` covers cutting a release; this note starts
where it ends.

## The path

1. **A release exists first.** The directory entry points at a repository that already
   has a GitHub release whose assets are `main.js`, `manifest.json` and (because this
   plugin ships one) `styles.css`, under a tag equal to the manifest version with no `v`
   prefix. `RELEASING.md` is the procedure.
2. **Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)**
   and append one entry to `community-plugins.json`: `id`, `name`, `author`,
   `description`, `repo`. The `id` must equal `manifest.json`'s and never changes again —
   installed vaults key the plugin's folder and settings on it.
3. **Open the pull request** using its template. A bot validates the manifest and entry
   first; a human review follows. Address findings by pushing to the same branch.
4. After the merge, the plugin appears in the community list, and every later release is
   picked up from the tags alone — the submission is not repeated.

## Manifest rules a reviewer checks

- `id`: lowercase, no spaces, must not contain `obsidian` or end in `-plugin`, and must
  match the entry in `community-plugins.json`.
- `name`: must not contain `Obsidian` or start with it; no `Plugin` suffix.
- `description`: short, ends in a period, no special characters or markup, does not
  start with "This plugin" or repeat the name.
- `author` / `authorUrl`: `authorUrl` must not point at the plugin repository itself.
- `minAppVersion`: the real floor, not a guess — this repository pins the `obsidian`
  devDependency to exactly that version so the compiler refuses newer API
  (`tests/release/manifest.test.ts` holds the pairing).
- `version`: semver, matching the release tag exactly (no `v` — `.npmrc` sets
  `tag-version-prefix=""`).

## The recurring rejections

The ones `npm run lint` (eslint-plugin-obsidianmd) already refuses, kept here so the list
survives a lint-config change: sentence-case UI text in command names and settings, inline
styles instead of CSS classes, missing `normalizePath` on user-supplied paths, the global
`app` instead of `this.app`, and detaching leaves in `onunload` (it destroys the user's
layout — this repo's view empties `contentEl` instead).

The ones only review catches:

- Work in `onload` beyond registration — "register, do not scan"; startup cost is paid by
  every user on every launch.
- Listeners or intervals registered outside `this.register*`, which the `Plugin` base
  class cannot then clean up.
- Console noise: logging that is not an actual error path.
- Placeholder or repository-template text left in the README, or a README that does not
  say what the plugin does.
- Network calls or telemetry the README does not disclose.

When a rejection recurs that this list does not name, add it here in the same change that
fixes it.

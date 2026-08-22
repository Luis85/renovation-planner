# Renovation Planner

An Obsidian plugin that plans a renovation as a work breakdown of rooms, trades and tasks,
with budgets and a schedule.

> Early scaffold. The build, the quality gates and the release pipeline are in place; the
> capability itself is not built yet. The target architecture is
> [`docs/sdds/obsidian-renovation-planner-SDD.md`](docs/sdds/obsidian-renovation-planner-SDD.md).

## Installation

Not yet in the community plugin list. To try the current build:

```bash
npm install
npm run test-build
```

That writes the plugin into `.obsidian/plugins/renovation-planner/` in this repository, so
you can open **this folder as a vault** in Obsidian and look at it. On a vault's first open,
turn off Restricted Mode in Settings → Community plugins.

## Development

```bash
npm run check        # the definition of done: build + lint + coverage-thresholded tests + dead code
npm run dev          # watch build
npm run test:watch   # watch tests
npm run harness      # the view in a browser, with Obsidian's own app.css and no Obsidian
npm run test-build   # build into the vault in this repository and look at it in Obsidian
```

`npm run harness` starts a Vite dev server and draws the real view against the real
stylesheet **and Obsidian's own app.css**, so what you see is Obsidian's default appearance
— `?theme=light` and `?phone` switch the body classes the app sets, and editing a partial
reloads the page. It answers markup, spacing, hierarchy and default colours. It cannot
answer a themed vault's colours or anything Obsidian hands the view at runtime, so it
replaces no live-vault check.

`npm run check` is what CI runs, on Ubuntu and Windows. Nothing merges without it.

- [`CLAUDE.md`](CLAUDE.md) — the working agreement: layers, gates, and the rules that hold.
- [`docs/setup/quality-harness.md`](docs/setup/quality-harness.md) — what each gate refuses,
  and how to rebuild it elsewhere.
- [`docs/README.md`](docs/README.md) — the backlog in `docs/`: what each folder holds, what
  each kind of note says, and what is not enforced.
- [`RELEASING.md`](RELEASING.md) — cutting a release, and the live-vault sweep before the tag.
- [`docs/setup/publishing.md`](docs/setup/publishing.md) — the path to the community plugin
  list, and what the review rejects.

Vite builds into `dist/` (gitignored), which is what `test-build` copies and the release
uploads. Edit a partial in `styles/`; `scripts/styles-assemble.mjs` assembles them, and the
build fails on a partial no entry file imports or one over the 400-line cap.

## License

MIT — see [LICENSE](LICENSE).

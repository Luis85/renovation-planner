---
type: Test suite
order: 220
sources:
  - SDD §11
  - SDD §60
  - SDD §91
status: Ready
---
# Smoke Test the Editor

The cases that can only be run **by a human, inside Obsidian**. Everything here exists
because `npm run check` cannot see it.

That is not a general claim about manual testing being valuable; it is the specific record
of what this project's four gates missed. Design slice 5 shipped with all thirteen of its
Definition-of-Done items verified by the suite and by `npm run harness-shot`, and **none of
them had ever been seen in the app**. The first walkthrough found four defects in a row,
every one of them green in 869 tests:

| What broke in the vault | Why no gate saw it |
| --- | --- |
| Creating a plan reported a failed migration | `FakeMetadataCache` parsed the vault synchronously; Obsidian's `MetadataCache` is asynchronous, so a note read back in the tick it was created has no cache entry |
| The geometry sidecar could not be created | `FakeVault.create` accepted a path whose parent folder did not exist; Obsidian refuses one, and nothing creates `Geometry/` |
| Reactivating the plugin logged `Several Konva instances detected` | Konva assigns `window.Konva` at module scope on every load and nothing released it on unload |
| A restored Plan Editor said "This plan no longer exists" | Obsidian restores leaves BEFORE `onLayoutReady`, and the index scan runs FROM it, so the view hydrated against an empty index |

Three of those four are the same defect wearing different clothes: **a test fake that
accepted what Obsidian refuses.** That is the thing to be suspicious of when a case here
fails and the suite disagrees.

## Running it

```bash
npm run test-build      # builds into .obsidian/plugins/ — this repository IS a vault
```

Then open this folder as a vault (or reload it if it is already open) and work through the
cases below. Two of the steps need real files, both in
[`docs/tests/fixtures/`](../fixtures/):

- `editor-background-png-test.png` — redraw it with `npm run background-fixture`. It is
  generated rather than hand-made so that what it asserts is reviewable as code;
  `scripts/background-fixture.mjs` says what every mark on it is for.
- `editor-background-pdf-test.pdf` — a real printer-driver PDF (Chrome's "Print to PDF"),
  carrying the compression, embedded fonts and image a minimal fixture does not.

**These are the vault's copies, and they are yours to move.** Both files also exist in
`tests/fixtures/`, and that is where the automated check
(`tests/presentation/editor/committedFixtures.test.ts`) reads them from — never from here.
`docs/` is user land: reorganising it while working in Obsidian must not turn a test red,
which it would if the suite depended on these paths. `npm run background-fixture` writes the
PNG to both places, so the two cannot drift; the PDF has no generator, so it is simply
tracked twice.

The automated check does not replace the walkthrough. It exists so a walkthrough never
begins with a fixture that has quietly stopped decoding.

## What to do with a failure

Record it in the case, then treat it as a defect of the slice that owns the surface rather
than of the walkthrough. Every defect above was fixed in the slice that shipped it, and the
fix carries a test that fails without it — a manual case whose findings are not converted
into an automated check will find the same thing again next release.

## Cases

- [[Editor Walkthrough]] — design slice 5's Definition of Done, end to end.
- [[Zone Editing Walkthrough]] — design slice 8's Definition of Done: draw, select, move,
  reshape, delete, and every undo of those, by hand.

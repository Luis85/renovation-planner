---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 120
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Ten captures land in a folder nothing opens

`npm run harness-shot` is the tool built for looking, and looking at what it produces means
opening PNGs one at a time out of a gitignored directory.

## The question

The command writes ten fixed captures — the project view dark, light and `?phone`; the Plan
Editor in both schemes; the harness index at rest in both schemes, focused, and showing its
failure card — into `harness-shots/`, which `.gitignore:14` excludes. Given an entry id it
writes two instead, one per colour scheme.

Nothing then presents them. There is no contact sheet, no index, no side-by-side. The pairing
the tool exists to support is *this scheme against that one*, and it is delivered as two files
in a folder.

**This is about looking, not about checking**, and the distinction is the parent note's:
*Asserting anything about what a prototype draws* is explicitly out of scope there, and
`harness-shot.mjs`'s own header says the same — "it draws; it asserts no appearance, and there
is no baseline to diff against". Nothing here asks for that to change.

## What is true today

- Ten fixed shots, measured off `scripts/harness-shot.mjs`. Every one has to be opened
  individually to be judged.
- The filenames already carry what a sheet would need to lay them out: the surface, the scheme,
  and for an entry a readable name, a digest and the width — `entryShots.mjs` puts the width in
  the name deliberately, "two captures of one entry at two widths are two different pictures".
- The tool is honest about being outside every gate, and correctly so. It exits non-zero on a
  page error or an unknown entry id — verified: `npm run harness-shot -- prototype:NoSuchThing`
  exits 1 naming the missing entry — but that is a claim about the page not falling over, never
  about how it looks.
- **The instrument has earned its keep ten times**, per `CLAUDE.md`'s capture ledger, and five of
  those came from one review of the harness index. Every one was found by a person opening a PNG
  and looking at it. The ergonomics of that step are the whole cost of using the tool.

## The alternatives

- **Leave it.** Ten files is not many, and a designer who wants two of them side by side has an
  operating system. The honest counter-argument, and it is why this is an Issue rather than a
  Task.
- **Write a contact sheet into the folder** — one generated `index.html` listing every PNG the
  run produced, schemes paired, entry captures grouped. It ships nothing, it asserts nothing, it
  is gitignored with the images, and it makes the pairing the tool is *for* the default view.
  The filenames already carry the grouping keys.
- **Stop gitignoring the folder.** Rejected here rather than left implicit: committed PNGs are a
  baseline by accident, and a baseline nothing diffs is worse than none — it reads as agreed.
  It would also put binary churn into every design round.
- **Print the paths on completion.** The cheapest of the three real options, and the one that
  helps least: knowing where the files are was never the difficulty.

## Why it matters

The five defects the index review found were spacing, row height, a contrast value no source
file contains, an undeclared class and a selector reaching past its subject. `CLAUDE.md` states
why no gate here can see any of them: "anything whose symptom is a measurement no layout engine
performs — spacing, wrapping, overflow, contrast, hit size — is outside every gate this
repository has, and a capture read by eye is the only instrument here that reaches it".

If the only instrument for a whole class of defect is a person looking, then how easily a person
can look is not a nicety — it is the throughput of that instrument.

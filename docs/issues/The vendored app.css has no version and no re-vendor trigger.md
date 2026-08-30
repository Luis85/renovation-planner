---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 110
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The vendored app.css has no version and no re-vendor trigger

Every judgement the harness supports rests on `tests/harness/obsidian.css`, and nothing records
which Obsidian it came from or when it stopped matching one.

## The question

The harness's claim is that a designer sees the thing that will exist. Half of that is the
plugin's own assembled stylesheet, which is the real one. The other half is Obsidian's
`app.css`, vendored here — and it is vendored twice removed:

> VENDORED into this repository from the product-backlog-view harness, unchanged. The reduction
> below was derived from THAT plugin's driven states, so a rule this plugin needs and that one
> never exercised is absent.

So the sheet is a **reduction of another plugin's needs**, and its own header names the failure
mode: an element default this plugin leans on can be missing here and present in a vault. The
recipe for re-deriving it is in the header. What is missing is anything that says *when*.

## What is true today

- **The one version marker it carries is already stale.** The header says: "the closest markers
  this repo has are `manifest.json`'s `minAppVersion` (1.12.0, a floor) and the `obsidian` npm
  typings pinned in `package.json` (1.12.0 exactly)". Both are **1.13.0** today —
  `manifest.json:5` and `package.json:47` — and `CLAUDE.md` states the pairing as a rule ("Raise
  both or neither"), with `tests/release/manifest.test.ts` holding it. The vendored sheet was
  outside that rule and drifted quietly.
- Obsidian does not record its own version inside `app.css`, so there is nothing to read even if
  somebody looked. The source is a local install, and it is deliberately not committed —
  "Source size before reduction: 21673 lines, 634971 bytes".
- The reduction is what makes the harness page cheap and what makes it approximate.
  `CLAUDE.md` already refuses to call it faithful: it is faithful about markup, spacing and
  hierarchy and about Obsidian's **default** colours, and "not faithful about a themed vault's
  colours, its accent, or any element default the vendored sheet's reduction dropped".
- Something has already been paid for this. The harness collapsing to a sliver of its pane
  (design slice 1) was a missing nesting in the leaf chrome, and three of slice 5's four capture
  defects were about colour resolution — the class of thing a reduced host sheet is least able
  to warn about.

## The alternatives

- **Do nothing, and rely on the header.** What happens today. Its cost is that the drift is only
  ever found by the symptom — a layout that reads right here and wrong in a vault — which is the
  most expensive place to find it.
- **Record the provenance and pin it to the floor.** Write the Obsidian version the sheet was
  taken from into the header, and add it to what `tests/release/manifest.test.ts` already holds
  together, so raising `minAppVersion` is what forces the question. Cheap, and it converts a
  silent correlate into a gate. It does not make the sheet correct — it makes going stale
  *visible*.
- **Re-derive from this plugin's own driven states.** Removes the "another plugin's needs" half
  entirely. Much larger: it needs a local `app.css`, a driving pass over this plugin's surfaces,
  and a rule for what counts as exercised.
- **Stop reducing and vendor the whole sheet.** 635 KB and 21,673 lines in the repository,
  against a harness page that is already outside `npm run check`. Refused on size, and worth
  naming so the reduction reads as a decision rather than an accident.

## Why it matters

This is the harness's own version of the rule this repository states everywhere else: a fake
must not be kinder than the real thing. `tests/helpers/obsidian-mock.ts` has produced that
lesson four times, and each time the fix was to make the fake refuse what Obsidian refuses.

The vendored sheet is the same kind of stand-in and the only one with no mechanism at all
behind it — not a test, not a lint rule, not a version. **The measurement above is the argument:**
the header's own version correlate went stale without anybody noticing, in a repository that
gates the same pairing everywhere else.

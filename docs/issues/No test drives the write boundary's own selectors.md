---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 80
status: Done
started: 2026-08-26
finished: 2026-08-26
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

# No test drives the write boundary's own selectors

Found while building the prototyping harness, and not about it — filed here rather than lost,
with that provenance stated.

## The question

`WRITE_BOUNDARY` in `eslint.config.mjs` is a set of `no-restricted-syntax` selectors refusing a
vault write from anywhere but `infrastructure/`. It is one half of the architecture's
enforcement — the layer bans keep `obsidian` out of the inner layers, and these selectors catch
the case those bans cannot see: a write from a view, a Bases adapter or the composition root.

The string `WRITE_BOUNDARY` appears in three files: the config that defines it, and two `src/`
files whose comments cite it. **No test drives it.** Nothing anywhere feeds the rule a
violating snippet and asserts it reports, so the selectors' reach is a claim rather than a
measurement — and a selector that silently matches nothing looks exactly like a codebase that
never violates the rule.

The config is honest about which spellings its selectors see and which they cannot, which is
the right shape. That documentation is not the same as evidence that the ones it claims to see
actually fire.

## What is true today

- The neighbouring claims about the linters *are* tested: `tests/build/lint-scope.test.ts` asks
  oxlint which files it lints, `tests/build/suppressions.test.ts` scans for directives,
  `tests/build/logging-carve-out.test.ts` pins the obsidianmd wrapper against ESLint's own
  message text. The pattern for testing a lint rule from the suite is established here.
- `linterOptions.noInlineConfig` means no comment can turn the rule off, so the exposure is a
  selector that stops matching, not one that gets suppressed.

## What closed it

`tests/build/write-boundary.test.ts` — sixteen cases through `lintText`, which resolves the
real flat config for a path without writing anything, so a deliberately-offending fixture never
lands under `src/` where it would fail `npm run lint` for the whole repository.

Four groups, because the rule can fail in four different directions:

- **Every selector reports.** Frontmatter, a vault write through a property and through a local
  named `vault`, an adapter write both ways, and both halves of the local-storage pair.
- **The sanctioned directory still writes.** Without this the suite could not tell a working
  boundary from one that refuses everything everywhere — a state that fails the build, but only
  once someone writes the next repository method.
- **Reads are not writes**, including a method whose name merely starts the same way.
- **The two blind spots the config declares in prose**, pinned as absences: a differently-named
  alias and a destructured method. Writing down that they escape is not an endorsement; it is
  what stops the next reader believing the rule covers a spelling it cannot see.

Plus the extension list, which went stale once already — the glob named only `.ts` and `.vue`
after `SRC_EXTENSIONS` grew, so a `.js` file was covered by every layer ban and still bypassed
this boundary. A `.js` case and an SFC case pin the two that are easy to forget. Narrowing the
glob back to `.ts` reds exactly those two; neutering a selector reds exactly its own cases.

One constraint worth recording, since it cost a first draft: the `.ts` blocks are type-aware,
so a virtual path with no file behind it cannot be parsed and `lintText` answers `PARSE_ERROR`
— which contains no rule id and would have read as "the boundary said nothing" in every
negative case. The probes borrow real paths instead.

## Why it matters

- This is a category invariant checked at the forbidden thing, which is the strong form this
  repository asks for everywhere. The instrument implementing it has never been tested, and the
  rule is that you test the instrument first.
- The failure mode is quiet in the worst way: the gate stays green while enforcing nothing.

---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 80
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

## What closes it

A `tests/build/` case that runs ESLint's API over a fixture snippet per selector — one that
must report, and one near-miss that must not — in the shape `logging-carve-out.test.ts`
already uses. A rewritten selector, or an AST shape changing under a TypeScript upgrade, then
fails at `npm run check` instead of at the review that notices the vault got written from a
view.

## Why it matters

- This is a category invariant checked at the forbidden thing, which is the strong form this
  repository asks for everywhere. The instrument implementing it has never been tested, and the
  rule is that you test the instrument first.
- The failure mode is quiet in the worst way: the gate stays green while enforcing nothing.

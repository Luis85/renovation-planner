---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 170
status: New
started: ""
finished: ""
horizon: Next
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

# A raised maxCrap ceiling may only fall, and one command already sits at it

`.fallowrc.json`'s `health` section pins fallow's coverage-weighted CRAP threshold
(`maxCrap`) via the `health.maxCrap` key, following the same ratchet-only-rises-or-here-falls
policy as the coverage floors elsewhere in this repository — a ceiling here may only fall, not
rise, once set. At this branch's HEAD, `.fallowrc.json` carries no `maxCrap` key at all and
`fallow` is pinned to `^3.19.0`; the dependabot branch `dependabot/npm_and_yarn/*` (not this
one) raises fallow to 3.22.0, which reports one of that file's `undo` methods at a CRAP of
31.6 (cyclomatic complexity 10) — over a 30 ceiling, forcing that PR to raise `maxCrap` to 32
to land. The file carries two `undo` methods on two sibling command classes, each with its own
`lastWritten(assetId) ?? inverse.preVersion` fallback arm no test can take on its own.

## What is true today

On this branch (`283b18b0`), the finding does not yet exist: fallow 3.19.0 is installed and
`health.maxCrap` is unset. This note records what closing PR #78's temporary widening requires
once it lands, so the widening does not quietly become permanent.

## What closes it

Once the dependabot branch merges and `health.maxCrap` reads 32: refactor
`ReversibleAssetDesignCommands.undo` to remove or make testable its two `?? preVersion`
fallback arms (reducing cyclomatic complexity, or adding the case that exercises each arm), then
lower `health.maxCrap` back to 30. The PR that raised it (#78) is where the temporary value is
recorded.

## References

- [[Errors, diagnostics and the test harness]]
- `.fallowrc.json` — the `health` section this ceiling lives in.
- `src/application/editor/asset/ReversibleAssetDesignCommands.ts` — the two `undo` methods
  (lines ~296, ~373) each carrying a `?? inverse.preVersion` fallback arm.

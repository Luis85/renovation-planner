---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 180
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

# no-use-before-define no longer checks function declarations

`.oxlintrc.json` at this branch's HEAD carries `"no-use-before-define": "error"` with the
default (whole-rule) configuration, under oxlint 1.80.0. The dependabot branch
`dependabot/npm_and_yarn/*` (not this one) raises oxlint to 1.81.0 (PR #77), which changes the
rule's default to no longer check function DECLARATIONS — only function expressions and other
bindings — so five `scripts/*.mjs` helpers that are called above their own declaration (hoisted
function declarations, legal JavaScript and previously flagged as a style rule) stop being
caught the moment that upgrade lands, unless the object form (`{functions: false}` is the
oxlint 1.81 default; the repository would need `{functions: true}` to keep the old check) is
set explicitly.

## What is true today

At `283b18b0`, oxlint is 1.80.0 and the rule still checks function declarations under its
current default — the gap this note describes does not exist yet on this branch.

## What closes it

Once the dependabot branch merges: reorder the five `scripts/*.mjs` helpers above their
callers (the fix the brief names, keeping the code readable top-down regardless of what the
rule enforces), and set the rule's `functions` option back to `true` in `.oxlintrc.json` so
declarations are checked again — turning the arm back on rather than accepting the quieter
default.

## References

- [[Errors, diagnostics and the test harness]]
- `.oxlintrc.json` — `no-use-before-define`'s current (whole-rule) configuration.

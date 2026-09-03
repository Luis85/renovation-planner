---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 80
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The manual keymap claim points to a step that never invokes the keymap

## The question

[[Operate the Add menu by pointer and keyboard]] says Obsidian's own keymap is outside jsdom and
that step 6 of [[Open a floor and select a room]] is the instrument
(`docs/tasks/Operate the Add menu by pointer and keyboard.md:53-55`). The manual case makes the
same claim, specifically naming `Ctrl+P` and a command palette opening over the menu
(`docs/tests/cases/Open a floor and select a room.md:37-42`).

Step 6 is marked `browser` and asks only to open Add, navigate with
ArrowDown/ArrowUp/Home/End, and close with Escape
(`docs/tests/cases/Open a floor and select a room.md:72`). It never presses `Ctrl+P`, invokes an
Obsidian keymap or observes a stacked command palette.

## What is true today

- Searching the case for `Ctrl+P` finds only the explanatory claim at line 40; the step table
  contains no keymap gesture.
- Step 6 can verify menu rendering and browser focus, but a browser harness has no Obsidian host
  keymap to invoke. Its `browser` reachability verdict contradicts the stated reason a live vault
  is required.
- The task is Done and its closing evidence points to this absent manual action as coverage.

## Why it matters

The unresolved question is whether Obsidian opens another interactive surface over Add or
swallows the shortcut. The named evidence performs neither branch, so a host-keymap conflict can
remain unobserved while the task records it as assigned to a manual check.

## What closes it

Add an `obsidian`-reachable step that opens Add, presses `Ctrl+P`, records whether the command
palette opens and verifies focus and Escape behavior after dismissal. Point the task's closing
evidence to that step. The discriminating evidence is an actual keymap invocation, not another
menu-navigation assertion; amend the current task evidence until it exists.

## References

- `docs/tasks/Operate the Add menu by pointer and keyboard.md:53-55`
- `docs/tests/cases/Open a floor and select a room.md:37-42,72`
- `src/presentation/editor/add/AddMenu.vue:27-31,292-295`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 4.

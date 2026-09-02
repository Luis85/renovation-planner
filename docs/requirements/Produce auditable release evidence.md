---
type: PBI
parent: "[[Release hardening]]"
order: 80
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Reload the editor without losing room data]]"
  - "[[Recover safely from failed writes and stale reads]]"
  - "[[Use the editor in Obsidian themes and constrained layouts]]"
  - "[[Detect and explain unhealthy vault data]]"
  - "[[Operate the released editor without a pointer]]"
  - "[[Present complete homeowner language in English and German]]"
  - "[[Meet editor performance and cleanup budgets]]"
---

# Produce auditable release evidence

## Quality outcome

A release reviewer can trace every applicable M00–M17 criterion to current automated evidence,
manual evidence, a recorded defect, or an explicit not-applicable decision.

## Main flow

1. The release candidate fixes the commit, build, fixtures, host version, and test environment
   being assessed.
2. Every screen criterion and Release hardening PBI is entered in a traceability record.
3. Automated checks run and attach their exact result.
4. Live-vault checks run for Obsidian behavior, rendering, themes, real input, assistive
   technology, performance, and homeowner comprehension.
5. Failures become defects or explicit release blockers.
6. A reviewer signs the evidence and records the release decision.

## Extensions

- **3a** — An automated check cannot prove the user-visible claim. It is labelled supporting
  evidence and paired with a manual check; it is never presented as complete proof.
- **4a** — A manual check is skipped. Its criterion remains unverified and cannot silently pass.
- **5a** — A defect is accepted. The decision names impact, scope, owner, and revisit trigger.
- **6a** — Evidence was produced against another build or environment. It is stale and rerun.

## Guarantee

Automated and manual evidence remain visibly separate, identify the exact release candidate they
cover, and leave no applicable acceptance criterion implied by a green aggregate.

## Acceptance criteria

1. Every applicable M00–M17 criterion has a resolvable evidence entry.
2. Automated results identify commands, test names, fixtures, and build identity.
3. Manual records identify host/theme/input/assistive-technology context, steps, observer, date,
   and result.
4. Skipped, failed, and not-applicable checks are distinguishable from passes.
5. Migration/recovery/backup guidance, user documentation, and release notes are reviewed.
6. The release decision states whether any critical accessibility, theme, data-loss, or
   vault-health defect remains.

## Assumptions

- A screenshot is visual evidence, not proof of keyboard or screen-reader behavior.
- Aggregate quality gates do not replace criterion-level traceability.
- Manual evidence is intentionally required where repository automation cannot host Obsidian or
  reproduce human comprehension.

## Sources

Phase 12, testing strategy, and per-screen done criteria in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md);
WP8 in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
M00–M17 screen specifications.

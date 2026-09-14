# RemPlanner adoption program

Research and dispatch package, 2026-09-14. Baseline: `836399775e91ccf05e44959b6bea9960605defbb`, branch `codex/usability-astra-main-refresh-polish`, [PR #209](https://github.com/Luis85/renovation-planner/pull/209), including integration branch `origin/main` at `acfb7c7d1`. This package changes documentation and evidence only.

The useful next increment is small: make existing drawing routes easier to learn, offer a precise control for passive measurement clutter, and fill only the door/window interaction gaps left by the wall owner. Do not rebuild features already delivered by the usability stack.

## Read and execute

1. [Research and evidence](research.md): official sources, current-run captures, user references and limitations.
2. [Adoption matrix](adoption-matrix.md): existing, now, later and rejected patterns grounded in current files.
3. [Implementation packets](implementation-plan.md): priority, dependencies, contracts, ownership and acceptance.
4. [Validation](validation-plan.md): focused/full gates and limits of browser/native/human evidence.
5. [Session contract](parallel-delivery/README.md), [dispatch manifest](parallel-delivery/dispatch.json), [manifest schema](parallel-delivery/dispatch.schema.json), [copy-ready prompts](parallel-delivery/prompts.md) and [receipt template](parallel-delivery/receipt-template.md).

## Current disposition

No new coding task is dispatched. Two coding reservations are active: wall/opening work and item colors. Although one numerical slot remains, every useful immediate packet needs reserved locales, shared editor UI or final opening behavior. A speculative test-only worker would test an unsettled contract and is not justified. Queue the wave until the parent coordinator supplies the final wall-to-color stacked tip and releases ownership. The manifest is the authoritative snapshot for this package; parent task `01a09aba-b390-7650-a5d0-8d62f3066d29` owns the actual stack and program-wide leases.

This planning branch is `codex/remplanner-adoption-plan`. Push it without a PR until the coordinator supplies its strict-stack parent. Never merge to main, change lower PR bases, or rewrite another task's branch. Explicit assigned-worktree instructions take precedence over the generic `.worktrees/` convention; this task uses the clean assigned `D:/codex-worktrees/1638/renovation-planner` checkout.

## Binding product constraints

Obsidian owns the shell, tokens, language and native expectations. Markdown remains the human-readable source of truth; spatial geometry uses the existing versioned `.rpgeo` boundary. Plan edits geometry, Renovate connects intended changes/work, Review stays read-only. Reversible commands, stale/refusal handling and keyboard alternatives are requirements, not optional polish.

I18 remains unresolved: no approved non-drag route edits one arbitrary existing Room/Area corner. This package neither selects a new corner interaction nor closes [the issue](../../issues/Vertex%20editing%20has%20no%20keyboard%20path.md). Preserve the removal of selected-item **Add detail**; Details is the existing route. No 3D, accounts, remote database, copied visual identity, professional CAD/BIM claims or unsupported materials catalogue.

The source tree has no `AGENTS.md` or `.codex/` at this baseline. The supplied project instructions apply. [CLAUDE.md](../../../CLAUDE.md), the [SDD](../../development/sdds/obsidian-renovation-planner-SDD.md), [current user guide](../../using-plan-editor.md) and prior receipts were inspected. `PRODUCT.md` and early SDD inventory prose lag implemented editor extensions; use current code/receipts for existence, the SDD for architectural constraints, and the explicit current user direction for scope. No product-context repair is bundled here.

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

The coordinator resumed autonomous delivery on 2026-09-15. Final color tip `b5c4ccda08d98e0e966941250de90544948d2e62` (#214) was merged normally into this branch; it includes wall #212, independent A/B #213 and current `origin/main` at `9ef6070302cdd92a867668236a434c02d613f2fb`. No lower branch or main was changed. R00 reconciliation is complete; coding dispatch waits for this planning PR's green CI, then runs R01 → R02 → R03 → R04. The [manifest](parallel-delivery/dispatch.json) records live task/base/lease state.

This branch's PR is based directly on `codex/usability-astra-item-colors`. Future PRs remain a strict chain. R04 includes final Astra/high UI fidelity, code review/improvement, top-only main refresh/merge polish and real Obsidian-vault review where native computer access is available. No merges to main. R05 remains a separately selected later study.

## Binding product constraints

Obsidian owns the shell, tokens, language and native expectations. Markdown remains the human-readable source of truth; spatial geometry uses the existing versioned `.rpgeo` boundary. Plan edits geometry, Renovate connects intended changes/work, Review stays read-only. Reversible commands, stale/refusal handling and keyboard alternatives are requirements, not optional polish.

I18 remains unresolved: no approved non-drag route edits one arbitrary existing Room/Area corner. This package neither selects a new corner interaction nor closes [the issue](../../issues/Vertex%20editing%20has%20no%20keyboard%20path.md). Preserve the removal of selected-item **Add detail**; Details is the existing route. No 3D, accounts, remote database, copied visual identity, professional CAD/BIM claims or unsupported materials catalogue.

The source tree has no `AGENTS.md` or `.codex/` at this baseline. The supplied project instructions apply. [CLAUDE.md](../../../CLAUDE.md), the [SDD](../../development/sdds/obsidian-renovation-planner-SDD.md), [current user guide](../../using-plan-editor.md) and prior receipts were inspected. `PRODUCT.md` and early SDD inventory prose lag implemented editor extensions; use current code/receipts for existence, the SDD for architectural constraints, and the explicit current user direction for scope. No product-context repair is bundled here.

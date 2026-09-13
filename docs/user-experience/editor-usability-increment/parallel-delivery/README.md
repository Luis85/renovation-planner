# Parallel implementation delivery

**Delivery update · 2026-09-14 · 19 packets implemented or explicitly dispositioned in stacked review.**

The packet text and dispatch files below preserve the original planning baseline. Current implementation, PR and evidence status lives in [receipts](receipts/) and the [Astra corrective review](receipts/astra-code-polish.md). Native/AT/user validation and the deferred arbitrary-corner route remain open; a stacked PR is not a merge to main.

The user asked to implement later in parallel sessions using weaker models. These packets turn U0–U9 and the chosen [hybrid screens](../mockups/README.md) into small reviewable concerns with concrete file ownership, prerequisite gates, checks and copy-ready prompts.

## Start here

1. Merge the planning/mockup packet PR and explicitly start implementation when ready.
2. Run I00 alone to freeze shared contracts, reserve copy keys and resolve conditional decisions.
3. After I00 merges, start **I01, I02 and I04 in three separate sessions/worktrees**.
4. Use the waves below; keep one integrator responsible for shared files and merge admission. A finished session opens a PR, it does not merge itself.
5. Do not start a dependent packet on an unmerged sibling checkout. Fetch current main after prerequisites merge and create a fresh topic worktree.

Read [session-contract.md](session-contract.md) before dispatch. Each packet contains a copy-ready prompt and its own owned files. [dispatch.json](dispatch.json) is the machine-readable version; [ownership-audit.md](ownership-audit.md) is a supporting audit whose earlier P-numbered suggestions are superseded by the executable I00–I18 packets here.

## Packet index

| Packet | Wave | Direct prerequisites | Suggested model |
|---|---|---|---|
| [I00 — Freeze interaction, selector and copy contracts](packets/i00-contracts.md) | 0 | Plan/mockup PR | terra / high |
| [I01 — Make the active mode unmistakable](packets/i01-mode-header.md) | 1 | I00 | luna / high |
| [I02 — Consolidate compact navigation and stable panels](packets/i02-panels.md) | 1 | I00 | terra / high |
| [I03 — Put common Room edits first](packets/i03-room-details.md) | 2 | I00, I01 | luna / high |
| [I04 — Focus Renovate on work and information](packets/i04-renovate-details.md) | 1 | I00 | terra / high |
| [I05 — Clarify starting and finishing Room creation](packets/i05-room-start-draft.md) | 2 | I00, I04 | luna / high |
| [I06 — Make reference source preparation approachable](packets/i06-reference-prepare.md) | 2 | I00, I02 | luna / high |
| [I07 — Clarify points, known distance and rescale review](packets/i07-reference-scale-review.md) | 3 | I00, I06 | terra / high |
| [I08 — Adapt the bottom taskbar and current-task guidance](packets/i08-taskbar.md) | 3 | I00, I01, I04, I05 | terra / high |
| [I09 — Make overlapping targets understandable](packets/i09-selection.md) | 3 | I00, I03 | terra / high |
| [I10 — Polish existing precision and snap feedback](packets/i10-dimensions-feedback.md) | 4 | I00, I03, I08 | terra / high |
| [I11 — Clarify opening identity and host-relative properties](packets/i11-opening-details.md) | 4 | I00, I03, I07 | luna / high |
| [I12 — Explain copied scope and direct Paste recovery](packets/i12-clipboard-feedback.md) | 4 | I00, I03, I09 | terra / high |
| [I13 — Make draft, saving and recovery state truthful](packets/i13-save-recovery.md) | 5 | I00, I07, I08, I12 | terra / high |
| [I14 — Prevent accidental geometry editing in Renovate](packets/i14-mode-input-guard.md) | 5 | I00, I04, I08, I10, I11 | terra / high |
| [I15 — Verify dark, narrow, keyboard and accessibility consistency](packets/i15-visual-accessibility.md) | 7 | I01, I02, I03, I04, I05, I06, I07, I08, I09, I10, I11, I12, I13, I14, I18 | terra / high |
| [I16 — Integrate final code and record native release evidence](packets/i16-integration-native.md) | 8 | I15 | terra / high |
| [I17 — Align help and collect novice acceptance evidence](packets/i17-docs-user-validation.md) | 8 | I15 | luna / high |
| [I18 — Resolve the conditional non-drag corner-editing gap](packets/i18-corner-access.md) | 6 | I00, I10, I14 | terra / high |

At the original planning baseline all packets were **not started**; those packet headers are historical, not current delivery status. I09's chooser and I18's corner-access design are conditional: record their adopted/deferred scope and release consequence in I00. A deferred accessibility failure cannot be called an AA pass.

## Safe default waves

| Wave | Parallel sessions | Admission gate |
|---|---|---|
| 0 | I00 only | Current contracts, shared copy keys and scope decisions recorded; prerequisites available on main |
| 1 | I01 mode header · I02 panels · I04 Renovate Details | I00 merged |
| 2 | I03 Room Details · I05 room start/draft · I06 reference preparation | Wave 1 accepted/merged |
| 3 | I07 scale/review · I08 taskbar · I09 selection | Wave 2 accepted/merged; I09 conditional scope recorded |
| 4 | I10 precision/snap · I11 opening Details · I12 clipboard feedback | Wave 3 accepted/merged |
| 5 | I13 save/recovery · I14 Renovate input guard | Wave 4 accepted/merged |
| 6 | I18 conditional corner access | I14 merged; approved concrete interaction or explicit deferred limitation |
| 7 | I15 integrated visual/accessibility verification | All adopted code packets merged and conditional dispositions recorded |
| 8 | I16 integration/native release · I17 docs/user validation | I15 findings fixed or explicitly dispositioned |

Maximum: **three coding sessions and one integration/review session**. Treat waves as conservative barriers; moving work earlier requires a verified dependency and ownership check. Each PR must build with its imports/locales/styles in place. Do not postpone wiring until the final wave.

I16 and I17 may run together because their normal write ownership differs, but neither can claim full release acceptance until native, accessibility and user-study evidence exists. An unavailable participant or native environment is recorded as unperformed, not passed.

## Why this is suitable for smaller models

Pure presentation packets use the host-available `gpt-5.6-luna` with high reasoning; stateful or multi-component boundaries use `gpt-5.6-terra` with high reasoning. These assignments are engineering judgments, not benchmarks, measured savings or promises of equal quality. Model availability comes from this app's configured model list as of 2026-09-13; recheck when dispatching.

The important constraint is task size: one outcome, a few named production files, a small test set, fixed upstream contracts and an explicit handoff. Keep research memos and the entire repository history out of routine session context; read the packet's immediate seams and relevant screen notes, expanding only for a specific contradiction.

The integrator should be at least Terra/high. Escalate a concrete unresolved architecture, geometry/history issue or repeated failure to a stronger review session when needed, with a compact evidence package; do not silently change models or enlarge every task. A Sol/Astra review is optional risk management, not an automatic worker for every packet. Official guidance supports explicitly defining delegation and calibrating verification scope; it does not establish this repository's model-success rates. [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).

## File collision policy

- I00 and I16 reserve editor-root composition, locale aggregates and CSS index. The integrator services precise shared-file requests between waves; this is not permission for simultaneous edits.
- I06 → I07 share reference CSS and must be sequential.
- I14 → I18 share InteractionLayer and must be sequential.
- Existing tests are run/read targets unless ownership is explicitly granted. New per-packet tests and receipts use unique names.
- Reuse existing component CSS where owned. A new partial must be imported in the same verified PR, with obsolete competing declarations removed by their owner. No global override stylesheet to conceal integration failures.
- A packet cannot treat a broad directory as permission to edit its neighbors. Out-of-scope changes require a concrete integrator request and coordinated ownership transfer.

## Integration service

For each packet, record prerequisite merge SHAs and base SHA, confirm the allowed file diff, review state/command invariants, and apply approved root/locale/import edits to that same PR branch after the worker pauses. Then the worker reruns its relevant checks on the resulting commit. Merge only complete verified PRs; do not create an integration branch that silently combines incomplete work. Follow repository review-thread and post-merge cleanup instructions.

Only one session holds the heavy-verification slot at a time on this machine. Other sessions continue reading/editing or wait for that slot; they do not run competing full gates. Targeted checks are per packet; final `npm run check`, CI and native receipts belong to I16.

## Completion evidence

Use [receipts/TEMPLATE.md](receipts/TEMPLATE.md). A packet is complete only when its owned outcome is implemented, relevant checks are recorded, its PR is open/pushed, and remaining risks are explicit. The integrator records merge state separately. A selected mockup, generated screenshot, passing unit test or closed packet alone is not evidence of successful novice/native use.

The original 24–40 person-day range remains an initial effort estimate, not a smaller calendar duration promised by parallelism. Integration, queues, iteration and human validation add scheduling uncertainty; measure the first wave before estimating throughput.

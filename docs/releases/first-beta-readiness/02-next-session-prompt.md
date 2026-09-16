# Next-session kickoff prompt

Copy the block below into a code-capable session with access to the repository and this handoff folder. Adjust only the folder path if you placed it elsewhere. This prompt starts implementation; it does not authorize publishing a release or changing a personal vault.

```text
Work on the first-beta readiness of the plan editor in Luis85/renovation-planner.

Read the handoff under docs/releases/first-beta-readiness/:
- 01-improvement-plan.md
- 03-execution-tracker.md
- 04-beta-acceptance-matrix.md

If the files are attached instead of checked into the repository, use the attached files as the handoff. First read applicable local AGENTS.md/CLAUDE.md instructions, the current SDD/ADRs, and relevant editor specifications. Follow the repository's actual backlog and testing conventions.

Goal: make the existing editor safe, precise, understandable, and verifiably ready for beta. Do not rebuild the shell, expand the asset designer, add geometry families, modernize dependencies, or begin the optional image export. Keep existing implemented capabilities. All product documentation is English; preserve English/German UI translation coverage and Obsidian-native appearance.

The original review baseline was f82695645601b98a7febd95dbc8171c19237a245. The handoff was prepared against main observed at d77e7c5eba5e6518b93a5be4606532ceab3a77eb on 2026-09-16. Neither revision should be assumed current. Existing source/verification may have advanced.

Start with BP-00, bounded to preparing the first implementation slice:
1. Inspect the current branch, working tree, worktrees, local instructions, and relevant recent changes. Preserve uncommitted work and unrelated branches. Do not reset, clean, stash, or force-push.
2. Reconcile every finding with current source and existing backlog/case notes. Mark already-fixed items with evidence; do not reimplement them. Establish current test commands and the unmodified baseline.
3. Record the delta, ownership, required native/device checks, and first-beta scope in the tracker. Reuse existing acceptance cases instead of creating a second test catalogue.
4. Reproduce the recovery-state loss through the real settings-rebind path. Start with src/presentation/editor/save-state/save-state-store.ts, tests/plugin/rootSwapRebind.test.ts, PlanEditorView, plugin rebind/composition, and the write-failure path. Add a failing desired-outcome regression before changing code.
5. Proceed to the smallest BP-01 fix that preserves unresolved incidents across settings changes, remounts, and same-plan panes. Carry incident ownership at the appropriate stable lifecycle boundary; do not simply hide the warning, weaken a test, or bypass guarded commands. BP-02 separately addresses restart durability and conservative incomplete-operation detection.

If BP-01 is already fixed, verify the fix and take the next highest-priority unfinished mandatory package. If current repository evidence contradicts this handoff, document the change and continue with the corrected baseline. Do not turn baseline reconciliation into another broad product-design exercise.

Implementation rules:
- Keep the layered architecture and infrastructure-only vault write boundary.
- Preserve IDs, precision, version checks, undo semantics, hosted openings, group membership, and existing/intended separation.
- Treat component disposal separately from completion of already dispatched commands.
- Successful read-back, an unrelated successful edit, or remount is not proof of incident repair.
- Never weaken lint, coverage, architecture gates, or assertions to make the build green.
- Use the current package scripts. At handoff time, npm run check and npm run audit were separate. Inspect before execution.
- Work only in isolated synthetic test vaults. Do not inject failures or migrate a personal vault.
- Commit in focused topic slices only when permitted by the repository/session instructions. Do not push, merge, tag, publish, submit to the community directory, or delete user data without explicit authorization.
- Do not claim native Obsidian, physical device, screen-reader, screenshot, or performance acceptance unless you actually performed it and recorded the environment/source/artifact. A browser harness is not native Obsidian.
- For final beta acceptance, test the production bundle and record hashes. npm run test-build was a development-mode path at handoff time; its success is not production-artifact acceptance.

Keep the user informed with brief substantive progress updates. Implement and verify as much of the selected package as the current session supports. Do not promise background work.

At session end update 03-execution-tracker.md, then report:
- branch and exact revision;
- baseline findings and what changed;
- package/acceptance criteria completed;
- files changed;
- exact tests/commands and outcomes;
- evidence locations;
- native/device checks still unperformed;
- new risks or owner decisions needed;
- the single next executable step.

Do not mark implemented work as released or beta-ready. The go/no-go decision requires the integrated gates in the plan and explicit release-owner authorization.
```

## Resume prompt for later sessions

```text
Resume the renovation-planner first-beta improvement plan from docs/releases/first-beta-readiness/.
Read the tracker and applicable repository instructions before changing code. Reconcile the current
working revision and preserve parallel/uncommitted work. Continue the highest-priority unfinished
mandatory BP package, starting with the tracker's next executable step. Reverify any finding that
may have changed. Implement and test the smallest complete slice, update the tracker, and report
precisely what is done versus unverified. Do not begin optional scope, weaken gates, or publish.
```

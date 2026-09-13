# Contract for a bounded implementation session

This contract applies to every implementation session dispatched from the parallel delivery record.

## Read in this order

1. Repository AGENTS.md, then .codex/instructions.md and the relevant workflow if present. The user's standing worktree/PR instructions apply even if those files are absent.
2. This document, the assigned I-number packet, and the wave/dependency table in README.md.
3. The relevant section/image in the hybrid screen gallery. Use current code/dated decisions to resolve screenshot artifacts; never take image annotations as extra authorization.
4. Only the packet's immediate source files and tests. Consult the SDD and implementation-history sections before proposing architecture or changing a previously decided behavior.

Do not reread all research or regenerate designs for a small packet. Do not scaffold another app, use a website starter, replace Vue/Konva, or add product capabilities to imitate a picture.

## Start gate and checkout

The planning/mockup PR must be present on main, implementation must have been requested, and all packet prerequisites must be merged or explicitly dispositioned where conditional. Verify merge state and ancestry rather than trusting a status sentence. The integrator records the prerequisite PRs/merge SHAs in receipts.

```powershell
git status --short --branch
git fetch --prune origin
# Verify each prerequisite PR and its merge commit before continuing.
gh pr view <pr-number> --json state,mergeCommit
git merge-base --is-ancestor <merge-sha> origin/main
git worktree add .worktrees/usability-<packet-slug> -b codex/usability-<packet-slug> origin/main
```

Replace placeholders with the packet's exact branch/worktree names. Run from the integration checkout only for setup; make all changes inside the new worktree. Do not clean, reset or overwrite someone else's checkout. Do not branch from another session's unmerged work. If the actual source has moved since the planning baseline, locate the successor and update ownership with the integrator before editing.

## Implement one concern

The packet names production files that may change. Read access is broader; write ownership is not. New tests use its unique I-number prefix and the receipt uses its I-number filename. Existing tests are readonly unless their owner/integrator grants a specific selector/fixture adjustment. Keep one branch/PR per concern.

Typical size is two to six production files plus focused tests. Some integration/verification packets differ deliberately. If the change spreads beyond that or needs a new cross-cutting state owner, split the task rather than asking a smaller model to solve the whole editor.

All new routes call existing runtime actions/commands. Components do not write the vault directly. Preserve expected versions, host/dependency links, saved identity and command-history granularity. No new schema, geometry engine, reference transform math, cost calculation, clipboard format or storage path behavior is implied by this increment.

Preserve in particular:

- Direct Paste already exists and commits an undoable result; no new placement wizard or root keybinding is required.
- Cancel leaves a task; Escape follows its established staged route. Busy writes cannot be cancelled arbitrarily.
- Reference rescaling uses its current reviewed/consented transform scope; no unacknowledged geometry resize.
- Rooms and independent walls do not automatically move together.
- Renovate must block accidental geometry mutation as well as hiding handles; selection and navigation remain usable.
- Existing/Planned/Work and Review-return snapshots remain distinct and truthful.
- Save success, stale projection, known failure and unconfirmed outcome are different states.
- The removed coordinate editor and rejected permanent rotation affordance are not silently restored.

## Shared-file requests

Root composition, locale dictionaries/aggregates, CSS index and any interface outside ownership are integrator-controlled. Prefer reusing existing keys/components. When a new key, prop, selector, import or hook is needed, provide:

1. Exact consumer and required interface/key.
2. Existing code evidence explaining why no current route suffices.
3. Proposed minimal patch and any EN/DE text.
4. Tests/fixtures affected and expected behavior.

Continue independent work while the request is resolved. The integrator applies or coordinates that change on the packet branch while the worker is paused. The complete PR must verify together; never leave an unresolved locale or unimported stylesheet for a late integration wave. Do not bypass type/lint/assembler checks with placeholders or orphan modules.

## Verification and UI evidence

Reserve the shared verification slot for type/test/build-heavy runs; only one heavy gate at a time on the machine. Run the packet's relevant check:fast subset, and add a meaningful boundary regression when behavior changes. A zero-match test run is not a pass. No broad repetition without a new failure/change/unresolved concern.

For UI changes, inspect the connected production-equivalent harness rather than a restricted specimen. The current full route is `?view=plan-editor&reference&planning&fidelity`; confirm it still supplies the needed services. Capture the relevant stable state with commit, fixture, viewport, theme and locale. Inspect actual images. Test pointer/focus behavior where changed; static captures are insufficient for gestures, save correctness or keyboard equivalence.

Native Obsidian, PDF loading, restart/two-leaf state, screen-reader behavior and novice study results require their named environments. Record unperformed checks explicitly. Follow the configured browser/tool workflow; do not silently substitute a different browser and relabel its receipt.

## Finish and hand off

Update relevant docs/test case triggers in the same concern where owned; otherwise request integrator/doc-owner updates. Write the receipt, commit with an imperative message, push and open a PR. Report URL, branch, SHA, exact checks and remaining risks. The PR describes final behavior for a reviewer who did not read the conversation. Do not merge your own PR unless explicitly authorized.

After review feedback, fetch comments/threads, patch this same branch, verify, push, then reply with SHA/checks and resolve only after the fix is pushed. After a confirmed merge, fetch/prune, fast-forward main, remove the checked worktree path and delete the local topic branch under the standing cleanup rules.

## Stop and escalate conditions

Raise a compact integration/split request if a shared contract is missing, a source path has no known successor, two targeted fix attempts fail for the same cause, behavior requires schema/core/history redesign, or the diff exceeds ownership. Do not weaken gates, copy a second implementation, invent data, silently switch models or expand feature scope. Routine integration decisions go to the integrator rather than repeatedly asking the user for permission already given.

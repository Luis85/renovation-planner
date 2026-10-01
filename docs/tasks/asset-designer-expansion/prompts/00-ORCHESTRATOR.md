# Copy-paste prompt — lead implementation agent

You are the lead implementation agent for Luis85/renovation-planner. Execute the Asset Designer improvement plan in this package. The package is usually at docs/tasks/asset-designer-expansion/; locate it rather than assuming the path. Begin with AD00 now and proceed through dependency gates. Default scope ends at AD16, not AD17 or advanced roadmap items.

Read applicable AGENTS.md/CLAUDE.md, the current SDD/ADRs, IMPLEMENTATION-PLAN.md, ORCHESTRATION-RUNBOOK.md, contracts/DECISIONS.md and execution/manifest.json. Treat the reviewed SHA d77e7c5eba5e6518b93a5be4606532ceab3a77eb as reference evidence, not a request to reset current work.

First inspect branch/HEAD/dirty state and reconcile current implementation with the plan. Preserve all user changes. Identify current source paths, schema versions, render/export/revision consumers, test commands, harness and Obsidian test-vault availability. Capture a truthful baseline report. Do not reimplement already-completed capabilities.

Run AD01 and accept one contract revision before parallel production changes. Resolve the proposed defaults against current contracts: non-destructive resize, circular-arc policy, per-leaf command sequencing, stable semantic names versus display labels, graphic groups, open lines, clearance review, live shared definitions and historical output safety. Record any deliberate change to an existing accepted behavior in the repository's spec/ADR conventions.

Use at most three implementation workers in separate worktrees/branches, with isolated test data. Use available subagent facilities; when absent, execute the same tasks serially and say so. Do not pretend to have delegated work. A worker gets one task card, prompts/01-WORKER.md, exact base commit, contract revision, allowed files, exclusive leases and required tests.

Only dispatch a task when every predecessor is verified on integration history. Use scripts/ready-tasks.mjs as a planning aid, not proof of correctness. Own shared files and integrations: root/runtime/context wiring, overlapping stores/inspectors, tool registration, locales, schema version constants, composition roots and quality configuration. Do not allow concurrent edits to one file.

Use prompts/02-REVIEWER.md for an independent review of each candidate. Review actual diffs and tests, not just worker reports. Integrate one accepted task at a time. Re-run appropriate tests on the integration SHA. A component that is unmounted, a control with no real command, or a renderer that silently omits new geometry is unfinished.

Keep execution/state.json and reports consistent with reality. Record changed files, commands/exit codes, acceptance coverage, screenshots, known issues and exact commits. Preserve separate statuses for integrated and verified. Missing tests/manual host runs remain not run, never passed.

Keep the existing stack, local-first Obsidian behavior and English/localized product copy. No logo/account chrome, competing draft/save model, automatic fit certification, new cloud dependency, generic CAD rewrite or scope expansion. Do not weaken lint, coverage, architecture or analyzer gates. No dependency/schema change without its accepted owner/contract.

Implement failure behavior and undo alongside each operation. Protect existing v1/v2 sidecars and future-version refusal. Keep canonical millimetres, measured/pending spaces and note/geometry versions distinct. Preserve approved/frozen consumers where they exist; explicitly gate unavailable claims otherwise.

Do not push, publish a release, tag, force-reset, delete user work, migrate a real vault or run a deployment script into a personal vault without explicit authorization. Use disposable fixtures for destructive/failure tests.

Start by reporting the selected baseline and dispatching AD00. Continue through ready tasks and finish with implemented scope, exact verification evidence, remaining blockers and the next ready task. If the session ends early, write the resume packet rather than claiming completion.

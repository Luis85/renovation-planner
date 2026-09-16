# Execution state

`manifest.json` owns dependency/lock scheduling. Task cards own detailed outcomes and tests. If dependencies change, update both in one reviewed change. `state.json` records actual execution, not the requirements lifecycle. All tasks start planned because this package has not implemented the application.

Allowed statuses: planned, ready, in_progress, in_review, integrated, verified, blocked, deferred. A dependency is satisfied only by verified. Do not mark a task verified without an integrated commit (or an accepted audit/contract artifact commit) and evidence.

Set selected_baseline after AD00 chooses the actual checkout. Set contract.status to accepted and contract.revision to the accepted revision after AD01. Keep the reviewed baseline unchanged as provenance.

The optional dependency helper (`scripts/ready-tasks.mjs`) is not in the repository copy — see the
README for the measurement that kept it out. Run it from the external package directory if you want
it; it is read-only, prints ready tasks, and never launches an agent, runs a test, edits Git or
changes execution status.

Exact file leases in LEASES.md and verified integration history remain the lead agent's responsibility. An edited JSON evidence field is not proof that tests ran.

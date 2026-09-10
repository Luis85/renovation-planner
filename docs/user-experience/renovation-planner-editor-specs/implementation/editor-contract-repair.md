# Integrated locale and Group boundary contract repair

Prepared from stable integrated source `b758695c` while the full coverage run remained
active. This branch does not change the source under that run.

The application-code scan found three new Group failure codes without user-facing EN/DE
copy: recovery required, write failure and post-save publication failure. Dedicated messages
now distinguish inability to finish from a confirmed save whose view failed to refresh.
The German curve instruction uses formal address consistently.

The spatial command-message scan additionally found `spatial.group-restore-conflict` from
the deleted Room/Area membership restoration path. Its EN/DE copy explains that the former
membership cannot safely be restored and directs the user to reopen and review the group.
Both complete message collectors retain their original coverage assertions.

The guard survey's exact reviewed-owner set also lacked the argument-taking Group factory.
`guardedGroups.test.ts` now drives the actual `planEditorDeps` composition: escaped raw
read/execute/undo faults must resolve to the mapped refusal and log their own boundary;
real repository failures retain application-owned refusals, change no bytes on the failed
attempt, and allow exact execute/undo retry. Only that evidenced owner is added to the
reviewed-owner contract. Discovery and both service/door carve-out tables remain unchanged.

The future-sidecar fixture now derives its unsupported versions from the existing migration
runner's registered latest version, rather than calling supported schema 7 a future format.
Both near-future and far-future cases retain their Migration refusal and exact no-write checks.

After the full run terminated, scoped ESLint/Oxlint and TypeScript passed. With
`VITEST_MAX_WORKERS=1`, six focused files passed all 122 cases: application-code copy,
locale consistency/formal address, command-level spatial copy, the full guard survey,
composed Group boundary/retry behavior, and sidecar compatibility/refusal. Original
assertions, timeout budgets and thresholds remain unchanged. The integrated full gate
and broader behavior coverage remain separate release verification.

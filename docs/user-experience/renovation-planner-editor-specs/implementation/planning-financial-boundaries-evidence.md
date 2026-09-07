# Planning financial boundaries — WIP and resume

Updated: 2026-09-07. **Native/type/lint verified in Root; full coverage contribution pending.**

Worktree: `D:/Projects/renovation-planner/.worktrees/planning-financial-boundaries`.
Branch: `codex/planning-financial-boundaries`.
Base: root `45c58609596734f17570a22074d05f3e2f81fafb`.

Only the new `tests/presentation/editor/planningFinancialBoundaries.test.ts` and this record
are changed. Production, helpers, existing tests and shared ledgers are unchanged.

The cases use the mounted editor and native controls:

1. An automatic estimate's Documents action follows its Requirement identity to persisted
   Evidence, without manufacturing a Cost record or writing during navigation.
2. A Requirement marked stale through its domain operation and repository CAS is fully
   refreshed. Healthy read state, unblocked prerequisites and an enabled native Shopping
   control are explicit preconditions. The test then requires the Inspector's own alert,
   zero shoppingNote calls and unchanged previously generated note/vault bytes.
3. A native Existing-only subject starts material creation through its visible Materials
   action. Saved material retains the Room/target while leaving outcomeId and workId empty;
   no Planned facts, Work or geometry are invented.
4. Native cancellation changes only a single actual payment of an active obligation.
   Fact IDs, original amounts and commitment linkage remain. Domain Money comparisons
   verify Actual 40 → 0, Open commitment 60 → 100 and Remaining 20 → 20; native Undo must
   restore the complete original record. No decimal-to-number coercion is used.

The fresh Linux24 `45c58609` missing-counter map confirms the same source positions as
`f306`: expected new arms are CostRow `13:0`, MaterialsInspector `9:0` and
planningSelectionContext `2:1`, plus MaterialsInspector statement `34`. Three arms and one
statement are hypotheses until measured. The fourth case adds M13 behavioral evidence;
the cancelled-fact rendering arm already has hits, so no additional gain is promised.

No case was manufactured for a missing Shopping capability with an otherwise normal
planning composition or for a Decision without its required Subject. The former has no
identified public producer; the latter violates current domain validation.

Checks so far: source preparation and diff checks only. Dependencies have not been installed
and no native/type/lint/coverage/browser run was started in this worktree. UI retains its
exclusive caption/Review/full-browser slot. Root will run this file later using an existing
checkout and dependencies; wait for that coordination instead of starting another install.

Next: obtain exact native/static results, investigate any genuine failure without weakening
the Shopping preconditions or Money assertions, and record/push a verification checkpoint.
Report actual counter gains only from a fresh complete map or an explicitly scoped measured
comparison. Root task: `01a0786f-b624-7303-987f-b18b94db48d9`. No active E heavy process.

## Root verification

The combined two-file run passed all8cases in43.84seconds. Whole type checking,
whole Oxlint, scoped ESLint and a fresh static Fallow scan passed; zero dead-code
issues or clone groups. No production change or assertion correction was needed.
Logs: financial-library-native/types/static in the root finalization scratch.
The dedicated coverage session will measure the actual full-run contribution.

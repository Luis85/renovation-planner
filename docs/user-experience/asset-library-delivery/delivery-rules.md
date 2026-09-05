# Shared delivery rules

## Hierarchy and status

Epic **Asset library** → proposed feature groups F01–F05 → user-use-case PBIs → tasks. Feature IDs are local planning aids, not existing GitHub or Azure DevOps IDs. EN-01 and EN-02 are listed separately as technical enablers; map them to technical work items or linked tasks in the existing tracking system as appropriate.

All new PBIs have status **designed**. Selection of a visual direction does not replace technical refinement or estimation. Continue through scoped → tech refined → estimated → ready. P0/P1 priorities express relative delivery priority within this package, not production defect severity. P1 PBIs remain part of overall acceptance.

## Mandatory quality rules for every PBI

- Evolve the existing Vue implementation. Build only behavior missing from the actual delta.
- Write domain data only through agreed application use cases; no UI-to-repository shortcuts.
- Use one asset ID for the current row, inspector, and draft; discard outdated asynchronous responses.
- Preserve established Money, currency, dimension-kind, and reference rules.
- Preserve metadata that the form does not edit.
- Keyboard access, labels, local errors, and theme behavior belong to every UI change from the start. PBI-16 verifies the complete flow.
- No catalogue total, automatic currency conversion, or conflation of requirements with assets.
- A failed read is never presented as an empty dataset.
- Report mutation success only after a confirmed write; distinguish read-back failure.
- Use the existing translation catalogue for English and German UI. Do not ship demo controls in the plugin.
- English is the project documentation language: PBI titles, tasks, acceptance criteria, plans, and technical documentation must be English. German text belongs to explicitly identified localization references only.

## Definition of Ready

The user outcome and scope are understandable; dependencies are resolved; the data/command contract is known; the happy path and concrete exceptions are testable; the relevant state design exists or is scheduled before implementation; the team has completed sizing. Apply the existing project-specific Definition of Ready as well.

## Definition of Done

Agreed acceptance criteria are met, relevant tests pass, affected states have been checked in the actual host/harness, no P0/P1 regression remains under the agreed gate, documentation and captures are current, and limitations are explicit. Verify cost-pipeline, persistence, and refusal safety with appropriate technical tests; screenshots alone are insufficient.

Do not expand testing indiscriminately for layout-only changes. Reuse existing tests and cover concrete remaining risks.

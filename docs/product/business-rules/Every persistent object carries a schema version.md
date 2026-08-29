---
rule: BR-DATA-008
kind: integrity
name: Every persistent object carries a schema version
area: data
sources:
  - PRD §61
  - PRD §62
  - PRD §69
type: business-rule
---

# Every persistent object carries a schema version

**The rule.** Persistent objects carry `schema-version` (§61). Migrations between versions are
deterministic, testable, traceable, and reversible where practical (§62) — and **a large migration
must not silently overwrite existing data.**

**Why.** The files outlive the plugin version that wrote them, and there is no server to run a
migration on. A note whose shape cannot be identified can only be guessed at, and a guess applied
in bulk across a vault is unrecoverable. Determinism is what makes a migration testable at all;
traceability is what lets a user who lost something find out what happened to it.

§69's recovery scenarios name an **interrupted migration** alongside a damaged sidecar and invalid
frontmatter — so partial application is an expected state to be recovered from, not an impossible
one to be assumed away. The plugin must preserve recoverable source data.

**Where it holds.** The mappers in `infrastructure/`, which read the version before interpreting
anything else. Diagnostics expose plugin version, schema version, project version and migration
status locally (§92) — and never upload project data.

**Checked by.** Not yet. §62's *testable* is the requirement; migration fixtures are named as an
integration-test surface (§99).

**Sources.** PRD §61 · PRD §62 · PRD §69 · PRD §92.

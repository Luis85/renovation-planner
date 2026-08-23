---
rule: BR-DATA-004
kind: integrity
name: A delete reports what references it and offers four choices
area: data
sources:
  - PRD §64
  - PRD §63
type: business-rule
---

# A delete reports what references it and offers four choices

**The rule.** Deletion checks references **first**, reports what it found, and offers §64's four
resolutions:

```text
Delete Zone?
Referenced by: 3 Work Packages · 7 Tasks · 4 Cost Items · 2 Documents

Cancel · Remove References · Reassign · Delete Anyway
```

A silent cascading delete is refused, and so is a delete that leaves dangling ids.

**Why.** Both of the easy answers are wrong. A silent cascade means deleting a zone quietly
deletes somebody's cost history; a hard refusal means the model is stuck the moment a plan
changes, which on a renovation is constantly. The user is the only one who knows which of the four
it is, so the rule is to *ask*, with the count in front of them.

**What `delete anyway` costs.** It is the one resolution that leaves the graph inconsistent
deliberately, and it is kept because the alternative is a product that cannot delete. Its
consequence is stated honestly in [[A requirement names what it is required for]]: a stranded
requirement has no in-plugin surface today.

**Where it holds.** The delete command in `application/`, before anything is written. `reassign`
holds the deleted entity's reference lock **and** the reassignment target's, because repointing a
requirement at that target creates a reference to it — and multiple locks are acquired in a fixed
order, since unordered acquisition is a deadlock two tabs can reach without either doing anything
wrong.

**Checked by.** Not yet. Slice 10's "Deletion & reference integrity" specifies the cascade
handlers and the lock ordering.

**Sources.** PRD §64 · PRD §63 · slice 10
([`docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`](../tasks/10-assets-requirements-and-the-end-to-end-loop.md)).

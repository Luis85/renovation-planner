---
rule: BR-DATA-005
kind: integrity
name: Four kinds of reference failure are detected by name
area: data
sources:
  - PRD §63
  - PRD §91
type: business-rule
---

# Four kinds of reference failure are detected by name

**The rule.** §63 names four, and they are four different defects with four different repairs:

| Failure | What it means | What it is not |
| --- | --- | --- |
| Missing reference | A field points at nothing | An empty field |
| Deleted object | The target existed and was removed | A never-valid id |
| Invalid id | Malformed — not a well-formed id at all | A valid id with no target |
| Duplicate id | Two entities claim one identity | A copy-paste of a note body |

The vault health check (§91) is where they surface, alongside invalid schemas, missing assets,
invalid geometry, orphan sidecars and missing backgrounds.

**Why.** Collapsing them into "broken reference" loses the repair. A duplicate id is not fixable by
clearing a field — it needs one of the two entities re-identified — and an invalid id points at a
migration or a hand edit, while a deleted object points at a `delete anyway`
([[A delete reports what references it and offers four choices]]).

Detection is the load-bearing word: because [[Identity is the id, never the filename, title or path]]
and the vault is editable by hand, the plugin cannot *prevent* these states. It can only find them
and say which one it found.

**Where it holds.** The validation layer, at §90's *reference validation* level — one of four
levels, alongside schema, business rule and geometry validation.

**Checked by.** Not yet. Slice 11 owns diagnostics and data safety.

**Sources.** PRD §63 · PRD §90 · PRD §91.

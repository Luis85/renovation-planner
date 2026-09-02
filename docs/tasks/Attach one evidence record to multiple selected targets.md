---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 60
status: New
horizon: "V1"
release: ""
---

# Attach one evidence record to multiple selected targets

## Evidence

M11 permits one shared detail to link to all selected entities, and [[Link evidence to spatial
targets]] requires one evidence record to relate to more than one stable target without copying
the file.

## Why it matters

One permit, photo or note may concern several walls or rooms; duplicating it per target creates
several records that can disagree and several files to maintain.

## Approach

Pass the ordered compatible selection and one canonical evidence identity to a batch relationship
command. Validate every target before commit, create only missing pairs, and refresh the evidence
projection for the retained multi-selection.

## Acceptance criteria

1. One evidence identity can link to every compatible selected target without copying bytes.
2. Existing evidence-target pairs are no-ops rather than duplicates.
3. A missing, unreadable or incompatible target prevents silent partial success.
4. Querying each successful target returns the same canonical evidence record.
5. Cancelling or refusal preserves the multi-selection and creates no relationship.

## Risks

- Per-target commands could leave a partially linked selection after a later refusal.
- Treating the displayed selection order as persistent relationship identity could create drift.

## Outcome

One shared evidence record can be attached atomically to several selected spatial targets.

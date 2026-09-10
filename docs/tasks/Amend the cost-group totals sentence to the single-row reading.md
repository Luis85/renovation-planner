---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 90
status: New
horizon: "V1"
release: ""
dependsOn: "[[Confirm merged main carries the verified editor state]]"
---

# Amend the cost-group totals sentence to the single-row reading

## Evidence

`contextual-detail-fidelity.md`, in
`docs/user-experience/renovation-planner-editor-specs/implementation/`, says "Expanded work-cost
groups expose all reconciled totals through the existing financial projection." Since `5a244a92`,
`src/presentation/editor/planning/CostGroup.vue` renders a group's totals only when the group holds
more than one row.

That change fixed a measured defect. In the downstream journey's room-costs state — light, 1440 ×
1000, one work group holding one cost row — the same five reconciled figures were printed three
times, for the room, the group and the row. `.rp-cost-groups` measured 545.7 px against 364.0 px in
the last passing capture,
`docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-final-overview-followup/verified-downstream-1fee/downstream/report.json`,
and **Add cost** ended 17.3 px below the visible Inspector. With the gate, the section recovers
exactly 181.7 px and the action sits inside the pane. **The product owner approved that reading on
2026-09-10**, so the code stays and the sentence is what disagrees.

## Why it matters

A specification that disagrees with the code invites the next reader to fix the code back, and
reverting it here re-clips the primary action of the section the user is working in.

## Approach

Amend the one sentence in place, dated, citing `5a244a92` and the approval, and keep the superseded
wording readable as history. The reading and its alternatives, recorded so nobody re-derives them:

- **Chosen: withhold the group totals for a one-row group.** For one row the group block is
  arithmetically the row's own totals — `aggregateCosts` sums the rows and answers only when every
  row does — so it adds no information.
- **Rejected: move Add cost above the records.** The same document says "Put record creation below
  the records."
- **Rejected: delete the group totals block.** A group of several rows carries a total its rows do
  not give, which is what the sentence is for.
- **Left alone, and open:** a room with a single group of several rows still shows a group total
  equal to the room total. That is a different duplication under a different rule, and not the
  181.7 px, so it is not decided here.

## Acceptance criteria

1. The sentence in `contextual-detail-fidelity.md` states the code's reading — a group of more than
   one cost row exposes all reconciled totals, and a single-row group shows its row's totals only —
   with a dated note citing `5a244a92` and the product owner's approval of 2026-09-10.
2. The superseded wording stays readable as history rather than being silently replaced.
3. `docs/user-experience/renovation-planner-editor-specs/screens/M13-room-costs.md` is confirmed
   still consistent; no edit to it is expected.
4. The single-group, several-rows duplication stays recorded as an open question and unchanged.
5. No code changes.

## Risks

- `user-experience/` holds documents as received. This amendment rests on the product owner's
  approval and says so in place, so it does not read as a silent rewrite.
- An amendment without its history line would hide that the reading was ever different.

## Outcome

The contextual-detail specification and `CostGroup.vue` state the same rule for single-row cost
groups, and the rejected alternatives are on record.

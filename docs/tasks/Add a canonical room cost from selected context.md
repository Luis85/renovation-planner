---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 50
status: New
horizon: "V1"
release: ""
---

# Add a canonical room cost from selected context

## Evidence

M13 provides Add cost for planned, committed and actual stages with Room context inherited, while
[[Cost item]] defines distinct authoritative sources for those cost types.

## Why it matters

Prefilling a room saves linking work, but the shortcut must not let the editor invent a cost type
or bypass the source-of-record rules behind committed and actual money.

## Approach

Open a contextual cost form with the selected room prefilled, collect the requested stage and its
required source fields, and dispatch the canonical cost command. Refresh room totals and rows from
the cost query after success; retain the draft after refusal.

## Acceptance criteria

1. Planned, committed and actual choices route to their canonical cost command and source rules.
2. The selected room id is prefilled but no Cost item exists before submit.
3. Success persists one canonical Cost item and refreshes room totals from the authoritative query.
4. A validation or persistence refusal keeps the draft and previous totals available.
5. The editor stores no duplicate cost item or room total.

## Risks

- A generic form could allow an actual cost without its invoice authority.
- Optimistic total changes could double-count a cost when the query refresh arrives.

## Outcome

A canonical planned, committed or actual cost can be added from selected room context without
moving cost ownership into the editor.

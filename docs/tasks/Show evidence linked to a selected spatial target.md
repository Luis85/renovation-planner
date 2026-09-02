---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Show evidence linked to a selected spatial target

## Evidence

M14 defines one contextual shell for Documents, Photos and Notes. The mental model requires
project information attached spatially to remain available outside the editor.

## Why it matters

Selecting a room or wall should answer what evidence belongs there without moving files into a
private editor store.

## Approach

Query the common evidence relationship authority with the selected spatial id. Render typed rows,
phase filters, dates, descriptions and missing-file states in shared Inspector content while
preserving selection across evidence-type switches.

## Acceptance criteria

1. Each selected target lists only evidence related by the authoritative relationship.
2. Documents, Photos and Notes reuse one shell and keep the same spatial selection.
3. Filters change the projection only and delete or rewrite no relationships.
4. Query failure is distinct from an authoritative empty result.
5. Every row remains addressable through a non-canvas route.

## Risks

- Separate type-specific queries could drift into three relationship models.
- An unreadable file could cause a valid relationship to disappear.

## Outcome

The selected spatial target provides one reliable index into its vault evidence.

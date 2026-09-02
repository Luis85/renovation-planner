---
type: Task
parent: "[[Grid and snapping]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Integrate visible snapping into spatial creation

## Evidence

The editor specifications require users to understand why placement snapped through guides,
markers, labels and status controls.

## Why it matters

Invisible snapping feels like pointer error and makes precise geometry hard to trust.

## Approach

Connect the snap result to Room, Wall, Opening and move previews through one render model. Draw
non-colour-only guides and expose grid/snap state in the status bar. Keep the renderer read-only
and let the owning completed action persist the resulting geometry.

## Acceptance criteria

- Every applied snap has a matching visible relation.
- Guide rendering causes no persistence or command dispatch.
- Disabling snap immediately changes previews and status.
- Guides remain legible in light, dark and custom accents.

## Risks

Too many guides can obscure the source geometry; render only the winning relation and useful context.

## Outcome

Snapping is automatic, visible and shared across spatial creation.

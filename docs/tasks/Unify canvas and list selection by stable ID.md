---
type: Task
parent: "[[Selection]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Unify canvas and list selection by stable ID

## Evidence

[M00](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md) enters from canvas or non-canvas list, and the vertical plan requires both to resolve the same entity ID.

## Why it matters

Two selection paths with separate state can highlight one room while the Inspector describes another.

## Approach

Route canvas and list intents through one selection action/store keyed by stable ID and supported entity type, then derive overlay and Inspector state from it.

## Acceptance criteria

- Canvas and list selection produce the same stored identity.
- Selecting a second record replaces the first.
- Inspector and overlay consume the shared identity.
- Selection causes no persistence write.

## Risks

Labels or render-array positions may accidentally become substitute identities.

## Outcome

Every single-selection surface agrees on exactly one spatial record.

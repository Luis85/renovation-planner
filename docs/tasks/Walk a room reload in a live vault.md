---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Walk a room reload in a live vault

## Evidence

Repository fakes cannot prove Obsidian workspace restoration or MetadataCache timing.

## Why it matters

The release claim includes closing a leaf and restarting the host, not only remounting Vue.

## Approach

In the release vault, create and name a room, record its values, close/reopen the leaf, restart
Obsidian, and compare the room, source note, sidecar geometry, and derived area.

## Acceptance criteria

- Both reopen paths restore the same stable room and values.
- No duplicate note, sidecar object, or write notice appears.
- The run records Obsidian version, platform, date, and result.

## Risks

Visual similarity can hide an identity change; inspect the persisted ID.

## Outcome

Live-host evidence covers the reload behavior automation cannot model.

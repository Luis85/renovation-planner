---
type: PBI
parent: "[[Release hardening]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Draw and name a rectangular room]]"
---

# Reload the editor without losing room data

## Actor

The private renovator who has created a room and expects it to remain the same when they return.

## Main flow

1. The renovator creates and confirms a valid room.
2. The editor, leaf, or workspace is closed.
3. The renovator opens the same plan again.
4. The editor loads the room note and plan sidecar through the normal read path.
5. The room appears with the same identity, geometry, homeowner metadata, and derived area.

## Extensions

- **4a** — One half of the persisted room cannot be read. The room is reported as unreadable;
  the editor does not invent an empty room or silently repair the vault.
- **4b** — The stored shape is from an accepted older schema. A tested migration loads it
  without changing the stable room identity.
- **4c** — Selection or draft-only state no longer names a valid entity. The editor opens in
  safe Select state while preserving every valid room.

## Guarantee

Reload reconstructs the last successfully persisted room from canonical Markdown metadata and
sidecar geometry. It neither loses a valid room nor promotes transient UI state into vault data.

## Acceptance criteria

1. A confirmed room reloads with the same stable ID, name, type, points, and derived area.
2. Closing and reopening the editor does not write to the room merely to display it.
3. An unreadable room is distinguishable from a plan with no rooms.
4. Accepted migration fixtures preserve identity and user-owned Markdown.
5. The create/select/reload journey passes in a live Obsidian vault.

## Assumptions

- “Reload” includes closing and reopening a leaf and restoring the workspace after Obsidian
  restarts.
- Selection need not survive a restart; persisted room data must.
- The room-creation flow owns what constitutes a complete room. This item proves its round trip.

## Sources

VS-09, WP7, and Scenario C in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md).

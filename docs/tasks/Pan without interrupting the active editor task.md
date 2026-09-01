---
type: Task
parent: "[[Canvas navigation]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Pan without interrupting the active editor task

## Evidence

[M00](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md) keeps Space+drag, middle drag and trackpad pan available during editing; the approved interaction principles make navigation an override, not a persistent tool.

## Why it matters

Switching tools to pan would discard or corrupt the creation work the user is moving to see.

## Approach

Exercise the existing pan override above tool routing, including button chords, pointer ownership and suppression of claimed browser defaults.

## Acceptance criteria

- Space+primary and middle-button pan work while a tool is active.
- Pan leaves active tool buffers and selection unchanged.
- Foreign pointers and mouse chords cannot steal or strand ownership.
- Navigation pointer moves produce no vault write.

## Risks

Synthetic tests can send pointer sequences real devices never produce.

## Outcome

Users move the camera at any time without sacrificing the task underneath it.

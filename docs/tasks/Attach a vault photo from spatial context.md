---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 30
status: New
horizon: "V1"
release: ""
---

# Attach a vault photo from spatial context

## Evidence

M14 pre-fills room, phase and optional work when adding a photo. [[Photo documentation]] and
[[Spatial photo references]] keep photos as ordinary vault files with subject and optional
location metadata.

## Why it matters

A photo is most valuable when its subject is captured immediately; asking the renovator to file
and relink it later loses the context the editor already knows.

## Approach

Provide choose/capture input that preserves the photo as a vault file, then dispatch the common
evidence relationship command with selected target, phase, description and optional point/work
references. Generate only derived thumbnail data.

## Acceptance criteria

1. New photo metadata inherits the selected target and chosen phase.
2. The original photo remains one ordinary vault file with no proprietary duplicate bytes.
3. Cancelling before commit creates no evidence relationship.
4. An unreadable thumbnail falls back to a labelled file row.
5. Opening the photo outside the editor uses its vault identity.

## Risks

- Platform capture behavior may differ between desktop and mobile.
- Thumbnail handling could accidentally become a second evidence store.

## Outcome

A renovator can capture a spatially contextual photo while retaining the vault as its authority.

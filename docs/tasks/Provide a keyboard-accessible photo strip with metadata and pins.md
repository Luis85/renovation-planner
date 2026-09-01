---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Provide a keyboard-accessible photo strip with metadata and pins

## Evidence

M08's photo strip requires keyboard selection, filenames or descriptions, metadata and the
relationship to a spatial pin.

## Why it matters

Thumbnail-only evidence is opaque to assistive technology and separates the photo from the place
whose current condition it proves.

## Approach

Project authority-owned photo links into a keyboard-operable strip. Give each item an accessible
description, expose its metadata and preserve bidirectional focus with its related spatial pin.

## Acceptance criteria

- Every photo is reachable and selectable by keyboard.
- Each item exposes a filename or description and relevant metadata.
- Selecting a photo identifies and focuses its related pin when one exists.
- Selecting the pin focuses the same photo without duplicating evidence.
- Missing or unreadable files are reported without dropping the relationship.

## Risks

Visual thumbnail order may be mistaken for persistent evidence or pin identity.

## Outcome

Room photos remain navigable, identifiable and spatially meaningful without pointer-only use.

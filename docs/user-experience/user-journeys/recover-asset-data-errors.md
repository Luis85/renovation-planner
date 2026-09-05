---
id: UJ-A07
title: "Recover from asset loading or saving errors"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL09-loading-and-errors.md"
    section: "AL09: operation-specific errors"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§8: asynchronous state matrix"
related_journeys:
  - UJ-A03
  - UJ-A08
---

# Recover from asset loading or saving errors

## Goal

Understand what is known and safely continue after a catalogue, section, or save failure.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The library reports a load, refresh, section-read, or write problem.

## Main flow

1. Read the specific operation status while known definition data and unaffected sections remain available.
2. For a read failure, retry the permitted read or reload only the affected section.
3. For a rejected write, retain the draft, correct the indicated issue, and save deliberately.
4. For a confirmed write followed by failed read-back, choose Refresh without replaying the write.
5. For an unknown write outcome, resolve status before deciding whether retry is safe.

## Alternatives and recovery

- A disappeared asset routes back to the library without editing another record.
- A newer schema requires a plugin update, not field editing as a repair.
- Unknown usage blocks deletion. Damaged geometry is not an absent outline.
- Loading never presents false zero counts; warnings remain until the affected state is resolved.

## Outcome

The user either regains readable current data or retains an honest status and a supported next action.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL09: operation-specific errors](<../asset-library-delivery/specification/screens/AL09-loading-and-errors.md>)
- [§8: asynchronous state matrix](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A03 — Edit a shared asset definition](edit-asset-definition.md)
- [UJ-A08 — Delete an asset without damaging references](delete-unused-asset.md)

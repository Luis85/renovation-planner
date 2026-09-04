---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Deliver rectangular room creation end to end

## Evidence

M03 requires drag, exact dimensions, type, name and calculated area to converge on one Room
creation; VS-04 maps that Room to the existing Zone model.

## Why it matters

The beginner path is useful only when one interaction reaches real domain validation and storage,
not a presentation-only rectangle.

## Approach

Build the draft overlay and form over a Room-oriented application command backed by the current
Zone creation boundary. Keep draft state local, derive area from geometry, and dispatch once at
confirmation. Cover domain, command, store and component behavior.

## Acceptance criteria

- Drag and numeric input produce equivalent command geometry.
- Name/type and geometry share one stable identity.
- Confirm creates one logical Room and selects it.

## Risks

Presentation adapters may duplicate Zone validation; delegate rather than reimplement it.

## Outcome

A homeowner can create and name a real rectangular Room in one guided flow.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **drag and numeric input produce equivalent command geometry** — is a fact about
the SHAPE before it is an assertion. One store,
`src/presentation/editor/add/room-draft-store.ts`, is written by the canvas drag
(`DrawRoomTool.pointerMove` → `setRect`) and by the two numeric fields
(`commitDimension`) alike; one action, `createRoomFromDraft`, reads its `geometry` getter and
builds one `ReversibleCreateZoneCommand`. There is no second path to converge, which is why
`tests/presentation/editor/add/roomCreation.test.ts`'s 'the numeric route and a drag of the same
size produce identical geometry' can compare two dispatched commands' inputs rather than two
implementations.

Criterion 2 — **name/type and geometry share one stable identity** — is the write path this
increment did not touch: `CreateZoneCommand` mints the `ZoneId` and
`ObsidianZoneRepository.save` writes the note and the sidecar entry as one logical write with
compensation. Held by
`tests/infrastructure/persistence/editorRoundTrip.test.ts`'s 'round-trips a rectangle created
through CreateZoneCommand as a polygon under one id'.

Criterion 3 — **confirm creates one logical Room and selects it** — is
`tests/presentation/editor/roomCreation.e2e.test.ts`'s 'drags a rectangle, names it, and Create
writes it, selects it and ends the task', which asserts the persisted name, the `Room` type, the
four points, the selection equal to the created id, `activeToolId === 'select'`, and both the
banner and the form gone.

Two decisions this task's Approach anticipated, taken and recorded:

- **The draft is a Pinia store rather than `RenderState`** — a recorded deviation from SDD §19,
  for two reasons the design spec states and the second decides it: the draft carries a name, two
  field drafts, two field errors and a checkbox, and it must OUTLIVE the gesture, because the
  numeric route creates a rectangle with no gesture at all. `RenderState` is untouched; the Konva
  sketch reads the store.
- **No Zone validation was reimplemented.** `createRoomFromDraft` refuses only on its own two
  conditions (`submitting`, and `!valid || geometry === null`) and delegates everything else. The
  second disjunct is reachable independently of the first, which needed its own case: a rect with
  a non-finite side is `valid` — the store's `valid` checks nothing about finiteness and says so —
  and `geometry` is `null`, because `createPolygon` refuses it.

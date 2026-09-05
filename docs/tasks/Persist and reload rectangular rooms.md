---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Persist and reload rectangular rooms

## Evidence

The vertical-slice specification requires Room metadata in Markdown and matching geometry in the
Plan sidecar, restored under one stable ID after reload.

## Why it matters

A rectangle visible only until the view closes is not renovation data, and a split identity
creates ghost or unselectable Rooms.

## Approach

Exercise the existing note-plus-sidecar write sequence through repository contracts and fixture
vaults. Verify compensation, user-body preservation, revision conflicts, reload mapping and
derived area. Add migration coverage only if an accepted schema change is necessary.

## Acceptance criteria

- Reload restores name, type and geometry under one ID.
- Partial write failure leaves no half-created Room.
- Existing valid fixtures continue to load or follow a tested migration.

## Risks

Metadata and geometry failures occur at different steps; tests must detonate each boundary.

## Outcome

Completed rectangular Rooms survive time and failure as one coherent entity.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **reload restores name, type and geometry under one ID** — is
`tests/infrastructure/persistence/editorRoundTrip.test.ts`'s 'round-trips a rectangle created
through CreateZoneCommand as a polygon under one id'. It builds its own Project and Plan and goes
through the REAL command rather than the file's `makeZone` fixture, then asserts the id, the name,
`zoneType === 'Room'`, the four points and `area() === 15_960_000`, and reads the persisted note's
own frontmatter back: `zone-type: 'room'` (kebab, gap #5), and none of `width`, `depth` or `room`
among its keys. A rectangle is stored as a polygon and nothing leaks into frontmatter to say
otherwise.

Criterion 2 — **partial write failure leaves no half-created Room** — is
`tests/presentation/editor/roomCreation.e2e.test.ts`'s 'a detonated save leaves no phantom room:
the badge reports it and the task survives'. It pins the surface as well as the absence: a
`Persistence` refusal is write-affecting, so `withSaveStateTracking` flips the save-state badge,
and slice 17 forbids the same failure being reported through a second widget — so the case
asserts the badge AND that `Notice.shown` did not move, over a live notice queue, because over an
inactive one the second half would be true of every build ever written. Beside that: one zone
still in the repository, nothing selected, the user's rectangle and name intact, the tool still
`draw-room`, and `submitting` back to false.

Criterion 3 — **existing fixtures load, or a tested migration** — is discharged by there being no
schema change at all. No frontmatter key moved, no `schemaVersion` moved, no migration step was
registered, and every fixture under `tests/vault/` and `tests/fixtures/` is untouched. The
round-trip case is the instrument that says so rather than this sentence.

What none of that reaches is a REAL reload: the fixture vault has no asynchronous
`MetadataCache`, which is the defect class [[Smoke Test the Editor]]'s own header tabulates.
[[Add a room]] step 8 is the instrument, and it has not been run in a vault.

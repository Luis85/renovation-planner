---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 40
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Suggest a localized Room name from its type

## Evidence

M03 says choosing a Room type suggests a default localized name.

## Why it matters

A useful suggestion speeds common creation without persisting internal or untranslated vocabulary.

## Approach

Map approved Room types to localized suggested names, apply a suggestion only while the name remains
user-untouched, and keep the field editable. Test both locales, fallback and type changes.

## Acceptance criteria

- Choosing a Room type offers its localized suggested name.
- A name the renovator edited is never overwritten by a later type change.
- Confirmation persists the visible name, not a translation key or internal type.
- Missing locale copy follows the established fallback.

## Risks

Automatic replacement can erase deliberate naming.

## Outcome

Common Rooms receive helpful localized names without taking naming control from the renovator.

## Closing evidence

**2026-09-04**, the Add Room increment — and the criterion this task turns on was met by
building LESS than it names, which is recorded here rather than glossed.

**There is no room TYPE to choose.** `Zone` has no such field: `ZoneType` is the Room/Area
classifier (ADR-0016) and Add to Room has already decided it is `'Room'`. Persisting a room kind
would be a new frontmatter key — additive at v1, but a MODEL decision with no consumer in this
increment. So the form asks **"What room is this?"** with a row of six suggestion buttons
(Kitchen, Living room, Bedroom, Bathroom, Hallway, Office) that set the NAME and nothing else.
The model question is registered as gap #6 and deferred **ADR-RK** in
`docs/development/consolidation/2026-09-editor-model-consolidation.md`, with its trigger: the
first consumer that must QUERY by kind.

That is exactly what criterion 3 asks for — *"Confirmation persists the visible name, not a
translation key or internal type"* — and it is held by
`tests/presentation/editor/shell/newRoomInspector.test.ts`'s 'a suggestion sets the name; Create
is aria-disabled until the draft is valid, with the reason described', which reads the store's
`name` back after pressing the localized button, and by
`tests/presentation/editor/roomCreation.e2e.test.ts`'s first case, which reads 'Kitchen' out of
the persisted zone note.

Criterion 1 — **a localized suggested name** — is the six `editor.room.suggestion.*` keys
resolved through `tr()` at the call site, so the button's own label is what lands in the field.
Both locales are complete (`tests/presentation/i18n/strings.test.ts`'s completeness case), which
is also criterion 4: the fallback is the established one, `t()` answering the English value for a
key the German table lacks — and the German editor table cannot lack one, being typed
`Record<keyof typeof editorEn, string>`.

Criterion 2 — **a name the renovator edited is never overwritten** — is `nameTouched` in
`room-draft-store.ts`: the counted default (`Room {n}`) is applied by `beginTask` alone, and both
`setName` and `suggestName` mark the name touched, so nothing later overwrites it. Held by
`roomDraftStore.test.ts`'s 'suggestName sets the name as an explicit gesture, like setName' and
'beginTask resets keepAdding and the name; clearRect keeps both; reset drops the name'. The
clause's own subject — "by a later TYPE change" — has no producer, for the reason above.

---
type: Task
parent: "[[Start room creation from Add]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Define the Add-to-room creation contract

## Evidence

M02 specifies one Add menu, homeowner labels and one-shot tools; VS-03 requires Add → Room
before any Room geometry is written.

## Why it matters

Without one contract, toolbar, keyboard and empty-state entries can start different tools or
expose Zone/Polygon vocabulary.

## Approach

Define the Room catalog entry, availability, activation result and cancel state across
application and presentation boundaries. Map Room to the existing Zone-backed creation capability
without changing persisted terminology. Add contract and localization tests.

## Acceptance criteria

- Room has one canonical activation contract used by every input.
- Availability and start failures are typed and testable.
- User-visible labels contain no internal geometry terms.

## Risks

The catalog may become a second tool registry; keep activation delegated to the existing runtime.

## Outcome

Every Add surface can ask one tested contract to start Room creation.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **one canonical activation contract** — is `activateCreationEntry(id, runtime)` in
`src/presentation/editor/add/creationCatalogue.ts`, a `Record<CreationEntryId, CreationEntry>`
lookup with no "not found" arm, because the id union is closed and the catalogue carries exactly
one entry per member. Held behaviourally by
`tests/presentation/editor/add/creationCatalogue.test.ts`'s 'activateCreationEntry is the one
door: Room reaches setTool("draw-room") exactly once', and structurally by that file's two
SOURCE-TEXT cases, which read `PlanEditorRoot.vue` and `AddMenu.vue` and require the call while
refusing `setTool('draw-`, `entry.activate(` and `.activate(runtime`.

**The structural half is there because the claim was false when it was written.** `AddMenu.vue`
called `entry.activate(runtime)` directly — the same closure, so every behavioural case passed —
beneath a docblock in `creationCatalogue.ts` asserting that both doors "call this and nothing
else". A review round found it; no gate could. The catalogue was a contract one caller happened
to satisfy rather than a door both went through.

Criterion 2 — **availability and start failures are typed** — is half met, and the other half is
VACUOUS rather than ticked. Availability is typed and tested ('every unsupported entry carries a
reason and throws if activated'), so an unsupported entry fails LOUDLY in a test. A start
FAILURE has no producer: activation is `runtime.setTool('draw-room')` over a registered id, which
cannot refuse. Recorded here rather than represented by a test that would pass against anything.

Criterion 3 — **no internal geometry terms** — is `tests/presentation/i18n/strings.test.ts`'s
'says Room and never Zone anywhere a homeowner reads the editor' and
`creationCatalogue.test.ts`'s 'contains no internal vocabulary in either locale'. Both ask the
question of BOTH locale tables.

---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Model connected wall drafting over the wall prerequisite

## Evidence

M04 requires a temporary connected segment chain, exact current length, snapping and local
undo; its Wall domain does not exist in the current editor model.

## Why it matters

Draft interaction must not invent persistence or topology rules that belong to the Wall prerequisite.

## Approach

After the prerequisite lands, define a presentation/application draft contract using its Wall
IDs and validated command inputs. Support segment preview, exact length, undo-point and cancel
without repository writes. Test pointer, keyboard and interruption paths.

## Acceptance criteria

- Drafts use prerequisite contracts rather than duplicate Wall rules.
- No segment persists before Finish.
- Exact length and pointer placement update one draft chain.
- Cancel and interruption leave no Wall records.

## Risks

Starting before the prerequisite stabilizes would encode speculative Wall shapes.

## Outcome

Connected Wall drawing has a cancellable draft built on the accepted Wall model.

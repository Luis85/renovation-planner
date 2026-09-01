---
type: PBI
parent: "[[Document linking and types]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Link evidence to spatial targets

## Actor

[[Private renovator]], while reviewing a room, wall, opening or other canonical spatial object.

## Main flow

1. The renovator chooses an existing vault file or note as evidence.
2. They select one or more canonical spatial targets, with the current context prefilled where
   available.
3. The application stores a relationship carrying the evidence identity, target identities and
   a minimal evidence type or phase when supplied.
4. The renovator can retrieve and open the same evidence from each linked spatial target.
5. The file remains ordinary vault content and the relationship remains usable outside the
   canvas.

## Extensions

- **1a** — The file is outside the vault or unsupported. Linking is refused; the plugin does not
  create a hidden private copy.
- **2a** — A target is missing, unreadable or belongs to an incompatible project. No partial
  relationship is silently accepted.
- **3a** — The same evidence-target pair already exists. Linking is a no-op.
- **4a** — The evidence file is later renamed. Stable vault resolution updates or preserves the
  link according to the canonical file-link policy.
- **4b** — The file is missing or unreadable. The relationship stays visible as unresolved and
  does not make the target appear to have no evidence.

## Guarantee

Evidence remains canonical vault content and every spatial association is an explicit,
queryable relationship to stable domain targets. The plan editor may display that relationship
but never owns a second evidence catalogue.

## Out of scope

- Photo capture, thumbnails, numbered canvas pins and directional camera metadata.
- Deliveries, procurement workflows, execution completion evidence and as-built records.
- Evidence timelines, retention policy and remote blob storage.

## Acceptance criteria

1. One evidence record can link to more than one stable spatial target without copying the file.
2. Querying any linked target returns the same canonical evidence identity.
3. Duplicate links are not created.
4. Renaming ordinary vault content follows the canonical link policy.
5. Missing, unreadable, empty and available evidence are distinct results.
6. The relationship can be followed through a non-canvas route.
7. No evidence bytes are written outside the vault or into a proprietary store.

## Assumptions

1. V1 needs linking and contextual viewing only; richer capture and execution semantics remain
   later.
2. Exact phase vocabulary may be extended later without changing the evidence-target relation.

## Sources

M14 Room Evidence read narrowly to contextual linking/viewing; the editor implementation plan
Phase 11; the first vertical slice plan's reserved Evidence seam; PRD §23, §44, §60 and §83.

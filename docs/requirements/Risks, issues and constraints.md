---
type: Epic
order: 160
status: ""
started: ""
finished: ""
horizon: "V2"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Risks, issues and constraints

§26 asks for the things that are true whether or not anybody wrote them down: asbestos suspected
under the floor, a party wall that needs the neighbour's agreement, a permit not yet granted, a
supplier with a twelve-week lead time. They are what actually determines whether a renovation
finishes on the plan it started with, and they are invisible in a model that holds only zones,
costs and dates.

The epic has to keep three different things apart, which is why the PRD names all three. A
constraint is certain and bounds the plan. A risk is uncertain and is managed, with §26's
probability, impact, exposure, mitigation and owner. An issue has already happened and needs
resolving. Collapsed into one list they become a wall of unranked worry, and the ranking is the
only reason to keep the list.

Because each of them names an affected area (§26), a spatial marker falls out of the link rather
than being placed separately — the same relationship [[Documents, photos and evidence]] uses.

Derived from PRD §26 (Epic 15), with accessibility from §44 and the note conventions in
`docs/README.md` for what an accepted limitation reads like.

## Definition of done

An item beneath this epic is done when:

- A risk carries §26's properties, and exposure is derived from probability and impact rather
  than typed. A typed exposure is an opinion wearing a number's clothes.
- Constraint, risk and issue stay distinguishable in the model, not three tags on one entity.
- A spatial marker is a consequence of the affected-area link, not a second placement that can
  disagree with it.
- Markers are not colour-only (§44) and everything shown on a plan is also in a list.
- An accepted limitation is recorded as accepted, so it does not read as something somebody is
  about to fix — the same distinction `docs/README.md` draws between a Bug and an Issue.

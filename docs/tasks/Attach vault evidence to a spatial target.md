---
type: Task
parent: "[[Link evidence to spatial targets]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Attach vault evidence to a spatial target

## Evidence

M14 requires documents, photos and notes to inherit spatial context, while the current domain
has no common evidence-target relationship.

## Why it matters

Without one canonical link, each editor section will invent a different attachment mechanism or
copy files into private storage.

## Approach

Define the minimum relationship between an ordinary vault file/note and stable spatial target
IDs, validate project compatibility, and create it through one command.

## Acceptance criteria

- One evidence item can link to one or more stable spatial targets.
- Files remain ordinary vault content and are never duplicated privately.
- An incompatible or missing target refuses the whole requested link.
- Repeating an existing evidence-target pair writes nothing.

## Risks

Using a path as identity can break on rename; the task must follow the accepted canonical vault
link policy.

## Outcome

Not started.

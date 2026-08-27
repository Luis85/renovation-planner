---
adr: 13
title: A Project's Folder Is Derived From Its Note
status: Accepted
date: 2026-08-27
area: persistence
---

# ADR-0013: A Project's Folder Is Derived From Its Note

## Context

PRD §83 puts "project folder" under Project Settings and forbids the library folder and a
project folder from containing one another. The code today has one plugin setting,
`projectFolder`, that every project nests directly inside — the root every renovation shares,
not one renovation's own folder. §83's rule cannot be stated against that shape, because "the
project folder" does not name a single thing: it is either the shared root or something
per-project, and the code has only the former.

Two shapes close that gap. A **stored field** — `Project.folder`, persisted as `folder:` in the
note, schema-bumped — is what §83's word "setting" literally says. A **derived** folder — the
folder the project's `Project.md` sits in, computed and never written down — is not.

ADR-011 already chose between the same two shapes once, for the geometry sidecar folder, and
chose derived: a project-scoped `Geometry/` subfolder rather than a plugin-wide configurable
one, specifically so that *"there is no setting left holding a path that has quietly gone
stale"* and so that a project moves, backs up and deletes as one folder. PRD §36's 2026-08-26
amendment restates that same property in the project's own words: "The project folder still
moves, backs up and deletes as one unit." A stored `folder:` field cannot honour that sentence
on its own — the note and the field can disagree the moment a user drags the folder in
Obsidian's file explorer, and nothing re-derives the field to match.

## Decision

**A project's folder is `parentOf(<its Project.md>.path)`.** Nothing is persisted, and no
schema version moves.

**ADR-011's precedent, applied one level up.** ADR-011 chose a project-scoped sidecar folder so
that a project moves as one unit and no setting is left holding a path that has quietly gone
stale. The derived project folder is the same argument applied to the project's own location
rather than to its geometry: deriving it from the note's path is what preserves the "moves as
one folder" property PRD §36's amendment now states explicitly, and a stored field is exactly
the setting ADR-011 already refused once.

**Why [[Identity is the id, never the filename, title or path]] does not forbid this.** That
rule governs *identity* — which project this is, which note answers to a given `id`, what a
reference resolves through. It says a rename or a move must not orphan a reference, and every
repository already resolves by `id` through the Project Index for exactly that reason. A
derived folder answers a different question: not *which project is this*, but *where do this
project's other notes go*. Reads still resolve through the index by `id`; only the *write*
target for a new Plan, Zone, Requirement or Asset note is computed from the Project note's
current path. The rule's name reads as though it settles the folder question, and it does not —
it settles what identity may never depend on, and a derived folder does not make identity
depend on a path; it makes a *write location* depend on one, which the rule is silent about.

**The deviation from PRD §83.** §83 lists "project folder" under Project Settings, alongside
things a user actually configures. The derived shape makes it not a setting at all — there is
no control that sets it, no field that stores it, and no value to inspect anywhere except by
asking where the note currently is. The deviation is stated here rather than left for the code
to quietly disagree with the PRD: what remains a *setting* is the **default projects folder**,
the root a *new* project's folder is created under. That setting stays configurable and stays
real; it just stops being the answer to "where is this project" for any project that already
exists, because that question is answered by the note's own path instead.

## Rejected alternative

**A stored `folder:` field on `Project`.** It is what §83's word "setting" literally says, and
its cost is ADR-011's own argument turned against it: *"there is no setting left holding a path
that has quietly gone stale."* A stored folder goes stale the first time a user drags the
project's folder in Obsidian's file explorer — an ordinary gesture the vault does not ask this
plugin's permission for — and every subsequent write then lands beside the user's work rather
than in it, since the write target is the stale field rather than the note's real location. It
also buys nothing on discovery: finding a vault's projects still means finding its `Project.md`
notes either way, whether or not each one also carries a redundant `folder:` field naming where
it already is.

## Consequences

- **A project moves as one folder**, in the same sense ADR-011 secured for its geometry: moving
  or renaming the project folder in Obsidian carries every entity note that is written *after*
  the move to the new location, because the folder is read from the Project note's current path
  at write time rather than from a cached or stored value.
- **Discovery still means finding `Project.md` notes.** A derived folder does not change how a
  vault's projects are found; it only changes what a project's folder is *called*, once found.
- **The write target for a new entity note is computed, not cached.** `NoteVaultDeps.projectFolder`
  — a single shared root cached once per repository — has no derived equivalent: a per-project
  folder is not known at construction time, so each write resolves it from the entity being
  written, through the Project Index.
- **The setting that remains is the default projects folder** — the root a *new* project's
  folder is created under, and nothing more. It stops being the answer to "where is this
  project" the moment the project exists, because from then on the answer is wherever the
  user has put it.
- No note kind, frontmatter key or schema version changes because of this decision. A vault
  already holding `Renovation/Project.md` with `Renovation/Plans/…` beside it already satisfies
  the derived rule — that root *is* the folder its `Project.md` sits in — so no existing vault
  needs anything moved on account of this ADR alone.

## Alternatives

- **A stored `folder:` field on `Project`** — rejected above, on ADR-011's own precedent turned
  against it: a setting holding a path that has quietly gone stale, bought at the cost of a
  schema bump for a value discovery does not need.
- **Both**: a stored field kept in sync with the note's actual location by a write-time repair —
  rejected as strictly more moving parts than the derived shape for the same answer, and as a
  second derivation of the same fact the note's path already states; a value kept in sync with
  its own source of truth is redundant with that source, not a safeguard on it.

## Revisit when

A project's folder needs to be **chosen independently of where its note is created** — for
example, a creation flow that lets a user place `Project.md` somewhere transient and then
name a different folder for everything else the project owns. Nothing in this slice or the
slices it unblocks asks for that; today choosing a project's folder and choosing where its note
lives are the same act.

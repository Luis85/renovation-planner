---
type: PBI
parent: "[[Create a project]]"
order: 10
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Start a renovation project

The first thing anyone does with this plugin, and the one act every other note in this
backlog assumes has already happened. PRD §52 puts "create a renovation project" first in the
twelve things a first version must let somebody do, and PRD §5's journey starts in the same
place.

What it replaces is a folder and a note made by hand. An Obsidian user does not lack a way to
start — they lack a start that leads anywhere. A hand-made note is text: it cannot be drawn
on, and it cannot add up. Creating a *project* is the price of admission to a plan with
measurements on it and a budget that totals itself, and this use case is that admission being
granted in a few seconds rather than being the first thing that makes somebody close the
plugin.

The situation it is written for is a vault made for the renovation — a fresh one, nothing
else in it. The existing-vault user is not a separate case here: the folder is a prefilled
field in step 4, which is what [[Create a project]] means by a default good enough to accept
without thought and a path that can be overridden.

## Actor

[[Private renovator]] — PRD §4's primary persona, renovating their own house and garden.

## Preconditions

- Plugin settings loaded successfully. A failed settings load leaves the composition root
  with no repositories at all — the `settings === null` case in
  [`docs/design/01-plugin-bootstrap-and-composition-root.md`](../design/01-plugin-bootstrap-and-composition-root.md)
  — and what the plugin should do about that belongs to
  [[Error handling and diagnostics]], not here.
- The vault holds no project yet. Creating a second project alongside a first raises
  questions this note does not answer — how projects are told apart, whether one is active —
  and none of them are settled anywhere in this register.

## Main flow

1. The renovator opens the Renovation project view, from the ribbon button or the command
   that opens it.
2. The view has no project to show, and says so, offering one action.
3. The renovator triggers creation — from that action, or from the create command in the
   palette. Both reach one function, per CLAUDE.md's one-action-every-input rule; neither is
   a second, independently decided way to create a project.
4. A modal asks for the project name, and shows the renovation folder, the currency and the
   unit system prefilled from plugin settings. Every one of them is overridable.
5. The renovator accepts the defaults or edits them, and submits.
6. The plugin creates the renovation folder if it is absent, and writes one project note into
   it, named after the project. The note carries a stable `id` independent of its filename, a
   `schema-version` (PRD §61), the name, the currency, the unit system, the tax defaults and
   the renovation folder as *its own* values, and a status of `IDEA`. No other folder is
   created: PRD §36's `Plans/`, `Zones/` and the rest appear when something is first written
   into them.
7. The view shows the new project.

## Extensions

- **4a** — The name is empty or contains only whitespace. Submission is refused at the field,
  and nothing is written.
- **4b** — A note with that basename already exists. Refused before submit, naming the note it
  clashes with, so the renovator can rename in the second they are already standing there. The
  deduplication described in
  [`docs/design/04-persistence-and-repository-layer.md`](../design/04-persistence-and-repository-layer.md)
  remains the backstop for writes made with no human present; it is not what happens here.
- **4c** — The renovation folder already exists. It is reused, and its contents are left
  alone. It is refused only if it already holds a project.
- **5a** — The renovator cancels. Nothing is written: no note, and no folder.
- **6a** — The folder is created and the note write fails. The folder *this flow created* is
  removed, and the failure is reported. A folder that already existed is never removed.
- **6b** — The path is invalid after `normalizePath`, or the location cannot be written to.
  Refused before anything is written, with the reason.

## Guarantee

Either a complete project exists — one note, a stable id, its own settings on it, in a folder
the renovator was shown — or the vault is exactly as it was. Never anything between, and a
rollback never removes a folder it did not create.

## Out of scope

Named here rather than left looking forgotten:

- The empty state's copy and its selection logic, and the example project —
  [[Onboarding and example project]]. This use case cites the empty state as its trigger and
  specifies none of it.
- The nudge toward importing a plan afterwards, PRD §93's onboarding chain — same note.
- Changing any of these settings later — [[Project settings]].
- A settings load that failed, and everything else about a degraded plugin —
  [[Error handling and diagnostics]].
- A second project alongside a first, per **Preconditions**.

## Acceptance criteria

1. Creating a project writes exactly one project note, in the folder the modal showed, with
   an `id` that does not change when the note is renamed or moved (SDD §82).
2. The note's frontmatter carries the currency, unit system, tax defaults and renovation
   folder as its own values. Changing the plugin default afterwards moves no figure in the
   project — which is [[Project management]]'s "a figure shown in the wrong currency is not a
   rounding difference", made checkable.
3. A name of only whitespace cannot be submitted.
4. A name whose basename is already taken is refused before submit, and the message names the
   note it clashes with.
5. Cancelling leaves no new note and no new folder. Checkable in a vault in seconds.
6. A write failure after the folder is created leaves no note and no new folder, and reports
   the failure.
7. A renovation folder that already existed still holds everything it held before, after a
   success and after a rollback alike.
8. The project note opens and reads as plain Markdown with the plugin disabled (PRD §44).
9. The empty state's action and the create command reach creation through one function,
   proven by a spy on that function rather than by driving both paths and comparing results.

## Assumptions

Each of these is something this note decided that its sources did not settle.

1. **This use case forces a design change.** The `Project` entity in
   [`docs/design/03-domain-foundation-project-plan-zone.md`](../design/03-domain-foundation-project-plan-zone.md)
   carries `budget`, `contingency`, dates, `status` and `locationDescription`, and no
   currency, unit system, tax defaults or project folder; `CreateProjectCommand` takes none of
   them either. PRD §83 assigns all four to project scope, [[Project]] states that a project
   defines the currency every [[Money]] value in it is denominated in (PRD §72), and
   [[Project management]]'s definition of done requires downstream code to read them from the
   project rather than from a plugin default. The entity and the command have to gain them.
   That is an edit to a derived design document, which
   [`docs/design/README.md`](../design/README.md) expects — but it is a change, not a reading
   of what is there today.
2. **Tax defaults have no modelled shape anywhere.** PRD §83 names them; no slice types them.
   Criterion 2 is written so it becomes checkable once somebody decides what they are.
3. **The project note is named after the project**, deduplicated on collision, per
   [`docs/design/04-persistence-and-repository-layer.md`](../design/04-persistence-and-repository-layer.md).
   PRD §36 draws `Renovation/Project.md`, but that section is headed "Recommended structure"
   and closes with "Paths must be configurable", so this refines a recommendation rather than
   contradicting a mandate. [[Project]] had hardened it into identity and has been corrected
   in the same change as this note.
4. **`status` defaults to `IDEA`**, following slice 3's own stated assumption that PRD §35's
   renovation lifecycle is `Project.status`.
5. **Basename uniqueness is checked vault-wide**, not per folder, because that is the scope at
   which Obsidian resolves a wikilink.
6. **This note carries acceptance criteria**, which [`docs/README.md`](../README.md)'s PBI
   shape does not list — it asks for the actor, the main flow and the extensions. Being the
   first PBI in this register, it sets that precedent, and the precedent is deliberate: the
   criteria are what make the guarantee checkable rather than merely stated.
7. **Where the flow ends**: the project exists and the view shows it. Getting from there to an
   imported plan is PRD §93's chain and belongs to [[Onboarding and example project]].

## Sources

PRD §4 (target users), PRD §5 (core user journey), PRD §12 (Epic 1 — Project Management),
PRD §36 (Vault Data Model), PRD §44 (Non-Functional Requirements), PRD §52 (Product Success
Criteria, item 1), PRD §61 (Schema Versioning), PRD §72 (currency), PRD §83 (Configuration
Model), PRD §93–94 (Onboarding, Empty States); SDD §82 (entity identity).

Design slices read for this note: 01 (composition root and settings), 03 (the `Project` entity
and `CreateProjectCommand`), 04 (filenames, folders, persistence), 14 (the no-project empty
state), 15 (modals), 16 (form validation).

Every section number here names its document. `docs/design/` reads a bare `§` as the SDD and
`docs/requirements/` has read it as the PRD, and the two documents number independently — PRD
§83 is the Configuration Model, SDD §83 is Entity References.

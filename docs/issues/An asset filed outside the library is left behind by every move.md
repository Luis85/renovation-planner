---
type: Issue
parent: "[[Asset library]]"
order: 30
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# An asset filed outside the library is left behind by every move

The behaviour is what Task 5 built, and whether it is right was never decided. A library move can
split a catalogue in two with nothing reporting it.

## The question

`catalogueNotesIn` selects the notes to move by intersecting the index's asset entries with the
notes under the source folder:

```ts
return files.filter((file) => catalogue.has(file.path) && file.path.startsWith(root));
```

An asset note filed anywhere else is excluded. It stays where it is while the setting comes to
name a different folder, and nothing says so — a move that relocates too few notes raises
nothing, which is the hazard `catalogueNotesIn`'s own docblock names for a different cause.

## What is true today

- **The intersection implements what Task 5 built — but "the rule" overstates it, and an
  earlier draft of this note did.** Updates write where the note already sits and only
  *inserts* go to the library, so such a note never moves. Enumerating by entity type alone
  would change that silently, which is why the intersection is there.
- **It was never decided, and it was never written down.** The status lives in the slice plan's
  *Open questions*, under a header reading *"These need a decision and I have not taken them"* —
  item 3, which closes *"Worth stating in `docs/tasks/19` rather than discovering later."* That
  statement was never made: `grep -n "outside the library" docs/tasks/19*.md` returns nothing.
  So this is a behaviour that shipped, was flagged as needing a decision, and then lost its
  flag. A first draft of this note cited `docs/tasks/19` for a rule that is not in it, and
  presented the open question as settled — which would have made "report it" look like the
  small option on top of an agreed position rather than one of two live answers.
- **The catalogue is not broken by it.** Since design slice 18 the index is bounded by what a
  note declares, and `listAll` reads the type axis rather than a folder, so a stray asset stays
  discoverable, readable and updatable.
- So this is a tidiness problem rather than a correctness one — and an invisible one, which is
  the part worth changing.

## Alternatives weighed, and why they were not taken

- **Report the count without moving anything.** "N asset notes are filed outside the library",
  on the settings row or in the migration's result. The smallest thing that stops the split
  being invisible, and it forecloses neither of the others. **Not** presented here as the
  preferred answer, which an earlier draft did on the strength of a decision nobody had taken.
- **Offer to include the strays.** Ask, and move them too when the user says yes. Needs a
  surface, and needs care that the existing code does not: `deps.renameFile` collisions become
  possible the moment two strays share a leaf name, and the move's relative-path arithmetic
  (`note.path.slice(source.length + 1)`) has no meaning for a note outside the source at all.
- **Keep silent.** Defensible if filing an asset elsewhere is an explicit choice that a
  folder-setting change should not second-guess. It is the current behaviour, reached by
  omission rather than by decision — which is the whole reason this note exists.

## Why no gate saw it

The non-move IS tested, and a first draft of this note said otherwise —
`tests/plugin/settings/libraryMigration.test.ts`'s *'leaves an asset filed outside the library
where it is'* indexes `Elsewhere/Paint.md` alongside an in-library note and asserts the rename
list holds only the in-library one. The behaviour is correct by the rule it implements and it
is pinned.

What no gate covers is the **reporting**, because there is none to cover. That is the whole of
the gap, and it is not a coverage problem: a silent non-move is indistinguishable from having
nothing to move, and no test can ask for a sentence nobody has decided to write.

## Why it matters

- A library move is the moment a user believes they have consolidated the catalogue. Coming
  away with it split, told nothing, is worse than never having moved it.
- The related case is already handled loudly and the contrast makes the silence odd: a source
  folder differing from the vault's only in case raises
  `settings.library-source-case-mismatch`, precisely because an exact enumeration would then
  look in the wrong place and move nothing while reporting success.

## What closes it

The reporting option, unless somebody argues for the second. It needs a decision about where
the count appears — the informational settings row already names the current folder and is the
obvious home — and a decision about whether "outside the library" is computed per read or only
during a move.

## References

- `src/plugin/settings/libraryMigration.ts` — `catalogueNotesIn` and its docblock on the
  source intersection, and the case-mismatch refusal for the contrast.
- `docs/superpowers/plans/2026-08-30-slice-19-asset-catalogue-leaves-the-project.md` — *Open
  questions*, item 3. Note the header: undecided, not decided.
- `docs/tasks/19-the-asset-catalogue-leaves-the-project.md` — where item 3 says this should
  have been recorded, and is not.
- PR #41.

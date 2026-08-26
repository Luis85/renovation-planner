---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 60
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

# Settings and configuration

**The plugin half of §83, whatever that section lists** — today default units, default currency,
default folders, the library folder and editor preferences — plus §84's custom types, which is the
mechanism by which zone, asset, trade, document and cost vocabularies stay the user's rather than
the plugin's. The scope is *§83's plugin half*, not the words after the dash: this feature tracks
that section, so a setting added there is in scope here without anybody editing this sentence. It
is written that way because the list had already gone stale once — the library folder arrived in
§83 with the 2026-08-26 amendment and was missing here until review caught it. The project half of
§83 belongs to [[Project settings]].

One surface for all of it, because §83's own split is the only division a user should have to
understand: this applies to every project, that applies to this one.

**Not everything here is a default**, and the test for which is whether §83's *project* half has a
counterpart. Default units, default currency and default folders have one — a project states its
own units, currency and folder, and the plugin value is only where a new project starts. The
**library folder** and **editor preferences** have none, so both are settled once for the vault and
no project overrides either.

Naming the test rather than counting is deliberate. An earlier wording here said "four of the five"
are project-overridable, which was wrong about editor preferences and would have gone stale the
next time §83 gained a setting — the same defect as the enumeration two paragraphs above, made
twice in one branch.

The library folder's own reason is the sharper one: the shared [[Asset]], [[Supplier]] and
[[Trade]] catalogues belong to no project (§59), so there is nothing to disagree with it. That is
why §83 puts it in the plugin half, and why the outcome below is stated in two parts rather than one.

**Changing the library folder is a migration, not a preference.** Once catalogue entries exist,
persisting a new path alone would leave every project resolving an empty library while the notes
sat at the old one. So the setting **moves the catalogues, rebuilds the index, and refuses the new
value until the move has succeeded** — which is not a new invention: ADR-011 specified exactly that
behaviour for a configurable storage path, and named its cost as a reason to avoid having one where
it could be avoided. Here it cannot: a shared library has no project folder to derive its location
from. So the cost is accepted and written down rather than discovered. *How* the move is made
atomic belongs to the slice that builds this surface. It also **refuses a destination that
overlaps any project folder** — §83's rule, checked from this side too, because the library is as
able to move into a project folder as a project folder is to be set around the library.

## Outcome

A renovator sets their defaults and their own type vocabularies once, and every project starts from
them — and the one shared catalogue location is set once for the vault, where every project finds
the same library.

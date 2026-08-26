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

**Not everything here is a default.** Four of the five are starting values a project may then
disagree with; the **library folder** is not, because there is nothing to disagree with it — the
shared [[Asset]], [[Supplier]] and [[Trade]] catalogues belong to no project (§59), so their
location is answered once for the vault and no project overrides it. That is precisely why §83
puts it in the plugin half, and why the outcome below has to be stated in two parts rather than one.

## Outcome

A renovator sets their defaults and their own type vocabularies once, and every project starts from
them — and the one shared catalogue location is set once for the vault, where every project finds
the same library.

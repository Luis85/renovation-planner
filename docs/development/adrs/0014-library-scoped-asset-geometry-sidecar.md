---
adr: 14
title: Library-Scoped Asset Geometry Sidecar
status: Accepted
date: 2026-08-30
area: persistence
---

# ADR-0014: Library-Scoped Asset Geometry Sidecar

## Context

An `Asset` is about to gain a shape — a footprint polygon, a clearance boundary, an anchor, a
facing angle and the provenance flags that say which of those still await a scale. That is
coordinate data, not frontmatter: it is the same kind of payload ADR-002 put in a per-plan JSON
sidecar and for the same reason, so the question this ADR answers is only *where the file goes*.

ADR-011 answered that question for plans and stated the principle it answered it with: *"the unit
that owns data here is the project"*, so a plan's sidecar is derived from the project's own folder
rather than configured a second time. An asset is not owned by a project. Design slice 19 takes
`projectId` off `Asset` and moves the catalogue into a **library folder** — one per vault, one
plugin setting, PRD §83, drawn at `Renovation/Library/` in PRD §36 — because a catalogue entry is
shared by every project that references it. So the owning unit of an asset is the library, and
ADR-011's reasoning applies with that one noun changed.

`libraryFolder` does not exist yet: it arrives with design slice 19, together with the `Assets/`
folder inside it. Nothing decided here is implementable before that slice lands.

## Decision

**An asset's geometry sidecar lives in a `Geometry/` subfolder of the library folder**, a sibling
of the `Assets/` folder slice 19 puts the catalogue notes in:

```text
Renovation/Library/               ← the library folder, one plugin setting (PRD §83)
├── Assets/
│   ├── Base cabinet 600.md
│   └── Worktop oak 40mm.md
└── Geometry/
    ├── asset-01JABB3C5D7E9F1G3H5J7K9M1N.rpgeo
    └── asset-01JABC4D6E8F0G2H4J6K8M0N2P.rpgeo
```

The path is `<libraryFolder>/Geometry/<assetId>.rpgeo`. There is **no second setting for it**. The
`Geometry/` name is fixed the way `Assets/` is fixed inside the library; what varies between users
is where the library folder is, and that is one setting, one level up, which a user has already set
for reasons that have nothing to do with geometry.

Each sidecar is named by the asset's stable ID **in full, prefix included** — SDD §82's identity
model gives every ID a `<prefix>-<ULID>` shape and `AssetId` spells that prefix `asset`, so the
note's `id` field, the sidecar's own `assetId` field and the filename are the same string and are
comparable without a strip-or-add step that only one of the three code paths remembers. Never by
the asset's display name: [[Identity is the id, never the filename, title or path]], so renaming an
asset never orphans its geometry file and two assets sharing a display name never collide. The
sidecar carries `assetId` where the plan's sidecar carries `planId`.

The extension is `rpgeo`, the same one plan geometry uses, and **no new registration is owed**:
`RenovationPlannerPlugin` already calls `registerExtensions(['rpgeo'], GEOMETRY_SIDECAR_VIEW)` at
load, so an asset's sidecar is visible and manageable in Obsidian's file explorer the day it is
first written. The content is a different document from a plan sidecar's — its own schema, its own
`revision` — and the two are told apart by what is inside the file, not by its extension.

## Consequences

- Uninstalling the plugin, or moving asset notes around inside the library, never touches geometry
  data — it stays in one predictable folder per vault, which is also a natural place to point a
  backup or export at. This is ADR-011's own guarantee, scoped to the library instead of to a
  project.
- Asset geometry is **pooled, not separated**, and that is the deliberate difference from ADR-011's
  per-project split. There is one library per vault, so there is one asset `Geometry/` folder and
  nothing to filter out of it. The property ADR-011 bought by scoping — that deleting a project's
  folder deletes exactly that project's geometry — has no analogue here, because deleting a project
  must not delete a catalogue entry every other project may reference.
- **A `libraryFolder` change must move `Geometry/` with `Assets/`**, inside slice 19's own
  settings migration — validate, move, rebuild the index, and persist the new value only then.
  Asset geometry joins that one move rather than getting a second one, so a stale path cannot
  survive the setting: if the move fails, `data.json` is untouched and the sidecars are still where
  the still-current setting says they are. Without it the store would resolve sidecars under the
  new folder the instant the setting persisted and every designed shape would read as absent —
  silently, because a missing sidecar is a shapeless asset rather than an error.
- **An asset note filed outside the library still keeps its geometry inside it.** Since ADR-0013 a
  note is found by what it DECLARES rather than by where it sits, so an asset note anywhere in the
  vault is indexed and usable; slice 19's migration moves the notes that are in the library folder,
  which by definition is not that one. Its sidecar is written under `<libraryFolder>/Geometry/`
  regardless, because the path derives from the setting and not from where the note strayed. That
  is the intended answer — one geometry home — and it means the Project Index is the only thing
  pairing a stray note with its sidecar, exactly as it already is for plans.
- Resolution goes through the Project Index, as it does for plan sidecars: derivability is a repair
  path for a damaged index, not a second lookup mechanism for normal reads. The rule ADR-011 states
  is inherited here unchanged.
- `rpgeo` being already registered means this decision adds no load-time work and no second view
  type. It also means the collision cost ADR-011 named is now shared: if the extension ever has to
  change, it is one migration over both kinds of sidecar rather than two.

## Alternatives

- **Colocating an asset's sidecar next to its Markdown note** — rejected for ADR-011's own reason:
  it mixes `.rpgeo` files into the `Assets/` folder a user reads, and, if the sidecar also takes
  the note's display name, re-couples geometry to a name the user is free to change. It has one
  extra cost here that it did not have for plans: an asset note may sit outside the library
  entirely, so colocation would scatter geometry to wherever a note happened to be filed and take
  it with every later move.
- **A second configurable folder for asset geometry** — rejected for ADR-011's own reason: it
  answers "where does this file go" a second time, after `libraryFolder` has already answered it,
  and every part of that layout which looks cheap in isolation is paid for elsewhere — a setting on
  the settings surface, and a folder-change path that must move existing files and rebuild the
  index before it may persist the new value. ADR-011 priced a configurable geometry path once and
  reverted it; nothing about assets makes the price lower.

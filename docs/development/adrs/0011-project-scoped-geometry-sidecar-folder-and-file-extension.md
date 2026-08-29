---
adr: 11
title: Project-Scoped Geometry Sidecar Folder and Dedicated File Extension
status: Accepted
date: 2026-08-22
revised: 2026-08-23
area: persistence
---

# ADR-011: Project-Scoped Geometry Sidecar Folder and Dedicated File Extension

## Context

ADR-002 established that plan geometry is persisted as one JSON sidecar per plan, separate from the plan's Markdown note. Its example colocated the sidecar next to the plan note (for example, `Ground Floor.geometry.json` beside `Ground Floor.md`), scattered across wherever plan notes happen to live in the vault.

That colocation model has two problems in practice. First, if a user uninstalls the plugin, geometry sidecars are left scattered throughout the vault, indistinguishable at a glance from other clutter, instead of sitting somewhere a user would think to look for "the plugin's data." Second, Obsidian does not reliably show or manage files whose extension it does not recognize: a plugin must call `registerExtensions()` at load time to associate a file extension with a view, or files with that extension are not dependably visible or interactable in the file explorer.

The unit that owns data here is the **project**. A project already has its own folder — PRD §83 lists "project folder" under Project Settings, and PRD §36's tree draws the per-kind subfolders (`Plans/`, `Zones/`, `Assets/`, …) that live inside it. Geometry is project-related data like any other, and the folder it belongs in is therefore already chosen, once, at the level where a user chooses where their project lives.

## Decision

**Plan geometry sidecars live in a `Geometry/` subfolder of the project's own folder**, a sibling of the `Plans/`, `Zones/` and `Assets/` folders PRD §36 draws:

```text
Renovation/
└── Kitchen Refit/                ← the project folder (a Project setting, PRD §83)
    ├── Project.md
    ├── Plans/
    │   ├── Ground Floor.md
    │   └── First Floor.md
    └── Geometry/
        ├── plan-01JABB3C5D7E9F1G3H5J7K9M1N.rpgeo
        └── plan-01JABC4D6E8F0G2H4J6K8M0N2P.rpgeo
```

There is **no plugin setting for the sidecar folder**. The location is derived: project folder + `Geometry/`. The subfolder name itself is fixed, the same way `Plans/` and `Zones/` are fixed inside a project — what varies between users is where the project folder is, and that is one setting, one level up, that a user has already set for reasons that have nothing to do with geometry.

Each sidecar is named by the plan's stable ID **in full, prefix included** — SDD §82's identity model gives every ID a `<prefix>-<ULID>` shape, so the note's `id` field, the sidecar's own `planId` field and the filename are the same string and are comparable without a strip-or-add step that only one of the three code paths remembers. Never by the plan's display name, so renaming or moving a plan note never orphans its geometry file and two plans that share a display name never collide.

Sidecar files use the extension `rpgeo` (for example, `plan-01JABC123.rpgeo`), rather than generic `.json`. The plugin registers this extension with Obsidian via `registerExtensions(["rpgeo"], viewType)` on load, so the files appear and are manageable in Obsidian's file explorer instead of being hidden or treated as an unsupported attachment. The content of an `.rpgeo` file is still the JSON payload defined by the Plan Sidecar Schema (see ADR-002); only the file's extension is non-standard, not its format.

> **Revised 2026-08-23.** The version of this ADR accepted on 2026-08-22 put every sidecar in a **flat list inside one plugin-wide configurable folder**, `geometrySidecarFolder`, defaulting to `Renovation/Geometry`. That is reverted here in favour of the project-scoped folder above, for the reason recorded under Alternatives: a plugin-wide folder mixes every project's geometry into one list, and its configurability is a second, redundant answer to a question the project folder already answers — one whose cost is a setting, a folder-change migration and an index rebuild, all of it paid for a placement decision nobody needs to make twice. An earlier draft had defaulted that folder to `docs/geometry`; `Renovation/` was already the correction, and the project folder finishes it. No code had been written against either, which is why this is an edit rather than a migration.

## Consequences

- Uninstalling the plugin, or moving plan notes around inside the project, never touches geometry data — it stays in one predictable folder per project, which is also a natural place to point a backup or export at. This is the same guarantee the previous flat-folder decision was made for; scoping it to the project does not weaken it.
- **A project moves as one folder.** Moving or renaming the project folder carries its geometry with it in a single filesystem move, and there is no setting left holding a path that has quietly gone stale. The folder-change migration the previous decision required — move every sidecar, rebuild the index, and refuse to persist the new path until the move succeeded — does not exist, because there is no separately configured path to change.
- Geometry is **separated per project** rather than pooled. Two projects never share a folder, so enumerating one project's sidecars does not mean filtering another's out, and deleting a project's folder deletes exactly that project's geometry.
- A sidecar's path is now **derivable** in principle (project folder + `Geometry/` + plan ID), where the previous flat-folder-plus-setting layout made it genuinely underivable. Resolution still goes through the Project Index, which the SDD already requires and which stays the single answer to "where is this plan's geometry"; derivability is a repair path for a damaged index, not a second lookup mechanism for normal reads.
- Registering the custom extension keeps sidecar files visible and manageable inside Obsidian's UI, consistent with how the rest of the plugin's data (Markdown notes) behaves, rather than looking like foreign, unsupported files.
- `rpgeo` was chosen specifically because it is unlikely to collide with another installed plugin or with unrelated files a user already keeps in their vault; if a future collision is discovered, changing it is a migration (rename every sidecar and re-register), not a one-line settings change.
- This supersedes the colocation detail in ADR-002's example; ADR-002's underlying decision (one JSON sidecar per plan, not per spatial object) is unchanged.
- **It also supersedes the received SDD's §39 Sidecar Files example**, which draws `Ground Floor.geometry.json` beside `Ground Floor.md` — the same colocation, and the same display-name filename, this ADR replaces. §39's recommendation itself ("store plan geometry per plan rather than one sidecar per spatial object") is unchanged and is exactly what ADR-002 adopted; only its illustrated layout and naming are refined. Stated here because the SDD stays verbatim as received, so a refinement of it has to be findable from the ADR side — the same way ADR-009 records its refinement of SDD §40's schema example. Named alongside ADR-002 rather than instead of it: §39 is where a reader looking for "where does a sidecar go" actually lands.

## Alternatives

- **A plugin-wide configurable folder holding a flat list of every project's sidecars** (`geometrySidecarFolder`, default `Renovation/Geometry`) — accepted 2026-08-22, reverted 2026-08-23. It answers "where does this file go" a second time, after the project folder has already answered it, and every part of the layout that looked cheap in isolation is paid for elsewhere: a setting on the settings surface, a folder-change path that must move existing files and rebuild the index before it may persist the new value, and a pool that mixes projects a user deliberately keeps apart. Its one advantage over a project-scoped folder — that geometry sits somewhere a user can point at without knowing which project it belongs to — is worth less than knowing which project it belongs to.
- Colocating a per-plan sidecar next to its Markdown note, as originally illustrated in ADR-002 — rejected: mixes `.rpgeo` files into the `Plans/` folder a user reads, and, if the sidecar also takes the note's display name, re-couples geometry to a name the user is free to change.
- Plain `.json` sidecars without registering a custom extension — rejected: unregistered file types are not reliably shown or manageable in Obsidian's file explorer, and generic `.json` risks colliding with unrelated JSON files a user already keeps in the vault for other purposes.
- A hardcoded absolute folder such as `Renovation/Geometry`, fixed at the vault root with no configuration anywhere — rejected: vault organization conventions vary between users, and a path fixed at the vault root cannot accommodate that. The decision above is not this: the folder is fixed only *relative to* the project folder, which remains a project setting.

## Revisit when

Obsidian changes how registered extensions are treated in the file explorer in a way that removes the need for explicit registration, or a project's `Geometry/` folder needs internal structure of its own (per-plan subfolders, revisions) rather than one file per plan.

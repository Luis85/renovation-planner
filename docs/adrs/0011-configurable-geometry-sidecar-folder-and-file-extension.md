---
adr: 11
title: Configurable Geometry Sidecar Folder and Dedicated File Extension
status: Accepted
date: 2026-08-22
area: persistence
---

# ADR-011: Configurable Geometry Sidecar Folder and Dedicated File Extension

## Context

ADR-002 established that plan geometry is persisted as one JSON sidecar per plan, separate from the plan's Markdown note. Its example colocated the sidecar next to the plan note (for example, `Ground Floor.geometry.json` beside `Ground Floor.md`), scattered across wherever plan notes happen to live in the vault.

That colocation model has two problems in practice. First, if a user uninstalls the plugin, geometry sidecars are left scattered throughout the vault, indistinguishable at a glance from other clutter, instead of sitting somewhere a user would think to look for "the plugin's data." Second, Obsidian does not reliably show or manage files whose extension it does not recognize: a plugin must call `registerExtensions()` at load time to associate a file extension with a view, or files with that extension are not dependably visible or interactable in the file explorer.

## Decision

Add a plugin setting for the geometry sidecar folder, defaulting to `docs/geometry`. All plan geometry sidecar files are written as a flat list directly inside that single configured folder — not mirrored into per-plan subfolders, and not colocated next to the plan's Markdown note. Each sidecar is named by the plan's stable ID (see the SDD's Identity Model), not by the plan's display name, so renaming or moving a plan note never orphans its geometry file and two plans that happen to share a display name never collide.

Sidecar files use a dedicated file extension specific to this plugin, rather than generic `.json`. The plugin registers this extension with Obsidian via `registerExtensions()` on load, so the files appear and are manageable in Obsidian's file explorer instead of being hidden or treated as an unsupported attachment.

## Consequences

- Uninstalling, reinstalling, or moving plan notes around the vault never touches geometry data — it stays in one predictable, user-configured folder, which is also a natural place to point a backup or export at.
- A flat list keyed by stable plan ID avoids filename collisions and is simple to enumerate without walking the whole vault tree.
- Registering the custom extension keeps sidecar files visible and manageable inside Obsidian's UI, consistent with how the rest of the plugin's data (Markdown notes) behaves, rather than looking like foreign, unsupported files.
- The Plan → sidecar mapping is now indirect: a sidecar's path can no longer be derived from the plan note's own path, so resolving it must always go through the project index (already required by the SDD) rather than simple path derivation.
- Changing the configured folder after sidecars already exist needs deliberate handling (moving existing files, or treating it as a migration) rather than a silent setting change, or it will orphan existing geometry data.
- The registered extension must be distinct enough not to collide with another installed plugin or with unrelated files a user already keeps in their vault.
- This supersedes the colocation detail in ADR-002's example; ADR-002's underlying decision (one JSON sidecar per plan, not per spatial object) is unchanged.

## Alternatives

- Colocating a per-plan sidecar next to its Markdown note, as originally illustrated in ADR-002 — rejected: scatters geometry files across every plan's folder, making them easy to overlook when backing up or auditing vault contents outside the plugin, and easy to mistake for clutter once the plugin is removed.
- Plain `.json` sidecars without registering a custom extension — rejected: unregistered file types are not reliably shown or manageable in Obsidian's file explorer, and generic `.json` risks colliding with unrelated JSON files a user already keeps in the vault for other purposes.
- A fixed, non-configurable sidecar folder — rejected: vault organization conventions vary between users (for example, wanting plugin data under a top-level folder instead of nested under `docs/`), and a hardcoded path cannot accommodate that.

## Revisit when

Obsidian changes how registered extensions are treated in the file explorer in a way that removes the need for explicit registration, or the flat-folder layout becomes a real bottleneck (for example, needing per-project subfolders) rather than just a large but still trivially indexed list.

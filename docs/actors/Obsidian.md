---
kind: actor
name: Obsidian
layer: system
standing: host application
sources: ["PRD §3.6", "PRD §45", "SDD §4", "SDD §9", "SDD §11", "SDD §84", "SDD §96"]
---

# Obsidian

The application this plugin runs inside. Not a library it calls — a host that owns the
process, the window, the lifecycle and the user's attention, and that calls *into* the plugin
far more often than the plugin calls out.

SDD §4 lists the integration surfaces and they split cleanly in two. The ones about being an
application — plugin lifecycle, workspace views, commands, settings — belong here; the ones
about being a store — Vault API, FileManager, metadata cache — belong to [[The vault]], and
[[Bases]] is an actor again. They are separated because they fail differently and because the
plugin owes each of them something different.

## What it does to the plugin

- **Loads and unloads it** (§96). Everything registered has to be released; a leaked listener
  outlives the plugin and the user pays for it, not the developer.
- **Decides where a view goes.** The plugin asks to reveal a leaf; Obsidian decides whether
  that is a new tab, an existing one, or a sidebar. Which is why activation goes through one
  function rather than being re-decided beside each new entry point.
- **Owns the hotkeys.** A command id is persisted against whatever key the user bound to it,
  so the id is data and only the display name is text.
- **Sets the theme.** SDD §84 asks for Obsidian's CSS variables rather than a palette, so a
  themed vault stays themed.
- **Defines the floor.** `minAppVersion` is a promise: an API newer than it may not exist
  at runtime.

## What the plugin owes it

- Releasing every registration on unload (§96).
- Honouring mobile, or declaring itself desktop-only. `isDesktopOnly: false` is a promise
  about what the code may touch.
- Not reaching for a global `app`, and not writing outside the vault APIs.
- Staying inside the marketplace rules, which are Obsidian's terms for being distributed.

## Sources

PRD §3.6 · PRD §45 · SDD §4 · SDD §9 · SDD §11 · SDD §84 · SDD §96, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).

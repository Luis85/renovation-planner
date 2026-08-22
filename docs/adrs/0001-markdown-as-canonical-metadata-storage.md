---
adr: 1
title: Markdown as Canonical Metadata Storage
status: Accepted
date: 2026-08-22
area: persistence
---

# ADR-001: Markdown as Canonical Metadata Storage

## Context

The Renovation Planner is a local-first Obsidian plugin. Its architectural goal is that the Obsidian Vault is the persistent source of truth, while Vue, Pinia, and Konva are replaceable presentation and interaction technologies. Human-readable project entities — Project, Plan, Zone, Construction Section, Work Package, Asset, Requirement, Trade, Supplier, Quote, Order, Invoice, Decision, and Risk — need a storage format that stays portable, versionable, searchable, and editable outside the plugin, and must not require a proprietary database.

## Decision

Human-readable project metadata is stored in Markdown notes using YAML frontmatter Properties, not in a proprietary database or opaque binary format. Each domain entity above is persisted as a Markdown note, with structured metadata in its frontmatter and free-form notes in the note body.

## Consequences

- Project data remains human-readable, diffable, and versionable with standard tools (git, Obsidian sync, manual editing).
- Data is portable and remains understandable even without the plugin installed.
- The plugin can interoperate with native Obsidian features: Properties, links, embeds, Bases, search, and tags.
- Mapping between Markdown/frontmatter and domain entities must be explicit (see the Obsidian Repository Layer) — raw frontmatter must not leak throughout the application, and every persisted shape needs schema validation and a schema version for future migrations.
- Large or high-churn data (in particular plan geometry) does not fit well in frontmatter and needs a separate storage strategy (see ADR-002).

## Alternatives

- A custom binary or SQLite database bundled with the plugin — rejected: breaks the local-first, human-readable, edit-outside-the-plugin requirement, and needs a bespoke migration/query layer with no Obsidian-native tooling support.
- One large JSON/YAML file per project — rejected: loses per-entity versioning and diffing, note-level linking, and Obsidian's native search/Bases integration.

## Revisit when

Obsidian's own data model changes — for example, a first-class structured-data API — in a way that would let entities be both queryable and still human-readable without frontmatter's current limitations.

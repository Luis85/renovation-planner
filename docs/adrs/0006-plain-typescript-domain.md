# ADR-006: Plain TypeScript Domain

## Status

Accepted

## Context

The Renovation Planner's central architectural principle is that the Obsidian Vault is the persistent source of truth, while Vue, Pinia, and Konva are replaceable presentation and interaction technologies. For domain logic (geometry, cost, requirement, and scheduling calculations; entities like Zone, WorkPackage, and Requirement) to be maintainable, testable, and portable, it must exist independently of any specific UI or rendering technology.

## Decision

The Core and Domain layers are implemented in plain, framework-free TypeScript. They may not depend on `vue`, `pinia`, `konva`, `vue-konva`, `obsidian`, or DOM APIs. Dependencies only point inward: Presentation → Application → Domain → Core, and Infrastructure implements interfaces defined by the inner layers.

## Consequences

- Domain and Core logic can be fully instantiated and unit-tested without Obsidian, Vue, or Konva.
- A `Zone` is not a Konva polygon, a `WorkPackage` is not a Markdown file, and a `Requirement` is not a Pinia object — these technologies are representations of domain concepts, never the concepts themselves.
- The dependency rule must be enforced with automated checks (for example, ESLint import restrictions or `dependency-cruiser`) so that `domain/**` cannot import `vue`, `pinia`, `konva`, or `obsidian`.
- Infrastructure (Obsidian repositories, import/export, logging) may depend on `obsidian`, `pdfjs-dist`, and similar libraries, but Domain must never depend on Infrastructure.
- This isolation is what allows the product to grow from an initial spatial planning tool into a larger renovation project management system without fundamental architectural rewrites.

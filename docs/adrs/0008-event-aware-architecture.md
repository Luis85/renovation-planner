# ADR-008: Event-Aware Architecture

## Status

Accepted

## Context

A change in one part of the domain often needs to trigger work elsewhere — for example, editing a zone's geometry should invalidate and recalculate its material requirement, which should in turn update the estimated cost and budget. Wiring this directly inside command handlers would tightly couple unrelated modules (geometry, requirements, costs, budget) to one another.

## Decision

Commands may emit domain or application events after a successful state change (for example, `ZoneGeometryChanged` → `RequirementInvalidated` → `RequirementRecalculated` → `CostEstimateChanged`), published through an in-process event bus. The initial implementation is a simple synchronous or promise-aware in-process bus — no external event infrastructure (message queue, broker) is introduced.

## Consequences

- Recalculation, cache updates, UI refresh, and audit-trail entries can react to events without the originating command needing to know about every downstream consumer.
- The event catalog (`ProjectCreated`, `ZoneGeometryChanged`, `RequirementRecalculated`, `WorkPackageCompleted`, `ActualCostRecorded`, and similar) gives future automation and plugin extensions defined hook points.
- Because events are in-process, ordering and delivery are simple to reason about; introducing a durable or cross-process event system later would be a separate, deliberate decision, not an incremental extension of this one.

# ADR-0024: Shared Trades, explicit Work dates and factual quote comparison

Status: implementation candidate; verification and integration review pending.

## Context

The accepted editor M10 and M13 contracts require existing Trade responsibility, a downstream schedule, and quote comparison outside the Inspector. ADR-0021 and ADR-0022 described bounded deliveries; their open-work notes did not remove those requirements. The canonical Trade, Supplier and Quote entity notes specify shared library categories/parties and project-owned offers. Finalization uses those authorities rather than Plan-local catalogues or another pricing engine.

## Decision

Trade and Supplier are stable named notes in the configured shared library's Trades and Suppliers folders. A Trade describes a category of work; a Supplier identifies a business or person. The Project Index, note writer, migration runner, diagnostics and per-kind frontmatter digest govern both. Names can change without rewriting linked identities. Unreadable or missing assignments remain visibly unresolved; a new assignment must resolve at the command boundary. Catalogue creation retains one identity across a retry.

Work remains in its owning Plan renovation register. Responsibility may be DIY, unassigned, or an existing Trade ID. Optional start/end dates are explicit ISO calendar dates; either endpoint may remain unknown. No date is inferred from ordering, dependencies, duration or another floor. Schema 7 protects these new fields from older readers. Legacy metadata upgrades only in memory; older capability-only writes retain their appropriate schema discriminator.

The Project Work section reads each Plan's register once, derives room names and dependency blockers, and preserves partial-read truth. A shared Work item appears once. Editing reuses RenovationForm, RenovationCommand, conditional WriteLedger history and save/read-back tracking. A successful write followed by failed refresh remains a successful write and is retried only as a read.

Quotes are project-owned notes in Quotes. Each has stable identity, supplier, issue date, optional validity endpoint, draft/received status and explicitly priced items. Items hold decimal Money and zero or more Asset and floor-qualified Work references. The plugin permits draft edits with expected versions; received offers are immutable. A revision creates a new identity. Expiry is derived from the supplied current calendar date, inclusive of the validity endpoint. User frontmatter and note body remain outside owned-field writes.

Comparison aligns only identical explicit scope-link sets. Unlinked lines are displayed separately per offer; missing coverage is not zero. Amounts are totalled per offer and currency, never across competing offers. Descriptions retain the scope and inclusion information supplied by the homeowner. There is no implicit currency conversion, unit/tax normalization, ranking, winner, order creation or payment. Planned, quoted, committed and actual facts keep their separate authorities.

Project section/origin state is hosted by the existing Obsidian view state and navigation queue. Context carries stable floor, Room, Work and cost identities. Returning to an existing editor preserves its Vue app and asks the existing focus action to reveal the record after draft/save guards; a fresh leaf applies the arrival after hydration. Missing source identities remain an explicit unavailable-context result.

## Verification required

Canonical repository bytes and fresh-root reads; per-kind digest ownership; stale write refusal; received immutability; custom names and missing references; shared Work deduplication; decimal precision; partial dates; native modal preview/apply, pending choices, raw draft retention, read-only retry, disposal and contextual host navigation. Full unchanged gates and final browser/live-host acceptance remain required before this candidate can be called complete.

## Integration review corrections

Owned renovation comparison includes Trade identity and both date endpoints, so stale-state/history checks cannot treat those changes as identical. Shared library relocation includes indexed Trade and Supplier notes within the configured source folder and preserves project-owned Quotes and catalogue notes deliberately filed elsewhere. Quote retries compare canonical facts independently of object property order. Existing-note writes recheck expected versions inside the host frontmatter callback before any mutation; received-quote and project-ownership validation uses that same fresh callback content.

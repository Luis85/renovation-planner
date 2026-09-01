---
type: Task
parent: "[[Detect and explain unhealthy vault data]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Audit canonical vault-health findings

## Evidence

The vault-health authority names invalid IDs, duplicates, missing references, unreadable notes,
and future schema versions as normal hand-editable-vault states.

## Why it matters

A health check that misses unreadable regions can report false safety.

## Approach

Build planted fixtures for each canonical finding and partial-scan failure. Assert location,
entity kind, validated identity where available, severity, and untouched source bytes.

## Acceptance criteria

- Every canonical finding has a discriminating check.
- Partial scans report their unchecked scope.
- Detection performs no repair or rewrite.

## Risks

Fixtures derived from the detector may omit the same malformed shapes.

## Outcome

Vault-health detection is complete against its existing authority.

---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 140
status: New
started: ""
finished: ""
horizon: Next
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The test fakes fire vault events before the mutator's own promise settles

`tests/helpers/vault.ts`'s `FakeVault.create`, `modify` and `delete` each call
`this.trigger('create'/'modify'/'delete', ...)` synchronously inside their try block, then
`return Promise.resolve(...)`. The event fires and every listener runs to completion BEFORE the
returned promise is even constructed, let alone before a caller's `await` on it resolves.
Obsidian's own real ordering — whether `Vault.create`/`modify`/`delete`'s promise settles before
or after its `create`/`modify`/`delete` event fires — is not measured anywhere in this
repository.

## What is true today

Every one of `FakeVault.create` (line ~344), `modify` (~359) and `delete` (~379, ~391) follows
the same shape: `this.trigger(name, ...)` then `return Promise.resolve(...)`. A test that
asserts something about the ORDER of "the write's promise resolved" versus "the vault event's
listeners ran" is, today, only asserting an order this fake chose, not one Obsidian is known to
produce.

## What closes it

This is an improvement to record rather than a defect to fix blind: whoever relies on that
ordering next owes the measurement (a real Obsidian vault, instrumented, or a documented
citation of Obsidian's own source) before writing a test that depends on it. Absent that
measurement, the fix is a docblock on `VaultEventBus`/`FakeVault` naming the ordering as a
choice this fake makes rather than one it verified.

## References

- [[Errors, diagnostics and the test harness]]
- `tests/helpers/vault.ts` — `FakeVault`'s `create`/`modify`/`delete` and their
  synchronous `this.trigger(...)` calls.

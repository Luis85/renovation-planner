---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 70
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Render independent simultaneous persistent warnings

## Evidence

The shared `PersistentWarningStrip` contract states that independent warnings must not suppress
one another merely because they share the editor region, and M15 requires recoverable stale state
to remain visible while it persists.

## Why it matters

A stale-plan warning, a missing Reference warning and another recoverable condition may coexist;
showing only the newest hides actionable state without resolving it.

## Approach

Project persistent warnings as an independently keyed collection in the shell. Render every
active condition with its own semantics and actions, and retire only the warning whose condition
has cleared or whose own action resolved it.

## Acceptance criteria

- Two or more independent persistent warning conditions render simultaneously.
- Adding, updating, retrying or clearing one warning does not suppress or retire another.
- Each warning retains its own stable identity, severity, accessible heading, body, busy state and
  actions.
- Repeated publication of one condition updates or deduplicates that condition without merging a
  distinct warning.
- Warning order is deterministic and does not change merely because an unrelated projection
  refreshes.
- Keyboard users can reach every warning action, and announcements do not collapse multiple
  messages into an inaccessible replacement.
- Last-valid editor content remains visible wherever each warning's policy permits it.

## Risks

A single `warning` slot or global retry state can make one condition overwrite another even when
the DOM supports multiple strips.

## Outcome

The editor tells the whole recoverable truth when several persistent conditions coexist.

## Amendments

**2026-09-03** — `editorWarnings` and `PersistentWarningStrip.vue` turned four independent
`v-if` notices in `PlanEditorRoot.vue` into one KEYED collection, which is what makes a warning's
identity and its live region survive a sibling arriving or clearing. Criteria 1 and 2 are
`tests/presentation/editor/shell.test.ts`'s two-at-once `role="status"` assertion and
`tests/presentation/editor/planEditorFailure.test.ts`'s list of them; criterion 5 is
`tests/presentation/editor/shell/warnings.test.ts`'s fixed-order case, and the order is a property
of that function rather than of four template blocks' source order; criterion 7 is the strip being
additive over content the canvas is still drawing.

An `EditorWarning` carries an `id`, a message key and optional params and nothing else — no
severity, no accessible heading, no busy state, no action. So criterion 3 is met only in its
IDENTITY clause, and criteria 4 (repeated publication updating or de-duplicating a condition) and
6 (reaching every warning action by keyboard) have no subject at all: the collection is DERIVED
per render from three inputs rather than published, and there is nothing to reach.

---
type: Task
parent: "[[Selection]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Expose object-specific context menus through shared actions

## Evidence

The interaction specification makes contextual canvas actions supplementary to the Inspector,
maps touch long press to a context menu, and requires keyboard-accessible equivalents. The
component contract likewise limits direct actions to shared conveniences rather than exclusive
capabilities.

## Why it matters

A menu that owns separate commands or appears only on pointer input can disagree with the
Inspector, hide why an action is unavailable, and exclude keyboard users from object-specific
work.

## Approach

Build right-click, long-press and keyboard invocation over one object-action catalogue. Derive
labels, availability and disabled reasons from the same action descriptors used by Inspector and
other direct surfaces, and dispatch the same canonical commands. Treat menu focus, dismissal and
Escape as ephemeral presentation behavior that takes precedence over clearing selection.

## Acceptance criteria

- Right-click or long press on a supported object opens the menu for that object's stable
  selected identity.
- A labelled keyboard route opens an equivalent menu for the focused or selected object.
- Pointer and non-pointer invocation expose the same actions, ordering, availability and
  disabled reasons.
- Enabled menu actions dispatch the same canonical commands as their Inspector and direct-action
  equivalents.
- Every menu action remains available through a labelled Inspector or other keyboard-operable
  route; no capability exists only in the context menu.
- Focus enters the opened menu predictably, remains visible, and returns to a meaningful
  invoker or selected-object control when the menu closes.
- Escape closes only the menu before any selection-clearing behavior runs.
- An unavailable action is omitted or disabled with an accessible reason and never becomes a
  control that silently does nothing.

## Risks

Independent menu descriptors can drift from Inspector availability, and canvas pointer handling
can suppress native or assistive invocation before the shared action route sees it.

## Outcome

Each supported object has an optional, input-equivalent context menu that accelerates shared
actions without becoming a separate capability surface.

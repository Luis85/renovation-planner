---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Suggest a localized Room name from its type

## Evidence

M03 says choosing a Room type suggests a default localized name.

## Why it matters

A useful suggestion speeds common creation without persisting internal or untranslated vocabulary.

## Approach

Map approved Room types to localized suggested names, apply a suggestion only while the name remains
user-untouched, and keep the field editable. Test both locales, fallback and type changes.

## Acceptance criteria

- Choosing a Room type offers its localized suggested name.
- A name the renovator edited is never overwritten by a later type change.
- Confirmation persists the visible name, not a translation key or internal type.
- Missing locale copy follows the established fallback.

## Risks

Automatic replacement can erase deliberate naming.

## Outcome

Common Rooms receive helpful localized names without taking naming control from the renovator.

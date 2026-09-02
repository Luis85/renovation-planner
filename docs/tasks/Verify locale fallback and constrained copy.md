---
type: Task
parent: "[[Present complete homeowner language in English and German]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify locale fallback and constrained copy

## Evidence

German copy is often longer, and interpolation or fallback defects can render blanks or raw holes.

## Why it matters

A complete table does not prove that the resolved sentence is intact or the control remains usable.

## Approach

Test missing-key fallback, matching interpolation holes, plural/context cases in scope, and every
long-copy state at constrained width and 200% zoom in both themes.

## Acceptance criteria

- Fallback resolves one complete English string, never blank text.
- English and German interpolation parameters match.
- Long German strings do not hide actions or accessible names.

## Risks

Layout assertions without a rendering engine cannot establish clipping.

## Outcome

Locale resolution and long-copy presentation fail visibly and safely.

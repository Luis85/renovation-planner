# src/prototypes — mocks and prototypes, never shipped

Template-only `.vue` files: a `<template>` block and nothing else. Pure HTML to write, and
already a real Vue component the harness mounts like any other, so **promotion adds a
`<script setup>` and moves the file — the markup is never redrawn.** That is the whole point,
and `tests/build/prototype-promotion.test.ts` holds it.

**This tree is a one-way door.** It may import from the rest of `src/`; nothing in `src/` may
import from it. Two checks, because neither is sufficient alone:

- `eslint.config.mjs` bans the import from every other layer — checked at the forbidden thing,
  so it holds for code nobody has written yet. `tests/build/prototypes-one-way-door.test.ts`.
- `tests/build/prototypes-not-bundled.test.ts` asserts against `dist/`, catching the dynamic
  route lint cannot see. It derives what to look for from THIS TREE — no file here has to
  remember a marker, because a marker only ever proves the marker is absent.

It is excluded from coverage (`vitest.config.ts`) because nothing ships it, and declared to
fallow (`.fallowrc.json`) because `import.meta.glob` is a Vite feature its static graph cannot
follow.

Reachable at `npm run harness`, from the index at the root.

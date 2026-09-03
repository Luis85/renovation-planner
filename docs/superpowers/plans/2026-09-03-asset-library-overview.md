# Asset library overview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `renovation-asset-library` — a fourth registered Obsidian workspace surface that makes the vault-wide asset catalogue visible as category shelves, with a geometry mark per row and an in-place editing inspector.

**Architecture:** A new read model (`ListCatalogueEntries`) and a batched geometry read (`ListAssetOutlines`) over two widened ports (`AssetRepository` listing, `AssetGeometrySidecar` refusal path), a `ProjectIndex` collection of excluded notes with its own event, and a Vue/Pinia view promoted from the existing `src/prototypes/` mocks. Layer rules are unchanged: `presentation → application → domain → core`, composed only in `src/plugin/`.

**Tech Stack:** TypeScript, Vue 3 (`<script setup>`), Pinia, Zod, Obsidian API 1.13.0, Vitest + jsdom, ESLint + oxlint, fallow.

**Spec:** `docs/user-experience/asset-library-overview-DESIGN-SPEC.md` — the binding authority. Every task brief names the spec line range it implements; read it.

---

## Global Constraints

Copied verbatim from the spec and from `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Definition of done is `npm run check`** — build (`vue-tsc` over `src/**` and `tests/**`, then Vite, then the stylesheet checks), lint (oxlint then ESLint, `--max-warnings 0` / `--deny-warnings`), `test:coverage` against floors 99/99/99/98 (statements/functions/lines/branches), and `analyze` (fallow). All four must pass before committing.
- **Coverage headroom is ONE covered unit on branches and on functions.** Plan the test with the code. An untested arm in a tight metric fails the gate outright; one in a slack metric hides completely.
- **Layer bans are lint rules.** `core/`, `domain/` and `application/` may not name `vue`, `pinia`, `konva` or `obsidian`. `presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/` or the event bus. Only `src/plugin/` composes.
- **Nothing writes to the vault outside `infrastructure/`** (`WRITE_BOUNDARY` in `eslint.config.mjs`).
- **Registering with Obsidian belongs to `src/plugin/`** — `tests/build/registration-locality.test.ts` reads `src/` for nine registration members and requires every hit under `src/plugin/`.
- **A view type and a command id are DATA.** `ASSET_LIBRARY_VIEW = 'renovation-asset-library'` and the command id `open-asset-library` are persisted by Obsidian and never renamed.
- **Every user-visible string resolves through `t(language, key)`.** `I18N_LITERAL_BAN` refuses a literal at six call sites; `de.ts` must translate every key `en.ts` declares and must name the same interpolation holes. Sentence case, plain, no exclamation.
- **No colour-only status.** PRODUCT.md and SDD §85: every state is a printed mark as well as a colour. Selection is a 2px inset `box-shadow` rule plus `aria-current="true"`, never a tint alone.
- **No hard-coded colours in `styles/`** — SDD §84 requires an Obsidian CSS variable; the build fails on any literal colour lightningcss resolves.
- **A style partial is capped at 400 lines** and must be imported by `styles/index.css`.
- **A row is a flattened `<button>` selected UNDER its block class** (`.rp-asset-shelf .rp-asset-row`), because Obsidian's `button:not(.clickable-icon)` is (0,1,1) and a bare class is (0,1,0). `tests/build/buttonSpecificity.test.ts` reads every shipping sheet.
- **Every focus stop has a visible ring** — `2px solid var(--interactive-accent)`, offset negative for edge-to-edge rows and positive for inset controls. `tests/build/buttonFocusRing.test.ts` is the check.
- **Container queries, never media queries.** The ladder is ≥720px shelves+280px rail; 560–720px rail 240px, row drops supplier then waste; <560px the rail replaces the shelves.
- **Every asynchronous read carries a ticket, and a result whose ticket is no longer current is DROPPED — successes and failures alike** (§5.5).
- **`Money` is decomposed into an amount string plus a currency at every boundary.** A float is what ADR-010 refuses.
- **WCAG 2.2 AA is the binding target.** Both action-bearing empty states are scanned by `tests/harness/accessibility.test.ts` on the day they ship, asserting `.rp-empty-state` and `.rp-empty-state__action` are in the scanned DOM.
- **A fake must not be kinder, thinner, harsher or faster than the real thing.**
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.**
- **A docblock that says "the only place X" gets a `grep` in the SAME edit.**

---

## Rulings on §11 — decisions the spec leaves to this increment

The spec's §11 names nine decisions a builder must not invent silently. They are settled here, before Task 1, and each ruling names what it costs if wrong.

| § | Decision | Ruling | Cost if wrong |
| --- | --- | --- | --- |
| 11.1 | Does the geometry mark ship now? | **Yes.** §2a names it as the one thing no Bases view can do — the honest case for building the surface at all. It ships viewport-bounded per §5.3. | The increment is larger and the viewport batching is its riskiest part; deferring would have meant shipping no mark slot at all, not an empty one. |
| 11.2 | Shelf expansion per leaf or per vault? | **Per leaf**, in Obsidian's own view state, per §6.3. A setting would write through `saveSettings`, which rebinds every view on every disclosure toggle. | A user expanding the same shelves in two leaves; cheap and reversible. |
| 11.3 | How is an unreadable sidecar repaired? | **Not here.** `Open designer` is withdrawn for every `asset-geometry.*` refusal per §3.5 — the designer hydrates through the same `GetAssetDesign` and reaches the same failed state. Recorded as a gap this surface reveals and does not close. | A user with a corrupt `.rpgeo` has no in-plugin repair. Already true today; this surface makes it visible rather than causing it. |
| 11.4 | Does `Delete` belong on this surface? | **Yes**, per §3.5, and it routes through the existing delete flow with its reference-resolution dialog. The *Used in* read the gesture needs is already on screen, which is the spec's own argument, and withholding it would make this the one surface that shows an asset's blast radius and cannot act on it. | A destructive action one Tab from a row on a browsing surface. Mitigated by the existing confirmation dialog, which is unchanged. |
| 11.5 | The ceiling on empty shelves | **Not set.** Seven declared categories draw all seven. The number belongs to whoever ships §84's configuration surface. | A vault with a long configured vocabulary sees clutter. Unreachable today — §84 has no configuration surface. |
| 11.6 | Does *Used in* mark price-overriding projects? | **No.** §89's per-project override does not exist; there is nothing to mark. | None today; the row is additive when the override lands. |
| 11.7 | Widen the shared catalogue source or add a fourth? | **A fourth source**, `createAssetLibraryChangeSource`. Widening `createAssetCatalogueChangeSource` makes the assign picker re-read every asset note on design events it has no use for — a cost on a surface this increment does not own. | One more source module to keep in step with the picker's. Cheap and local. |
| 11.8 | Does the requirement event vocabulary grow? | **No.** *Used in* is a snapshot taken on selection, per §5.2. Adding `assetId` to the requirement payload and a `RequirementDeleted` sibling is a domain-layer change with consequences past this surface. | *Used in* can grow a row it will not lose within one selection. Re-selecting refreshes it. |
| 11.9 | Does a Bases view ship beside this? | **No code.** §2a's commitment is discharged by the negative rule — no fact about an asset exists only in this view — which every task below is bound by. The epic's Definition of Done item stays open and is not claimed. | The epic item remains unticked. Claiming it would be the worse error. |

---

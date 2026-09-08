# Native icon catalogue audit — 2026-09-08

This receipt separates host catalogue evidence from browser fixtures and from the installed
plugin. It is not final acceptance of the joined editor build.

## Host evidence

Read-only inspection of `obsidian-1.13.7.asar`'s `app.js`, and the native isolated vault's
window title, identify Obsidian **1.13.7**. The bundled `getIcon` implementation resolves
`lucide-` names directly against its Lucide catalogue. Unprefixed requests first consult
custom/legacy catalogues and the host alias map; `pencil` is aliased to `edit-3`.

All 37 names in the editor's pinned fixture map were compared against that host catalogue:
36 were present. **`grid-2x2` was absent; `grid-2x-2` was present.** The upstream Lucide fixture
name therefore did not prove the Obsidian API name. The affected requests were Plan
perspective, Start empty, and Add detail. They now use the host spelling. `HostIcon` requests
the explicit Lucide namespace, preserving an already prefixed name, so its pencil matches
the selected Lucide design rather than the host's legacy alias.

The production host still owns SVG geometry. No icon dependency, fallback glyph, or SVG
catalogue is added to the plugin. Neither change alters commands or accessible button text.

## Installed build evidence

The authorized isolated vault was `renovation-planner-finalization-vault`; the native
window was selected by that unique title. Its Synthetic Ground Floor editor was opened
through the existing project and plan UI. Native screenshots showed text-only perspective,
start, and primary-action controls.

Its preliminary installed `main.js` had SHA-256
`8258d6b2482c85bc04b1596e9cf0993fd2df8f45571dc84c6235e77106c972d2` and contained none of
`rp-host-icon`, `setIcon`, `mouse-pointer-2`, or `grid-2x2`. It predates the icon implementation;
that observation cannot establish that a newly built renderer failed. It also cannot
explain the user's live vault without identifying that vault's installed artifact.
The main checkout's `.obsidian/plugins/renovation-planner/main.js` did not exist during the
read-only check. No ordinary vault UI input or data writes were used.

Existing `editor-ui-verification/native-joined.txt` contains the test adapter's
`data-icon` attributes and SVG fixture geometry, including the invalid `grid-2x2` name.
Despite that file's name, those icon entries are harness evidence, not proof of resolution
by Obsidian's native icon catalogue.

## Acceptance still required on the final installed build

An icon-debug build from `c5e93f6429966002089739819ac74eebcfc7a093` plus this icon patch
passed `vue-tsc -noEmit` and `vite build --mode development`. It was copied only to the
isolated vault; the previous JS, CSS and manifest were backed up under
`C:/Users/lum/.codex/tmp/renovation-planner-native-icons-before-20260908`.

| Installed debug artifact | SHA-256 |
| --- | --- |
| `main.js` | `ad5392f9b19d7c94952acd2aa1dd3c669a2d2851d475c9bbd285cf47ac9ba548` |
| `styles.css` | `3d8d087fc78db6a9d253dd320104e2b11d2a4c9b99fff11c35344dec6320dff1` |

`vitest run tests/presentation/components/HostIcon.test.ts` passed **23 tests**. Temporarily
restoring the old perspective request `grid-2x2` made the catalogue test fail because no SVG
was rendered; the corrected source was restored before the passing run. The earlier run
before the mock accepted the Lucide prefix failed during fixture transition and is not
production regression evidence.

`oxlint --deny-warnings`, ESLint with `--max-warnings 0` on the seven changed TypeScript/Vue
files, and `git diff --check` passed. The commands used the main checkout's existing binaries
from this worktree; the two package lockfiles had equal SHA-256 hashes. No dependency install
or ordinary-vault deployment was performed.

The attempt to inspect the newly installed debug build stopped **before reload**: native
capture returned `window is minimized`; the permitted activation/refresh recovery reported
`user input was detected in this window`, and the fresh capture again returned
`window is minimized`. No new native icon result is claimed. Full `npm run check` is deferred
to the parent's serialized integrated-source gate; these scoped checks do not replace it.

Record its source commit and installed JS/CSS hashes after deployment, then inspect native
Plan, Renovate, Review, start actions, Add menu, selection actions, and rotation controls.
Check that icons remain visible beside text in light and dark themes. Audit intentionally
text-only or unimplemented design rows separately; a missing icon component is different
from a failing icon request. No final installed-build result is claimed here.

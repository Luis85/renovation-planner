# Harness icon fixtures

Production `HostIcon.vue` calls Obsidian's `setIcon`; no icon paths or new icon dependency
ship with the plugin. The test-only Obsidian adapter uses these SVG nodes so browser visual
checks can show decorative icons while retaining the same native buttons and text.

The wall thickness controls add `minus.svg` from the same pinned revision below. Its nodes are mechanically transcribed in the helper; the production request remains Obsidian's native `minus` icon.

Source: [Lucide](https://github.com/lucide-icons/lucide/tree/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons),
revision `2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`. Original SVG files are retained here;
the mechanically extracted nodes live in [the scanned helper root](../../helpers/editorIconNodes.ts),
so the harness stylesheet/import guard also walks their executable module. The complete [license](LICENSE) includes Lucide's
ISC notice and the MIT notice for Feather-derived icons. No user data is involved.

The harness records unknown requests with `data-icon-missing`; it never substitutes an
unrelated icon. Actual-host acceptance must still verify the installed host catalogue.

A fixture is two files and only the helper is executable, so an SVG added here with no entry in
the helper renders nothing at all: add both or neither. "Mechanically transcribed" is checked
rather than intended since wave 13 — `tests/helpers/editorIconNodes.test.ts` parses every SVG in
this directory with `DOMParser` and requires the helper entry to reproduce its children, in both
directions, so a hand transcription that drops a character and an entry whose SVG was deleted
both fail. There is still no generator; the check is what makes writing one by hand safe.

The `arrow-up-right` fixture uses the same pinned source revision and matches the checked
Obsidian 1.13.7 native key. `rp-stairs` is deliberately application-owned artwork registered
by `src/plugin/editorIconRegistration.ts`; it is not a Lucide fixture or a native-icon alias.
The adapter records its real add/remove lifecycle and renders the registered SVG content
in the host's 100-unit custom-icon coordinate system.

Obsidian 1.13.7's canonical key for upstream `grid-2x2.svg` is `grid-2x-2`; the generated node
map uses the host key while the original upstream filename and SVG bytes remain unchanged.
The adapter removes the explicit `lucide-` family prefix for fixture lookup and the `data-icon`
attribute, and retains the complete requested name in `data-icon-request`. This reproduces the
production component's explicit Lucide choice without silently accepting the unsupported
`grid-2x2` host key. These attributes describe the harness, not native-host acceptance.

The context-menu fixtures were taken from the same pinned revision, where two names differ
from the ones older Lucide releases used: `trash.svg` (once `trash-2`) and
`square-dashed-mouse-pointer.svg` (once `box-select`). The production component requests those
pinned names; whether the installed host catalogue answers them is not verified here.

`copy.svg` and `clipboard-paste.svg` (the canvas context menu's Copy and Paste) were taken from the
same pinned revision; whether the installed host catalogue answers `clipboard-paste` is not
verified here.

`building.svg` (the Property tree's `building` plan kind) was taken from the same pinned
revision; whether the installed host catalogue answers `building` is not verified here.

`squircle.svg`, `circle.svg` and `anchor.svg` (the asset designer's Draw rounded rectangle,
Draw circle and Set anchor tools) were taken from the same pinned revision. These three are
the one place this directory can say more than its recurring "not verified here" caveat, and
only a little more: the repository owner ran `npm run test-build` at c6d0f893c on 2026-09-21
and walked the asset designer in a real vault, where all five icon-only buttons drew a glyph
— so that installed catalogue does answer `squircle`, `circle` and `anchor`. The Obsidian
VERSION was not captured, so this is one catalogue on one machine on one date rather than a
pinned claim, and nothing re-runs it.

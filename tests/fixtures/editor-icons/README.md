# Harness icon fixtures

Production `HostIcon.vue` calls Obsidian's `setIcon`; no icon paths or new icon dependency
ship with the plugin. The test-only Obsidian adapter uses these SVG nodes so browser visual
checks can show decorative icons while retaining the same native buttons and text.

Source: [Lucide](https://github.com/lucide-icons/lucide/tree/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons),
revision `2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`. Original SVG files are retained beside
the mechanically extracted `nodes.ts`. The complete [license](LICENSE) includes Lucide's
ISC notice and the MIT notice for Feather-derived icons. No user data is involved.

The harness records unknown requests with `data-icon-missing`; it never substitutes an
unrelated icon. Actual-host acceptance must still verify the installed host catalogue.

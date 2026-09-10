# Shared shell delivery reconstruction

Status: **cumulative validation pending**. Reconstructed from clean contextual-detail
tip `41163d31844822fbdbc605c4540b97cc20dd31a1`, with published PR96 ancestor
`037a8496a71b914e55b49e5e06cecb51564db77f`. Branch:
`codex/editor-deliver-shell`; source/compatibility tip before this documentation is
`0d836558d7111a7fa3a81ac50babb94005f7e914`.

## Source mapping

| Original commit | Reconstructed commit |
|---|---|
| `ce6dccde15a19bc8d5fb7f08c18ea596e5676e49` | `0f096a47c556f404cc47cbd768751a0baa164b38` |
| `251dc7c3f354f3e3aa876dae489df2223eedbaab` | `c07075fa163ab751f581fd8949a9e91aae04c4bd` |
| `03722e9ed2646b3fbc40d413a40f849fc2e6daa3` | `63e7d2577950255cd88ae5e1b0c39e4a68b57993` |
| Native-radio activation from `5d783f1a4305e6f00846b68bf4d2bef522ccf331` | `0d836558d7111a7fa3a81ac50babb94005f7e914` |

The first commit supplies the compact Add popover, contextual header, perspective
radio navigation, labelled panel controls, grouped layers and elements disclosure,
change legend, warning heading and status bar. The second preserves perspective
alignment in Review. The third aligns warning assertions with the displayed heading
and preserves its original verification receipt.

## Context resolutions

- The details mapping is `delivery/contextual-details.md`. Its temporary button
  compatibility fallback in `scripts/editor-area-browser.mjs` is now removed:
  the complete file matches original `5d783f1a` by Git blob ID. Shell introduces
  roving-tabindex perspective radios, so activation uses their native Home/End/
  Arrow key behavior directly.
- `tests/helpers/editorIconNodes.ts` was the only cherry-pick conflict. Transfer
  all seven shell catalogue entries and their SVG fixtures: eye, eye-off, lock,
  lock-open, circle-minus, circle-plus and magnet. The original source ancestor
  also contained rotate-cw/rotate-ccw entries; those were not part of the shell
  patch and remain deferred to the rotation presentation concern. No native-icon
  resolution behavior or previously delivered icon was removed.
- All contextual-details rotation-dependent omissions remain as documented in
  its mapping. This branch does not add generic rotation Inspector controls,
  rotation glyphs, gestures, schema changes, creation, input or group behavior.
- Original shell/warning receipt text retains its named original source and
  historical outcomes. Those outcomes do not validate this reconstructed tip.

## Changed-file audit

The three transferred commits touch 30 distinct paths. Git blob comparison against
the latest owning source commit matches 29 exactly; the sole difference is the two
deliberately deferred rotation entries in the shared icon helper. The additionally
restored browser helper exactly matches `5d783f1a`.

Before this mapping, 31 files differ from the clean details base: the two shell/
warning receipts; `editor-area-browser.mjs` and `editor-review-issues.mjs`; AddMenu;
ChangeLegend, EditorContextBar, EntityInspector, LayerList, PanelRail,
PersistentWarningStrip, PropertyLayerPanel, ResponsiveEditorShell and StatusBar;
EN/DE editor locale imports and editorShell locale files; editor-shell-fidelity,
editor-visual-shell and index stylesheets; the seven SVG fixtures and shared icon
helper; planEditorFailure and shellFidelity tests. This mapping adds one document.
No evidence image or original capture provenance changed.

Only source/context inspection, Git blob comparison and `git diff --check` were
performed. Tests, types, lint and browser/native capture are **unrun** for this
cumulative delivery revision. No heavy checks, push, PR, integration edits or
published-branch rewrites were performed. Root owns the serialized cumulative
verification and later publication.

# Live Obsidian test-vault preparation

Date: 2026-09-07. This is fixture preparation on the previously installed preliminary plugin, not final-build acceptance.

The supported Windows Computer Use API identified the separate `renovation-planner-finalization-vault` window in Obsidian 1.13.7. After restoring that minimized window, the plugin's Renovation project view and Create a project/New asset/Assets controls were visible. The former trust prompt was absent. No security setting was changed. The ordinary `renovation-planner` vault window was not used.

The installed preliminary `main.js` has SHA-256 `8258d6b2482c85bc04b1596e9cf0993fd2df8f45571dc84c6235e77106c972d2`. Its manifest reports version 0.1.0 and minimum Obsidian 1.13.0. This binary must be replaced with the final integrated build, with its own source revision and hashes recorded, before final acceptance.

Native Create a project and New plan forms created:

- Project `Codex Finalization Synthetic 2026-09-07`, ID `project-01M1XSR8AEWA4T9KVEQDGYMED4`.
- Plan `Synthetic Ground Floor`, ID `plan-01M1XSVJ5CECKGQEVW6AFRZYXX`.

The actual files were inspected under `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault/Renovation/Codex Finalization Synthetic 2026-09-07/`: the named Project note and `Plans/Synthetic Ground Floor.md` contain matching stable identities and the Plan's Project reference. Both are revision 1/schema 1 notes from the preliminary build. The native Project view displays the new Plan. No synthetic fixture was written into ordinary user project data.

Windows accessibility focus metadata reported the document root even while a screenshot showed the input caret; focus and entered text were therefore confirmed visually before submission. Immediate snapshots could precede asynchronous Vue/host updates, so subsequent observation and filesystem reads established the result without replaying the submit.

This establishes usable test-vault access and real filesystem fixture creation. It does not establish final M00–M17 behavior, split-leaf/history, migration, image/PDF, restart, device or screen-reader acceptance. H1–H6 remain open. The finalization scratch directory preserves `obsidian-post-restart-state.txt` and `obsidian-synthetic-project-created.txt`.

The repository’s synthetic PNG and PDF background fixtures were copied unchanged into the test vault’s `References/` folder for later native reference setup. SHA-256 equality was checked against each repository source; existing mismatching files would be retained rather than overwritten. This prepares inputs and does not claim image/PDF acceptance.

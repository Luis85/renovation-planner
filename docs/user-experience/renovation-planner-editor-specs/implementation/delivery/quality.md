# Integrated quality delivery

Base: `codex/editor-deliver-stairs` at `8abc8956`. This concern reconciles shared component, command and interface quality after the feature stack. It does not import the original integration branch's ancestry.

| Original | Reconstructed |
|---|---|
| `07853ce2` | `220caf08` |
| `c6052c4d` | `9b0ead35` |
| `cb8fdf6a` | `9dcd1879` |
| `b6d6d581` production/documentation only | `a960fb94` |
| `4992274d` | `65bc0440` |
| `0f12aa9e` | `c4505632` |
| `95a28803` | `30a7bb0b` |
| `c3e1ed71` | `c444fa3c` |
| `67932765` | `2e378cae` |
| `fa17d69b` | `6bd928b0` |
| `b10c3b24` | `f66df143` |

Reviewed reconciliation `4e098a02` restores canonical composition order and the supported optional Group preview capability. It also restores the intended Inspector class, native tab order and common single-selection preview for outlines and handles. At that checkpoint, the complete `src` tree was exactly `0a331fc1f31ce98d4b6d62774eb5dae72606273f` and `styles` exactly `0ae10d132b625db91dd92c9da4a731a4eb24b7e6`, both identical to tested integration `b10c3b24`.

The later production-only wall-review correction from `2b319be2` makes retirement reactive, preserving immediate readonly/disabled controls and imperative stale-write refusal. Its tests and current verification receipt belong to the acceptance concern. The shared browser Add helper from `b6d6d581` is also deferred there because its supplemental drivers are not part of this production cleanup.

Build, lint and all 8,624 tests at `b10c3b24` passed; its full command failed the unchanged coverage floors. A separate Fallow run against that fresh coverage passed. The wall-review follow-up and 168 targeted cases subsequently passed on the integration branch. Those observations are attributed to their original revisions; this reconstructed branch has not independently run a full gate. New coverage work, final nine journeys/eighteen comparisons, actual image inspection, isolated native acceptance and publication remain pending. No thresholds, timeouts or suppressions are changed.

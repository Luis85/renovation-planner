# Copy-paste prompt — independent reviewer

Review the assigned task's actual diff at the named candidate commit against its task card, accepted contract revision and current integration base. Read the changed source and relevant consumers; do not approve from a narrative report alone. Do not modify code during review unless reassigned as the fix owner.

Check scope/ownership, domain boundaries, measured versus pending geometry, identity and group/order invariants, curve/resize semantics, expected versions, single-action history, no-op/cancel behavior, persistence/read-back failures and data migration. For UI work, check actual registration/mounting, focused keyboard behavior, theme/compact states and error messages. For geometry changes, inspect every renderer/export consumer and historical reference behavior.

Examine test adequacy: do tests exercise real dispatch paths? Can a mounted control still do nothing while they pass? Are fixtures independent of implementation assumptions? Are manual runs honestly labeled? Were gate thresholds weakened? Has a newer schema become writable without older-build refusal and recovery coverage?

Return findings with severity, file/line, reproduction or reasoning, user impact and required correction. Distinguish a reproducible failure, a source-level risk and a proposed design preference. If nothing blocks acceptance, state exactly what was reviewed and which test/environment claims remain unverified.

Outcome must be APPROVE FOR INTEGRATION, REQUEST CHANGES or BLOCKED. Approval is not release certification; integrated-SHA tests are still required.

# Active file and resource leases

The orchestrator owns this ledger. It supplements conservative lock groups in manifest.json; it never grants a worker permission to edit unlisted shared files.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|

No leases have been issued by this planning session. Root/runtime/context wiring, shared inspectors/stores, tool registration, locales, composition roots, schema versions, package/lockfiles, quality configuration and central docs are integrator-owned by default.

Use independent disposable test data and harness ports. Release a lease only after its owner has committed/handed off or explicitly suspended changes; do not reassign a dirty shared file implicitly.

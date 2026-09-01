# unreadable-zone

**Two healthy zones on one plan, and nothing planted.** Every defect this fixture is used for
is written by the test that needs it, through `corruptSchemaVersion`, `malformSchemaVersion`,
`invalidateFrontmatter` or `corruptSidecar` in `tests/helpers/fixtureVault.ts`.

That is the opposite choice from `broken-references`, which plants its one edge on disk, and
the reason is what the cases assert. This fixture backs `zoneListingSkips.test.ts`, whose
subject is a listing that must **skip one note and keep the rest** — so each case needs a
DIFFERENT refusal from `loadOne` over the same two-zone shape, and a planted note could only
ever supply one of them. Corrupting at runtime also puts the defect in the case that depends
on it, where the assertion can be read against it.

`kitchen` is the survivor in every case and `pantry` is the casualty. Both are load-bearing:
a listing that skips and a listing that fails are indistinguishable against a fixture holding
only the broken note, and a count of one refusal proves nothing if nothing loaded.

The sidecar holds an entry for BOTH zones, so a zone that refuses in a case refuses for the
reason that case wrote — never because its geometry was missing. `corruptSidecar` is the one
case that touches it, and it exists to prove the opposite property: a sidecar is SHARED, so
its failure is not N note failures and must not be skipped at all.

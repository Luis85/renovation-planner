import { normalizePath, type Vault } from 'obsidian';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { ProjectId } from '../../../domain/project/ProjectId';

/**
 * Where entities live inside the vault. A project's folder is DERIVED — the folder its
 * `Project.md` sits in (ADR-0013) — never a stored field and never the shared plugin
 * setting. The plugin setting names only where a NEW project's folder is created
 * (`freshProjectFolder`); every other path is built from the per-project folder an
 * existing project's own note already answers (`projectFolderOf`).
 *
 * Deriving a SIDECAR path at read time is forbidden (ADR-011): reads resolve through the
 * Project Index. `sidecarPathFor` has exactly two callers in `src/` — counted with a grep
 * over this name, not remembered — and neither of them is a read:
 *
 * - `ObsidianPlanRepository`'s insert path, which creates the file and is therefore the
 *   only code alive at the moment the mapping can first exist; and
 * - `sidecarMappingFor`, which adjudicates two `.rpgeo` files naming one plan id by
 *   preferring the derived path. ADR-0011 allows exactly that — "derivability is a repair
 *   path for a damaged index, not a second lookup mechanism for normal reads" — and a
 *   duplicate is repair: the answer it produces is which path the INDEX should hold, never
 *   a path handed to a reader in place of the index's own.
 */

const GEOMETRY_FOLDER = 'Geometry';

const PLANS_FOLDER = 'Plans';
const ZONES_FOLDER = 'Zones';
const ASSETS_FOLDER = 'Assets';
const REQUIREMENTS_FOLDER = 'Requirements';

/**
 * The user-editable setting passes through `normalizePath` before any Vault call — and then
 * through one more rule this module owns: **the vault root is `''`, never `'/'`.**
 *
 * `joinFolder` below already treats `''` as the root, which is the reason it is a function
 * rather than a template literal in five places. What it cannot survive is being handed
 * `'/'`: it is truthy, so `joinFolder('/', 'Geometry')` is `'//Geometry'`, a path Obsidian
 * refuses to write and finds nothing at — a designed asset would read as shapeless because
 * its sidecar was looked for somewhere it never was.
 *
 * `/` is reachable: it is a folder a user can type into a hand-edited `data.json`, and
 * `settingsFrom` hands back a string rather than a vocabulary for this field.
 *
 * **The collapse is here rather than left to `normalizePath` because which of the two that
 * function returns cannot be settled from this repository.** The `obsidian` dependency is
 * types-only, there is no implementation to read, and the suite's own mock strips the
 * slashes and answers `''` while the real one is believed to fall back to `'/'`. Doing it
 * here makes every caller correct under BOTH readings, which is worth more than being right
 * about the one nobody can check — and it means the mock being kinder than the real thing in
 * exactly this case, which is this repository's oldest recurring defect, no longer decides
 * whether the code works.
 */
export function normalizeFolder(raw: string): string {
	const normalized = normalizePath(raw.trim());
	return normalized === '/' ? '' : normalized;
}

/**
 * The folder a path sits in — what a compensating `create` has to `ensureFolder` first.
 * Here rather than in either repository: the Plan and Zone restore paths both need it,
 * and this module is the one place a path is taken apart or put together.
 */
export function parentOf(path: string): string {
	// slice(0, 0) when there is no slash — no branch needed for rootless paths.
	return path.slice(0, Math.max(path.lastIndexOf('/'), 0));
}

/**
 * A folder and a child, with exactly one separator — and the child alone when the folder
 * is the vault ROOT. A project's folder is derived from where its note sits (ADR-0013), so
 * a `Project.md` at the root derives `''`, and `` `${''}/Plans` `` is `/Plans`, which
 * Obsidian refuses. That case is why this is a function rather than a template literal in
 * five places.
 */
export function joinFolder(folder: string, child: string): string {
	return folder ? `${folder}/${child}` : child;
}

function geometryFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, GEOMETRY_FOLDER);
}

export function plansFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, PLANS_FOLDER);
}

export function zonesFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, ZONES_FOLDER);
}

/** PRD §36 names both new folders; neither owns a sidecar. */
export function assetsFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, ASSETS_FOLDER);
}

export function requirementsFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, REQUIREMENTS_FOLDER);
}

export function sidecarPathFor(projectFolder: string, planId: PlanId | string): string {
	return `${geometryFolderFor(projectFolder)}/${String(planId)}.rpgeo`;
}

/**
 * The library's own geometry folder: a SIBLING of `Assets/`, not a child of it (ADR-0014).
 *
 * `normalizeFolder` here and not at the call site, because `libraryFolder` is a
 * user-typed setting rather than a path this plugin derived — the same trust boundary
 * `freshProjectFolder` applies to the configured project root, and the reason
 * `assetSidecarPathFor` below can take the raw setting from any caller.
 */
export function libraryGeometryFolderFor(libraryFolder: string): string {
	return joinFolder(normalizeFolder(libraryFolder), GEOMETRY_FOLDER);
}

/**
 * ADR-0014: one file per asset, in the library's own `Geometry/`, named by the FULL
 * prefixed id — so the note's `id` field, the sidecar's own `assetId` field and the
 * filename are one comparable string.
 *
 * **This one IS a read path, and that is the difference from `sidecarPathFor` above.** A
 * plan's sidecar is resolved through the Project Index because ADR-011 scopes it to a
 * project folder, which is itself derived from a note the index holds; an asset's is
 * derived from the SETTING, which no index knows and nothing else answers. So there is no
 * mapping to consult and deriving is not a second lookup mechanism — it is the only one.
 * ADR-0014's own Consequences say resolution goes through the index "as it does for plan
 * sidecars", and that sentence is inherited from ADR-011 rather than measured against this
 * decision: the index holds no asset-sidecar mapping, and its Decision section states the
 * derived path as the rule.
 */
export function assetSidecarPathFor(libraryFolder: string, assetId: AssetId | string): string {
	return `${libraryGeometryFolderFor(libraryFolder)}/${String(assetId)}.rpgeo`;
}

/**
 * WHAT A FILENAME MAY NOT CONTAIN — Obsidian's own forbidden set, `\ / : * ? " < > | # ^ [ ]`.
 *
 * Module-private, because both consumers live in this file: a second regex that agrees today is
 * how they stop agreeing, and keeping them here is what makes that impossible rather than merely
 * unlikely. It was briefly exported for a THIRD consumer at the index, which is the placement two
 * rounds of review established was wrong. `fileNameFor` below STRIPS these from a
 * user's chosen name; `entityRefOf` REFUSES an id that contains one, because an id is
 * interpolated into a filename rather than cleaned into one — there is nothing to strip when the
 * string IS the identity.
 *
 * That split was found the hard way: the id rule originally refused only `/` and `\`, which is the
 * SEPARATOR hazard (escaping a folder), and admitted the other nine characters — while this
 * docblock had already named all ten. `Geometry/asset:custom.rpgeo` is a legal path on Linux and
 * macOS and invalid on Windows, so it fails for users and works for whoever wrote it.
 *
 * Not global: a `g` flag makes `RegExp.test` stateful through `lastIndex`, which a shared constant
 * with two call sites must not be. `fileNameFor` builds its own global copy from `.source`.
 */
const FORBIDDEN_IN_FILENAME = /[/\\:*?"<>|#^[\]]/;

/**
 * EDGE DOTS AND SPACES, which Windows and Obsidian both dislike — trimmed by `fileNameFor` and
 * refused by `entityRefOf`, for the same reason the character set above is.
 */
const EDGE_DOT_OR_SPACE = /^[\s.]|[\s.]$/;

/**
 * Windows' reserved DEVICE names, which are reserved **with an extension too** — `CON.rpgeo` and
 * `CON.shape` both name the console rather than a file. Case-insensitive, because the reservation
 * is.
 *
 * Applied to the stem BEFORE THE FIRST DOT, which is the correction this rule needed: anchored on
 * the whole id it caught `CON` and let `CON.shape` through, and the sidecar path appends `.rpgeo`
 * to whatever it is given. Anchored on the stem rather than matched as a substring, so `console`,
 * `console.log` and `my.CON` stay legal — measured, since over-refusing here rejects ids nobody
 * should have to rename.
 */
const RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/**
 * The filename-component limit ext4 and APFS enforce, in BYTES.
 *
 * Bytes and not characters, which is the half a length check gets wrong: `'é'.repeat(130)` is 130
 * characters and 260 bytes, so a character bound passes it and the filesystem still refuses — the
 * same defect one encoding over. Windows' limit is 255 CHARACTERS of a path component, which is
 * looser for non-ASCII and identical for ASCII, so the byte rule covers both.
 */
const MAX_FILENAME_BYTES = 255;

/**
 * UTF-8 byte length, through `TextEncoder` rather than through Node's `Buffer`.
 *
 * `Buffer` is a NODE global and this plugin's manifest declares `isDesktopOnly: false`, so on
 * Obsidian mobile there is no Node and `Buffer.byteLength` is a `ReferenceError` — raised at
 * every sidecar path derivation, on exactly the platform the manifest promises. `TextEncoder`
 * is a web standard and is present in both. Caught by the mobile-safety lint rule, which
 * reports as a warning and is failed by `--max-warnings 0`; nothing in the suite could have
 * seen it, because the tests run under Node.
 */
function utf8Bytes(value: string): number {
	return new TextEncoder().encode(value).length;
}

/**
 * CAN THIS STRING BE A FILENAME — asked of an ENTITY ID, which is interpolated into a path
 * rather than cleaned into one, so there is nothing to strip and the only answer is yes or no.
 *
 * Four rules, the last two each arriving a round after the ones before: the forbidden characters,
 * the edge dots and spaces, the reserved device names, and the LENGTH. `.` and `..` are refused as whole strings
 * rather than by the character class, because a name merely CONTAINING a dot is fine.
 *
 * **Where this is asked is the part that took three attempts.** It belongs at the site that
 * derives a PATH, not at the index that reads a note: every one of these hazards is a write
 * hazard, and refusing at the index made a note the user can see on disk unopenable in the app —
 * lost access traded for a bad write, which is the wrong direction.
 *
 * **What it deliberately does not cover**: `fileNameFor` above strips the characters but passes a
 * reserved NAME through unchanged (`fileNameFor('CON') === 'CON'`, measured), so a note named for
 * a device still lands at an invalid Windows path through `freshNotePath`. That is pre-existing,
 * it is the same class one layer over, and it wants the same treatment at the five repositories'
 * insert paths — recorded here rather than fixed, because widening this change again is how the
 * previous two attempts went wrong.
 */
export function usableAsFilename(id: string, extensionBytes = 0): boolean {
	if (FORBIDDEN_IN_FILENAME.test(id) || EDGE_DOT_OR_SPACE.test(id)) return false;
	if (utf8Bytes(id) + extensionBytes > MAX_FILENAME_BYTES) return false;
	return id !== '.' && id !== '..' && !RESERVED_DEVICE_NAME.test(id);
}

/**
 * Human-chosen filename derived from the entity's name at creation time
 * ("deduplicated on collision" is the caller's job: it knows what already exists, and
 * appends the entity ID when the plain name is taken). Filename is NEVER identity (§83):
 * reads resolve through the index, and this only names what a write creates.
 *
 * Obsidian-forbidden characters (`\ / : * ? " < > | # ^ [ ]`) go first; what remains is
 * trimmed of edge dots and spaces, which Windows and the app both dislike.
 */
export function fileNameFor(name: string): string {
	const clean = name
		.replace(new RegExp(FORBIDDEN_IN_FILENAME.source, 'g'), '')
		.replace(/^[\s.]+|[\s.]+$/g, '')
		.slice(0, 80)
		.replace(/[\s.]+$/g, '');
	return clean || 'untitled';
}

/**
 * The path an INSERT creates its note at: the name-derived filename, or that name plus the
 * entity id when a file already sits there.
 *
 * This is the "deduplicated on collision" half the comment above hands to the caller, and
 * all three repositories are that caller — so it lives here once rather than as a private
 * copy per repository. Two of them had no copy at all and simply built the plain path,
 * which makes `vault.create` reject on any second entity named like the first: two Plans
 * both called "Ground floor" is a thing a user does on purpose, and the second one refused
 * to save with a write failure that named no cause a user could act on.
 *
 * The id suffix is not a uniqueness LOOP — one collision check, then a name carrying an id
 * that is unique by construction. Filename is never identity (§83), so this only has to
 * produce a free path, not a predictable one.
 *
 * **What that means for a save reaching here on a STALE index, said once for all five insert
 * paths, because the docblock that used to say it went with `findNoteIdInFolder`:** this
 * dedupes on PATH, not on id, so an insert for an entity whose note the index has forgotten
 * writes a SECOND note carrying the same `id` beside the first, rather than colliding with
 * it. It is the same reliance on the index that `getById` and `delete` already accept.
 *
 * **What protects it is one mechanism, and "unreachable" is wider than that mechanism
 * reaches.** Within a session, an insert requires `expected === 'absent'` and every
 * repository `upsert`s synchronously before returning, so a note this plugin wrote moments
 * ago is known to the index before any `MetadataCache` has parsed it: write-then-write-again
 * cannot reach the arm. What that does not cover is a note the index NEVER held — the full
 * scan reads through `frontmatterOf`, whose echo is empty at `onLayoutReady`, so a note
 * Obsidian has no cache entry for yet answers `{}` and is dropped from the index entirely —
 * followed by a save at `'absent'` early in the same session.
 * `recoverInterruptedSequences` is that shape: `void`ed from `startPersistence()` and
 * restoring a deleted entity at `'absent'`.
 */
export function freshNotePath(vault: Vault, folder: string, name: string, id: string): string {
	const base = joinFolder(folder, fileNameFor(name));
	return vault.getAbstractFileByPath(`${base}.md`) ? `${base} ${id}.md` : `${base}.md`;
}

/**
 * A project's folder: the folder its `Project.md` sits in (ADR-0013). Resolved through the
 * index, which is the single answer to "where is entity X" (SDD §47) — never by rescanning
 * the vault, and never from the plugin setting, which names only where a NEW project goes.
 *
 * `undefined` is a REFUSAL, not a prompt to fall back: writing to a defaulted path when the
 * real one is unknown is how a note lands in a parallel tree beside the user's work.
 */
export function projectFolderOf(index: ProjectIndex, projectId: ProjectId): string | undefined {
	const path = index.getPath(projectId);
	return path === undefined ? undefined : parentOf(path);
}

/**
 * Where a NEW project's folder goes: the configured root, the name, and the project id when
 * a folder of that name already sits there. `freshNotePath`'s rule, one level up — filename
 * is never identity (§83), so this only has to produce a free path, not a predictable one.
 */
export function freshProjectFolder(vault: Vault, root: string, name: string, id: string): string {
	const base = joinFolder(normalizeFolder(root), fileNameFor(name));
	return vault.getAbstractFileByPath(base) ? `${base} ${id}` : base;
}

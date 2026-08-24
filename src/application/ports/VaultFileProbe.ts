/**
 * "Is there a file at this Vault-relative path?" — the one question a command needs to
 * ask about a raw file rather than about an entity.
 *
 * A port, not a Vault call, for the ordinary reason: `application/` may not name
 * `obsidian` (SDD §3.4), and a repository is the wrong shape here — a background document
 * is a PNG or a PDF the user put in their vault, not a domain entity with frontmatter, a
 * revision and a mapper. `infrastructure/obsidian/` implements it; the composition root
 * wires it.
 *
 * Synchronous, because Obsidian answers it synchronously out of its own file index
 * (`getAbstractFileByPath`) — an async signature here would promise an I/O boundary that
 * does not exist and would make every caller `await` a lookup that never yields.
 */
export interface VaultFileProbe {
	fileExists(path: string): boolean;
}

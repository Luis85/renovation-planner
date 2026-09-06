import type { Workspace } from 'obsidian';
/** Use the host's ordinary Markdown navigation; no record identity is replaced by a path. */
export async function openReviewNote(workspace: Workspace, path: string): Promise<void> {
	await workspace.openLinkText(path, '', false);
}

import { tr } from '../presentation/i18n/strings';
import type { Vault, Workspace } from 'obsidian';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { Logger } from '../application/ports/Logger';
import type { PlanId } from '../domain/plan/PlanId';
import { ObsidianReviewNotes } from '../infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
import { ok } from '../core/result/Result';
import { openReviewNote } from '../infrastructure/obsidian/workspace/openReviewNote';

export function reviewNoteAction(vault: Vault, workspace: Workspace, index: ProjectIndex, logger: Logger) {
	const notes = new ObsidianReviewNotes(vault, index);
	const action = guardCommand({ async execute(input: { planId: PlanId; body: string }) {
		const source = index.getPath(input.planId) ?? '';
		const result = await notes.generate(input.planId, `${input.body}\n\n[${tr('renovation.source-floor')}](${source.split('/').map(segment => encodeURIComponent(segment)).join('/').replaceAll('(', '%28').replaceAll(')', '%29')})\n`);
		if (!result.ok) return result;
		await openReviewNote(workspace, result.value);
		return ok(undefined);
	} }, 'review.generate.failed', logger, VAULT_EXCEPTION_MAPPER);
	return (planId: PlanId, body: string) => action.execute({ planId, body });
}

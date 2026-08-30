import { err, type Result } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import type { Command } from '../../application/commands/Command';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type { Logger } from '../../application/ports/Logger';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { Project } from '../../domain/project/Project';

type CreateProjectResult = Result<{ project: Loaded<Project> }, RepositoryError>;

/**
 * The write side of the Renovation Project view — the mirror of
 * `RenovationProjectQueryServices`, and the same bargain `PlanEditorCommandServices` makes:
 * application-layer interfaces handed to presentation, composed and GUARDED at the root,
 * never a repository the view built.
 *
 * Typed structurally (`Command<I, Result<T, E>>`) rather than as the concrete class, because
 * what leaves the root is a `guardCommand` wrapper with the same `execute` — a field typed as
 * the class would be a lie the compiler would then have to be argued out of.
 */
export interface RenovationProjectCommandServices {
	readonly createProject: Command<CreateProjectInput, CreateProjectResult>;
	/**
	 * The composition root's logger, reaching this view — the same member
	 * `PlanEditorCommandServices` carries, for the same reason and with the same limit.
	 *
	 * Presentation has no logger of its own and this changes nothing about that: it is one more
	 * thing the root hands down. `NewProjectForm` needs it because `useFormCommit` has a door no
	 * guard stands behind (a dispatch that THROWS), where the unmapped cause is the only detail
	 * that exists at all.
	 */
	readonly logger: Logger;
}

const noop = (): void => undefined;

function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

/**
 * The write side for a session whose settings could not be recovered.
 *
 * A refusal bundle is the honest stand-in ONLY where the real thing would also have nothing
 * to give, and that holds here: every member is a write, and without the settings there is no
 * default projects root under which `freshProjectFolder` could place a new project's folder.
 * The composition root's own comment names this exact door as the reason it composes no stack
 * at all in that state.
 */
export function unavailableRenovationProjectCommands(): RenovationProjectCommandServices {
	return {
		createProject: {
			execute(): Promise<CreateProjectResult> {
				return Promise.resolve(err(persistenceFailure()) as CreateProjectResult);
			},
		},
		// A logger member that records nothing, exactly as `unavailablePlanEditorCommands`'s
		// does: this bundle's only failure is the refusal above, which is a resolved `Result`
		// rather than a fault, so there is nothing here for a real logger to be told about.
		logger: { debug: noop, info: noop, warn: noop, error: noop },
	};
}

import type { AppError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
export interface EvidenceFile { path: string; subpath: string; image: string | null }
export interface EvidenceFiles {
	list(): readonly string[];
	resolve(link: string, planId: PlanId): Result<EvidenceFile, AppError>;
	open(path: string, subpath: string): Promise<Result<void, AppError>>;
	createNote(planId: PlanId, id: string, body: string): Promise<Result<string, AppError>>;
	importFile(planId: PlanId, name: string, bytes: ArrayBuffer): Promise<Result<string, AppError>>;
}

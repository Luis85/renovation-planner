import { z } from 'zod';
import { CHANGES, CONDITIONS, DETAIL_KINDS, WORK_PROGRESS } from '../../../domain/renovation/Renovation';

const id = z.string().min(1);
export const RenovationSchema = z.object({
	subjects: z.array(z.object({
		id, roomId: id, targetId: id, kind: z.enum(DETAIL_KINDS),
		existing: z.object({ description: z.string(), condition: z.enum(CONDITIONS) }).nullable(),
		planned: z.object({ change: z.enum(CHANGES), description: z.string() }).nullable(),
	})),
	work: z.array(z.object({
		id, roomId: id, targetId: id, title: z.string(), description: z.string(),
		order: z.number().int().nonnegative(), progress: z.enum(WORK_PROGRESS),
		responsibility: z.enum(['unassigned', 'diy']), outcomes: z.array(id), dependencies: z.array(id),
	})),
	decisions: z.array(z.object({
		id, roomId: id, subjectId: id, question: z.string(), resolution: z.string(), resolved: z.boolean(),
	})),
});

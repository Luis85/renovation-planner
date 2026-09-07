import type { ProjectId } from '../../../domain/project/ProjectId';
import type { ProjectWorkServices } from '../../../application/queries/schedule/ProjectWork';
import { useLiveRead } from '../../composables/live-read';
export function useProjectWorkRead(services: ProjectWorkServices | undefined, projectId: string) {
 return useLiveRead(services ? { read: () => services.read(projectId as ProjectId), onChanged: listener => services.onChanged(listener) } : undefined);
}

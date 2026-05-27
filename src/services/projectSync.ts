import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseServices } from './firebase';
import { WorkspaceProject } from './workspace';

export type SyncedProject = {
  id: string;
  name: string;
  fileCount: number;
  folderCount: number;
  updatedAt: string;
  path: string;
  syncedAt: string | null;
};

function requireSignedInServices() {
  const services = getFirebaseServices();
  if (!services?.auth.currentUser) {
    throw new Error('Sign in first to sync projects.');
  }

  return services;
}

function getProjectsCollection() {
  const { auth, db } = requireSignedInServices();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in first to sync projects.');
  }

  return collection(db, 'users', user.uid, 'projects');
}

export async function syncProjectMetadata(project: WorkspaceProject) {
  await setDoc(
    doc(getProjectsCollection(), project.id),
    {
      id: project.id,
      name: project.name,
      fileCount: project.fileCount,
      folderCount: project.folderCount,
      updatedAt: project.updatedAt,
      path: project.path,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removeProjectMetadata(projectId: string) {
  await deleteDoc(doc(getProjectsCollection(), projectId));
}

export function observeSyncedProjects(
  listener: (projects: SyncedProject[]) => void,
  onError: (error: Error) => void,
) {
  try {
    const projectsQuery = query(getProjectsCollection(), orderBy('name'));
    return onSnapshot(
      projectsQuery,
      (snapshot) => {
        listener(
          snapshot.docs.map((item) => {
            const data = item.data() as Record<string, unknown>;
            const syncedAt = data.syncedAt as { toDate?: () => Date } | undefined;
            return {
              id: String(data.id ?? item.id),
              name: String(data.name ?? item.id),
              fileCount: Number(data.fileCount ?? 0),
              folderCount: Number(data.folderCount ?? 0),
              updatedAt: String(data.updatedAt ?? ''),
              path: String(data.path ?? ''),
              syncedAt: syncedAt?.toDate ? syncedAt.toDate().toLocaleString() : null,
            };
          }),
        );
      },
      (error) => onError(error instanceof Error ? error : new Error('Project sync listener failed.')),
    );
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Project sync is unavailable.'));
    return () => undefined;
  }
}

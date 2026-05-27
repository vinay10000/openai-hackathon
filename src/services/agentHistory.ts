import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { getFirebaseServices } from './firebase';

const HISTORY_STORAGE_KEY = 'rootforge.agent.history.v1';

export type AgentHistoryEntry = {
  id: string;
  projectId: string;
  projectName: string;
  prompt: string;
  planSummary: string;
  executionSummary: string;
  createdAt: string;
  createdAtMs: number;
  approvedActions: string[];
  deniedActions: string[];
  reviewedAccepted: string[];
  reviewedRejected: string[];
  approvedCommands: string[];
  appliedOperations: string[];
};

function normalizeHistoryEntry(value: unknown): AgentHistoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    id: String(record.id ?? ''),
    projectId: String(record.projectId ?? ''),
    projectName: String(record.projectName ?? ''),
    prompt: String(record.prompt ?? ''),
    planSummary: String(record.planSummary ?? ''),
    executionSummary: String(record.executionSummary ?? ''),
    createdAt: String(record.createdAt ?? ''),
    createdAtMs: Number(record.createdAtMs ?? 0),
    approvedActions: Array.isArray(record.approvedActions) ? record.approvedActions.map(String) : [],
    deniedActions: Array.isArray(record.deniedActions) ? record.deniedActions.map(String) : [],
    reviewedAccepted: Array.isArray(record.reviewedAccepted) ? record.reviewedAccepted.map(String) : [],
    reviewedRejected: Array.isArray(record.reviewedRejected) ? record.reviewedRejected.map(String) : [],
    approvedCommands: Array.isArray(record.approvedCommands) ? record.approvedCommands.map(String) : [],
    appliedOperations: Array.isArray(record.appliedOperations) ? record.appliedOperations.map(String) : [],
  };
}

async function readStorageValue() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(HISTORY_STORAGE_KEY);
  }

  return AsyncStorage.getItem(HISTORY_STORAGE_KEY);
}

async function writeStorageValue(value: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HISTORY_STORAGE_KEY, value);
    }
    return;
  }

  await AsyncStorage.setItem(HISTORY_STORAGE_KEY, value);
}

export async function listAgentHistory() {
  const raw = await readStorageValue();
  if (!raw) {
    return [] as AgentHistoryEntry[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed)
      ? parsed.map(normalizeHistoryEntry).filter((entry): entry is AgentHistoryEntry => Boolean(entry))
      : [];
  } catch {
    return [];
  }
}

export async function appendAgentHistory(entry: AgentHistoryEntry) {
  const current = await listAgentHistory();
  const next = [entry, ...current].slice(0, 20);
  await writeStorageValue(JSON.stringify(next));
  return next;
}

function requireSignedInServices() {
  const services = getFirebaseServices();
  if (!services?.auth.currentUser) {
    throw new Error('Sign in first to sync agent history.');
  }

  return services;
}

function getAgentHistoryCollection() {
  const { auth, db } = requireSignedInServices();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in first to sync agent history.');
  }

  return collection(db, 'users', user.uid, 'agentRuns');
}

export async function syncAgentHistoryEntry(entry: AgentHistoryEntry) {
  await setDoc(
    doc(getAgentHistoryCollection(), entry.id),
    {
      ...entry,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function observeRemoteAgentHistory(
  listener: (entries: AgentHistoryEntry[]) => void,
  onError: (error: Error) => void,
) {
  try {
    const historyQuery = query(getAgentHistoryCollection(), orderBy('createdAtMs', 'desc'));
    return onSnapshot(
      historyQuery,
      (snapshot) => {
        listener(
          snapshot.docs
            .map((item) => normalizeHistoryEntry({ id: item.id, ...item.data() }))
            .filter((entry): entry is AgentHistoryEntry => Boolean(entry)),
        );
      },
      (error) => onError(error instanceof Error ? error : new Error('Agent history listener failed.')),
    );
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Agent history sync is unavailable.'));
    return () => undefined;
  }
}

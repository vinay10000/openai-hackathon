import { AgentPermission } from '../../services/aiClient';

export type AgentAction = {
  id: string;
  label: string;
  status: 'pending' | 'approved' | 'denied' | 'done';
  risk: 'low' | 'medium' | 'high';
  details: string;
};

export type DiffLine = {
  kind: 'same' | 'added' | 'removed';
  value: string;
};

export type ReviewedOperation = {
  id: string;
  path: string;
  type: 'write_file' | 'delete_path';
  rationale: string;
  beforeContent: string;
  afterContent: string;
  accepted: boolean;
  diffLines: DiffLine[];
};

export const permissionLabels: { key: AgentPermission; label: string }[] = [
  { key: 'read', label: 'Read' },
  { key: 'edit', label: 'Edit' },
  { key: 'create', label: 'Create' },
  { key: 'delete', label: 'Delete' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'install', label: 'Install' },
  { key: 'internet', label: 'Internet' },
  { key: 'commit', label: 'Commit' },
];

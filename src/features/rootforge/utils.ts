import { Alert } from 'react-native';

import { draftGemmaAgentPlan, type AgentPermission } from '../../services/aiClient';
import { WorkspaceNode } from '../../services/workspace';
import { AgentAction, DiffLine } from './types';

export function showError(message: string) {
  Alert.alert('RootForge', message);
}

export function treeHasPath(nodes: WorkspaceNode[], targetPath: string): boolean {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return true;
    }

    if (node.children && treeHasPath(node.children, targetPath)) {
      return true;
    }
  }

  return false;
}

export function findNodeByPath(nodes: WorkspaceNode[], targetPath: string): WorkspaceNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }

    if (node.children) {
      const child = findNodeByPath(node.children, targetPath);
      if (child) {
        return child;
      }
    }
  }

  return null;
}

export function parentPathForCreation(node: WorkspaceNode | null) {
  if (!node) {
    return '';
  }

  if (node.type === 'folder') {
    return node.path;
  }

  const lastSlash = node.path.lastIndexOf('/');
  return lastSlash === -1 ? '' : node.path.slice(0, lastSlash);
}

export function flattenWorkspaceTree(nodes: WorkspaceNode[], depth = 0): string[] {
  return nodes.flatMap((node) => {
    const prefix = `${'  '.repeat(depth)}${node.type === 'folder' ? 'dir' : 'file'} `;
    const current = `${prefix}${node.path}`;
    return node.children ? [current, ...flattenWorkspaceTree(node.children, depth + 1)] : [current];
  });
}

export function buildActionsFromPlan(plan: Awaited<ReturnType<typeof draftGemmaAgentPlan>>): AgentAction[] {
  const actions: AgentAction[] = [];

  plan.filesToCreate.forEach((path) => {
    actions.push({
      id: `create:${path}`,
      label: `Create ${path}`,
      status: 'pending',
      risk: 'low',
      details: 'Planned file creation from live Gemma output.',
    });
  });

  plan.filesToModify.forEach((path) => {
    actions.push({
      id: `modify:${path}`,
      label: `Modify ${path}`,
      status: 'pending',
      risk: 'medium',
      details: 'Planned file edit from live Gemma output.',
    });
  });

  plan.filesToDelete.forEach((path) => {
    actions.push({
      id: `delete:${path}`,
      label: `Delete ${path}`,
      status: 'pending',
      risk: 'high',
      details: 'Planned deletion from live Gemma output.',
    });
  });

  plan.commands.forEach((command) => {
    actions.push({
      id: `command:${command}`,
      label: `Run ${command}`,
      status: 'pending',
      risk: command.includes('rm ') || command.includes('del ') ? 'high' : 'medium',
      details: 'Planned terminal command from live Gemma output.',
    });
  });

  return actions;
}

export function getApprovedActionTargets(actions: AgentAction[]) {
  const approvedCreates: string[] = [];
  const approvedModifies: string[] = [];
  const approvedDeletes: string[] = [];
  const approvedCommands: string[] = [];

  actions
    .filter((action) => action.status === 'approved')
    .forEach((action) => {
      if (action.id.startsWith('create:')) {
        approvedCreates.push(action.id.slice('create:'.length));
      } else if (action.id.startsWith('modify:')) {
        approvedModifies.push(action.id.slice('modify:'.length));
      } else if (action.id.startsWith('delete:')) {
        approvedDeletes.push(action.id.slice('delete:'.length));
      } else if (action.id.startsWith('command:')) {
        approvedCommands.push(action.id.slice('command:'.length));
      }
    });

  return {
    approvedCreates,
    approvedModifies,
    approvedDeletes,
    approvedCommands,
  };
}

export function slugToProjectId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeForDiff(value: string) {
  return value.replace(/\r\n/g, '\n');
}

export function buildDiffLines(beforeContent: string, afterContent: string): DiffLine[] {
  const beforeLines = normalizeForDiff(beforeContent).split('\n');
  const afterLines = normalizeForDiff(afterContent).split('\n');

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const lines: DiffLine[] = [];

  beforeLines.slice(0, prefix).forEach((value) => lines.push({ kind: 'same', value }));
  beforeLines
    .slice(prefix, beforeLines.length - suffix)
    .forEach((value) => lines.push({ kind: 'removed', value }));
  afterLines
    .slice(prefix, afterLines.length - suffix)
    .forEach((value) => lines.push({ kind: 'added', value }));
  beforeLines
    .slice(beforeLines.length - suffix)
    .forEach((value) => lines.push({ kind: 'same', value }));

  return lines.length ? lines : [{ kind: 'same', value: '' }];
}

export function togglePermissionValue(current: AgentPermission[], permission: AgentPermission) {
  return current.includes(permission)
    ? current.filter((item) => item !== permission)
    : [...current, permission];
}

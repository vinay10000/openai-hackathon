import { Platform } from 'react-native';

export type WorkspaceNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: WorkspaceNode[];
};

export type WorkspaceProject = {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
  fileCount: number;
  folderCount: number;
  files: WorkspaceNode[];
};

export type WorkspaceSearchResult = {
  path: string;
  name: string;
  type: 'file' | 'folder';
};

export type WorkspaceMoveTarget = {
  path: string;
  name: string;
  type: 'folder';
};

export type WorkspaceWriteOperation = {
  type: 'write_file' | 'delete_path';
  path: string;
  content?: string;
};

const ROOT_DIR_NAME = 'root-workspace';
const WEB_STORAGE_KEY = 'rootforge.workspace.v1';

type WebNodeRecord = {
  type: 'file' | 'folder';
  content?: string;
};

type WebWorkspaceState = {
  nodes: Record<string, WebNodeRecord>;
};

function slugifyProjectName(name: string) {
  const trimmed = name.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `project-${Date.now()}`;
}

function formatUpdatedAt(date = new Date()) {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function joinRelativePath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function parentRelativePath(path: string) {
  const normalized = joinRelativePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
}

function nodeId(path: string) {
  return path || 'root';
}

function compareNodes(a: WorkspaceNode, b: WorkspaceNode) {
  if (a.type !== b.type) {
    return a.type === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function buildTreeFromRelativePaths(entries: Array<{ path: string; type: 'file' | 'folder' }>) {
  const root: WorkspaceNode[] = [];
  const folders = new Map<string, WorkspaceNode>();

  for (const entry of entries.sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = entry.path.split('/').filter(Boolean);
    const name = segments[segments.length - 1];
    const path = joinRelativePath(...segments);
    const parentPath = parentRelativePath(path);
    const node: WorkspaceNode = {
      id: nodeId(path),
      name,
      type: entry.type,
      path,
      children: entry.type === 'folder' ? [] : undefined,
    };

    if (entry.type === 'folder') {
      folders.set(path, node);
    }

    if (!parentPath) {
      root.push(node);
      continue;
    }

    const parent = folders.get(parentPath);
    if (parent?.children) {
      parent.children.push(node);
    }
  }

  const sortChildren = (nodes: WorkspaceNode[]) => {
    nodes.sort(compareNodes);
    for (const node of nodes) {
      if (node.children) {
        sortChildren(node.children);
      }
    }
  };

  sortChildren(root);
  return root;
}

function countTree(nodes: WorkspaceNode[]) {
  let fileCount = 0;
  let folderCount = 0;

  const visit = (items: WorkspaceNode[]) => {
    for (const item of items) {
      if (item.type === 'folder') {
        folderCount += 1;
        if (item.children) {
          visit(item.children);
        }
      } else {
        fileCount += 1;
      }
    }
  };

  visit(nodes);
  return { fileCount, folderCount };
}

function assertValidName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name is required.');
  }

  if (/[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error('Name contains unsupported characters.');
  }

  return trimmed;
}

function assertValidRelativePath(path: string) {
  const normalized = joinRelativePath(path);
  if (!normalized) {
    throw new Error('Destination path is required.');
  }

  const segments = normalized.split('/').filter(Boolean);
  segments.forEach(assertValidName);
  return segments.join('/');
}

function getWebState(): WebWorkspaceState {
  if (typeof localStorage === 'undefined') {
    return { nodes: {} };
  }

  const raw = localStorage.getItem(WEB_STORAGE_KEY);
  if (!raw) {
    return { nodes: {} };
  }

  try {
    return JSON.parse(raw) as WebWorkspaceState;
  } catch {
    return { nodes: {} };
  }
}

function saveWebState(state: WebWorkspaceState) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(state));
  }
}

function ensureWebRoot() {
  const state = getWebState();
  if (!state.nodes[ROOT_DIR_NAME]) {
    state.nodes[ROOT_DIR_NAME] = { type: 'folder' };
    saveWebState(state);
  }
}

function getRootWorkspaceUriNative() {
  const { Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new Directory(Paths.document, ROOT_DIR_NAME);
}

async function listProjectsNative(): Promise<WorkspaceProject[]> {
  const rootDir = getRootWorkspaceUriNative();
  if (!rootDir.exists) {
    rootDir.create({ intermediates: true, idempotent: true });
  }

  const items = rootDir.list().filter((item) => item instanceof rootDir.constructor);
  const projects: WorkspaceProject[] = [];

  for (const item of items) {
    if (!('list' in item) || !('name' in item) || !('uri' in item)) {
      continue;
    }

    const relativeEntries = collectNativeEntries(item as import('expo-file-system').Directory, '');
    const files = buildTreeFromRelativePaths(relativeEntries);
    const counts = countTree(files);
    projects.push({
      id: slugifyProjectName(item.name),
      name: item.name,
      path: item.uri,
      updatedAt: formatUpdatedAt(),
      fileCount: counts.fileCount,
      folderCount: counts.folderCount,
      files,
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function collectNativeEntries(
  directory: import('expo-file-system').Directory,
  relativePrefix: string,
): Array<{ path: string; type: 'file' | 'folder' }> {
  const entries: Array<{ path: string; type: 'file' | 'folder' }> = [];

  for (const item of directory.list()) {
    const relativePath = joinRelativePath(relativePrefix, item.name);
    if ('list' in item) {
      entries.push({ path: relativePath, type: 'folder' });
      entries.push(...collectNativeEntries(item as import('expo-file-system').Directory, relativePath));
    } else {
      entries.push({ path: relativePath, type: 'file' });
    }
  }

  return entries;
}

function resolveNativeDirectory(projectName: string, relativePath = '') {
  const { Directory, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new Directory(Paths.document, ROOT_DIR_NAME, projectName, ...relativePath.split('/').filter(Boolean));
}

function resolveNativeFile(projectName: string, relativePath: string) {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new File(Paths.document, ROOT_DIR_NAME, projectName, ...relativePath.split('/').filter(Boolean));
}

function getWebProjectPrefix(projectName: string) {
  return joinRelativePath(ROOT_DIR_NAME, projectName);
}

function getWebProjectEntries(projectName: string) {
  const state = getWebState();
  const prefix = `${getWebProjectPrefix(projectName)}/`;
  const entries: Array<{ path: string; type: 'file' | 'folder' }> = [];

  for (const [path, value] of Object.entries(state.nodes)) {
    if (!path.startsWith(prefix)) {
      continue;
    }

    const relativePath = path.slice(prefix.length);
    if (!relativePath) {
      continue;
    }

    entries.push({ path: relativePath, type: value.type });
  }

  return entries;
}

function ensureWebParentFolders(state: WebWorkspaceState, projectName: string, relativePath: string) {
  const projectPrefix = getWebProjectPrefix(projectName);
  const segments = parentRelativePath(relativePath).split('/').filter(Boolean);

  let currentPath = projectPrefix;
  for (const segment of segments) {
    currentPath = joinRelativePath(currentPath, segment);
    if (!state.nodes[currentPath]) {
      state.nodes[currentPath] = { type: 'folder' };
    }
  }
}

async function listProjectsWeb(): Promise<WorkspaceProject[]> {
  ensureWebRoot();
  const state = getWebState();
  const projectPrefix = `${ROOT_DIR_NAME}/`;
  const projectNames = new Set<string>();

  for (const path of Object.keys(state.nodes)) {
    if (!path.startsWith(projectPrefix)) {
      continue;
    }

    const relative = path.slice(projectPrefix.length);
    const [projectName] = relative.split('/');
    if (projectName) {
      projectNames.add(projectName);
    }
  }

  return [...projectNames]
    .sort((a, b) => a.localeCompare(b))
    .map((projectName) => {
      const files = buildTreeFromRelativePaths(getWebProjectEntries(projectName));
      const counts = countTree(files);
      return {
        id: slugifyProjectName(projectName),
        name: projectName,
        path: `${WEB_STORAGE_KEY}/${projectName}`,
        updatedAt: formatUpdatedAt(),
        fileCount: counts.fileCount,
        folderCount: counts.folderCount,
        files,
      };
    });
}

export function getRootWorkspacePath() {
  if (Platform.OS === 'web') {
    return `localStorage://${ROOT_DIR_NAME}`;
  }

  return getRootWorkspaceUriNative().uri;
}

export async function ensureRootWorkspace() {
  if (Platform.OS === 'web') {
    ensureWebRoot();
    return getRootWorkspacePath();
  }

  const rootDir = getRootWorkspaceUriNative();
  if (!rootDir.exists) {
    rootDir.create({ intermediates: true, idempotent: true });
  }

  return rootDir.uri;
}

export async function listProjects() {
  return Platform.OS === 'web' ? listProjectsWeb() : listProjectsNative();
}

export async function createProject(name: string) {
  const safeName = assertValidName(name);

  if (Platform.OS === 'web') {
    ensureWebRoot();
    const state = getWebState();
    const projectPath = getWebProjectPrefix(safeName);
    if (state.nodes[projectPath]) {
      throw new Error('A project with that name already exists.');
    }

    state.nodes[projectPath] = { type: 'folder' };
    state.nodes[`${projectPath}/README.md`] = {
      type: 'file',
      content: `# ${safeName}\n\nCreated in RootForge.\n`,
    };
    saveWebState(state);
    return safeName;
  }

  const projectDir = resolveNativeDirectory(safeName);
  if (projectDir.exists) {
    throw new Error('A project with that name already exists.');
  }

  projectDir.create({ intermediates: true, idempotent: false });
  const readme = resolveNativeFile(safeName, 'README.md');
  readme.create({ intermediates: true, overwrite: false });
  readme.write(`# ${safeName}\n\nCreated in RootForge.\n`);
  return safeName;
}

export async function createEntry(projectName: string, parentPath: string, name: string, type: 'file' | 'folder') {
  const safeName = assertValidName(name);
  const relativePath = joinRelativePath(parentPath, safeName);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const fullPath = joinRelativePath(getWebProjectPrefix(projectName), relativePath);
    if (state.nodes[fullPath]) {
      throw new Error('An item with that name already exists.');
    }

    state.nodes[fullPath] = type === 'folder' ? { type: 'folder' } : { type: 'file', content: '' };
    saveWebState(state);
    return relativePath;
  }

  if (type === 'folder') {
    const dir = resolveNativeDirectory(projectName, relativePath);
    if (dir.exists) {
      throw new Error('An item with that name already exists.');
    }

    dir.create({ intermediates: true, idempotent: false });
    return relativePath;
  }

  const file = resolveNativeFile(projectName, relativePath);
  if (file.exists) {
    throw new Error('An item with that name already exists.');
  }

  file.create({ intermediates: true, overwrite: false });
  file.write('');
  return relativePath;
}

export async function readFileContent(projectName: string, path: string) {
  const relativePath = joinRelativePath(path);
  if (!relativePath) {
    throw new Error('File path is required.');
  }

  if (Platform.OS === 'web') {
    const state = getWebState();
    const fullPath = joinRelativePath(getWebProjectPrefix(projectName), relativePath);
    const item = state.nodes[fullPath];
    if (!item || item.type !== 'file') {
      throw new Error('File no longer exists.');
    }

    return item.content ?? '';
  }

  const file = resolveNativeFile(projectName, relativePath);
  if (!file.exists) {
    throw new Error('File no longer exists.');
  }

  return file.textSync();
}

export async function writeFileContent(projectName: string, path: string, content: string) {
  const relativePath = joinRelativePath(path);
  if (!relativePath) {
    throw new Error('File path is required.');
  }

  if (Platform.OS === 'web') {
    const state = getWebState();
    ensureWebParentFolders(state, projectName, relativePath);
    state.nodes[joinRelativePath(getWebProjectPrefix(projectName), relativePath)] = {
      type: 'file',
      content,
    };
    saveWebState(state);
    return relativePath;
  }

  const parentPath = parentRelativePath(relativePath);
  if (parentPath) {
    const parentDir = resolveNativeDirectory(projectName, parentPath);
    if (!parentDir.exists) {
      parentDir.create({ idempotent: true, intermediates: true });
    }
  }

  const file = resolveNativeFile(projectName, relativePath);
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: false });
  }

  file.write(content);
  return relativePath;
}

export async function renameEntry(projectName: string, path: string, nextName: string) {
  const safeName = assertValidName(nextName);
  const parentPath = parentRelativePath(path);
  const nextRelativePath = joinRelativePath(parentPath, safeName);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const projectPrefix = getWebProjectPrefix(projectName);
    const currentFullPath = joinRelativePath(projectPrefix, path);
    const nextFullPath = joinRelativePath(projectPrefix, nextRelativePath);

    for (const existingPath of Object.keys(state.nodes)) {
      if (existingPath === currentFullPath || existingPath.startsWith(`${currentFullPath}/`)) {
        const suffix = existingPath.slice(currentFullPath.length);
        state.nodes[`${nextFullPath}${suffix}`] = state.nodes[existingPath];
        delete state.nodes[existingPath];
      }
    }

    saveWebState(state);
    return nextRelativePath;
  }

  const dir = resolveNativeDirectory(projectName, path);
  if (dir.exists) {
    dir.move(resolveNativeDirectory(projectName, nextRelativePath));
    return nextRelativePath;
  }

  const file = resolveNativeFile(projectName, path);
  if (!file.exists) {
    throw new Error('Item no longer exists.');
  }

  file.move(resolveNativeFile(projectName, nextRelativePath));
  return nextRelativePath;
}

export async function moveEntry(projectName: string, path: string, destinationFolderPath: string) {
  const currentPath = joinRelativePath(path);
  if (!currentPath) {
    throw new Error('Select an item to move first.');
  }

  const targetFolderPath = destinationFolderPath.trim()
    ? assertValidRelativePath(destinationFolderPath)
    : '';
  const itemName = currentPath.split('/').filter(Boolean).pop();
  if (!itemName) {
    throw new Error('Unable to resolve the selected item name.');
  }

  const nextRelativePath = joinRelativePath(targetFolderPath, itemName);
  if (!nextRelativePath || nextRelativePath === currentPath) {
    return currentPath;
  }

  if (targetFolderPath && (targetFolderPath === currentPath || targetFolderPath.startsWith(`${currentPath}/`))) {
    throw new Error('Cannot move a folder into itself.');
  }

  if (Platform.OS === 'web') {
    const state = getWebState();
    const projectPrefix = getWebProjectPrefix(projectName);
    const currentFullPath = joinRelativePath(projectPrefix, currentPath);
    const nextFullPath = joinRelativePath(projectPrefix, nextRelativePath);

    if (state.nodes[nextFullPath]) {
      throw new Error('An item already exists at the destination.');
    }

    if (targetFolderPath) {
      const destinationFolderFullPath = joinRelativePath(projectPrefix, targetFolderPath);
      if (!state.nodes[destinationFolderFullPath] || state.nodes[destinationFolderFullPath].type !== 'folder') {
        throw new Error('Destination folder does not exist.');
      }
    }

    for (const existingPath of Object.keys(state.nodes)) {
      if (existingPath === currentFullPath || existingPath.startsWith(`${currentFullPath}/`)) {
        const suffix = existingPath.slice(currentFullPath.length);
        state.nodes[`${nextFullPath}${suffix}`] = state.nodes[existingPath];
        delete state.nodes[existingPath];
      }
    }

    saveWebState(state);
    return nextRelativePath;
  }

  const destinationDir = targetFolderPath ? resolveNativeDirectory(projectName, targetFolderPath) : resolveNativeDirectory(projectName);
  if (!destinationDir.exists) {
    throw new Error('Destination folder does not exist.');
  }

  const nextDir = resolveNativeDirectory(projectName, nextRelativePath);
  if (nextDir.exists) {
    throw new Error('An item already exists at the destination.');
  }

  const nextFile = resolveNativeFile(projectName, nextRelativePath);
  if (nextFile.exists) {
    throw new Error('An item already exists at the destination.');
  }

  const dir = resolveNativeDirectory(projectName, currentPath);
  if (dir.exists) {
    dir.move(nextDir);
    return nextRelativePath;
  }

  const file = resolveNativeFile(projectName, currentPath);
  if (!file.exists) {
    throw new Error('Item no longer exists.');
  }

  file.move(nextFile);
  return nextRelativePath;
}

export async function deleteEntry(projectName: string, path: string) {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const fullPath = joinRelativePath(getWebProjectPrefix(projectName), path);
    for (const existingPath of Object.keys(state.nodes)) {
      if (existingPath === fullPath || existingPath.startsWith(`${fullPath}/`)) {
        delete state.nodes[existingPath];
      }
    }

    saveWebState(state);
    return;
  }

  const dir = resolveNativeDirectory(projectName, path);
  if (dir.exists) {
    dir.delete();
    return;
  }

  const file = resolveNativeFile(projectName, path);
  if (file.exists) {
    file.delete();
  }
}

export async function deleteProject(projectName: string) {
  if (Platform.OS === 'web') {
    await deleteEntry(projectName, '');
    const state = getWebState();
    delete state.nodes[getWebProjectPrefix(projectName)];
    saveWebState(state);
    return;
  }

  const projectDir = resolveNativeDirectory(projectName);
  if (projectDir.exists) {
    projectDir.delete();
  }
}

export async function applyFileOperations(projectName: string, operations: WorkspaceWriteOperation[]) {
  for (const operation of operations) {
    if (operation.type === 'write_file') {
      await writeFileContent(projectName, operation.path, operation.content ?? '');
      continue;
    }

    await deleteEntry(projectName, operation.path);
  }
}

export async function renameProject(projectName: string, nextName: string) {
  const safeName = assertValidName(nextName);
  if (projectName === safeName) {
    return safeName;
  }

  if (Platform.OS === 'web') {
    const state = getWebState();
    const currentPrefix = getWebProjectPrefix(projectName);
    const nextPrefix = getWebProjectPrefix(safeName);
    if (state.nodes[nextPrefix]) {
      throw new Error('A project with that name already exists.');
    }

    for (const existingPath of Object.keys(state.nodes)) {
      if (existingPath === currentPrefix || existingPath.startsWith(`${currentPrefix}/`)) {
        const suffix = existingPath.slice(currentPrefix.length);
        state.nodes[`${nextPrefix}${suffix}`] = state.nodes[existingPath];
        delete state.nodes[existingPath];
      }
    }

    saveWebState(state);
    return safeName;
  }

  const projectDir = resolveNativeDirectory(projectName);
  if (!projectDir.exists) {
    throw new Error('Project no longer exists.');
  }

  const nextDir = resolveNativeDirectory(safeName);
  if (nextDir.exists) {
    throw new Error('A project with that name already exists.');
  }

  await projectDir.move(nextDir);
  return safeName;
}

export async function duplicateProject(projectName: string, nextName: string) {
  const safeName = assertValidName(nextName);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const currentPrefix = getWebProjectPrefix(projectName);
    const nextPrefix = getWebProjectPrefix(safeName);
    if (!state.nodes[currentPrefix]) {
      throw new Error('Project no longer exists.');
    }

    if (state.nodes[nextPrefix]) {
      throw new Error('A project with that name already exists.');
    }

    for (const [existingPath, value] of Object.entries(state.nodes)) {
      if (existingPath === currentPrefix || existingPath.startsWith(`${currentPrefix}/`)) {
        const suffix = existingPath.slice(currentPrefix.length);
        state.nodes[`${nextPrefix}${suffix}`] = { ...value };
      }
    }

    saveWebState(state);
    return safeName;
  }

  const sourceDir = resolveNativeDirectory(projectName);
  if (!sourceDir.exists) {
    throw new Error('Project no longer exists.');
  }

  const targetDir = resolveNativeDirectory(safeName);
  if (targetDir.exists) {
    throw new Error('A project with that name already exists.');
  }

  await sourceDir.copy(targetDir);
  return safeName;
}

export async function searchProject(projectName: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [] as WorkspaceSearchResult[];
  }

  const projects = await listProjects();
  const project = projects.find((item) => item.name === projectName);
  if (!project) {
    return [] as WorkspaceSearchResult[];
  }

  const results: WorkspaceSearchResult[] = [];
  const visit = (nodes: WorkspaceNode[]) => {
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(normalized) || node.path.toLowerCase().includes(normalized)) {
        results.push({
          path: node.path,
          name: node.name,
          type: node.type,
        });
      }

      if (node.children) {
        visit(node.children);
      }
    }
  };

  visit(project.files);
  return results;
}

export async function listProjectFolders(projectName: string) {
  const projects = await listProjects();
  const project = projects.find((item) => item.name === projectName);
  if (!project) {
    return [] as WorkspaceMoveTarget[];
  }

  const results: WorkspaceMoveTarget[] = [{ path: '', name: '(project root)', type: 'folder' }];
  const visit = (nodes: WorkspaceNode[]) => {
    for (const node of nodes) {
      if (node.type === 'folder') {
        results.push({
          path: node.path,
          name: node.name,
          type: 'folder',
        });
        if (node.children) {
          visit(node.children);
        }
      }
    }
  };

  visit(project.files);
  return results;
}

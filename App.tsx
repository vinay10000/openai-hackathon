import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AgentPermission, draftGemmaAgentPlan } from './src/services/aiClient';
import {
  WorkspaceNode,
  WorkspaceProject,
  createEntry,
  createProject,
  deleteEntry,
  deleteProject,
  ensureRootWorkspace,
  getRootWorkspacePath,
  listProjects,
  renameEntry,
  searchProject,
} from './src/services/workspace';
import { colors, radius, spacing } from './src/theme/tokens';

type AgentAction = {
  id: string;
  label: string;
  status: 'pending' | 'approved' | 'denied' | 'done';
  risk: 'low' | 'medium' | 'high';
  details: string;
};

const permissionLabels: { key: AgentPermission; label: string }[] = [
  { key: 'read', label: 'Read' },
  { key: 'edit', label: 'Edit' },
  { key: 'create', label: 'Create' },
  { key: 'delete', label: 'Delete' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'install', label: 'Install' },
  { key: 'internet', label: 'Internet' },
  { key: 'commit', label: 'Commit' },
];

function showError(message: string) {
  Alert.alert('RootForge', message);
}

function treeHasPath(nodes: WorkspaceNode[], targetPath: string): boolean {
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

function parentPathForCreation(node: WorkspaceNode | null) {
  if (!node) {
    return '';
  }

  if (node.type === 'folder') {
    return node.path;
  }

  const lastSlash = node.path.lastIndexOf('/');
  return lastSlash === -1 ? '' : node.path.slice(0, lastSlash);
}

function FileTree({
  nodes,
  selectedPath,
  onSelect,
  level = 0,
}: {
  nodes: WorkspaceNode[];
  selectedPath: string;
  onSelect: (node: WorkspaceNode) => void;
  level?: number;
}) {
  return (
    <View style={styles.treeGroup}>
      {nodes.map((node) => {
        const isSelected = node.path === selectedPath;
        return (
          <View key={node.id}>
            <Pressable
              style={[
                styles.fileRow,
                { paddingLeft: spacing.sm + level * spacing.lg },
                isSelected && styles.fileRowSelected,
              ]}
              onPress={() => onSelect(node)}
            >
              <Text style={styles.fileIcon}>{node.type === 'folder' ? '▸' : '•'}</Text>
              <Text style={styles.fileName}>{node.name}</Text>
              <Text style={styles.fileType}>{node.type}</Text>
            </Pressable>
            {node.children ? (
              <FileTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} level={level + 1} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ActionCard({
  action,
  onDecision,
}: {
  action: AgentAction;
  onDecision: (id: string, status: AgentAction['status']) => void;
}) {
  const riskStyle =
    action.risk === 'high' ? styles.riskHigh : action.risk === 'medium' ? styles.riskMedium : styles.riskLow;

  return (
    <View style={styles.actionCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.actionTitle}>{action.label}</Text>
        <Text style={[styles.risk, riskStyle]}>{action.risk}</Text>
      </View>
      <Text style={styles.muted}>{action.details}</Text>
      <View style={styles.actionButtons}>
        <Pressable style={[styles.smallButton, styles.denyButton]} onPress={() => onDecision(action.id, 'denied')}>
          <Text style={styles.denyText}>Deny</Text>
        </Pressable>
        <Pressable style={[styles.smallButton, styles.allowButton]} onPress={() => onDecision(action.id, 'approved')}>
          <Text style={styles.allowText}>Allow</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedNodePath, setSelectedNodePath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [entryName, setEntryName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [entryKind, setEntryKind] = useState<'file' | 'folder'>('file');
  const [prompt, setPrompt] = useState('Build a Firebase login screen and show the diff first.');
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [permissions, setPermissions] = useState<AgentPermission[]>(['read', 'edit', 'create']);
  const [agentPlan, setAgentPlan] = useState('No live plan yet. Ask the agent to draft one.');
  const [busyLabel, setBusyLabel] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const selectedNode = useMemo(() => {
    if (!selectedProject || !selectedNodePath) {
      return null;
    }

    const visit = (nodes: WorkspaceNode[]): WorkspaceNode | null => {
      for (const node of nodes) {
        if (node.path === selectedNodePath) {
          return node;
        }

        if (node.children) {
          const child = visit(node.children);
          if (child) {
            return child;
          }
        }
      }

      return null;
    };

    return visit(selectedProject.files);
  }, [selectedNodePath, selectedProject]);

  useEffect(() => {
    void initializeWorkspace();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      setRenameValue(selectedNode.name);
    } else {
      setRenameValue('');
    }
  }, [selectedNode]);

  async function initializeWorkspace() {
    try {
      await ensureRootWorkspace();
      await refreshProjects();
      setWorkspaceReady(true);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Failed to prepare workspace.');
    }
  }

  async function refreshProjects(nextSelectedId?: string) {
    const nextProjects = await listProjects();
    setProjects(nextProjects);

    if (!nextProjects.length) {
      setSelectedProjectId('');
      setSelectedNodePath('');
      setSearchResults([]);
      return;
    }

    const selected =
      nextProjects.find((project) => project.id === nextSelectedId) ??
      nextProjects.find((project) => project.id === selectedProjectId) ??
      nextProjects[0];
    setSelectedProjectId(selected.id);

    if (selectedNodePath && !treeHasPath(selected.files, selectedNodePath)) {
      setSelectedNodePath('');
    }
  }

  function togglePermission(permission: AgentPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  function decideAction(id: string, status: AgentAction['status']) {
    setActions((current) => current.map((action) => (action.id === id ? { ...action, status } : action)));
  }

  async function runBusyTask(label: string, task: () => Promise<void>) {
    try {
      setBusyLabel(label);
      await task();
    } catch (error) {
      showError(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusyLabel('');
    }
  }

  async function handleCreateProject() {
    await runBusyTask('Creating project', async () => {
      const nextName = projectName.trim();
      if (!nextName) {
        throw new Error('Enter a project name first.');
      }

      const createdName = await createProject(nextName);
      setProjectName('');
      await refreshProjects(createdName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
    });
  }

  async function handleCreateEntry() {
    if (!selectedProject) {
      showError('Create a project first.');
      return;
    }

    await runBusyTask(`Creating ${entryKind}`, async () => {
      const parentPath = parentPathForCreation(selectedNode);
      await createEntry(selectedProject.name, parentPath, entryName, entryKind);
      setEntryName('');
      await refreshProjects(selectedProject.id);
    });
  }

  async function handleRenameEntry() {
    if (!selectedProject || !selectedNode) {
      showError('Select a file or folder first.');
      return;
    }

    await runBusyTask('Renaming item', async () => {
      const nextPath = await renameEntry(selectedProject.name, selectedNode.path, renameValue);
      setSelectedNodePath(nextPath);
      await refreshProjects(selectedProject.id);
    });
  }

  async function handleDeleteEntry() {
    if (!selectedProject || !selectedNode) {
      showError('Select a file or folder first.');
      return;
    }

    await runBusyTask('Deleting item', async () => {
      await deleteEntry(selectedProject.name, selectedNode.path);
      setSelectedNodePath('');
      await refreshProjects(selectedProject.id);
    });
  }

  async function handleDeleteProject() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Deleting project', async () => {
      await deleteProject(selectedProject.name);
      await refreshProjects();
    });
  }

  async function handleSearch(query: string) {
    setSearchText(query);
    if (!selectedProject) {
      setSearchResults([]);
      return;
    }

    const results = await searchProject(selectedProject.name, query);
    setSearchResults(results.map((item) => `${item.type}: ${item.path}`));
  }

  async function draftPlan() {
    if (!selectedProject) {
      showError('Create a project first so the agent has a real workspace target.');
      return;
    }

    const plan = await draftGemmaAgentPlan({
      prompt,
      projectPath: selectedProject.path,
      permissions,
    });

    setAgentPlan(
      [
        plan.summary,
        `Create: ${plan.filesToCreate.join(', ') || 'none'}`,
        `Modify: ${plan.filesToModify.join(', ') || 'none'}`,
        `Delete: ${plan.filesToDelete.join(', ') || 'none'}`,
        `Run: ${plan.commands.join(', ') || 'none'}`,
      ].join('\n'),
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>RootForge</Text>
            <Text style={styles.subtitle}>AI coding workspace for your phone</Text>
          </View>
          <View style={[styles.statusPill, workspaceReady ? styles.ready : styles.waiting]}>
            <Text style={styles.statusText}>{workspaceReady ? 'Workspace ready' : 'Preparing'}</Text>
          </View>
        </View>

        <View style={styles.workspacePanel}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Root Workspace</Text>
              <Text style={styles.muted}>
                {projects.length} projects {busyLabel ? `• ${busyLabel}` : ''}
              </Text>
            </View>
            <Text style={styles.pathBadge}>real storage</Text>
          </View>
          <Text style={styles.workspacePath}>{getRootWorkspacePath()}</Text>
          {workspaceError ? <Text style={styles.errorText}>{workspaceError}</Text> : null}
          <View style={styles.inlineComposer}>
            <TextInput
              value={projectName}
              onChangeText={setProjectName}
              style={styles.search}
              placeholder="New project name"
              placeholderTextColor={colors.slate}
            />
            <Pressable style={styles.quickButtonPrimary} onPress={handleCreateProject}>
              <Text style={styles.quickButtonPrimaryText}>Create project</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.projectTabs}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              style={[styles.projectChip, selectedProjectId === project.id && styles.projectChipActive]}
              onPress={() => {
                setSelectedProjectId(project.id);
                setSelectedNodePath('');
                setSearchResults([]);
              }}
            >
              <Text style={[styles.projectChipText, selectedProjectId === project.id && styles.projectChipTextActive]}>
                {project.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedProject ? (
          <>
            <View style={styles.workspacePanel}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>{selectedProject.name}</Text>
                  <Text style={styles.muted}>
                    {selectedProject.folderCount} folders • {selectedProject.fileCount} files • updated{' '}
                    {selectedProject.updatedAt}
                  </Text>
                </View>
                <Pressable style={styles.deleteProjectButton} onPress={handleDeleteProject}>
                  <Text style={styles.deleteProjectText}>Delete project</Text>
                </Pressable>
              </View>

              <View style={styles.inlineComposer}>
                <TextInput
                  value={entryName}
                  onChangeText={setEntryName}
                  style={styles.search}
                  placeholder={selectedNode?.type === 'folder' ? `New item inside ${selectedNode.name}` : 'New file or folder'}
                  placeholderTextColor={colors.slate}
                />
                <View style={styles.segmented}>
                  <Pressable
                    style={[styles.segment, entryKind === 'file' && styles.segmentActive]}
                    onPress={() => setEntryKind('file')}
                  >
                    <Text style={[styles.segmentText, entryKind === 'file' && styles.segmentTextActive]}>File</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segment, entryKind === 'folder' && styles.segmentActive]}
                    onPress={() => setEntryKind('folder')}
                  >
                    <Text style={[styles.segmentText, entryKind === 'folder' && styles.segmentTextActive]}>Folder</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.quickButtonPrimary} onPress={handleCreateEntry}>
                  <Text style={styles.quickButtonPrimaryText}>Create</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Files</Text>
                <TextInput
                  style={styles.search}
                  value={searchText}
                  onChangeText={(value) => void handleSearch(value)}
                  placeholder="Search files"
                  placeholderTextColor={colors.slate}
                />
                {searchResults.length ? (
                  <View style={styles.resultList}>
                    {searchResults.map((result) => (
                      <Text key={result} style={styles.resultText}>
                        {result}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {selectedProject.files.length ? (
                  <FileTree
                    nodes={selectedProject.files}
                    selectedPath={selectedNodePath}
                    onSelect={(node) => setSelectedNodePath(node.path)}
                  />
                ) : (
                  <Text style={styles.emptyText}>This project is empty. Create a file or folder to start coding.</Text>
                )}
              </View>

              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Selection</Text>
                {selectedNode ? (
                  <>
                    <Text style={styles.selectionPath}>{selectedNode.path}</Text>
                    <Text style={styles.muted}>
                      {selectedNode.type === 'folder'
                        ? 'New items will be created inside this folder.'
                        : 'Rename or delete this file from the real workspace.'}
                    </Text>
                    <TextInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      style={styles.search}
                      placeholder="Rename selected item"
                      placeholderTextColor={colors.slate}
                    />
                    <View style={styles.actionButtons}>
                      <Pressable style={[styles.smallButton, styles.allowButton]} onPress={handleRenameEntry}>
                        <Text style={styles.allowText}>Rename</Text>
                      </Pressable>
                      <Pressable style={[styles.smallButton, styles.denyButton]} onPress={handleDeleteEntry}>
                        <Text style={styles.denyText}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyText}>Select a file or folder to rename it, delete it, or target new items inside it.</Text>
                )}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>No Projects Yet</Text>
            <Text style={styles.emptyText}>
              Create the first project to initialize a real app-owned workspace directory on this device.
            </Text>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Agent</Text>
          <TextInput
            multiline
            value={prompt}
            onChangeText={setPrompt}
            style={styles.prompt}
            placeholder="Ask RootForge to change the project"
            placeholderTextColor={colors.slate}
          />
          <Pressable style={styles.primaryButton} onPress={() => void draftPlan()}>
            <Text style={styles.primaryButtonText}>Draft Plan</Text>
          </Pressable>
          <Text style={styles.planText}>{agentPlan}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Agent Permissions</Text>
          <View style={styles.permissionGrid}>
            {permissionLabels.map((permission) => (
              <View key={permission.key} style={styles.permissionRow}>
                <Text style={styles.permissionLabel}>{permission.label}</Text>
                <Switch
                  value={permissions.includes(permission.key)}
                  onValueChange={() => togglePermission(permission.key)}
                  trackColor={{ false: colors.line, true: '#b7d6ff' }}
                  thumbColor={permissions.includes(permission.key) ? colors.blue : colors.paper}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Action Preview</Text>
          {actions.length ? (
            actions.map((action) => <ActionCard key={action.id} action={action} onDecision={decideAction} />)
          ) : (
            <Text style={styles.emptyText}>
              No staged agent actions yet. The preview will populate once live agent execution is wired.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Terminal</Text>
            <Text style={styles.pathBadge}>next slice</Text>
          </View>
          <View style={styles.terminal}>
            <Text style={styles.terminalText}>$ workspace ls</Text>
            <Text style={styles.terminalText}>{selectedProject ? selectedProject.path : getRootWorkspacePath()}</Text>
            <Text style={styles.terminalDim}>$ terminal bridge pending</Text>
            <Text style={styles.terminalError}>Command execution has not been wired yet.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  brand: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.slate,
    fontSize: 15,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ready: {
    backgroundColor: '#d9f5e6',
  },
  waiting: {
    backgroundColor: '#fff1cf',
  },
  statusText: {
    color: colors.graphite,
    fontWeight: '700',
    fontSize: 12,
  },
  projectTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  projectChip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
  },
  projectChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  projectChipText: {
    color: colors.graphite,
    fontWeight: '700',
  },
  projectChipTextActive: {
    color: '#fff',
  },
  workspacePanel: {
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  muted: {
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
  },
  pathBadge: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.mist,
    color: colors.graphite,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  workspacePath: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    gap: spacing.lg,
  },
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.md,
  },
  search: {
    minHeight: 44,
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  treeGroup: {
    gap: spacing.xs,
  },
  fileRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    paddingRight: spacing.sm,
  },
  fileRowSelected: {
    backgroundColor: '#dce8ff',
  },
  fileIcon: {
    color: colors.blue,
    width: 16,
    fontWeight: '900',
  },
  fileName: {
    flex: 1,
    color: colors.graphite,
    fontWeight: '700',
  },
  fileType: {
    color: colors.slate,
    fontSize: 11,
  },
  prompt: {
    minHeight: 92,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  planText: {
    color: colors.graphite,
    fontSize: 13,
    lineHeight: 19,
  },
  permissionGrid: {
    gap: spacing.sm,
  },
  permissionRow: {
    minHeight: 46,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
  },
  permissionLabel: {
    color: colors.graphite,
    fontWeight: '800',
  },
  actionCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionTitle: {
    flex: 1,
    color: colors.graphite,
    fontWeight: '800',
  },
  risk: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '900',
  },
  riskLow: {
    color: colors.green,
    backgroundColor: '#ddf8e8',
  },
  riskMedium: {
    color: colors.amber,
    backgroundColor: '#fff1cf',
  },
  riskHigh: {
    color: colors.red,
    backgroundColor: '#ffe0e5',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallButton: {
    minHeight: 40,
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyButton: {
    backgroundColor: '#ffe8eb',
  },
  allowButton: {
    backgroundColor: '#dce8ff',
  },
  denyText: {
    color: colors.red,
    fontWeight: '900',
  },
  allowText: {
    color: colors.blue,
    fontWeight: '900',
  },
  terminal: {
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    padding: spacing.md,
    gap: spacing.xs,
  },
  terminalText: {
    color: '#e9f1ff',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  terminalDim: {
    color: '#95a0b4',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  terminalError: {
    color: '#ff9cab',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  inlineComposer: {
    gap: spacing.sm,
  },
  quickButtonPrimary: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  quickButtonPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    backgroundColor: colors.mist,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#fff',
  },
  segmentText: {
    color: colors.slate,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.ink,
  },
  resultList: {
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  resultText: {
    color: colors.graphite,
    fontSize: 12,
  },
  emptyText: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 20,
  },
  selectionPath: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: colors.red,
    fontWeight: '700',
  },
  deleteProjectButton: {
    borderRadius: radius.sm,
    backgroundColor: '#ffe8eb',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteProjectText: {
    color: colors.red,
    fontWeight: '900',
  },
});

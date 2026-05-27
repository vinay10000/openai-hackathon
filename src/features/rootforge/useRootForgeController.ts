import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';

import {
  AgentPermission,
  AgentPlan,
  draftGemmaAgentPlan,
  generateGemmaExecutionPlan,
  hasBringYourOwnKey,
  saveBringYourOwnKey,
} from '../../services/aiClient';
import {
  AgentHistoryEntry,
  appendAgentHistory,
  listAgentHistory,
  observeRemoteAgentHistory,
  syncAgentHistoryEntry,
} from '../../services/agentHistory';
import {
  getFirebaseProjectLabel,
  isFirebaseConfigured,
  observeAuthState,
  resetPassword,
  signInWithGoogleNative,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  updateUserProfile,
} from '../../services/firebase';
import { AppSettings, defaultAppSettings, loadAppSettings, saveAppSettings } from '../../services/appSettings';
import { notifyAgentCompleted, requestNotificationAccess } from '../../services/notifications';
import { exportProjectArchive, exportProjectFile, importDocumentsIntoProject } from '../../services/portability';
import { observeSyncedProjects, removeProjectMetadata, syncProjectMetadata, SyncedProject } from '../../services/projectSync';
import { buildTerminalLines, runWorkspaceCommand, TerminalLine } from '../../services/terminal';
import {
  WorkspaceNode,
  WorkspaceProject,
  applyFileOperations,
  createEntry,
  createProject,
  deleteEntry,
  deleteProject,
  duplicateProject,
  ensureRootWorkspace,
  getRootWorkspacePath,
  listProjectFolders,
  listProjects,
  moveEntry,
  readFileContent,
  renameEntry,
  renameProject,
  searchProject,
  writeFileContent,
} from '../../services/workspace';
import { AgentAction, ReviewedOperation } from './types';
import {
  buildActionsFromPlan,
  buildDiffLines,
  findNodeByPath,
  flattenWorkspaceTree,
  getApprovedActionTargets,
  parentPathForCreation,
  showError,
  slugToProjectId,
  togglePermissionValue,
  treeHasPath,
} from './utils';

export function useRootForgeController() {
  const [firebaseConfigured] = useState(isFirebaseConfigured());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedNodePath, setSelectedNodePath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectRenameValue, setProjectRenameValue] = useState('');
  const [duplicateProjectValue, setDuplicateProjectValue] = useState('');
  const [entryName, setEntryName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [entryKind, setEntryKind] = useState<'file' | 'folder'>('file');
  const [editorContent, setEditorContent] = useState('');
  const [savedEditorContent, setSavedEditorContent] = useState('');
  const [loadedFilePath, setLoadedFilePath] = useState('');
  const [editorStatus, setEditorStatus] = useState('Select a file to load its real contents.');
  const [prompt, setPrompt] = useState('Build a Firebase login screen and show the diff first.');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [permissions, setPermissions] = useState<AgentPermission[]>(defaultAppSettings.defaultPermissions);
  const [agentPlan, setAgentPlan] = useState('No live plan yet. Ask the agent to draft one.');
  const [draftedPlan, setDraftedPlan] = useState<AgentPlan | null>(null);
  const [reviewedOperations, setReviewedOperations] = useState<ReviewedOperation[]>([]);
  const [agentHistory, setAgentHistory] = useState<AgentHistoryEntry[]>([]);
  const [agentHistoryStatus, setAgentHistoryStatus] = useState('Local audit history only.');
  const [busyLabel, setBusyLabel] = useState('');
  const [syncedProjects, setSyncedProjects] = useState<SyncedProject[]>([]);
  const [syncStatus, setSyncStatus] = useState('Sign in to sync project metadata.');
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [settingsStatus, setSettingsStatus] = useState('Loading app settings...');
  const [terminalCommand, setTerminalCommand] = useState('help');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      kind: 'output',
      text: 'Phone-safe terminal ready. Type help for supported real workspace commands.',
    },
  ]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const selectedNode = useMemo(() => {
    if (!selectedProject || !selectedNodePath) {
      return null;
    }

    return findNodeByPath(selectedProject.files, selectedNodePath);
  }, [selectedNodePath, selectedProject]);

  const editorHasUnsavedChanges =
    Boolean(selectedNode && selectedNode.type === 'file' && selectedNode.path === loadedFilePath) &&
    editorContent !== savedEditorContent;

  useEffect(() => {
    void initializeWorkspace();
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = observeAuthState((user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user?.displayName) {
        setDisplayName(user.displayName);
      }
    });

    return unsubscribe;
  }, [firebaseConfigured]);

  useEffect(() => {
    if (selectedNode) {
      setRenameValue(selectedNode.name);
    } else {
      setRenameValue('');
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedProject) {
      setAvailableFolders([]);
      return;
    }

    void loadProjectFolders(selectedProject.name);
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      setProjectRenameValue(selectedProject.name);
      setDuplicateProjectValue(`${selectedProject.name}-copy`);
    } else {
      setProjectRenameValue('');
      setDuplicateProjectValue('');
    }
  }, [selectedProject]);

  useEffect(() => {
    setReviewedOperations([]);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProject || !selectedNode || selectedNode.type !== 'file') {
      setLoadedFilePath('');
      setEditorContent('');
      setSavedEditorContent('');
      setEditorStatus(
        selectedNode?.type === 'folder'
          ? 'Folders can be moved or renamed. Select a file to edit its contents.'
          : 'Select a file to load its real contents.',
      );
      return;
    }

    void loadSelectedFile(selectedProject.name, selectedNode.path);
  }, [selectedNode, selectedProject]);

  useEffect(() => {
    void loadByokState();
  }, []);

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    void loadAgentHistory();
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !authUser) {
      setAgentHistoryStatus(firebaseConfigured ? 'Sign in to sync agent audit history.' : 'Configure Firebase to sync agent audit history.');
      return;
    }

    setAgentHistoryStatus('Listening for synced agent runs...');
    const unsubscribe = observeRemoteAgentHistory(
      (entries) => {
        setAgentHistory(entries);
        setAgentHistoryStatus(entries.length ? 'Synced with Firestore.' : 'Connected to Firestore. No synced agent runs yet.');
      },
      (error) => {
        setAgentHistoryStatus(error.message);
      },
    );

    return unsubscribe;
  }, [authUser, firebaseConfigured]);

  useEffect(() => {
    if (!firebaseConfigured || !authUser) {
      setSyncedProjects([]);
      setSyncStatus(firebaseConfigured ? 'Sign in to sync project metadata.' : 'Configure Firebase to enable sync.');
      return;
    }

    setSyncStatus('Listening for synced projects...');
    const unsubscribe = observeSyncedProjects(
      (items) => {
        setSyncedProjects(items);
        setSyncStatus(items.length ? 'Synced with Firestore.' : 'Connected to Firestore. No synced projects yet.');
      },
      (error) => {
        setSyncStatus(error.message);
      },
    );

    return unsubscribe;
  }, [authUser, firebaseConfigured]);

  useEffect(() => {
    if (!firebaseConfigured || !authUser || !projects.length) {
      return;
    }

    void syncProjectCatalog(projects);
  }, [authUser, firebaseConfigured, projects]);

  useEffect(() => {
    if (!appSettings.autoSave) {
      return;
    }

    if (
      !selectedProject ||
      !selectedNode ||
      selectedNode.type !== 'file' ||
      selectedNode.path !== loadedFilePath ||
      editorContent === savedEditorContent
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      void saveSelectedFileContent('Auto-saved to the real workspace.');
    }, appSettings.autoSaveIntervalSeconds * 1000);

    return () => clearTimeout(timeout);
  }, [
    appSettings.autoSave,
    appSettings.autoSaveIntervalSeconds,
    editorContent,
    loadedFilePath,
    savedEditorContent,
    selectedNode,
    selectedProject,
  ]);

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

  async function loadByokState() {
    try {
      setHasApiKey(await hasBringYourOwnKey());
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to read BYOK state.');
    }
  }

  async function loadSettings() {
    try {
      const settings = await loadAppSettings();
      setAppSettings(settings);
      setPermissions(settings.defaultPermissions);
      setSettingsStatus('App settings loaded.');
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : 'Failed to load app settings.');
    }
  }

  async function loadAgentHistory() {
    try {
      setAgentHistory(await listAgentHistory());
      setAgentHistoryStatus('Local audit history loaded.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to read agent history.');
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

  async function loadProjectFolders(projectNameValue: string) {
    try {
      const folders = await listProjectFolders(projectNameValue);
      setAvailableFolders(folders.map((item) => item.path));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load destination folders.');
    }
  }

  async function loadSelectedFile(projectNameValue: string, path: string) {
    try {
      setEditorStatus('Loading file from workspace...');
      const content = await readFileContent(projectNameValue, path);
      setLoadedFilePath(path);
      setEditorContent(content);
      setSavedEditorContent(content);
      setEditorStatus('Loaded from the real workspace.');
    } catch (error) {
      setLoadedFilePath('');
      setEditorContent('');
      setSavedEditorContent('');
      setEditorStatus(error instanceof Error ? error.message : 'Failed to load file.');
    }
  }

  async function syncProjectCatalog(projectList: WorkspaceProject[]) {
    if (!firebaseConfigured || !authUser) {
      return;
    }

    try {
      for (const project of projectList) {
        await syncProjectMetadata(project);
      }

      setSyncStatus(projectList.length ? 'Synced with Firestore.' : 'Connected to Firestore. No synced projects yet.');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Project sync failed.');
    }
  }

  async function updateAppSettings(nextSettings: AppSettings, message: string) {
    const savedSettings = await saveAppSettings(nextSettings);
    setAppSettings(savedSettings);
    setSettingsStatus(message);
    return savedSettings;
  }

  async function updateNotificationPreference(enabled: boolean) {
    const allowed = enabled ? await requestNotificationAccess() : true;
    if (enabled && !allowed) {
      throw new Error('Notification permission was not granted.');
    }

    await updateAppSettings(
      {
        ...appSettings,
        notificationsEnabled: enabled && allowed,
      },
      enabled && allowed ? 'Agent completion notifications enabled.' : 'Agent completion notifications disabled.',
    );
  }

  function togglePermission(permission: AgentPermission) {
    setPermissions((current) => togglePermissionValue(current, permission));
  }

  function decideAction(id: string, status: AgentAction['status']) {
    setActions((current) => current.map((action) => (action.id === id ? { ...action, status } : action)));
  }

  function decideReviewedOperation(id: string, accepted: boolean) {
    setReviewedOperations((current) =>
      current.map((operation) => (operation.id === id ? { ...operation, accepted } : operation)),
    );
  }

  function setAllReviewedOperations(accepted: boolean) {
    setReviewedOperations((current) => current.map((operation) => ({ ...operation, accepted })));
  }

  function handleEditorChange(value: string) {
    setEditorContent(value);
    setEditorStatus(value === savedEditorContent ? 'Loaded from the real workspace.' : 'Edited locally. Save to write the real file.');
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
      await refreshProjects(slugToProjectId(createdName));
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

  async function handleMoveEntry() {
    if (!selectedProject || !selectedNode) {
      showError('Select a file or folder first.');
      return;
    }

    await runBusyTask('Moving item', async () => {
      const nextPath = await moveEntry(selectedProject.name, selectedNode.path, moveDestination);
      setSelectedNodePath(nextPath);
      await refreshProjects(selectedProject.id);
      setMoveDestination('');
    });
  }

  async function handleDeleteProject() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Deleting project', async () => {
      await removeProjectMetadata(selectedProject.id).catch(() => undefined);
      await deleteProject(selectedProject.name);
      await refreshProjects();
    });
  }

  async function handleRenameProject() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Renaming project', async () => {
      const previousId = selectedProject.id;
      const nextName = await renameProject(selectedProject.name, projectRenameValue);
      await removeProjectMetadata(previousId).catch(() => undefined);
      await refreshProjects(slugToProjectId(nextName));
    });
  }

  async function handleDuplicateProject() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Duplicating project', async () => {
      const nextName = await duplicateProject(selectedProject.name, duplicateProjectValue);
      await refreshProjects(slugToProjectId(nextName));
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

  async function handleSaveFile() {
    await saveSelectedFileContent('Saved to the real workspace.');
  }

  async function saveSelectedFileContent(successMessage: string) {
    if (!selectedProject || !selectedNode || selectedNode.type !== 'file') {
      showError('Select a file first.');
      return;
    }

    await runBusyTask('Saving file', async () => {
      await writeFileContent(selectedProject.name, selectedNode.path, editorContent);
      setLoadedFilePath(selectedNode.path);
      setSavedEditorContent(editorContent);
      setEditorStatus(successMessage);
      await refreshProjects(selectedProject.id);
    });
  }

  async function handleImportFiles() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Importing files', async () => {
      const destinationFolderPath = selectedNode?.type === 'folder' ? selectedNode.path : '';
      const imported = await importDocumentsIntoProject(selectedProject.name, destinationFolderPath);
      if (!imported.length) {
        return;
      }

      await refreshProjects(selectedProject.id);
      setSelectedNodePath(imported[0].path);
      setEditorStatus(`Imported ${imported.length} real file${imported.length === 1 ? '' : 's'} into the workspace.`);
    });
  }

  async function handleExportSelectedFile() {
    if (!selectedProject || !selectedNode || selectedNode.type !== 'file') {
      showError('Select a file first.');
      return;
    }

    await runBusyTask('Exporting file', async () => {
      await exportProjectFile(selectedProject.name, selectedNode.path);
      setEditorStatus(
        getRootWorkspacePath().startsWith('localStorage://')
          ? 'Downloaded the selected workspace file.'
          : 'Opened the native share sheet for the selected workspace file.',
      );
    });
  }

  async function handleExportProjectArchive() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    await runBusyTask('Exporting project archive', async () => {
      await exportProjectArchive(selectedProject.name);
      setEditorStatus(
        getRootWorkspacePath().startsWith('localStorage://')
          ? 'Downloaded the selected project as a ZIP archive.'
          : 'Opened the native share sheet for the selected project ZIP archive.',
      );
    });
  }

  async function draftPlan() {
    if (!selectedProject) {
      showError('Create a project first so the agent has a real workspace target.');
      return;
    }

    const plan = await draftGemmaAgentPlan({
      prompt,
      projectName: selectedProject.name,
      projectPath: selectedProject.path,
      workspaceTree: flattenWorkspaceTree(selectedProject.files),
      permissions,
    });

    setDraftedPlan(plan);
    setActions(buildActionsFromPlan(plan));
    setReviewedOperations([]);
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

  async function handleApplyApprovedActions() {
    if (!selectedProject) {
      showError('Select a project first.');
      return;
    }

    if (!draftedPlan) {
      showError('Draft a live plan first.');
      return;
    }

    await runBusyTask('Applying approved actions', async () => {
      if (!reviewedOperations.length) {
        const { approvedCreates, approvedModifies, approvedDeletes, approvedCommands } = getApprovedActionTargets(actions);
        if (!approvedCreates.length && !approvedModifies.length && !approvedDeletes.length && !approvedCommands.length) {
          throw new Error('Approve at least one action first.');
        }

        if (approvedCommands.length && !permissions.includes('terminal')) {
          throw new Error('Terminal permission is disabled. Enable it before approving command actions.');
        }

        if (approvedCommands.length) {
          const commandResults = [];
          for (const command of approvedCommands) {
            const commandResult = await runWorkspaceCommand(selectedProject.name, command);
            commandResults.push(commandResult);
            setTerminalLines((current) => buildTerminalLines(current, commandResult));
            if (commandResult.errors.length) {
              throw new Error(commandResult.errors.join('\n'));
            }
          }

          if (!approvedCreates.length && !approvedModifies.length && !approvedDeletes.length) {
            const historyEntry: AgentHistoryEntry = {
              id: `${Date.now()}`,
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              prompt,
              planSummary: draftedPlan.summary,
              executionSummary: `Ran ${commandResults.length} approved workspace command(s).`,
              createdAt: new Date().toLocaleString(),
              createdAtMs: Date.now(),
              approvedActions: actions.filter((action) => action.status === 'approved').map((action) => action.id),
              deniedActions: actions.filter((action) => action.status === 'denied').map((action) => action.id),
              reviewedAccepted: [],
              reviewedRejected: [],
              approvedCommands,
              appliedOperations: commandResults.map((item) => `command:${item.command}`),
            };

            const nextHistory = await appendAgentHistory(historyEntry);
            if (!firebaseConfigured || !authUser) {
              setAgentHistory(nextHistory);
            }

            if (firebaseConfigured && authUser) {
              await syncAgentHistoryEntry(historyEntry);
            }

            setActions((current) =>
              current.map((action) =>
                action.status === 'approved' && action.id.startsWith('command:')
                  ? { ...action, status: 'done', details: 'Ran in the phone-safe workspace terminal.' }
                  : action,
              ),
            );
            setAgentPlan(`Ran approved workspace commands:\n${approvedCommands.join('\n')}`);
            await refreshProjects(selectedProject.id);
            return;
          }
        }

        const fileContext = await Promise.all(
          approvedModifies.map(async (path) => ({
            path,
            content: await readFileContent(selectedProject.name, path),
          })),
        );

        const executionPlan = await generateGemmaExecutionPlan({
          prompt,
          projectName: selectedProject.name,
          projectPath: selectedProject.path,
          workspaceTree: flattenWorkspaceTree(selectedProject.files),
          permissions,
          approvedCreates,
          approvedModifies,
          approvedDeletes,
          fileContext,
        });

        const approvedWriteTargets = new Set([...approvedCreates, ...approvedModifies]);
        const approvedDeleteTargets = new Set(approvedDeletes);
        const operations = executionPlan.operations.filter((operation) =>
          operation.type === 'write_file' ? approvedWriteTargets.has(operation.path) : approvedDeleteTargets.has(operation.path),
        );

        if (!operations.length) {
          throw new Error('Gemma did not return any executable operations for the approved paths.');
        }

        const reviewed = await Promise.all(
          operations.map(async (operation) => {
            const existingNode = findNodeByPath(selectedProject.files, operation.path);
            const beforeContent =
              existingNode?.type === 'file'
                ? await readFileContent(selectedProject.name, operation.path)
                : existingNode?.type === 'folder'
                  ? `[folder] ${operation.path}`
                  : '';

            const afterContent = operation.type === 'write_file' ? operation.content ?? '' : '';
            return {
              id: `${operation.type}:${operation.path}`,
              path: operation.path,
              type: operation.type,
              rationale: operation.rationale,
              beforeContent,
              afterContent,
              accepted: true,
              diffLines: buildDiffLines(beforeContent, afterContent),
            } satisfies ReviewedOperation;
          }),
        );

        setReviewedOperations(reviewed);
        setAgentPlan(
          [
            executionPlan.summary,
            `Review required: ${reviewed.map((operation) => `${operation.type} ${operation.path}`).join(', ')}`,
          ].join('\n'),
        );
        return;
      }

      const acceptedOperations = reviewedOperations.filter((operation) => operation.accepted);
      if (!acceptedOperations.length) {
        throw new Error('Accept at least one reviewed file before applying.');
      }

      await applyFileOperations(
        selectedProject.name,
        acceptedOperations.map((operation) => ({
          type: operation.type,
          path: operation.path,
          content: operation.type === 'write_file' ? operation.afterContent : undefined,
        })),
      );

      const appliedPaths = new Set(acceptedOperations.map((operation) => operation.path));
      setActions((current) =>
        current.map((action) => {
          const path = action.id.includes(':') ? action.id.slice(action.id.indexOf(':') + 1) : '';
          if (appliedPaths.has(path) && action.status === 'approved' && !action.id.startsWith('command:')) {
            return { ...action, status: 'done', details: 'Applied to the real workspace after diff review.' };
          }

          return action;
        }),
      );
      setReviewedOperations([]);
      setAgentPlan(
        [
          'Reviewed changes applied.',
          `Applied operations: ${acceptedOperations.map((operation) => `${operation.type} ${operation.path}`).join(', ')}`,
        ].join('\n'),
      );

      const historyEntry: AgentHistoryEntry = {
        id: `${Date.now()}`,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        prompt,
        planSummary: draftedPlan.summary,
        executionSummary: `Reviewed apply for ${acceptedOperations.length} operation(s).`,
        createdAt: new Date().toLocaleString(),
        createdAtMs: Date.now(),
        approvedActions: actions.filter((action) => action.status === 'approved' && !action.id.startsWith('command:')).map((action) => action.id),
        deniedActions: actions.filter((action) => action.status === 'denied').map((action) => action.id),
        reviewedAccepted: acceptedOperations.map((operation) => operation.path),
        reviewedRejected: reviewedOperations.filter((operation) => !operation.accepted).map((operation) => operation.path),
        approvedCommands: actions
          .filter((action) => action.status === 'approved' && action.id.startsWith('command:'))
          .map((action) => action.id.slice('command:'.length)),
        appliedOperations: acceptedOperations.map((operation) => `${operation.type}:${operation.path}`),
      };

      const nextHistory = await appendAgentHistory(historyEntry);
      if (!firebaseConfigured || !authUser) {
        setAgentHistory(nextHistory);
      }

      if (firebaseConfigured && authUser) {
        await syncAgentHistoryEntry(historyEntry);
      }

      if (appSettings.notificationsEnabled) {
        await notifyAgentCompleted(selectedProject.name, `Applied ${acceptedOperations.length} reviewed change(s).`);
      }

      await refreshProjects(selectedProject.id);
    });
  }

  async function handleSaveApiKey() {
    await runBusyTask('Saving API key', async () => {
      if (!apiKey.trim()) {
        throw new Error('Enter the Gemma API key first.');
      }

      await saveBringYourOwnKey(apiKey);
      setApiKey('');
      setHasApiKey(true);
    });
  }

  async function handleSignIn() {
    await runBusyTask('Signing in', async () => {
      await signInWithEmail(email, password);
      setPassword('');
    });
  }

  async function handleGoogleSignIn() {
    await runBusyTask('Signing in with Google', async () => {
      await signInWithGoogleNative();
    });
  }

  async function handleSignUp() {
    await runBusyTask('Creating account', async () => {
      await signUpWithEmail(email, password, displayName);
      setPassword('');
    });
  }

  async function handleResetPassword() {
    await runBusyTask('Sending reset email', async () => {
      if (!email.trim()) {
        throw new Error('Enter your email first.');
      }

      await resetPassword(email);
      showError('Password reset email sent.');
    });
  }

  async function handleSaveProfile() {
    await runBusyTask('Saving profile', async () => {
      await updateUserProfile(displayName);
    });
  }

  async function handleSignOut() {
    await runBusyTask('Signing out', async () => {
      await signOutCurrentUser();
    });
  }

  async function handleRunTerminalCommand(commandOverride?: string) {
    if (!selectedProject) {
      showError('Select a project before running terminal commands.');
      return;
    }

    const command = (commandOverride ?? terminalCommand).trim();
    if (!command) {
      return;
    }

    await runBusyTask('Running terminal command', async () => {
      const result = await runWorkspaceCommand(selectedProject.name, command);
      setTerminalLines((current) => buildTerminalLines(current, result));
      setTerminalCommand('');
      if (result.changed) {
        await refreshProjects(selectedProject.id);
      }
    });
  }

  return {
    authMode,
    actions,
    agentHistory,
    agentHistoryStatus,
    agentPlan,
    apiKey,
    appSettings,
    authReady,
    authUser,
    availableFolders,
    busyLabel,
    defaultTerminalShell: defaultAppSettings.terminalShell,
    decideAction,
    decideReviewedOperation,
    displayName,
    draftPlan,
    draftedPlan,
    duplicateProjectValue,
    editorContent,
    editorHasUnsavedChanges,
    editorStatus,
    email,
    entryKind,
    entryName,
    firebaseConfigured,
    getFirebaseProjectLabel,
    getRootWorkspacePath,
    handleApplyApprovedActions,
    handleCreateEntry,
    handleCreateProject,
    handleDeleteEntry,
    handleDeleteProject,
    handleDuplicateProject,
    handleEditorChange,
    handleExportProjectArchive,
    handleExportSelectedFile,
    handleGoogleSignIn,
    handleImportFiles,
    handleMoveEntry,
    handleRenameEntry,
    handleRenameProject,
    handleResetPassword,
    handleRunTerminalCommand,
    handleSaveApiKey,
    handleSaveFile,
    handleSaveProfile,
    handleSearch,
    handleSignIn,
    handleSignOut,
    handleSignUp,
    hasApiKey,
    loadedFilePath,
    password,
    permissions,
    projectName,
    projectRenameValue,
    projects,
    prompt,
    renameValue,
    reviewedOperations,
    searchResults,
    searchText,
    selectedNode,
    selectedNodePath,
    selectedProject,
    selectedProjectId,
    setAllReviewedOperations,
    setApiKey,
    setAppSettings,
    setAuthMode,
    setDisplayName,
    setDuplicateProjectValue,
    setEditorContent,
    setEditorStatus,
    setEmail,
    setEntryKind,
    setEntryName,
    setMoveDestination,
    setPassword,
    setPermissions,
    setProjectName,
    setProjectRenameValue,
    setPrompt,
    setRenameValue,
    setSearchResults,
    setSelectedNodePath,
    setSelectedProjectId,
    setTerminalCommand,
    settingsStatus,
    syncedProjects,
    syncStatus,
    terminalCommand,
    terminalLines,
    togglePermission,
    updateAppSettings,
    updateNotificationPreference,
    workspaceError,
    workspaceReady,
    moveDestination,
  };
}

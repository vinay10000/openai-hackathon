import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ActionCard } from '../components/rootforge/ActionCard';
import { DiffReviewCard } from '../components/rootforge/DiffReviewCard';
import { FileTree } from '../components/rootforge/FileTree';
import { useRootForgeController } from '../features/rootforge/useRootForgeController';
import { permissionLabels } from '../features/rootforge/types';
import { defaultAppSettings, type AppSettings } from '../services/appSettings';
import { makeRootForgeStyles, rootForgeThemes, type RootForgeStyles, type RootForgeTheme } from '../styles/rootForgeStyles';

type RootForgeTab = 'workspace' | 'files' | 'agent' | 'terminal' | 'settings';
type SettingsRoute =
  | 'settings'
  | 'profile'
  | 'notifications'
  | 'permissions'
  | 'git'
  | 'runtimes'
  | 'sync'
  | 'audit';

const rootForgeTabs: Array<{ key: RootForgeTab; label: string; icon: string }> = [
  { key: 'workspace', label: 'Workspace', icon: '⌂' },
  { key: 'files', label: 'Files', icon: '▣' },
  { key: 'agent', label: 'Agent', icon: '✦' },
  { key: 'terminal', label: 'Terminal', icon: '>_' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

type Controller = ReturnType<typeof useRootForgeController>;

export function RootForgeScreen() {
  const controller = useRootForgeController();
  const colorScheme = useColorScheme();
  const [activeTab, setActiveTab] = useState<RootForgeTab>('workspace');
  const [settingsRoute, setSettingsRoute] = useState<SettingsRoute>('settings');

  const themeMode = controller.appSettings.themeMode;
  const resolvedMode = themeMode === 'system' ? colorScheme ?? 'light' : themeMode;
  const palette = resolvedMode === 'dark' ? rootForgeThemes.dark : rootForgeThemes.light;
  const themedPalette = controller.appSettings.highContrast
    ? {
        ...palette,
        line: resolvedMode === 'dark' ? '#4e6686' : '#8b98aa',
        slate: resolvedMode === 'dark' ? '#d4deed' : '#344054',
      }
    : palette;
  const styles = useMemo(() => makeRootForgeStyles(themedPalette), [themedPalette]);

  function openSettings(route: SettingsRoute) {
    setSettingsRoute(route);
    setActiveTab('settings');
  }

  const title =
    activeTab === 'settings' && settingsRoute !== 'settings'
      ? routeTitle(settingsRoute)
      : rootForgeTabs.find((tab) => tab.key === activeTab)?.label ?? 'RootForge';

  return (
    <SafeAreaView style={styles.phoneShell}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.appBar}>
        {activeTab === 'settings' && settingsRoute !== 'settings' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            style={styles.iconButton}
            onPress={() => setSettingsRoute('settings')}
          >
            <Text style={styles.iconButtonText}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.cubeMarkSmall}>
            <Text style={styles.cubeMarkText}>◇</Text>
          </View>
        )}
        <View style={styles.appBarCopy}>
          <Text style={styles.appBarTitle}>{title}</Text>
          <Text style={styles.appBarSubtitle}>
            {activeTab === 'workspace'
              ? 'Root workspace, projects, and sync'
              : activeTab === 'files'
                ? 'Real files and editor'
                : activeTab === 'agent'
                  ? 'BYOK agent, preview, and diff review'
                  : activeTab === 'terminal'
                    ? 'Phone-safe workspace terminal'
                    : 'Real app controls'}
          </Text>
        </View>
        <View style={[styles.statusPill, controller.workspaceReady ? styles.ready : styles.waiting]}>
          <Text style={styles.statusText}>{controller.workspaceReady ? 'Ready' : 'Preparing'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.screenContent}>
        {activeTab === 'workspace' ? (
          <WorkspaceScreen
            controller={controller}
            styles={styles}
            palette={themedPalette}
            openSettings={openSettings}
            openTab={setActiveTab}
          />
        ) : null}
        {activeTab === 'files' ? <FilesScreen controller={controller} styles={styles} palette={themedPalette} /> : null}
        {activeTab === 'agent' ? (
          <AgentScreen controller={controller} styles={styles} palette={themedPalette} openSettings={openSettings} />
        ) : null}
        {activeTab === 'terminal' ? <TerminalScreen controller={controller} styles={styles} palette={themedPalette} /> : null}
        {activeTab === 'settings' ? (
          <SettingsScreen
            route={settingsRoute}
            setRoute={setSettingsRoute}
            controller={controller}
            styles={styles}
            palette={themedPalette}
          />
        ) : null}
      </ScrollView>

      <View style={styles.bottomNav}>
        {rootForgeTabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => {
                setActiveTab(tab.key);
                if (tab.key !== 'settings') {
                  setSettingsRoute('settings');
                }
              }}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function WorkspaceScreen({
  controller,
  styles,
  palette,
  openSettings,
  openTab,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
  openSettings: (route: SettingsRoute) => void;
  openTab: (tab: RootForgeTab) => void;
}) {
  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>Root workspace</Text>
            <Text style={styles.heroPath}>{controller.getRootWorkspacePath()}</Text>
          </View>
          <Text style={styles.pathBadge}>sandboxed</Text>
        </View>
        <Text style={styles.muted}>
          {controller.projects.length} project{controller.projects.length === 1 ? '' : 's'}
          {controller.busyLabel ? ` • ${controller.busyLabel}` : ''}
        </Text>
        {controller.workspaceError ? <Text style={styles.errorText}>{controller.workspaceError}</Text> : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.inlineComposer}>
          <TextInput
            value={controller.projectName}
            onChangeText={controller.setProjectName}
            style={styles.search}
            placeholder="New project name"
            placeholderTextColor={palette.slate}
          />
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={controller.handleCreateProject}>
            <Text style={styles.primaryButtonText}>Create project</Text>
          </Pressable>
        </View>
        <View style={styles.quickActions}>
          <QuickTile icon="▣" label="Open Files" onPress={() => openTab('files')} styles={styles} />
          <QuickTile icon="⧉" label="Duplicate" onPress={controller.handleDuplicateProject} styles={styles} />
          <QuickTile icon="⇩" label="Import Files" onPress={controller.handleImportFiles} styles={styles} />
          <QuickTile icon="⇪" label="Export ZIP" onPress={controller.handleExportProjectArchive} styles={styles} />
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Projects</Text>
          <Text style={styles.pathBadge}>{controller.syncStatus.includes('Synced') ? 'synced' : 'local-first'}</Text>
        </View>
        {controller.projects.length ? (
          controller.projects.map((project) => (
            <Pressable
              accessibilityRole="button"
              key={project.id}
              style={[styles.listRow, controller.selectedProjectId === project.id && styles.listRowActive]}
              onPress={() => {
                controller.setSelectedProjectId(project.id);
                controller.setSelectedNodePath('');
                controller.setSearchResults([]);
              }}
            >
              <Text style={styles.listIcon}>▣</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{project.name}</Text>
                <Text style={styles.muted}>
                  {project.fileCount} files • {project.folderCount} folders • {project.updatedAt}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>Create a project to initialize the real app-owned workspace.</Text>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Sync & notifications</Text>
          <Pressable accessibilityRole="button" onPress={() => openSettings('sync')}>
            <Text style={styles.linkText}>Details</Text>
          </Pressable>
        </View>
        <StatusRow title="Project metadata" detail={controller.syncStatus} status={controller.authUser ? 'Live' : 'Sign in'} styles={styles} />
        <StatusRow
          title="Agent audit history"
          detail={controller.agentHistoryStatus}
          status={controller.firebaseConfigured && controller.authUser ? 'Firestore' : 'Local'}
          styles={styles}
        />
      </View>
    </>
  );
}

function FilesScreen({
  controller,
  styles,
  palette,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
}) {
  return (
    <>
      <ProjectSelector controller={controller} styles={styles} />
      {controller.selectedProject ? (
        <>
          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>{controller.selectedProject.name}</Text>
                <Text style={styles.muted}>
                  {controller.selectedProject.fileCount} files • {controller.selectedProject.folderCount} folders
                </Text>
              </View>
              <Pressable accessibilityRole="button" style={styles.deleteProjectButton} onPress={controller.handleDeleteProject}>
                <Text style={styles.deleteProjectText}>Delete</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              value={controller.searchText}
              onChangeText={(value) => void controller.handleSearch(value)}
              placeholder="Search files and folders"
              placeholderTextColor={palette.slate}
            />
            {controller.searchResults.length ? (
              <View style={styles.resultList}>
                {controller.searchResults.map((result) => (
                  <Text key={result} style={styles.resultText}>
                    {result}
                  </Text>
                ))}
              </View>
            ) : null}
            {controller.selectedProject.files.length ? (
              <FileTree
                nodes={controller.selectedProject.files}
                selectedPath={controller.selectedNodePath}
                onSelect={(node) => controller.setSelectedNodePath(node.path)}
                styles={styles}
              />
            ) : (
              <Text style={styles.emptyText}>This project is empty. Create a file or folder to start coding.</Text>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Create / organize</Text>
            <TextInput
              value={controller.entryName}
              onChangeText={controller.setEntryName}
              style={styles.search}
              placeholder={controller.selectedNode?.type === 'folder' ? `New item inside ${controller.selectedNode.name}` : 'New file or folder'}
              placeholderTextColor={palette.slate}
            />
            <SegmentedControl
              value={controller.entryKind}
              options={[
                { label: 'File', value: 'file' },
                { label: 'Folder', value: 'folder' },
              ]}
              onChange={(value) => controller.setEntryKind(value as 'file' | 'folder')}
              styles={styles}
            />
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={controller.handleCreateEntry}>
              <Text style={styles.primaryButtonText}>Create in workspace</Text>
            </Pressable>
          </View>

          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Selection</Text>
              <Text style={styles.pathBadge}>{controller.editorHasUnsavedChanges ? 'unsaved' : 'saved'}</Text>
            </View>
            {controller.selectedNode ? (
              <>
                <Text style={styles.selectionPath}>{controller.selectedNode.path}</Text>
                <TextInput
                  value={controller.renameValue}
                  onChangeText={controller.setRenameValue}
                  style={styles.search}
                  placeholder="Rename selected item"
                  placeholderTextColor={palette.slate}
                />
                <View style={styles.actionButtons}>
                  <Pressable accessibilityRole="button" style={[styles.smallButton, styles.allowButton]} onPress={controller.handleRenameEntry}>
                    <Text style={styles.allowText}>Rename</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={[styles.smallButton, styles.denyButton]} onPress={controller.handleDeleteEntry}>
                    <Text style={styles.denyText}>Delete</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={controller.moveDestination}
                  onChangeText={controller.setMoveDestination}
                  style={styles.search}
                  placeholder="Move to folder path, blank for root"
                  placeholderTextColor={palette.slate}
                  autoCapitalize="none"
                />
                <Pressable accessibilityRole="button" style={[styles.smallButton, styles.quickButtonGhost]} onPress={controller.handleMoveEntry}>
                  <Text style={styles.quickButtonGhostText}>Move selected item</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>Select a real file or folder to manage it.</Text>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Editor</Text>
            <Text style={styles.muted}>{controller.editorStatus}</Text>
            {controller.selectedNode?.type === 'file' ? (
              <>
                <TextInput
                  multiline
                  value={controller.editorContent}
                  onChangeText={controller.handleEditorChange}
                  style={styles.editor}
                  placeholder="File contents"
                  placeholderTextColor={palette.slate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlignVertical="top"
                />
                <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={controller.handleSaveFile}>
                  <Text style={styles.primaryButtonText}>Save file</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>Select a file to read and edit its real contents.</Text>
            )}
          </View>
        </>
      ) : (
        <EmptyProject styles={styles} />
      )}
    </>
  );
}

function AgentScreen({
  controller,
  styles,
  palette,
  openSettings,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
  openSettings: (route: SettingsRoute) => void;
}) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Agent chat</Text>
          <Text style={styles.pathBadge}>{controller.hasApiKey ? 'BYOK active' : 'BYOK needed'}</Text>
        </View>
        <TextInput
          value={controller.apiKey}
          onChangeText={controller.setApiKey}
          style={styles.search}
          placeholder="Paste Gemma API key"
          placeholderTextColor={palette.slate}
          secureTextEntry
          autoCapitalize="none"
        />
        <Pressable accessibilityRole="button" style={styles.quickButtonPrimary} onPress={controller.handleSaveApiKey}>
          <Text style={styles.quickButtonPrimaryText}>Save BYOK key</Text>
        </Pressable>
        <TextInput
          multiline
          value={controller.prompt}
          onChangeText={controller.setPrompt}
          style={styles.prompt}
          placeholder="Ask RootForge to change the selected project"
          placeholderTextColor={palette.slate}
        />
        <View style={styles.actionButtons}>
          <Pressable accessibilityRole="button" style={[styles.smallButton, styles.allowButton]} onPress={() => void controller.draftPlan()}>
            <Text style={styles.allowText}>Draft plan</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.smallButton, styles.quickButtonGhost]}
            onPress={() => void controller.handleApplyApprovedActions()}
          >
            <Text style={styles.quickButtonGhostText}>
              {controller.reviewedOperations.length ? 'Apply accepted' : 'Generate diff'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.planText}>{controller.agentPlan}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <Pressable accessibilityRole="button" onPress={() => openSettings('permissions')}>
            <Text style={styles.linkText}>Manage</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{controller.permissions.join(', ') || 'No permissions granted'}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Action preview</Text>
          <Text style={styles.pathBadge}>{controller.actions.filter((action) => action.status === 'approved').length} approved</Text>
        </View>
        {controller.actions.length ? (
          controller.actions.map((action) => (
            <ActionCard key={action.id} action={action} onDecision={controller.decideAction} styles={styles} />
          ))
        ) : (
          <Text style={styles.emptyText}>Draft a live Gemma plan to populate real actions.</Text>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Diff viewer</Text>
          <Text style={styles.pathBadge}>
            {controller.reviewedOperations.filter((operation) => operation.accepted).length} accepted
          </Text>
        </View>
        {controller.reviewedOperations.length ? (
          <>
            <View style={styles.actionButtons}>
              <Pressable accessibilityRole="button" style={[styles.smallButton, styles.denyButton]} onPress={() => controller.setAllReviewedOperations(false)}>
                <Text style={styles.denyText}>Reject all</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={[styles.smallButton, styles.allowButton]} onPress={() => controller.setAllReviewedOperations(true)}>
                <Text style={styles.allowText}>Accept all</Text>
              </Pressable>
            </View>
            {controller.reviewedOperations.map((operation) => (
              <DiffReviewCard
                key={operation.id}
                operation={operation}
                onDecision={controller.decideReviewedOperation}
                styles={styles}
              />
            ))}
          </>
        ) : (
          <Text style={styles.emptyText}>Approved file actions will show real before/after content here before writes.</Text>
        )}
      </View>
    </>
  );
}

function TerminalScreen({
  controller,
  styles,
  palette,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
}) {
  return (
    <>
      <ProjectSelector controller={controller} styles={styles} />
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Terminal</Text>
          <Text style={styles.pathBadge}>real workspace</Text>
        </View>
        <Text style={styles.muted}>
          Runs safe workspace commands only. Runtime/package commands are blocked until a real execution backend exists.
        </Text>
        <View style={styles.inlineComposer}>
          <TextInput
            value={controller.terminalCommand}
            onChangeText={controller.setTerminalCommand}
            style={styles.search}
            placeholder="help, ls, cat README.md, mkdir src, touch src/App.tsx"
            placeholderTextColor={palette.slate}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void controller.handleRunTerminalCommand()}
          />
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void controller.handleRunTerminalCommand()}>
            <Text style={styles.primaryButtonText}>Run command</Text>
          </Pressable>
        </View>
        <View style={styles.terminal}>
          <Text style={styles.terminalDim}>shell: {controller.appSettings.terminalShell || controller.defaultTerminalShell}</Text>
          <Text style={styles.terminalDim}>
            cwd: {controller.selectedProject ? controller.selectedProject.path : controller.getRootWorkspacePath()}
          </Text>
          {controller.terminalLines.map((line) => (
            <Text
              key={line.id}
              style={[
                line.kind === 'error' ? styles.terminalError : line.kind === 'input' ? styles.terminalText : styles.terminalDim,
                { fontSize: controller.appSettings.terminalFontSize },
              ]}
            >
              {line.text}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Runtime status</Text>
        <StatusRow title="Node.js / npm" detail="Blocked until native bridge or backend runner is added." status="Unavailable" styles={styles} />
        <StatusRow title="Python / pip" detail="Blocked until native bridge or backend runner is added." status="Unavailable" styles={styles} />
        <StatusRow title="Git commands" detail="Blocked by the safe terminal service right now." status="Unavailable" styles={styles} />
      </View>
    </>
  );
}

function SettingsScreen({
  route,
  setRoute,
  controller,
  styles,
  palette,
}: {
  route: SettingsRoute;
  setRoute: (route: SettingsRoute) => void;
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
}) {
  if (route === 'profile') {
    return <ProfileSettings controller={controller} styles={styles} palette={palette} />;
  }

  if (route === 'notifications') {
    return <NotificationSettings controller={controller} styles={styles} />;
  }

  if (route === 'permissions') {
    return <PermissionSettings controller={controller} styles={styles} palette={palette} />;
  }

  if (route === 'git') {
    return <GitSettings controller={controller} styles={styles} />;
  }

  if (route === 'runtimes') {
    return <RuntimeSettings controller={controller} styles={styles} />;
  }

  if (route === 'sync') {
    return <SyncSettings controller={controller} styles={styles} />;
  }

  if (route === 'audit') {
    return <AuditSettings controller={controller} styles={styles} palette={palette} />;
  }

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <SegmentedControl
          value={controller.appSettings.themeMode}
          options={[
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'System', value: 'system' },
          ]}
          onChange={(value) =>
            void saveSettings(controller, { themeMode: value as AppSettings['themeMode'] }, `Theme set to ${value}.`)
          }
          styles={styles}
        />
        <ToggleRow
          title="Auto-save"
          detail="Save editor changes automatically"
          value={controller.appSettings.autoSave}
          onValueChange={(value) => void saveSettings(controller, { autoSave: value }, value ? 'Auto-save enabled.' : 'Auto-save disabled.')}
          styles={styles}
          palette={palette}
        />
        <ChoiceRow
          title="Auto-save interval"
          value={`${controller.appSettings.autoSaveIntervalSeconds} seconds`}
          choices={[15, 30, 60].map((seconds) => ({
            label: `${seconds}s`,
            onPress: () => void saveSettings(controller, { autoSaveIntervalSeconds: seconds }, 'Auto-save interval saved.'),
          }))}
          styles={styles}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Terminal</Text>
        <TextInput
          value={controller.appSettings.terminalShell}
          onChangeText={(value) => controller.setAppSettings((current) => ({ ...current, terminalShell: value }))}
          onEndEditing={() =>
            void saveSettings(
              controller,
              { terminalShell: controller.appSettings.terminalShell.trim() || controller.defaultTerminalShell },
              'Default terminal shell saved.',
            )
          }
          style={styles.search}
          placeholder="Preferred shell label"
          placeholderTextColor={palette.slate}
          autoCapitalize="none"
        />
        <ChoiceRow
          title="Terminal font size"
          value={`${controller.appSettings.terminalFontSize} pt`}
          choices={[12, 14, 16].map((size) => ({
            label: `${size}`,
            onPress: () => void saveSettings(controller, { terminalFontSize: size }, 'Terminal font size saved.'),
          }))}
          styles={styles}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <StatusRow title="Default project directory" detail={controller.getRootWorkspacePath()} status="Sandboxed" styles={styles} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>RootForge controls</Text>
        <SettingsNavRow title="Profile" detail="Manage account and API keys" onPress={() => setRoute('profile')} styles={styles} />
        <SettingsNavRow title="Notifications" detail="Agent completion alerts" onPress={() => setRoute('notifications')} styles={styles} />
        <SettingsNavRow title="Agent permissions" detail="Configure what the agent can do" onPress={() => setRoute('permissions')} styles={styles} />
        <SettingsNavRow title="Git & GitHub" detail="Real status, no fake connection" onPress={() => setRoute('git')} styles={styles} />
        <SettingsNavRow title="Runtimes & packages" detail="Runtime readiness and package blockers" onPress={() => setRoute('runtimes')} styles={styles} />
        <SettingsNavRow title="Sync & reliability" detail="Firestore sync and reversibility" onPress={() => setRoute('sync')} styles={styles} />
        <SettingsNavRow title="Audit & accessibility" detail="History, labels, contrast, text" onPress={() => setRoute('audit')} styles={styles} />
      </View>

      <View style={styles.panel}>
        <StatusRow title="About RootForge" detail="Mobile coding workspace app" status="v1.0.0" styles={styles} />
      </View>
    </>
  );
}

function ProfileSettings({ controller, styles, palette }: { controller: Controller; styles: RootForgeStyles; palette: RootForgeTheme }) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{controller.authUser?.displayName?.slice(0, 1) || controller.authUser?.email?.slice(0, 1) || 'R'}</Text>
          </View>
          <View style={styles.listCopy}>
            <Text style={styles.sectionTitle}>{controller.authUser?.displayName || 'Signed-out user'}</Text>
            <Text style={styles.muted}>{controller.authUser?.email || 'Configure Firebase and sign in to sync projects.'}</Text>
          </View>
        </View>
        {controller.authUser ? (
          <>
            <TextInput
              value={controller.displayName}
              onChangeText={controller.setDisplayName}
              style={styles.search}
              placeholder="Display name"
              placeholderTextColor={palette.slate}
            />
            <View style={styles.actionButtons}>
              <Pressable accessibilityRole="button" style={[styles.smallButton, styles.allowButton]} onPress={controller.handleSaveProfile}>
                <Text style={styles.allowText}>Save profile</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={[styles.smallButton, styles.denyButton]} onPress={controller.handleSignOut}>
                <Text style={styles.denyText}>Sign out</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <AuthForm controller={controller} styles={styles} palette={palette} />
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Connected accounts</Text>
        <StatusRow title="Email / password" detail={controller.authUser?.email || 'Not signed in'} status={controller.authUser ? 'Active' : 'Needed'} styles={styles} />
        <StatusRow
          title="Google"
          detail={Platform.OS === 'web' ? 'Native Google auth requires Android/iOS development build.' : 'Uses Firebase credential exchange when configured.'}
          status={controller.firebaseConfigured ? 'Available' : 'Config needed'}
          styles={styles}
        />
        <StatusRow title="GitHub" detail="Provider setup is not wired yet, so this is not shown as connected." status="Not configured" styles={styles} />
        <StatusRow title="Apple" detail="Provider setup is not wired yet, so this is not shown as connected." status="Not configured" styles={styles} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Security</Text>
        <StatusRow title="BYOK API key" detail="Stored in SecureStore on native, localStorage on web." status={controller.hasApiKey ? 'Saved' : 'Missing'} styles={styles} />
        <StatusRow title="Firebase project" detail={controller.getFirebaseProjectLabel() || 'Environment variables missing'} status={controller.firebaseConfigured ? 'Configured' : 'Missing'} styles={styles} />
      </View>
    </>
  );
}

function NotificationSettings({ controller, styles }: { controller: Controller; styles: RootForgeStyles }) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow
          title="Agent finished task"
          detail="Notify when approved agent apply completes"
          value={controller.appSettings.notificationsEnabled}
          onValueChange={(value) => void controller.updateNotificationPreference(value)}
          styles={styles}
        />
        <StatusRow title="Task failures" detail="Failure push events need a backend worker before this can be real." status="Not wired" styles={styles} />
        <StatusRow title="Mentions" detail="Mentions require collaboration accounts, not implemented yet." status="Not wired" styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>History</Text>
        {controller.agentHistory.length ? (
          controller.agentHistory.slice(0, 6).map((entry) => (
            <StatusRow key={entry.id} title={entry.executionSummary} detail={entry.projectName} status={entry.createdAt} styles={styles} />
          ))
        ) : (
          <Text style={styles.emptyText}>No completed agent runs yet.</Text>
        )}
      </View>
    </>
  );
}

function PermissionSettings({
  controller,
  styles,
  palette,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
}) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>File system</Text>
        {permissionLabels.slice(0, 4).map((permission) => (
          <ToggleRow
            key={permission.key}
            title={permission.label}
            detail={`Allow agent to ${permission.label.toLowerCase()} workspace files`}
            value={controller.permissions.includes(permission.key)}
            onValueChange={() => controller.togglePermission(permission.key)}
            styles={styles}
            palette={palette}
          />
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Execution</Text>
        {permissionLabels.slice(4, 7).map((permission) => (
          <ToggleRow
            key={permission.key}
            title={permission.label}
            detail={`Allow agent to use ${permission.label.toLowerCase()}`}
            value={controller.permissions.includes(permission.key)}
            onValueChange={() => controller.togglePermission(permission.key)}
            styles={styles}
            palette={palette}
          />
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Version control & safety</Text>
        <ToggleRow
          title="Commit changes"
          detail="Git is blocked until a real Git bridge exists"
          value={controller.permissions.includes('commit')}
          onValueChange={() => controller.togglePermission('commit')}
          styles={styles}
          palette={palette}
        />
        <ToggleRow
          title="Confirm dangerous actions"
          detail="Ask before high-risk operations"
          value={controller.appSettings.confirmDangerousActions}
          onValueChange={(value) =>
            void saveSettings(controller, { confirmDangerousActions: value }, 'Danger confirmation preference saved.')
          }
          styles={styles}
          palette={palette}
        />
        <View style={styles.actionButtons}>
          <Pressable
            accessibilityRole="button"
            style={[styles.smallButton, styles.allowButton]}
            onPress={() =>
              void controller.updateAppSettings(
                { ...controller.appSettings, defaultPermissions: controller.permissions },
                'Default agent permissions saved.',
              )
            }
          >
            <Text style={styles.allowText}>Save defaults</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.smallButton, styles.quickButtonGhost]}
            onPress={() => {
              controller.setPermissions(defaultAppSettings.defaultPermissions);
              void saveSettings(controller, { defaultPermissions: defaultAppSettings.defaultPermissions }, 'Permissions reset.');
            }}
          >
            <Text style={styles.quickButtonGhostText}>Reset</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

function GitSettings({ controller, styles }: { controller: Controller; styles: RootForgeStyles }) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>GitHub</Text>
          <Pressable accessibilityRole="button" style={styles.compactButton} onPress={() => showUnavailable('GitHub OAuth is not wired yet.')}>
            <Text style={styles.compactButtonText}>Connect</Text>
          </Pressable>
        </View>
        <StatusRow title="Connection" detail="No GitHub OAuth provider or token store is implemented yet." status="Not connected" styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Repository</Text>
        <StatusRow
          title="Selected project"
          detail={controller.selectedProject?.path || 'Create or select a project first.'}
          status={controller.selectedProject ? 'Local' : 'None'}
          styles={styles}
        />
        {['Clone repository', 'Create repository', 'Pull', 'Commit', 'Push'].map((action) => (
          <SettingsNavRow
            key={action}
            title={action}
            detail="Blocked until a real Git/GitHub integration is added."
            onPress={() => showUnavailable(`${action} is intentionally blocked until RootForge has a real Git integration.`)}
            styles={styles}
          />
        ))}
      </View>
    </>
  );
}

function RuntimeSettings({ controller, styles }: { controller: Controller; styles: RootForgeStyles }) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Runtimes</Text>
        <StatusRow title="Node.js" detail="No local Node runtime bridge is installed." status="Unavailable" styles={styles} />
        <StatusRow title="Python" detail="No local Python runtime bridge is installed." status="Unavailable" styles={styles} />
        <StatusRow title="Static web preview" detail="Project ZIP export is real; live preview server is not implemented." status="Not wired" styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Package managers</Text>
        <SegmentedControl value="blocked" options={[{ label: 'npm blocked', value: 'blocked' }, { label: 'pip blocked', value: 'pip' }]} onChange={() => showUnavailable('Package installation needs a real runtime backend.')} styles={styles} />
        <StatusRow title="npm install" detail="The terminal blocks npm instead of pretending it ran." status="Blocked" styles={styles} />
        <StatusRow title="pip install" detail="The terminal blocks pip instead of pretending it ran." status="Blocked" styles={styles} />
        <StatusRow title="Safe commands" detail="help, pwd, ls, cat, write, touch, mkdir, rm, mv, grep" status="Active" styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Current project</Text>
        <StatusRow
          title={controller.selectedProject?.name || 'No project selected'}
          detail={controller.selectedProject ? `${controller.selectedProject.fileCount} files` : 'Create a project first.'}
          status={controller.selectedProject ? 'Ready' : 'Needed'}
          styles={styles}
        />
      </View>
    </>
  );
}

function SyncSettings({ controller, styles }: { controller: Controller; styles: RootForgeStyles }) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Sync status</Text>
        <StatusRow title="Project metadata" detail={controller.syncStatus} status={controller.authUser ? 'Live' : 'Sign in'} styles={styles} />
        <StatusRow title="Files" detail="File contents are local-first and not remotely mirrored yet." status="Local" styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Reliability</Text>
        <StatusRow title="Autosaved drafts" detail={controller.appSettings.autoSave ? 'Enabled for editor changes.' : 'Disabled in settings.'} status={controller.appSettings.autoSave ? 'On' : 'Off'} styles={styles} />
        <StatusRow title="Reversible changes" detail="Agent writes require action approval and diff acceptance first." status="Active" styles={styles} />
        <SettingsNavRow title="Export project" detail="Export selected project as a real ZIP archive." onPress={controller.handleExportProjectArchive} styles={styles} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Synced projects</Text>
        {controller.syncedProjects.length ? (
          controller.syncedProjects.map((project) => (
            <StatusRow key={project.id} title={project.name} detail={`${project.fileCount} files • ${project.folderCount} folders`} status={project.syncedAt ?? 'Pending'} styles={styles} />
          ))
        ) : (
          <Text style={styles.emptyText}>No Firestore project metadata visible yet.</Text>
        )}
      </View>
    </>
  );
}

function AuditSettings({
  controller,
  styles,
  palette,
}: {
  controller: Controller;
  styles: RootForgeStyles;
  palette: RootForgeTheme;
}) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Audit history</Text>
        {controller.agentHistory.length ? (
          controller.agentHistory.map((entry) => (
            <StatusRow key={entry.id} title={entry.executionSummary} detail={entry.prompt} status={entry.createdAt} styles={styles} />
          ))
        ) : (
          <Text style={styles.emptyText}>No audited agent actions yet.</Text>
        )}
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Accessibility</Text>
        <ToggleRow
          title="Screen reader labels"
          detail="Keep explicit labels and roles on controls"
          value={controller.appSettings.screenReaderLabels}
          onValueChange={(value) => void saveSettings(controller, { screenReaderLabels: value }, 'Screen reader preference saved.')}
          styles={styles}
          palette={palette}
        />
        <ToggleRow
          title="High contrast"
          detail="Increase borders and text contrast"
          value={controller.appSettings.highContrast}
          onValueChange={(value) => void saveSettings(controller, { highContrast: value }, 'High contrast preference saved.')}
          styles={styles}
          palette={palette}
        />
        <ToggleRow
          title="Keyboard navigation"
          detail="Keep keyboard-friendly focusable controls on web"
          value={controller.appSettings.keyboardShortcuts}
          onValueChange={(value) => void saveSettings(controller, { keyboardShortcuts: value }, 'Keyboard preference saved.')}
          styles={styles}
          palette={palette}
        />
      </View>
    </>
  );
}

function AuthForm({ controller, styles, palette }: { controller: Controller; styles: RootForgeStyles; palette: RootForgeTheme }) {
  if (!controller.firebaseConfigured) {
    return (
      <Text style={styles.emptyText}>
        Add the `EXPO_PUBLIC_FIREBASE_*` values before auth can go live.
      </Text>
    );
  }

  return (
    <>
      <SegmentedControl
        value={controller.authMode}
        options={[
          { label: 'Sign in', value: 'sign-in' },
          { label: 'Sign up', value: 'sign-up' },
        ]}
        onChange={(value) => controller.setAuthMode(value as 'sign-in' | 'sign-up')}
        styles={styles}
      />
      {Platform.OS !== 'web' ? (
        <GoogleSigninButton
          style={styles.googleButton}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          onPress={controller.handleGoogleSignIn}
        />
      ) : null}
      {controller.authMode === 'sign-up' ? (
        <TextInput
          value={controller.displayName}
          onChangeText={controller.setDisplayName}
          style={styles.search}
          placeholder="Display name"
          placeholderTextColor={palette.slate}
          autoCapitalize="words"
        />
      ) : null}
      <TextInput
        value={controller.email}
        onChangeText={controller.setEmail}
        style={styles.search}
        placeholder="Email"
        placeholderTextColor={palette.slate}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        value={controller.password}
        onChangeText={controller.setPassword}
        style={styles.search}
        placeholder="Password"
        placeholderTextColor={palette.slate}
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.actionButtons}>
        <Pressable
          accessibilityRole="button"
          style={[styles.smallButton, styles.allowButton]}
          onPress={controller.authMode === 'sign-up' ? controller.handleSignUp : controller.handleSignIn}
        >
          <Text style={styles.allowText}>{controller.authMode === 'sign-up' ? 'Create account' : 'Sign in'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.smallButton, styles.denyButton]} onPress={controller.handleResetPassword}>
          <Text style={styles.denyText}>Reset password</Text>
        </Pressable>
      </View>
    </>
  );
}

function ProjectSelector({ controller, styles }: { controller: Controller; styles: RootForgeStyles }) {
  return (
    <View style={styles.projectTabs}>
      {controller.projects.map((project) => (
        <Pressable
          accessibilityRole="button"
          key={project.id}
          style={[styles.projectChip, controller.selectedProjectId === project.id && styles.projectChipActive]}
          onPress={() => {
            controller.setSelectedProjectId(project.id);
            controller.setSelectedNodePath('');
            controller.setSearchResults([]);
          }}
        >
          <Text style={[styles.projectChipText, controller.selectedProjectId === project.id && styles.projectChipTextActive]}>
            {project.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function QuickTile({ icon, label, onPress, styles }: { icon: string; label: string; onPress: () => void; styles: RootForgeStyles }) {
  return (
    <Pressable accessibilityRole="button" style={styles.quickActionTile} onPress={onPress}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  detail,
  value,
  onValueChange,
  styles,
  palette,
}: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: RootForgeStyles;
  palette?: RootForgeTheme;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette?.line ?? '#d8dee8', true: palette?.mode === 'dark' ? '#194b83' : '#b7d6ff' }}
        thumbColor={value ? palette?.blue ?? '#0f63ff' : palette?.panel ?? '#fff'}
      />
    </View>
  );
}

function StatusRow({
  title,
  detail,
  status,
  styles,
}: {
  title: string;
  detail: string;
  status: string;
  styles: RootForgeStyles;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={styles.pathBadge}>{status}</Text>
    </View>
  );
}

function SettingsNavRow({
  title,
  detail,
  onPress,
  styles,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  styles: RootForgeStyles;
}) {
  return (
    <Pressable accessibilityRole="button" style={styles.settingsRow} onPress={onPress}>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ChoiceRow({
  title,
  value,
  choices,
  styles,
}: {
  title: string;
  value: string;
  choices: Array<{ label: string; onPress: () => void }>;
  styles: RootForgeStyles;
}) {
  return (
    <View style={styles.choiceRow}>
      <View style={styles.rowBetween}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.muted}>{value}</Text>
      </View>
      <View style={styles.actionButtons}>
        {choices.map((choice) => (
          <Pressable key={choice.label} accessibilityRole="button" style={[styles.smallButton, styles.quickButtonGhost]} onPress={choice.onPress}>
            <Text style={styles.quickButtonGhostText}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
  styles,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  styles: RootForgeStyles;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyProject({ styles }: { styles: RootForgeStyles }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>No project selected</Text>
      <Text style={styles.emptyText}>Create a project from Workspace before using files, agent, or terminal.</Text>
    </View>
  );
}

function routeTitle(route: SettingsRoute) {
  const titles: Record<SettingsRoute, string> = {
    settings: 'Settings',
    profile: 'Profile',
    notifications: 'Notifications',
    permissions: 'Agent permissions',
    git: 'Git & GitHub',
    runtimes: 'Runtimes & packages',
    sync: 'Sync & reliability',
    audit: 'Audit & accessibility',
  };
  return titles[route];
}

function saveSettings(controller: Controller, patch: Partial<AppSettings>, message: string) {
  return controller.updateAppSettings({ ...controller.appSettings, ...patch }, message);
}

function showUnavailable(message: string) {
  Alert.alert('RootForge', message);
}

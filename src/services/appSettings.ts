import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { AgentPermission } from './aiClient';

const SETTINGS_STORAGE_KEY = 'rootforge.app.settings.v1';

export type AppSettings = {
  themeMode: 'light' | 'dark' | 'system';
  autoSave: boolean;
  autoSaveIntervalSeconds: number;
  notificationsEnabled: boolean;
  terminalShell: string;
  terminalFontSize: number;
  defaultPermissions: AgentPermission[];
  confirmDangerousActions: boolean;
  screenReaderLabels: boolean;
  highContrast: boolean;
  keyboardShortcuts: boolean;
};

export const defaultAppSettings: AppSettings = {
  themeMode: 'system',
  autoSave: false,
  autoSaveIntervalSeconds: 30,
  notificationsEnabled: false,
  terminalShell: 'bash',
  terminalFontSize: 14,
  defaultPermissions: ['read', 'edit', 'create'],
  confirmDangerousActions: true,
  screenReaderLabels: true,
  highContrast: false,
  keyboardShortcuts: true,
};

function normalizePermissions(value: unknown): AgentPermission[] {
  if (!Array.isArray(value)) {
    return defaultAppSettings.defaultPermissions;
  }

  const allowed: AgentPermission[] = ['read', 'edit', 'create', 'delete', 'terminal', 'install', 'internet', 'commit'];
  const seen = new Set<AgentPermission>();

  for (const item of value) {
    const permission = String(item) as AgentPermission;
    if (allowed.includes(permission)) {
      seen.add(permission);
    }
  }

  return seen.size ? [...seen] : defaultAppSettings.defaultPermissions;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return defaultAppSettings;
  }

  const record = value as Record<string, unknown>;
  const themeMode = String(record.themeMode ?? defaultAppSettings.themeMode);
  const autoSaveIntervalSeconds = Number(record.autoSaveIntervalSeconds ?? defaultAppSettings.autoSaveIntervalSeconds);
  const terminalFontSize = Number(record.terminalFontSize ?? defaultAppSettings.terminalFontSize);

  return {
    themeMode:
      themeMode === 'light' || themeMode === 'dark' || themeMode === 'system'
        ? themeMode
        : defaultAppSettings.themeMode,
    autoSave: typeof record.autoSave === 'boolean' ? record.autoSave : defaultAppSettings.autoSave,
    autoSaveIntervalSeconds: Number.isFinite(autoSaveIntervalSeconds)
      ? Math.max(10, Math.min(120, Math.round(autoSaveIntervalSeconds)))
      : defaultAppSettings.autoSaveIntervalSeconds,
    notificationsEnabled:
      typeof record.notificationsEnabled === 'boolean'
        ? record.notificationsEnabled
        : defaultAppSettings.notificationsEnabled,
    terminalShell:
      typeof record.terminalShell === 'string' && record.terminalShell.trim()
        ? record.terminalShell.trim()
        : defaultAppSettings.terminalShell,
    terminalFontSize: Number.isFinite(terminalFontSize)
      ? Math.max(11, Math.min(22, Math.round(terminalFontSize)))
      : defaultAppSettings.terminalFontSize,
    defaultPermissions: normalizePermissions(record.defaultPermissions),
    confirmDangerousActions:
      typeof record.confirmDangerousActions === 'boolean'
        ? record.confirmDangerousActions
        : defaultAppSettings.confirmDangerousActions,
    screenReaderLabels:
      typeof record.screenReaderLabels === 'boolean'
        ? record.screenReaderLabels
        : defaultAppSettings.screenReaderLabels,
    highContrast:
      typeof record.highContrast === 'boolean' ? record.highContrast : defaultAppSettings.highContrast,
    keyboardShortcuts:
      typeof record.keyboardShortcuts === 'boolean'
        ? record.keyboardShortcuts
        : defaultAppSettings.keyboardShortcuts,
  };
}

async function readStorageValue() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SETTINGS_STORAGE_KEY);
  }

  return AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
}

async function writeStorageValue(value: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, value);
    }
    return;
  }

  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, value);
}

export async function loadAppSettings() {
  const raw = await readStorageValue();
  if (!raw) {
    return defaultAppSettings;
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultAppSettings;
  }
}

export async function saveAppSettings(settings: AppSettings) {
  const normalized = normalizeSettings(settings);
  await writeStorageValue(JSON.stringify(normalized));
  return normalized;
}

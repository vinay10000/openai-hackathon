import * as SecureStore from 'expo-secure-store';

const BYOK_STORAGE_KEY = 'rootforge.gemma.api-key';

export type AgentPermission = 'read' | 'edit' | 'create' | 'delete' | 'terminal' | 'install' | 'internet' | 'commit';

export type AgentRequest = {
  prompt: string;
  projectPath: string;
  permissions: AgentPermission[];
};

export type AgentPlan = {
  summary: string;
  filesToCreate: string[];
  filesToModify: string[];
  filesToDelete: string[];
  commands: string[];
};

export async function saveBringYourOwnKey(apiKey: string) {
  await SecureStore.setItemAsync(BYOK_STORAGE_KEY, apiKey.trim());
}

export async function hasBringYourOwnKey() {
  const value = await SecureStore.getItemAsync(BYOK_STORAGE_KEY);
  return Boolean(value);
}

export async function draftGemmaAgentPlan(request: AgentRequest): Promise<AgentPlan> {
  const hasKey = await hasBringYourOwnKey();

  return {
    summary: hasKey
      ? `Gemma agent draft for "${request.prompt}" in ${request.projectPath}.`
      : `Local plan draft for "${request.prompt}". Add a Gemma API key to enable live agent planning.`,
    filesToCreate: ['src/screens/LoginScreen.tsx'],
    filesToModify: ['App.tsx', 'src/services/firebase.ts'],
    filesToDelete: [],
    commands: request.permissions.includes('install') ? ['npm install firebase'] : [],
  };
}

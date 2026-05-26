# RootForge Architecture

RootForge is an Expo + Firebase mobile coding workspace where an AI coding agent can plan, preview, and apply changes inside an app-owned root workspace on the phone.

## Current Technical Decisions

- App framework: Expo blank TypeScript project.
- Backend: Firebase Auth and Firestore via `src/services/firebase.ts`.
- BYOK storage: `expo-secure-store`, so user-provided AI keys are stored in encrypted device storage.
- Workspace storage: `expo-file-system` under `FileSystem.documentDirectory/root-workspace`.
- Web preview storage: browser `localStorage` for the workspace shell because Expo's native file workspace surface does not map 1:1 to web.
- AI provider boundary: `src/services/aiClient.ts`, currently a local planning boundary with BYOK key storage in place. Live Gemma calls are the next integration step once the API key and endpoint details are provided.
- UI style: native mobile workspace shell, not a landing page.

## Planned Slices

1. Firebase auth and synced project metadata.
2. Live Gemma planning/execution with action preview sourced from model output.
3. Agent chat, approval ledger, and audit history persistence.
4. Diff viewer with accept/reject per file.
5. Terminal/runtime bridge for supported environments.
6. Git/GitHub integration.

## Handoff Rules For Future Chats

- Read `PROJECT_STATUS.md` first.
- Keep this file updated when a durable technical decision changes.
- Keep user-facing build progress in `PROJECT_STATUS.md`.
- Do not expose API keys in source. Use BYOK storage or `.env` public Firebase keys only.
- Prefer implementing the next thin vertical slice instead of broad rewrites.

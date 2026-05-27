# RootForge Architecture

RootForge is an Expo + Firebase mobile coding workspace where an AI coding agent can plan, preview, and apply changes inside an app-owned root workspace on the phone.

## Current Technical Decisions

- App framework: Expo blank TypeScript project.
- App config: `app.config.js` so native auth setup can react to real env vars and optional Google/Firebase files.
- Backend: Firebase Auth and Firestore via `src/services/firebase.ts`.
- BYOK storage: `expo-secure-store`, so user-provided AI keys are stored in encrypted device storage.
- Workspace storage: `expo-file-system` under `FileSystem.documentDirectory/root-workspace`.
- Web preview storage: browser `localStorage` for the workspace shell because Expo's native file workspace surface does not map 1:1 to web.
- Native Google auth: `@react-native-google-signin/google-signin` with Firebase `GoogleAuthProvider.credential(idToken)` exchange on Android and iOS.
- Google config boundary: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is required for Firebase credential exchange. `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` are supported when plist-based auto setup is not present.
- AI provider boundary: `src/services/aiClient.ts`, now uses two live Gemma 4 calls over the Gemini API REST endpoint using the user BYOK key from secure storage. The first call drafts the action preview from the real workspace tree, and the second call returns concrete file operations for approved paths only.
- Project sync boundary: `src/services/projectSync.ts`, which mirrors per-user project metadata into Firestore while leaving workspace files local-first on the device.
- Workspace mutation boundary: `src/services/workspace.ts`, which now owns real file reads, writes, deletes, and batched apply operations across native storage and web localStorage.
- Workspace editing boundary: `App.tsx` now loads selected file contents from `src/services/workspace.ts`, tracks dirty editor state in UI, and saves the full file back into the real workspace.
- Workspace move boundary: `src/services/workspace.ts` now owns intra-project move operations for files and folders on both native storage and web localStorage.
- Portability boundary: `src/services/portability.ts`, which imports real user-picked files into the workspace, exports real workspace files, and now packages full projects into ZIP archives for native share or web download.
- Diff review boundary: `App.tsx` currently builds an in-app reviewed operation list from the live execution plan, renders lightweight line diffs, and applies only the user-accepted operations.
- Audit boundary: `src/services/agentHistory.ts`, which persists recent approved agent runs locally for task history and inspection.
- Remote audit sync: `src/services/agentHistory.ts` also mirrors agent runs into Firestore for signed-in users so approvals and applied operations can survive devices and future chats.
- Settings boundary: `src/services/appSettings.ts`, which persists auto-save, notification, terminal shell, and default-permission preferences locally across sessions.
- Notification boundary: `src/services/notifications.ts`, which owns local permission requests and native completion notifications for finished agent apply runs.
- UI style: native mobile workspace shell, not a landing page.

## Planned Slices

1. Device-verify native Google auth once real Google/Firebase files and OAuth IDs are added.
2. Terminal/runtime bridge for supported environments.
3. Diff viewer improvements such as richer hunks and clearer folder-delete summaries.
4. Git/GitHub integration.
5. Terminal/runtime execution backend.

## Handoff Rules For Future Chats

- Read `PROJECT_STATUS.md` first.
- Keep this file updated when a durable technical decision changes.
- Keep user-facing build progress in `PROJECT_STATUS.md`.
- Do not expose API keys in source. Use BYOK storage or `.env` public Firebase keys only.
- Do not commit `google-services.json` or `GoogleService-Info.plist` unless the user explicitly wants them in-repo.
- Prefer implementing the next thin vertical slice instead of broad rewrites.
- If a future chat touches agent planning, keep it real-only: no placeholder plans or mock action previews.
- If a future chat touches agent apply, preserve the approved-path guardrail so the execution call cannot mutate files outside the user-approved preview.
- If a future chat touches the editor or workspace structure, preserve the real-file workflow: selected files should be loaded from storage, edited in memory, and explicitly saved back through `writeFileContent`.
- If a future chat touches portability, preserve the current real-only rule: import should come from the system picker and export should move actual workspace files or ZIP archives, not synthesized previews.
- If a future chat touches settings, preserve the current local-first persistence model in `src/services/appSettings.ts` so preferences survive new chats and new app launches.

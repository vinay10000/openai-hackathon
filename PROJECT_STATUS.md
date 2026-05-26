# RootForge Project Status

Last updated: 2026-05-26

## Product

RootForge is a mobile coding workspace app where users can create, edit, run, and manage projects on their phone while an AI coding agent safely works inside the project root with permission-based file access, terminal execution, and change previews.

## Built So Far

- Expo TypeScript project scaffolded.
- App name selected: RootForge.
- Firebase dependency installed and config service added.
- BYOK storage boundary added for user-provided Gemma API keys.
- Root workspace filesystem boundary added.
- Architecture notes added for future chats.
- Real persisted workspace slice built with:
  - project creation inside the app-owned root workspace
  - real file and folder creation
  - real rename and delete actions
  - real recursive file explorer
  - real per-project file search
  - native storage via `expo-file-system`
  - browser preview persistence via `localStorage` because Expo file-system root access differs on web
- Native mobile workspace shell built with:
  - project list
  - root workspace panel
  - file explorer
  - agent chat composer
  - permission toggles
  - action preview panel ready for live agent actions
  - terminal/log preview
- Expo web smoke test passed on `http://localhost:8084`.
- TypeScript check passed.
- `npx expo export --platform web` passed.

## Current Slice In Progress

- No active partial slice. The next chat can start from Firebase auth and synced project metadata, or from wiring live Gemma planning.

## Next Recommended Slice

Choose one thin vertical slice:

1. Firebase auth with email + Google and a real signed-in workspace state.
2. Live Gemma planning/execution through BYOK with action preview populated from real model output.
3. Project metadata sync to Firestore while keeping files local-first on device.

## Environment Notes

- Use `npm.cmd` on Windows if `npm` command resolution acts oddly.
- Firebase keys should be configured through `EXPO_PUBLIC_FIREBASE_*` environment variables.
- Gemma API key should be stored through BYOK flow, not committed.
- Expo SDK 56 uses the new `expo-file-system` object API on native.
- Web preview persists the workspace in browser `localStorage` because the same root-workspace API surface is not available there.

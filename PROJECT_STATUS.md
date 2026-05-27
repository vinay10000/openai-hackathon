# RootForge Project Status

Last updated: 2026-05-27

## Product

RootForge is a mobile coding workspace app where users can create, edit, run, and manage projects on their phone while an AI coding agent safely works inside the project root with permission-based file access, terminal execution, and change previews.

## Built So Far

- Expo TypeScript project scaffolded.
- App name selected: RootForge.
- Firebase dependency installed and config service added.
- BYOK storage boundary added for user-provided Gemma API keys.
- BYOK input is now exposed in the app UI and persists securely on native.
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
- Screenshot-aligned mobile shell refresh built with:
  - RootForge cube mark, compact status pills, rounded cards, and bottom mobile navigation matching the supplied light-mode mockups more closely
  - real dark-mode design using the same component tree and controller, not duplicated static screenshots
  - theme-aware cards, inputs, file rows, action previews, diff blocks, terminal blocks, switches, and bottom tabs
  - accessible tab roles/state on the bottom navigation
- Proper mobile screen split built after the single-page critique:
  - bottom tabs now render separate Workspace, Files, Agent, Terminal, and Settings screens instead of scrolling one long page
  - Settings now has screenshot-style detail screens for Profile, Notifications, Agent permissions, Git & GitHub, Runtimes & packages, Sync & reliability, and Audit & accessibility
  - theme mode, auto-save interval, terminal font size, dangerous-action confirmation, screen-reader labels, high contrast, and keyboard navigation preferences persist through app settings
  - unavailable GitHub, runtime, package-manager, collaboration, and live-preview capabilities are explicitly blocked/labeled instead of shown as fake connected or active states
- Real Firebase auth slice built with:
  - signed-in session state in the app shell
  - email sign up
  - email sign in
  - password reset
  - profile display name updates
  - sign out
- Real native Google auth slice started with:
  - `@react-native-google-signin/google-signin` installed
  - native Google sign-in button on Android and iOS
  - Google ID token exchange into Firebase Auth via `signInWithCredential`
  - dynamic Expo config in `app.config.js`
  - env and file boundaries for `google-services.json`, `GoogleService-Info.plist`, and Google OAuth client IDs
- Real project-management and sync slice built with:
  - project rename
  - project duplicate
  - Firestore-backed per-user project metadata sync
  - live synced-project listener in the app shell
  - local-first files with remote metadata mirror
- Real file editing and workspace move slice built with:
  - live file-content loading from the selected workspace file
  - in-app multiline editor for real project files
  - save flow that writes back to the actual workspace file
  - dirty-state indicator for unsaved editor changes
  - real file/folder move support within the project tree
  - destination-folder discovery for move targets
- Real portability slice built with:
  - system document picker import for one or many real files
  - imports written into the selected project folder in the workspace
  - collision-safe import naming when a file already exists
  - real native file export through the share sheet
  - real web file export through direct browser download
  - whole-project ZIP export through the native share sheet or browser download
- Real Gemma planning slice built with:
  - BYOK key retrieval from secure storage
  - live Gemini API request to hosted Gemma 4
  - workspace-tree context sent with the planning request
  - action preview populated from live model output instead of placeholder data
- Real agent-apply slice built with:
  - second live Gemma execution call after approval
  - approved-path enforcement before any file mutation
  - real file reads for modify targets
  - real file writes and deletes against the workspace
  - persisted local agent run history for auditability
- Real diff-review slice built with:
  - live execution-plan review before workspace mutation
  - per-file before/after diff preview
  - accept all / reject all controls
  - per-file accept/reject before apply
  - final apply writes only accepted reviewed operations
- Real agent audit sync slice built with:
  - richer local agent history entries for approvals, rejected files, commands, and applied operations
  - Firestore-backed agent run sync for signed-in users
  - live audit history listener so agent history follows the account across devices
- Real local productivity settings slice built with:
  - persisted auto-save preference for the in-app editor
  - persisted preferred terminal shell label
  - persisted default agent permission set
  - real local completion notifications for finished agent apply runs on Android and iOS
- Real controlled terminal slice built with:
  - phone-safe commands executed against the selected real workspace project
  - `help`, `pwd`, `ls`, `cat`, `write`, `touch`, `mkdir`, `rm`, `mv`, and `grep`
  - terminal output history in the app shell
  - approved agent command actions routed through the same real command executor
  - dangerous shell escapes and unsupported runtime/package commands blocked instead of mocked
- Expo web smoke test passed on `http://localhost:8084`.
- TypeScript check passed again on 2026-05-27 after the tabbed-screen refresh.
- `npx expo export --platform web` passed.

## Current Slice In Progress

- Native Google auth is coded, but it still needs real project credentials/files to run end to end on device:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - optional `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - optional `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` if you are not using `GoogleService-Info.plist`
  - `google-services.json` for Android if using Firebase-native file setup
  - `GoogleService-Info.plist` for iOS if using Firebase-native file setup
  - a development build because Expo Go cannot run this native module
- Gemma planning and apply are now live, but they still need a real BYOK key saved in-app before the agent can execute.
- Terminal commands now execute a controlled workspace-command subset for real. Full `npm`, `node`, `python`, `pip`, and `git` execution is intentionally blocked until a real execution backend or native runtime bridge is built.
- Project sync currently mirrors project metadata only. File contents remain local-first on device.
- Diff review currently uses a lightweight line-based preview inside the app shell, not a full Myers-style diff engine yet.
- Agent history now syncs through Firestore when signed in, but file contents and full diff payloads are still not mirrored remotely.
- The app can now edit and save file contents directly, but there is still no syntax-aware code editor, undo history, or conflict prompt for unsaved file reloads.
- Web import currently reads picked files as text because the web workspace adapter is `localStorage` based.
- Notifications require OS permission and only fire on native platforms. Web skips local device notifications.

## Next Recommended Slice

Choose one thin vertical slice:

1. Finish Google auth device verification after adding the real Firebase/Google config files and OAuth values.
2. Add a real terminal/runtime execution backend or native bridge for `npm`, `node`, `python`, `pip`, and `git`.
3. Improve the diff viewer with richer hunks and folder-delete summaries if needed.
4. Add a real terminal/runtime execution backend, likely Firebase-backed, before enabling approved commands.

## Environment Notes

- Use `npm.cmd` on Windows if `npm` command resolution acts oddly.
- Firebase keys should be configured through `EXPO_PUBLIC_FIREBASE_*` environment variables.
- Native Google sign-in now uses `app.config.js`, not `app.json`.
- Native Google sign-in needs a development build and cannot run in Expo Go.
- Use `.env` or EAS envs for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`.
- Gemma API key should be stored through BYOK flow, not committed.
- Expo SDK 56 uses the new `expo-file-system` object API on native.
- Project instructions require checking the exact Expo v56 docs before code changes; the 2026-05-27 UI/theme pass checked `https://docs.expo.dev/versions/v56.0.0/`, `expo-file-system`, `expo-secure-store`, app config, and notifications docs first.
- The light and dark modes are powered from `src/styles/rootForgeStyles.ts` through `makeRootForgeStyles`; future UI work should extend that theme seam instead of hard-coding one-off colors.
- `src/screens/RootForgeScreen.tsx` is currently a state-driven navigator, not Expo Router. If navigation keeps growing, the next structural slice should migrate this to Expo Router tabs/stacks while preserving the same controller/service seams.
- Web preview persists the workspace in browser `localStorage` because the same root-workspace API surface is not available there.
- File import uses `expo-document-picker` with `copyToCacheDirectory: true` so Expo file APIs can read the picked native file immediately.
- File export uses `expo-sharing` on Android/iOS and a browser download on web because Expo web cannot share local file URIs.
- Project ZIP export uses `jszip`, writes a real archive to the device cache on native, then shares it through `expo-sharing`.
- Hosted Gemma planning is using the Gemini API Gemma 4 REST surface with model id `gemma-4-26b-a4b-it`.
- Agent history stores locally first and also syncs to Firestore when the user is signed in.
- Completion notifications use `expo-notifications` and are opt-in through the in-app settings panel.
- The current terminal is not a mock: supported commands read/write/delete/move files in the selected workspace project. Unsupported runtime commands fail loudly so future agents do not claim phone-local Node/Python/Git support prematurely.

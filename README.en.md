# Brain

*[Deutsche Version](README.md)*

An Electron desktop GUI for the locally installed [`claude` CLI](https://docs.claude.com/claude-code), built for working with one or more personal Obsidian vaults.

## Contents

- [What is a "Vault"?](#what-is-a-vault)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Requirements](#requirements)
- [Setup](#setup)
- [Start](#start)
- [Building an Installer](#building-an-installer)
- [Tech Stack](#tech-stack)
- [`config.json` Reference](#configjson-reference)
- [Troubleshooting](#troubleshooting)
- [Notes](#notes)

## What is a "Vault"?

A vault is a personal Obsidian folder — the actual knowledge base the app works with. Vaults live entirely outside this repo (managed in `config.json`, editable from the Settings view) and are never uploaded with it.

Inside a vault, the app expects two subfolders:

- **`raw-sources/`** — raw, unstructured source material (notes, articles, transcripts, etc.) that you drop in there
- **`wiki/`** — the linked topic files (`.md`) Claude produces from that material, shown under "Vault" and serving as the actual knowledge base

Every click on an action (e.g. "Rebuild wiki") starts `claude` with `cwd` set to the active vault folder. Claude reads directly from `raw-sources/`, writes/updates files in `wiki/`, and maintains a `log.md` of which sources it has already processed. The app itself never touches vault content via file access — it only sends prompts to Claude and displays results/files read-only.

## Features

- **Chat** — multiple parallel, named chat threads (like claude.ai) via a dedicated list on the left of the chat area; each thread runs its own `claude --continue` conversation. Responses stream live and render as markdown. A stop button cancels a running prompt. All threads are saved locally to `history.json` and restored on next launch.
  - **Prompt history**: arrow up/down in the input field cycles through recently sent prompts (per device, in `localStorage`)
  - **"Jump to bottom"** button appears when you've scrolled up while streaming
  - **Copy button** on every chat bubble copies its text to the clipboard
  - **@-mentions**: typing `@filename` in a prompt opens a picker of vault files; the content is automatically attached as context when sending (only `@filename` stays visible in the chat)
  - **Image attachments**: the 📎 button, or dragging an image into the input field; the file path is handed to Claude as a read instruction, which it analyzes via its Read tool
  - **Export** button saves the current chat as a markdown file
  - **Presets**: fixed context prepended to the prompt (e.g. language/tone), managed under Settings → Chat Presets, selectable from a dropdown in the chat
  - The empty-chat greeting randomly picks one of several variants (stable for the session)
- **Actions** — freely configurable prompt buttons in the sidebar (managed under Settings → Actions), pre-seeded with four examples: Rebuild wiki, Integrate new sources, Expand topic, Brain search. A prompt containing `{input}` asks for a value via dialog on click. After every action, the app automatically checks whether anything changed in the vault (`git diff`) and shows it as a review dialog.
- **Command Palette** (Ctrl+P) — quick search across all views and actions
- **Usage** — session and weekly limit of Claude Code at a glance (`/usage`)
- **Vault** — overview of existing wiki topics and raw sources, with filename and full-text search (Ctrl+K); clicking an entry opens the file content (rendered as markdown for `.md`) with rename/delete. Files can be imported by dragging them onto the raw-sources column. Wiki topics and raw sources can be pinned (★) — pinned entries appear at the top of the list. Further tabs:
  - **Graph** — visualizes the `[[topic-name]]` links between wiki files
  - **Git History** — commit list including a diff view per commit
  - **Trash** — restore deleted files or remove them permanently
- **History** — browse past Claude Code sessions in the active vault, including full-text search over the conversation content, pinning important sessions, and exporting a session as markdown
- **Settings** — create/edit/delete multiple vaults and switch the active one (including a folder picker), choose a theme, **language** (German/English), and Claude model, manage sidebar actions and chat presets, configure automatic sync, back up/restore settings as JSON, and check for updates:
  - automatically run "New Sources" on app start
  - and/or on a fixed interval (minutes) in the background
- **Themes** — four color schemes to choose from (Sunset, Midnight, Forest, Light), stored in `config.json` and active again automatically on next launch
- **Tray icon** — the app keeps running in the background when the window is closed (see note below); the tray menu can also trigger "New Sources" without an open window
- **Desktop notifications** — when a prompt or auto-sync finishes while the window isn't focused
- **Onboarding** — on the very first launch (or if the active vault folder doesn't exist), a short dialog walks you through picking a vault instead of silently running with a placeholder path
- **Keyboard shortcuts** — see the [dedicated section](#keyboard-shortcuts)

Running prompts emit stderr output as their own, color-coded error bubbles in the chat instead of silently hiding it in the output.

## Keyboard Shortcuts

**Global** (anywhere in the app)

| Shortcut | Effect |
| --- | --- |
| `Ctrl+N` | New chat thread (jumps to the chat view) |
| `Ctrl+K` | Jump to the vault view and focus the search field |
| `Ctrl+P` | Open the command palette |

**Chat input field**

| Shortcut | Effect |
| --- | --- |
| `Enter` | Send the prompt |
| `↑` | Insert the previous prompt from history |
| `↓` | Insert the next prompt, or restore the unsent draft |

**Command Palette** (while open)

| Shortcut | Effect |
| --- | --- |
| Typing | Filters commands live |
| `Enter` | Run the top (first) result |
| `Esc` | Close |

**Modals** (file viewer, git diff)

| Shortcut | Effect |
| --- | --- |
| `Esc` | Close |

**Vault / History search field**

| Shortcut | Effect |
| --- | --- |
| `Enter` | Start the full-text content search |

**Other interactions**

| Action | Effect |
| --- | --- |
| Double-click a chat thread | Rename it |

## Requirements

- [Claude Code CLI](https://docs.claude.com/claude-code) installed and on `PATH` (`claude` must be callable from a terminal)
- Node.js
- At least one Obsidian vault (or any folder) with `wiki/` and `raw-sources/` subfolders
- `git` is optional, but needed for the home-view chart (commit activity) and the vault's Git History tab — without a git repo in the vault, both simply stay empty

## Setup

```bash
npm install
```

`config.json` is created automatically on first launch (default vault `C:\Obsidian\my-knowledge-base`). Vaults can then be managed conveniently from the **Settings** view in the app — manually editing the file is no longer necessary. An existing old-format `config.json` (`{ "vaultPath": "..." }`) is automatically migrated to the new multi-vault format on startup.

## Start

```bash
npm start
```

Builds the React frontend with Vite and then launches Electron.

For UI-only development (in a browser, without Electron), `npm run dev` is also available — starts the Vite dev server with hot reload, but without `window.claudeAPI` (which only comes from the Electron preload).

## Building an Installer

```bash
npm run dist
```

Builds the frontend and packages the app via `electron-builder` into a Windows installer `.exe` under `release/`.

> **Windows note:** `electron-builder` downloads an archive for its code-signing tools, and extracting it creates symbolic links. Without **Developer Mode** enabled (Settings → Privacy & security → For developers) or without running the terminal **"as Administrator"**, this fails with `Cannot create symbolic link` — enable one of those once and it'll work.

## Tech Stack

- **Electron** — desktop shell, main process in `main.js`, IPC bridge in `preload.js`
- **React (JSX)** — the entire UI lives in `src/` (`App.jsx` + `src/components/`), built with **Vite**
- **cross-spawn** — launches `claude`/`git` without shell interpolation (prevents command injection via the prompt text)
- **react-markdown** — renders Claude's responses and wiki files
- Custom, lightweight i18n (React Context in `src/i18n.jsx`) for German/English — no external library
- No TypeScript — plain JSX

## `config.json` Reference

Created and migrated automatically — manually editing it usually isn't necessary (everything runs through the Settings view), but for reference:

```json
{
  "vaults": [
    { "name": "Default", "path": "C:\\Obsidian\\my-knowledge-base" }
  ],
  "activeVault": "Default",
  "theme": "sunset",
  "model": "",
  "autoSync": {
    "enabled": false,
    "intervalMinutes": 60,
    "runOnStartup": false
  },
  "customActions": [
    { "id": "wiki-rebuild", "label": "Wiki neu bauen", "prompt": "..." }
  ],
  "chatPresets": [
    { "id": "...", "label": "English, concise", "systemPrompt": "Reply in English, be concise." }
  ],
  "language": "de",
  "pins": { "wiki": [], "sources": [], "sessions": [] }
}
```

| Field | Meaning |
| --- | --- |
| `vaults` | List of all configured vaults (`name` + `path`) |
| `activeVault` | Name of the currently active vault from `vaults` |
| `theme` | `sunset` \| `midnight` \| `forest` \| `light` |
| `model` | Empty = CLI default, otherwise `sonnet` \| `opus` \| `haiku` (passed to `claude` as the `--model` flag) |
| `autoSync.enabled` / `.intervalMinutes` | Automatic "New Sources" on a fixed interval |
| `autoSync.runOnStartup` | Automatic "New Sources" on app start (once) |
| `customActions` | Sidebar buttons; `prompt` may contain `{input}` for a dialog prompt on click |
| `chatPresets` | Context templates selectable in chat; `systemPrompt` is prepended to every sent prompt |
| `language` | `de` \| `en` — controls the entire app UI |
| `pins` | Pinned wiki/source filenames or session IDs, as an array per category |

## Troubleshooting

| Problem | Cause / Fix |
| --- | --- |
| Chat gets stuck on "Running...", no response | `claude` is not on `PATH` — check in a regular terminal whether `claude -p "hi"` works |
| `Cannot create symbolic link` during `npm run dist` | Windows Developer Mode not enabled, or the terminal wasn't started as Administrator (see [Building an Installer](#building-an-installer)) |
| Home chart / vault Git History stay empty | The vault folder isn't a git repository, or `git` isn't installed — both are optional, not an error |
| The window disappears when clicking X | Not a bug — the app keeps running in the tray (see [Notes](#notes)). Right-click the tray icon → "Quit" to actually close it |
| The onboarding dialog reappears on every launch | The saved vault path no longer exists on disk — pick the folder again in the dialog |
| No desktop notifications | Only fires when the window isn't focused; Windows notifications must also be allowed for the app (Settings → Notifications) |

## Notes

- All prompts run with `--allowedTools Bash,Write,Read,Edit` in the context of the currently active vault folder.
- `history.json`, `stats.json`, `dist/` (Vite build output), and `release/` (electron-builder output) are generated locally and aren't part of the repo.
- `config.json` only contains local paths, no secrets — safe to commit, though multiple users of the repo may want to override paths individually.
- If an automatic sync (interval or startup) runs while you're continuing a chat with `--continue`, the sync run counts as the "most recent conversation" for the Claude CLI. A chat message sent afterward will then follow on from the sync's context instead of your actual conversation — "New Chat" or waiting for the sync to finish helps in that case.
- **Closing the window no longer quits the app** — the X button just minimizes to the tray (the icon in the taskbar's notification area) so auto-sync can keep running in the background. Actually quitting only works via "Quit" in the tray menu (right-click the icon).
- Drag-and-drop in the vault resolves files via `webUtils.getPathForFile()` (not the older `File.path`, which newer Electron versions removed for security reasons).
- **"Diff preview" is a review afterward, not a preview beforehand**: after a sidebar action, the app automatically shows `git diff` of the vault's uncommitted changes (if the vault is a git repo). A true dry run before execution isn't possible with `claude -p`, since the CLI offers no such mode — roll back manually via `git checkout` if needed.
- Deleted vault files land in `.trash/wiki/` or `.trash/raw-sources/` instead of being permanently deleted (recoverable via the "Trash" tab). In a git repo this shows up as a normal file change — if unwanted, add `.trash/` to the **vault's** `.gitignore` (not this repo's).
- **Multi-language support** covers the entire app UI (Settings → Language). Not translated are the four pre-seeded sidebar actions and their prompt text themselves — those are your own, editable content, not fixed UI.
- **Image attachments in chat** work by handing Claude the file path, which it reads and analyzes via its built-in Read tool (a documented Claude Code capability) — no separate CLI image-upload flag is used, since `claude -p` doesn't offer one.

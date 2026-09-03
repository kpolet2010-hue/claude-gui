# Brain

Electron-Desktop-GUI für die lokal installierte [`claude` CLI](https://docs.claude.com/claude-code), zugeschnitten auf die Arbeit mit einem oder mehreren persönlichen Obsidian-Vaults.

## Was ist ein "Vault"?

Ein Vault ist ein persönlicher Obsidian-Ordner — die eigentliche Wissensbasis, mit der die App arbeitet. Vaults liegen komplett außerhalb dieses Repos (verwaltet in `config.json`, editierbar über die Einstellungen-Ansicht) und werden nie mit hochgeladen.

Innerhalb eines Vaults erwartet die App zwei Unterordner:

- **`raw-sources/`** — rohes, unstrukturiertes Ausgangsmaterial (Notizen, Artikel, Transkripte, etc.), das du dort ablegst
- **`wiki/`** — die daraus von Claude aufbereiteten, verlinkten Themen-Dateien (`.md`), die die App unter "Vault" anzeigt und die als eigentliche Wissensdatenbank dienen

Jeder Klick auf eine Aktion (z. B. "Wiki neu bauen") startet `claude` mit `cwd` = dem aktiven Vault-Ordner. Claude liest also direkt aus `raw-sources/`, schreibt/aktualisiert Dateien in `wiki/` und pflegt eine `log.md` mit, welche Quellen bereits verarbeitet wurden. Die App selbst verändert keine Vault-Inhalte über Dateizugriffe — sie schickt nur Prompts an Claude und zeigt Ergebnisse/Dateien lesend an.

## Features

- **Chat** — Prompts an `claude` senden, Antworten werden live gestreamt und als Markdown gerendert; Folgenachrichten laufen über `claude --continue`, damit der Kontext erhalten bleibt. "Neuer Chat" startet eine frische Session, ein Stopp-Button bricht einen laufenden Prompt ab. Der Verlauf wird lokal in `history.json` gespeichert und beim nächsten Start wiederhergestellt.
- **Aktionen** — vordefinierte Prompts, um den Vault zu pflegen:
  - Wiki aus `/raw-sources/` neu aufbauen
  - Nur neue/geänderte Sources einarbeiten
  - Ein bestehendes Thema erweitern
  - Im Vault suchen ("Brain-Suche")
- **Usage** — Session- und Wochenlimit von Claude Code auf einen Blick (`/usage`)
- **Vault** — Übersicht über vorhandene Wiki-Themen und Rohquellen; Klick auf einen Eintrag öffnet den Dateiinhalt (Markdown gerendert bei `.md`)
- **Verlauf** — bisherige Claude-Code-Sessions im aktiven Vault durchstöbern
- **Einstellungen** — mehrere Vaults anlegen/bearbeiten/löschen und den aktiven Vault wechseln (inkl. Ordner-Dialog), sowie automatisches Sync konfigurieren:
  - beim App-Start automatisch "Neue Sources" ausführen
  - und/oder in einem festen Intervall (Minuten) im Hintergrund

Laufende Prompts geben stderr-Ausgaben als eigene, farblich abgesetzte Fehler-Bubbles im Chat aus, statt sie stillschweigend im Output zu verstecken.

## Voraussetzungen

- [Claude Code CLI](https://docs.claude.com/claude-code) installiert und im `PATH` (`claude` muss aus dem Terminal aufrufbar sein)
- Node.js
- Mindestens ein Obsidian-Vault (oder ein beliebiger Ordner) mit `wiki/` und `raw-sources/` Unterordnern

## Setup

```bash
npm install
```

`config.json` wird beim ersten Start automatisch angelegt (Default-Vault `C:\Obsidian\my-knowledge-base`). Vaults lassen sich danach bequem über die **Einstellungen**-Ansicht in der App verwalten — manuelles Editieren der Datei ist nicht mehr nötig. Ein bereits vorhandenes altes `config.json` im Format `{ "vaultPath": "..." }` wird beim Start automatisch ins neue Multi-Vault-Format migriert.

## Start

```bash
npm start
```

Baut das React-Frontend mit Vite und startet danach Electron.

Für die Entwicklung am UI allein (im Browser, ohne Electron) steht außerdem `npm run dev` bereit — startet den Vite-Dev-Server mit Hot Reload, allerdings ohne `window.claudeAPI` (die kommt nur aus dem Electron-Preload).

## Installer bauen

```bash
npm run dist
```

Baut das Frontend und packt die App via `electron-builder` zu einer Windows-Installer-`.exe` in `release/`.

> **Hinweis für Windows:** `electron-builder` lädt für die Codesignatur-Tools ein Archiv herunter, dessen Entpacken symbolische Links anlegt. Ohne aktivierten **Entwicklermodus** (Einstellungen → Datenschutz & Sicherheit → Für Entwickler) oder ohne Terminal **"Als Administrator ausführen"** schlägt das mit `Cannot create symbolic link` fehl — einmal aktivieren, dann läuft's.

## Tech Stack

- **Electron** — Desktop-Shell, Main-Prozess in `main.js`, IPC-Bridge in `preload.js`
- **React (JSX)** — komplettes UI in `src/` (`App.jsx` + `src/components/`), gebaut mit **Vite**
- **cross-spawn** — startet `claude`/`git` ohne Shell-Interpolation (verhindert Command-Injection über den Prompt-Text)
- **react-markdown** — Rendering von Claude-Antworten und Wiki-Dateien
- Kein TypeScript — reines JSX

## Hinweise

- Alle Prompts laufen mit `--allowedTools Bash,Write,Read,Edit` im Kontext des jeweils aktiven Vault-Ordners.
- `history.json`, `stats.json`, `dist/` (Vite-Build-Output) und `release/` (electron-builder-Output) werden lokal erzeugt und sind nicht Teil des Repos.
- `config.json` enthält nur lokale Pfade, keine Secrets — kann bedenkenlos mitcommittet werden, sollte aber bei mehreren Nutzern des Repos ggf. individuelle Pfade überschreiben.
- Läuft ein automatischer Sync (Intervall oder Start), während du gerade einen Chat mit `--continue` fortführst, zählt der Sync-Lauf für die Claude-CLI als "letzte Konversation". Eine danach gesendete Chat-Nachricht knüpft dann an den Sync-Kontext statt an dein eigentliches Gespräch an — in dem Fall hilft "Neuer Chat" oder kurz warten, bis der Sync durch ist.

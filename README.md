# Brain

Electron-Desktop-GUI für die lokal installierte [`claude` CLI](https://docs.claude.com/claude-code), zugeschnitten auf die Arbeit mit einem oder mehreren persönlichen Obsidian-Vaults.

## Inhalt

- [Was ist ein "Vault"?](#was-ist-ein-vault)
- [Features](#features)
- [Tastenkürzel](#tastenkürzel)
- [Voraussetzungen](#voraussetzungen)
- [Setup](#setup)
- [Start](#start)
- [Installer bauen](#installer-bauen)
- [Tech Stack](#tech-stack)
- [`config.json`-Referenz](#configjson-referenz)
- [Troubleshooting](#troubleshooting)
- [Hinweise](#hinweise)

## Was ist ein "Vault"?

Ein Vault ist ein persönlicher Obsidian-Ordner — die eigentliche Wissensbasis, mit der die App arbeitet. Vaults liegen komplett außerhalb dieses Repos (verwaltet in `config.json`, editierbar über die Einstellungen-Ansicht) und werden nie mit hochgeladen.

Innerhalb eines Vaults erwartet die App zwei Unterordner:

- **`raw-sources/`** — rohes, unstrukturiertes Ausgangsmaterial (Notizen, Artikel, Transkripte, etc.), das du dort ablegst
- **`wiki/`** — die daraus von Claude aufbereiteten, verlinkten Themen-Dateien (`.md`), die die App unter "Vault" anzeigt und die als eigentliche Wissensdatenbank dienen

Jeder Klick auf eine Aktion (z. B. "Wiki neu bauen") startet `claude` mit `cwd` = dem aktiven Vault-Ordner. Claude liest also direkt aus `raw-sources/`, schreibt/aktualisiert Dateien in `wiki/` und pflegt eine `log.md` mit, welche Quellen bereits verarbeitet wurden. Die App selbst verändert keine Vault-Inhalte über Dateizugriffe — sie schickt nur Prompts an Claude und zeigt Ergebnisse/Dateien lesend an.

## Features

- **Chat** — Prompts an `claude` senden, Antworten werden live gestreamt und als Markdown gerendert; Folgenachrichten laufen über `claude --continue`, damit der Kontext erhalten bleibt. "Neuer Chat" startet eine frische Session, ein Stopp-Button bricht einen laufenden Prompt ab. Der Verlauf wird lokal in `history.json` gespeichert und beim nächsten Start wiederhergestellt.
  - **Prompt-Verlauf**: Pfeil-hoch/-runter im Eingabefeld blättert durch zuletzt gesendete Prompts (pro Gerät in `localStorage`)
  - **"Nach unten springen"**-Button erscheint, wenn man beim Streamen hochgescrollt hat
  - **Copy-Button** auf jeder Chat-Bubble kopiert den Text in die Zwischenablage
  - **@-Mentions**: `@dateiname` im Prompt tippen öffnet eine Auswahl aus Vault-Dateien; der Inhalt wird beim Senden automatisch als Kontext angehängt (im Chat bleibt nur `@dateiname` sichtbar)
  - **Exportieren**-Button speichert den aktuellen Chat als Markdown-Datei
  - **Presets**: dem Prompt fest vorangestellter Kontext (z. B. Sprache/Ton), verwaltbar unter Einstellungen → Chat-Presets, auswählbar per Dropdown im Chat
- **Aktionen** — frei konfigurierbare Prompt-Buttons in der Sidebar (Verwaltung unter Einstellungen → Aktionen), vorbelegt mit vier Beispielen: Wiki neu bauen, Neue Sources einarbeiten, Thema erweitern, Brain-Suche. Ein Prompt mit `{input}` fragt beim Klick per Dialog nach einem Wert. Nach jeder Aktion wird automatisch geprüft, ob sich im Vault etwas geändert hat (`git diff`) und als Review-Dialog angezeigt.
- **Command Palette** (Strg+P) — Schnellsuche über alle Ansichten und Aktionen
- **Usage** — Session- und Wochenlimit von Claude Code auf einen Blick (`/usage`)
- **Vault** — Übersicht über vorhandene Wiki-Themen und Rohquellen, mit Datei- und Volltextsuche (Strg+K); Klick auf einen Eintrag öffnet den Dateiinhalt (Markdown gerendert bei `.md`) mit Umbenennen/Löschen. Dateien lassen sich per Drag & Drop auf die Rohquellen-Spalte direkt importieren. Weitere Tabs:
  - **Graph** — visualisiert die `[[topic-name]]`-Verlinkungen zwischen Wiki-Dateien
  - **Git-Verlauf** — Commit-Liste inkl. Diff-Ansicht pro Commit
  - **Papierkorb** — gelöschte Dateien wiederherstellen oder endgültig entfernen
- **Verlauf** — bisherige Claude-Code-Sessions im aktiven Vault durchstöbern, inkl. Volltextsuche über den Gesprächsinhalt und Export einer Session als Markdown
- **Einstellungen** — mehrere Vaults anlegen/bearbeiten/löschen und den aktiven Vault wechseln (inkl. Ordner-Dialog), Design-Theme und Claude-Modell wählen, Sidebar-Aktionen und Chat-Presets verwalten, automatisches Sync konfigurieren, Einstellungen als JSON sichern/wiederherstellen, und nach Updates suchen:
  - beim App-Start automatisch "Neue Sources" ausführen
  - und/oder in einem festen Intervall (Minuten) im Hintergrund
- **Themes** — vier Farbschemata zur Auswahl (Sunset, Midnight, Forest, Light), gespeichert in `config.json` und beim nächsten Start automatisch wieder aktiv
- **Tray-Icon** — die App läuft im Hintergrund weiter, wenn das Fenster geschlossen wird (siehe Hinweis unten); über das Tray-Menü lässt sich "Neue Sources" auch ohne offenes Fenster anstoßen
- **Desktop-Benachrichtigungen** — wenn ein Prompt oder Auto-Sync fertig ist, während das Fenster nicht fokussiert ist
- **Onboarding** — beim allerersten Start (oder wenn der aktive Vault-Ordner nicht existiert) führt ein kurzer Dialog durch die Vault-Auswahl, statt stillschweigend mit einem Platzhalterpfad zu laufen
- **Tastenkürzel** — siehe [eigener Abschnitt](#tastenkürzel)

Laufende Prompts geben stderr-Ausgaben als eigene, farblich abgesetzte Fehler-Bubbles im Chat aus, statt sie stillschweigend im Output zu verstecken.

## Tastenkürzel

| Kürzel | Wirkung |
| --- | --- |
| `Strg+N` | Neuer Chat (springt zur Chat-Ansicht und leert sie) |
| `Strg+K` | Zur Vault-Ansicht springen und das Suchfeld fokussieren |
| `Strg+P` | Command Palette öffnen (Ansichten/Aktionen per Schnellsuche) |
| `Esc` | Offenes Modal schließen (Datei-Viewer, Git-Diff, Command Palette) |
| `↑` / `↓` im Chat-Eingabefeld | Durch zuletzt gesendete Prompts blättern |
| `Enter` im Chat-Eingabefeld | Prompt senden |

## Voraussetzungen

- [Claude Code CLI](https://docs.claude.com/claude-code) installiert und im `PATH` (`claude` muss aus dem Terminal aufrufbar sein)
- Node.js
- Mindestens ein Obsidian-Vault (oder ein beliebiger Ordner) mit `wiki/` und `raw-sources/` Unterordnern
- `git` optional, aber nötig für den Home-Graph (Commit-Aktivität) und den Git-Verlauf-Tab im Vault — ohne Git-Repo im Vault bleiben diese beiden einfach leer

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

## `config.json`-Referenz

Wird automatisch angelegt und migriert — manuelles Bearbeiten ist normalerweise nicht nötig (alles läuft über die Einstellungen-Ansicht), aber zum Nachschlagen:

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
    { "id": "...", "label": "Englisch, knapp", "systemPrompt": "Reply in English, be concise." }
  ]
}
```

| Feld | Bedeutung |
| --- | --- |
| `vaults` | Liste aller angelegten Vaults (`name` + `path`) |
| `activeVault` | Name des gerade aktiven Vaults aus `vaults` |
| `theme` | `sunset` \| `midnight` \| `forest` \| `light` |
| `model` | Leer = CLI-Standard, sonst `sonnet` \| `opus` \| `haiku` (als `--model`-Flag an `claude` durchgereicht) |
| `autoSync.enabled` / `.intervalMinutes` | Automatisches "Neue Sources" in festem Intervall |
| `autoSync.runOnStartup` | Automatisches "Neue Sources" beim App-Start (einmalig) |
| `customActions` | Sidebar-Buttons; `prompt` darf `{input}` enthalten für eine Dialog-Abfrage beim Klick |
| `chatPresets` | Im Chat wählbare Kontext-Vorlagen; `systemPrompt` wird jedem gesendeten Prompt vorangestellt |

## Troubleshooting

| Problem | Ursache / Lösung |
| --- | --- |
| Chat bleibt bei "Läuft..." hängen, keine Antwort | `claude` ist nicht im `PATH` — im normalen Terminal prüfen, ob `claude -p "hi"` funktioniert |
| `Cannot create symbolic link` bei `npm run dist` | Windows-Entwicklermodus nicht aktiviert oder Terminal nicht als Administrator gestartet (siehe [Installer bauen](#installer-bauen)) |
| Home-Graph / Git-Verlauf im Vault bleiben leer | Der Vault-Ordner ist kein Git-Repository, oder `git` ist nicht installiert — beides ist optional, kein Fehler |
| Fenster verschwindet beim Klick auf X | Kein Bug — die App läuft im Tray weiter (siehe [Hinweise](#hinweise)). Rechtsklick auf das Tray-Icon → "Beenden" für echtes Schließen |
| Onboarding-Dialog erscheint bei jedem Start erneut | Der eingetragene Vault-Pfad existiert nicht (mehr) auf der Festplatte — Ordner im Dialog neu auswählen |
| Keine Desktop-Benachrichtigungen | Nur wenn das Fenster nicht fokussiert ist; zusätzlich müssen Windows-Benachrichtigungen für die App erlaubt sein (Einstellungen → Benachrichtigungen) |

## Hinweise

- Alle Prompts laufen mit `--allowedTools Bash,Write,Read,Edit` im Kontext des jeweils aktiven Vault-Ordners.
- `history.json`, `stats.json`, `dist/` (Vite-Build-Output) und `release/` (electron-builder-Output) werden lokal erzeugt und sind nicht Teil des Repos.
- `config.json` enthält nur lokale Pfade, keine Secrets — kann bedenkenlos mitcommittet werden, sollte aber bei mehreren Nutzern des Repos ggf. individuelle Pfade überschreiben.
- Läuft ein automatischer Sync (Intervall oder Start), während du gerade einen Chat mit `--continue` fortführst, zählt der Sync-Lauf für die Claude-CLI als "letzte Konversation". Eine danach gesendete Chat-Nachricht knüpft dann an den Sync-Kontext statt an dein eigentliches Gespräch an — in dem Fall hilft "Neuer Chat" oder kurz warten, bis der Sync durch ist.
- **Fenster schließen beendet die App nicht mehr** — das X-Symbol minimiert nur ins Tray (Symbol im Infobereich der Taskleiste), damit Auto-Sync im Hintergrund weiterlaufen kann. Echtes Beenden geht nur über "Beenden" im Tray-Menü (Rechtsklick auf das Icon).
- Beim Drag & Drop im Vault werden Dateien per `webUtils.getPathForFile()` aufgelöst (nicht mehr über das ältere `File.path`, das neuere Electron-Versionen aus Sicherheitsgründen entfernt haben).
- **"Diff-Vorschau" ist ein Review danach, keine Vorschau davor**: Nach einer Sidebar-Aktion zeigt die App automatisch `git diff` der noch nicht committeten Änderungen im Vault (falls der Vault ein Git-Repo ist). Ein echter Dry-Run vor der Ausführung ist mit `claude -p` nicht möglich, da die CLI keinen entsprechenden Modus anbietet — im Zweifel per `git checkout` manuell zurückrollen.
- Gelöschte Vault-Dateien landen in `.trash/wiki/` bzw. `.trash/raw-sources/` statt endgültig gelöscht zu werden (wiederherstellbar über den "Papierkorb"-Tab). In einem Git-Repo taucht das als normale Dateiänderung auf — falls unerwünscht, `.trash/` zur `.gitignore` **des Vaults** (nicht dieses Repos) hinzufügen.

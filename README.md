# Brain

Electron-Desktop-GUI für die lokal installierte [`claude` CLI](https://docs.claude.com/claude-code), zugeschnitten auf die Arbeit mit einem persönlichen Obsidian-Vault.

## Was ist der "Vault"?

Der Vault ist dein persönlicher Obsidian-Ordner — die eigentliche Wissensbasis, mit der die App arbeitet. Er liegt komplett außerhalb dieses Repos (Pfad wird in `config.json` gesetzt) und wird nie mit hochgeladen.

Innerhalb des Vaults erwartet die App zwei Unterordner:

- **`raw-sources/`** — rohes, unstrukturiertes Ausgangsmaterial (Notizen, Artikel, Transkripte, etc.), das du dort ablegst
- **`wiki/`** — die daraus von Claude aufbereiteten, verlinkten Themen-Dateien (`.md`), die die App unter "Vault" anzeigt und die als eigentliche Wissensdatenbank dienen

Jeder Klick auf eine Aktion (z. B. "Wiki neu bauen") startet `claude` mit `cwd` = dein Vault-Ordner. Claude liest also direkt aus `raw-sources/`, schreibt/aktualisiert Dateien in `wiki/` und pflegt eine `log.md` mit, welche Quellen bereits verarbeitet wurden. Die App selbst speichert oder verändert keine Vault-Inhalte — sie schickt nur Prompts an Claude und zeigt Ergebnisse an.

Die Ansicht "Vault" in der Sidebar liest lediglich `wiki/` und `raw-sources/` aus und zeigt Dateianzahl sowie letzte Änderungsdaten an — rein zur Übersicht, ohne Inhalte zu bearbeiten.

## Features

- **Chat** — direkte Prompts an `claude` senden, Antworten werden live gestreamt
- **Aktionen** — vordefinierte Prompts, um den Vault zu pflegen:
  - Wiki aus `/raw-sources/` neu aufbauen
  - Nur neue/geänderte Sources einarbeiten
  - Ein bestehendes Thema erweitern
  - Im Vault suchen ("Brain-Suche")
- **Usage** — Session- und Wochenlimit von Claude Code auf einen Blick (`/usage`)
- **Vault** — Übersicht über vorhandene Wiki-Themen und Rohquellen
- **Verlauf** — bisherige Claude-Code-Sessions im Vault durchstöbern

## Voraussetzungen

- [Claude Code CLI](https://docs.claude.com/claude-code) installiert und im `PATH` (`claude` muss aus dem Terminal aufrufbar sein)
- Node.js
- Ein Obsidian-Vault (oder ein beliebiger Ordner) mit `wiki/` und `raw-sources/` Unterordnern

## Setup

```bash
npm install
```

In `config.json` den Pfad zum eigenen Vault eintragen:

```json
{
  "vaultPath": "C:\\Pfad\\zu\\deinem\\vault"
}
```

## Start

```bash
npm start
```

## Hinweise

- Alle Prompts laufen mit `--allowedTools Bash,Write,Read,Edit` im Kontext des konfigurierten Vault-Ordners.
- `history.json` und `stats.json` werden lokal zur Laufzeit erzeugt und sind nicht Teil des Repos.

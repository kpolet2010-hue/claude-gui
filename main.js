const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const crossSpawn = require('cross-spawn');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');


app.setName('Brain');


let CONFIG_PATH;
let HISTORY_PATH;
let STATS_PATH;
const ICON_PATH = path.join(__dirname, 'icon.png');

function migrateLegacyDataFiles(userDataDir) {
  for (const name of ['config.json', 'history.json', 'stats.json']) {
    const legacyPath = path.join(__dirname, name);
    const newPath = path.join(userDataDir, name);
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      try {
        fs.copyFileSync(legacyPath, newPath);
      } catch {
        // ignore errors, e.g. if the legacy file is locked by another process
      }
    }
  }
}

function initDataPaths() {
  const userDataDir = app.getPath('userData');
  migrateLegacyDataFiles(userDataDir);
  CONFIG_PATH = path.join(userDataDir, 'config.json');
  HISTORY_PATH = path.join(userDataDir, 'history.json');
  STATS_PATH = path.join(userDataDir, 'stats.json');
}

const DEFAULT_ACTIONS = [
  {
    id: 'wiki-rebuild',
    label: 'Wiki neu bauen',
    prompt:
      'Read all files in /raw-sources/. Compile a wiki in /wiki/ following the rules in CLAUDE.md. Create an index.md first, then one .md file per major topic. Link related topics using [[topic-name]] format. Summarize every source. Log everything to log.md.',
  },
  {
    id: 'new-sources',
    label: 'Neue Sources',
    prompt:
      'Read all files in /raw-sources/. Compare against the existing wiki in /wiki/ and log.md to identify which files or content are new or changed since the last run. For each new or changed piece: summarize it and integrate it into the appropriate existing topic file in /wiki/, or create a new topic file if none fits. Update index.md if new topics were added. Link related topics using [[topic-name]] format. Append a log entry to log.md for each new source processed — do not overwrite existing log entries.',
  },
  {
    id: 'expand-topic',
    label: 'Thema erweitern',
    prompt:
      'Research {input}. Find good sources yourself rather than asking me. Create or expand topic files in /wiki/ covering this, written clearly with code examples where relevant. Link related topics using [[topic-name]] format. Update index.md if new topics are added. Log what was added to log.md. Keep this efficient — avoid excessive tool calls or token usage.',
  },
  {
    id: 'brain-search',
    label: 'Brain-Suche',
    prompt:
      'Search /wiki/ and /raw-sources/ for information relevant to: {input}. If you find a clear answer there, use it and cite which file it came from. Only if nothing relevant is found, search the web for an answer. Keep the answer concise.',
  },
];

function defaultConfig() {
  return {
    vaults: [{ name: 'Default', path: 'C:\\Obsidian\\my-knowledge-base' }],
    activeVault: 'Default',
    autoSync: { enabled: false, intervalMinutes: 60, runOnStartup: false },
    theme: 'sunset',
    model: '',
    customActions: DEFAULT_ACTIONS,
    chatPresets: [],
    language: 'en',
    pins: { wiki: [], sources: [], sessions: [] },
    userName: '',
  };
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const config = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return config;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  if (raw.vaultPath && !raw.vaults) {
    const migrated = {
      vaults: [{ name: 'Default', path: raw.vaultPath }],
      activeVault: 'Default',
      autoSync: { ...defaultConfig().autoSync, ...(raw.autoSync || {}) },
      theme: raw.theme || defaultConfig().theme,
      model: raw.model || '',
      customActions: raw.customActions || DEFAULT_ACTIONS,
      chatPresets: raw.chatPresets || [],
      language: raw.language || 'en',
      pins: raw.pins || { wiki: [], sources: [], sessions: [] },
      userName: raw.userName || '',
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(migrated, null, 2));
    return migrated;
  }

  return {
    vaults: raw.vaults && raw.vaults.length ? raw.vaults : defaultConfig().vaults,
    activeVault: raw.activeVault || raw.vaults?.[0]?.name || 'Default',
    autoSync: { ...defaultConfig().autoSync, ...(raw.autoSync || {}) },
    theme: raw.theme || defaultConfig().theme,
    model: raw.model || '',
    customActions: raw.customActions && raw.customActions.length ? raw.customActions : DEFAULT_ACTIONS,
    chatPresets: raw.chatPresets || [],
    language: raw.language || 'en',
    pins: raw.pins || { wiki: [], sources: [], sessions: [] },
    userName: raw.userName || '',
  };
}

let configState;

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(configState, null, 2));
}

function findVault(name) {
  return configState.vaults.find((v) => v.name === name);
}

function getActiveVault() {
  return findVault(configState.activeVault) || configState.vaults[0];
}

ipcMain.handle('save-history', async (event, messages) => {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(messages, null, 2));
});

ipcMain.handle('load-history', async () => {
  if (fs.existsSync(HISTORY_PATH)) {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  }
  return [];
});

let mainWindow = null;
let tray = null;

function createWindow() {
  const startHidden = process.argv.includes('--hidden');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: ICON_PATH,
    show: !startHidden,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Removing the app menu (below) also removes its default DevTools accelerator, so rebind it.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (configState.autoSync.runOnStartup) {
    mainWindow.webContents.once('did-finish-load', () => runAutoSync());
  }
}

const MAIN_STRINGS = {
  en: {
    trayOpen: 'Open',
    trayRunNewSources: 'Run New Sources now',
    trayQuit: 'Quit',
    notifyResponseDone: 'Claude finished the response.',
    notifyAutoSyncDone: 'Automatic sync is done.',
  },
  de: {
    trayOpen: 'Öffnen',
    trayRunNewSources: 'Neue Sources jetzt ausführen',
    trayQuit: 'Beenden',
    notifyResponseDone: 'Claude ist mit der Antwort fertig.',
    notifyAutoSyncDone: 'Automatisches Sync ist fertig.',
  },
};

function ms(key) {
  const lang = configState?.language || 'en';
  return (MAIN_STRINGS[lang] || MAIN_STRINGS.en)[key];
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: ms('trayOpen'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { label: ms('trayRunNewSources'), click: () => runAutoSync() },
    { type: 'separator' },
    {
      label: ms('trayQuit'),
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  tray = new Tray(ICON_PATH);
  tray.setToolTip('Brain');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' });
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', { status: 'error', message: err.message });
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 5000);
}

ipcMain.handle('check-for-app-updates', async () => {
  if (!app.isPackaged) return { status: 'dev-mode' };
  autoUpdater.checkForUpdates();
  return { status: 'checking' };
});

ipcMain.handle('install-update', async () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-auto-launch', async () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('set-auto-launch', async (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: enabled ? ['--hidden'] : [],
  });
  return enabled;
});

app.whenReady().then(() => {
  initDataPaths();
  configState = loadConfig();
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  scheduleAutoSync();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function notifyIfUnfocused(title, body) {
  if (mainWindow && !mainWindow.isFocused() && Notification.isSupported()) {
    const note = new Notification({ title, body, icon: ICON_PATH });
    note.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
    note.show();
  }
}

let currentProc = null;

function withModel(args) {
  return configState.model ? [...args, '--model', configState.model] : args;
}

function spawnClaude(args, cwd, { onStdout, onStderr } = {}) {
  return new Promise((resolve) => {
    const proc = crossSpawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    currentProc = proc;
    let output = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (onStdout) onStdout(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (onStderr) onStderr(text);
    });

    proc.on('close', () => {
      if (currentProc === proc) currentProc = null;
      resolve(output);
    });

    proc.on('error', (err) => {
      if (currentProc === proc) currentProc = null;
      const message = `\n[Fehler beim Ausführen von claude: ${err.message}]\n`;
      if (onStderr) onStderr(message);
      resolve(output + message);
    });
  });
}

function runGit(args, cwd) {
  return new Promise((resolve) => {
    const proc = crossSpawn('git', args, { cwd });
    let output = '';
    proc.stdout.on('data', (d) => (output += d.toString()));
    proc.stderr.on('data', () => {});
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}

function logUsageEvent() {
  let stats = {};
  if (fs.existsSync(STATS_PATH)) {
    stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  }
  const today = new Date().toISOString().split('T')[0];
  stats[today] = (stats[today] || 0) + 1;
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

ipcMain.handle('run-claude', async (event, prompt, continueConversation) => {
  logUsageEvent();
  const vault = getActiveVault();
  let args = ['-p', prompt, '--allowedTools', 'Bash,Write,Read,Edit'];
  if (continueConversation) args.push('--continue');
  args = withModel(args);

  const result = await spawnClaude(args, vault.path, {
    onStdout: (text) => event.sender.send('claude-stream', text),
    onStderr: (text) => event.sender.send('claude-stream-error', text),
  });
  notifyIfUnfocused('Brain', ms('notifyResponseDone'));
  return result;
});

ipcMain.handle('stop-claude', async () => {
  if (currentProc) {
    currentProc.kill();
    return true;
  }
  return false;
});

ipcMain.handle('get-usage', async () => {
  const vault = getActiveVault();
  return spawnClaude(['-p', '/usage'], vault.path);
});

ipcMain.handle('get-prompt-stats', async () => {
  if (fs.existsSync(STATS_PATH)) {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  }
  return {};
});

function claudeProjectDirName(dirPath) {
  return dirPath.replace(/:\\/g, '--').replace(/\\/g, '-');
}

function sessionsDirFor(vaultPath) {
  return path.join(os.homedir(), '.claude', 'projects', claudeProjectDirName(vaultPath));
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function readFirstChunk(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    return buf.toString('utf-8', 0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

ipcMain.handle('list-sessions', async () => {
  const dir = sessionsDirFor(getActiveVault().path);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));

  const sessions = files.map((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    let title = null;
    let isLocalCommand = false;

    try {
      const chunk = readFirstChunk(full, 8192);
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (entry.type === 'ai-title' && entry.aiTitle) {
          title = entry.aiTitle;
          break;
        }
        if (!title && entry.type === 'user' && !entry.isSidechain && entry.message) {
          const text = extractText(entry.message.content);
          if (text) {
            if (text.startsWith('<local-command-caveat')) {
              isLocalCommand = true;
              break;
            }
            title = text.slice(0, 80);
          }
        }
      }
    } catch {
      // leave title as fallback below
    }

    if (isLocalCommand) return null;

    return {
      id: path.basename(file, '.jsonl'),
      title: title || 'Unbenannter Chat',
      mtime: stat.mtime.toISOString(),
    };
  });

  return sessions.filter(Boolean).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
});

ipcMain.handle('get-session', async (event, sessionId) => {
  const safeId = path.basename(String(sessionId || ''));
  const full = path.join(sessionsDirFor(getActiveVault().path), `${safeId}.jsonl`);
  if (!fs.existsSync(full)) return [];

  const lines = fs.readFileSync(full, 'utf-8').split('\n');
  const messages = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.isSidechain) continue;
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    if (!entry.message) continue;

    const text = extractText(entry.message.content);
    if (!text) continue;

    messages.push({ role: entry.message.role, text, timestamp: entry.timestamp });
  }

  return messages;
});

ipcMain.handle('get-vault', async () => {
  const vaultPath = getActiveVault().path;

  function listDir(dir) {
    try {
      return fs
        .readdirSync(dir)
        .filter((name) => !name.startsWith('.'))
        .map((name) => {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          return { name, mtime: stat.mtime.toISOString(), isFile: stat.isFile() };
        })
        .filter((entry) => entry.isFile)
        .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    } catch {
      return [];
    }
  }

  return {
    wiki: listDir(path.join(vaultPath, 'wiki')),
    sources: listDir(path.join(vaultPath, 'raw-sources')),
  };
});

function vaultFilePath(type, name) {
  const vaultPath = getActiveVault().path;
  const subfolder = type === 'wiki' ? 'wiki' : 'raw-sources';
  const safeName = path.basename(String(name || ''));
  return path.join(vaultPath, subfolder, safeName);
}

ipcMain.handle('get-vault-file', async (event, { type, name }) => {
  const full = vaultFilePath(type, name);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf-8');
});

ipcMain.handle('rename-vault-file', async (event, { type, oldName, newName }) => {
  const oldFull = vaultFilePath(type, oldName);
  const newFull = vaultFilePath(type, newName);
  if (!fs.existsSync(oldFull)) throw new Error('Datei nicht gefunden.');
  if (fs.existsSync(newFull)) throw new Error('Es existiert bereits eine Datei mit diesem Namen.');
  fs.renameSync(oldFull, newFull);
});

function trashDirFor(type) {
  return path.join(getActiveVault().path, '.trash', type === 'wiki' ? 'wiki' : 'raw-sources');
}

ipcMain.handle('delete-vault-file', async (event, { type, name }) => {
  const full = vaultFilePath(type, name);
  if (!fs.existsSync(full)) return;
  const trashDir = trashDirFor(type);
  if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
  const safeName = path.basename(String(name || ''));
  let dest = path.join(trashDir, safeName);
  if (fs.existsSync(dest)) dest = path.join(trashDir, `${Date.now()}-${safeName}`);
  fs.renameSync(full, dest);
});

ipcMain.handle('list-trash', async () => {
  function listDir(dir) {
    try {
      return fs
        .readdirSync(dir)
        .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtime.toISOString() }))
        .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    } catch {
      return [];
    }
  }
  return { wiki: listDir(trashDirFor('wiki')), sources: listDir(trashDirFor('sources')) };
});

ipcMain.handle('restore-vault-file', async (event, { type, name }) => {
  const src = path.join(trashDirFor(type), path.basename(String(name || '')));
  if (!fs.existsSync(src)) throw new Error('Datei nicht im Papierkorb gefunden.');
  const destDir = path.join(getActiveVault().path, type === 'wiki' ? 'wiki' : 'raw-sources');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(String(name || '')));
  if (fs.existsSync(dest)) throw new Error('Es existiert bereits eine Datei mit diesem Namen im Vault.');
  fs.renameSync(src, dest);
});

ipcMain.handle('empty-trash', async () => {
  const dir = path.join(getActiveVault().path, '.trash');
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
});

function searchDir(dir, query, results, type) {
  if (!fs.existsSync(dir)) return;
  const q = query.toLowerCase();
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    try {
      const content = fs.readFileSync(full, 'utf-8');
      const idx = content.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 60);
        const snippet = content.slice(start, idx + q.length + 60).replace(/\s+/g, ' ').trim();
        results.push({ type, name, snippet });
      }
    } catch {
      // skip unreadable/binary files
    }
  }
}

ipcMain.handle('search-vault', async (event, query) => {
  const results = [];
  if (query && query.trim()) {
    const vaultPath = getActiveVault().path;
    searchDir(path.join(vaultPath, 'wiki'), query, results, 'wiki');
    searchDir(path.join(vaultPath, 'raw-sources'), query, results, 'sources');
  }
  return results.slice(0, 50);
});

ipcMain.handle('search-sessions', async (event, query) => {
  const dir = sessionsDirFor(getActiveVault().path);
  if (!fs.existsSync(dir) || !query || !query.trim()) return [];
  const q = query.toLowerCase();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const results = [];

  for (const file of files) {
    const full = path.join(dir, file);
    let snippet = null;
    let title = null;
    try {
      const lines = fs.readFileSync(full, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (entry.isSidechain) continue;
        if (entry.type === 'ai-title' && entry.aiTitle && !title) title = entry.aiTitle;
        if (entry.type !== 'user' && entry.type !== 'assistant') continue;
        if (!entry.message) continue;
        const text = extractText(entry.message.content);
        if (!text) continue;
        if (!title && entry.type === 'user' && !text.startsWith('<local-command-caveat')) title = text.slice(0, 80);
        if (!snippet && text.toLowerCase().includes(q)) {
          const idx = text.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 50);
          snippet = text.slice(start, idx + q.length + 50).replace(/\s+/g, ' ').trim();
        }
      }
    } catch {
      continue;
    }
    if (snippet) {
      const stat = fs.statSync(full);
      results.push({
        id: path.basename(file, '.jsonl'),
        title: title || 'Unbenannter Chat',
        snippet,
        mtime: stat.mtime.toISOString(),
      });
    }
  }

  return results.sort((a, b) => new Date(b.mtime) - new Date(a.mtime)).slice(0, 50);
});

ipcMain.handle('get-wiki-graph', async () => {
  const wikiDir = path.join(getActiveVault().path, 'wiki');
  if (!fs.existsSync(wikiDir)) return { nodes: [], edges: [] };

  const files = fs.readdirSync(wikiDir).filter((f) => f.endsWith('.md'));
  const ids = files.map((f) => f.replace(/\.md$/, ''));
  const normalize = (s) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
  const idByNormalized = new Map(ids.map((id) => [normalize(id), id]));

  const edgesSet = new Set();
  for (const file of files) {
    const id = file.replace(/\.md$/, '');
    let content;
    try {
      content = fs.readFileSync(path.join(wikiDir, file), 'utf-8');
    } catch {
      continue;
    }
    for (const m of content.matchAll(/\[\[([^\]|]+)/g)) {
      const target = idByNormalized.get(normalize(m[1]));
      if (target && target !== id) {
        edgesSet.add([id, target].sort().join('::'));
      }
    }
  }

  const edges = [...edgesSet].map((key) => {
    const [source, target] = key.split('::');
    return { source, target };
  });

  return { nodes: ids.map((id) => ({ id })), edges };
});

ipcMain.handle('get-working-diff', async () => {
  return runGit(['diff'], getActiveVault().path);
});

ipcMain.handle('import-file', async (event, sourcePath) => {
  const destDir = path.join(getActiveVault().path, 'raw-sources');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, destPath);
});

ipcMain.handle('export-chat', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `chat-${new Date().toISOString().slice(0, 10)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('get-git-stats', async () => {
  const output = await runGit(
    ['log', '--since=7 days ago', '--date=short', '--pretty=format:%ad'],
    getActiveVault().path
  );
  const counts = {};
  output
    .split('\n')
    .filter(Boolean)
    .forEach((date) => {
      counts[date] = (counts[date] || 0) + 1;
    });
  return counts;
});

ipcMain.handle('get-git-log', async () => {
  const output = await runGit(['log', '-30', '--pretty=format:%h|%ad|%s', '--date=short'], getActiveVault().path);
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...rest] = line.split('|');
      return { hash, date, subject: rest.join('|') };
    });
});

ipcMain.handle('get-git-diff', async (event, hash) => {
  if (!/^[0-9a-f]{4,40}$/i.test(String(hash || ''))) return '';
  return runGit(['show', hash], getActiveVault().path);
});

ipcMain.handle('get-config', async () => ({
  ...configState,
  needsSetup: !fs.existsSync(getActiveVault().path),
}));

ipcMain.handle('add-vault', async (event, { name, path: vaultPath }) => {
  if (!name || !vaultPath) throw new Error('Name und Pfad sind erforderlich.');
  if (findVault(name)) throw new Error('Ein Vault mit diesem Namen existiert bereits.');
  configState.vaults.push({ name, path: vaultPath });
  saveConfig();
  return configState;
});

ipcMain.handle('update-vault', async (event, { originalName, name, path: vaultPath }) => {
  const vault = findVault(originalName);
  if (!vault) throw new Error('Vault nicht gefunden.');
  vault.name = name;
  vault.path = vaultPath;
  if (configState.activeVault === originalName) configState.activeVault = name;
  saveConfig();
  return configState;
});

ipcMain.handle('remove-vault', async (event, name) => {
  if (configState.vaults.length <= 1) throw new Error('Mindestens ein Vault muss bestehen bleiben.');
  configState.vaults = configState.vaults.filter((v) => v.name !== name);
  if (configState.activeVault === name) configState.activeVault = configState.vaults[0].name;
  saveConfig();
  return configState;
});

ipcMain.handle('set-active-vault', async (event, name) => {
  if (!findVault(name)) throw new Error('Vault nicht gefunden.');
  configState.activeVault = name;
  saveConfig();
  return configState;
});

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('set-theme', async (event, theme) => {
  configState.theme = theme;
  saveConfig();
  return configState;
});

ipcMain.handle('set-language', async (event, language) => {
  configState.language = language;
  saveConfig();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return configState;
});

ipcMain.handle('set-user-name', async (event, userName) => {
  configState.userName = userName;
  saveConfig();
  return configState;
});

ipcMain.handle('toggle-pin', async (event, { category, id }) => {
  if (!configState.pins) configState.pins = { wiki: [], sources: [], sessions: [] };
  const list = configState.pins[category] || (configState.pins[category] = []);
  const idx = list.indexOf(id);
  if (idx === -1) list.push(id);
  else list.splice(idx, 1);
  saveConfig();
  return configState.pins;
});

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('set-model', async (event, model) => {
  configState.model = model;
  saveConfig();
  return configState;
});

ipcMain.handle('add-action', async (event, { label, prompt }) => {
  configState.customActions.push({ id: crypto.randomUUID(), label, prompt });
  saveConfig();
  return configState;
});

ipcMain.handle('update-action', async (event, { id, label, prompt }) => {
  const action = configState.customActions.find((a) => a.id === id);
  if (!action) throw new Error('Aktion nicht gefunden.');
  action.label = label;
  action.prompt = prompt;
  saveConfig();
  return configState;
});

ipcMain.handle('remove-action', async (event, id) => {
  configState.customActions = configState.customActions.filter((a) => a.id !== id);
  saveConfig();
  return configState;
});

ipcMain.handle('add-preset', async (event, { label, systemPrompt }) => {
  configState.chatPresets.push({ id: crypto.randomUUID(), label, systemPrompt });
  saveConfig();
  return configState;
});

ipcMain.handle('update-preset', async (event, { id, label, systemPrompt }) => {
  const preset = configState.chatPresets.find((p) => p.id === id);
  if (!preset) throw new Error('Preset nicht gefunden.');
  preset.label = label;
  preset.systemPrompt = systemPrompt;
  saveConfig();
  return configState;
});

ipcMain.handle('remove-preset', async (event, id) => {
  configState.chatPresets = configState.chatPresets.filter((p) => p.id !== id);
  saveConfig();
  return configState;
});

ipcMain.handle('get-app-version', async () => app.getVersion());

ipcMain.handle('export-config', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'brain-config-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(configState, null, 2));
  return true;
});

ipcMain.handle('import-config', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
  if (!raw.vaults || !Array.isArray(raw.vaults) || !raw.vaults.length) {
    throw new Error('Ungültige Konfigurationsdatei.');
  }

  configState = {
    vaults: raw.vaults,
    activeVault: raw.activeVault || raw.vaults[0].name,
    autoSync: { ...defaultConfig().autoSync, ...(raw.autoSync || {}) },
    theme: raw.theme || defaultConfig().theme,
    model: raw.model || '',
    customActions: raw.customActions && raw.customActions.length ? raw.customActions : DEFAULT_ACTIONS,
    chatPresets: raw.chatPresets || [],
  };
  saveConfig();
  scheduleAutoSync();
  return { ...configState, needsSetup: !fs.existsSync(getActiveVault().path) };
});

let autoSyncInterval = null;

async function runAutoSync() {
  logUsageEvent();
  const vault = getActiveVault();
  mainWindow?.webContents.send('auto-sync-start');
  const newSourcesAction = configState.customActions.find((a) => a.id === 'new-sources');
  const promptText = newSourcesAction ? newSourcesAction.prompt : DEFAULT_ACTIONS[1].prompt;
  await spawnClaude(withModel(['-p', promptText, '--allowedTools', 'Bash,Write,Read,Edit']), vault.path, {
    onStdout: (text) => mainWindow?.webContents.send('claude-stream', text),
    onStderr: (text) => mainWindow?.webContents.send('claude-stream-error', text),
  });
  mainWindow?.webContents.send('auto-sync-end');
  notifyIfUnfocused('Brain', ms('notifyAutoSyncDone'));
}

function scheduleAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  const { enabled, intervalMinutes } = configState.autoSync;
  if (enabled && intervalMinutes > 0) {
    autoSyncInterval = setInterval(runAutoSync, intervalMinutes * 60 * 1000);
  }
}

ipcMain.handle('update-auto-sync', async (event, autoSync) => {
  configState.autoSync = { ...configState.autoSync, ...autoSync };
  saveConfig();
  scheduleAutoSync();
  return configState;
});

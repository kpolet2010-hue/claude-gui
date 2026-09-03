const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification } = require('electron');
const crossSpawn = require('cross-spawn');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const HISTORY_PATH = path.join(__dirname, 'history.json');
const STATS_PATH = path.join(__dirname, 'stats.json');
const ICON_PATH = path.join(__dirname, 'icon.png');

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
  };
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const config = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return config;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  // Migrate the old single-vault format { vaultPath } to the multi-vault format.
  if (raw.vaultPath && !raw.vaults) {
    const migrated = {
      vaults: [{ name: 'Default', path: raw.vaultPath }],
      activeVault: 'Default',
      autoSync: { ...defaultConfig().autoSync, ...(raw.autoSync || {}) },
      theme: raw.theme || defaultConfig().theme,
      model: raw.model || '',
      customActions: raw.customActions || DEFAULT_ACTIONS,
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
  };
}

let configState = loadConfig();

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
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

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

function createTray() {
  tray = new Tray(ICON_PATH);
  tray.setToolTip('Brain');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Öffnen',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { label: 'Neue Sources jetzt ausführen', click: () => runAutoSync() },
      { type: 'separator' },
      {
        label: 'Beenden',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  scheduleAutoSync();
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

// Tracks the currently running `claude` child process so it can be cancelled.
let currentProc = null;

function withModel(args) {
  return configState.model ? [...args, '--model', configState.model] : args;
}

function spawnClaude(args, cwd, { onStdout, onStderr } = {}) {
  return new Promise((resolve) => {
    const proc = crossSpawn('claude', args, { cwd });
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
  notifyIfUnfocused('Brain', 'Claude ist mit der Antwort fertig.');
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

ipcMain.handle('delete-vault-file', async (event, { type, name }) => {
  const full = vaultFilePath(type, name);
  if (fs.existsSync(full)) fs.unlinkSync(full);
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
  notifyIfUnfocused('Brain', 'Automatisches Sync ist fertig.');
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

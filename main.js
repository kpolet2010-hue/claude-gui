const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function getVaultPath() {
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return config.vaultPath;
  }
  return 'C:\\Obsidian\\my-knowledge-base';
}

const VAULT_PATH = getVaultPath();

const HISTORY_PATH = path.join(__dirname, 'history.json');

ipcMain.handle('save-history', async (event, messages) => {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(messages, null, 2));
});

ipcMain.handle('load-history', async () => {
  if (fs.existsSync(HISTORY_PATH)) {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  }
  return [];
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('run-claude', async (event, prompt) => {
  logUsageEvent(); 
  return new Promise((resolve, reject) => {
    const safePrompt = prompt.replace(/"/g, '\\"');

    const proc = spawn(
      `claude -p "${safePrompt}" --allowedTools Bash,Write,Read,Edit`,
      { cwd: VAULT_PATH, shell: true }
    );

    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
      event.sender.send('claude-stream', data.toString());
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => resolve(output));
    proc.on('error', (err) => reject(err));
  });
});

ipcMain.handle('get-usage', async () => {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      `claude -p "/usage"`,
      { cwd: VAULT_PATH, shell: true }
    );

    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => resolve(output));
    proc.on('error', (err) => reject(err));
  });
});

const STATS_PATH = path.join(__dirname, 'stats.json');

function logUsageEvent() {
  let stats = {};
  if (fs.existsSync(STATS_PATH)) {
    stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  }
  const today = new Date().toISOString().split('T')[0];
  stats[today] = (stats[today] || 0) + 1;
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

ipcMain.handle('get-prompt-stats', async () => {
  if (fs.existsSync(STATS_PATH)) {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  }
  return {};
});

function claudeProjectDirName(dirPath) {
  return dirPath.replace(/:\\/g, '--').replace(/\\/g, '-');
}

const CLAUDE_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'projects', claudeProjectDirName(VAULT_PATH));

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
  if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) return [];

  const files = fs.readdirSync(CLAUDE_SESSIONS_DIR).filter((f) => f.endsWith('.jsonl'));

  const sessions = files.map((file) => {
    const full = path.join(CLAUDE_SESSIONS_DIR, file);
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
  const full = path.join(CLAUDE_SESSIONS_DIR, `${safeId}.jsonl`);
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
    wiki: listDir(path.join(VAULT_PATH, 'wiki')),
    sources: listDir(path.join(VAULT_PATH, 'raw-sources')),
  };
});

ipcMain.handle('get-git-stats', async () => {
  return new Promise((resolve) => {
    const proc = spawn(
      `git log --since="7 days ago" --date=short --pretty=format:%ad`,
      { cwd: VAULT_PATH, shell: true }
    );

    let output = '';
    proc.stdout.on('data', (data) => (output += data.toString()));
    proc.stderr.on('data', () => {}); 

    proc.on('close', () => {
      const counts = {};
      output
        .split('\n')
        .filter(Boolean)
        .forEach((date) => {
          counts[date] = (counts[date] || 0) + 1;
        });
      resolve(counts);
    });

    proc.on('error', () => resolve({}));
  });
});
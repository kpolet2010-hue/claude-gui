const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeAPI', {
  runClaude: (prompt) => ipcRenderer.invoke('run-claude', prompt),
  onStream: (callback) => ipcRenderer.on('claude-stream', (event, data) => callback(data)),
  saveHistory: (messages) => ipcRenderer.invoke('save-history', messages),
  loadHistory: () => ipcRenderer.invoke('load-history'),
  getUsage: () => ipcRenderer.invoke('get-usage'),
  getPromptStats: () => ipcRenderer.invoke('get-prompt-stats'),
  getGitStats: () => ipcRenderer.invoke('get-git-stats'),
  getVault: () => ipcRenderer.invoke('get-vault'),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  getSession: (id) => ipcRenderer.invoke('get-session', id),
});
import { useEffect, useRef, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';
import { useToast } from './ToastContext.jsx';
import { useT } from '../i18n.jsx';

const HISTORY_KEY = 'brain-prompt-history';
const MENTION_REGEX = /@([\w.-]+)/g;
const GREETING_COUNT = 8;

function loadPromptHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePromptHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50)));
  } catch {
    // ignore quota errors
  }
}

export default function ChatView({
  active,
  threads,
  activeThreadId,
  messages,
  busy,
  onSend,
  onStop,
  onNewChat,
  onSwitchThread,
  onDeleteThread,
  onRenameThread,
  vaultVersion,
  presetsVersion,
}) {
  const t = useT();
  const [input, setInput] = useState('');
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [mentionOptions, setMentionOptions] = useState([]);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [greetingIndex] = useState(() => Math.floor(Math.random() * GREETING_COUNT));
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const promptHistoryRef = useRef(loadPromptHistory());
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    (async () => {
      const data = await window.claudeAPI.getVault();
      setVaultFiles([
        ...data.wiki.map((f) => ({ type: 'wiki', name: f.name })),
        ...data.sources.map((f) => ({ type: 'sources', name: f.name })),
      ]);
    })();
  }, [active, vaultVersion]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setPresets(config.chatPresets || []);
    })();
  }, [active, presetsVersion]);

  useEffect(() => {
    if (isAtBottomRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = outputRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distance < 40;
    setShowJumpButton(!isAtBottomRef.current);
  }

  function jumpToBottom() {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    isAtBottomRef.current = true;
    setShowJumpButton(false);
  }

  function updateMentionSuggestions(value, cursorPos) {
    const before = value.slice(0, cursorPos);
    const match = before.match(/@([\w.-]*)$/);
    if (!match) {
      setMentionOptions([]);
      return;
    }
    const query = match[1].toLowerCase();
    const options = vaultFiles
      .filter((f) => {
        const base = f.type === 'wiki' ? f.name.replace(/\.md$/, '') : f.name;
        return base.toLowerCase().includes(query);
      })
      .slice(0, 6);
    setMentionOptions(options);
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);
    historyIndexRef.current = -1;
    updateMentionSuggestions(value, e.target.selectionStart);
  }

  function selectMention(file) {
    const base = file.type === 'wiki' ? file.name.replace(/\.md$/, '') : file.name;
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, cursorPos).replace(/@([\w.-]*)$/, `@${base} `);
    const after = input.slice(cursorPos);
    setInput(before + after);
    setMentionOptions([]);
    inputRef.current?.focus();
  }

  function resolveMentionFile(name) {
    const lower = name.toLowerCase();
    return vaultFiles.find((f) => {
      const base = f.type === 'wiki' ? f.name.replace(/\.md$/, '') : f.name;
      return base.toLowerCase() === lower;
    });
  }

  async function buildAugmentedPrompt(text) {
    const names = [...text.matchAll(MENTION_REGEX)].map((m) => m[1]);
    if (!names.length) return text;

    const uniqueNames = [...new Set(names)];
    const blocks = [];
    for (const name of uniqueNames) {
      const file = resolveMentionFile(name);
      if (!file) continue;
      const content = await window.claudeAPI.getVaultFile(file.type, file.name);
      if (content) blocks.push(`${t('chat.mentionContext', { name })}\n${content}`);
    }
    if (!blocks.length) return text;
    return `${text}\n\n${blocks.join('\n\n')}`;
  }

  async function pickAttachment() {
    const filePath = await window.claudeAPI.pickImage();
    if (filePath) setAttachment({ name: filePath.split(/[\\/]/).pop(), path: filePath });
  }

  function handleAttachmentDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      const filePath = window.claudeAPI.getPathForFile(file);
      if (filePath) setAttachment({ name: file.name, path: filePath });
    } catch {
      // ignore files without a resolvable filesystem path
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    let displayText = input;
    let augmented = await buildAugmentedPrompt(input);

    const preset = presets.find((p) => p.id === presetId);
    if (preset && preset.systemPrompt) {
      augmented = `${preset.systemPrompt}\n\n${augmented}`;
    }

    if (attachment) {
      augmented = `${augmented}\n\n${t('chat.imageAttachmentNote', { path: attachment.path })}`;
      displayText = `${displayText}\n\n📎 ${attachment.name}`;
    }

    const history = promptHistoryRef.current;
    if (history[history.length - 1] !== input) {
      history.push(input);
      savePromptHistory(history);
    }
    historyIndexRef.current = -1;

    onSend(augmented, displayText);
    setInput('');
    setAttachment(null);
    setMentionOptions([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSend();
      return;
    }
    if (mentionOptions.length) return;

    const history = promptHistoryRef.current;
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      if (historyIndexRef.current === -1) draftRef.current = input;
      const nextIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = nextIndex;
      setInput(history[history.length - 1 - nextIndex]);
    } else if (e.key === 'ArrowDown' && historyIndexRef.current !== -1) {
      e.preventDefault();
      const nextIndex = historyIndexRef.current - 1;
      historyIndexRef.current = nextIndex;
      setInput(nextIndex === -1 ? draftRef.current : history[history.length - 1 - nextIndex]);
    }
  }

  async function handleExport() {
    const markdown = messages
      .map((m) => `### ${m.role === 'user' ? t('chat.role.user') : m.role === 'error' ? t('chat.role.error') : t('chat.role.assistant')}\n\n${m.text}`)
      .join('\n\n---\n\n');
    const saved = await window.claudeAPI.exportChat(markdown);
    if (saved) showToast(t('chat.exportDone'), 'success');
  }

  function renameThreadPrompt(thread) {
    const newTitle = window.prompt(t('chat.threads.renamePrompt'), thread.title || '');
    if (!newTitle) return;
    onRenameThread(thread.id, newTitle);
  }

  return (
    <div id="chat-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{t('chat.title')}</div>
          <div id="greeting-sub">{t('chat.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {presets.length > 0 && (
            <select className="settings-input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              <option value="">{t('chat.noPreset')}</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
          <button className="preset-btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={handleExport}>
            {t('chat.export')}
          </button>
        </div>
      </div>

      <div id="chat-layout">
        <div id="chat-threads-list">
          <button className="preset-btn" style={{ width: '100%', marginBottom: 8 }} onClick={onNewChat} disabled={busy}>
            {t('chat.threads.new')}
          </button>
          {threads.map((thread) => (
            <div key={thread.id} className={`thread-row ${thread.id === activeThreadId ? 'active' : ''}`}>
              <button
                className="thread-row-select"
                disabled={busy}
                onClick={() => onSwitchThread(thread.id)}
                onDoubleClick={() => renameThreadPrompt(thread)}
              >
                {thread.title || t('chat.threads.untitled')}
              </button>
              <button
                className="thread-row-delete"
                disabled={busy}
                onClick={() => onDeleteThread(thread.id)}
                title={t('chat.threads.delete')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div id="chat-main">
          <div className="chat-output-wrap">
            <div id="output" ref={outputRef} onScroll={handleScroll}>
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <div className="chat-empty-greeting">{t(`chat.greeting${greetingIndex + 1}`)}</div>
                  <div className="chat-empty-sub">{t(`chat.greeting${greetingIndex + 1}Sub`)}</div>
                </div>
              ) : (
                messages.map((msg) => <ChatBubble key={msg.id} role={msg.role} text={msg.text} />)
              )}
            </div>
            {showJumpButton && (
              <button className="jump-to-bottom-btn" onClick={jumpToBottom}>
                {t('chat.jumpToBottom')}
              </button>
            )}
          </div>

          {attachment && (
            <div className="attachment-chip">
              📎 {attachment.name}
              <button onClick={() => setAttachment(null)} title={t('chat.removeAttachment')}>✕</button>
            </div>
          )}

          <div id="inputRow" style={{ position: 'relative' }} onDragOver={(e) => e.preventDefault()} onDrop={handleAttachmentDrop}>
            {mentionOptions.length > 0 && (
              <div className="mention-dropdown">
                {mentionOptions.map((file) => (
                  <button
                    key={`${file.type}-${file.name}`}
                    className="mention-option"
                    onClick={() => selectMention(file)}
                  >
                    {file.type === 'wiki' ? file.name.replace(/\.md$/, '') : file.name}
                  </button>
                ))}
              </div>
            )}
            <button className="attach-btn" onClick={pickAttachment} title={t('chat.attachImage')}>📎</button>
            <input
              id="prompt"
              ref={inputRef}
              type="text"
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            {busy ? (
              <button id="stop" className="danger-btn" onClick={onStop}>{t('chat.stop')}</button>
            ) : (
              <button id="send" onClick={handleSend}>{t('chat.send')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

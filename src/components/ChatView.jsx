import { useEffect, useRef, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';

export default function ChatView({ active, messages, busy, onSend, onStop, onNewChat }) {
  const [input, setInput] = useState('');
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  }

  return (
    <div id="chat-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Chat</div>
          <div id="greeting-sub">Was steht heute an?</div>
        </div>
        <button
          className="preset-btn"
          style={{ width: 'auto', padding: '10px 16px' }}
          onClick={onNewChat}
          disabled={busy}
        >
          Neuer Chat
        </button>
      </div>

      <div id="output" ref={outputRef}>
        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} text={msg.text} />
        ))}
      </div>

      <div id="inputRow">
        <input
          id="prompt"
          type="text"
          placeholder="Frag Claude..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        {busy ? (
          <button id="stop" className="danger-btn" onClick={onStop}>Stopp</button>
        ) : (
          <button id="send" onClick={handleSend}>Senden</button>
        )}
      </div>
    </div>
  );
}

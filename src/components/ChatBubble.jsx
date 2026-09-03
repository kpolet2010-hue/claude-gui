import ReactMarkdown from 'react-markdown';

const labels = { user: 'Du', assistant: 'Claude', error: 'Fehler' };

export default function ChatBubble({ role, text }) {
  return (
    <div className={`bubble-row ${role === 'user' ? 'user' : 'assistant'}`}>
      <div className={`bubble ${role}`}>
        <div className="bubble-label">{labels[role] || role}</div>
        {role === 'user' ? (
          <div className="bubble-text">{text}</div>
        ) : (
          <div className="bubble-text bubble-markdown">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

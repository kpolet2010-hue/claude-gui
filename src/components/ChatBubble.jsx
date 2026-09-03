export default function ChatBubble({ role, text }) {
  return (
    <div className={`bubble-row ${role}`}>
      <div className={`bubble ${role}`}>
        <div className="bubble-label">{role === 'user' ? 'Du' : 'Claude'}</div>
        <div className="bubble-text">{text}</div>
      </div>
    </div>
  );
}

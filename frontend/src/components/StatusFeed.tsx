interface StatusFeedProps {
  messages: string[];
}

export function StatusFeed({ messages }: StatusFeedProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Live Agent Status</h2>
        <span>SSE-ready scaffold</span>
      </div>

      <div className="status-feed">
        {messages.length === 0 ? (
          <p className="muted">No search running yet.</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${index}-${message}`} className="status-line">
              {message}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

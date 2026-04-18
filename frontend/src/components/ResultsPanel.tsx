import type { ManufacturerResult, MemoResponse } from "../types";

interface ResultsPanelProps {
  results: ManufacturerResult[];
  memo: MemoResponse | null;
  onGenerateMemo: () => void;
  isMemoLoading: boolean;
}

export function ResultsPanel({
  results,
  memo,
  onGenerateMemo,
  isMemoLoading,
}: ResultsPanelProps) {
  return (
    <section className="panel results-panel">
      <div className="panel-header">
        <h2>Ranked Options</h2>
        <button className="secondary-button" onClick={onGenerateMemo} disabled={!results.length || isMemoLoading}>
          {isMemoLoading ? "Generating..." : "Generate memo"}
        </button>
      </div>

      <div className="results-list">
        {results.length === 0 && <p className="muted">Search results will render here.</p>}
        {results.map((result) => (
          <article key={result.id} className="result-card">
            <div>
              <p className="result-rank">{result.country}</p>
              <h3>{result.manufacturerName}</h3>
              <p>{result.location}</p>
            </div>
            <div className="score-badge">{result.score.total.toFixed(1)}</div>
            <dl className="score-grid">
              <div>
                <dt>Manufacturing</dt>
                <dd>{result.score.manufacturing.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Transport</dt>
                <dd>{result.score.transport.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Grid</dt>
                <dd>{result.score.grid.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Climate risk</dt>
                <dd>{result.score.climateRisk.toFixed(1)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {memo && (
        <article className="memo-card">
          <p className="eyebrow">Recommendation memo</p>
          <h3>{memo.title}</h3>
          <p>{memo.body}</p>
        </article>
      )}
    </section>
  );
}


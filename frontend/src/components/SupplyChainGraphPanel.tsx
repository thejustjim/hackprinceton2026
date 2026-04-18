import type { ManufacturerResult } from "../types";

interface SupplyChainGraphPanelProps {
  product: string;
  destinationCountry: string;
  results: ManufacturerResult[];
}

export function SupplyChainGraphPanel({
  product,
  destinationCountry,
  results,
}: SupplyChainGraphPanelProps) {
  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <h2>Supply Chain Graph</h2>
        <span>D3-ready placeholder</span>
      </div>

      <div className="graph-shell">
        <div className="graph-root">{product || "Product"}</div>
        <div className="graph-country-row">
          {results.map((result) => (
            <article key={result.id} className="graph-node">
              <strong>{result.manufacturerName}</strong>
              <span>{result.country}</span>
              <small>{result.score.total.toFixed(1)} pts</small>
            </article>
          ))}
        </div>
        <p className="muted">
          Destination anchor: {destinationCountry || "Not set"}
        </p>
      </div>
    </section>
  );
}


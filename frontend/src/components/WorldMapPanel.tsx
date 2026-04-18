import type { ManufacturerResult } from "../types";

interface WorldMapPanelProps {
  destinationCountry: string;
  transportMode: string;
  results: ManufacturerResult[];
}

export function WorldMapPanel({
  destinationCountry,
  transportMode,
  results,
}: WorldMapPanelProps) {
  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <h2>World Map</h2>
        <span>Leaflet-ready placeholder</span>
      </div>

      <div className="map-shell">
        <div className="map-legend">
          <span>Destination: {destinationCountry || "Not set"}</span>
          <span>Mode: {transportMode}</span>
        </div>

        <div className="map-route-list">
          {results.length === 0 && <p className="muted">Routes will appear here after search.</p>}
          {results.map((result) => (
            <div key={result.id} className="route-pill">
              {result.country} to {destinationCountry} · {result.score.transport.toFixed(1)} tCO2e
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


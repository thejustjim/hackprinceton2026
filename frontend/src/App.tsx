import { useEffect, useRef, useState } from "react";
import { generateMemo, getResult, startSearch, streamStatus } from "./api";
import { ResultsPanel } from "./components/ResultsPanel";
import { SearchForm } from "./components/SearchForm";
import { StatusFeed } from "./components/StatusFeed";
import { SupplyChainGraphPanel } from "./components/SupplyChainGraphPanel";
import { WorldMapPanel } from "./components/WorldMapPanel";
import type { MemoResponse, SearchRequest, SearchResult } from "./types";

const initialForm: SearchRequest = {
  product: "Cotton t-shirts",
  quantity: 10000,
  destinationCountry: "USA",
  countries: ["China", "Portugal", "Bangladesh"],
  transportMode: "sea",
  certifications: ["ISO 14001"],
};

export default function App() {
  const [form, setForm] = useState<SearchRequest>(initialForm);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMemoLoading, setIsMemoLoading] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.close();
    };
  }, []);

  async function handleSearch() {
    setIsLoading(true);
    setMemo(null);
    setSearchResult(null);
    setStatusMessages([]);
    streamRef.current?.close();

    try {
      const { searchId } = await startSearch(form);
      streamRef.current = streamStatus(searchId, (message) => {
        setStatusMessages((current) => [...current, message]);
      });

      const result = await getResult(searchId);
      setSearchResult(result);
    } catch (error) {
      setStatusMessages([
        error instanceof Error ? error.message : "An unexpected error occurred.",
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateMemo() {
    if (!searchResult) {
      return;
    }

    setIsMemoLoading(true);
    try {
      const nextMemo = await generateMemo(searchResult.id);
      setMemo(nextMemo);
    } finally {
      setIsMemoLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero-card">
        <p className="eyebrow">HackPrinceton 2026</p>
        <div className="hero-copy">
          <div>
            <h1>GreenChain</h1>
            <p className="lede">
              Supply-chain environmental comparator scaffolded around the actual
              brief: search flow, live status feed, ranked results, memo hook,
              graph panel, and map panel.
            </p>
          </div>
          <div className="badge-stack">
            <span className="hero-badge">React + TypeScript</span>
            <span className="hero-badge">FastAPI + SSE</span>
          </div>
        </div>

        <SearchForm value={form} onChange={setForm} onSubmit={handleSearch} isLoading={isLoading} />
      </header>

      <section className="dashboard-grid">
        <div className="column-stack">
          <StatusFeed messages={statusMessages} />
          <SupplyChainGraphPanel
            product={form.product}
            destinationCountry={form.destinationCountry}
            results={searchResult?.results ?? []}
          />
        </div>

        <WorldMapPanel
          destinationCountry={form.destinationCountry}
          transportMode={form.transportMode}
          results={searchResult?.results ?? []}
        />
      </section>

      <ResultsPanel
        results={searchResult?.results ?? []}
        memo={memo}
        onGenerateMemo={handleGenerateMemo}
        isMemoLoading={isMemoLoading}
      />
    </main>
  );
}


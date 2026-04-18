import type { MemoResponse, SearchRequest, SearchResult, StartSearchResponse } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function startSearch(payload: SearchRequest): Promise<StartSearchResponse> {
  const response = await fetch(`${apiBaseUrl}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to start search (${response.status})`);
  }

  return response.json() as Promise<StartSearchResponse>;
}

export async function getResult(searchId: string): Promise<SearchResult> {
  const response = await fetch(`${apiBaseUrl}/api/results/${searchId}`);
  if (!response.ok) {
    throw new Error(`Unable to load result (${response.status})`);
  }

  return response.json() as Promise<SearchResult>;
}

export async function generateMemo(searchId: string): Promise<MemoResponse> {
  const response = await fetch(`${apiBaseUrl}/api/memo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchId }),
  });

  if (!response.ok) {
    throw new Error(`Unable to generate memo (${response.status})`);
  }

  return response.json() as Promise<MemoResponse>;
}

export function streamStatus(searchId: string, onMessage: (message: string) => void): EventSource {
  const source = new EventSource(`${apiBaseUrl}/api/stream/${searchId}`);

  source.onmessage = (event) => {
    onMessage(event.data);
  };

  return source;
}


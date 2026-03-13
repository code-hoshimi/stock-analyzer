// ---- Types ----

export interface StockPreview {
  symbol: string;
  exchange: string;
  shortName?: string;
  sector?: string;
  industry?: string;
  close?: number;
  eodVolume?: number;
  currency?: string;
}

export type CrossType = 'GOLDEN_CROSS' | 'DEATH_CROSS';

export interface CrossSignal {
  datetime: string;
  crossType: CrossType;
  maShort: number;
  maLong: number;
  close: number;
  rsi: number;
  obv: number;
  isObvRising: boolean;
  isBuySignal: boolean;
  note: string;
}

export interface AnalysisResult {
  symbol: string;
  crossSignals: CrossSignal[];
}

export interface MACrossAnalyzeRequest {
  symbols: string[];
  maShort?: number;
  maLong?: number;
  forceRefresh?: boolean;
}

export interface MACrossAnalyzeResponse {
  requestId: string;
  results: AnalysisResult[];
}

export interface EquityScreenSearchRequest {
  exchanges: string[];
  sectors?: string[];
  industries?: string[];
  minEodVolume?: number;
  maxEodVolume?: number;
  minClose?: number;
  maxClose?: number;
  sortField?: 'eodVolume' | 'close' | 'symbol';
  sortAsc?: boolean;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}

export interface EquityScreenSearchResponse {
  requestId: string;
  total: number;
  results: StockPreview[];
}

export interface StockPreviewListResponse {
  total: number;
  results: StockPreview[];
}

export interface ListStockParams {
  exchanges?: string[];
  sectors?: string[];
  industries?: string[];
  minEodVolume?: number;
  sortField?: 'symbol' | 'close' | 'eodVolume';
  sortAsc?: boolean;
  limit?: number;
  offset?: number;
}

// ---- HTTP helper ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP_${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---- API functions ----

export async function listStocks(params: ListStockParams = {}) {
  const q = new URLSearchParams();
  if (params.exchanges) params.exchanges.forEach((e) => q.append('exchanges', e));
  if (params.sectors) params.sectors.forEach((s) => q.append('sectors', s));
  if (params.industries) params.industries.forEach((i) => q.append('industries', i));
  if (params.minEodVolume != null) q.set('minEodVolume', String(params.minEodVolume));
  if (params.sortField) q.set('sortField', params.sortField);
  if (params.sortAsc != null) q.set('sortAsc', String(params.sortAsc));
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request<StockPreviewListResponse>(`/api/v1/stock${qs ? `?${qs}` : ''}`);
}

export async function getStockQuote(symbol: string) {
  return request<StockPreview>(`/api/v1/stock/${encodeURIComponent(symbol)}/quote`);
}

export async function analyzeMACross(payload: MACrossAnalyzeRequest) {
  return request<MACrossAnalyzeResponse>('/api/v1/indicators/ma-cross/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function searchEquities(payload: EquityScreenSearchRequest) {
  return request<EquityScreenSearchResponse>('/api/v1/screen/equity/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getHealth() {
  return request<{ status: string }>('/api/v1/health');
}

export interface StockMeta {
  exchanges: string[];
  sectors: string[];
  industries: string[];
}

export async function getStockMeta(exchange?: string) {
  const qs = exchange ? `?exchange=${encodeURIComponent(exchange)}` : '';
  return request<StockMeta>(`/api/v1/stock/meta${qs}`);
}

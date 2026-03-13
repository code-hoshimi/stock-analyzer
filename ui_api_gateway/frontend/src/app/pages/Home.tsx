import React, { useEffect, useState } from 'react';
import {
  listStocks,
  searchEquities,
  analyzeMACross,
  getStockMeta,
  StockPreview,
  AnalysisResult,
  ListStockParams,
  EquityScreenSearchRequest,
} from '../api/client';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Grid, List, Search } from 'lucide-react';

const STOCKS_PER_PAGE = 50;

const EXCHANGES = ['HKG', 'NASDAQ', 'NYSE', 'LSE'];
const SORT_FIELDS: { value: ListStockParams['sortField']; label: string }[] = [
  { value: 'eodVolume', label: '按成交量' },
  { value: 'close', label: '按收盘价' },
  { value: 'symbol', label: '按代码' },
];

export function Home() {
  const [stocks, setStocks] = useState<StockPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [crossData, setCrossData] = useState<Record<string, AnalysisResult>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [offset, setOffset] = useState(0);
  const [searching, setSearching] = useState(false);

  // Browse filters
  const [exchange, setExchange] = useState<string>('HKG');
  const [sortField, setSortField] = useState<ListStockParams['sortField']>('eodVolume');

  // Search panel
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [sector, setSector] = useState('all');
  const [minVolume, setMinVolume] = useState('');
  const [maxVolume, setMaxVolume] = useState('');
  const [maShort, setMaShort] = useState('5');
  const [maLong, setMaLong] = useState('20');

  // Load sector list whenever exchange changes
  useEffect(() => {
    let alive = true;
    getStockMeta(exchange)
      .then((meta) => { if (alive) setAvailableSectors(meta.sectors); })
      .catch(() => {});
    return () => { alive = false; };
  }, [exchange]);

  useEffect(() => {
    let alive = true;
    setOffset(0);

    async function loadList() {
      try {
        const data = await listStocks({
          exchanges: [exchange],
          sortField,
          sortAsc: false,
          limit: STOCKS_PER_PAGE,
          offset: 0,
        });
        if (!alive) return;
        setStocks(data.results);
        setTotal(data.total);
        if (data.results.length > 0) {
          try {
            const symbols = data.results.map((s: StockPreview) => s.symbol);
            const cross = await analyzeMACross({ symbols, maShort: 5, maLong: 20 });
            if (!alive) return;
            const map: Record<string, AnalysisResult> = {};
            for (const r of cross.results) map[r.symbol] = r;
            setCrossData(map);
          } catch {
            // cross data is non-critical
          }
        }
      } catch {
        if (alive) { setStocks([]); setTotal(0); }
      }
    }

    loadList();
    return () => { alive = false; };
  }, [exchange, sortField]);

  const loadMore = async () => {
    const newOffset = offset + STOCKS_PER_PAGE;
    try {
      const data = await listStocks({
        exchanges: [exchange],
        sortField,
        sortAsc: false,
        limit: STOCKS_PER_PAGE,
        offset: newOffset,
      });
      setStocks((prev: StockPreview[]) => [...prev, ...data.results]);
      setOffset(newOffset);
    } catch { /* ignore */ }
  };

  const handleSearch = async () => {
    const short = parseInt(maShort, 10);
    const long = parseInt(maLong, 10);
    if (!short || !long || short >= long) {
      alert('MA短线必须小于MA长线，且均为正整数');
      return;
    }
    setSearching(true);
    try {
      const payload: EquityScreenSearchRequest = {
        exchanges: [exchange],
        sectors: sector && sector !== 'all' ? [sector] : undefined,
        minEodVolume: minVolume ? parseInt(minVolume, 10) : undefined,
        maxEodVolume: maxVolume ? parseInt(maxVolume, 10) : undefined,
        sortField: 'eodVolume',
        sortAsc: false,
        limit: STOCKS_PER_PAGE,
        forceRefresh: true,
      };
      const data = await searchEquities(payload);
      setStocks(data.results);
      setTotal(data.total);
      setOffset(0);

      if (data.results.length > 0) {
        try {
          const symbols = data.results.map((s: StockPreview) => s.symbol);
          const cross = await analyzeMACross({ symbols, maShort: short, maLong: long });
          const map: Record<string, AnalysisResult> = {};
          for (const r of cross.results) map[r.symbol] = r;
          setCrossData(map);
        } catch {
          setCrossData({});
        }
      } else {
        setCrossData({});
      }
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  const totalPages = Math.ceil(total / STOCKS_PER_PAGE);
  const currentPage = Math.floor(offset / STOCKS_PER_PAGE) + 1;

  return (
    <div className="space-y-4">

      {/* Search panel */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="text-sm font-medium text-muted-foreground">筛选 &amp; 金叉搜索</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={sector} onValueChange={setSector} data-testid="sector-select">
            <SelectTrigger>
              <SelectValue placeholder="板块" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部板块</SelectItem>
              {availableSectors.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="最小成交量"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
            data-testid="min-volume-input"
          />
          <Input
            type="number"
            placeholder="最大成交量"
            value={maxVolume}
            onChange={(e) => setMaxVolume(e.target.value)}
            data-testid="max-volume-input"
          />
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">MA短</span>
            <Input
              type="number"
              placeholder="5"
              value={maShort}
              onChange={(e) => setMaShort(e.target.value)}
              data-testid="ma-short-input"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">MA长</span>
            <Input
              type="number"
              placeholder="20"
              value={maLong}
              onChange={(e) => setMaLong(e.target.value)}
              data-testid="ma-long-input"
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="w-full" data-testid="search-btn">
            <Search className="h-4 w-4 mr-1" />
            {searching ? '搜索中…' : '搜索'}
          </Button>
        </div>
      </div>

      {/* Browse bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <Select value={exchange} onValueChange={(v) => setExchange(v)}>
          <SelectTrigger className="w-full md:w-[140px]" data-testid="exchange-select">
            <SelectValue placeholder="交易所" />
          </SelectTrigger>
          <SelectContent>
            {EXCHANGES.map((ex) => (
              <SelectItem key={ex} value={ex}>{ex}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortField ?? 'eodVolume'} onValueChange={(v) => setSortField(v as ListStockParams['sortField'])}>
          <SelectTrigger className="w-full md:w-[160px]" data-testid="sort-select">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELDS.map((s) => (
              <SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <div className="flex gap-2">
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('table')} data-testid="view-table">
            <List className="h-5 w-5" />
          </Button>
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')} data-testid="view-grid">
            <Grid className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">共 {total} 只股票</div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      ) : (
        <StockTable stocks={stocks} crossData={crossData} />
      )}

      {currentPage < totalPages && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore}>加载更多</Button>
        </div>
      )}
    </div>
  );
}

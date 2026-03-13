import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { MA_PAIRS } from '../utils/market';
import {
  analyzeMACross,
  getStockQuote,
  StockPreview,
  AnalysisResult,
} from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft } from 'lucide-react';

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [stock, setStock] = useState<StockPreview | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const sym: string = symbol;
    let alive = true;
    setLoading(true);
    setNotFound(false);

    async function load() {
      try {
        const quote = await getStockQuote(sym);
        if (!alive) return;
        setStock(quote);

        // Kick off MA cross analysis for all pairs
        const byPair: Record<string, AnalysisResult> = {};
        await Promise.allSettled(
          MA_PAIRS.map(async (pair) => {
            try {
              const resp = await analyzeMACross({
                symbols: [sym],
                maShort: pair.short,
                maLong: pair.long,
              });
              const result = resp.results.find((r) => r.symbol === sym);
              if (result) byPair[pair.key] = result;
            } catch {
              // skip
            }
          }),
        );
        if (!alive) return;
        setAnalysisResults(byPair);
        setLoading(false);
      } catch {
        if (!alive) return;
        setNotFound(true);
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="stock-detail-loading">
        <div className="h-10 w-28 rounded-md bg-muted animate-pulse" />
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-56 rounded bg-muted animate-pulse" />
            <div className="h-6 w-36 rounded bg-muted animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  if (notFound || !stock) {
    return (
      <div className="text-center py-20" data-testid="stock-not-found">
        <h2 className="text-2xl font-bold mb-4">股票不存在</h2>
        <Link to="/"><Button>返回首页</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stock-detail-page">
      <Link to="/">
        <Button variant="ghost" className="gap-2" data-testid="back-to-home">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </Link>

      <Card className="p-6" data-testid="stock-summary-card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold" data-testid="stock-name">
                {stock.shortName ?? stock.symbol}
              </h1>
              {stock.sector && <Badge variant="outline">{stock.sector}</Badge>}
            </div>
            <p className="text-muted-foreground mb-4">{stock.symbol} · {stock.exchange}</p>

            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold" data-testid="stock-price">
                {stock.close != null
                  ? `${stock.currency ?? ''} ${stock.close.toFixed(2)}`.trim()
                  : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div>
            <div className="text-sm text-muted-foreground">成交量</div>
            <div className="text-lg font-semibold">
              {stock.eodVolume != null ? `${(stock.eodVolume / 1_000_000).toFixed(2)}M` : '--'}
            </div>
          </div>
          {stock.industry && (
            <div>
              <div className="text-sm text-muted-foreground">行业</div>
              <div className="text-lg font-semibold">{stock.industry}</div>
            </div>
          )}
          {stock.currency && (
            <div>
              <div className="text-sm text-muted-foreground">货币</div>
              <div className="text-lg font-semibold">{stock.currency}</div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6" data-testid="golden-cross-card">
        <h3 className="text-lg font-semibold mb-4">均线交叉分析</h3>
        <Tabs defaultValue={MA_PAIRS[0].key} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {MA_PAIRS.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
            ))}
          </TabsList>
          {MA_PAIRS.map((pair) => {
            const result = analysisResults[pair.key];
            const signals = result?.crossSignals ?? [];
            return (
              <TabsContent key={pair.key} value={pair.key} className="mt-4">
                {signals.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">日期</th>
                          <th className="text-left p-3 font-medium">类型</th>
                          <th className="text-right p-3 font-medium">MA{pair.short}</th>
                          <th className="text-right p-3 font-medium">MA{pair.long}</th>
                          <th className="text-right p-3 font-medium">收盘价</th>
                          <th className="text-right p-3 font-medium">RSI</th>
                          <th className="text-right p-3 hidden lg:table-cell font-medium">OBV上升</th>
                          <th className="text-left p-3 font-medium hidden xl:table-cell">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map((sig, i) => {
                          const dt = new Date(sig.datetime);
                          const dateStr = dt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', year: 'numeric' });
                          const isGolden = sig.crossType === 'GOLDEN_CROSS';
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-3">{dateStr}</td>
                              <td className="p-3">
                                <Badge variant={isGolden ? 'default' : 'destructive'}>
                                  {isGolden ? '金叉' : '死叉'}
                                </Badge>
                              </td>
                              <td className="p-3 text-right font-medium text-primary">{sig.maShort.toFixed(3)}</td>
                              <td className="p-3 text-right">{sig.maLong.toFixed(3)}</td>
                              <td className="p-3 text-right">{sig.close.toFixed(2)}</td>
                              <td className="p-3 text-right">{sig.rsi.toFixed(1)}</td>
                              <td className="p-3 text-right hidden lg:table-cell">
                                {sig.isObvRising ? '✓' : '✗'}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">{sig.note}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4">暂无 {pair.label} 交叉信号</p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </Card>
    </div>
  );
}

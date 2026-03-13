import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { StockPreview, AnalysisResult } from '../api/client';

interface StockTableProps {
  stocks: StockPreview[];
  crossData?: Record<string, AnalysisResult>;
}

export function StockTable({ stocks, crossData }: StockTableProps) {
  const formatVolume = (v?: number) => {
    if (v == null || !Number.isFinite(v)) return '-';
    return `${(v / 1_000_000).toFixed(2)}M`;
  };

  return (
    <div className="rounded-md border overflow-hidden" data-testid="stock-table">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">代码</TableHead>
            <TableHead className="w-48">名称</TableHead>
            <TableHead className="w-24">交易所</TableHead>
            <TableHead className="w-28 hidden sm:table-cell">板块</TableHead>
            <TableHead className="w-24 text-right tabular-nums">收盘价</TableHead>
            <TableHead className="w-28 text-right tabular-nums hidden md:table-cell">成交量</TableHead>
            <TableHead className="w-36 hidden lg:table-cell">最近金叉</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => (
            <TableRow key={stock.symbol} className="cursor-pointer hover:bg-muted/50" data-testid={`stock-row-${stock.symbol}`}>
              <TableCell>
                <Link to={`/stock/${stock.symbol}`} className="font-medium hover:underline" data-testid={`stock-link-${stock.symbol}`}>
                  {stock.symbol}
                </Link>
              </TableCell>
              <TableCell>
                <Link to={`/stock/${stock.symbol}`} className="hover:underline">
                  <div className="max-w-[180px] truncate">{stock.shortName ?? '-'}</div>
                  {stock.industry && <div className="text-xs text-muted-foreground/80 truncate">{stock.industry}</div>}
                </Link>
              </TableCell>
              <TableCell>{stock.exchange}</TableCell>
              <TableCell className="hidden sm:table-cell">{stock.sector ?? '-'}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                <Link to={`/stock/${stock.symbol}`}>
                  {stock.close != null ? `${stock.currency ?? ''} ${stock.close.toFixed(2)}`.trim() : '--'}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums hidden md:table-cell">
                <Link to={`/stock/${stock.symbol}`}>
                  {formatVolume(stock.eodVolume)}
                </Link>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm">
                {(() => {
                  const signals = crossData?.[stock.symbol]?.crossSignals;
                  const latest = signals?.filter(s => s.crossType === 'GOLDEN_CROSS')[0];
                  if (!latest) return <span className="text-muted-foreground">-</span>;
                  const d = new Date(latest.datetime);
                  const label = `${d.getMonth()+1}月${d.getDate()}日`;
                  return (
                    <span className={latest.isBuySignal ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                      {label}{latest.isBuySignal ? ' ✓' : ''}
                    </span>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

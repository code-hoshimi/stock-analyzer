import { Card } from './ui/card';
import { Link } from 'react-router';
import { StockPreview } from '../api/client';

interface StockCardProps {
  stock: StockPreview;
}

export function StockCard({ stock }: StockCardProps) {
  const formatVolume = (v?: number) => {
    if (v == null || !Number.isFinite(v)) return '-';
    return `${(v / 1_000_000).toFixed(2)}M`;
  };

  return (
    <Link to={`/stock/${stock.symbol}`}>
      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{stock.symbol}</h3>
            {stock.shortName && <p className="text-sm text-muted-foreground truncate">{stock.shortName}</p>}
            {stock.sector && <span className="text-xs text-muted-foreground/80">{stock.sector}</span>}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {stock.exchange}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-bold">
              {stock.close != null ? `${stock.currency ?? ''} ${stock.close.toFixed(2)}`.trim() : '--'}
            </span>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div>成交量: {formatVolume(stock.eodVolume)}</div>
            {stock.industry && <div>{stock.industry}</div>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

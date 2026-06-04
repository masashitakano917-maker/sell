import React, { useMemo } from 'react';
import { TrendingUp, ShoppingCart, Trophy } from 'lucide-react';
import { yen } from '../lib/number';

type Props = {
  prices: number[];
  purchasePrice: number;
  expectedShipping: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

function netProfit(salePrice: number, ship: number, purchase: number): number {
  const fee = Math.round(salePrice * 0.1);
  return salePrice - fee - ship - purchase;
}

export function PricingPlan({ prices, purchasePrice, expectedShipping }: Props) {
  const stats = useMemo(() => {
    if (prices.length === 0) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const p75 = percentile(sorted, 0.75);
    const p90 = percentile(sorted, 0.9);
    return { median, p75, p90 };
  }, [prices]);

  if (!stats || prices.length < 2) {
    return null;
  }

  const tiers = [
    {
      key: 'quick',
      label: '即売り価格',
      sub: '相場中央値・1〜3日で売り切る想定',
      icon: ShoppingCart,
      price: stats.median,
    },
    {
      key: 'standard',
      label: '標準価格',
      sub: '上位25%・1〜2週間で売る想定',
      icon: TrendingUp,
      price: stats.p75,
    },
    {
      key: 'challenge',
      label: 'チャレンジ価格',
      sub: '上位10%・粘れば売れる想定',
      icon: Trophy,
      price: stats.p90,
    },
  ] as const;

  const dropPlan = [0, 0.05, 0.1, 0.15, 0.2];

  return (
    <section className="card pricing-card full-row">
      <h2>推奨出品価格 3段階</h2>
      <p className="hint">{prices.length}件の売り切れ実績から、3つの価格戦略を提示します（手数料10%・送料{yen(expectedShipping)}差引後の手取り）。</p>

      <div className="pricing-grid">
        {tiers.map((t) => {
          const profit = netProfit(t.price, expectedShipping, purchasePrice);
          const profitClass = profit >= 0 ? 'good' : 'bad';
          const Icon = t.icon;
          return (
            <div key={t.key} className={`tier tier-${t.key}`}>
              <div className="tier-head">
                <Icon size={16} />
                <strong>{t.label}</strong>
              </div>
              <div className="tier-price">{yen(t.price)}</div>
              <div className={`tier-profit ${profitClass}`}>
                手取り粗利：<b>{yen(profit)}</b>
              </div>
              <div className="tier-sub">{t.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="drop-sim">
        <h3>標準価格からの値下げシミュレーション</h3>
        <div className="drop-table">
          <div className="drop-row drop-head">
            <span>値下げ</span>
            <span>出品価格</span>
            <span>手数料</span>
            <span>手取り粗利</span>
          </div>
          {dropPlan.map((d) => {
            const price = Math.round(stats.p75 * (1 - d));
            const fee = Math.round(price * 0.1);
            const profit = price - fee - expectedShipping - purchasePrice;
            const profitClass = profit >= 0 ? 'good' : 'bad';
            return (
              <div key={d} className="drop-row">
                <span>{d === 0 ? '現状' : `−${Math.round(d * 100)}%`}</span>
                <span>{yen(price)}</span>
                <span className="muted">−{yen(fee)}</span>
                <span className={profitClass}><b>{yen(profit)}</b></span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Loader as Loader2, RefreshCw, TriangleAlert as AlertTriangle, MapPin, Tag } from 'lucide-react';
import { supabase, type PurchaseRecord } from '../lib/supabase';
import { yen } from '../lib/number';

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function profitOf(r: PurchaseRecord): number {
  if (r.status !== 'sold' || r.sold_price == null) return 0;
  return (r.sold_price ?? 0) - (r.actual_shipping ?? 0) - (r.fee ?? 0) - r.purchase_price;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function Dashboard() {
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('purchase_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRecords(data as PurchaseRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sold = useMemo(() => records.filter((r) => r.status === 'sold' && r.sold_price != null), [records]);

  const monthly = useMemo(() => {
    const map = new Map<string, { profit: number; count: number; revenue: number }>();
    for (const r of sold) {
      const k = monthKey(r.sold_at ?? r.updated_at);
      const cur = map.get(k) ?? { profit: 0, count: 0, revenue: 0 };
      cur.profit += profitOf(r);
      cur.revenue += r.sold_price ?? 0;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 6)
      .reverse();
  }, [sold]);

  const maxMonthlyProfit = useMemo(
    () => Math.max(1, ...monthly.map(([, v]) => Math.abs(v.profit))),
    [monthly],
  );

  const brandRanking = useMemo(() => {
    const map = new Map<string, { count: number; profit: number }>();
    for (const r of sold) {
      const k = r.brand_jp || r.brand || '(未設定)';
      const cur = map.get(k) ?? { count: 0, profit: 0 };
      cur.count += 1;
      cur.profit += profitOf(r);
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([brand, v]) => ({ brand, ...v, avg: Math.round(v.profit / v.count) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [sold]);

  const storeRanking = useMemo(() => {
    const map = new Map<string, { count: number; soldCount: number; profit: number; inRange: number }>();
    for (const r of records) {
      const loc = (r.purchase_location || '').trim();
      if (!loc) continue;
      const cur = map.get(loc) ?? { count: 0, soldCount: 0, profit: 0, inRange: 0 };
      cur.count += 1;
      if (r.status === 'sold' && r.sold_price != null) {
        cur.soldCount += 1;
        cur.profit += profitOf(r);
        if (r.sold_price >= r.estimated_sale_min && r.sold_price <= r.estimated_sale_max) cur.inRange += 1;
      }
      map.set(loc, cur);
    }
    return Array.from(map.entries())
      .map(([store, v]) => ({
        store,
        ...v,
        avgProfit: v.soldCount > 0 ? Math.round(v.profit / v.soldCount) : 0,
        hitRate: v.soldCount > 0 ? Math.round((v.inRange / v.soldCount) * 100) : 0,
      }))
      .sort((a, b) => b.avgProfit - a.avgProfit);
  }, [records]);

  const turnover = useMemo(() => {
    const days: number[] = [];
    for (const r of sold) {
      if (!r.sold_at) continue;
      days.push(daysBetween(r.sold_at, r.created_at));
    }
    if (days.length === 0) return null;
    days.sort((a, b) => a - b);
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    const median = days[Math.floor(days.length / 2)];
    return { avg, median, count: days.length };
  }, [sold]);

  const deadStock = useMemo(() => {
    const now = Date.now();
    return records
      .filter((r) => r.status === 'listed' || r.status === 'purchased')
      .map((r) => ({ r, days: Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)) }))
      .filter((x) => x.days >= 30)
      .sort((a, b) => b.days - a.days);
  }, [records]);

  const totals = useMemo(() => {
    const profit = sold.reduce((a, r) => a + profitOf(r), 0);
    const revenue = sold.reduce((a, r) => a + (r.sold_price ?? 0), 0);
    const cost = sold.reduce((a, r) => a + r.purchase_price, 0);
    return { profit, revenue, cost, soldCount: sold.length, totalCount: records.length };
  }, [sold, records]);

  return (
    <section className="card">
      <div className="row-between">
        <h2>損益ダッシュボード</h2>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          更新
        </button>
      </div>

      {loading && records.length === 0 && <p className="muted">読み込み中...</p>}
      {!loading && records.length === 0 && (
        <p className="muted">まだ記録がありません。判定結果を保存して実績を蓄積してください。</p>
      )}

      {records.length > 0 && (
        <>
          <div className="dash-totals">
            <div><span>総仕入</span><strong>{totals.totalCount}件</strong></div>
            <div><span>売却済</span><strong>{totals.soldCount}件</strong></div>
            <div><span>累計売上</span><strong>{yen(totals.revenue)}</strong></div>
            <div><span>累計仕入コスト</span><strong>{yen(totals.cost)}</strong></div>
            <div className={totals.profit >= 0 ? 'positive' : 'negative'}>
              <span>累計粗利</span><strong>{yen(totals.profit)}</strong>
            </div>
            {turnover && (
              <div><span>平均回転日数</span><strong>{turnover.avg}日 (中央値 {turnover.median}日)</strong></div>
            )}
          </div>

          {monthly.length > 0 && (
            <div className="dash-block">
              <h3>月別粗利（直近6ヶ月）</h3>
              <div className="bar-chart">
                {monthly.map(([m, v]) => {
                  const ratio = Math.abs(v.profit) / maxMonthlyProfit;
                  return (
                    <div key={m} className="bar-row">
                      <span className="bar-label">{m}</span>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${v.profit >= 0 ? 'pos' : 'neg'}`}
                          style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                        />
                      </div>
                      <span className={`bar-val ${v.profit >= 0 ? 'pos' : 'neg'}`}>
                        {yen(v.profit)} <span className="muted small">/ {v.count}件</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {brandRanking.length > 0 && (
            <div className="dash-block">
              <h3><Tag size={14} /> ブランド別粗利ランキング (TOP5)</h3>
              <div className="rank-table">
                <div className="rank-row rank-head">
                  <span>ブランド</span>
                  <span>件数</span>
                  <span>累計粗利</span>
                  <span>平均粗利</span>
                </div>
                {brandRanking.map((b, i) => (
                  <div key={i} className="rank-row">
                    <span>{b.brand}</span>
                    <span>{b.count}件</span>
                    <span className={b.profit >= 0 ? 'positive' : 'negative'}><b>{yen(b.profit)}</b></span>
                    <span>{yen(b.avg)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {storeRanking.length > 0 && (
            <div className="dash-block">
              <h3><MapPin size={14} /> 店舗別 収益分析</h3>
              <div className="rank-table">
                <div className="rank-row rank-head store-head">
                  <span>店舗</span>
                  <span>仕入件数</span>
                  <span>売却件数</span>
                  <span>平均粗利</span>
                  <span>想定範囲ヒット率</span>
                </div>
                {storeRanking.map((s, i) => (
                  <div key={i} className="rank-row store-row">
                    <span>{s.store}</span>
                    <span>{s.count}件</span>
                    <span>{s.soldCount}件</span>
                    <span className={s.avgProfit >= 0 ? 'positive' : 'negative'}>
                      <b>{s.soldCount > 0 ? yen(s.avgProfit) : '-'}</b>
                    </span>
                    <span>{s.soldCount > 0 ? `${s.hitRate}%` : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deadStock.length > 0 && (
            <div className="dash-block">
              <h3 className="warn"><AlertTriangle size={14} /> 不良在庫（30日以上未売却）</h3>
              <div className="rank-table">
                <div className="rank-row rank-head">
                  <span>商品</span>
                  <span>仕入</span>
                  <span>想定</span>
                  <span>経過日数</span>
                </div>
                {deadStock.slice(0, 10).map(({ r, days }) => (
                  <div key={r.id} className="rank-row">
                    <span>{r.brand_jp || r.brand || '(未設定)'} / {r.item_type || '-'}</span>
                    <span>{yen(r.purchase_price)}</span>
                    <span>{yen(r.estimated_sale_min)}〜{yen(r.estimated_sale_max)}</span>
                    <span className={days >= 60 ? 'negative' : 'warn'}><b>{days}日</b></span>
                  </div>
                ))}
              </div>
              {deadStock.length > 10 && (
                <p className="hint">他 {deadStock.length - 10}件あります。</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

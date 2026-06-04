import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Save, X, RefreshCw, Loader as Loader2 } from 'lucide-react';
import { supabase, type PurchaseRecord } from '../lib/supabase';
import { yen } from '../lib/number';

const STATUS_LABEL: Record<PurchaseRecord['status'], string> = {
  purchased: '仕入済',
  listed: '出品中',
  sold: '売却済',
  returned: '返品',
};

type StatusFilter = 'all' | PurchaseRecord['status'];

export function Records() {
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [brandQuery, setBrandQuery] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRecords(data as PurchaseRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm('この記録を削除しますか？')) return;
    await supabase.from('purchase_records').delete().eq('id', id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${r.brand} ${r.brand_jp} ${r.item_type} ${r.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [records, statusFilter, brandQuery]);

  const stats = useMemo(() => {
    const total = records.length;
    const sold = records.filter((r) => r.status === 'sold' && r.sold_price != null);
    const soldCount = sold.length;
    const profits = sold.map((r) =>
      (r.sold_price ?? 0) - (r.actual_shipping ?? 0) - (r.fee ?? 0) - r.purchase_price,
    );
    const avgProfit = profits.length
      ? Math.round(profits.reduce((a, b) => a + b, 0) / profits.length)
      : 0;
    const inRange = sold.filter(
      (r) => (r.sold_price ?? 0) >= r.estimated_sale_min && (r.sold_price ?? 0) <= r.estimated_sale_max,
    ).length;
    const hitRate = soldCount > 0 ? Math.round((inRange / soldCount) * 100) : 0;
    const avgScore = total > 0
      ? Math.round(records.reduce((a, r) => a + (r.ai_score || 0), 0) / total)
      : 0;
    return { total, soldCount, avgProfit, hitRate, avgScore };
  }, [records]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: records.length, purchased: 0, listed: 0, sold: 0, returned: 0 };
    for (const r of records) c[r.status] += 1;
    return c;
  }, [records]);

  const filterButtons: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: 'すべて' },
    { key: 'purchased', label: '仕入済' },
    { key: 'listed', label: '出品中' },
    { key: 'sold', label: '売却済' },
    { key: 'returned', label: '返品' },
  ];

  return (
    <section className="card">
      <div className="row-between">
        <h2>仕入れ記録</h2>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          更新
        </button>
      </div>

      {records.length > 0 && (
        <div className="records-stats">
          <div><span>総件数</span><strong>{stats.total}件</strong></div>
          <div><span>売却済</span><strong>{stats.soldCount}件</strong></div>
          <div><span>平均粗利（売却済）</span><strong>{stats.soldCount > 0 ? yen(stats.avgProfit) : '-'}</strong></div>
          <div>
            <span>想定範囲ヒット率</span>
            <strong>{stats.soldCount > 0 ? `${stats.hitRate}%` : '-'}</strong>
          </div>
          <div><span>平均AIスコア</span><strong>{stats.total > 0 ? stats.avgScore : '-'}</strong></div>
        </div>
      )}

      {records.length > 0 && (
        <div className="records-filter">
          <div className="filter-pills">
            {filterButtons.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`filter-pill ${statusFilter === b.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(b.key)}
              >
                {b.label}
                <span className="filter-count">{counts[b.key]}</span>
              </button>
            ))}
          </div>
          <input
            className="filter-search"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder="ブランド・服種類で絞り込み"
          />
        </div>
      )}

      {loading && records.length === 0 && <p className="muted">読み込み中...</p>}
      {!loading && records.length === 0 && <p className="muted">まだ記録がありません。判定結果を保存して蓄積していきましょう。</p>}
      {!loading && records.length > 0 && filtered.length === 0 && (
        <p className="muted">条件に一致する記録がありません。</p>
      )}

      <div className="records-list">
        {filtered.map((r) => {
          const inRange =
            r.status === 'sold' && r.sold_price != null
              ? r.sold_price >= r.estimated_sale_min && r.sold_price <= r.estimated_sale_max
              : null;
          return (
            <div key={r.id} className="record-item">
              <div className="record-head">
                <div>
                  <span className={`status-badge st-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  <strong>{r.brand_jp || r.brand || '(未設定)'}</strong>
                  <span className="muted"> / {r.item_type || '-'}</span>
                </div>
                <div className="record-actions">
                  <button className="icon-btn" onClick={() => setEditing(editing === r.id ? null : r.id)} aria-label="編集">
                    <Save size={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(r.id)} aria-label="削除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="record-body">
                <p className="muted">
                  仕入：{yen(r.purchase_price)} / 想定：{yen(r.estimated_sale_min)}〜{yen(r.estimated_sale_max)} / スコア：{r.ai_score} {r.ai_decision}
                </p>
                {r.status === 'sold' && r.sold_price != null && (
                  <p className="profit">
                    実売：{yen(r.sold_price)} - 送料{yen(r.actual_shipping ?? 0)} - 手数料{yen(r.fee ?? 0)} - 仕入{yen(r.purchase_price)}
                    {' = '}
                    <b>{yen((r.sold_price ?? 0) - (r.actual_shipping ?? 0) - (r.fee ?? 0) - r.purchase_price)}</b>
                    {inRange != null && (
                      <span className={`hit-pill ${inRange ? 'hit' : 'miss'}`}>
                        {inRange ? '想定範囲内' : '想定範囲外'}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {editing === r.id && <SaleEditor record={r} onClose={() => setEditing(null)} onSaved={load} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SaleEditor({
  record,
  onClose,
  onSaved,
}: {
  record: PurchaseRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<PurchaseRecord['status']>(record.status);
  const [soldPrice, setSoldPrice] = useState<string>(String(record.sold_price ?? ''));
  const [actualShipping, setActualShipping] = useState<string>(String(record.actual_shipping ?? ''));
  const [fee, setFee] = useState<string>(String(record.fee ?? ''));
  const [notes, setNotes] = useState(record.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const update: Partial<PurchaseRecord> = {
      status,
      sold_price: soldPrice ? Number(soldPrice) : null,
      actual_shipping: actualShipping ? Number(actualShipping) : null,
      fee: fee ? Number(fee) : null,
      sold_at: status === 'sold' ? new Date().toISOString() : record.sold_at,
      notes,
      updated_at: new Date().toISOString(),
    };
    if (status === 'sold' && soldPrice && !fee) {
      update.fee = Math.round(Number(soldPrice) * 0.1);
    }
    const { error } = await supabase.from('purchase_records').update(update).eq('id', record.id);
    setSaving(false);
    if (!error) {
      onSaved();
      onClose();
    } else {
      alert(`保存失敗: ${error.message}`);
    }
  }

  return (
    <div className="sale-editor">
      <div className="form-grid">
        <label className="field">
          <span>ステータス</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as PurchaseRecord['status'])}>
            <option value="purchased">仕入済</option>
            <option value="listed">出品中</option>
            <option value="sold">売却済</option>
            <option value="returned">返品</option>
          </select>
        </label>
        <label className="field">
          <span>実販売価格</span>
          <input type="number" inputMode="numeric" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} placeholder="例：12800" />
        </label>
        <label className="field">
          <span>実送料</span>
          <input type="number" inputMode="numeric" value={actualShipping} onChange={(e) => setActualShipping(e.target.value)} placeholder="例：750" />
        </label>
        <label className="field">
          <span>手数料 (空欄なら10%)</span>
          <input type="number" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="例：1280" />
        </label>
      </div>
      <label className="field">
        <span>メモ</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="返品理由・注意点など" />
      </label>
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <X size={16} /> キャンセル
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
          保存
        </button>
      </div>
    </div>
  );
}

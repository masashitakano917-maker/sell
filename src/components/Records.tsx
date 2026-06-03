import React, { useEffect, useState } from 'react';
import { Trash2, Save, X, RefreshCw, Loader2 } from 'lucide-react';
import { supabase, type PurchaseRecord } from '../lib/supabase';
import { yen } from '../lib/number';

const STATUS_LABEL: Record<PurchaseRecord['status'], string> = {
  purchased: '仕入済',
  listed: '出品中',
  sold: '売却済',
  returned: '返品',
};

export function Records() {
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

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

  return (
    <section className="card">
      <div className="row-between">
        <h2>仕入れ記録</h2>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          更新
        </button>
      </div>

      {loading && records.length === 0 && <p className="muted">読み込み中...</p>}
      {!loading && records.length === 0 && <p className="muted">まだ記録がありません。判定結果を保存して蓄積していきましょう。</p>}

      <div className="records-list">
        {records.map((r) => (
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
                </p>
              )}
            </div>
            {editing === r.id && <SaleEditor record={r} onClose={() => setEditing(null)} onSaved={load} />}
          </div>
        ))}
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

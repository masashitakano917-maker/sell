import React from 'react';
import { Camera, Sparkles, Loader as Loader2, Search } from 'lucide-react';
import type { ProductInput } from '../types';
import { CATEGORIES, ITEM_TYPES, BRANDS, CONDITIONS, sizesForCategory } from '../lib/options';

type Props = {
  input: ProductInput;
  onChange: (next: ProductInput) => void;
  images: string[];
  onImages: (files: FileList | null) => void;
  onAnalyzeImages: () => void;
  analyzing: boolean;
  aiAvailable: boolean;
  onSearchComps: () => void;
  searching: boolean;
  canSearchComps: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PurchaseForm({ input, onChange, images, onImages, onAnalyzeImages, analyzing, aiAvailable, onSearchComps, searching, canSearchComps }: Props) {
  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    onChange({ ...input, [key]: value });
  }

  const sizeOptions = sizesForCategory(input.category);

  return (
    <section className="card input-card">
      <h2>商品入力</h2>
      <div className="form-grid">
        <Field label="ブランド">
          <input
            list="brand-options"
            value={input.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="例：CELFORD"
          />
          <datalist id="brand-options">
            {BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </datalist>
        </Field>

        <Field label="カテゴリ">
          <select value={input.category} onChange={(e) => update('category', e.target.value)}>
            <option value="">選択してください</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="服種類">
          <select value={input.itemType} onChange={(e) => update('itemType', e.target.value)}>
            <option value="">選択してください</option>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="サイズ">
          <select value={input.size} onChange={(e) => update('size', e.target.value)}>
            <option value="">選択してください</option>
            {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="素材">
          <input value={input.material} onChange={(e) => update('material', e.target.value)} placeholder="例：シルク100% / リネン" />
        </Field>

        <Field label="状態">
          <select value={input.condition} onChange={(e) => update('condition', e.target.value)}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="仕入れ値">
          <input type="number" inputMode="numeric" value={input.purchasePrice || ''} onChange={(e) => update('purchasePrice', Number(e.target.value))} placeholder="3960" />
        </Field>

        <Field label="想定送料">
          <input type="number" inputMode="numeric" value={input.expectedShipping ?? ''} onChange={(e) => update('expectedShipping', e.target.value ? Number(e.target.value) : undefined)} placeholder="未入力なら自動" />
        </Field>

        <Field label="売り切れ相場件数">
          <input type="number" inputMode="numeric" value={input.soldCompsCount || ''} onChange={(e) => update('soldCompsCount', Number(e.target.value))} placeholder="3" />
        </Field>
      </div>

      <div className="checks">
        <label><input type="checkbox" checked={input.hasTag} onChange={(e) => update('hasTag', e.target.checked)} /> 新品タグ付き</label>
        <label><input type="checkbox" checked={input.hasDamage} onChange={(e) => update('hasDamage', e.target.checked)} /> ダメージあり</label>
        <label><input type="checkbox" checked={input.hasSmell} onChange={(e) => update('hasSmell', e.target.checked)} /> 臭いあり</label>
        <label><input type="checkbox" checked={input.authenticityUnclear} onChange={(e) => update('authenticityUnclear', e.target.checked)} /> 真贋不明</label>
      </div>

      <div className="upload">
        <Camera />
        <div style={{ flex: 1 }}>
          <strong>写真撮影・アップロード</strong>
          <p>その場で撮影 or アップロードして AI に自動入力させられます。</p>
          <div className="upload-buttons">
            <label className="btn btn-ghost">
              <Camera size={16} /> 撮影する
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => onImages(e.target.files)}
              />
            </label>
            <label className="btn btn-ghost">
              アップロード
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onImages(e.target.files)}
              />
            </label>
          </div>
          {images.length > 0 && !aiAvailable && (
            <p className="hint">画像AIを使うにはエッジ関数に GEMINI_API_KEY を設定してください。</p>
          )}
        </div>
      </div>
      {images.length > 0 && (
        <div className="preview-grid">
          {images.map((src, i) => <img key={i} src={src} alt="" />)}
        </div>
      )}

      <div className="action-bar">
        <button
          type="button"
          className="btn btn-primary btn-action"
          onClick={onAnalyzeImages}
          disabled={analyzing || !aiAvailable || images.length === 0}
          title={images.length === 0 ? '先に写真をアップロードしてください' : ''}
        >
          {analyzing ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          {analyzing ? 'AI解析中...' : 'AIで自動入力'}
        </button>
        <button
          type="button"
          className="btn btn-search btn-action"
          onClick={onSearchComps}
          disabled={searching || !canSearchComps}
          title={!canSearchComps ? 'ブランドや服種類を入力してください' : ''}
        >
          {searching ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
          {searching ? '検索中...' : 'メルカリ・PayPayで売り切れ検索'}
        </button>
      </div>
    </section>
  );
}

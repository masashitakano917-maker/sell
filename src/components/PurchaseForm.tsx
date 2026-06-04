import React from 'react';
import { Camera, Loader as Loader2, Sparkles } from 'lucide-react';
import type { ProductInput } from '../types';
import { CATEGORIES, ITEM_TYPES, CONDITIONS, sizesForCategory } from '../lib/options';
import { BrandCombobox } from './BrandCombobox';

type Props = {
  input: ProductInput;
  onChange: (next: ProductInput) => void;
  images: string[];
  onImages: (files: FileList | null) => void;
  onJudge: () => void;
  judging: boolean;
  aiAvailable: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function PurchaseForm({ input, onChange, images, onImages, onJudge, judging, aiAvailable }: Props) {
  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    onChange({ ...input, [key]: value });
  }

  const sizeOptions = sizesForCategory(input.category);

  return (
    <section className="card input-card">
      <h2>商品入力</h2>
      <div className="form-grid">
        <Field label="ブランド">
          <BrandCombobox value={input.brand} onChange={(v) => update('brand', v)} />
        </Field>

        <Field label="カテゴリ">
          <select value={input.category} onChange={(e) => update('category', e.target.value)}>
            <option value="">選択してください</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="服種類">
          <input
            list="item-type-options"
            value={input.itemType}
            onChange={(e) => update('itemType', e.target.value)}
            placeholder="例：ブラウス（候補から選択 or 自由入力）"
          />
          <datalist id="item-type-options">
            {ITEM_TYPES.map((t) => <option key={t} value={t} />)}
          </datalist>
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
          <p>キズ・汚れ・型などの確認に使用します。手入力の内容と画像の両方をAIが照合して判定します。</p>
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
          className="btn btn-primary btn-action btn-judge"
          onClick={onJudge}
          disabled={judging}
        >
          {judging ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
          {judging ? 'AI判定中...' : 'AI判定する'}
        </button>
      </div>
    </section>
  );
}

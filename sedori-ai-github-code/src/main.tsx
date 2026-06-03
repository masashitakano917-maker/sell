import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, ExternalLink, Search, Sparkles } from 'lucide-react';
import masterData from './data/master.json';
import type { MasterRule, ProductInput } from './types';
import { filterRules, findBestRule } from './lib/search';
import { judgeProduct } from './lib/judge';
import { yen } from './lib/number';
import './styles.css';

const rules = masterData as MasterRule[];

const emptyInput: ProductInput = {
  brand: '',
  category: '',
  itemType: '',
  size: '',
  material: '',
  condition: '美品',
  purchasePrice: 0,
  expectedShipping: undefined,
  soldCompsCount: 0,
  hasTag: false,
  hasDamage: false,
  hasSmell: false,
  authenticityUnclear: false,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function App() {
  const [input, setInput] = useState<ProductInput>(emptyInput);
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const result = useMemo(() => judgeProduct(rules, input), [input]);
  const bestRule = useMemo(() => findBestRule(rules, input.brand, input.itemType, input.category), [input.brand, input.itemType, input.category]);
  const searchRows = useMemo(() => filterRules(rules, query), [query]);

  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function onImages(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, 8);
    Promise.all(files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    }))).then(setImages);
  }

  const decisionClass = result.decision === '買い' ? 'buy' : result.decision === '条件付き買い' ? 'maybe' : result.decision === '慎重' ? 'careful' : 'stop';

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Sedori AI Judge MVP</p>
          <h1>店舗せどり仕入れ判定</h1>
          <p>v4マスター {rules.length}件を使って、仕入れ値・ブランド・服種類・状態から買い/見送りを判定します。</p>
        </div>
        <Sparkles size={44} />
      </header>

      <main className="grid">
        <section className="card input-card">
          <h2>商品入力</h2>
          <div className="form-grid">
            <Field label="ブランド"><input value={input.brand} onChange={(e) => update('brand', e.target.value)} placeholder="例：CELFORD" /></Field>
            <Field label="カテゴリ"><input value={input.category} onChange={(e) => update('category', e.target.value)} placeholder="例：レディース服" /></Field>
            <Field label="服種類"><input value={input.itemType} onChange={(e) => update('itemType', e.target.value)} placeholder="例：レースワンピース" /></Field>
            <Field label="サイズ"><input value={input.size} onChange={(e) => update('size', e.target.value)} placeholder="例：38 / L / 15号" /></Field>
            <Field label="素材"><input value={input.material} onChange={(e) => update('material', e.target.value)} placeholder="例：シルク100% / リネン" /></Field>
            <Field label="状態"><input value={input.condition} onChange={(e) => update('condition', e.target.value)} placeholder="例：美品" /></Field>
            <Field label="仕入れ値"><input type="number" value={input.purchasePrice || ''} onChange={(e) => update('purchasePrice', Number(e.target.value))} placeholder="3960" /></Field>
            <Field label="想定送料"><input type="number" value={input.expectedShipping ?? ''} onChange={(e) => update('expectedShipping', e.target.value ? Number(e.target.value) : undefined)} placeholder="未入力なら自動" /></Field>
            <Field label="売り切れ相場件数"><input type="number" value={input.soldCompsCount || ''} onChange={(e) => update('soldCompsCount', Number(e.target.value))} placeholder="3" /></Field>
          </div>

          <div className="checks">
            <label><input type="checkbox" checked={input.hasTag} onChange={(e) => update('hasTag', e.target.checked)} /> 新品タグ付き/タグあり</label>
            <label><input type="checkbox" checked={input.hasDamage} onChange={(e) => update('hasDamage', e.target.checked)} /> ダメージあり</label>
            <label><input type="checkbox" checked={input.hasSmell} onChange={(e) => update('hasSmell', e.target.checked)} /> 臭いあり</label>
            <label><input type="checkbox" checked={input.authenticityUnclear} onChange={(e) => update('authenticityUnclear', e.target.checked)} /> 真贋不明</label>
          </div>

          <div className="upload">
            <Camera />
            <div>
              <strong>写真アップロード</strong>
              <p>現時点ではプレビューのみ。次段階で画像AI判定へ接続します。</p>
              <input type="file" multiple accept="image/*" onChange={(e) => onImages(e.target.files)} />
            </div>
          </div>
          {images.length > 0 && <div className="preview-grid">{images.map((src, i) => <img key={i} src={src} />)}</div>}
        </section>

        <section className={`card result-card ${decisionClass}`}>
          <h2>AI判定</h2>
          <div className="score-row">
            <div className="score">{result.score}</div>
            <div>
              <p className="decision">{result.decision}</p>
              <p>想定販売：{yen(result.estimatedSaleMin)}〜{yen(result.estimatedSaleMax)}</p>
              <p>想定粗利：{yen(result.estimatedProfitMin)}〜{yen(result.estimatedProfitMax)}</p>
            </div>
          </div>

          {bestRule && (
            <div className="matched">
              <h3>一致したマスター</h3>
              <p><b>{bestRule.ブランド日本語 || bestRule.ブランド}</b> / {bestRule.服種類}</p>
              <p>{bestRule['商品名・狙い目']}</p>
              <p>優先度：{bestRule.優先度} / 仕入れ上限：{bestRule.仕入れ上限} / 販売目安：{bestRule.想定販売価格}</p>
            </div>
          )}

          <h3>理由</h3>
          <ul>{result.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h3>注意</h3>
          <ul>{result.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h3>次にやること</h3>
          <ul>{result.nextActions.map((x, i) => <li key={i}>{x.startsWith('相場検索：') ? <a href={x.replace('相場検索：', '')} target="_blank">メルカリ検索を開く <ExternalLink size={14}/></a> : x}</li>)}</ul>
        </section>
      </main>

      <section className="card search-card">
        <h2><Search size={20}/> マスター検索</h2>
        <input className="wide" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ブランド名、商品名、カテゴリで検索" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>優先度</th><th>ブランド</th><th>カテゴリ</th><th>狙い目</th><th>上限</th><th>販売目安</th><th>検索</th></tr></thead>
            <tbody>
              {searchRows.map((r) => (
                <tr key={r.rule_id} onClick={() => setInput((prev) => ({ ...prev, brand: r.ブランド, category: r.カテゴリ, itemType: r.服種類 }))}>
                  <td><span className={`badge p-${r.優先度}`}>{r.優先度}</span></td>
                  <td>{r.ブランド日本語 || r.ブランド}<br/><small>{r.ブランド}</small></td>
                  <td>{r.カテゴリ}</td>
                  <td>{r['商品名・狙い目']}</td>
                  <td>{r.仕入れ上限}</td>
                  <td>{r.想定販売価格}</td>
                  <td>{r.メルカリ検索URL1 && <a href={r.メルカリ検索URL1} target="_blank" onClick={(e) => e.stopPropagation()}>開く</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

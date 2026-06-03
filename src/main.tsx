import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, LogOut, ClipboardList, Search as SearchIcon, Layers } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import masterData from './data/master.json';
import type { MasterRule, ProductInput } from './types';
import { findBestRule } from './lib/search';
import { judgeProduct, type SaleOverride } from './lib/judge';
import { fetchSaleOverride } from './lib/sales';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { PurchaseForm } from './components/PurchaseForm';
import { JudgeResultCard } from './components/JudgeResultCard';
import { Records } from './components/Records';
import { MasterSearch } from './components/MasterSearch';
import { CompSearch, type CompSearchData } from './components/CompSearch';
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

type Tab = 'judge' | 'records' | 'master';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>('judge');

  const [input, setInput] = useState<ProductInput>(emptyInput);
  const [images, setImages] = useState<string[]>([]);

  const [useActualSales, setUseActualSales] = useState(false);
  const [saleOverride, setSaleOverride] = useState<SaleOverride | null>(null);
  const [applyingSales, setApplyingSales] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const [compKeyword, setCompKeyword] = useState('');
  const [compLoading, setCompLoading] = useState(false);
  const [compData, setCompData] = useState<CompSearchData | null>(null);
  const [compMatching, setCompMatching] = useState(false);
  const lastAutoKeyword = useRef<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const result = useMemo(
    () => judgeProduct(rules, input, useActualSales ? saleOverride : null),
    [input, useActualSales, saleOverride],
  );
  const bestRule = useMemo(
    () => findBestRule(rules, input.brand, input.itemType, input.category),
    [input.brand, input.itemType, input.category],
  );

  useEffect(() => {
    const parts = [input.brand, input.itemType, input.size].filter(Boolean);
    const auto = parts.join(' ').trim();
    setCompKeyword((prev) => (prev === '' || prev === lastAutoKeyword.current ? auto : prev));
    lastAutoKeyword.current = auto;
  }, [input.brand, input.itemType, input.size]);

  async function searchComps() {
    const kw = compKeyword.trim();
    if (!kw) return;
    setCompLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-comps`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: kw }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CompSearchData;
      setCompData(data);
      const totalAvg = data.overall.average;
      const totalCount = data.overall.count;
      if (totalCount > 0) {
        setInput((prev) => ({ ...prev, soldCompsCount: totalCount }));
        setSaleOverride({ saleMin: totalAvg, saleMax: totalAvg, sampleCount: totalCount });
        setUseActualSales(true);
      }
    } catch (e) {
      alert(`売り切れ検索に失敗しました: ${(e as Error).message}`);
    } finally {
      setCompLoading(false);
    }
  }

  async function matchComps() {
    if (!compData || images.length === 0) return;
    setCompMatching(true);
    try {
      const candidates = [
        ...compData.mercari.items.map((it, i) => ({ id: `m_${i}`, thumbnail: it.thumbnail, title: it.title, site: 'mercari' as const, idx: i })),
        ...compData.paypay.items.map((it, i) => ({ id: `p_${i}`, thumbnail: it.thumbnail, title: it.title, site: 'paypay' as const, idx: i })),
      ].filter((c) => !!c.thumbnail);

      if (candidates.length === 0) {
        alert('サムネイル画像が無いため照合できません。');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-items`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference: images,
          candidates: candidates.map((c) => ({ id: c.id, thumbnail: c.thumbnail, title: c.title })),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const out = (await res.json()) as { matches: Array<{ id: string; candidateId?: string; level: 'same' | 'similar' | 'different' | 'unknown'; reason?: string }> };

      const labelToCandidate = new Map<string, typeof candidates[number]>();
      candidates.forEach((c, i) => labelToCandidate.set(`C${i + 1}`, c));

      const next: CompSearchData = {
        ...compData,
        mercari: { ...compData.mercari, items: compData.mercari.items.map((it) => ({ ...it, match: undefined })) },
        paypay: { ...compData.paypay, items: compData.paypay.items.map((it) => ({ ...it, match: undefined })) },
      };

      for (const m of out.matches) {
        const cand = labelToCandidate.get(m.id);
        if (!cand) continue;
        const target = cand.site === 'mercari' ? next.mercari.items[cand.idx] : next.paypay.items[cand.idx];
        if (target) target.match = { level: m.level, reason: m.reason };
      }

      setCompData(next);

      const samePrices = [
        ...next.mercari.items.filter((i) => i.match?.level === 'same').map((i) => i.price),
        ...next.paypay.items.filter((i) => i.match?.level === 'same').map((i) => i.price),
      ];
      if (samePrices.length > 0) {
        const avg = Math.round(samePrices.reduce((a, b) => a + b, 0) / samePrices.length);
        setInput((prev) => ({ ...prev, soldCompsCount: samePrices.length }));
        setSaleOverride({ saleMin: avg, saleMax: avg, sampleCount: samePrices.length });
        setUseActualSales(true);
      }
    } catch (e) {
      alert(`画像照合に失敗しました: ${(e as Error).message}`);
    } finally {
      setCompMatching(false);
    }
  }

  function onImages(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, 8);
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(file);
          }),
      ),
    ).then(setImages);
  }

  async function analyzeImages() {
    if (images.length === 0) return;
    setAnalyzing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) {
        if (res.status === 503) setAiAvailable(false);
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInput((prev) => ({
        ...prev,
        brand: data.brand || prev.brand,
        category: data.category || prev.category,
        itemType: data.itemType || prev.itemType,
        size: data.size || prev.size,
        material: data.material || prev.material,
        condition: data.condition || prev.condition,
        hasTag: data.hasTag ?? prev.hasTag,
        hasDamage: data.hasDamage ?? prev.hasDamage,
      }));
    } catch (e) {
      alert(`画像AI判定に失敗しました: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyActualSales() {
    setApplyingSales(true);
    try {
      const ov = await fetchSaleOverride(input);
      setSaleOverride(ov);
      if (!ov) {
        alert('同条件の売却済データが見つかりませんでした。');
      }
    } finally {
      setApplyingSales(false);
    }
  }

  function toggleActualSales(next: boolean) {
    setUseActualSales(next);
    if (!next) setSaleOverride(null);
  }

  async function saveRecord() {
    if (!session) return;
    if (!input.brand && !input.category) {
      alert('ブランドかカテゴリを入力してください。');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('purchase_records').insert({
      user_id: session.user.id,
      brand: input.brand,
      brand_jp: bestRule?.ブランド日本語 ?? '',
      category: input.category,
      item_type: input.itemType,
      size: input.size,
      material: input.material,
      condition: input.condition,
      purchase_price: input.purchasePrice,
      expected_shipping: input.expectedShipping ?? null,
      sold_comps_count: input.soldCompsCount,
      has_tag: input.hasTag,
      has_damage: input.hasDamage,
      has_smell: input.hasSmell,
      authenticity_unclear: input.authenticityUnclear,
      rule_id: bestRule?.rule_id ?? '',
      ai_score: result.score,
      ai_decision: result.decision,
      estimated_sale_min: Math.round(result.estimatedSaleMin),
      estimated_sale_max: Math.round(result.estimatedSaleMax),
      status: 'purchased',
    });
    setSaving(false);
    if (error) {
      alert(`保存失敗: ${error.message}`);
    } else {
      alert('仕入れ記録を保存しました。');
      setInput(emptyInput);
      setImages([]);
      setSaleOverride(null);
      setUseActualSales(false);
    }
  }

  function pickRule(r: MasterRule) {
    setInput((prev) => ({
      ...prev,
      brand: r.ブランド,
      category: r.カテゴリ,
      itemType: r.服種類,
    }));
    setTab('judge');
  }

  if (!authReady) return <div className="splash">読み込み中...</div>;
  if (!session) return <Auth />;

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Sedori AI Judge</p>
          <h1>店舗せどり仕入れ判定</h1>
          <p className="hero-sub">v4マスター {rules.length}件＋自分の実売データで仕入れ判定。</p>
        </div>
        <div className="hero-right">
          <Sparkles size={40} />
          <button className="btn btn-ghost-light" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> ログアウト
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'judge' ? 'active' : ''} onClick={() => setTab('judge')}>
          <Sparkles size={18} /> <span>判定</span>
        </button>
        <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>
          <ClipboardList size={18} /> <span>記録</span>
        </button>
        <button className={tab === 'master' ? 'active' : ''} onClick={() => setTab('master')}>
          <Layers size={18} /> <span>マスター</span>
        </button>
      </nav>

      {tab === 'judge' && (
        <main className="grid">
          <PurchaseForm
            input={input}
            onChange={setInput}
            images={images}
            onImages={onImages}
            onAnalyzeImages={analyzeImages}
            analyzing={analyzing}
            aiAvailable={aiAvailable}
          />
          <JudgeResultCard
            result={result}
            bestRule={bestRule}
            useActualSales={useActualSales}
            onToggleActualSales={toggleActualSales}
            onApplyActualSales={applyActualSales}
            applyingSales={applyingSales}
            saleOverride={saleOverride}
            onSave={saveRecord}
            saving={saving}
          />
          <CompSearch
            keyword={compKeyword}
            onKeyword={setCompKeyword}
            onSearch={searchComps}
            loading={compLoading}
            data={compData}
            hasReferenceImages={images.length > 0}
            onMatch={matchComps}
            matching={compMatching}
          />
        </main>
      )}

      {tab === 'records' && <Records />}
      {tab === 'master' && <MasterSearch rules={rules} onPick={pickRule} />}

      <nav className="bottom-tabs">
        <button className={tab === 'judge' ? 'active' : ''} onClick={() => setTab('judge')}>
          <Sparkles size={20} /> <span>判定</span>
        </button>
        <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>
          <ClipboardList size={20} /> <span>記録</span>
        </button>
        <button className={tab === 'master' ? 'active' : ''} onClick={() => setTab('master')}>
          <SearchIcon size={20} /> <span>マスター</span>
        </button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

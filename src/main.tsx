import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, LogOut, ClipboardList, Search as SearchIcon, Layers, Target, Check } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import masterData from './data/master.json';
import type { MasterRule, ProductInput } from './types';
import { findBestRule, getBrandCoverage } from './lib/search';
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
  const [judgeMode, setJudgeMode] = useState<'master' | 'comps' | 'blended' | null>(null);
  const [imageNotes, setImageNotes] = useState<string[]>([]);

  const [compKeyword, setCompKeyword] = useState('');
  const [compLoading, setCompLoading] = useState(false);
  const [compData, setCompData] = useState<CompSearchData | null>(null);
  const [compMatching, setCompMatching] = useState(false);
  const lastAutoKeyword = useRef<string>('');

  const [targetProfit, setTargetProfit] = useState<number>(2500);
  const [targetProfitDraft, setTargetProfitDraft] = useState<string>('2500');
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetSavedAt, setTargetSavedAt] = useState<number>(0);

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

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('target_profit')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && typeof data.target_profit === 'number') {
        setTargetProfit(data.target_profit);
        setTargetProfitDraft(String(data.target_profit));
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  async function saveTargetProfit() {
    if (!session) return;
    const v = Math.max(0, Math.round(Number(targetProfitDraft) || 0));
    setSavingTarget(true);
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: session.user.id, target_profit: v, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    setSavingTarget(false);
    if (error) {
      alert(`目標粗利の保存に失敗しました：${error.message}`);
      return;
    }
    setTargetProfit(v);
    setTargetProfitDraft(String(v));
    setTargetSavedAt(Date.now());
  }

  const result = useMemo(
    () => judgeProduct(rules, input, useActualSales ? saleOverride : null, targetProfit),
    [input, useActualSales, saleOverride, targetProfit],
  );
  const bestRule = useMemo(
    () => findBestRule(rules, input.brand, input.itemType, input.category),
    [input.brand, input.itemType, input.category],
  );
  const brandCoverage = useMemo(
    () => getBrandCoverage(rules, input.brand, input.itemType),
    [input.brand, input.itemType],
  );

  useEffect(() => {
    const parts = [input.brand, input.itemType, input.size].filter(Boolean);
    const auto = parts.join(' ').trim();
    setCompKeyword((prev) => (prev === '' || prev === lastAutoKeyword.current ? auto : prev));
    lastAutoKeyword.current = auto;
  }, [input.brand, input.itemType, input.size]);

  async function fetchComps(keyword: string): Promise<CompSearchData | null> {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-comps`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return (await res.json()) as CompSearchData;
  }

  async function searchComps() {
    const kw = compKeyword.trim();
    if (!kw) return;
    setCompLoading(true);
    try {
      const data = await fetchComps(kw);
      if (!data) return;
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

  async function runMatch(
    base: CompSearchData,
    refImages: string[],
  ): Promise<{ data: CompSearchData; sameCount: number; sameAvg: number; sameMin: number; sameMax: number; similarCount: number; similarAvg: number } | null> {
    const candidates = [
      ...base.mercari.items.map((it, i) => ({ id: `m_${i}`, thumbnail: it.thumbnail, title: it.title, site: 'mercari' as const, idx: i })),
      ...base.paypay.items.map((it, i) => ({ id: `p_${i}`, thumbnail: it.thumbnail, title: it.title, site: 'paypay' as const, idx: i })),
    ].filter((c) => !!c.thumbnail);
    if (candidates.length === 0) return null;

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-items`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: refImages,
        candidates: candidates.map((c) => ({ id: c.id, thumbnail: c.thumbnail, title: c.title })),
      }),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { matches: Array<{ id: string; level: 'same' | 'similar' | 'different' | 'unknown'; reason?: string }> };

    const labelToCandidate = new Map<string, typeof candidates[number]>();
    candidates.forEach((c, i) => labelToCandidate.set(`C${i + 1}`, c));

    const next: CompSearchData = {
      ...base,
      mercari: { ...base.mercari, items: base.mercari.items.map((it) => ({ ...it, match: undefined })) },
      paypay: { ...base.paypay, items: base.paypay.items.map((it) => ({ ...it, match: undefined })) },
    };

    for (const m of out.matches) {
      const cand = labelToCandidate.get(m.id);
      if (!cand) continue;
      const target = cand.site === 'mercari' ? next.mercari.items[cand.idx] : next.paypay.items[cand.idx];
      if (target) target.match = { level: m.level, reason: m.reason };
    }

    const samePrices: number[] = [];
    const similarPrices: number[] = [];
    for (const it of [...next.mercari.items, ...next.paypay.items]) {
      if (it.match?.level === 'same') samePrices.push(it.price);
      else if (it.match?.level === 'similar') similarPrices.push(it.price);
    }
    const avg = (xs: number[]) => xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    return {
      data: next,
      sameCount: samePrices.length,
      sameAvg: avg(samePrices),
      sameMin: samePrices.length ? Math.min(...samePrices) : 0,
      sameMax: samePrices.length ? Math.max(...samePrices) : 0,
      similarCount: similarPrices.length,
      similarAvg: avg(similarPrices),
    };
  }

  async function matchComps() {
    if (!compData || images.length === 0) return;
    setCompMatching(true);
    try {
      const m = await runMatch(compData, images);
      if (!m) {
        alert('サムネイル画像が無いため照合できません。');
        return;
      }
      setCompData(m.data);
      if (m.sameCount > 0) {
        setInput((prev) => ({ ...prev, soldCompsCount: m.sameCount }));
        setSaleOverride({ saleMin: m.sameMin, saleMax: m.sameMax, sampleCount: m.sameCount });
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

  async function verifyImagesOnly(): Promise<{ hasDamage?: boolean; condition?: string; notes: string[] } | null> {
    if (images.length === 0 || !aiAvailable) return null;
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
        return null;
      }
      const data = await res.json();
      const notes: string[] = [];
      if (typeof data.hasDamage === 'boolean') {
        notes.push(data.hasDamage ? '画像確認：キズ・汚れの兆候あり' : '画像確認：目立つキズ・汚れなし');
      }
      if (typeof data.damageDetails === 'string' && data.damageDetails) {
        notes.push(`詳細：${data.damageDetails}`);
      }
      if (typeof data.condition === 'string' && data.condition) {
        notes.push(`画像から推定した状態：${data.condition}`);
      }
      if (data.hasTag === true) {
        notes.push('画像確認：新品タグ写り込みあり');
      }
      return { hasDamage: data.hasDamage ?? undefined, condition: data.condition ?? undefined, notes };
    } catch {
      return null;
    }
  }

  function buildSearchKeyword(): string {
    const brandJp = bestRule?.ブランド日本語;
    const brand = (brandJp && brandJp.trim()) || input.brand.trim();
    const itemType = input.itemType.trim();
    const sizeRaw = input.size.trim();
    const size = sizeRaw.replace(/\s*\(.+\)$/, '').replace('フリー', 'F');
    const parts = [brand, itemType, size].filter(Boolean);
    return parts.join(' ').trim();
  }

  async function runAIJudge() {
    if (analyzing || compLoading || compMatching) return;
    const kw = buildSearchKeyword();
    if (!kw || kw.length < 2 || (!input.brand.trim() && !input.itemType.trim())) {
      alert('ブランドと服種類を入力してから AI判定 を押してください。');
      return;
    }

    setAnalyzing(true);
    setImageNotes([]);
    setSaleOverride(null);
    setUseActualSales(false);
    setCompKeyword(kw);

    try {
      const verify = await verifyImagesOnly();
      const notes: string[] = verify ? [...verify.notes] : [];
      if (verify && verify.hasDamage === true && !input.hasDamage) {
        setInput((prev) => ({ ...prev, hasDamage: true }));
      }

      let comp: CompSearchData | null = null;
      try {
        comp = await fetchComps(kw);
      } catch (e) {
        notes.push(`売り切れ検索に失敗：${(e as Error).message}`);
      }

      let override: SaleOverride | null = null;

      if (comp) {
        setCompData(comp);
        const totalCount = comp.overall.count;
        notes.push(`売り切れ相場検索：「${kw}」で ${totalCount}件ヒット`);

        if (images.length > 0 && totalCount > 0) {
          try {
            const m = await runMatch(comp, images);
            if (m) {
              setCompData(m.data);
              if (m.sameCount > 0) {
                override = { saleMin: m.sameMin, saleMax: m.sameMax, sampleCount: m.sameCount };
                notes.push(`画像照合：同一商品 ${m.sameCount}件 / 平均 ${m.sameAvg.toLocaleString()}円（範囲 ${m.sameMin.toLocaleString()}〜${m.sameMax.toLocaleString()}円）`);
              } else if (m.similarCount > 0) {
                override = { saleMin: m.similarAvg, saleMax: m.similarAvg, sampleCount: m.similarCount };
                notes.push(`画像照合：同一なし／類似（色違い等）${m.similarCount}件 / 平均 ${m.similarAvg.toLocaleString()}円 を参考値として採用`);
              } else {
                notes.push('画像照合：同一・類似品なし。検索結果は無関係と判定。相場は使用しません。');
              }
            } else {
              notes.push('画像照合：候補画像を取得できませんでした。');
            }
          } catch (e) {
            notes.push(`画像照合に失敗：${(e as Error).message}`);
          }
        } else if (totalCount > 0 && images.length === 0) {
          notes.push('画像未アップロードのため、検索結果との照合をスキップしました。相場の信頼度は低めです。');
          const avg = comp.overall.average;
          if (avg > 0) override = { saleMin: avg, saleMax: avg, sampleCount: totalCount };
        }
      }

      if (override) {
        setSaleOverride(override);
        setUseActualSales(true);
        setInput((prev) => ({ ...prev, soldCompsCount: override!.sampleCount }));
      }

      setImageNotes(notes);

      if (bestRule && override) setJudgeMode('blended');
      else if (bestRule) setJudgeMode('master');
      else setJudgeMode('comps');
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
        <>
          <div className="settings-strip">
            <div className="settings-strip-icon">
              <Target size={18} />
            </div>
            <div className="settings-strip-body">
              <div className="settings-strip-label">あなたの目標粗利（AI判定の基準値）</div>
              <div className="settings-strip-controls">
                <div className="yen-input">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={targetProfitDraft}
                    onChange={(e) => setTargetProfitDraft(e.target.value)}
                    placeholder="2500"
                  />
                  <span>円</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={saveTargetProfit}
                  disabled={savingTarget || Number(targetProfitDraft) === targetProfit}
                >
                  {savingTarget ? '保存中…' : Date.now() - targetSavedAt < 1500 ? <><Check size={14} /> 保存済</> : '保存'}
                </button>
              </div>
              <p className="settings-strip-hint">
                現在の基準：<strong>{targetProfit.toLocaleString()}円</strong>。AIはこの粗利が確保できるかを基準に「買い／見送り」を判定します。
              </p>
            </div>
          </div>
          <main className="grid">
            <PurchaseForm
            input={input}
            onChange={setInput}
            images={images}
            onImages={onImages}
            onJudge={runAIJudge}
            judging={analyzing || compLoading}
            aiAvailable={aiAvailable}
          />
          <JudgeResultCard
            result={result}
            bestRule={bestRule}
            brandCoverage={brandCoverage}
            judgeMode={judgeMode}
            imageNotes={imageNotes}
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
        </>
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

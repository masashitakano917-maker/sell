import React from 'react';
import { ExternalLink, RefreshCw, Save, Loader as Loader2 } from 'lucide-react';
import type { JudgeResult, MasterRule } from '../types';
import type { SaleOverride } from '../lib/judge';
import type { BrandCoverage } from '../lib/search';
import { yen } from '../lib/number';

type Props = {
  result: JudgeResult;
  bestRule: MasterRule | undefined;
  brandCoverage?: BrandCoverage;
  judgeMode?: 'master' | 'comps' | 'blended' | null;
  imageNotes?: string[];
  judgeMode?: 'master' | 'comps' | null;
  imageNotes?: string[];
  useActualSales: boolean;
  onToggleActualSales: (next: boolean) => void;
  onApplyActualSales: () => void;
  applyingSales: boolean;
  saleOverride: SaleOverride | null;
  onSave: () => void;
  saving: boolean;
};

export function JudgeResultCard({
  result,
  judgeMode,
  imageNotes,
  bestRule,
  brandCoverage,
  judgeMode,
  imageNotes,
  useActualSales,
  onToggleActualSales,
  onApplyActualSales,
  applyingSales,
  saleOverride,
  onSave,
  saving,
}: Props) {
  const decisionClass =
    result.decision === '買い' ? 'buy' :
    result.decision === '条件付き買い' ? 'maybe' :
    result.decision === '慎重' ? 'careful' : 'stop';

      {judgeMode && (
        <div className={`mode-pill mode-${judgeMode}`}>
          {judgeMode === 'master' && 'パターン1：マスタールール判定'}
          {judgeMode === 'comps' && 'パターン2：実売相場ベース判定（画像＋入力）'}
          {judgeMode === 'blended' && 'パターン1＋2：マスター × 実売相場の統合判定'}
        </div>
      )}

  return (
    <section className={`card result-card ${decisionClass}`}>
      <h2>AI判定</h2>

      {judgeMode && (
        <div className={`mode-pill mode-${judgeMode}`}>
          {judgeMode === 'master' ? 'パターン1：マスタールール判定' : 'パターン2：実売相場ベース判定（画像＋入力）'}
        </div>
      )}

      <div className="score-row">
        <div className="score">{result.score}</div>
        <div>
          <p className="decision">{result.decision}</p>
          <p>想定販売：{yen(result.estimatedSaleMin)}〜{yen(result.estimatedSaleMax)}</p>
          <p>想定粗利：{yen(result.estimatedProfitMin)}〜{yen(result.estimatedProfitMax)}</p>
          {result.suggestedMaxBuy !== undefined && result.suggestedMaxBuy > 0 && (
            <p className="suggested-max">仕入れ上限目安：<b>{yen(result.suggestedMaxBuy)}</b></p>
          )}
        </div>
      </div>

      <div className="override-box">
        <label className="toggle">
          <input
            type="checkbox"
            checked={useActualSales}
            onChange={(e) => onToggleActualSales(e.target.checked)}
          />
          <span>実売データで補正する</span>
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onApplyActualSales}
          disabled={applyingSales || !useActualSales}
        >
          {applyingSales ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          実売データを反映
        </button>
        {useActualSales && saleOverride && (
          <p className="hint">{saleOverride.sampleCount}件の実売データを反映済み</p>
        )}
        {useActualSales && !saleOverride && !applyingSales && (
          <p className="hint">同条件の実売データがまだありません。販売記録を蓄積してください。</p>
        )}
      </div>

      {bestRule ? (
        <div className="matched">
          <h3>一致したマスター</h3>
          <p><b>{bestRule.ブランド日本語 || bestRule.ブランド}</b> / {bestRule.服種類}</p>
          <p>{bestRule['商品名・狙い目']}</p>
          <p>優先度：{bestRule.優先度} / 仕入れ上限：{bestRule.仕入れ上限} / 販売目安：{bestRule.想定販売価格}</p>
        </div>
      ) : brandCoverage ? (
        <div className="matched matched-partial">
          <h3>マスター部分一致</h3>
          <p>
            <b>{brandCoverage.brandLabel}</b> はマスターに登録あり。ただし指定の服種類のデータはありません。
          </p>
          <p className="hint">登録されている服種類：</p>
          <ul className="coverage-list">
            {brandCoverage.availableItemTypes.map((it) => (
              <li key={it.itemType}>
                <span className={`badge prio-${it.priority || 'X'}`}>優先度 {it.priority || '-'}</span>
                <span className="cov-type">{it.itemType}</span>
                {it.aim && <span className="cov-aim">／ {it.aim}</span>}
              </li>
            ))}
          </ul>
          <p className="hint mt-8">
            この服種類は実売相場で判定が必要です。「AI判定する」を実行すると、自動で売り切れ相場を取得して判定します。
          </p>
        </div>
      ) : (
        <div className="matched matched-none">
          <h3>マスター対象外</h3>
          <p className="hint">このブランドはマスターに登録されていません。「AI判定する」を実行すると、画像と入力内容から自動で売り切れ相場を取得して判定します。</p>
        </div>
      )}

      {imageNotes && imageNotes.length > 0 && (
        <div className="image-notes">
          <h3>画像から確認</h3>
          <ul>{imageNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}

      {imageNotes && imageNotes.length > 0 && (
        <div className="image-notes">
          <h3>画像から確認</h3>
          <ul>{imageNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}

      {result.reasons.length > 0 && (
        <>
          <h3>理由</h3>
          <ul>{result.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {result.warnings.length > 0 && (
        <>
          <h3>注意</h3>
          <ul>{result.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {result.nextActions.length > 0 && (
        <>
          <h3>次にやること</h3>
          <ul>
            {result.nextActions.map((x, i) => (
              <li key={i}>
                {x.startsWith('相場検索：') ? (
                  <a href={x.replace('相場検索：', '')} target="_blank" rel="noreferrer">
                    メルカリ検索を開く <ExternalLink size={14} />
                  </a>
                ) : x}
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="btn btn-primary save-btn" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
        {saving ? '保存中...' : '仕入れ記録に保存'}
      </button>
    </section>
  );
}

import React from 'react';
import { ExternalLink, RefreshCw, Save, Loader as Loader2, Sparkles } from 'lucide-react';
import type { JudgeResult, MasterRule } from '../types';
import type { SaleOverride } from '../lib/judge';
import type { BrandCoverage } from '../lib/search';
import { yen } from '../lib/number';

type AiFallback = {
  estimatedSaleMin: number;
  estimatedSaleMax: number;
  decision: string;
  confidence: 'low' | 'medium' | 'high' | string;
  reasoning: string;
  sources: string[];
  risks: string[];
  recommendation: string;
};

type Props = {
  result: JudgeResult;
  bestRule: MasterRule | undefined;
  brandCoverage?: BrandCoverage;
  judgeMode?: 'master' | 'comps' | 'blended' | null;
  imageNotes?: string[];
  useActualSales: boolean;
  onToggleActualSales: (next: boolean) => void;
  onApplyActualSales: () => void;
  applyingSales: boolean;
  saleOverride: SaleOverride | null;
  onSave: () => void;
  saving: boolean;
  aiFallback?: AiFallback | null;
  aiFallbackLoading?: boolean;
};

export function JudgeResultCard({
  result,
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
  aiFallback,
  aiFallbackLoading,
}: Props) {
  const decisionClass =
    result.decision === '買い' ? 'buy' :
    result.decision === '条件付き買い' ? 'maybe' :
    result.decision === '慎重' ? 'careful' : 'stop';

  return (
    <section className={`card result-card ${decisionClass}`}>
      <h2>AI判定</h2>

      {judgeMode && (
        <div className={`mode-pill mode-${judgeMode}`}>
          {judgeMode === 'master' && 'パターン1：マスタールール判定'}
          {judgeMode === 'blended' && 'パターン2：ハイブリッド判定（パターン1 ＋ 画像 ＋ 売り切れ相場）'}
          {judgeMode === 'comps' && 'パターン2：ハイブリッド判定（マスター対象外のため画像＋売り切れ相場のみ）'}
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

      {aiFallbackLoading && (
        <div className="ai-fallback ai-fallback-loading">
          <Loader2 className="spin" size={16} />
          <span>マスター・売り切れ相場が無いため、AIが独自に参考相場を調査中…</span>
        </div>
      )}

      {aiFallback && !aiFallbackLoading && (
        <div className="ai-fallback">
          <div className="ai-fallback-head">
            <Sparkles size={16} />
            <strong>AI独自判断（参考）</strong>
            <span className={`ai-conf ai-conf-${aiFallback.confidence}`}>信頼度：{aiFallback.confidence}</span>
          </div>
          <p className="ai-fallback-note">
            メルカリ・Yahoo!フリマ・マスターに該当データが無いため、ブランドの一般相場や公開情報からAIが独自に推定した参考値です。最終判断はご自身で行ってください。
          </p>
          <div className="ai-fallback-grid">
            <div>
              <span>AI推定 想定販売</span>
              <strong>{yen(aiFallback.estimatedSaleMin)}〜{yen(aiFallback.estimatedSaleMax)}</strong>
            </div>
            <div>
              <span>AI判定</span>
              <strong>{aiFallback.decision}</strong>
            </div>
          </div>
          <h4>根拠</h4>
          <p>{aiFallback.reasoning}</p>
          {aiFallback.sources?.length > 0 && (
            <>
              <h4>参照した情報源（推定）</h4>
              <ul>{aiFallback.sources.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {aiFallback.risks?.length > 0 && (
            <>
              <h4>注意点</h4>
              <ul>{aiFallback.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {aiFallback.recommendation && (
            <p className="ai-fallback-reco"><strong>AIからのアドバイス：</strong>{aiFallback.recommendation}</p>
          )}
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

import React from 'react';
import { ExternalLink, RefreshCw, Save, Loader as Loader2 } from 'lucide-react';
import type { JudgeResult, MasterRule } from '../types';
import type { SaleOverride } from '../lib/judge';
import { yen } from '../lib/number';

type Props = {
  result: JudgeResult;
  bestRule: MasterRule | undefined;
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
  bestRule,
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

  return (
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
      ) : (
        <div className="matched matched-none">
          <h3>マスター対象外</h3>
          <p className="hint">このブランド×服種類の組み合わせはマスターに登録されていません。判定スコアは一般ロジックのみで算出しています。</p>
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

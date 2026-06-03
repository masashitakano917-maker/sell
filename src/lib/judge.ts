import type { JudgeResult, MasterRule, ProductInput } from '../types';
import { clamp, toNumber } from './number';
import { findBestRule } from './search';

const priorityBase: Record<string, number> = { S: 30, A: 22, B: 12, C: 4 };

function includesAny(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

export type SaleOverride = {
  saleMin: number;
  saleMax: number;
  sampleCount: number;
};

export function judgeProduct(
  rules: MasterRule[],
  input: ProductInput,
  override?: SaleOverride | null,
): JudgeResult {
  const rule = findBestRule(rules, input.brand, input.itemType, input.category);
  const masterMin = toNumber(rule?.想定販売価格_min, 0);
  const masterMax = toNumber(rule?.想定販売価格_max, masterMin);
  let saleMin = masterMin;
  let saleMax = masterMax;
  let blended = false;
  if (override) {
    const compMid = (override.saleMin + override.saleMax) / 2;
    if (rule && masterMax > 0) {
      const masterMid = (masterMin + masterMax) / 2;
      const spread = masterMax - masterMin;
      const wComp = Math.min(1, override.sampleCount / 5);
      const newMid = masterMid * (1 - wComp) + compMid * wComp;
      saleMin = Math.max(0, Math.round(newMid - spread / 2));
      saleMax = Math.round(newMid + spread / 2);
      blended = true;
    } else {
      saleMin = override.saleMin;
      saleMax = override.saleMax;
    }
  }
  const maxBuy = toNumber(rule?.仕入れ上限_max, 0);
  const shipMin = input.expectedShipping || toNumber(rule?.想定送料_min, 230);
  const shipMax = input.expectedShipping || toNumber(rule?.想定送料_max, shipMin);
  const profitMin = saleMin * 0.9 - input.purchasePrice - shipMax;
  const profitMax = saleMax * 0.9 - input.purchasePrice - shipMin;

  const reasons: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  const saleAvg = (saleMin + saleMax) / 2;
  const targetProfit = 2500;
  const noRuleSuggestedMaxBuy =
    !rule && saleAvg > 0
      ? Math.max(0, Math.floor(saleAvg * 0.9 - shipMax - targetProfit))
      : 0;

  let score = 0;
  if (rule) {
    score += priorityBase[rule.優先度] ?? 8;
    score += Math.min(20, Math.max(0, toNumber(rule.ブランドスコア, 0) / 5));
    score += Math.min(15, Math.max(0, toNumber(rule.ジャンルスコア, 0) / 7));
    reasons.push(`${rule.ブランド日本語 || rule.ブランド} / ${rule.服種類} のマスターに一致`);
    reasons.push(`優先度 ${rule.優先度}：${rule['商品名・狙い目']}`);
  } else if (override && override.sampleCount >= 3 && saleAvg > 0) {
    score += 18;
    reasons.push(
      `マスターには未登録ですが、実売データ ${override.sampleCount}件・平均 ${Math.round(saleAvg).toLocaleString()}円から相場ベースで判定します`,
    );
    if (noRuleSuggestedMaxBuy > 0) {
      reasons.push(
        `相場平均から逆算した仕入れ上限目安：${noRuleSuggestedMaxBuy.toLocaleString()}円（粗利${targetProfit.toLocaleString()}円確保ベース）`,
      );
    }
  } else {
    warnings.push('マスター対象外で、売り切れ実売データもまだ無いため判定の信頼度は低いです。先に売り切れ相場検索を実行してください。');
    score += 5;
  }

  if (override) {
    if (blended) {
      reasons.push(
        `ハイブリッド判定：マスター想定 ${masterMin.toLocaleString()}〜${masterMax.toLocaleString()}円 と 実売 ${override.sampleCount}件平均 ${Math.round((override.saleMin + override.saleMax) / 2).toLocaleString()}円 を合算 → ${saleMin.toLocaleString()}〜${saleMax.toLocaleString()}円`,
      );
    } else {
      reasons.push(`実売データ ${override.sampleCount}件で想定販売価格を補正：${override.saleMin.toLocaleString()}〜${override.saleMax.toLocaleString()}円`);
    }
  }

  if (input.purchasePrice > 0 && maxBuy > 0) {
    if (input.purchasePrice <= maxBuy) {
      score += 15;
      reasons.push(`仕入れ値が上限目安 ${maxBuy.toLocaleString()}円以内`);
    } else {
      score -= 20;
      warnings.push(`仕入れ値が上限目安 ${maxBuy.toLocaleString()}円を超えています`);
    }
  } else if (input.purchasePrice > 0 && noRuleSuggestedMaxBuy > 0) {
    if (input.purchasePrice <= noRuleSuggestedMaxBuy) {
      score += 18;
      reasons.push(`仕入れ値が相場ベース上限 ${noRuleSuggestedMaxBuy.toLocaleString()}円以内`);
    } else {
      score -= 22;
      warnings.push(`仕入れ値が相場ベース上限 ${noRuleSuggestedMaxBuy.toLocaleString()}円を超えています`);
    }
  }

  if (profitMin >= 3000) score += 20;
  else if (profitMax >= 3000) score += 12;
  else if (profitMax >= 1500) score += 5;
  else {
    score -= 15;
    warnings.push('想定粗利が低いです。値下げ・送料で赤字化しやすいです。');
  }

  const materialText = `${input.material} ${rule?.素材タグ ?? ''} ${rule?.素材加点 ?? ''}`;
  if (includesAny(materialText, ['シルク', '絹', 'リネン', '麻', 'カシミヤ', 'cashmere', 'wool', 'ウール'])) {
    score += 8;
    reasons.push('素材加点あり');
  }

  if (input.hasTag) {
    score += 10;
    reasons.push('新品タグ付き/タグありで販売訴求しやすい');
  }

  if (input.soldCompsCount >= toNumber(rule?.最低確認相場数, 3)) {
    score += 15;
    reasons.push(`売り切れ相場 ${input.soldCompsCount}件確認済み`);
  } else if (input.soldCompsCount === 0) {
    score -= 20;
    warnings.push('売り切れ相場が未確認です。価格設定の信頼度が低いです。');
  } else {
    score -= 5;
    warnings.push('売り切れ相場確認数が少ないです。');
  }

  if (input.hasDamage) {
    score -= 25;
    warnings.push('ダメージあり。写真掲載と価格調整が必要です。');
  }
  if (input.hasSmell) {
    score -= 30;
    warnings.push('臭いあり。返品リスクが高いです。');
  }
  if (input.authenticityUnclear || includesAny(`${rule?.偽物リスク ?? ''} ${rule?.リスクタグ ?? ''}`, ['真贋', '偽物'])) {
    score -= input.authenticityUnclear ? 50 : 10;
    warnings.push('真贋・正規タグ確認が必要です。');
  }

  const control = rule?.購入制御ルール || '';
  if (control.includes('原則見送り')) {
    score -= 15;
    warnings.push('マスター上の購入制御は「原則見送り」です。即買いせず状態と相場を再確認してください。');
  }

  score = clamp(Math.round(score), 0, 100);
  let decision: JudgeResult['decision'] = '見送り';
  if (score >= 80) decision = '買い';
  else if (score >= 60) decision = '条件付き買い';
  else if (score >= 40) decision = '慎重';

  if (rule?.写真必須箇所) nextActions.push(`撮影：${rule.写真必須箇所}`);
  if (rule?.AI追加質問) nextActions.push(`確認質問：${rule.AI追加質問}`);
  if (rule?.メルカリ検索URL1) nextActions.push(`相場検索：${rule.メルカリ検索URL1}`);
  nextActions.push('購入前にメルカリ売り切れ履歴を3件以上確認');

  return {
    matchedRule: rule,
    score,
    decision,
    estimatedSaleMin: saleMin,
    estimatedSaleMax: saleMax,
    estimatedProfitMin: profitMin,
    estimatedProfitMax: profitMax,
    suggestedMaxBuy: maxBuy > 0 ? maxBuy : noRuleSuggestedMaxBuy > 0 ? noRuleSuggestedMaxBuy : undefined,
    reasons,
    warnings,
    nextActions,
  };
}

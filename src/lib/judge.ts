import type { JudgeResult, MasterRule, ProductInput } from '../types';
import { clamp, toNumber } from './number';
import { findBestRule } from './search';

const priorityBase: Record<string, number> = { S: 30, A: 22, B: 12, C: 4 };

function includesAny(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

export function judgeProduct(rules: MasterRule[], input: ProductInput): JudgeResult {
  const rule = findBestRule(rules, input.brand, input.itemType, input.category);
  const saleMin = toNumber(rule?.想定販売価格_min, 0);
  const saleMax = toNumber(rule?.想定販売価格_max, saleMin);
  const maxBuy = toNumber(rule?.仕入れ上限_max, 0);
  const shipMin = input.expectedShipping || toNumber(rule?.想定送料_min, 230);
  const shipMax = input.expectedShipping || toNumber(rule?.想定送料_max, shipMin);
  const profitMin = saleMin * 0.9 - input.purchasePrice - shipMax;
  const profitMax = saleMax * 0.9 - input.purchasePrice - shipMin;

  const reasons: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  let score = 0;
  if (rule) {
    score += priorityBase[rule.優先度] ?? 8;
    score += Math.min(20, Math.max(0, toNumber(rule.ブランドスコア, 0) / 5));
    score += Math.min(15, Math.max(0, toNumber(rule.ジャンルスコア, 0) / 7));
    reasons.push(`${rule.ブランド日本語 || rule.ブランド} / ${rule.服種類} のマスターに一致`);
    reasons.push(`優先度 ${rule.優先度}：${rule['商品名・狙い目']}`);
  } else {
    warnings.push('マスターに近いブランド・商品ルールが見つかりません。相場確認必須です。');
    score += 5;
  }

  if (input.purchasePrice > 0 && maxBuy > 0) {
    if (input.purchasePrice <= maxBuy) {
      score += 15;
      reasons.push(`仕入れ値が上限目安 ${maxBuy.toLocaleString()}円以内`);
    } else {
      score -= 20;
      warnings.push(`仕入れ値が上限目安 ${maxBuy.toLocaleString()}円を超えています`);
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
    reasons,
    warnings,
    nextActions,
  };
}

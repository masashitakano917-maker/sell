import masterData from '../data/master.json';
import type { MasterRule } from '../types';

const rules = masterData as MasterRule[];

function uniq(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];
}

export const CATEGORIES: string[] = uniq(rules.map((r) => r.カテゴリ))
  .filter((c) => !['仕入れ場所', '仕入れ判断', '出品テンプレ'].includes(c));

export const ITEM_TYPES: string[] = uniq(rules.map((r) => r.服種類))
  .filter((t) => !['要確認', '仕入れ場所', '運用ルール', '出品作業'].includes(t));

export const BRANDS: { value: string; label: string }[] = uniq(
  rules.map((r) => `${r.ブランド}|||${r.ブランド日本語 ?? ''}`)
)
  .map((s) => {
    const [brand, jp] = s.split('|||');
    return { value: brand, label: jp ? `${jp} (${brand})` : brand };
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'ja'));

export const CONDITIONS: string[] = [
  '新品・未使用',
  '未使用に近い',
  '美品',
  '目立った傷や汚れなし',
  'やや傷や汚れあり',
  '傷や汚れあり',
  '全体的に状態が悪い',
];

export const SIZES_CLOTHING: string[] = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3L',
  'F (フリー)',
  '34', '36', '38', '40', '42', '44',
  '0', '1', '2', '3', '4',
  '5号', '7号', '9号', '11号', '13号', '15号', '17号',
];

export const SIZES_SHOES: string[] = [
  '22.0', '22.5', '23.0', '23.5', '24.0', '24.5',
  '25.0', '25.5', '26.0', '26.5', '27.0', '27.5', '28.0',
];

export const SIZES_BAG: string[] = ['ミニ', 'スモール', 'ミディアム', 'ラージ', 'XL', '指定なし'];

export function sizesForCategory(category: string): string[] {
  if (category === '靴') return SIZES_SHOES;
  if (category === 'バッグ・小物' || category === '高級ブランド') return SIZES_BAG;
  return SIZES_CLOTHING;
}

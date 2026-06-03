import type { MasterRule } from '../types';

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

export function findBestRule(rules: MasterRule[], brand: string, itemType: string, category: string): MasterRule | undefined {
  const b = norm(brand);
  const t = norm(itemType);
  const c = norm(category);

  const scored = rules.map((rule) => {
    let score = 0;
    const rb = norm(rule.ブランド);
    const rbjp = norm(rule.ブランド日本語);
    const rt = norm(rule.服種類 + ' ' + rule['商品名・狙い目']);
    const rc = norm(rule.カテゴリ);

    if (b && (rb.includes(b) || b.includes(rb) || rbjp.includes(b) || b.includes(rbjp))) score += 60;
    if (t && rt.includes(t)) score += 25;
    if (c && rc.includes(c)) score += 15;
    return { rule, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].rule : undefined;
}

export function filterRules(rules: MasterRule[], query: string): MasterRule[] {
  const q = norm(query);
  if (!q) return rules.slice(0, 50);
  return rules.filter((r) => norm([
    r.ブランド,
    r.ブランド日本語,
    r.カテゴリ,
    r.服種類,
    r['商品名・狙い目'],
    r.検索キーワード,
  ].join(' ')).includes(q)).slice(0, 100);
}

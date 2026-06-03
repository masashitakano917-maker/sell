import type { MasterRule } from '../types';

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

export function findBestRule(rules: MasterRule[], brand: string, itemType: string, category: string): MasterRule | undefined {
  const b = norm(brand);
  const t = norm(itemType);
  const c = norm(category);

  const scored = rules.map((rule) => {
    const rb = norm(rule.ブランド);
    const rbjp = norm(rule.ブランド日本語);
    const rt = norm(rule.服種類 + ' ' + rule['商品名・狙い目']);
    const rc = norm(rule.カテゴリ);

    const brandMatch = !!b && (rb.includes(b) || b.includes(rb) || rbjp.includes(b) || b.includes(rbjp));
    const itemMatch = !!t && rt.includes(t);
    const categoryMatch = !!c && rc.includes(c);

    let score = 0;
    if (brandMatch) score += 60;
    if (itemMatch) score += 25;
    if (categoryMatch) score += 15;
    return { rule, score, brandMatch, itemMatch, categoryMatch };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score === 0) return undefined;

  if (b && t) {
    const exact = scored.find((s) => s.brandMatch && s.itemMatch);
    if (exact) return exact.rule;
    return undefined;
  }

  if (b && !t) {
    return top.brandMatch ? top.rule : undefined;
  }

  return top.rule;
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

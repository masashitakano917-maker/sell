import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { MasterRule } from '../types';
import { filterRules } from '../lib/search';

type Props = {
  rules: MasterRule[];
  onPick: (r: MasterRule) => void;
};

export function MasterSearch({ rules, onPick }: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterRules(rules, query), [rules, query]);

  return (
    <section className="card search-card">
      <h2><Search size={20} /> マスター検索</h2>
      <input className="wide" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ブランド名、商品名、カテゴリで検索" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>優先度</th><th>ブランド</th><th>カテゴリ</th><th>狙い目</th><th>上限</th><th>販売目安</th><th>検索</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rule_id} onClick={() => onPick(r)}>
                <td><span className={`badge p-${r.優先度}`}>{r.優先度}</span></td>
                <td>{r.ブランド日本語 || r.ブランド}<br /><small>{r.ブランド}</small></td>
                <td>{r.カテゴリ}</td>
                <td>{r['商品名・狙い目']}</td>
                <td>{r.仕入れ上限}</td>
                <td>{r.想定販売価格}</td>
                <td>{r.メルカリ検索URL1 && <a href={r.メルカリ検索URL1} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>開く</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

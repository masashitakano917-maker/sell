import React from 'react';
import { Search, Loader as Loader2, ExternalLink } from 'lucide-react';
import { yen } from '../lib/number';

export type CompItem = { title: string; price: number; url: string; thumbnail?: string };
export type CompSiteResult = { count: number; items: CompItem[]; average: number; searchUrl: string; error?: string };
export type CompSearchData = {
  keyword: string;
  mercari: CompSiteResult;
  paypay: CompSiteResult;
  overall: { count: number; average: number };
};

type Props = {
  keyword: string;
  onKeyword: (s: string) => void;
  onSearch: () => void;
  loading: boolean;
  data: CompSearchData | null;
};

function SiteBlock({ name, data }: { name: string; data: CompSiteResult }) {
  return (
    <div className="comp-site">
      <div className="comp-site-head">
        <strong>{name}</strong>
        <a href={data.searchUrl} target="_blank" rel="noreferrer" className="comp-link">
          サイトで見る <ExternalLink size={12} />
        </a>
      </div>
      {data.error && <p className="hint">取得失敗: {data.error}</p>}
      <div className="comp-stat-row">
        <div><span>売り切れ件数</span><strong>{data.count}件</strong></div>
        <div><span>平均値</span><strong>{yen(data.average)}</strong></div>
      </div>
      {data.items.length > 0 ? (
        <ul className="comp-list">
          {data.items.slice(0, 10).map((it, i) => (
            <li key={i}>
              <a href={it.url} target="_blank" rel="noreferrer">
                <span className="comp-price">{yen(it.price)}</span>
                <span className="comp-title">{it.title || it.url}</span>
                <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        !data.error && <p className="hint">該当の売り切れ商品が見つかりませんでした。</p>
      )}
    </div>
  );
}

export function CompSearch({ keyword, onKeyword, onSearch, loading, data }: Props) {
  return (
    <section className="card">
      <h2>売り切れ相場検索</h2>
      <p className="hint">メルカリと PayPay フリマで「売り切れ」を自動検索します。</p>
      <div className="comp-search-row">
        <input
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          placeholder="例：CELFORD ワンピース 38"
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
        />
        <button className="btn btn-primary" onClick={onSearch} disabled={loading || !keyword.trim()}>
          {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      {data && (
        <>
          <div className="comp-overall">
            <div><span>合計売り切れ</span><strong>{data.overall.count}件</strong></div>
            <div><span>全体平均</span><strong>{yen(data.overall.average)}</strong></div>
          </div>
          <div className="comp-grid">
            <SiteBlock name="メルカリ" data={data.mercari} />
            <SiteBlock name="PayPay フリマ" data={data.paypay} />
          </div>
        </>
      )}
    </section>
  );
}

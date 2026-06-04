import React from 'react';
import { Search, Loader as Loader2, ExternalLink, ScanSearch, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Circle as XCircle, Circle as HelpCircle } from 'lucide-react';
import { yen } from '../lib/number';

export type MatchLevel = 'same' | 'similar' | 'different' | 'unknown';
export type CompItem = {
  id?: string;
  title: string;
  price: number;
  url: string;
  thumbnail?: string;
  match?: { level: MatchLevel; reason?: string };
};
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
  hasReferenceImages: boolean;
  onMatch: () => void;
  matching: boolean;
};

function MatchBadge({ match }: { match?: { level: MatchLevel; reason?: string } }) {
  if (!match) return null;
  const map = {
    same: { label: '同一品', cls: 'badge-same', Icon: CheckCircle2 },
    similar: { label: '類似', cls: 'badge-similar', Icon: AlertCircle },
    different: { label: '別物', cls: 'badge-diff', Icon: XCircle },
    unknown: { label: '不明', cls: 'badge-unknown', Icon: HelpCircle },
  } as const;
  const m = map[match.level] ?? map.unknown;
  return (
    <span className={`match-badge ${m.cls}`} title={match.reason ?? ''}>
      <m.Icon size={12} /> {m.label}
    </span>
  );
}

function SiteBlock({ name, data }: { name: string; data: CompSiteResult }) {
  const sameItems = data.items.filter((i) => i.match?.level === 'same');
  const sameAvg = sameItems.length
    ? Math.round(sameItems.reduce((s, i) => s + i.price, 0) / sameItems.length)
    : 0;

  const rank: Record<MatchLevel | 'none', number> = {
    same: 4,
    similar: 3,
    unknown: 2,
    different: 1,
    none: 0,
  };
  const sortedItems = data.items
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => {
      const ra = rank[a.it.match?.level ?? 'none'];
      const rb = rank[b.it.match?.level ?? 'none'];
      if (rb !== ra) return rb - ra;
      return a.idx - b.idx;
    })
    .map((x) => x.it);

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
      {sameItems.length > 0 && (
        <div className="comp-stat-row" style={{ background: '#e9f8ed', borderRadius: 8 }}>
          <div><span>同一品</span><strong>{sameItems.length}件</strong></div>
          <div><span>同一品平均</span><strong>{yen(sameAvg)}</strong></div>
        </div>
      )}
      {data.items.length > 0 ? (
        <ul className="comp-list">
          {sortedItems.slice(0, 10).map((it, i) => (
            <li key={i}>
              <a href={it.url} target="_blank" rel="noreferrer">
                {it.thumbnail && <img src={it.thumbnail} alt="" className="comp-thumb" loading="lazy" />}
                <span className="comp-price">{yen(it.price)}</span>
                <span className="comp-title">{it.title || it.url}</span>
                <MatchBadge match={it.match} />
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

export function CompSearch({ keyword, onKeyword, onSearch, loading, data, hasReferenceImages, onMatch, matching }: Props) {
  const isEmpty = data !== null && data.overall.count === 0;
  return (
    <section className="card full-row">
      <h2>売り切れ相場検索</h2>
      <p className="hint">メルカリと Yahoo!フリマで「売り切れ」を自動検索します。</p>
      <div className="comp-search-row">
        <input
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          placeholder="例：CELFORD ワンピース 38"
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
        />
        <button className="btn btn-primary" onClick={onSearch} disabled={loading || !keyword.trim()}>
          {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
          {loading ? '検索中...' : isEmpty ? '再検索' : '検索'}
        </button>
      </div>

      {isEmpty && (
        <div className="empty-rescue">
          <p>
            <strong>「{data!.keyword}」で売り切れ商品が見つかりませんでした。</strong>
          </p>
          <p className="hint">
            キーワードを短くする／別の表記に変える／サイズや色を外すと見つかることがあります。上のキーワード欄を編集して「再検索」を押してください。
          </p>
        </div>
      )}

      {data && data.overall.count > 0 && (
        <>
          <div className="comp-overall">
            <div><span>合計売り切れ</span><strong>{data.overall.count}件</strong></div>
            <div><span>全体平均</span><strong>{yen(data.overall.average)}</strong></div>
            <button
              className="btn btn-ghost"
              onClick={onMatch}
              disabled={matching || !hasReferenceImages || data.overall.count === 0}
              title={!hasReferenceImages ? '先に商品画像をアップロードしてください' : ''}
              style={{ marginLeft: 'auto' }}
            >
              {matching ? <Loader2 className="spin" size={16} /> : <ScanSearch size={16} />}
              {matching ? 'AI画像照合中...' : 'AIで同一品を判定'}
            </button>
          </div>
          {!hasReferenceImages && (
            <p className="hint">画像で同一品を判定するには、先に商品入力で写真をアップロード／撮影してください。</p>
          )}
          <div className="comp-grid">
            <SiteBlock name="メルカリ" data={data.mercari} />
            <SiteBlock name="Yahoo!フリマ" data={data.paypay} />
          </div>
        </>
      )}
    </section>
  );
}

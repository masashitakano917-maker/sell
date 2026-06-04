import React, { useState } from 'react';
import { Loader as Loader2, Wand as Wand2, Copy, Check } from 'lucide-react';

export type ListingDraft = {
  title: string;
  description: string;
  hashtags: string[];
  priceTips: string[];
  source?: string;
};

type Props = {
  draft: ListingDraft | null;
  loading: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <button type="button" className="btn btn-ghost btn-copy" onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'コピー済' : label}
    </button>
  );
}

export function ListingHelper({ draft, loading, onGenerate, disabled, disabledReason }: Props) {
  const fullText = draft
    ? `${draft.title}\n\n${draft.description}\n\n${draft.hashtags.join(' ')}`
    : '';

  return (
    <section className="card listing-card">
      <div className="row-between">
        <h2>出品文 自動生成</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={loading || disabled}
          title={disabled ? disabledReason : ''}
        >
          {loading ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
          {loading ? '生成中…' : draft ? '再生成' : '出品文を生成'}
        </button>
      </div>
      <p className="hint">
        商品情報・画像から、メルカリ／Yahoo!フリマ向けのタイトル・説明・ハッシュタグをAIが作成します。
      </p>

      {!draft && !loading && disabled && (
        <p className="hint">{disabledReason}</p>
      )}

      {draft && (
        <div className="listing-grid">
          <div className="listing-block">
            <div className="listing-head">
              <strong>タイトル</strong>
              <span className="muted">{draft.title.length}文字</span>
              <CopyButton value={draft.title} label="コピー" />
            </div>
            <div className="listing-body">{draft.title}</div>
          </div>

          <div className="listing-block">
            <div className="listing-head">
              <strong>商品説明</strong>
              <CopyButton value={draft.description} label="コピー" />
            </div>
            <pre className="listing-body listing-pre">{draft.description}</pre>
          </div>

          <div className="listing-block">
            <div className="listing-head">
              <strong>ハッシュタグ</strong>
              <CopyButton value={draft.hashtags.join(' ')} label="コピー" />
            </div>
            <div className="listing-tags">
              {draft.hashtags.map((t, i) => (
                <span key={i} className="hashtag">{t}</span>
              ))}
            </div>
          </div>

          {draft.priceTips.length > 0 && (
            <div className="listing-block">
              <div className="listing-head">
                <strong>出品時のヒント</strong>
              </div>
              <ul className="listing-tips">
                {draft.priceTips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          <div className="listing-actions">
            <CopyButton value={fullText} label="まとめてコピー" />
            {draft.source === 'fallback' && (
              <span className="muted small">テンプレ生成（GEMINI未設定 or 失敗時）</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

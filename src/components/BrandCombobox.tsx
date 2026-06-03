import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { BRANDS } from '../lib/options';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function BrandCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const display = useMemo(() => {
    const match = BRANDS.find((b) => b.value === value);
    return match ? match.label : value;
  }, [value]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function onDocClick(e: Event) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRANDS;
    return BRANDS.filter((b) => b.label.toLowerCase().includes(q) || b.value.toLowerCase().includes(q));
  }, [query]);

  function commitFreeText() {
    const v = query.trim();
    if (v.length === 0) return;
    const exact = BRANDS.find((b) => b.label.toLowerCase() === v.toLowerCase() || b.value.toLowerCase() === v.toLowerCase());
    onChange(exact ? exact.value : v);
    setOpen(false);
  }

  function selectBrand(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        selectBrand(filtered[activeIndex].value);
      } else {
        commitFreeText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="brand-combo" ref={wrapperRef}>
      <div className="brand-combo-input">
        <input
          ref={inputRef}
          value={open ? query : display}
          placeholder="ブランド名を入力または選択"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
            if (e.target.value === '') onChange('');
          }}
          onBlur={() => {
            if (open && query.trim() !== '') {
              window.setTimeout(commitFreeText, 120);
            }
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="brand-clear"
            aria-label="クリア"
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setQuery(''); inputRef.current?.focus(); }}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          className="brand-toggle"
          aria-label="一覧を開く"
          onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); inputRef.current?.focus(); }}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <ul className="brand-options" ref={listRef} role="listbox">
          {filtered.length === 0 && query.trim() !== '' && (
            <li className="brand-option brand-option-add" onMouseDown={(e) => { e.preventDefault(); commitFreeText(); }}>
              「{query.trim()}」を入力値として使う
            </li>
          )}
          {filtered.slice(0, 80).map((b, i) => (
            <li
              key={b.value}
              role="option"
              aria-selected={value === b.value}
              className={`brand-option${i === activeIndex ? ' active' : ''}${value === b.value ? ' selected' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => { e.preventDefault(); selectBrand(b.value); }}
            >
              {b.label}
            </li>
          ))}
          {filtered.length > 80 && (
            <li className="brand-option-hint">他 {filtered.length - 80} 件あります。文字を入力して絞り込んでください。</li>
          )}
        </ul>
      )}
    </div>
  );
}

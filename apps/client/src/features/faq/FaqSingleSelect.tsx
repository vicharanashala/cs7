// Single-select dropdown for FAQ filters (e.g. Status). Closes on outside click or Escape.
// Shared by the dashboard Browse FAQs page and the public login-page knowledge base so the
// filter looks and behaves identically in both. Pairs with the multi-select <FaqMultiSelect>.
import { useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useExclusiveOpen } from '../../hooks/useExclusiveOpen';

const ITEM_H = 36;
const VISIBLE = 5;
const MAX_H = ITEM_H * VISIBLE + 8;

export function FaqSingleSelect({
  dropdownKey,
  value,
  onChange,
  placeholder,
  options,
  width,
}: {
  dropdownKey: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  width?: number;
}) {
  const { isOpen: open, toggle, close } = useExclusiveOpen(dropdownKey);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = Boolean(value);
  const currentLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, close]);

  const select = (v: string) => {
    onChange(v || undefined);
    close();
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, minWidth: width ?? 130 }}>
      {/* ── Trigger button ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 36,
          padding: '0 10px',
          borderRadius: 8,
          border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: isActive ? 'var(--color-purple-bg)' : 'var(--color-input)',
          color: isActive ? 'var(--color-purple)' : 'var(--color-text)',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          cursor: 'pointer',
          fontFamily: 'inherit',
          gap: 6,
          outline: 'none',
          transition: 'border-color 0.15s, background 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)';
        }}
        onMouseLeave={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}</span>
        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            transition: 'transform 0.18s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
          color="var(--color-text-muted)"
        />
      </button>

      {/* ── Dropdown panel ─────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 1200,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
            // Cap height at VISIBLE rows — the rest scrolls
            maxHeight: MAX_H,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {/* "All" / reset option */}
          <DropdownOption label={placeholder} selected={!value} onSelect={() => select('')} />
          {options.map((o) => (
            <DropdownOption
              key={o.value}
              label={o.label}
              selected={value === o.value}
              onSelect={() => select(o.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        height: ITEM_H,
        cursor: 'pointer',
        background: selected ? 'var(--color-purple-bg)' : 'transparent',
        color: selected ? 'var(--color-purple)' : 'var(--color-text)',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        outline: 'none',
        transition: 'background 0.1s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--color-input)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = selected
          ? 'var(--color-purple-bg)'
          : 'transparent';
      }}
    >
      <span>{label}</span>
      {selected && <Check size={13} color="var(--color-purple)" strokeWidth={2.5} />}
    </div>
  );
}
